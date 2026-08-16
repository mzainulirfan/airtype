# Plan: Layout Landscape untuk Aplikasi Mobile AirType

Dokumen ini berisi analisis dan rencana implementasi agar aplikasi mobile
berfungsi dengan baik dalam orientasi **landscape** (horizontal), selain
portrait yang sudah berjalan.

## 1. Kondisi Saat Ini

- **Manifest PWA** (`mobile/vite.config.ts`): TIDAK ada field `orientation`,
  jadi PWA secara teknis sudah boleh landscape — namun layout-nya tidak
  diadaptasi sama sekali, sehingga praktis "hanya portrait yang terpakai".
- **Struktur layout** (`mobile/src/index.css`):
  - `.app` = `display:flex; flex-direction:column; height:100dvh`.
  - Urutan vertikal: StatusBar → TypingPreview (opsional) → ShortcutsBar →
    Touchpad (`flex:1 1 auto; min-height:90px`) → `keyboard-wrap`
    (`flex:0 0 auto`) yang berisi toolbar (ABC | ?123 | PC) + baris tombol.
- **Keyboard**: 3 baris huruf + baris bawah (Ctrl Alt Win Space Enter),
  tinggi tombol `--key-height` = 46px (small 40 / large 56).
- **Touchpad**: logika pointer berbasis **delta** (bukan absolut), sehingga
  arah rotasi tidak merusak fungsinya — hanya bentuk area yang berubah.

## 2. Analisis Landscape

Kendala utama di landscape adalah **tinggi layar sempit** (mis. ~360–420px
CSS, dikurangi notch/safe-area) sementara lebar melimpah. Masalah spesifik
dengan layout vertikal saat ini:

| Aspek | Masalah di landscape |
| --- | --- |
| `.app` kolom vertikal | Membuang lebar; touchpad jadi pipih pendek, kurang ergonomis untuk gerak vertikal/gesture 2 jari |
| `--key-height` 46px | Keyboard vertikal ~230px+ menghabiskan sebagian besar tinggi, sisa untuk touchpad sempit |
| StatusBar + TypingPreview | Semua chrome vertikal menggerus tinggi touchpad |
| ShortcutsBar horizontal | Oke, tapi posisinya di atas touchpad menyita tinggi |

### Prinsip desain untuk landscape

1. **Satu mode dalam satu layar** (hasil iterasi pengguna): alih-alih dua panel
   touchpad+keyboard yang terasa sempit, landscape punya **dua mode penuh**:
   - **Mode Keyboard** — keyboard full-screen seperti keyboard asli.
   - **Mode Mouse (touchpad)** — touchpad full-screen.
2. **Tombol ganti mode** (Keyboard ↔ Mouse) hanya muncul di **landscape**.
3. **Tanpa mengunci orientasi**: PWA mengikuti rotasi, switch layout via CSS
   media query (`orientation: landscape`) + class mode di `.app`.
4. **Tanpa mengubah logika Touchpad**: delta-based, cukup atur ukuran/posisi.

## 3. Rencana Implementasi (terbaru)

### Fase 1 — Layout grid + mode full-screen (dilakukan)
- `.app` diubah jadi **CSS grid** dengan `grid-template-areas`; urutan portrait
  tidak berubah (`status / typing / shortcuts / touchpad / keyboard`).
- Landscape memakai class mode:
  - `.app.landscape-keyboard` → area `status` + `keyboard` (keyboard full),
    elemen lain (`touchpad`, `shortcuts-bar`, `typing-preview`) di-hide.
  - `.app.landscape-touchpad` → area `status` + `shortcuts` + `touchpad`,
    keyboard & typing-preview di-hide.
- **Tombol mode** di StatusBar (`.mode-toggle`), `display:none` di portrait,
    muncul di landscape; label berisi mode tujuan (Mouse/Keyboard).

### Fase 2 — Skala keyboard & chrome kompak (dilakukan)
- Mode keyboard: `--key-height: clamp(38px, 11dvh, 52px)` dan `--key-font`
  mengecil sesuai `dvh`, keyboard di-centre agar seperti keyboard asli.
- Mode touchpad: touchpad `min-height: 120px`, shortcut bar tetap di atas.
- TypingPreview disembunyikan di landscape (agar layar penuh).

### Fase 3 — Polesan & pengaturan opsional (belum)
- Tambah **pengaturan "Kunci orientasi"** (opsional): `portrait` / `landscape`
  / `auto`, diterapkan via `html[data-orientation='...']` + meta tag pengunci
  jika perlu (via `screen.orientation.lock()` saat supported).
- Validasi gesture touchpad (pan/scroll 2 jari, pinch) di kedua mode.
- Cek safe-area (notch) di kedua orientasi.

## 4. Verifikasi

- Build + lint: `npm run lint` dan `npm run build` (mobile).
- Manual di perangkat (atau DevTools device emulation):
  1. Putar ke landscape → mode Keyboard full-screen tampil.
  2. Tombol ganti mode muncul; tap → mode Mouse (touchpad full), tap lagi →
     kembali Keyboard.
  3. Gesture di mode Mouse: scroll 2 jari, geser 2 jari (kembali/maju), cubit
     zoom.
  4. Kembali ke portrait → layout portrait normal (tombol mode tersembunyi).
  5. Cek safe-area (notch) di kedua orientasi.

## 5. Risiko & Catatan

- **Bukan split-keyboard thumb** seperti keyboard HP: mode keyboard adalah
  keyboard penuh satu kolom (bukan terbelah).
- **Browser UI landscape**: pada iOS/Android `100dvh` mengikuti area aplikasi;
  perlu dicek di perangkat nyata (browser biasa vs PWA standalone).
- **QR scanner / ConnectScreen** di landscape: kamera bekerja normal, hanya
  perlu memastikan tata letaknya tetap terpusat (minor).
- Jika muncul kesulitan layout yang rumit, fallback-nya: kunci ke portrait
  via manifest (`orientation: 'portrait'`) + layar pemberitahuan "putar ke
  portrait" — tetapi **rekomendasi utama adalah mendukung landscape dua mode
  penuh** karena landscape sangat umum saat mengetik dengan dua tangan.