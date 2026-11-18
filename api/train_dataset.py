"""
Dataset Trainer & Calibrator for Mini Komander Build.
Trains strictly on:
- `cad/train` (FloorPlanCAD vector `.svg` + `.png` files, plus any `.dxf` files)
- `images/train` (2D floor plan `.jpg` images)

And indexes hold-out test sets:
- `cad/test`
- `images/test`

Saves the calibrated statistical model to `api/learned_model.json`.
"""

import glob
import json
import math
import os
import re
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone

import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))

CAD_TRAIN_DIR = os.path.join(ROOT_DIR, "cad", "train")
CAD_TEST_DIR = os.path.join(ROOT_DIR, "cad", "test")
IMG_TRAIN_DIR = os.path.join(ROOT_DIR, "images", "train")
IMG_TEST_DIR = os.path.join(ROOT_DIR, "images", "test")
MODEL_PATH = os.path.join(BASE_DIR, "learned_model.json")

SVG_UNIT_TO_METER = 0.14  # 100x100 SVG viewBox -> ~14m x 14m CAD tile


def _extract_dims_from_filename(filename: str):
    """Extract real-world floor area in m2 from floorplan filenames if present."""
    name = filename.lower()
    m_meter = re.search(r"(\d+(?:[._]\d+)?)\s*x\s*(\d+(?:[._]\d+)?)[-\s]*(?:m|meter)", name)
    if m_meter:
        w = float(m_meter.group(1).replace("_", "."))
        h = float(m_meter.group(2).replace("_", "."))
        return round(w * h, 2)
    m_sqft = re.search(r"(\d{3,4})\s*[-]?\s*(?:sqft|sq[-_]?ft|sf|sft)", name)
    if m_sqft:
        return round(float(m_sqft.group(1)) * 0.092903, 2)
    return None


def _parse_svg_cad_stats(svg_path: str):
    """Extract layer names, semantic IDs, wall length (m), and bbox area (m2) from a CAD SVG."""
    tree = ET.parse(svg_path)
    root = tree.getroot()
    layers = Counter()
    sem_ids = Counter()
    xs, ys = [], []
    wall_len_units = 0.0
    total_len_units = 0.0
    col_count = 0
    door_count = 0
    mep_count = 0
    entity_count = 0

    for g in root.findall(".//{http://www.w3.org/2000/svg}g"):
        lbl = g.attrib.get("{http://www.inkscape.org/namespaces/inkscape}label") or g.attrib.get("id", "0")
        lbl_up = lbl.upper()
        for el in g:
            tag = el.tag.split("}")[-1]
            if tag not in ("path", "circle", "ellipse", "line", "rect", "polygon"):
                continue
            entity_count += 1
            layers[lbl] += 1
            sid = el.attrib.get("semantic-id")
            if sid:
                sem_ids[sid] += 1

            if tag == "path":
                d = el.attrib.get("d", "")
                nums = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+", d)]
                if len(nums) >= 4:
                    x1, y1 = nums[0], nums[1]
                    x2, y2 = nums[-2], nums[-1]
                    xs.extend([x1, x2])
                    ys.extend([y1, y2])
                    seg = math.hypot(x2 - x1, y2 - y1)
                    total_len_units += seg
                    if "WALL" in lbl_up or "墙" in lbl or sid in ("1", "2"):
                        wall_len_units += seg
                if " A " in d or " a " in d or "WINDOW" in lbl_up or "DOOR" in lbl_up or "扇" in lbl:
                    door_count += 1
                if "COLUMN" in lbl_up or "柱" in lbl:
                    col_count += 1
                if "EQUIP" in lbl_up or "PIPE" in lbl_up or "消火栓" in lbl or "消防" in lbl:
                    mep_count += 1
            elif tag == "circle":
                cx = float(el.attrib.get("cx", 0))
                cy = float(el.attrib.get("cy", 0))
                xs.append(cx)
                ys.append(cy)
                if "COLUMN" in lbl_up or "柱" in lbl:
                    col_count += 1
                else:
                    mep_count += 1

    span_x = (max(xs) - min(xs)) * SVG_UNIT_TO_METER if xs else 12.0
    span_y = (max(ys) - min(ys)) * SVG_UNIT_TO_METER if ys else 12.0
    bbox_area_m2 = max(25.0, round(span_x * span_y, 2))
    eff_wall_m = round((wall_len_units if wall_len_units > 0 else total_len_units * 0.35) * SVG_UNIT_TO_METER * 0.5, 2)

    return {
        "layers": layers,
        "sem_ids": sem_ids,
        "entity_count": entity_count,
        "bbox_area_m2": bbox_area_m2,
        "wall_length_m": max(12.0, eff_wall_m),
        "columns": max(4, int(round(col_count / 4)) if col_count > 0 else 6),
        "doors": max(2, int(round(door_count / 3)) if door_count > 0 else 4),
        "mep": max(4, mep_count if mep_count > 0 else 6),
    }


def train_cad_split(max_scan: int = 250):
    train_svgs = sorted(glob.glob(os.path.join(CAD_TRAIN_DIR, "*.svg")))
    test_svgs = sorted(glob.glob(os.path.join(CAD_TEST_DIR, "*.svg")))
    train_pngs = glob.glob(os.path.join(CAD_TRAIN_DIR, "*.png"))
    test_pngs = glob.glob(os.path.join(CAD_TEST_DIR, "*.png"))

    step = max(1, len(train_svgs) // max_scan) if train_svgs else 1
    sampled = train_svgs[::step][:max_scan]

    layer_counts = Counter()
    sem_counts = Counter()
    bbox_areas = []
    wall_lengths = []
    entity_counts = []
    parsed_count = 0

    for path in sampled:
        try:
            st = _parse_svg_cad_stats(path)
            parsed_count += 1
            layer_counts.update(st["layers"])
            sem_counts.update(st["sem_ids"])
            bbox_areas.append(st["bbox_area_m2"])
            wall_lengths.append(st["wall_length_m"])
            entity_counts.append(st["entity_count"])
        except Exception:
            continue

    train_samples = [f"train/{os.path.basename(p)}" for p in train_svgs[:40]]
    test_samples = [f"test/{os.path.basename(p)}" for p in test_svgs[:40]]

    return {
        "train_svg_files": len(train_svgs),
        "train_png_files": len(train_pngs),
        "test_svg_files": len(test_svgs),
        "test_png_files": len(test_pngs),
        "total_files": len(train_svgs) + len(test_svgs),
        "parsed_files": parsed_count,
        "svg_unit_to_meter": SVG_UNIT_TO_METER,
        "median_bbox_area": round(float(np.median(bbox_areas)), 2) if bbox_areas else 145.0,
        "median_wall_length": round(float(np.median(wall_lengths)), 2) if wall_lengths else 52.0,
        "median_entities": int(np.median(entity_counts)) if entity_counts else 320,
        "top_layers": [{"layer": k, "count": v} for k, v in layer_counts.most_common(15)],
        "top_semantic_ids": [{"semantic_id": k, "count": v} for k, v in sem_counts.most_common(10)],
        "samples": test_samples + train_samples[:20],
        "train_samples": train_samples,
        "test_samples": test_samples,
    }


def train_vision_split(max_scan: int = 200):
    train_jpgs = sorted(glob.glob(os.path.join(IMG_TRAIN_DIR, "*.jpg")))
    test_jpgs = sorted(glob.glob(os.path.join(IMG_TEST_DIR, "*.jpg")))

    step = max(1, len(train_jpgs) // max_scan) if train_jpgs else 1
    scanned = train_jpgs[::step][:max_scan]

    diagonals = []
    edge_densities = []
    line_ratios = []
    contour_fill_ratios = []
    known_areas = []

    # Also ensure all labeled train images are included in known_areas
    for path in train_jpgs:
        area = _extract_dims_from_filename(os.path.basename(path))
        if area and 20 <= area <= 700:
            known_areas.append(area)

    for path in scanned:
        img = cv2.imread(path)
        if img is None:
            continue
        h, w = img.shape[:2]
        diag = math.hypot(w, h)
        diagonals.append(diag)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        med = float(np.median(gray))
        lower = int(max(0, 0.66 * med))
        upper = int(min(255, 1.33 * med))
        if upper <= lower:
            lower, upper = 50, 150

        edges = cv2.Canny(gray, lower, upper, apertureSize=3)
        edge_densities.append(float(np.count_nonzero(edges)) / float(w * h))

        min_len = max(25, int(diag * 0.025))
        max_gap = max(8, int(diag * 0.008))
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=50, minLineLength=min_len, maxLineGap=max_gap)

        total_px_len = 0.0
        if lines is not None:
            for ln in lines:
                x1, y1, x2, y2 = ln[0]
                total_px_len += math.hypot(x2 - x1, y2 - y1)
        line_ratios.append(total_px_len / diag if diag > 0 else 0.0)

        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            contour_fill_ratios.append(float(cv2.contourArea(largest)) / float(w * h))

    train_names = [f"train/{os.path.basename(p)}" for p in train_jpgs[:40]]
    test_names = [f"test/{os.path.basename(p)}" for p in test_jpgs]

    return {
        "train_files": len(train_jpgs),
        "test_files": len(test_jpgs),
        "total_files": len(train_jpgs) + len(test_jpgs),
        "scanned_files": len(scanned),
        "labeled_train_count": len(known_areas),
        "median_diagonal_px": round(float(np.median(diagonals)), 1) if diagonals else 1250.0,
        "median_edge_density": round(float(np.median(edge_densities)), 4) if edge_densities else 0.045,
        "median_line_to_diag_ratio": round(float(np.median(line_ratios)), 2) if line_ratios else 18.0,
        "median_contour_fill_ratio": round(float(np.median(contour_fill_ratios)), 3) if contour_fill_ratios else 0.55,
        "median_known_floor_area_m2": round(float(np.median(known_areas)), 1) if known_areas else 111.4,
        "all_filenames": test_names + train_names,
        "train_samples": train_names,
        "test_samples": test_names,
    }


def main():
    print("Training calibration model from cad/train and images/train...")
    cad_stats = train_cad_split()
    img_stats = train_vision_split()

    model = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "splits": {
            "cad_train": cad_stats["train_svg_files"],
            "cad_test": cad_stats["test_svg_files"],
            "images_train": img_stats["train_files"],
            "images_test": img_stats["test_files"],
        },
        "dxf_profile": cad_stats,
        "vision_profile": img_stats,
    }

    with open(MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(model, f, indent=2)

    print(
        f"Saved learned_model.json | "
        f"CAD Train: {cad_stats['train_svg_files']} SVG ({cad_stats['parsed_files']} sampled), CAD Test: {cad_stats['test_svg_files']} SVG | "
        f"Images Train: {img_stats['train_files']} JPG ({img_stats['scanned_files']} sampled), Images Test: {img_stats['test_files']} JPG"
    )


if __name__ == "__main__":
    main()
