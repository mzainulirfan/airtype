# Review Desain Aplikasi Keyboard & Mouse Remote

## Ringkasan

Secara fungsi, desain aplikasi sudah cukup jelas. Pengguna dapat memahami bahwa aplikasi ini menggabungkan **keyboard, shortcut, dan touchpad** untuk mengontrol PC.

Namun dari sisi **UI, UX, dan ergonomi**, tampilannya masih terasa seperti semua fitur diletakkan dalam satu layar tanpa prioritas yang cukup kuat.

**Penilaian keseluruhan: 7/10**

Fondasinya sudah baik, terutama karena fungsi utama dapat digunakan tanpa berpindah halaman. Area yang paling perlu diperbaiki adalah:

- Hierarki layar
- Kepadatan shortcut
- Desain touchpad
- Ergonomi keyboard
- Konsistensi copywriting
- Informasi koneksi

---

## 1. Hal yang Sudah Bagus

Beberapa bagian yang sudah bekerja dengan baik:

- Status **Terhubung** mudah ditemukan.
- Indikator hijau cukup jelas untuk menunjukkan koneksi aktif.
- Tombol **Pause** dan **Putus** mudah ditemukan.
- Shortcut seperti `Ctrl+C`, `Ctrl+V`, `Alt+Tab`, dan lainnya membantu penggunaan PC.
- Area touchpad cukup besar.
- Keyboard menggunakan pola QWERTY yang familiar.
- Terdapat petunjuk gesture pada touchpad.
- Warna keseluruhan cukup tenang untuk penggunaan dalam waktu lama.

---

# 2. Masalah Utama

## 2.1 Area Atas Terlalu Padat

Pada bagian atas terdapat:

- Status koneksi
- Settings
- Pause
- Putus
- Preview ketikan
- Banyak shortcut

Akibatnya, sebelum sampai ke touchpad pengguna sudah melewati banyak elemen.

### Rekomendasi Hierarki

Urutan prioritas sebaiknya:

```text
Status koneksi
↓
Touchpad / Keyboard
↓
Shortcut tambahan
```

Shortcut sebaiknya menjadi fungsi sekunder, bukan mengambil area yang terlalu besar.

---

# 3. Preview Ketikan

Bagian **Preview Ketikan** cukup besar dibandingkan manfaatnya.

Dalam penggunaan nyata, pengguna kemungkinan besar akan melihat hasil ketikan langsung pada monitor PC.

### Rekomendasi

Buat preview menjadi lebih kecil.

Contoh:

```text
Typing Preview
Halo, ini contoh teks...                         ×
```

Alternatif lain:

- Preview dapat disembunyikan.
- Tambahkan pengaturan:

```text
Settings
└── Show Typing Preview
```

Dengan demikian pengguna yang tidak membutuhkan preview dapat memperoleh ruang layar tambahan.

---

# 4. Shortcut Keyboard

Saat ini banyak shortcut langsung ditampilkan:

```text
Ctrl+A
Ctrl+C
Ctrl+X
Ctrl+V
Ctrl+Z

Ctrl+Y
Tab
Alt+Tab
Win+Tab
Esc

Ctrl+S
Ctrl+F
Ctrl+W
```

Secara fungsi ini bagus, tetapi secara visual membuat halaman terlihat seperti dashboard tombol.

## Rekomendasi

Tampilkan hanya shortcut yang paling sering digunakan.

Contoh:

```text
Esc   Ctrl+C   Ctrl+V   Alt+Tab   Ctrl+Z   •••
```

Tombol `•••` dapat membuka **Bottom Sheet** berisi seluruh shortcut.

Contoh:

```text
Shortcuts

Clipboard
- Ctrl+A
- Ctrl+C
- Ctrl+X
- Ctrl+V

Window
- Alt+Tab
- Win+Tab
- Ctrl+W

Editing
- Ctrl+Z
- Ctrl+Y
- Ctrl+S
- Ctrl+F
```

Keuntungan:

- UI lebih bersih.
- Touchpad mendapat lebih banyak ruang.
- Pengguna tetap dapat mengakses semua shortcut.

---

# 5. Touchpad

Bagian touchpad merupakan area yang paling perlu diperbaiki.

Saat ini terdapat:

- Area touchpad putih.
- Scrollbar vertikal.
- Scrollbar horizontal.
- Instruksi panjang di tengah.

Secara visual, touchpad terlihat seperti **scroll container** atau komponen spreadsheet.

Padahal seharusnya touchpad terasa seperti trackpad laptop.

## Rekomendasi Desain Touchpad

Gunakan satu surface besar.

Contoh:

```text
┌──────────────────────────────┐
│                              │
│                              │
│           TOUCHPAD           │
│                              │
│                              │
│  Tap: klik · 2 jari: scroll │
│                              │
└──────────────────────────────┘
```

Tidak perlu menampilkan scrollbar permanen.

---

# 6. Gesture Touchpad

Gunakan gesture yang familiar seperti trackpad laptop.

| Gesture | Fungsi |
|---|---|
| 1 jari geser | Gerakkan cursor |
| 1 jari tap | Klik kiri |
| Double tap | Double click |
| 2 jari tap | Klik kanan |
| 2 jari geser | Scroll |
| Tap + tahan | Drag |
| Pinch | Zoom, opsional |

Dengan pola ini pengguna tidak perlu mempelajari interaksi khusus.

---

# 7. Petunjuk Gesture

Saat ini terdapat teks:

```text
Geser = kursor · Ketuk = klik · 2 jari = scroll/klik kanan · Tahan = drag
```

Informasinya berguna, tetapi cukup panjang untuk ditampilkan terus-menerus.

## Rekomendasi

Gunakan teks yang lebih singkat:

```text
1 jari: cursor · 2 jari: scroll · Hold: drag
```

Atau cukup tampilkan tombol:

```text
?
```

Ketika ditekan, tampilkan Bottom Sheet:

```text
Cara Menggunakan Touchpad

1 jari geser
Gerakkan cursor

Tap
Klik kiri

2 jari geser
Scroll

2 jari tap
Klik kanan

Tap + tahan
Drag
```

Petunjuk lengkap juga dapat ditampilkan pada first-time onboarding.

---

# 8. Keyboard

Keyboard saat ini cukup familiar, tetapi tombol terlihat relatif kecil karena layar harus membagi ruang dengan:

- Shortcut
- Preview
- Touchpad
- Keyboard

Ini dapat meningkatkan risiko typo ketika mengetik cepat.

## Rekomendasi Layout

Contoh:

```text
Q W E R T Y U I O P
 A S D F G H J K L
  ⇧ Z X C V B N M ⌫

Ctrl  Alt  Win       Space       Enter
```

### Shift

Daripada:

```text
Shift
```

lebih baik:

```text
⇧
```

Keuntungan:

- Lebih familiar.
- Menghemat ruang.
- Lebih mirip keyboard fisik.

---

# 9. Baris Bawah Keyboard

Saat ini terdapat tombol seperti:

```text
Fn
?123
,
Space
.
Enter
```

Untuk aplikasi remote keyboard PC, tombol seperti `Ctrl`, `Alt`, dan `Win` kemungkinan lebih penting.

## Rekomendasi

Contoh:

```text
Ctrl   Alt   Win        Space        Enter
```

Untuk mode tertentu dapat ditambahkan:

```text
←   ↓   ↑   →
```

---

# 10. Mode Keyboard

Pertimbangkan dua mode:

```text
Keyboard | PC Keys
```

## Mode Keyboard

Digunakan untuk mengetik.

```text
Q W E R T Y U I O P
 A S D F G H J K L
  ⇧ Z X C V B N M ⌫
Ctrl Alt Win    Space    Enter
```

## Mode PC Keys

Digunakan untuk navigasi dan kontrol Windows.

Contoh:

```text
Esc
F1 F2 F3 F4

Ctrl
Alt
Win
Tab

Home
End
PgUp
PgDn

←
↑
↓
→
```

Ini membuat aplikasi lebih fleksibel tanpa memenuhi satu layar dengan terlalu banyak tombol.

---

# 11. Status Koneksi

Saat ini:

```text
● Terhubung        ⚙ Pause Putus
```

Informasi ini bisa dibuat lebih informatif.

Contoh:

```text
● Desktop-PC
  Terhubung

                       ⏸   ⚙   ⋮
```

Dengan menampilkan nama PC, pengguna langsung mengetahui perangkat mana yang sedang dikontrol.

---

# 12. Tombol Putus

Tombol **Putus** berwarna merah cukup dominan.

Padahal disconnect merupakan tindakan yang:

- Relatif jarang digunakan.
- Bisa mengganggu jika tidak sengaja ditekan.

## Rekomendasi

Pindahkan ke menu:

```text
⋮
```

Isi:

```text
Connection Info
Reconnect
Disconnect
```

Alternatifnya tetap tampilkan tombol Disconnect tetapi dengan ukuran yang lebih kecil.

---

# 13. Session ID

Saat ini terdapat informasi:

```text
Sesi: airtype:session:07d81d
```

Informasi seperti ini terlalu teknis untuk layar utama.

## Rekomendasi

Pindahkan ke:

```text
Settings
└── Connection Info
```

Contoh:

```text
Connection Info

Device
Desktop-PC

Status
Connected

Session ID
airtype:session:07d81d
```

Pada halaman utama cukup tampilkan:

```text
Connected to Desktop-PC
```

---

# 14. Copywriting

Gunakan satu bahasa secara konsisten.

Saat ini terdapat campuran istilah Indonesia dan Inggris.

## Jika Menggunakan Bahasa Indonesia

Gunakan:

```text
Pratinjau Ketikan
Jeda
Putuskan
Pengaturan
Terhubung
Hapus
```

Contoh copy:

**Pratinjau Ketikan**

```text
Teks yang Anda ketik akan muncul di sini.
```

---

## Jika Menggunakan Bahasa Inggris

Gunakan:

```text
Typing Preview
Pause
Disconnect
Settings
Connected
Clear
```

Pilih salah satu bahasa sebagai bahasa utama.

---

# 15. Struktur Layar yang Direkomendasikan

Contoh layout:

```text
┌────────────────────────────────┐
│ ● Desktop-PC             ⚙  ⋮ │
│   Terhubung                    │
├────────────────────────────────┤
│ Esc  Ctrl+C Ctrl+V Alt+Tab •••│
├────────────────────────────────┤
│                                │
│                                │
│           TOUCHPAD             │
│                                │
│   2 jari scroll · Tap klik     │
│                                │
│                                │
├────────────────────────────────┤
│ Keyboard               PC Keys │
│                                │
│ q  w  e  r  t  y  u  i  o  p │
│  a  s  d  f  g  h  j  k  l   │
│ ⇧ z  x  c  v  b  n  m      ⌫ │
│ Ctrl Alt Win    SPACE     Enter│
└────────────────────────────────┘
```

---

# 16. Prioritas Redesign

## Prioritas Tinggi

1. Hilangkan scrollbar pada touchpad.
2. Jadikan touchpad sebagai area utama.
3. Kurangi jumlah shortcut yang selalu terlihat.
4. Perbesar target sentuh tombol keyboard.
5. Pindahkan Session ID dari halaman utama.

## Prioritas Menengah

6. Buat mode `Keyboard` dan `PC Keys`.
7. Gunakan gesture touchpad standar.
8. Ringkas petunjuk gesture.
9. Tampilkan nama PC pada status koneksi.
10. Pindahkan Disconnect ke menu sekunder.

## Prioritas Rendah

11. Tambahkan onboarding gesture.
12. Tambahkan opsi untuk menyembunyikan Typing Preview.
13. Tambahkan shortcut favorit yang bisa dikustomisasi.

---

# 17. Kesimpulan

Desain saat ini sudah memiliki fondasi yang cukup baik dan fitur yang relevan untuk aplikasi remote keyboard + mouse.

Masalah utamanya bukan kurangnya fitur, tetapi **terlalu banyak fitur yang memiliki bobot visual hampir sama**.

Fokus redesign sebaiknya pada:

- Touchpad sebagai fungsi utama.
- Keyboard yang lebih ergonomis.
- Shortcut sebagai fungsi sekunder.
- Status koneksi yang lebih informatif.
- Menghilangkan informasi teknis dari layar utama.
- Mengurangi visual noise.

Dengan perubahan tersebut, aplikasi akan terasa lebih seperti **perangkat input PC yang memang dirancang khusus untuk mobile**, bukan sekadar kumpulan tombol kontrol dalam satu halaman.
