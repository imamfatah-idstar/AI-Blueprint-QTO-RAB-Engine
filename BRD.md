# Business Requirements Document (BRD)
## Proyek: Mini Komander Build — AI Blueprint Quantity Take-Off (QTO), Regional Cost & RAB/RAP Engine

| Informasi Dokumen | Detail |
| :--- | :--- |
| **Nama Proyek** | Mini Komander Build (AI Blueprint QTO & RAB Engine) |
| **Organisasi / Konteks** | Komander.ai — Construction AI & Agentic Cost Control |
| **PIC / Pengembang** | Imam Abdul Fatah |
| **Status Dokumen** | Final Prototype Specification & Validated Baseline |
| **Versi** | 1.0 |

---

## 1. Ringkasan Eksekutif (*Executive Summary*)

**Mini Komander Build** adalah platform otomasi estimasi biaya konstruksi yang menjembatani dokumen gambar kerja teknik—baik berupa file vektor **CAD (`.dxf` / `.svg`)** maupun hasil pindaian gambar denah **2D (`.jpg` / `.png`)**—menjadi perhitungan **Quantity Take-Off (QTO)**, **Rencana Anggaran Biaya (RAB / Penawaran Tender)**, dan **Rencana Anggaran Pelaksanaan (RAP / Modal Kontraktor)** secara instan.

Sistem ini dilengkapi dengan:
1. **Dual-Engine QTO Extraction** (Vektor CAD & Computer Vision OpenCV yang dikalibrasi pada ribuan sampel dataset `cad/train` dan `images/train`).
2. **Human-in-the-Loop QS Review** yang menandai otomatis item pekerjaan dengan tingkat kepercayaan (*confidence*) di bawah **85%** untuk diverifikasi oleh *Quantity Surveyor (QS)*.
3. **Regional Material & Labor Pricing Engine (Excel/CSV)** yang memperhitungkan perbedaan harga **Bahan Baku Konstruksi (`MAT-*`)** dan **Upah Tukang / Tenaga Kerja (`LAB-*` per Orang-Hari / `OH`)** di berbagai daerah (**Jakarta**, **Banten**, **Surabaya**, atau kota lain) dan menyesuaikannya langsung ke RAB/RAP proyek.
4. **Agentic Cost Control Hand-off** yang menyimpan *baseline* anggaran ke **Supabase PostgreSQL** dan menyimulasikan peringatan deviasi biaya *real-time* melalui **Agen Biaya Komander Core**.

---

## 2. Latar Belakang & Masalah Bisnis (*Business Problem Statement*)

Dalam alur kerja proyek konstruksi konvensional, proses penyusunan RAB dan RAP menghadapi empat kendala utama:
1. **Proses QTO Manual yang Lambat & Rawan Kesalahan:** *Quantity Surveyor (QS)* menghabiskan berjam-jam hingga berhari-hari untuk mengukur panjang dinding, menghitung jumlah kolom, pintu, titik lampu MEP, dan luas lantai dari gambar kerja.
2. **Format Dokumen yang Beragam:** Kontraktor menerima dokumen dalam berbagai format—mulai dari file CAD vektor (`.dxf`, `.svg`) hingga gambar pindaian/foto denah 2D (`.jpg`, `.png`) yang tidak memiliki *layer* terstruktur.
3. **Fluktuasi Harga Bahan Baku & Upah Tukang Antar Daerah:** Harga material utama (semen, besi beton, bata ringan, keramik, baja ringan) dan upah tenaga kerja (pekerja, tukang batu, tukang besi, kepala tukang, mandor) berbeda signifikan antara **Jakarta**, **Banten**, **Surabaya**, dan daerah lainnya. Mengubah harga daerah secara manual pada tabel RAB sering memicu ketidakakuratan margin.
4. **Keterputusan Antara Estimasi Awal (RAB/RAP) dan Pengawasan Lapangan:** Setelah RAB disepakati, *baseline* anggaran sering terkunci di file spreadsheet statis sehingga keterlambatan atau pembengkakan biaya (*overbudget*) di lapangan terlambat terdeteksi.

---

## 3. Tujuan Bisnis & Indikator Keberhasilan (*Business Objectives & KPIs*)

| ID | Tujuan Bisnis | Indikator Keberhasilan (KPI / Target Terukur) |
| :--- | :--- | :--- |
| **BO-01** | Mempercepat waktu ekstraksi volume pekerjaan (QTO) dari gambar kerja | Waktu pemrosesan rata-rata **< 200 ms** per dokumen (terukur: `47,06 ms` pada CAD `.svg` dan `166,98 ms` pada citra `.jpg`). |
| **BO-02** | Menjamin akurasi dan reliabilitas pembacaan dokumen gambar kerja | Tingkat keberhasilan pemrosesan (*pass rate*) **100%** pada dataset uji *hold-out* (`100/100` pada `cad/test` dan `50/50` pada `images/test`), serta error **0,0%** pada benchmark vektor standar (`A-101_Denah_Blok_M1.dxf`). |
| **BO-03** | Mengurangi beban verifikasi manual *Quantity Surveyor (QS)* | Menyaring otomatis 100% item dengan *confidence* **< 85%** ke dalam antrean *Flag AI (`Cek QS`)*, sehingga QS cukup memeriksa item yang ambigu. |
| **BO-04** | Otomasi penyesuaian harga proyek lintas daerah berbasis Excel | Akurasi *round-trip* **100% (`42/42` item)** untuk 7 Bahan Baku + 7 Upah Tukang di 3 daerah (**Jakarta**, **Banten**, **Surabaya**) dengan pembaruan RAB/RAP proyek secara *real-time*. |
| **BO-05** | Menjembatani *baseline* anggaran ke pengawasan biaya aktif | Sinkronisasi 1-klik dari tabel QTO ke database **Supabase PostgreSQL** (`projects` & `qto_items`) dan pemicuan otomatis peringatan deviasi **Agen Biaya Komander Core**. |

---

## 4. Pemangku Kepentingan & Persona Pengguna (*Stakeholders & User Personas*)

1. **Quantity Surveyor (QS) / Estimator Konstruksi (Pengguna Utama):**
   - Mengunggah gambar kerja (`.dxf`, `.svg`, `.jpg`, `.png`), memfilter item berstatus `Cek QS`, mengoreksi volume secara *inline*, dan memvalidasi perhitungan RAB/RAP.
2. **Procurement & Cost Control Manager:**
   - Mengunduh/mengunggah file Excel harga **Bahan Baku** & **Upah Tukang** per daerah (`Jakarta`, `Banten`, `Surabaya`), membandingkan kebutuhan volume material & hari kerja tukang (`OH`), serta memantau margin kotor proyek.
3. **Project Manager / Direktur Operasional:**
   - Mengaktifkan pemantauan proyek ke **Komander Core** dan menerima notifikasi peringatan dini (*WhatsApp Alert*) apabila realisasi pengeluaran lapangan melampaui *baseline* RAP.

---

## 5. Ruang Lingkup Proyek (*Project Scope*)

### A. Dalam Ruang Lingkup (*In-Scope*)
- Ekstraksi QTO otomatis jalur vektor CAD (`.dxf` via `ezdxf` dan `.svg` FloorPlanCAD) untuk 6 divisi pekerjaan standar konstruksi Indonesia (`STR-01`, `ARS-01`, `ARS-02`, `ARS-03`, `MEP-01`, `ATP-01`).
- Ekstraksi QTO otomatis jalur Computer Vision 2D (`.png` / `.jpg` via OpenCV *Adaptive Canny*, *Probabilistic Hough Transform*, dan *Morphological Contour Analysis*) beserta *visual overlay* garis dinding, kontur ruangan, dan kotak *Kop Gambar (Title Block)*.
- Pipeline pelatihan (`api/train_dataset.py`) pada `cad/train` (**3.760** SVG) & `images/train` (**503** JPG), serta pipeline validasi (`api/validate_model.py`) pada `cad/test` (**5.502** SVG) & `images/test` (**50** JPG).
- Antarmuka *Human-in-the-Loop QS Review* dengan filter *Flag AI* dan pengeditan volume *inline*.
- Fitur unduh & unggah Excel (`.xlsx` / `.csv`) untuk **3 daerah sampel (Jakarta, Banten, Surabaya)** maupun 1 matriks komparasi terpadu yang mencakup **7 Bahan Baku** dan **7 Upah Tukang (`OH`)** beserta penyesuaian otomatis ke RAB/RAP proyek.
- Integrasi penyimpanan ke **Supabase PostgreSQL** (dengan *fallback* lokal otomatis jika *offline*) dan simulasi peringatan **Agen Biaya Komander Core**.

### B. Di Luar Ruang Lingkup (*Out-of-Scope* untuk Fase Prototipe Saat Ini)
- Pemodelan BIM 3D penuh (`.ifc` / Revit native) dan analisis struktur elemen hingga (*Finite Element Analysis*).
- Integrasi pembayaran *procurement* langsung ke ERP/bank dan pengiriman pesan WhatsApp produksi melalui API Meta Business berbayar (saat ini disimulasikan di dalam dashboard).

---

## 6. Kebutuhan Fungsional (*Functional Requirements*)

| Kode | Modul | Deskripsi Kebutuhan Fungsional | Prioritas |
| :--- | :--- | :--- | :---: |
| **FR-01** | **Jalur A: CAD Vector Engine** | Sistem harus mampu menerima unggahan file `.dxf` dan `.svg`, mendeteksi skala/unit (`$INSUNITS` atau *auto-inferred* mm/cm/meter), serta menghitung panjang dinding (`ARS-01`), jumlah kolom (`STR-01`), luas lantai (`ARS-02`), bukaan pintu/jendela (`ARS-03`), dan titik MEP (`MEP-01`). | **Must-Have** |
| **FR-02** | **Jalur B: Computer Vision Engine** | Sistem harus mampu memproses citra denah `.jpg`/`.png` menggunakan OpenCV, menghasilkan citra *overlay* Base64 (garis dinding hijau, kontur ruangan, kotak oranye Kop Gambar), dan mengestimasi volume dinding (`ARS-01`), lantai (`ARS-02`), serta proyeksi atap (`ATP-01`). | **Must-Have** |
| **FR-03** | **Dataset Training & Studio** | Sistem harus menyediakan skrip kalibrasi (`api/train_dataset.py`) yang belajar dari `cad/train` dan `images/train`, serta menyediakan fitur **Dataset Train/Test Studio** di UI untuk menguji sampel dari `cad/test` dan `images/test` secara langsung. | **Must-Have** |
| **FR-04** | **Human-in-the-Loop QS Review** | Setiap item QTO dengan *confidence* `< 85%` harus diberi status `Cek QS`. Saat QS mengubah angka volume di tabel, status otomatis berubah menjadi `Verified (99.9%)` dan seluruh subtotal RAB/RAP dihitung ulang seketika. | **Must-Have** |
| **FR-05** | **Excel Harga Bahan Baku & Upah Tukang Daerah** | Pengguna harus dapat mengunduh 3 file Excel daerah (`Dataset_Harga_Jakarta.xlsx`, `Dataset_Harga_Banten.xlsx`, `Dataset_Harga_Surabaya.xlsx`) maupun file gabungan, mengunggah file Excel/CSV kustom, mengedit harga di tabel, serta melihat kebutuhan volume bahan & hari kerja tukang (`OH`) yang disesuaikan langsung ke RAB/RAP proyek. | **Must-Have** |
| **FR-06** | **Supabase Persistence & Komander Core Alert** | Sistem harus menyimpan data proyek dan rincian QTO ke tabel `projects` dan `qto_items` di Supabase PostgreSQL (dengan *fallback* lokal jika tanpa `.env`) serta menampilkan simulasi *WhatsApp Alert* deviasi biaya dari **Agen Biaya Komander Core**. | **Must-Have** |
| **FR-07** | **Validation & Benchmark Reporting** | Sistem harus menyediakan modul validasi (`api/validate_model.py` & `GET /api/validation/report`) yang menampilkan metrik akurasi dan latensi terukur di antarmuka pengguna. | **Should-Have** |

---

## 7. Kebutuhan Non-Fungsional (*Non-Functional Requirements*)

1. **NFR-01 (Kinerja & Latensi):** Ekstraksi QTO per dokumen harus selesai dalam waktu `< 1 detik` pada lingkungan lokal/serverless (capaian saat ini: rata-rata `47,06 ms` untuk CAD SVG dan `166,98 ms` untuk citra denah).
2. **NFR-02 (Keandalan & Offline Resilience):** Aplikasi wajib tetap berfungsi penuh menggunakan data *fallback* lokal (`DEFAULT_REGIONAL_DATA` & `FALLBACK_HSPK`) apabila koneksi ke Supabase PostgreSQL belum dikonfigurasi.
3. **NFR-03 (Keamanan File Dataset):** Endpoint pembacaan dataset (`/api/dataset/analyze`) wajib memvalidasi path dengan `_safe_join` untuk mencegah *directory traversal* di luar folder `cad/` dan `images/`.
4. **NFR-04 (Desain UI/UX):** Antarmuka mengadopsi sistem desain **Tactile Neo-Editorial Scrollytelling** (`uiux.md`) dengan ritme kontras *Alabaster* (`#f8f9fb`) ↔ *Carbon Ink* (`#0b0b0c`) ↔ *Sage Plaza* (`#b9c4bd`), tombol 3D *keycap*, bingkai `.zero-halo`, kartu 3D *flip*, dan *Floating Bottom Glass Dock*.
5. **NFR-05 (Kemudahan Deployment):** Arsitektur menggunakan pola **Hybrid Monorepo** (React + Vite di *frontend* dan Python FastAPI + `opencv-python-headless` + `ezdxf` + `openpyxl` di `/api`) yang siap di-*deploy* ke **Vercel**.

---

## 8. Aturan Bisnis & Formula Perhitungan (*Business Rules*)

1. **Perhitungan Luas Dinding (`ARS-01`):**
   $$\text{Luas Dinding } (\text{m}^2) = \text{Panjang Garis Vektor/Segmen Dinding } (\text{m}) \times 3,2\text{ m (Tinggi Standar)}$$
2. **Perhitungan Kebutuhan Bahan Baku & Upah Tukang Proyek:**
   $$\text{Volume Kebutuhan Item} = \text{Volume QTO Pos HSPK} \times \text{Koefisien Item}$$
   $$\text{Biaya Item Proyek} = \text{Volume Kebutuhan Item} \times \text{Harga Satuan Daerah}$$
3. **Penyesuaian Harga Satuan HSPK Daerah dari Excel:**
   - Ketika pengguna mengunggah Excel atau mengubah harga satuan **Bahan Baku (`MAT-*`)** maupun **Upah Tukang (`LAB-*`)**, sistem menghitung rasio rata-rata perubahan harga pada pos HSPK terkait terhadap *baseline* Jakarta dan menyesuaikan `rab_unit_price` serta `rap_unit_price` secara proporsional.
4. **Perhitungan Total RAB, Total RAP, dan Estimasi Margin Kotor:**
   $$\text{Total RAB} = \sum (\text{Volume}_i \times \text{Harga Satuan RAB}_i)$$
   $$\text{Total RAP} = \sum (\text{Volume}_i \times \text{Harga Satuan RAP}_i)$$
   $$\text{Margin Kotor (\%)} = \left(\frac{\text{Total RAB} - \text{Total RAP}}{\text{Total RAB}}\right) \times 100\%$$

---

## 9. Baseline Data Harga Daerah & Hasil Validasi Sistem

### A. Komparasi Biaya Proyek Standar (Blok M1 — Tipe 10m × 12m) Lintas Daerah
| Daerah | File Dataset Excel | Subtotal Bahan Baku Proyek | Subtotal Upah Tukang Proyek | Total RAP (Modal) | Total RAB (Tender) | Selisih vs Jakarta |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Jakarta** | `Dataset_Harga_Jakarta.xlsx` | Rp 90.665.300 | Rp 29.379.850 | Rp 139.586.000 | Rp 169.672.000 | Baseline (0,0%) |
| **Banten** | `Dataset_Harga_Banten.xlsx` | Rp 85.883.700 | Rp 26.039.150 | Rp 131.836.400 | Rp 160.348.800 | -5,5% (Hemat Rp 9,32 Jt) |
| **Surabaya** | `Dataset_Harga_Surabaya.xlsx` | Rp 82.576.170 | Rp 24.445.200 | Rp 126.259.600 | Rp 153.543.600 | -9,5% (Hemat Rp 16,13 Jt) |

### B. Ringkasan Metrik Validasi Hold-Out (`api/validation_report.json`)
- **Synthetic CAD Benchmark (`A-101_Denah_Blok_M1.dxf`):** **PASS (5/5 item · Error 0,0%)**.
- **CAD Hold-Out Test (`cad/test` — 100 sampel dari 5.502 file SVG, dilatih pada 3.760 file `cad/train`):** **100/100 PASS (100,0%)**, rata-rata waktu eksekusi **`47,06 ms`**.
- **Vision Hold-Out Test (`images/test` — 50 file JPG, dilatih pada 503 file `images/train`):** **50/50 PASS (100,0%)**, rata-rata waktu eksekusi **`166,98 ms`**.
- **Vision Blind Ground-Truth Benchmark (19 denah berlabel tanpa *hint* nama file):** **Median Absolute Error `39,80 m²`**, **MAPE `42,82%`**, dengan akurasi dalam toleransi ±35% sebesar **`42,11%`**.

---

## 10. Risiko Bisnis & Strategi Mitigasi (*Risks & Mitigation*)

| Risiko | Dampak | Strategi Mitigasi pada Sistem |
| :--- | :---: | :--- |
| Gambar pindaian denah 2D (`.jpg`/`.png`) tidak mencantumkan skala eksplisit atau memiliki *noise* garis dimensi | Tinggi | Sistem memberikan skor kepercayaan `< 85%` dan menandai baris sebagai `Cek QS` (*Human-in-the-Loop*) agar diverifikasi manual oleh QS sebelum dikunci ke database. |
| Penamaan layer pada file CAD eksternal tidak mengikuti standar `A-WALL` / `S-COLUMN` | Sedang | Mesin CAD membaca baik layer standar, atribut `semantic-id` (FloorPlanCAD), maupun fallback geometri `LINE`/`LWPOLYLINE` dengan penandaan otomatis `Cek QS`. |
| Perbedaan format kolom saat pengguna mengunggah file Excel harga daerah | Sedang | Parser Excel (`_ingest_rows_into_regional_data`) mendukung baik format *long* (kolom `region` + `unit_price`) maupun format *wide* (kolom berdampingan `Jakarta`, `Banten`, `Surabaya`), serta menyediakan 3 template Excel daerah siap unduh. |
