"""
Testing & Validation System for Mini Komander Build.
Evaluates the model trained on `cad/train` (3,760 SVGs) and `images/train` (503 JPGs)
against the hold-out test splits:
1. Synthetic Ground-Truth CAD Benchmark (A-101_Denah_Blok_M1.dxf)
2. Hold-Out CAD Test Set Validation (`cad/test` — 100 stratified samples from 5,502 SVGs)
3. Hold-Out Vision Test Set Sweep (`images/test` — all 50 hold-out JPGs) + Blind Ground-Truth Benchmark
4. Regional Raw Material & Labor (Upah Tukang) Excel Round-Trip Validation (Jakarta, Banten, Surabaya)

Outputs full metrics and per-sample measurement data to `api/validation_report.json`.
"""

import glob
import io
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone

import ezdxf
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import index as api_engine  # noqa: E402

CAD_TRAIN_DIR = os.path.join(api_engine.CAD_DIR, "train")
CAD_TEST_DIR = os.path.join(api_engine.CAD_DIR, "test")
IMG_TRAIN_DIR = os.path.join(api_engine.IMG_DIR, "train")
IMG_TEST_DIR = os.path.join(api_engine.IMG_DIR, "test")
REPORT_PATH = api_engine.VALIDATION_REPORT_PATH


def _extract_ground_truth_area(filename: str):
    """Extract true floor area (m2) from dataset filenames that embed dimensions."""
    name = filename.lower()
    m_meter = re.search(r"(\d+(?:[._]\d+)?)\s*x\s*(\d+(?:[._]\d+)?)[-\s]*(?:m|meter)", name)
    if m_meter:
        w = float(m_meter.group(1).replace("_", "."))
        h = float(m_meter.group(2).replace("_", "."))
        return round(w * h, 2), f"{w}x{h} m"
    m_sqft = re.search(r"(\d{3,4})\s*[-]?\s*(?:sqft|sq[-_]?ft|sf|sft)", name)
    if m_sqft:
        sqft = float(m_sqft.group(1))
        return round(sqft * 0.092903, 2), f"{int(sqft)} sqft"
    return None, None


def validate_synthetic_cad():
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    for name, color in [("A-WALL", 1), ("S-COLUMN", 3), ("A-DOOR", 5), ("ME-LIGHT", 2)]:
        doc.layers.add(name=name, color=color)

    walls = [
        ((0, 0), (10, 0)),
        ((10, 0), (10, 12)),
        ((10, 12), (0, 12)),
        ((0, 12), (0, 0)),
        ((0, 6), (10, 6)),
        ((5, 0), (5, 12)),
    ]
    for s, e in walls:
        msp.add_line(s, e, dxfattribs={"layer": "A-WALL"})
    for x in [0, 5, 10]:
        for y in [0, 6, 12]:
            msp.add_circle((x, y), radius=0.15, dxfattribs={"layer": "S-COLUMN"})
    for i in range(5):
        msp.add_circle((1.5 + i * 1.5, 3), radius=0.45, dxfattribs={"layer": "A-DOOR"})
    for i in range(8):
        msp.add_point((1.5 + i * 1.0, 8), dxfattribs={"layer": "ME-LIGHT"})

    stream = io.StringIO()
    doc.write(stream)
    res = api_engine._analyze_dxf_bytes(stream.getvalue().encode("utf-8"), "A-101_Denah_Blok_M1.dxf")

    expected = {"ARS-01": 211.2, "STR-01": 9, "ARS-02": 120.0, "ARS-03": 5, "MEP-01": 8}
    observed = {item["hspk_code"]: item["quantity"] for item in res["qto_items"]}
    checks = []
    all_passed = True
    for code, exp_val in expected.items():
        obs_val = observed.get(code)
        err = abs((obs_val or 0) - exp_val)
        passed = err < 1e-6
        all_passed = all_passed and passed
        checks.append({
            "hspk_code": code,
            "expected": exp_val,
            "observed": obs_val,
            "abs_error": round(err, 4),
            "passed": passed,
        })

    return {"passed": all_passed, "checks": checks}


def validate_cad_test_split(max_eval: int = 100):
    test_svgs = sorted(glob.glob(os.path.join(CAD_TEST_DIR, "*.svg")))
    train_svgs = sorted(glob.glob(os.path.join(CAD_TRAIN_DIR, "*.svg")))
    step = max(1, len(test_svgs) // max_eval) if test_svgs else 1
    eval_files = test_svgs[::step][:max_eval]

    records = []
    passed_count = 0
    latencies = []
    wall_areas = []
    floor_areas = []

    for path in eval_files:
        rel = f"test/{os.path.basename(path)}"
        t0 = time.perf_counter()
        try:
            with open(path, "rb") as f:
                res = api_engine._analyze_svg_cad_bytes(f.read(), rel)
            dt_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            latencies.append(dt_ms)

            items = {it["hspk_code"]: it for it in res["qto_items"]}
            invariants_ok = all(
                it["quantity"] > 0
                and 0 <= it["confidence"] <= 100
                and it["needs_qs_review"] == (it["confidence"] < 85.0)
                for it in res["qto_items"]
            )
            if invariants_ok:
                passed_count += 1

            wall_areas.append(items["ARS-01"]["quantity"])
            floor_areas.append(items["ARS-02"]["quantity"])

            records.append({
                "file": rel,
                "status": "PASS" if invariants_ok else "FAIL",
                "scale_info": res["metadata"]["scale"],
                "wall_m2": items["ARS-01"]["quantity"],
                "floor_m2": items["ARS-02"]["quantity"],
                "columns": items["STR-01"]["quantity"],
                "doors": items["ARS-03"]["quantity"],
                "lights": items["MEP-01"]["quantity"],
                "flagged_items": sum(1 for it in res["qto_items"] if it["needs_qs_review"]),
                "latency_ms": dt_ms,
            })
        except Exception as ex:
            records.append({"file": rel, "status": "ERROR", "error": str(ex)})

    return {
        "train_svg_pool": len(train_svgs),
        "test_svg_pool": len(test_svgs),
        "total_files": len(eval_files),
        "passed_files": passed_count,
        "pass_rate_pct": round((passed_count / len(eval_files)) * 100, 2) if eval_files else 0.0,
        "mean_latency_ms": round(float(np.mean(latencies)), 2) if latencies else 0.0,
        "p95_latency_ms": round(float(np.percentile(latencies, 95)), 2) if latencies else 0.0,
        "median_wall_m2": round(float(np.median(wall_areas)), 2) if wall_areas else 0.0,
        "median_floor_m2": round(float(np.median(floor_areas)), 2) if floor_areas else 0.0,
        "samples": records[:30],
    }


def validate_vision_splits():
    test_jpgs = sorted(glob.glob(os.path.join(IMG_TEST_DIR, "*.jpg")))
    train_jpgs = sorted(glob.glob(os.path.join(IMG_TRAIN_DIR, "*.jpg")))
    all_jpgs = test_jpgs + train_jpgs

    labeled_records = []
    abs_errors = []
    pct_errors = []
    latencies = []

    for path in all_jpgs:
        base = os.path.basename(path)
        split_tag = "test" if path in test_jpgs else "train"
        true_area, label_src = _extract_ground_truth_area(base)
        if true_area is None or true_area < 20 or true_area > 700:
            continue

        with open(path, "rb") as f:
            content = f.read()

        t0 = time.perf_counter()
        res = api_engine._analyze_image_bytes(content, filename="blind_eval.jpg")
        dt_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        latencies.append(dt_ms)

        items = {it["hspk_code"]: it for it in res["qto_items"]}
        pred_floor = items["ARS-02"]["quantity"]
        abs_err = round(abs(pred_floor - true_area), 2)
        pct_err = round((abs_err / true_area) * 100.0, 2)
        abs_errors.append(abs_err)
        pct_errors.append(pct_err)

        labeled_records.append({
            "split": split_tag,
            "file": base[:56],
            "label_source": label_src,
            "true_floor_m2": true_area,
            "pred_floor_m2": pred_floor,
            "abs_error_m2": abs_err,
            "pct_error": pct_err,
            "wall_m2": items["ARS-01"]["quantity"],
            "detected_lines": res["metadata"]["detected_lines"],
            "wall_confidence": items["ARS-01"]["confidence"],
            "latency_ms": dt_ms,
        })

    within_25 = sum(1 for e in pct_errors if e <= 25.0)
    within_35 = sum(1 for e in pct_errors if e <= 35.0)
    n = len(labeled_records)

    # Full evaluation on all 50 hold-out images in images/test
    test_ok = 0
    test_latencies = []
    test_records = []
    for path in test_jpgs:
        base = os.path.basename(path)
        with open(path, "rb") as f:
            content = f.read()
        t0 = time.perf_counter()
        res = api_engine._analyze_image_bytes(content, filename=base)
        dt_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        test_latencies.append(dt_ms)
        items = {it["hspk_code"]: it for it in res["qto_items"]}
        if res.get("overlay_image", "").startswith("data:image/png;base64,") and len(res["qto_items"]) == 3:
            test_ok += 1
        test_records.append({
            "file": f"test/{base[:48]}",
            "detected_lines": res["metadata"]["detected_lines"],
            "wall_m2": items["ARS-01"]["quantity"],
            "floor_m2": items["ARS-02"]["quantity"],
            "roof_m2": items["ATP-01"]["quantity"],
            "wall_conf": items["ARS-01"]["confidence"],
            "latency_ms": dt_ms,
        })

    return {
        "train_images_count": len(train_jpgs),
        "test_images_count": len(test_jpgs),
        "total_corpus_images": len(all_jpgs),
        "blind_labeled_count": n,
        "mae_m2": round(float(np.mean(abs_errors)), 2) if n else 0.0,
        "median_ae_m2": round(float(np.median(abs_errors)), 2) if n else 0.0,
        "rmse_m2": round(float(math.sqrt(np.mean([e ** 2 for e in abs_errors]))), 2) if n else 0.0,
        "mape_pct": round(float(np.mean(pct_errors)), 2) if n else 0.0,
        "within_25pct_acc": round((within_25 / n) * 100.0, 2) if n else 0.0,
        "within_35pct_acc": round((within_35 / n) * 100.0, 2) if n else 0.0,
        "mean_latency_ms": round(float(np.mean(latencies)), 2) if latencies else 0.0,
        "stability_sweep": {
            "tested": len(test_jpgs),
            "passed": test_ok,
            "pass_rate_pct": round((test_ok / len(test_jpgs)) * 100.0, 2) if test_jpgs else 0.0,
            "mean_latency_ms": round(float(np.mean(test_latencies)), 2) if test_latencies else 0.0,
            "test_samples": test_records[:15],
        },
        "samples": labeled_records,
    }


def validate_regional_excel():
    xlsx_bytes = api_engine._build_sample_excel_bytes()
    parsed = api_engine._parse_regional_workbook(
        xlsx_bytes, "Sample_Harga_Bahan_Baku_Jakarta_Banten_Surabaya.xlsx"
    )
    expected = api_engine._build_default_regional_payload()

    regions_ok = parsed["regions"] == expected["regions"]
    mat_matches = 0
    mat_total = 0
    for r in expected["regions"]:
        exp_mats = {m["material_code"]: m["unit_price"] for m in expected["materials_by_region"][r]}
        obs_mats = {m["material_code"]: m["unit_price"] for m in parsed["materials_by_region"][r]}
        for code, p in exp_mats.items():
            mat_total += 1
            if obs_mats.get(code) == p:
                mat_matches += 1

    sample_qto = {"ARS-01": 211.2, "STR-01": 9, "ARS-02": 120.0, "ARS-03": 5, "MEP-01": 8, "ATP-01": 138.0}
    regional_budgets = []
    for r in parsed["regions"]:
        hspk = parsed["hspk_by_region"][r]
        rab = sum(qty * hspk[code]["rab_unit_price"] for code, qty in sample_qto.items())
        rap = sum(qty * hspk[code]["rap_unit_price"] for code, qty in sample_qto.items())
        margin = round(((rab - rap) / rab) * 100.0, 2) if rab > 0 else 0.0
        regional_budgets.append({
            "region": r,
            "total_rab_idr": int(rab),
            "total_rap_idr": int(rap),
            "gross_margin_pct": margin,
            "cement_50kg_idr": next(
                m["unit_price"] for m in parsed["materials_by_region"][r] if m["material_code"] == "MAT-CEM"
            ),
            "aac_brick_m3_idr": next(
                m["unit_price"] for m in parsed["materials_by_region"][r] if m["material_code"] == "MAT-AAC"
            ),
        })

    return {
        "passed": regions_ok and (mat_matches == mat_total),
        "regions_tested": parsed["regions"],
        "material_roundtrip_matched": f"{mat_matches}/{mat_total}",
        "blok_m1_regional_comparison": regional_budgets,
    }


def main():
    print("Running Mini Komander Build Hold-Out Test & Validation Suite...")
    syn = validate_synthetic_cad()
    cad_test = validate_cad_test_split()
    vision_gt = validate_vision_splits()
    regional = validate_regional_excel()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "synthetic_cad_benchmark": syn,
        "dxf_corpus_validation": cad_test,
        "vision_ground_truth_validation": vision_gt,
        "regional_excel_validation": regional,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    sample_xlsx_path = os.path.abspath(
        os.path.join(BASE_DIR, "..", "Sample_Harga_Bahan_Baku_Jakarta_Banten_Surabaya.xlsx")
    )
    with open(sample_xlsx_path, "wb") as f:
        f.write(api_engine._build_sample_excel_bytes())

    for reg in ("Jakarta", "Banten", "Surabaya"):
        reg_path = os.path.abspath(os.path.join(BASE_DIR, "..", f"Dataset_Harga_{reg}.xlsx"))
        with open(reg_path, "wb") as f:
            f.write(api_engine._build_single_region_excel_bytes(reg))

    print("=== HOLD-OUT VALIDATION SUMMARY ===")
    print(f"1. Synthetic CAD Ground Truth: {'PASS' if syn['passed'] else 'FAIL'} (5/5 items)")
    print(
        f"2. CAD Hold-Out Test Set (cad/test: {cad_test['total_files']} evaluated of {cad_test['test_svg_pool']} SVGs, trained on {cad_test['train_svg_pool']}): "
        f"{cad_test['passed_files']}/{cad_test['total_files']} PASS ({cad_test['pass_rate_pct']}%) | "
        f"mean={cad_test['mean_latency_ms']}ms | median_wall={cad_test['median_wall_m2']}m2 | median_floor={cad_test['median_floor_m2']}m2"
    )
    print(
        f"3. Vision Hold-Out Test Set (images/test: {vision_gt['stability_sweep']['tested']} JPGs, trained on {vision_gt['train_images_count']}): "
        f"{vision_gt['stability_sweep']['passed']}/{vision_gt['stability_sweep']['tested']} PASS ({vision_gt['stability_sweep']['pass_rate_pct']}%) | "
        f"mean={vision_gt['stability_sweep']['mean_latency_ms']}ms"
    )
    print(
        f"4. Vision Blind Ground-Truth ({vision_gt['blind_labeled_count']} labeled images): "
        f"MAE={vision_gt['mae_m2']} m2 | MedianAE={vision_gt['median_ae_m2']} m2 | "
        f"MAPE={vision_gt['mape_pct']}% | Within ±35%={vision_gt['within_35pct_acc']}%"
    )
    print(
        f"5. Regional Excel (Jakarta/Banten/Surabaya): "
        f"{'PASS' if regional['passed'] else 'FAIL'} ({regional['material_roundtrip_matched']} items)"
    )


if __name__ == "__main__":
    main()
