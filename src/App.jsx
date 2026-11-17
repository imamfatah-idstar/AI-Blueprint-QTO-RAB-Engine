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
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";

const FALLBACK_HSPK = {
  "STR-01": { division: "Struktur", item_name: "Pekerjaan Kolom Beton Bertulang K-300", rab_unit_price: 1850000, rap_unit_price: 1520000 },
  "ARS-01": { division: "Dinding", item_name: "Pasangan Dinding Bata Ringan 10 cm + Plester Aci", rab_unit_price: 285000, rap_unit_price: 230000 },
  "ARS-02": { division: "Lantai", item_name: "Pasangan Keramik Lantai 60x60 Grade A", rab_unit_price: 245000, rap_unit_price: 198000 },
  "ARS-03": { division: "Kusen & Pintu", item_name: "Pemasangan Kusen & Daun Pintu Engineering Wood", rab_unit_price: 2100000, rap_unit_price: 1750000 },
  "MEP-01": { division: "Listrik & Air", item_name: "Instalasi Titik Lampu & Saklar (Kabel NYM 3x2.5)", rab_unit_price: 320000, rap_unit_price: 255000 },
  "ATP-01": { division: "Atap", item_name: "Rangka Atap Baja Ringan & Genteng Metal Pasir", rab_unit_price: 365000, rap_unit_price: 310000 },
};

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

  useEffect(() => {
    async function fetchHspk() {
      if (!supabase) return;
      const { data, error } = await supabase.from("master_hspk").select("*");
      if (!error && data && data.length > 0) {
        const mapped = {};
        data.forEach((row) => {
          mapped[row.code] = row;
        });
        setHspkMap(mapped);
      }
    }
    fetchHspk();
  }, []);

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
                          Jalur A: AutoCAD (.DXF)
                        </span>
                        <Upload className="w-3.5 h-3.5 text-[#6c7078]" />
                      </div>
                      <p className="text-xs text-[#6c7078] mt-1.5 leading-relaxed">
                        Ekstraksi presisi layer A-WALL, S-COLUMN, A-DOOR, & ME-LIGHT via Python ezdxf.
                      </p>
                      <input
                        type="file"
                        accept=".dxf"
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
                    <div className="flex justify-between gap-2">
                      <span className="text-white/60">Engine</span>
                      <span className="font-mono-tech text-[#3ddc84] text-right">{metadata.engine}</span>
                    </div>
                  </div>
                )}

                {overlayImg && (
                  <div className="p-3 bg-[#1b1d1c] rounded-[16px] space-y-2 border border-white/10">
                    <div className="font-mono-tech text-[11px] text-white/75">
                      OpenCV Overlay: Dinding (Hijau) & Kop Gambar (Oranye)
                    </div>
                    <img
                      src={overlayImg}
                      alt="OpenCV Detection Overlay"
                      className="rounded-[10px] border border-white/10 w-full"
                    />
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
                            <th className="p-3 font-medium text-right">Subtotal RAB</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(12,16,28,0.06)]">
                          {qtoItems
                            .map((item, originalIdx) => ({ item, originalIdx }))
                            .filter(({ item }) => (!onlyFlagged ? true : item.needs_qs_review))
                            .map(({ item, originalIdx }) => {
                              const hspk = hspkMap[item.hspk_code] || {};
                              const subtotalRab = item.quantity * (hspk.rab_unit_price || 0);
                              return (
                                <tr
                                  key={originalIdx}
                                  className={item.needs_qs_review ? "bg-amber-50/60" : ""}
                                >
                                  <td className="p-3">
                                    <div className="font-medium text-[#0b0b0c]">
                                      <span className="font-mono-tech text-[#6c7078] mr-1.5">
                                        [{item.hspk_code}]
                                      </span>
                                      {hspk.item_name}
                                    </div>
                                    <div className="text-[#6c7078] mt-0.5">{item.qs_note}</div>
                                  </td>
                                  <td className="p-3 font-mono-tech text-[11px] text-[#3d4046]">
                                    {item.detected_layer}
                                  </td>
                                  <td className="p-3 whitespace-nowrap">
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

                {/* Komander Core Hand-off */}
                <div className="bg-[#f4f3ee] border border-[rgba(12,16,28,0.08)] rounded-[18px] p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-base font-normal tracking-[-0.02em] text-[#0b0b0c]">
                      3. Simpan ke Supabase & Aktifkan ke Komander Core
                    </h3>
                    <p className="text-xs text-[#6c7078] mt-0.5">
                      Mengunci baseline RAB/RAP ke PostgreSQL dan mengaktifkan pemantauan Agen Biaya, Jadwal, & Keuangan.
                    </p>
                    {savedProjectId && (
                      <p className="font-mono-tech text-[11px] text-[#35a95c] mt-1.5">
                        ✓ Tersimpan di Supabase PostgreSQL (Project ID: {savedProjectId})
                      </p>
                    )}
                  </div>
                  <button
                    disabled={qtoItems.length === 0 || saving}
                    onClick={saveAndActivateProject}
                    className="key-ink disabled:opacity-40 rounded-[16px] px-5 py-3 text-xs font-medium whitespace-nowrap"
                  >
                    {saving ? "Menyimpan..." : "Aktifkan Proyek & Simulasikan Alert Agen"}
                  </button>
                </div>

                {alertSent && (
                  <div className="p-5 bg-[#1b1d1c] text-white border border-white/10 rounded-[18px] text-xs space-y-2">
                    <div className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-wider text-[#3ddc84]">
                      <ShieldAlert className="w-4 h-4 text-[#3ddc84]" />
                      [SIMULASI WHATSAPP ALERT · PRIORITAS TINGGI · AGEN BIAYA KOMANDER CORE]
                    </div>
                    <div className="text-white/90 leading-relaxed">
                      Proyek <strong>{projectName}</strong> aktif. Simulasi deviasi lapangan: Pos{" "}
                      <strong>Pekerjaan Atap (ATP-01)</strong> tercatat{" "}
                      <strong>113% terhadap baseline RAP</strong> (+13% di atas anggaran).
                    </div>
                    <div className="text-white/60 font-mono-tech text-[11px]">
                      Bukti Sumber: Sheet Pengeluaran_Minggu27 baris 412–418 · Tindakan: Tahan persetujuan PO baja ringan tambahan sebelum verifikasi QS.
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
