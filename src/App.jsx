import React, { useState, useEffect } from "react";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Menu,
  HelpCircle,
  X,
  RotateCw,
  Layers,
  ScanLine,
  ShieldAlert,
  ArrowDown,
  Volume2,
  FileSpreadsheet,
  MapPin,
  FlaskConical,
  Database,
  CalendarClock,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";

const FALLBACK_HSPK = {
  "STR-01": { division: "Struktur", item_name: "Pekerjaan Kolom Beton Bertulang K-300", unit: "titik", rab_unit_price: 1850000, rap_unit_price: 1520000 },
  "ARS-01": { division: "Dinding", item_name: "Pasangan Dinding Bata Ringan 10 cm + Plester Aci", unit: "m2", rab_unit_price: 285000, rap_unit_price: 230000 },
  "ARS-02": { division: "Lantai", item_name: "Pasangan Keramik Lantai 60x60 Grade A", unit: "m2", rab_unit_price: 245000, rap_unit_price: 198000 },
  "ARS-03": { division: "Kusen & Pintu", item_name: "Pemasangan Kusen & Daun Pintu Engineering Wood", unit: "unit", rab_unit_price: 2100000, rap_unit_price: 1750000 },
  "MEP-01": { division: "Listrik & Air", item_name: "Instalasi Titik Lampu & Saklar (Kabel NYM 3x2.5)", unit: "titik", rab_unit_price: 320000, rap_unit_price: 255000 },
  "ATP-01": { division: "Atap", item_name: "Rangka Atap Baja Ringan & Genteng Metal Pasir", unit: "m2", rab_unit_price: 365000, rap_unit_price: 310000 },
};

const BASELINE_MATERIALS = [
  // 1. Bahan Baku Konstruksi (Material yang sama dibandingkan lintas daerah)
  { material_code: "MAT-CEM", category: "Bahan Baku", material_name: "Semen Portland 50kg (Tiga Roda / Gresik)", hspk_code: "STR-01", coefficient: 4.5, unit: "sak", prices: { Jakarta: 74000, Banten: 71000, Surabaya: 68500 }, note: "4.5 sak / titik kolom beton K-300" },
  { material_code: "MAT-REB", category: "Bahan Baku", material_name: "Besi Beton Ulir D13 (12m)", hspk_code: "STR-01", coefficient: 4.0, unit: "btg", prices: { Jakarta: 148000, Banten: 144000, Surabaya: 141000 }, note: "4.0 batang / titik kolom struktur" },
  { material_code: "MAT-AAC", category: "Bahan Baku", material_name: "Bata Ringan AAC 10cm (Hebel/Citicon)", hspk_code: "ARS-01", coefficient: 0.10, unit: "m3", prices: { Jakarta: 660000, Banten: 625000, Surabaya: 595000 }, note: "0.10 m3 / m2 pasangan dinding" },
  { material_code: "MAT-TILE", category: "Bahan Baku", material_name: "Keramik Lantai 60x60 Grade A", hspk_code: "ARS-02", coefficient: 0.72, unit: "dus", prices: { Jakarta: 185000, Banten: 176000, Surabaya: 168000 }, note: "0.72 dus / m2 lantai (1.44 m2/dus)" },
  { material_code: "MAT-DOOR", category: "Bahan Baku", material_name: "Kusen & Daun Pintu Engineering Wood", hspk_code: "ARS-03", coefficient: 1.0, unit: "unit", prices: { Jakarta: 1750000, Banten: 1650000, Surabaya: 1590000 }, note: "1.0 set / unit bukaan pintu" },
  { material_code: "MAT-WIRE", category: "Bahan Baku", material_name: "Kabel NYM 3x2.5mm (50m) + Fitting", hspk_code: "MEP-01", coefficient: 0.18, unit: "roll", prices: { Jakarta: 640000, Banten: 615000, Surabaya: 598000 }, note: "0.18 roll (~9m) / titik instalasi lampu" },
  { material_code: "MAT-ROOF", category: "Bahan Baku", material_name: "Baja Ringan C75 + Genteng Metal Pasir", hspk_code: "ATP-01", coefficient: 1.05, unit: "m2", prices: { Jakarta: 295000, Banten: 278000, Surabaya: 268000 }, note: "1.05 m2 material / m2 luasan atap" },
  // 2. Upah Tukang / Tenaga Kerja (Biaya orang yang membangun per Orang-Hari / OH)
  { material_code: "LAB-PKJ", category: "Upah Tukang", material_name: "Pekerja / Kenek Bangunan", hspk_code: "ARS-01", coefficient: 0.30, unit: "OH", prices: { Jakarta: 165000, Banten: 145000, Surabaya: 135000 }, note: "0.30 OH / m2 pekerjaan dinding & umum" },
  { material_code: "LAB-TBT", category: "Upah Tukang", material_name: "Tukang Batu (Pasangan Dinding & Keramik)", hspk_code: "ARS-02", coefficient: 0.25, unit: "OH", prices: { Jakarta: 210000, Banten: 185000, Surabaya: 175000 }, note: "0.25 OH / m2 pasangan lantai & plester" },
  { material_code: "LAB-TBS", category: "Upah Tukang", material_name: "Tukang Besi & Bekisting Struktur", hspk_code: "STR-01", coefficient: 1.80, unit: "OH", prices: { Jakarta: 220000, Banten: 195000, Surabaya: 185000 }, note: "1.80 OH / titik kolom beton bertulang" },
  { material_code: "LAB-TKY", category: "Upah Tukang", material_name: "Tukang Kayu, Kusen & Pasang Pintu", hspk_code: "ARS-03", coefficient: 1.20, unit: "OH", prices: { Jakarta: 225000, Banten: 200000, Surabaya: 190000 }, note: "1.20 OH / unit pemasangan kusen & pintu" },
  { material_code: "LAB-TLS", category: "Upah Tukang", material_name: "Tukang Listrik & Instalasi MEP", hspk_code: "MEP-01", coefficient: 0.40, unit: "OH", prices: { Jakarta: 230000, Banten: 205000, Surabaya: 195000 }, note: "0.40 OH / titik instalasi lampu & saklar" },
  { material_code: "LAB-KPL", category: "Upah Tukang", material_name: "Kepala Tukang Konstruksi & Atap", hspk_code: "ATP-01", coefficient: 0.18, unit: "OH", prices: { Jakarta: 255000, Banten: 230000, Surabaya: 215000 }, note: "0.18 OH / m2 supervisi rangka atap" },
  { material_code: "LAB-MND", category: "Upah Tukang", material_name: "Mandor Lapangan Proyek", hspk_code: "STR-01", coefficient: 0.25, unit: "OH", prices: { Jakarta: 285000, Banten: 255000, Surabaya: 240000 }, note: "0.25 OH / titik pengawasan mutu lapangan" },
];

function buildClientRegionalFallback() {
  const regions = ["Jakarta", "Banten", "Surabaya"];
  const mults = { Jakarta: 1.0, Banten: 0.945, Surabaya: 0.905 };
  const materials_by_region = {};
  const hspk_by_region = {};
  regions.forEach((r) => {
    materials_by_region[r] = BASELINE_MATERIALS.map((m) => ({
      material_code: m.material_code,
      category: m.category,
      material_name: m.material_name,
      hspk_code: m.hspk_code,
      coefficient: m.coefficient,
      unit: m.unit,
      unit_price: m.prices[r],
      supplier_note: m.note,
    }));
    hspk_by_region[r] = {};
    Object.entries(FALLBACK_HSPK).forEach(([code, meta]) => {
      hspk_by_region[r][code] = {
        ...meta,
        code,
        rab_unit_price: Math.round((meta.rab_unit_price * mults[r]) / 1000) * 1000,
        rap_unit_price: Math.round((meta.rap_unit_price * mults[r]) / 1000) * 1000,
      };
    });
  });
  return {
    source: "Default Regional Baseline (Jakarta, Banten, Surabaya)",
    regions,
    materials_by_region,
    hspk_by_region,
  };
}

const DEFAULT_REGIONAL_DATA = buildClientRegionalFallback();

const ENGINE_CARDS = [
  {
    id: "cad",
    eyebrow: "01 // VECTOR ENGINE",
    title: "CAD Automation (ezdxf)",
    badge: "98.5% Precision",
    frontDesc: "Membaca entitas geometri AutoCAD (.DXF) per layer secara deterministik tanpa konversi manual.",
    backBullets: [
      "Ekstraksi panjang dinding dari layer A-WALL",
      "Perhitungan titik kolom S-COLUMN & pintu A-DOOR",
      "Deteksi titik lampu MEP pada layer ME-LIGHT",
    ],
    tags: ["Python ezdxf", "DXF R2010", "Deterministic"],
  },
  {
    id: "vision",
    eyebrow: "02 // COMPUTER VISION",
    title: "OpenCV + VLM Scan",
    badge: "Canny + HoughP",
    frontDesc: "Mendeteksi segmen garis struktural dan area Kop Gambar (Title Block) dari scan denah 2D.",
    backBullets: [
      "Canny Edge Detection & Probabilistic Hough Transform",
      "Overlay garis dinding hijau & kotak Kop Gambar oranye",
      "Flagging otomatis jika confidence di bawah 85%",
    ],
    tags: ["OpenCV Headless", "NumPy", "Gemini 2.5 Flash"],
  },
  {
    id: "agent",
    eyebrow: "03 // AGENTIC CONTROL",
    title: "Komander Core Hand-off",
    badge: "PostgreSQL + Alert",
    frontDesc: "Mengunci baseline RAB vs RAP ke Supabase dan memicu peringatan deviasi biaya real-time.",
    backBullets: [
      "Human-in-the-Loop QS verification & koreksi inline",
      "Auto-matching harga satuan Master AHSP/HSPK",
      "Simulasi WhatsApp Alert prioritas tinggi ke manajer proyek",
    ],
    tags: ["Supabase", "RAB vs RAP", "WhatsApp Alert"],
  },
];

export default function App() {
  const [hspkMap, setHspkMap] = useState(FALLBACK_HSPK);
  const [projectName, setProjectName] = useState("Pembangunan Hunian Blok M1 - Depok");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [overlayImg, setOverlayImg] = useState(null);
  const [qtoItems, setQtoItems] = useState([]);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState(null);
  const [alertSent, setAlertSent] = useState(false);

  // UI/UX Interactive states
  const [flippedCards, setFlippedCards] = useState({});
  const [activeSheet, setActiveSheet] = useState(null); // null | 'menu' | 'help' | 'pitch'
  const [activePin, setActivePin] = useState("depok");

  // Regional Material & Excel Pricing states
  const [regionalData, setRegionalData] = useState(DEFAULT_REGIONAL_DATA);
  const [selectedRegion, setSelectedRegion] = useState("Jakarta");
  const [priceSource, setPriceSource] = useState(DEFAULT_REGIONAL_DATA.source);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  // Dataset & Validation states
  const [datasetSummary, setDatasetSummary] = useState(null);
  const [sampleKind, setSampleKind] = useState("cad");
  const [sampleFile, setSampleFile] = useState("");
  const [validationReport, setValidationReport] = useState(null);

  // S-Curve Schedule & Official Excel Export states
  const [workerCount, setWorkerCount] = useState(6);
  const [exportingRab, setExportingRab] = useState(false);

  // Interactive Layer Highlighting states
  const [layerHighlights, setLayerHighlights] = useState(null);
  const [activeHighlightCode, setActiveHighlightCode] = useState(null);

  // Telegram Reminder states
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramStatus, setTelegramStatus] = useState(null);

  useEffect(() => {
    async function fetchInitialData() {
      // 1. Load Regional Material & HSPK Pricing (Jakarta, Banten, Surabaya)
      try {
        const regRes = await fetch("/api/regional-prices");
        if (regRes.ok) {
          const regJson = await regRes.json();
          setRegionalData(regJson);
          setPriceSource(regJson.source);
          if (regJson.regions?.length > 0) {
            const initRegion = regJson.regions[0];
            setSelectedRegion(initRegion);
            if (regJson.hspk_by_region?.[initRegion]) {
              setHspkMap(regJson.hspk_by_region[initRegion]);
            }
          }
        }
      } catch (_) {}

      // 2. Load Dataset Summary & Validation Report
      try {
        const dsRes = await fetch("/api/dataset/summary");
        if (dsRes.ok) {
          const dsJson = await dsRes.json();
          setDatasetSummary(dsJson);
          if (dsJson.dxf?.samples?.length > 0) {
            setSampleFile(dsJson.dxf.samples[0]);
          }
        }
      } catch (_) {}

      try {
        const valRes = await fetch("/api/validation/report");
        if (valRes.ok) {
          setValidationReport(await valRes.json());
        }
      } catch (_) {}

      // 3. Optional Supabase HSPK override
      if (!supabase) return;
      const { data, error } = await supabase.from("master_hspk").select("*");
      if (!error && data && data.length > 0) {
        const mapped = {};
        data.forEach((row) => {
          mapped[row.code] = row;
        });
        setHspkMap((prev) => ({ ...mapped, ...prev }));
      }
    }
    fetchInitialData();
  }, []);

  const handleRegionChange = (region) => {
    setSelectedRegion(region);
    if (regionalData?.hspk_by_region?.[region]) {
      setHspkMap(regionalData.hspk_by_region[region]);
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingExcel(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload-regional-prices", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Gagal memproses file Excel/CSV.");
        return;
      }
      setRegionalData(data);
      setPriceSource(data.source);
      if (data.regions?.length > 0) {
        const nextReg =
          data.active_region && data.regions.includes(data.active_region)
            ? data.active_region
            : data.regions.includes(selectedRegion)
            ? selectedRegion
            : data.regions[0];
        setSelectedRegion(nextReg);
        if (data.hspk_by_region?.[nextReg]) {
          setHspkMap(data.hspk_by_region[nextReg]);
        }
      }
    } catch (_) {
      alert("Gagal mengunggah file Excel/CSV. Pastikan FastAPI aktif.");
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleAnalyzeDatasetSample = async () => {
    if (!sampleFile) return;
    setLoading(true);
    setSavedProjectId(null);
    setAlertSent(false);
    try {
      const res = await fetch("/api/dataset/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: sampleKind, filename: sampleFile }),
      });
      const data = await res.json();
      setMetadata(data.metadata);
      setOverlayImg(data.overlay_image || null);
      setLayerHighlights(data.layer_highlights || null);
      setActiveHighlightCode(null);
      setQtoItems(data.qto_items || []);
    } catch (_) {
      alert("Gagal menganalisis sampel dataset.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e, mode) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setSavedProjectId(null);
    setAlertSent(false);

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = mode === "cad" ? "/api/analyze-cad" : "/api/analyze-vision";
    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      setMetadata(data.metadata);
      setOverlayImg(data.overlay_image || null);
      setLayerHighlights(data.layer_highlights || null);
      setActiveHighlightCode(null);
      setQtoItems(data.qto_items || []);
    } catch (err) {
      alert("Gagal menghubungi server analisis. Pastikan FastAPI telah berjalan.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (idx, value) => {
    const updated = [...qtoItems];
    updated[idx].quantity = parseFloat(value) || 0;
    updated[idx].needs_qs_review = false;
    updated[idx].confidence = 99.9;
    updated[idx].qs_note = "Diverifikasi & dikoreksi manual oleh QS.";
    setQtoItems(updated);
  };

  const handleMaterialPriceChange = (matIdx, rawValue) => {
    const newPrice = Math.max(0, parseFloat(rawValue) || 0);
    setRegionalData((prev) => {
      if (!prev) return prev;
      const mats = [...(prev.materials_by_region?.[selectedRegion] || [])];
      if (!mats[matIdx]) return prev;
      const updatedMat = { ...mats[matIdx], unit_price: newPrice };
      mats[matIdx] = updatedMat;

      // Recalculate HSPK unit prices for this hspk_code based on material ratio vs Jakarta baseline
      const targetCode = updatedMat.hspk_code;
      const relatedMats = mats.filter((m) => m.hspk_code === targetCode);
      const ratios = relatedMats
        .map((m) => {
          const baseItem = BASELINE_MATERIALS.find((b) => b.material_code === m.material_code);
          const basePrice = baseItem?.prices?.Jakarta || m.unit_price || 1;
          return m.unit_price / basePrice;
        })
        .filter((r) => r > 0);
      const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1.0;
      const baseMeta = FALLBACK_HSPK[targetCode] || { rab_unit_price: 500000, rap_unit_price: 410000 };

      const updatedRegionHspk = {
        ...(prev.hspk_by_region?.[selectedRegion] || {}),
        [targetCode]: {
          ...(prev.hspk_by_region?.[selectedRegion]?.[targetCode] || baseMeta),
          code: targetCode,
          rab_unit_price: Math.round((baseMeta.rab_unit_price * avgRatio) / 1000) * 1000,
          rap_unit_price: Math.round((baseMeta.rap_unit_price * avgRatio) / 1000) * 1000,
        },
      };

      setHspkMap(updatedRegionHspk);
      return {
        ...prev,
        materials_by_region: {
          ...prev.materials_by_region,
          [selectedRegion]: mats,
        },
        hspk_by_region: {
          ...prev.hspk_by_region,
          [selectedRegion]: updatedRegionHspk,
        },
      };
    });
  };

  // Volume aktif proyek (menggunakan QTO hasil scan, atau baseline Blok M1 jika belum upload gambar)
  const activeQtoVolumes = React.useMemo(() => {
    if (qtoItems.length > 0) {
      const map = {};
      qtoItems.forEach((it) => {
        map[it.hspk_code] = (map[it.hspk_code] || 0) + (Number(it.quantity) || 0);
      });
      return map;
    }
    return { "ARS-01": 211.2, "STR-01": 9, "ARS-02": 120.0, "ARS-03": 5, "MEP-01": 8, "ATP-01": 138.0 };
  }, [qtoItems]);

  const regionalProjectComparison = React.useMemo(() => {
    if (!regionalData?.regions) return [];
    const list = regionalData.regions.map((reg) => {
      const regHspk = regionalData.hspk_by_region?.[reg] || FALLBACK_HSPK;
      const regMats = regionalData.materials_by_region?.[reg] || [];
      const rab = Object.entries(activeQtoVolumes).reduce(
        (s, [code, qty]) => s + qty * (regHspk[code]?.rab_unit_price || 0),
        0
      );
      const rap = Object.entries(activeQtoVolumes).reduce(
        (s, [code, qty]) => s + qty * (regHspk[code]?.rap_unit_price || 0),
        0
      );
      let matOnlyTotal = 0;
      let laborOnlyTotal = 0;
      regMats.forEach((m) => {
        const qtoQty = activeQtoVolumes[m.hspk_code] || 0;
        const coeff = Number(m.coefficient) || 1.0;
        const cost = qtoQty * coeff * (Number(m.unit_price) || 0);
        const isLabor =
          m.category === "Upah Tukang" ||
          String(m.material_code).startsWith("LAB-") ||
          String(m.unit).toUpperCase() === "OH";
        if (isLabor) laborOnlyTotal += cost;
        else matOnlyTotal += cost;
      });
      return {
        region: reg,
        rab,
        rap,
        matOnlyTotal,
        laborOnlyTotal,
        matTotal: matOnlyTotal + laborOnlyTotal,
      };
    });
    const baseRab = list[0]?.rab || 1;
    return list.map((row) => ({
      ...row,
      diffPct: (((row.rab - baseRab) / baseRab) * 100).toFixed(1),
    }));
  }, [regionalData, activeQtoVolumes]);

  // Gabungkan bahan yang sama & upah tukang dari semua daerah ke dalam 1 tabel komparasi terpadu
  const unifiedComparisonRows = React.useMemo(() => {
    if (!regionalData?.regions?.length) return [];
    const firstReg = regionalData.regions[0];
    const baseItems = regionalData.materials_by_region?.[firstReg] || [];
    return baseItems.map((item, idx) => {
      const pricesByRegion = {};
      regionalData.regions.forEach((r) => {
        const match =
          (regionalData.materials_by_region?.[r] || []).find(
            (m) => m.material_code === item.material_code
          ) || (regionalData.materials_by_region?.[r] || [])[idx];
        pricesByRegion[r] = match ? Number(match.unit_price) || 0 : 0;
      });
      const isLabor =
        item.category === "Upah Tukang" ||
        String(item.material_code).startsWith("LAB-") ||
        String(item.unit).toUpperCase() === "OH";
      return {
        ...item,
        idx,
        categoryLabel: isLabor ? "Upah Tukang" : "Bahan Baku",
        pricesByRegion,
      };
    });
  }, [regionalData]);

  // Generator Jadwal Proyek & Kurva-S (S-Curve) Otomatis dari Volume OH Tukang
  const sCurveData = React.useMemo(() => {
    const activeMats = regionalData?.materials_by_region?.[selectedRegion] || [];
    let totalLaborOH = 0;
    let totalLaborCost = 0;
    let totalMaterialCost = 0;

    activeMats.forEach((m) => {
      const qtoQty = activeQtoVolumes[m.hspk_code] || 0;
      const coeff = Number(m.coefficient) || 1.0;
      const needed = qtoQty * coeff;
      const cost = needed * (Number(m.unit_price) || 0);
      const isLabor =
        m.category === "Upah Tukang" ||
        String(m.material_code).startsWith("LAB-") ||
        String(m.unit).toUpperCase() === "OH";
      if (isLabor) {
        totalLaborOH += needed;
        totalLaborCost += cost;
      } else {
        totalMaterialCost += cost;
      }
    });

    const effectiveRAP = Object.entries(activeQtoVolumes).reduce(
      (s, [code, qty]) => s + qty * (hspkMap[code]?.rap_unit_price || 0),
      0
    );

    const safeWorkers = Math.max(2, Number(workerCount) || 6);
    const weeklyCapacityOH = safeWorkers * 6; // 6 hari kerja / minggu
    const totalWeeks = Math.max(4, Math.min(16, Math.ceil(Math.max(totalLaborOH, 48) / weeklyCapacityOH)));

    const stageLabels = [
      "1. Persiapan & Struktur Kolom (STR-01)",
      "2. Pasangan Dinding Bata Ringan (ARS-01)",
      "3. Rangka Atap & Genteng Metal (ATP-01)",
      "4. Instalasi Listrik & MEP (MEP-01)",
      "5. Pasangan Keramik Lantai (ARS-02)",
      "6. Kusen Pintu & Finishing (ARS-03)",
    ];

    const rawWeights = Array.from({ length: totalWeeks }, (_, i) =>
      Math.pow(Math.sin(((i + 0.5) / totalWeeks) * Math.PI), 1.3)
    );
    const weightSum = rawWeights.reduce((a, b) => a + b, 0) || 1;

    let cumPlan = 0;
    let cumActual = 0;
    const schedule = rawWeights.map((rw, i) => {
      let wPct = +((rw / weightSum) * 100).toFixed(1);
      if (i === totalWeeks - 1) {
        wPct = +(100 - cumPlan).toFixed(1);
      }
      cumPlan = +Math.min(100, cumPlan + wPct).toFixed(1);

      // Simulasi kurva realisasi lapangan (sedikit lambat di awal, mengejar di tengah/akhir)
      const factor = i < Math.floor(totalWeeks / 2) ? 0.92 : 1.06;
      cumActual = +Math.min(100, cumActual + wPct * factor).toFixed(1);
      if (i === totalWeeks - 1) cumActual = 100.0;

      const stageIdx = Math.min(
        stageLabels.length - 1,
        Math.floor((i / totalWeeks) * stageLabels.length)
      );

      return {
        week: `Minggu ${i + 1}`,
        weekNum: i + 1,
        stage: stageLabels[stageIdx],
        oh: +((wPct / 100) * totalLaborOH).toFixed(1),
        weight_pct: wPct,
        cum_planned_pct: cumPlan,
        cum_actual_pct: cumActual,
        weekly_rap_idr: Math.round((wPct / 100) * effectiveRAP),
      };
    });

    return {
      totalLaborOH: +totalLaborOH.toFixed(1),
      totalLaborCost: Math.round(totalLaborCost),
      totalMaterialCost: Math.round(totalMaterialCost),
      weeklyCapacityOH,
      totalWeeks,
      effectiveRAP,
      schedule,
    };
  }, [regionalData, selectedRegion, activeQtoVolumes, hspkMap, workerCount]);

  const handleExportOfficialExcel = async () => {
    setExportingRab(true);
    try {
      const payload = {
        project_name: projectName,
        selected_region: selectedRegion,
        worker_count: workerCount,
        drawing_code: metadata?.drawing_code || "A-101 & S-102 (Baseline Blok M1)",
        scale: metadata?.scale || "1:100",
        qto_items: qtoItems,
        hspk_map: hspkMap,
        materials: regionalData?.materials_by_region?.[selectedRegion] || [],
        s_curve_schedule: sCurveData.schedule,
      };
      const res = await fetch("/api/export-project-rab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        alert("Gagal mengekspor dokumen Excel RAB.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = projectName.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32);
      a.href = url;
      a.download = `RAB_RAP_BoM_${safeName}_${selectedRegion}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      alert("Gagal menghubungi server untuk ekspor Excel. Pastikan FastAPI berjalan.");
    } finally {
      setExportingRab(false);
    }
  };

  const totalRAB = qtoItems.reduce(
    (sum, item) => sum + item.quantity * (hspkMap[item.hspk_code]?.rab_unit_price || 0),
    0
  );
  const totalRAP = qtoItems.reduce(
    (sum, item) => sum + item.quantity * (hspkMap[item.hspk_code]?.rap_unit_price || 0),
    0
  );
  const marginPct =
    totalRAB > 0 ? (((totalRAB - totalRAP) / totalRAB) * 100).toFixed(1) : "0.0";

  const saveAndActivateProject = async () => {
    setSaving(true);
    try {
      if (supabase && metadata) {
        const { data: proj, error: projErr } = await supabase
          .from("projects")
          .insert([
            {
              project_name: projectName,
              drawing_code: metadata.drawing_code,
              discipline: metadata.discipline,
              scale: metadata.scale,
              status: "ACTIVE_MONITORING",
              total_rab: totalRAB,
              total_rap: totalRAP,
            },
          ])
          .select()
          .single();

        if (!projErr && proj) {
          const rows = qtoItems.map((item) => ({
            project_id: proj.id,
            hspk_code: item.hspk_code,
            detected_layer: item.detected_layer,
            source_engine: item.source_engine || metadata.engine,
            quantity: item.quantity,
            unit: item.unit,
            confidence: item.confidence,
            needs_qs_review: item.needs_qs_review,
            qs_note: item.qs_note,
          }));
          await supabase.from("qto_items").insert(rows);
          setSavedProjectId(proj.id);
        }
      }

      // Kirim reminder ke Telegram (Live jika Token/Chat ID tersedia, atau simulasi jika belum)
      try {
        const tgRes = await fetch("/api/send-telegram-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_name: projectName,
            selected_region: selectedRegion,
            total_rab: totalRAB,
            total_rap: totalRAP,
            margin_pct: marginPct,
            total_oh: sCurveData.totalLaborOH,
            total_weeks: sCurveData.totalWeeks,
            flagged_count: flaggedCount,
            bot_token: telegramToken || null,
            chat_id: telegramChatId || null,
          }),
        });
        if (tgRes.ok) {
          setTelegramStatus(await tgRes.json());
        }
      } catch (_) {}

      setAlertSent(true);
    } finally {
      setSaving(false);
    }
  };

  const toggleFlip = (id) => {
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToSection = (id) => {
    setActiveSheet(null);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const flaggedCount = qtoItems.filter((item) => item.needs_qs_review).length;

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#0b0b0c] selection:bg-[#0b0b0c] selection:text-white">
      {/* Top Identity Pill */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-white/80 backdrop-blur-md border border-[rgba(12,16,28,0.08)] rounded-full px-4 py-1.5 flex items-center gap-2.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#35a95c] nv-avatar" />
          <span className="font-mono-tech text-[11px] tracking-tight text-[#3d4046] whitespace-nowrap">
            komander.ai // mini-build · Imam Abdul Fatah
          </span>
        </div>
      </div>

      {/* =====================================================================
          STAGE 1: ALABASTER HERO (#f4f6fa)
      ===================================================================== */}
      <section
        id="hero"
        className="bg-[#f4f6fa] pt-28 pb-20 px-5 sm:px-10 border-b border-[rgba(12,16,28,0.08)]"
      >
        <div className="max-w-[1360px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#f4f3ee] border border-[rgba(12,16,28,0.06)] rounded-full px-3.5 py-1.5 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35a95c]" />
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078]">
              01 // AI Blueprint QTO & RAB Engine
            </span>
          </div>

          <h1
            className="text-[clamp(2.4rem,6.2vw,5.4rem)] font-normal leading-[0.96] tracking-[-0.055em] text-[#0b0b0c] max-w-5xl"
          >
            Dari gambar kerja ke{" "}
            <span className="font-serif-editorial italic text-[#3d4046]">
              estimasi RAB
            </span>{" "}
            presisi dalam hitungan detik
            <button
              onClick={() => setActiveSheet(activeSheet === "pitch" ? null : "pitch")}
              title="Putar ringkasan pitch"
              className="inline-flex items-center gap-2 ml-3 align-middle bg-[#1b1d1c] text-white rounded-full px-3.5 py-1.5 text-xs font-normal tracking-normal hover:brightness-110 transition"
            >
              <span className="w-2 h-2 rounded-full bg-[#3ddc84] nv-avatar" />
              <Volume2 className="w-3.5 h-3.5 text-[#3ddc84]" />
              <span className="font-mono-tech text-[11px]">3-Min Pitch</span>
            </button>
          </h1>

          <p className="mt-6 text-[#3d4046] max-w-2xl text-[clamp(0.95rem,1.15vw,1.15rem)] leading-relaxed">
            Prototipe terintegrasi <strong>CAD Automation (ezdxf)</strong>,{" "}
            <strong>Computer Vision (OpenCV)</strong>, dan{" "}
            <strong>Human-in-the-Loop QS Review</strong> yang terhubung ke database AHSP/HSPK Supabase & Agen Biaya Komander Core.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => scrollToSection("workspace")}
              className="key-ink rounded-[18px] px-6 py-3.5 text-sm font-medium inline-flex items-center gap-2"
            >
              <span>Buka QTO Workspace</span>
              <ArrowDown className="w-4 h-4" />
            </button>
            <a
              href="/api/sample-dxf"
              className="key-white rounded-[18px] px-5 py-3.5 text-sm font-medium inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4 text-[#3d4046]" />
              <span>Download Sample AutoCAD (.DXF)</span>
            </a>
          </div>
        </div>
      </section>

      {/* =====================================================================
          STAGE 2: PROTOTYPE WINDOW WORKSPACE (.zero-halo on #f8f9fb)
      ===================================================================== */}
      <section id="workspace" className="py-16 sm:py-24 px-5 sm:px-10 bg-[#f8f9fb]">
        <div className="max-w-[1360px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="font-mono-tech text-xs uppercase tracking-wider text-[#6c7078] mb-2">
                02 // Interactive Prototype Window
              </div>
              <h2 className="text-[clamp(1.85rem,3.6vw,3.1rem)] font-normal leading-[1.04] tracking-[-0.045em]">
                Ekstraksi Volume, Review QS & Kalkulasi RAB/RAP
              </h2>
            </div>
            <div className="font-mono-tech text-xs text-[#6c7078] bg-[#f4f3ee] px-3.5 py-2 rounded-full border border-[rgba(12,16,28,0.06)]">
              FastAPI Engine · {qtoItems.length} item aktif
            </div>
          </div>

          {/* Prototype Halo Window */}
          <div className="zero-halo bg-white border border-[rgba(12,16,28,0.08)] overflow-hidden">
            {/* Window Title Bar */}
            <div className="bg-[#f4f3ee] border-b border-[rgba(12,16,28,0.08)] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#e5e4df] border border-[rgba(12,16,28,0.12)]" />
                <span className="w-3 h-3 rounded-full bg-[#e5e4df] border border-[rgba(12,16,28,0.12)]" />
                <span className="w-3 h-3 rounded-full bg-[#35a95c]" />
                <span className="ml-2 font-mono-tech text-[11px] text-[#6c7078]">
                  mini-komander-build.app — QTO & Cost Control
                </span>
              </div>
              <span className="font-mono-tech text-[11px] text-[#35a95c] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#35a95c]" />
                API Connected
              </span>
            </div>

            {/* Window Body */}
            <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-7">
              {/* Left Column: Upload & Visual Overlay */}
              <div className="lg:col-span-4 space-y-5">
                <div>
                  <label className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078] block mb-1.5">
                    Nama Proyek Konstruksi
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full bg-[#f8f9fb] border border-[rgba(12,16,28,0.1)] rounded-[14px] px-3.5 py-2.5 text-sm text-[#0b0b0c] focus:outline-none focus:ring-2 focus:ring-[#0b0b0c]/15"
                  />
                </div>

                <div>
                  <div className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078] mb-2.5">
                    1. Unggah Gambar Kerja / CAD
                  </div>
                  <div className="space-y-3">
                    <label className="block p-4 rounded-[16px] bg-[#f8f9fb] border border-dashed border-[#35a95c]/60 cursor-pointer hover:bg-[#f4f3ee] transition">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#0b0b0c] flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#35a95c]" />
                          Jalur A: AutoCAD Vector (.DXF / .SVG)
                        </span>
                        <Upload className="w-3.5 h-3.5 text-[#6c7078]" />
                      </div>
                      <p className="text-xs text-[#6c7078] mt-1.5 leading-relaxed">
                        Ekstraksi presisi layer WALL, COLUMN, DOOR, & MEP via Python ezdxf & FloorPlanCAD SVG.
                      </p>
                      <input
                        type="file"
                        accept=".dxf,.svg"
                        className="hidden"
                        onChange={(e) => handleUpload(e, "cad")}
                      />
                    </label>

                    <label className="block p-4 rounded-[16px] bg-[#f8f9fb] border border-dashed border-[#0b0b0c]/25 cursor-pointer hover:bg-[#f4f3ee] transition">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#0b0b0c] flex items-center gap-2">
                          <ScanLine className="w-4 h-4 text-[#0b0b0c]" />
                          Jalur B: Scan Blueprint (.PNG/.JPG)
                        </span>
                        <Upload className="w-3.5 h-3.5 text-[#6c7078]" />
                      </div>
                      <p className="text-xs text-[#6c7078] mt-1.5 leading-relaxed">
                        Deteksi segmen garis dinding (OpenCV Canny/Hough) & Kop Gambar otomatis.
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUpload(e, "vision")}
                      />
                    </label>
                  </div>
                </div>

                {/* Dataset Studio (Learned from examples_dxf & images) */}
                {datasetSummary && (
                  <div className="p-4 rounded-[16px] bg-[#f4f3ee] border border-[rgba(12,16,28,0.08)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#3d4046] flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[#35a95c]" />
                        Dataset Train/Test ({datasetSummary.dxf?.total_files} CAD · {datasetSummary.images?.total_files} JPG)
                      </span>
                    </div>
                    <div className="font-mono-tech text-[10px] text-[#6c7078]">
                      CAD: {datasetSummary.dxf?.train_files || 3760} train / {datasetSummary.dxf?.test_files || 5502} test · Images: {datasetSummary.images?.train_files || 503} train / {datasetSummary.images?.test_files || 50} test
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSampleKind("cad");
                          if (datasetSummary.dxf?.samples?.length) setSampleFile(datasetSummary.dxf.samples[0]);
                        }}
                        className={`flex-1 font-mono-tech text-[11px] py-1.5 rounded-full transition ${
                          sampleKind === "cad" ? "bg-[#0b0b0c] text-white" : "bg-white text-[#3d4046]"
                        }`}
                      >
                        CAD ({datasetSummary.dxf?.total_files})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSampleKind("vision");
                          if (datasetSummary.images?.samples?.length) setSampleFile(datasetSummary.images.samples[0]);
                        }}
                        className={`flex-1 font-mono-tech text-[11px] py-1.5 rounded-full transition ${
                          sampleKind === "vision" ? "bg-[#0b0b0c] text-white" : "bg-white text-[#3d4046]"
                        }`}
                      >
                        JPG ({datasetSummary.images?.total_files})
                      </button>
                    </div>
                    <select
                      value={sampleFile}
                      onChange={(e) => setSampleFile(e.target.value)}
                      className="w-full bg-white border border-[rgba(12,16,28,0.1)] rounded-[10px] px-2.5 py-2 text-xs text-[#0b0b0c]"
                    >
                      {(sampleKind === "cad"
                        ? datasetSummary.dxf?.samples || []
                        : datasetSummary.images?.samples || []
                      ).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAnalyzeDatasetSample}
                      className="w-full key-white rounded-[12px] py-2 text-xs font-medium"
                    >
                      Uji Sampel Dataset Terpilih
                    </button>
                  </div>
                )}

                {/* Excel Regional Material Upload (3 Regional Excels + Combined) */}
                <div className="p-4 rounded-[16px] bg-[#f8f9fb] border border-[rgba(12,16,28,0.08)] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#3d4046] flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#35a95c]" />
                      3 Dataset Excel Daerah
                    </span>
                    <a
                      href="/api/sample-excel-prices"
                      className="font-mono-tech text-[10px] underline text-[#3d4046] hover:text-[#0b0b0c]"
                    >
                      ⬇ Semua (1 File)
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["Jakarta", "Banten", "Surabaya"].map((reg) => (
                      <a
                        key={reg}
                        href={`/api/sample-excel-prices?region=${reg}`}
                        className="text-center font-mono-tech text-[10px] py-1.5 px-2 rounded-[10px] bg-white border border-[rgba(12,16,28,0.1)] text-[#0b0b0c] hover:bg-[#f4f3ee] transition"
                      >
                        ⬇ {reg}.xlsx
                      </a>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#6c7078] leading-relaxed">
                    Unduh salah satu dari 3 Excel daerah di atas (berisi rincian bahan baku + upah tukang), lalu unggah untuk menyesuaikan biaya proyek.
                  </p>
                  <label className="block text-center key-white rounded-[12px] py-2 px-3 text-xs font-medium cursor-pointer">
                    {uploadingExcel ? "Memproses Excel..." : "Upload Excel / CSV Harga Daerah"}
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleExcelUpload}
                    />
                  </label>
                  <div className="font-mono-tech text-[10px] text-[#6c7078] truncate">
                    Sumber: {priceSource}
                  </div>
                </div>

                {loading && (
                  <div className="p-3.5 bg-[#f4f3ee] border border-[rgba(12,16,28,0.08)] rounded-[14px] text-xs text-[#3d4046] animate-pulse">
                    Memindai geometri gambar, membaca skala Kop Gambar, dan memetakan item AHSP...
                  </div>
                )}

                {metadata && (
                  <div className="p-4 bg-[#1b1d1c] text-white rounded-[16px] text-xs space-y-2 border border-white/10">
                    <div className="font-mono-tech text-[11px] uppercase tracking-wider text-[#3ddc84]">
                      Metadata Kop Gambar (Title Block)
                    </div>
                    <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                      <span className="text-white/60">Kode Gambar</span>
                      <span className="font-mono-tech text-right">{metadata.drawing_code}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                      <span className="text-white/60">Disiplin</span>
                      <span className="text-right">{metadata.discipline}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                      <span className="text-white/60">Skala</span>
                      <span className="font-mono-tech text-right">{metadata.scale}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                      <span className="text-white/60">Engine</span>
                      <span className="font-mono-tech text-[#3ddc84] text-right">{metadata.engine}</span>
                    </div>
                    {metadata.ocr_status && (
                      <div className="flex justify-between gap-2 pt-0.5">
                        <span className="text-white/60">OCR Skala</span>
                        <span className="font-mono-tech text-[10px] text-amber-300 text-right">
                          {metadata.ocr_status}
                        </span>
                      </div>
                    )}
                    {metadata.dimension_callouts?.length > 0 && (
                      <div className="pt-1 text-[10px] font-mono-tech text-white/70">
                        Dimensi Terbaca: {metadata.dimension_callouts.join(" · ")}
                      </div>
                    )}
                  </div>
                )}

                {overlayImg && (
                  <div className="p-3 bg-[#1b1d1c] rounded-[16px] space-y-2 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono-tech text-[11px] text-white/75">
                        {activeHighlightCode && layerHighlights?.[activeHighlightCode]
                          ? `Sorotan: [${activeHighlightCode}] ${layerHighlights[activeHighlightCode].label}`
                          : "Overlay CAD / OpenCV (Klik baris QTO untuk sorot)"}
                      </div>
                      {activeHighlightCode && (
                        <button
                          type="button"
                          onClick={() => setActiveHighlightCode(null)}
                          className="font-mono-tech text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white hover:bg-white/25"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="relative rounded-[10px] overflow-hidden border border-white/10">
                      <img
                        src={overlayImg}
                        alt="CAD / OpenCV Detection Overlay"
                        className={`w-full block transition duration-200 ${
                          activeHighlightCode && layerHighlights?.[activeHighlightCode]
                            ? "opacity-40"
                            : "opacity-100"
                        }`}
                      />
                      {activeHighlightCode && layerHighlights?.[activeHighlightCode] && (
                        <svg
                          viewBox="0 0 1000 1000"
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        >
                          {(layerHighlights[activeHighlightCode].boxes || []).map((b, bi) => (
                            <rect
                              key={`b-${bi}`}
                              x={b[0]}
                              y={b[1]}
                              width={b[2]}
                              height={b[3]}
                              fill={`${layerHighlights[activeHighlightCode].color}28`}
                              stroke={layerHighlights[activeHighlightCode].color}
                              strokeWidth="8"
                              strokeDasharray="14 8"
                            />
                          ))}
                          {(layerHighlights[activeHighlightCode].lines || []).map((ln, li) => (
                            <line
                              key={`l-${li}`}
                              x1={ln[0]}
                              y1={ln[1]}
                              x2={ln[2]}
                              y2={ln[3]}
                              stroke={layerHighlights[activeHighlightCode].color}
                              strokeWidth="7"
                              strokeLinecap="round"
                            />
                          ))}
                          {(layerHighlights[activeHighlightCode].circles || []).map((c, ci) => (
                            <circle
                              key={`c-${ci}`}
                              cx={c[0]}
                              cy={c[1]}
                              r={c[2] || 14}
                              fill={`${layerHighlights[activeHighlightCode].color}44`}
                              stroke={layerHighlights[activeHighlightCode].color}
                              strokeWidth="6"
                            />
                          ))}
                        </svg>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: QTO Table, RAB/RAP Summary & Komander Core */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-[#f8f9fb] border border-[rgba(12,16,28,0.08)] rounded-[18px] p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-normal tracking-[-0.025em] text-[#0b0b0c]">
                        2. Quantity Take-Off (QTO) & Human-in-the-Loop QS Review
                      </h3>
                      <p className="text-xs text-[#6c7078] mt-0.5">
                        Item dengan tingkat kepercayaan rendah ditandai otomatis agar QS cukup memeriksa baris ambigu.
                      </p>
                    </div>
                    <button
                      onClick={() => setOnlyFlagged(!onlyFlagged)}
                      className={`font-mono-tech text-[11px] px-3.5 py-2 rounded-full border transition ${
                        onlyFlagged
                          ? "bg-[#0b0b0c] border-[#0b0b0c] text-white"
                          : "bg-white border-[rgba(12,16,28,0.12)] text-[#3d4046] hover:bg-[#f4f3ee]"
                      }`}
                    >
                      {onlyFlagged
                        ? `Menampilkan: Perlu Cek QS (${flaggedCount})`
                        : `Filter: Hanya Flag AI (${flaggedCount})`}
                    </button>
                  </div>

                  {qtoItems.length === 0 ? (
                    <div className="text-center py-14 px-4 text-xs text-[#6c7078] bg-white border border-dashed border-[rgba(12,16,28,0.12)] rounded-[14px]">
                      Belum ada file yang diunggah. Klik <strong>Download Sample AutoCAD (.DXF)</strong> lalu unggah ke <strong>Jalur A</strong>, atau unggah gambar denah ke <strong>Jalur B</strong>.
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-white rounded-[14px] border border-[rgba(12,16,28,0.08)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f4f3ee] text-[#6c7078] border-b border-[rgba(12,16,28,0.08)] font-mono-tech text-[11px]">
                          <tr>
                            <th className="p-3 font-medium">Item Pekerjaan (AHSP/HSPK)</th>
                            <th className="p-3 font-medium">Layer / Sumber</th>
                            <th className="p-3 font-medium">Volume</th>
                            <th className="p-3 font-medium">Status AI / QS</th>
                            <th className="p-3 font-medium text-right">
                              Subtotal RAB ({selectedRegion})
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(12,16,28,0.06)]">
                          {qtoItems
                            .map((item, originalIdx) => ({ item, originalIdx }))
                            .filter(({ item }) => (!onlyFlagged ? true : item.needs_qs_review))
                            .map(({ item, originalIdx }) => {
                              const hspk = hspkMap[item.hspk_code] || {};
                              const subtotalRab = item.quantity * (hspk.rab_unit_price || 0);
                              const isHighlighted = activeHighlightCode === item.hspk_code;
                              const hasHighlight = Boolean(layerHighlights?.[item.hspk_code]);
                              return (
                                <tr
                                  key={originalIdx}
                                  onClick={() => {
                                    if (hasHighlight) {
                                      setActiveHighlightCode((prev) =>
                                        prev === item.hspk_code ? null : item.hspk_code
                                      );
                                    }
                                  }}
                                  className={`${hasHighlight ? "cursor-pointer hover:bg-[#f4f3ee]/70 transition" : ""} ${
                                    isHighlighted
                                      ? "bg-[#35a95c]/10 ring-1 ring-inset ring-[#35a95c]"
                                      : item.needs_qs_review
                                      ? "bg-amber-50/60"
                                      : ""
                                  }`}
                                >
                                  <td className="p-3">
                                    <div className="font-medium text-[#0b0b0c] flex items-center gap-2 flex-wrap">
                                      <span>
                                        <span className="font-mono-tech text-[#6c7078] mr-1.5">
                                          [{item.hspk_code}]
                                        </span>
                                        {hspk.item_name}
                                      </span>
                                      {hasHighlight && (
                                        <span
                                          className={`font-mono-tech text-[10px] px-2 py-0.5 rounded-full ${
                                            isHighlighted
                                              ? "bg-[#0b0b0c] text-[#3ddc84]"
                                              : "bg-[#f4f3ee] text-[#6c7078]"
                                          }`}
                                        >
                                          {isHighlighted ? "● Disorot" : "Klik untuk sorot"}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[#6c7078] mt-0.5">{item.qs_note}</div>
                                    <div className="font-mono-tech text-[10px] text-[#35a95c] mt-1">
                                      Harga {selectedRegion}: Rp{" "}
                                      {Number(hspk.rab_unit_price || 0).toLocaleString("id-ID")} (RAB) · Rp{" "}
                                      {Number(hspk.rap_unit_price || 0).toLocaleString("id-ID")} (RAP) / {item.unit}
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono-tech text-[11px] text-[#3d4046]">
                                    {item.detected_layer}
                                  </td>
                                  <td className="p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        handleQuantityChange(originalIdx, e.target.value)
                                      }
                                      className="w-20 bg-[#f8f9fb] border border-[rgba(12,16,28,0.14)] rounded-[10px] px-2.5 py-1.5 font-mono-tech text-[#0b0b0c] mr-1.5"
                                    />
                                    <span className="text-[#6c7078]">{item.unit}</span>
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
                                    {item.needs_qs_review ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-mono-tech text-[11px]">
                                        <AlertTriangle className="w-3 h-3" />
                                        Cek QS ({item.confidence}%)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#35a95c]/15 text-[#227a40] rounded-full font-mono-tech text-[11px]">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Verified ({item.confidence}%)
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono-tech text-[#0b0b0c] whitespace-nowrap">
                                    Rp {subtotalRab.toLocaleString("id-ID")}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* RAB vs RAP Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#f8f9fb] border border-[rgba(12,16,28,0.08)] rounded-[16px] p-4">
                    <div className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078]">
                      Total RAB (Tender)
                    </div>
                    <div className="text-2xl font-normal tracking-[-0.03em] text-[#0b0b0c] mt-1.5">
                      Rp {totalRAB.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="bg-[#f8f9fb] border border-[rgba(12,16,28,0.08)] rounded-[16px] p-4">
                    <div className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078]">
                      Total RAP (Pelaksanaan)
                    </div>
                    <div className="text-2xl font-normal tracking-[-0.03em] text-[#35a95c] mt-1.5">
                      Rp {totalRAP.toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="bg-[#f4f3ee] border border-[rgba(12,16,28,0.08)] rounded-[16px] p-4">
                    <div className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078]">
                      Estimasi Margin Kotor
                    </div>
                    <div className="text-2xl font-normal tracking-[-0.03em] text-[#0b0b0c] mt-1.5">
                      {marginPct}%
                    </div>
                  </div>
                </div>

                {/* 1 Unified Dataset Comparison: Same Materials & Worker Wages Across Regions */}
                {regionalData && (
                  <div className="bg-[#f8f9fb] border border-[rgba(12,16,28,0.08)] rounded-[18px] p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-normal tracking-[-0.02em] text-[#0b0b0c] flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#35a95c]" />
                          1 Dataset Komparasi Bahan Baku & Upah Tukang Lintas Daerah (Aktif: {selectedRegion})
                        </h3>
                        <p className="text-xs text-[#6c7078] mt-0.5">
                          Bahan baku & upah tukang yang sama dibandingkan langsung antar daerah ({regionalData.regions.join(", ")}) dan disesuaikan ke{" "}
                          <span className="font-mono-tech text-[#0b0b0c]">
                            {qtoItems.length > 0 ? "Volume QTO Proyek Aktif" : "Simulasi Baseline Blok M1"}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {regionalData.regions.map((reg) => (
                          <button
                            key={reg}
                            type="button"
                            onClick={() => handleRegionChange(reg)}
                            className={`font-mono-tech text-[11px] px-3.5 py-1.5 rounded-full transition ${
                              selectedRegion === reg
                                ? "bg-[#0b0b0c] text-white"
                                : "bg-white border border-[rgba(12,16,28,0.12)] text-[#3d4046] hover:bg-[#f4f3ee]"
                            }`}
                          >
                            {reg}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Multi-Region Project Cost Comparison Cards (Bahan Baku + Upah Tukang + RAB) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {regionalProjectComparison.map((rc) => {
                        const isSelected = rc.region === selectedRegion;
                        return (
                          <button
                            key={rc.region}
                            type="button"
                            onClick={() => handleRegionChange(rc.region)}
                            className={`text-left rounded-[14px] p-3.5 border transition ${
                              isSelected
                                ? "bg-[#1b1d1c] text-white border-[#0b0b0c]"
                                : "bg-white text-[#0b0b0c] border-[rgba(12,16,28,0.08)] hover:bg-[#f4f3ee]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono-tech text-xs font-medium">{rc.region}</span>
                              <span
                                className={`font-mono-tech text-[10px] px-2 py-0.5 rounded-full ${
                                  isSelected
                                    ? "bg-[#3ddc84]/20 text-[#3ddc84]"
                                    : "bg-[#f4f3ee] text-[#6c7078]"
                                }`}
                              >
                                {Number(rc.diffPct) === 0
                                  ? "Baseline"
                                  : `${Number(rc.diffPct) > 0 ? "+" : ""}${rc.diffPct}%`}
                              </span>
                            </div>
                            <div className="mt-2 font-mono-tech text-sm font-medium">
                              RAB Proyek: Rp {Math.round(rc.rab).toLocaleString("id-ID")}
                            </div>
                            <div
                              className={`font-mono-tech text-[11px] mt-1 space-y-0.5 ${
                                isSelected ? "text-white/75" : "text-[#6c7078]"
                              }`}
                            >
                              <div>Bahan Baku: Rp {Math.round(rc.matOnlyTotal).toLocaleString("id-ID")}</div>
                              <div>Upah Tukang: Rp {Math.round(rc.laborOnlyTotal).toLocaleString("id-ID")}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Unified Side-by-Side Table: Same Material & Worker Across All Regions */}
                    <div className="overflow-x-auto bg-white rounded-[14px] border border-[rgba(12,16,28,0.08)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f4f3ee] text-[#6c7078] border-b border-[rgba(12,16,28,0.08)] font-mono-tech text-[11px]">
                          <tr>
                            <th className="p-2.5 font-medium">Item Bahan Baku / Tukang</th>
                            <th className="p-2.5 font-medium">Kategori</th>
                            {regionalData.regions.map((r) => (
                              <th
                                key={r}
                                className={`p-2.5 font-medium text-right ${
                                  r === selectedRegion ? "text-[#0b0b0c] bg-[#e9e8e2]/60" : ""
                                }`}
                              >
                                {r} {r === selectedRegion ? "(Aktif)" : ""}
                              </th>
                            ))}
                            <th className="p-2.5 font-medium text-right">Volume Proyek</th>
                            <th className="p-2.5 font-medium text-right">
                              Biaya Proyek ({selectedRegion})
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(12,16,28,0.06)]">
                          {unifiedComparisonRows.map((row) => {
                            const qtoQty = activeQtoVolumes[row.hspk_code] || 0;
                            const coeff = Number(row.coefficient) || 1.0;
                            const neededQty = +(qtoQty * coeff).toFixed(1);
                            const activeUnitPrice = row.pricesByRegion[selectedRegion] || 0;
                            const projectItemCost = Math.round(neededQty * activeUnitPrice);
                            const isLabor = row.categoryLabel === "Upah Tukang";
                            return (
                              <tr key={row.material_code} className={isLabor ? "bg-[#f8f9fb]/60" : ""}>
                                <td className="p-2.5 text-[#0b0b0c]">
                                  <div className="font-medium">
                                    <span className="font-mono-tech text-[11px] text-[#6c7078] mr-1.5">
                                      [{row.material_code}]
                                    </span>
                                    {row.material_name}
                                  </div>
                                  <div className="text-[11px] text-[#6c7078]">
                                    Pos {row.hspk_code} · Koef {coeff} {row.unit}
                                  </div>
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <span
                                    className={`font-mono-tech text-[10px] px-2 py-0.5 rounded-full ${
                                      isLabor
                                        ? "bg-[#0b0b0c] text-white"
                                        : "bg-[#35a95c]/15 text-[#227a40]"
                                    }`}
                                  >
                                    {row.categoryLabel}
                                  </span>
                                </td>
                                {regionalData.regions.map((r) => {
                                  const isSel = r === selectedRegion;
                                  return (
                                    <td
                                      key={r}
                                      className={`p-2.5 text-right font-mono-tech whitespace-nowrap ${
                                        isSel ? "bg-[#f4f3ee]/60 font-medium text-[#0b0b0c]" : "text-[#6c7078]"
                                      }`}
                                    >
                                      {isSel ? (
                                        <input
                                          type="number"
                                          step="500"
                                          value={row.pricesByRegion[r]}
                                          onChange={(e) => handleMaterialPriceChange(row.idx, e.target.value)}
                                          className="w-24 bg-white border border-[rgba(12,16,28,0.18)] rounded-[8px] px-2 py-1 font-mono-tech text-xs text-right text-[#0b0b0c]"
                                        />
                                      ) : (
                                        <span>Rp {Number(row.pricesByRegion[r]).toLocaleString("id-ID")}</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="p-2.5 text-right font-mono-tech text-[#3d4046] whitespace-nowrap">
                                  {neededQty.toLocaleString("id-ID")} {row.unit}
                                </td>
                                <td className="p-2.5 text-right font-mono-tech font-medium text-[#0b0b0c] whitespace-nowrap">
                                  Rp {projectItemCost.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Generator Jadwal Proyek & Kurva-S (S-Curve) Otomatis dari Volume OH Tukang */}
                <div className="bg-[#f8f9fb] border border-[rgba(12,16,28,0.08)] rounded-[18px] p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-normal tracking-[-0.02em] text-[#0b0b0c] flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-[#35a95c]" />
                        Generator Jadwal Proyek & Kurva-S Otomatis (Berbasis Volume OH Tukang)
                      </h3>
                      <p className="text-xs text-[#6c7078] mt-0.5">
                        Total beban kerja tukang{" "}
                        <span className="font-mono-tech text-[#0b0b0c] font-medium">
                          {sCurveData.totalLaborOH.toLocaleString("id-ID")} OH
                        </span>{" "}
                        ÷ kapasitas{" "}
                        <span className="font-mono-tech text-[#0b0b0c]">
                          {workerCount} tukang ({sCurveData.weeklyCapacityOH} OH/minggu)
                        </span>{" "}
                        ={" "}
                        <span className="font-mono-tech text-[#35a95c] font-medium">
                          Estimasi {sCurveData.totalWeeks} Minggu Pelaksanaan
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-[rgba(12,16,28,0.1)] rounded-full px-3 py-1.5">
                      <Users className="w-3.5 h-3.5 text-[#6c7078]" />
                      <span className="font-mono-tech text-[11px] text-[#6c7078] mr-1">Tim Tukang:</span>
                      {[4, 6, 8, 10, 12].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setWorkerCount(cnt)}
                          className={`font-mono-tech text-[11px] px-2 py-0.5 rounded-full transition ${
                            workerCount === cnt
                              ? "bg-[#0b0b0c] text-white"
                              : "text-[#3d4046] hover:bg-[#f4f3ee]"
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Visual S-Curve Chart (Dark Stage Panel) */}
                  <div className="bg-[#1b1d1c] text-white rounded-[16px] p-4 sm:p-5 border border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="font-mono-tech text-[11px] text-white/80 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#3ddc84]" />
                        GRAFIK KURVA-S PROGRES KUMULATIF (%) & CASHFLOW MINGGUAN ({selectedRegion.toUpperCase()})
                      </div>
                      <div className="flex items-center gap-4 font-mono-tech text-[10px]">
                        <span className="flex items-center gap-1.5 text-[#3ddc84]">
                          <span className="w-2.5 h-0.5 bg-[#3ddc84] inline-block" />
                          Rencana (Baseline S-Curve)
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <span className="w-2.5 h-0.5 bg-amber-300 inline-block" />
                          Simulasi Realisasi Lapangan
                        </span>
                      </div>
                    </div>

                    {/* SVG S-Curve Graph */}
                    {(() => {
                      const rows = sCurveData.schedule;
                      const W = 680;
                      const H = 190;
                      const padL = 36;
                      const padR = 24;
                      const padT = 18;
                      const padB = 28;
                      const innerW = W - padL - padR;
                      const innerH = H - padT - padB;
                      const n = rows.length || 1;
                      const xAt = (idx) =>
                        n === 1 ? padL + innerW / 2 : padL + (idx / (n - 1)) * innerW;
                      const yAt = (pct) => padT + innerH - (Math.min(100, Math.max(0, pct)) / 100) * innerH;

                      const planPts = rows.map((r, i) => `${xAt(i)},${yAt(r.cum_planned_pct)}`).join(" ");
                      const actPts = rows.map((r, i) => `${xAt(i)},${yAt(r.cum_actual_pct)}`).join(" ");

                      return (
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          className="w-full h-44 overflow-visible"
                          role="img"
                          aria-label="Grafik Kurva-S Proyek"
                        >
                          {/* Horizontal grid lines */}
                          {[0, 25, 50, 75, 100].map((g) => (
                            <g key={g}>
                              <line
                                x1={padL}
                                y1={yAt(g)}
                                x2={W - padR}
                                y2={yAt(g)}
                                stroke="rgba(255,255,255,0.09)"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padL - 6}
                                y={yAt(g) + 3}
                                textAnchor="end"
                                fill="rgba(255,255,255,0.45)"
                                fontSize="9"
                                fontFamily="JetBrains Mono, monospace"
                              >
                                {g}%
                              </text>
                            </g>
                          ))}

                          {/* Weekly weight bars */}
                          {rows.map((r, i) => {
                            const barW = Math.max(12, Math.min(34, innerW / (n * 1.8)));
                            const barH = (r.weight_pct / 100) * innerH * 1.8;
                            const bx = xAt(i) - barW / 2;
                            const by = padT + innerH - barH;
                            return (
                              <g key={r.week}>
                                <rect
                                  x={bx}
                                  y={by}
                                  width={barW}
                                  height={Math.max(2, barH)}
                                  rx="3"
                                  fill="rgba(61,220,132,0.16)"
                                />
                                <text
                                  x={xAt(i)}
                                  y={H - 8}
                                  textAnchor="middle"
                                  fill="rgba(255,255,255,0.6)"
                                  fontSize="9"
                                  fontFamily="JetBrains Mono, monospace"
                                >
                                  M{r.weekNum}
                                </text>
                              </g>
                            );
                          })}

                          {/* Planned S-Curve Polyline */}
                          <polyline
                            fill="none"
                            stroke="#3ddc84"
                            strokeWidth="2.5"
                            points={planPts}
                          />
                          {/* Actual Simulated S-Curve Polyline */}
                          <polyline
                            fill="none"
                            stroke="#fcd34d"
                            strokeWidth="2"
                            strokeDasharray="5 3"
                            points={actPts}
                          />

                          {/* Points & Labels */}
                          {rows.map((r, i) => (
                            <g key={`pt-${r.week}`}>
                              <circle
                                cx={xAt(i)}
                                cy={yAt(r.cum_planned_pct)}
                                r="3.5"
                                fill="#3ddc84"
                              />
                              <circle
                                cx={xAt(i)}
                                cy={yAt(r.cum_actual_pct)}
                                r="3"
                                fill="#fcd34d"
                              />
                              <text
                                x={xAt(i)}
                                y={yAt(r.cum_planned_pct) - 7}
                                textAnchor="middle"
                                fill="#3ddc84"
                                fontSize="8.5"
                                fontFamily="JetBrains Mono, monospace"
                              >
                                {r.cum_planned_pct}%
                              </text>
                            </g>
                          ))}
                        </svg>
                      );
                    })()}
                  </div>

                  {/* Weekly Schedule & Cashflow Table */}
                  <div className="overflow-x-auto bg-white rounded-[14px] border border-[rgba(12,16,28,0.08)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f4f3ee] text-[#6c7078] border-b border-[rgba(12,16,28,0.08)] font-mono-tech text-[11px]">
                        <tr>
                          <th className="p-2.5 font-medium">Minggu</th>
                          <th className="p-2.5 font-medium">Tahap Pekerjaan Konstruksi</th>
                          <th className="p-2.5 font-medium text-right">Beban Tukang</th>
                          <th className="p-2.5 font-medium text-right">Bobot (%)</th>
                          <th className="p-2.5 font-medium text-right">Kumulatif Rencana</th>
                          <th className="p-2.5 font-medium text-right">Cashflow RAP Mingguan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(12,16,28,0.06)]">
                        {sCurveData.schedule.map((row) => (
                          <tr key={row.week}>
                            <td className="p-2.5 font-mono-tech font-medium text-[#0b0b0c] whitespace-nowrap">
                              {row.week}
                            </td>
                            <td className="p-2.5 text-[#3d4046]">{row.stage}</td>
                            <td className="p-2.5 text-right font-mono-tech text-[#3d4046] whitespace-nowrap">
                              {row.oh.toLocaleString("id-ID")} OH
                            </td>
                            <td className="p-2.5 text-right font-mono-tech text-[#6c7078] whitespace-nowrap">
                              {row.weight_pct}%
                            </td>
                            <td className="p-2.5 text-right font-mono-tech font-medium text-[#227a40] whitespace-nowrap">
                              {row.cum_planned_pct}%
                            </td>
                            <td className="p-2.5 text-right font-mono-tech text-[#0b0b0c] whitespace-nowrap">
                              Rp {row.weekly_rap_idr.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Official Excel Export + Telegram Reminder + Komander Core Hand-off */}
                <div className="bg-[#f4f3ee] border border-[rgba(12,16,28,0.08)] rounded-[18px] p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-base font-normal tracking-[-0.02em] text-[#0b0b0c]">
                        3. Export Dokumen Resmi RAB, Kirim Reminder Telegram & Aktifkan Komander Core
                      </h3>
                      <p className="text-xs text-[#6c7078] mt-0.5">
                        Unduh Excel 4-Sheet, kirim reminder RAB & jadwal ke Telegram, atau kunci baseline ke PostgreSQL.
                      </p>
                      {savedProjectId && (
                        <p className="font-mono-tech text-[11px] text-[#35a95c] mt-1.5">
                          ✓ Tersimpan di Supabase PostgreSQL (Project ID: {savedProjectId})
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={exportingRab}
                        onClick={handleExportOfficialExcel}
                        className="key-white rounded-[16px] px-4 py-3 text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-[#35a95c]" />
                        <span>
                          {exportingRab
                            ? "Menyiapkan Excel..."
                            : `⬇ Export RAB, BoM & Kurva-S (${selectedRegion}).xlsx`}
                        </span>
                      </button>
                      <button
                        disabled={saving}
                        onClick={saveAndActivateProject}
                        className="key-ink disabled:opacity-40 rounded-[16px] px-5 py-3 text-xs font-medium whitespace-nowrap"
                      >
                        {saving ? "Mengirim..." : "Aktifkan & Kirim Reminder Telegram"}
                      </button>
                    </div>
                  </div>

                  {/* Optional Telegram Bot Config (can also be set via Vercel Env Vars) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[rgba(12,16,28,0.08)]">
                    <div>
                      <label className="font-mono-tech text-[10px] uppercase tracking-wider text-[#6c7078] block mb-1">
                        Telegram Bot Token (Opsional jika sudah di .env/Vercel)
                      </label>
                      <input
                        type="password"
                        placeholder="Contoh: 123456:ABC-DEF..."
                        value={telegramToken}
                        onChange={(e) => setTelegramToken(e.target.value)}
                        className="w-full bg-white border border-[rgba(12,16,28,0.12)] rounded-[10px] px-3 py-1.5 font-mono-tech text-xs text-[#0b0b0c]"
                      />
                    </div>
                    <div>
                      <label className="font-mono-tech text-[10px] uppercase tracking-wider text-[#6c7078] block mb-1">
                        Telegram Chat ID (Opsional jika sudah di .env/Vercel)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 987654321 atau -100..."
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        className="w-full bg-white border border-[rgba(12,16,28,0.12)] rounded-[10px] px-3 py-1.5 font-mono-tech text-xs text-[#0b0b0c]"
                      />
                    </div>
                  </div>
                </div>

                {alertSent && (
                  <div className="p-5 bg-[#1b1d1c] text-white border border-white/10 rounded-[18px] text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-[#3ddc84]">
                        <ShieldAlert className="w-4 h-4 text-[#3ddc84]" />
                        {telegramStatus?.sent
                          ? `[TELEGRAM REMINDER TERKIRIM LIVE · MSG #${telegramStatus.telegram_message_id}]`
                          : "[SIMULASI TELEGRAM REMINDER · AGEN BIAYA KOMANDER CORE]"}
                      </div>
                      {telegramStatus && !telegramStatus.sent && (
                        <span className="font-mono-tech text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          {telegramStatus.reason}
                        </span>
                      )}
                    </div>
                    <div className="text-white/90 leading-relaxed">
                      Proyek <strong>{projectName}</strong> ({selectedRegion}) aktif. Estimasi{" "}
                      <strong>{sCurveData.totalWeeks} Minggu ({sCurveData.totalLaborOH} OH)</strong> · Total RAB{" "}
                      <strong>Rp {totalRAB.toLocaleString("id-ID")}</strong> · Total RAP{" "}
                      <strong>Rp {totalRAP.toLocaleString("id-ID")}</strong>.
                    </div>
                    <div className="text-white/60 font-mono-tech text-[11px]">
                      Tindakan Agen Biaya: Pantau pos Atap (ATP-01) & Dinding (ARS-01); tahan persetujuan PO tambahan sebelum verifikasi QS.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          STAGE 3: DARK STAGE (#0b0b0c) + 3D FLIP BENTO CARDS
      ===================================================================== */}
      <section id="engines" className="bg-[#0b0b0c] text-white py-20 sm:py-28 px-5 sm:px-10">
        <div className="max-w-[1360px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <div className="font-mono-tech text-xs uppercase tracking-wider text-white/50 mb-3">
                03 // Core Architecture
              </div>
              <h2 className="text-[clamp(2rem,4.2vw,3.6rem)] font-normal leading-[1.02] tracking-[-0.045em] max-w-2xl">
                Tiga lapisan <span className="font-serif-editorial italic text-[#3ddc84]">otomasi</span> dari denah hingga kontrol biaya.
              </h2>
            </div>
            <p className="text-sm text-white/60 max-w-sm">
              Klik kartu mana saja untuk membalik dan melihat detail teknis implementasi di balik layar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ENGINE_CARDS.map((card) => {
              const isFlipped = !!flippedCards[card.id];
              return (
                <div
                  key={card.id}
                  onClick={() => toggleFlip(card.id)}
                  className="perspective-1200 h-[340px] cursor-pointer"
                >
                  <div
                    className={`relative w-full h-full preserve-3d ${
                      isFlipped ? "rotate-y-180" : ""
                    }`}
                  >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-[#1b1d1c] border border-white/10 rounded-[20px] p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-6">
                          <span className="font-mono-tech text-[11px] text-white/50">
                            {card.eyebrow}
                          </span>
                          <span className="font-mono-tech text-[11px] px-2.5 py-1 rounded-full bg-[#3ddc84]/15 text-[#3ddc84]">
                            {card.badge}
                          </span>
                        </div>
                        <h3 className="text-[clamp(1.4rem,2vw,1.9rem)] font-normal tracking-[-0.035em] text-white">
                          {card.title}
                        </h3>
                        <p className="text-sm text-white/65 mt-3 leading-relaxed">
                          {card.frontDesc}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-white/50">
                        <span className="font-mono-tech">Klik untuk detail</span>
                        <RotateCw className="w-4 h-4 text-white/60" />
                      </div>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white text-[#0b0b0c] rounded-[20px] p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-mono-tech text-[11px] text-[#6c7078]">
                            {card.eyebrow}
                          </span>
                          <span className="w-7 h-7 rounded-full bg-[#f4f3ee] flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-[#0b0b0c]" />
                          </span>
                        </div>
                        <ul className="space-y-2.5 text-xs text-[#3d4046]">
                          {card.backBullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#35a95c] mt-1.5 shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[rgba(12,16,28,0.08)]">
                        {card.tags.map((t) => (
                          <span
                            key={t}
                            className="font-mono-tech text-[10px] px-2.5 py-1 rounded-full bg-[#f4f3ee] text-[#3d4046]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Training Validation Benchmark Strip */}
          {validationReport && (
            <div className="mt-14 bg-[#1b1d1c] border border-white/10 rounded-[20px] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="font-mono-tech text-[11px] uppercase tracking-wider text-[#3ddc84] flex items-center gap-2">
                    <FlaskConical className="w-4 h-4" />
                    Validation & Training Measurement Benchmark
                  </div>
                  <h3 className="text-xl font-normal tracking-[-0.03em] text-white mt-1">
                    Hasil Pengujian Terukur pada Dataset CAD, Vision, & Harga Daerah
                  </h3>
                </div>
                <span className="font-mono-tech text-[11px] text-white/60">
                  Updated: {validationReport.generated_at?.slice(0, 10)}
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0b0b0c] border border-white/10 rounded-[14px] p-4">
                  <div className="font-mono-tech text-[10px] uppercase text-white/50">
                    DXF Corpus (47 File)
                  </div>
                  <div className="text-2xl font-normal text-[#3ddc84] mt-1">
                    {validationReport.dxf_corpus_validation?.passed_files}/
                    {validationReport.dxf_corpus_validation?.total_files} PASS
                  </div>
                  <div className="font-mono-tech text-[11px] text-white/60 mt-1">
                    Mean latency: {validationReport.dxf_corpus_validation?.mean_latency_ms} ms
                  </div>
                </div>

                <div className="bg-[#0b0b0c] border border-white/10 rounded-[14px] p-4">
                  <div className="font-mono-tech text-[10px] uppercase text-white/50">
                    Vision Blind Hold-Out
                  </div>
                  <div className="text-2xl font-normal text-white mt-1">
                    MAE {validationReport.vision_ground_truth_validation?.mae_m2} m²
                  </div>
                  <div className="font-mono-tech text-[11px] text-white/60 mt-1">
                    {validationReport.vision_ground_truth_validation?.blind_labeled_count} labeled ·{" "}
                    {validationReport.vision_ground_truth_validation?.within_35pct_acc}% within ±35%
                  </div>
                </div>

                <div className="bg-[#0b0b0c] border border-white/10 rounded-[14px] p-4">
                  <div className="font-mono-tech text-[10px] uppercase text-white/50">
                    Vision Corpus Sweep
                  </div>
                  <div className="text-2xl font-normal text-[#3ddc84] mt-1">
                    {validationReport.vision_ground_truth_validation?.stability_sweep?.passed}/
                    {validationReport.vision_ground_truth_validation?.stability_sweep?.tested} PASS
                  </div>
                  <div className="font-mono-tech text-[11px] text-white/60 mt-1">
                    Mean latency:{" "}
                    {validationReport.vision_ground_truth_validation?.stability_sweep?.mean_latency_ms} ms
                  </div>
                </div>

                <div className="bg-[#0b0b0c] border border-white/10 rounded-[14px] p-4">
                  <div className="font-mono-tech text-[10px] uppercase text-white/50">
                    Excel Round-Trip (3 Kota)
                  </div>
                  <div className="text-2xl font-normal text-[#3ddc84] mt-1">
                    {validationReport.regional_excel_validation?.material_roundtrip_matched} Match
                  </div>
                  <div className="font-mono-tech text-[11px] text-white/60 mt-1">
                    Jakarta · Banten · Surabaya
                  </div>
                </div>
              </div>

              {validationReport.regional_excel_validation?.blok_m1_regional_comparison && (
                <div className="overflow-x-auto rounded-[14px] border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0b0b0c] text-white/60 font-mono-tech text-[11px]">
                      <tr>
                        <th className="p-3 font-medium">Daerah (Sample Blok M1)</th>
                        <th className="p-3 font-medium text-right">Semen 50kg</th>
                        <th className="p-3 font-medium text-right">Bata Ringan / m³</th>
                        <th className="p-3 font-medium text-right">Total RAB</th>
                        <th className="p-3 font-medium text-right">Total RAP</th>
                        <th className="p-3 font-medium text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {validationReport.regional_excel_validation.blok_m1_regional_comparison.map((row) => (
                        <tr key={row.region}>
                          <td className="p-3 font-medium text-white">{row.region}</td>
                          <td className="p-3 text-right font-mono-tech text-white/80">
                            Rp {Number(row.cement_50kg_idr).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3 text-right font-mono-tech text-white/80">
                            Rp {Number(row.aac_brick_m3_idr).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3 text-right font-mono-tech text-white">
                            Rp {Number(row.total_rab_idr).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3 text-right font-mono-tech text-[#3ddc84]">
                            Rp {Number(row.total_rap_idr).toLocaleString("id-ID")}
                          </td>
                          <td className="p-3 text-right font-mono-tech text-white/80">
                            {row.gross_margin_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          STAGE 4: SAGE PLAZA ISOMETRIC FOOTER (#b9c4bd)
      ===================================================================== */}
      <footer
        id="plaza"
        className="relative bg-[#b9c4bd] text-[#0b0b0c] pt-20 pb-36 px-5 sm:px-10 overflow-hidden"
      >
        {/* 3D Perspective Grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(11,11,12,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,11,12,0.16) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            transform: "perspective(1500px) rotateX(22deg) scale(1.15)",
            transformOrigin: "center top",
          }}
        />

        <div className="relative max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <div className="font-mono-tech text-xs uppercase tracking-wider text-[#3d4046]">
              04 // Deployment & Field Plaza
            </div>
            <h2 className="text-[clamp(1.9rem,3.6vw,3rem)] font-normal leading-[1.04] tracking-[-0.045em]">
              Siap untuk demo <span className="font-serif-editorial italic">end-to-end</span> di Komander.ai.
            </h2>
            <p className="text-sm text-[#3d4046] leading-relaxed">
              Pilih node arsitektur di samping untuk melihat kesiapan infrastruktur prototipe ini.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { id: "depok", label: "Site: Blok M1 Depok" },
                { id: "supabase", label: "Supabase PostgreSQL" },
                { id: "vercel", label: "Vercel Hybrid Monorepo" },
              ].map((pin) => (
                <button
                  key={pin.id}
                  onClick={() => setActivePin(pin.id)}
                  className={`font-mono-tech text-xs px-3.5 py-2 rounded-full transition ${
                    activePin === pin.id
                      ? "bg-[#0b0b0c] text-white"
                      : "bg-white/80 text-[#0b0b0c] hover:bg-white"
                  }`}
                >
                  {pin.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="zero-halo bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-[rgba(12,16,28,0.08)] pb-4 mb-4">
                <span className="font-mono-tech text-xs text-[#6c7078]">
                  NODE STATUS // {activePin.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono-tech text-xs text-[#35a95c]">
                  <span className="w-2 h-2 rounded-full bg-[#35a95c]" />
                  Operational
                </span>
              </div>
              {activePin === "depok" && (
                <p className="text-sm text-[#3d4046] leading-relaxed">
                  <strong>Pembangunan Hunian Blok M1 - Depok</strong> — Denah standar 10m × 12m dengan 9 kolom struktur, 5 unit pintu, dan 8 titik lampu MEP. Gunakan tombol <em>Download Sample AutoCAD (.DXF)</em> untuk langsung menguji ekstraksi vektor.
                </p>
              )}
              {activePin === "supabase" && (
                <p className="text-sm text-[#3d4046] leading-relaxed">
                  <strong>Supabase PostgreSQL</strong> — Menyimpan tabel <code>master_hspk</code> (harga tender RAB vs harga pelaksanaan RAP), <code>projects</code>, dan <code>qto_items</code>. Dilengkapi <em>fallback</em> lokal agar demo tetap berjalan meski offline.
                </p>
              )}
              {activePin === "vercel" && (
                <p className="text-sm text-[#3d4046] leading-relaxed">
                  <strong>Vercel Hybrid Monorepo</strong> — Frontend React + Vite terhubung dengan Python FastAPI serverless di rute <code>/api/*</code> melalui <code>vercel.json</code> dan proxy lokal Vite.
                </p>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          FLOATING POPOVER SHEETS (Menu / Help / Pitch)
      ===================================================================== */}
      {activeSheet && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,440px)] zero-sheet rounded-[22px] p-5 border border-[rgba(12,16,28,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono-tech text-[11px] uppercase tracking-wider text-[#6c7078]">
              {activeSheet === "menu" && "Navigasi Cepat"}
              {activeSheet === "help" && "Panduan Demo 3 Menit"}
              {activeSheet === "pitch" && "Narasi Pitch Komander.ai"}
            </span>
            <button
              onClick={() => setActiveSheet(null)}
              className="w-7 h-7 rounded-full bg-[#f4f3ee] flex items-center justify-center hover:bg-[#e8e7e1]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeSheet === "menu" && (
            <div className="space-y-1.5 text-sm">
              {[
                { id: "hero", label: "01 // Hero Overview" },
                { id: "workspace", label: "02 // QTO & RAB Workspace" },
                { id: "engines", label: "03 // 3D Engine Architecture" },
                { id: "plaza", label: "04 // Deployment Plaza" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="w-full text-left px-3.5 py-2.5 rounded-[14px] hover:bg-[#f4f3ee] transition font-mono-tech text-xs text-[#0b0b0c]"
                >
                  {item.label}
                </button>
              ))}
              <a
                href="/api/sample-dxf"
                className="block w-full text-left px-3.5 py-2.5 rounded-[14px] bg-[#0b0b0c] text-white font-mono-tech text-xs mt-2"
              >
                ⬇ Download Sample AutoCAD (.DXF)
              </a>
            </div>
          )}

          {activeSheet === "help" && (
            <ol className="space-y-2.5 text-xs text-[#3d4046] list-decimal pl-4 leading-relaxed">
              <li>
                Klik <strong>Download Sample AutoCAD (.DXF)</strong> lalu unggah ke <strong>Jalur A</strong> untuk melihat ekstraksi vektor <code>ezdxf</code>.
              </li>
              <li>
                Atau unggah gambar denah <code>.png/.jpg</code> ke <strong>Jalur B</strong> untuk melihat <em>OpenCV Canny/Hough overlay</em>.
              </li>
              <li>
                Klik <strong>Filter: Hanya Flag AI</strong>, koreksi volume di tabel untuk memverifikasi item QS, lalu klik <strong>Aktifkan Proyek & Simulasikan Alert Agen</strong>.
              </li>
            </ol>
          )}

          {activeSheet === "pitch" && (
            <div className="space-y-2 text-xs text-[#3d4046] leading-relaxed">
              <p>
                <em>"Saya membangun prototipe Mini Komander Build yang menjembatani gambar kerja konstruksi (file vektor CAD .dxf dan scan denah 2D) menjadi RAB & RAP otomatis."</em>
              </p>
              <p>
                <em>"Item dengan confidence di bawah 85% ditandai untuk Human-in-the-Loop QS Review sebelum baseline dikunci ke PostgreSQL dan dipantau Agen Biaya Komander Core."</em>
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          FLOATING BOTTOM GLASS DOCK
      ===================================================================== */}
      <nav
        aria-label="Floating Navigation Dock"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 zero-dock rounded-[24px] p-[7px] flex items-center gap-2"
      >
        <button
          onClick={() => scrollToSection("workspace")}
          className="key-ink h-[54px] px-5 sm:px-6 rounded-[18px] text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 text-[#3ddc84]" />
          <span>QTO Workspace</span>
        </button>

        <button
          onClick={() => setActiveSheet(activeSheet === "menu" ? null : "menu")}
          aria-label="Menu Navigasi"
          className="key-white w-[54px] h-[54px] rounded-[18px] flex items-center justify-center"
        >
          <Menu className="w-5 h-5 text-[#0b0b0c]" />
        </button>

        <button
          onClick={() => setActiveSheet(activeSheet === "help" ? null : "help")}
          aria-label="Panduan Demo"
          className="key-white w-[54px] h-[54px] rounded-[18px] flex items-center justify-center"
        >
          <HelpCircle className="w-5 h-5 text-[#0b0b0c]" />
        </button>
      </nav>
    </div>
  );
}
