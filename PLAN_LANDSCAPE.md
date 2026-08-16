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

1. **Dua panel (side-by-side)**, pola seperti laptop/trackpad remote:
   - Kiri: StatusBar (slim) + ShortcutsBar + **Touchpad** (tinggi penuh).
   - Kanan: TypingPreview (jika aktif) + **Keyboard** (tinggi penuh).
2. **Tinggi adalah sumber daya langka**: semua chrome vertikal harus
   dipangkas; keyboard memakai tombol yang lebih pendek via `clamp()`.
3. **Tanpa mengunci orientasi**: biarkan PWA mengikuti rotasi perangkat dan
   switch layout via CSS media query (`orientation: landscape`).
4. **Tanpa mengubah logika Touchpad**: delta-based, cukup atur ukuran/posisi.

## 3. Rencana Implementasi

### Fase 1 — Layout dua panel (CSS murni, `mobile/src/index.css`)
- Tambah media query `@media (orientation: landscape)`:
  - `.app` → `flex-direction: row` (atau `grid` dua kolom).
  - Kolom kiri (StatusBar + ShortcutsBar + Touchpad) = `flex: 1 1 50%`,
    `flex-direction: column`.
  - Kolom kanan (TypingPreview + `keyboard-wrap`) = `flex: 1 1 50%`,
    `flex-direction: column`, `justify-content: flex-end`.
  - Touchpad: `min-height: 120px` (cukup untuk gesture vertikal), hapus
    margin bawah, tetap `flex: 1`.
- Wrapping div baru (atau class) di `App.tsx` agar StatusBar/Touchpad berada
  di kolom kiri dan keyboard di kolom kanan — **restrukturisasi ringan JSX**,
  tanpa mengubah komponen keyboard/touchpad itu sendiri.
- Safe-area: gunakan `env(safe-area-inset-left/right)` untuk notch di sisi.

### Fase 2 — Skala keyboard & chrome kompak
- Di landscape, set ulang variabel ukuran:
  - `--key-height: clamp(30px, 9dvh, 42px)` dan `--key-font` mengecil
    (`clamp(12px, 2.5dvh, 15px)`), gap antar baris dipangkas.
- TypingPreview: di landscape tampil sebagai bar tipis di atas keyboard
  kolom kanan (bukan selebar layar), tetap collapsible.
- Toolbar keyboard: label chip bisa dipersingkat di landscape bila sempit.

### Fase 3 — Polesan & pengaturan opsional
- Tambah **pengaturan "Kunci orientasi"** (opsional): `portrait` / `landscape`
  / `auto`, diterapkan via CSS `html[data-orientation='...']` + meta tag
  pengunci jika perlu (via `screen.orientation.lock()` saat supported).
- Validasi touchpad: pastikan area masih cukup untuk pan/scroll 2 jari dan
  pinch (pinch butuh ruang ~ lebih dari threshold 24px) di tinggi minimal.
- ShortcutsBar di landscape: bisa pindah ke atas kolom kiri agar tidak
  menyita tinggi touchpad.

## 4. Verifikasi

- Build + lint: `npm run lint` dan `npm run build` (mobile).
- Manual di perangkat (atau DevTools device emulation):
  1. Putar ke landscape → dua panel tampil, touchpad dan keyboard keduanya
     berfungsi.
  2. Gesture: scroll 2 jari, geser 2 jari (kembali/maju), cubit zoom.
  3. TypingPreview & ShortcutsBar tampil wajar.
  4. Kembali ke portrait → layout kembali seperti sebelumnya.
  5. Cek safe-area (notch) di kedua orientasi.

## 5. Risiko & Catatan

- **Bukan split-keyboard thumb** seperti keyboard HP: aplikasi ini adalah
  remote trackpad+kboard, jadi dua panel (touchpad kiri, keyboard kanan)
  adalah tujuannya, bukan keyboard terbelah.
- **Browser UI landscape**: pada iOS/Android `100dvh` mengikuti area aplikasi;
  perlu dicek di perangkat nyata (browser biasa vs PWA standalone).
- **QR scanner / ConnectScreen** di landscape: kamera bekerja normal, hanya
  perlu memastikan tata letaknya tetap terpusat (minor).
- Jika muncul kesulitan layout yang rumit, fallback-nya: kunci ke portrait
  via manifest (`orientation: 'portrait'`) + layar pemberitahuan "putar ke
  portrait" — tetapi **rekomendasi utama adalah mendukung landscape dua
  panel** karena landscape sangat umum saat mengetik dengan dua tangan.