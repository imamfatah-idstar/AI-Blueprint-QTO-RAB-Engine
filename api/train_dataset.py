"""
Dataset Trainer & Calibrator for Mini Komander Build.
Learns geometric priors from `examples_dxf/` (.dxf) and visual/structural priors
from `images/` (.jpg), saving the calibrated profile to `learned_model.json`.
"""

import glob
import json
import math
import os
import re
from collections import Counter
from datetime import datetime, timezone

import cv2
import ezdxf
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
DXF_DIR = os.path.join(ROOT_DIR, "examples_dxf")
IMG_DIR = os.path.join(ROOT_DIR, "images")
MODEL_PATH = os.path.join(BASE_DIR, "learned_model.json")


def _extract_dims_from_filename(filename: str):
    """Extract real-world width x length in meters from floorplan filenames if present."""
    name = filename.lower()
    m_meter = re.search(r"(\d+(?:[._]\d+)?)\s*x\s*(\d+(?:[._]\d+)?)\s*(?:m|meter)", name)
    if m_meter:
        w = float(m_meter.group(1).replace("_", "."))
        h = float(m_meter.group(2).replace("_", "."))
        return round(w * h, 2), (w, h)
    m_sqft = re.search(r"(\d{3,4})\s*[-]?\s*(?:sqft|sq[-_]?ft|sf)", name)
    if m_sqft:
        sqft = float(m_sqft.group(1))
        return round(sqft * 0.092903, 2), None
    return None, None


def train_dxf_dataset():
    dxf_files = sorted(glob.glob(os.path.join(DXF_DIR, "**", "*.dxf"), recursive=True))
    layer_counts = Counter()
    entity_counts = Counter()
    bbox_areas = []
    wall_lengths = []
    samples = []
    parsed_count = 0

    for path in dxf_files:
        rel_path = os.path.relpath(path, DXF_DIR).replace("\\", "/")
        try:
            doc = ezdxf.readfile(path)
            msp = doc.modelspace()
            parsed_count += 1

            xs, ys = [], []
            file_entities = 0
            file_layers = set()
            file_wall_len = 0.0

            for entity in msp:
                file_entities += 1
                etype = entity.dxftype()
                layer = getattr(entity.dxf, "layer", "0")
                entity_counts[etype] += 1
                layer_counts[layer] += 1
                file_layers.add(layer)

                if etype == "LINE":
                    s, e = entity.dxf.start, entity.dxf.end
                    xs.extend([s.x, e.x])
                    ys.extend([s.y, e.y])
                    seg = math.hypot(e.x - s.x, e.y - s.y)
                    if "WALL" in layer.upper() or "DINDING" in layer.upper() or layer == "0":
                        file_wall_len += seg
                elif etype == "LWPOLYLINE":
                    pts = list(entity.get_points("xy"))
                    for i, (px, py) in enumerate(pts):
                        xs.append(px)
                        ys.append(py)
                        if i > 0:
                            file_wall_len += math.hypot(px - pts[i - 1][0], py - pts[i - 1][1])
                elif etype in ("CIRCLE", "ARC", "POINT", "INSERT", "TEXT", "MTEXT"):
                    loc = getattr(entity.dxf, "center", None) or getattr(entity.dxf, "insert", None) or getattr(entity.dxf, "location", None)
                    if loc is not None:
                        xs.append(loc.x)
                        ys.append(loc.y)

            if xs and ys:
                span_x = max(xs) - min(xs)
                span_y = max(ys) - min(ys)
                if 0 < span_x * span_y < 1e9:
                    bbox_areas.append(span_x * span_y)
            if file_wall_len > 0:
                wall_lengths.append(file_wall_len)

            samples.append({
                "name": rel_path,
                "entities": file_entities,
                "layers": sorted(list(file_layers))[:6],
            })
        except Exception:
            continue

    return {
        "total_files": len(dxf_files),
        "parsed_files": parsed_count,
        "top_layers": [{"layer": k, "count": v} for k, v in layer_counts.most_common(15)],
        "top_entities": [{"type": k, "count": v} for k, v in entity_counts.most_common(12)],
        "median_bbox_area": round(float(np.median(bbox_areas)), 2) if bbox_areas else 120.0,
        "median_wall_length": round(float(np.median(wall_lengths)), 2) if wall_lengths else 44.0,
        "samples": samples,
    }


def train_image_dataset(max_scan: int = 120):
    jpg_files = sorted(glob.glob(os.path.join(IMG_DIR, "**", "*.jpg"), recursive=True))
    diagonals = []
    edge_densities = []
    line_ratios = []
    contour_fill_ratios = []
    known_areas = []
    samples = []

    step = max(1, len(jpg_files) // max_scan) if jpg_files else 1
    scanned = jpg_files[::step][:max_scan]

    for path in scanned:
        rel_path = os.path.relpath(path, IMG_DIR).replace("\\", "/")
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

        # Estimate closed room ratio via morphological closing of dark wall pixels
        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            contour_fill_ratios.append(float(cv2.contourArea(largest)) / float(w * h))

        area_m2, dims = _extract_dims_from_filename(os.path.basename(path))
        if area_m2:
            known_areas.append(area_m2)

        samples.append({
            "name": rel_path,
            "width": w,
            "height": h,
            "known_area_m2": area_m2,
        })

    # Also include all filenames (short list for UI dropdown)
    all_names = [os.path.relpath(p, IMG_DIR).replace("\\", "/") for p in jpg_files]

    return {
        "total_files": len(jpg_files),
        "scanned_files": len(scanned),
        "median_diagonal_px": round(float(np.median(diagonals)), 1) if diagonals else 1250.0,
        "median_edge_density": round(float(np.median(edge_densities)), 4) if edge_densities else 0.045,
        "median_line_to_diag_ratio": round(float(np.median(line_ratios)), 2) if line_ratios else 18.0,
        "median_contour_fill_ratio": round(float(np.median(contour_fill_ratios)), 3) if contour_fill_ratios else 0.55,
        "median_known_floor_area_m2": round(float(np.median(known_areas)), 1) if known_areas else 112.0,
        "featured_samples": samples[:30],
        "all_filenames": all_names,
    }


def main():
    print("Training calibration model from examples_dxf/ and images/...")
    dxf_stats = train_dxf_dataset()
    img_stats = train_image_dataset()

    model = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dxf_profile": dxf_stats,
        "vision_profile": img_stats,
    }

    with open(MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(model, f, indent=2)

    print(
        f"Saved learned_model.json | DXF: {dxf_stats['parsed_files']}/{dxf_stats['total_files']} | "
        f"JPG: {img_stats['scanned_files']} scanned of {img_stats['total_files']}"
    )


if __name__ == "__main__":
    main()
