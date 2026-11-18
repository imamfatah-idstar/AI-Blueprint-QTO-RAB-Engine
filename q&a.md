# Recruiter & Technical Interview Q&A — Mini Komander Build

> **Project:** Mini Komander Build (AI Blueprint QTO, Regional Cost & RAB/RAP Engine)  
> **Author:** Imam Abdul Fatah  
> **Stack:** React 18, Vite, Tailwind CSS, Python 3.10, FastAPI, `ezdxf`, OpenCV (`opencv-python-headless`), `openpyxl`, Google GenAI (`gemini-2.5-flash`), Supabase PostgreSQL

---

## 1. Product Vision & Elevator Pitch

### Q1: Can you give me a 30-second overview of what you built?
**A:**  
I built **Mini Komander Build**, an end-to-end construction cost estimation prototype that automates **Quantity Take-Off (QTO)**, **RAB (Tender Budget)**, **RAP (Execution Budget)**, and **S-Curve project scheduling** directly from construction drawings. It supports both **CAD vector files (`.dxf` / `.svg`)** and **2D scanned floor plans (`.jpg` / `.png`)**, flags low-confidence items (`< 85%`) for **Human-in-the-Loop Quantity Surveyor (QS)** review, adjusts project costs dynamically using **regional Excel spreadsheets** for raw materials and worker wages (`Jakarta`, `Banten`, `Surabaya`), and exports a 4-sheet official RAB/BoM/S-Curve Excel workbook or syncs the baseline to **Supabase PostgreSQL** for **Komander Core** cost-deviation alerts.

### Q2: Why did you build this specifically for Komander.ai?
**A:**  
Construction companies lose significant time and margin between reading blueprints and tracking field expenses. Komander.ai bridges estimation and agentic cost control. I wanted to demonstrate—not just talk about—how **CAD automation**, **Computer Vision / VLM OCR**, **Indonesian AHSP/HSPK unit pricing**, and **AI cost agents** can work together in a single, testable web application.

---

## 2. Technical Architecture & Engineering Decisions

### Q3: Why did you choose a Hybrid Monorepo (React + Vite + Python FastAPI)?
**A:**  
Engineering and CV libraries like `ezdxf`, `opencv-python-headless`, `numpy`, and `openpyxl` live natively in Python, while interactive dashboards and SVG layer highlighting belong in React. By structuring the app as a **Hybrid Monorepo** (`src/` for React+Vite, `api/index.py` for FastAPI, and `vercel.json` for `/api/*` rewrites), both frontend and backend deploy together as one project on Vercel, while Vite's local proxy (`/api -> 127.0.0.1:8000`) makes local development seamless.

### Q4: Why did you use `opencv-python-headless` instead of standard `opencv-python`?
**A:**  
Serverless environments like Vercel have strict bundle size limits and no GUI/X11 display libraries. `opencv-python-headless` removes GUI dependencies (keeping the wheel around ~37 MB) while retaining full image processing capabilities (`Canny`, `HoughLinesP`, morphological operations, and `findContours`).

### Q5: How does your system handle both `.dxf` AutoCAD files and `.svg` FloorPlanCAD files?
**A:**  
- **For `.dxf` files (`ezdxf`):** It reads `$INSUNITS` (or auto-infers mm/cm/meter from coordinate bounding-box spans), extracts wall lengths from `LINE`/`LWPOLYLINE`, counts structural columns (`CIRCLE`/`INSERT`), door arcs (`ARC`), and MEP points, and renders a dark-blueprint PNG preview alongside normalized `layer_highlights`.
- **For `.svg` FloorPlanCAD files (`xml.etree.ElementTree`):** It parses `<g inkscape:label>` layers (`WALL`, `COLUMN`, `WINDOW`, `EQUIP`, `VPIPE`) and `semantic-id` attributes, converts viewBox coordinates using a calibrated `0.14 m/unit` factor learned from `cad/train`, and loads the paired `.png` preview.

### Q6: How did you design for offline resilience and missing API keys?
**A:**  
- **Supabase fallback:** If `.env` does not have `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, the UI gracefully falls back to `FALLBACK_HSPK` and `DEFAULT_REGIONAL_DATA` so every workflow still runs cleanly.
- **Gemini 2.5 Flash OCR fallback:** If `GEMINI_API_KEY` is configured, `_run_gemini_ocr_calibration()` calls `gemini-2.5-flash` with structured JSON output to read Title Block metadata and outer dimensions (`outer_width_m`, `outer_length_m`) to calibrate pixels-per-meter. If the key is absent, it cleanly falls back to OpenCV Adaptive Canny + `learned_model.json` statistical priors without crashing.

---

## 3. AI, Computer Vision & Validation Metrics

### Q7: How did you train and validate the system? Did you avoid data leakage?
**A:**  
Yes. I strictly separated training and hold-out test splits:
- **Training (`api/train_dataset.py` → `api/learned_model.json`):** Trained only on `cad/train` (**3,760** `.svg` files, 250 sampled) and `images/train` (**503** `.jpg` files, 200 sampled).
- **Hold-Out Validation (`api/validate_model.py` → `api/validation_report.json`):**
  1. **Synthetic CAD Ground Truth (`A-101_Denah_Blok_M1.dxf`):** **5/5 PASS** (`0.0` absolute error across walls, columns, floor, doors, lights).
  2. **CAD Hold-Out (`cad/test` — 100 sampled from 5,502 SVGs):** **100/100 PASS (100.0%)**, mean latency **47.06 ms**, P95 **117.52 ms**.
  3. **Vision Hold-Out (`images/test` — 50 JPGs):** **50/50 PASS (100.0%)**, mean latency **166.98 ms**.
  4. **Blind Vision Ground-Truth (19 dimension-labeled plans with filenames masked as `blind_eval.jpg`):** **Median AE = 39.80 m²**, **MAPE = 42.82%**, **Within ±35% = 42.11%**.
  5. **Regional Excel Round-Trip (Jakarta, Banten, Surabaya):** **42/42 items PASS (100%)**.

### Q8: Why is the blind 2D image MAPE 42.82%, and how does your product handle that?
**A:**  
That measurement is actually one of our most important findings: when a 2D raster image has **no explicit scale or dimension text**, a `7×6m` house and an `18×16m` villa drawn on the same `1000px` canvas look geometrically similar in raw pixels.  
We handle this in two ways:
1. **Human-in-the-Loop QS Flagging:** Items with confidence `< 85%` are automatically flagged (`Cek QS`), so a Quantity Surveyor only reviews ambiguous rows and edits volumes inline (which immediately marks them `Verified 99.9%`).
2. **Gemini 2.5 Flash OCR Scale Calibration:** When enabled, the VLM reads the actual dimension callouts and Title Block scale from the drawing to compute true `pixels_per_meter`.

---

## 4. Business Impact, Regional Pricing & New Features

### Q9: How does the Regional Excel Pricing & Worker Wage feature work?
**A:**  
Construction costs vary significantly across Indonesia. I built a **unified regional dataset** (plus 3 downloadable per-region Excel files: `Dataset_Harga_Jakarta.xlsx`, `Dataset_Harga_Banten.xlsx`, `Dataset_Harga_Surabaya.xlsx`) containing **7 Raw Materials (`MAT-*`)** and **7 Worker Wages (`LAB-*` in Orang-Hari / `OH`)** mapped to AHSP coefficients.  
Users can upload their own `.xlsx`/`.csv` (supporting both *long* and *wide* table formats) or edit unit prices inline—the app immediately recalculates material procurement quantities, worker `OH` costs, and project RAB/RAP totals across cities (e.g., for the Blok M1 baseline: **Jakarta** RAB `Rp 169.67M`, **Banten** `-5.5%`, **Surabaya** `-9.5%`).

### Q10: What are the S-Curve Schedule Generator and Interactive Layer Highlighting features?
**A:**  
- **Auto S-Curve Schedule from `OH` Labor:** Using the total calculated worker-days (`OH`) and a selectable crew size (`4` to `12` workers/day), the app computes project duration in weeks, plots a **Planned vs. Simulated Actual S-Curve** SVG chart with weekly RAP cashflow, and exports everything into a **4-sheet official Excel workbook** (`1_Rekap_Eksekutif`, `2_BoQ_QTO_Terverifikasi`, `3_Daftar_Belanja_dan_Tukang`, `4_Jadwal_Kurva_S_Mingguan`).
- **Interactive Layer Highlighting:** Clicking any row in the QTO table dims the blueprint background and highlights only that layer's walls, columns, floor boundary, doors, or MEP points via a normalized SVG overlay.

---

## 5. Challenges & Next Steps

### Q11: What was the hardest technical challenge you solved in this project?
**A:**  
Early in validation, our blind OpenCV floor-area estimator had a `97.12%` MAPE because `cv2.findContours` on raw images was sensitive to wide white page margins. By writing `validate_model.py` to test blindly against labeled ground-truths, I spotted the outlier behavior, replaced raw contour ratio scaling with a regularized blend of Hough line density (`line_ratio`) and contour fill ratio, and dropped MAPE from `97.12%` to `42.82%`—while proving empirically why QS review flagging (`< 85%`) and VLM scale OCR are essential.

### Q12: If you had another week to expand this into production, what would you add?
**A:**  
1. **Revision Diffing (`Rev.01` vs `Rev.02`):** Comparing two blueprint versions to highlight added/removed walls and net RAB cost impact.
2. **Real WhatsApp Business / Webhook Integration:** Connecting the Komander Core alert directly to project managers' WhatsApp when field POs exceed RAP baselines.
3. **Full Multi-Floor & IFC/BIM Support:** Extending `ezdxf` + `IfcOpenShell` for multi-story commercial buildings.
