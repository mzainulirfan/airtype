# Product Requirements Document

# AirType

**Tagline:** Jadikan Smartphone Keyboard Nirkabel untuk Desktop.  
**Version:** 1.0  
**Status:** Draft  
**Tanggal:** 2026-08-12  
**Bahasa:** Indonesia

---

## 1. Executive Summary

AirType adalah aplikasi yang mengubah smartphone menjadi keyboard nirkabel untuk desktop Windows. User membuka web app/PWA di HP, melakukan pairing dengan Desktop Helper memakai kode sesi (dan QR), lalu setiap tombol yang ditekan di layar HP langsung dikirim dan disimulasikan sebagai keystroke asli di desktop — lengkap dengan modifier seperti Shift, Ctrl, Alt, dan special keys seperti Tab, Enter, Backspace, serta tombol panah.

Berbeda dengan aplikasi remote keyboard lain, AirType mengirimkan **key event** (key down / key up) yang replikatif terhadap keyboard fisik, bukan sekadar mengetik teks. Ini membuat AirType kompatibel dengan aplikasi apa pun: Notepad, Excel, browser, POS, ERP, dan bahkan aplikasi yang membutuhkan kombinasi tombol (Ctrl+C, Ctrl+V, Alt+Tab).

Komunikasi realtime memakai Supabase Realtime Broadcast. Tidak ada backend custom, tidak ada NodeJS server, tidak ada business logic di server. Data hanya di-relay sesaat, tidak disimpan permanen di cloud.

| Area | Keputusan |
| --- | --- |
| Mobile | React, Vite, TypeScript, PWA |
| Desktop | Tauri, Rust, Enigo (key press/release) |
| Realtime Relay | Supabase Realtime Broadcast |
| Auth | Supabase Anonymous Authentication |
| Frontend Hosting | Vercel |
| Desktop Distribution | Tauri Installer (NSIS/MSI) |

Contoh penggunaan:

1. User membuka Desktop Helper AirType.
2. Desktop membuat sesi pairing dan menampilkan kode sesi + QR.
3. HP membuka `https://airtype.app/connect` dan memasukkan kode (atau scan QR).
4. Desktop menunjukkan status connected.
5. User menekan tombol `A` lalu `Enter` di layar HP.
6. Desktop menerima key event dan menekan `A` + `Enter` di aplikasi yang sedang fokus.

---

## 2. Background

Banyak situasi di mana keyboard fisik tidak praktis atau tidak tersedia:

| Situasi | Masalah |
| --- | --- |
| Smart TV / PC media | Input teks memakai remote sangat lambat |
| POS / kasir tablet | Keyboard fisik memakan tempat |
| Demo / presentasi | Perlu mengetik dari jarak jauh |
| PC shared / kantor | Keyboard rusak atau terbatas jumlahnya |
| Remote control aplikasi | Butuh input keyboard ke aplikasi yang sedang aktif |
| Input berkala | User kadang hanya perlu mengetik sesekali, tidak mau keyboard menempati meja |

Smartphone sudah dimiliki hampir semua user dan memiliki layar sentuh yang bisa dijadikan keyboard virtual. AirType memanfaatkan perangkat yang sudah ada tanpa membeli hardware tambahan.

---

## 3. Problem Statement

User membutuhkan cara cepat untuk memasukkan keystroke ke desktop dari jarak jauh tanpa keyboard fisik.

| Masalah | Penjelasan |
| --- | --- |
| Keyboard fisik tidak selalu ada | Lupa bawa, rusak, atau tidak praktis dipindah |
| Remote app biasa hanya mengetik teks | Tidak bisa kirim Enter, Tab, Shift, Ctrl, kombinasi tombol |
| Aplikasi target beragam | Banyak aplikasi tidak punya API; input keyboard adalah bahasa universal |
| Setup kompleks | Remote desktop / RDP terlalu berat untuk sekadar mengetik |
| Latensi | Keyboard virtual harus terasa responsif |

Pernyataan masalah:

> Bagaimana memungkinkan user mengetik ke desktop dari smartphone seolah-olah menggunakan keyboard fisik, termasuk special keys dan kombinasi modifier?

---

## 4. Goals

| Goal | Deskripsi |
| --- | --- |
| Keyboard universal | Semua keystroke masuk ke aplikasi aktif desktop |
| Fidelity keyboard fisik | Key down/key up asli + modifier + special keys |
| Setup sederhana | Desktop install satu helper, HP cukup buka web |
| Realtime | Latensi rendah dari ketukan ke layar |
| Aman | Keystroke tidak disimpan permanen di cloud |

---

## 5. Non Goals

| Non Goal | Alasan |
| --- | --- |
| Backend custom / NodeJS server | Arsitektur final memakai Supabase Realtime |
| REST API di MVP | Semua komunikasi via Realtime Broadcast |
| Menyimpan keystroke permanen di cloud | Risiko privasi tinggi |
| Clipboard sync lintas device | Bisa jadi fitur masa depan, bukan MVP |
| Mouse / trackpad virtual | Di luar lingkup keyboard |
| Game controller / macros | Di luar lingkup MVP |
| Mobile native app | MVP berbasis PWA agar tanpa install |

---

## 6. Product Vision

> Setiap smartphone bisa menjadi keyboard nirkabel untuk desktop apa pun, tanpa kabel, tanpa driver, hanya dengan scan/ketik kode.

---

## 7. Success Metrics

| Metric | Target MVP | Cara Ukur |
| --- | --- | --- |
| Time to first keystroke | < 5 menit | Dari install desktop sampai teks muncul di Notepad |
| Key delivery success | >= 99% | Keystroke diterima desktop / dikirim mobile |
| Keyboard fidelity | 100% untuk MVP keys | Modifier + special keys benar di aplikasi target |
| End-to-end latency | < 300 ms (target < 150 ms teks murni) | Ketukan sampai key ter-input |
| Crash-free session | 1.000 keystroke berturut-turut | Stress test |
| Pairing success rate | >= 95% | Kode sesi berhasil connect |

Contoh metrik event lokal:

```json
{
  "event": "key_received",
  "sessionId": "4d8e7f85...",
  "latencyMs": 120,
  "success": true
}
```

---

## 8. Target Users

| Segment | Kebutuhan | Contoh Skenario |
| --- | --- | --- |
| Home user | Mengetik di smart TV/PC dari sofa | Chat, pencarian YouTube |
| Kasir / POS | Input cepat ke POS | Mengetik kode, jumlah, diskon |
| Presenter / demos | Mengetik dari jarak jauh | Slide, live demo |
| Kantor shared PC | Keyboard rusak / terbatas | Input form, spreadsheet |
| Power user | Kombinasi shortcut | Ctrl+C/V, Alt+Tab, shortcut ERP |

---

## 9. User Stories

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| US-001 | Sebagai user, saya ingin mengetik huruf/angka dari HP agar muncul di field aktif desktop. | Karakter muncul di aplikasi aktif. |
| US-002 | Sebagai user, saya ingin menekan Enter/Tab/Backspace agar berfungsi seperti keyboard fisik. | Perilaku special keys sesuai konteks aplikasi. |
| US-003 | Sebagai power user, saya ingin kombinasi Shift/Ctrl/Alt agar shortcut berfungsi. | Ctrl+C menyalin, Alt+Tab berpindah window. |
| US-004 | Sebagai user baru, saya ingin pairing pakai kode/QR agar tidak konfigurasi manual. | Kode/QR membuka mobile keyboard dengan sesi benar. |
| US-005 | Sebagai user, saya ingin status koneksi terlihat agar tahu keyboard siap dipakai. | Status connected/reconnecting terlihat di kedua sisi. |
| US-006 | Sebagai user, saya ingin reconnect otomatis saat koneksi terputus. | Koneksi pulih tanpa refresh manual. |

---

## 10. Functional Requirements

### Desktop

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-D-001 | Desktop berjalan sebagai tray application. | App tetap aktif ketika window ditutup. |
| FR-D-002 | Desktop membuat session pairing. | Session baru dibuat saat dimulai/di-regenerate. |
| FR-D-003 | Desktop subscribe ke channel Supabase. | Desktop menerima key event dari channel sesi. |
| FR-D-004 | Desktop menampilkan kode pairing + QR. | QR berisi URL connect dengan session. |
| FR-D-005 | Desktop menerima key event. | Key down/up dan modifier valid diproses. |
| FR-D-006 | Desktop mensimulasikan key press/release. | Enigo key_down + key_up sesuai event. |
| FR-D-007 | Desktop mendukung kombinasi modifier. | Shift/Ctrl/Alt dimasukkan ke state sebelum key. |
| FR-D-008 | Desktop menangani special keys. | Enter, Tab, Backspace, Delete, Space, Home, End, PageUp/Down, Arrow* terpetakan. |
| FR-D-009 | Desktop menyediakan history lokal. | Riwayat keystroke/teks terlihat di UI desktop. |
| FR-D-010 | Desktop auto reconnect. | Subscribe ulang setelah koneksi pulih. |
| FR-D-011 | Desktop punya mode pause. | Satu klik menghentikan input agar aman saat tidak dipakai. |

### Mobile

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-M-001 | User membuka PWA. | Halaman utama tampil dari browser mobile. |
| FR-M-002 | Mobile membaca/menerima session. | Kode sesi dari URL atau input dipakai untuk channel. |
| FR-M-003 | Mobile menampilkan layout QWERTY penuh. | Huruf, angka, dan baris simbol tampil. |
| FR-M-004 | Mobile menampilkan special keys. | Tab, Enter, Backspace, Delete, Space, Home, End, PgUp, PgDn, Arrow* tersedia. |
| FR-M-005 | Mobile menampilkan modifier keys. | Shift, Ctrl, Alt, dan (opsional) Win/Cmd. |
| FR-M-006 | Mobile mengirim key down/up. | Event `key_down` dan `key_up` terkirim ke Supabase. |
| FR-M-007 | Mobile mendukung mode teks (fast path). | Karakter tanpa modifier dibundel agar latensi rendah. |
| FR-M-008 | Mobile memberi feedback. | Visual highlight pada tombol yang ditekan; vibrate opsional. |
| FR-M-009 | Mobile menjaga screen awake. | Layar tidak mati selama keyboard aktif. |
| FR-M-010 | Mobile menampilkan status session. | Connected, reconnecting, disconnected terlihat. |
| FR-M-011 | Mobile mode paused. | Semua input diabaikan sampai user resume. |

---

## 11. Non Functional Requirements

| Kategori | Requirement | Target |
| --- | --- | --- |
| Startup desktop | App siap dipakai | < 2 detik |
| RAM desktop | Ringan untuk PC lama | < 80 MB |
| Latency | Key-to-screen | < 300 ms; teks murni < 150 ms |
| Keystroke throughput | Stabil | Minimal 10 keystroke/detik tanpa kehilangan |
| Availability | Desktop tahan lama | 24 jam aktif |
| Browser support | Chrome Android, Safari iOS terbaru | WebSockets + PWA |
| Reliability | Stress test | 1.000 keystroke tanpa crash |
| Privacy | Data keyboard | Tidak disimpan permanen di cloud |

---

## 12. System Architecture

AirType menggunakan arsitektur client-to-client melalui Supabase Realtime Broadcast — sama seperti ScanBridge.

```
+------------------+        +--------------------------+        +------------------+
| Mobile PWA       |        | Supabase Realtime Relay  |        | Desktop Helper   |
| React + QWERTY   | <----> | Broadcast Channel        | <----> | Tauri + Rust     |
| Anonymous Client |        | No Business Logic        |        | Enigo Keys       |
+------------------+        +--------------------------+        +------------------+
```

Keputusan utama:

| Keputusan | Alasan | Trade-off |
| --- | --- | --- |
| Supabase Realtime | Tanpa backend custom | Bergantung layanan cloud |
| Channel per session | Pairing sederhana | Session ID harus sulit ditebak |
| Key event (down/up) | Fidelity keyboard fisik | Lebih banyak event daripada "type text" |
| Hybrid fast-path | Latensi teks tetap rendah | Kompleksitas protokol lebih tinggi |

---

## 13. Technology Stack

| Layer | Teknologi | Catatan |
| --- | --- | --- |
| Mobile UI | React + TypeScript | Component-based, type-safe |
| Build Mobile | Vite | Cepat untuk development |
| PWA | Vite PWA plugin | Installable web app |
| Realtime | Supabase JS | Broadcast key events |
| Desktop Shell | Tauri | Desktop app ringan |
| Desktop Core | Rust | Performa dan footprint rendah |
| Keyboard | Enigo | key_down / key_up / modifier |
| Serialization | Serde | JSON payload |
| Hosting | Vercel | Deploy PWA |
| Installer | Tauri Bundler | NSIS/MSI |

---

## 14. High Level Diagram

```
User opens Desktop
        |
        v
Desktop creates session
        |
        v
Desktop subscribes to channel
        |
        v
Desktop shows pairing code + QR
        |
        v
Mobile enters/scan session code
        |
        v
Mobile shows keyboard (connected)
        |
        v
User presses key on mobile
        |
        v
Mobile broadcasts key event
        |
        v
Desktop receives event
        |
        v
Desktop simulates key press/release
        |
        v
Input appears in active application
```

---

## 15. Event Model (Kunci Utama AirType)

Ini pembeda utama dari ScanBridge. ScanBridge mengirim teks utuh; AirType mengirim **key event** sehingga semua aplikasi menerima input seolah-olah dari keyboard fisik.

### 15.1 Key Event

```json
{
  "type": "key_down",
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "eventId": "evt-001",
  "clientId": "mobile-anonymous-001",
  "code": "KeyA",
  "key": "a",
  "modifiers": { "shift": false, "ctrl": false, "alt": false, "meta": false },
  "timestamp": "2026-08-12T12:00:00.000Z"
}
```

`key_up` identik dengan `eventId` yang sama untuk mengaitkan pasangan down/up.

### 15.2 Mapping Key

`code` memakai standar [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) sehingga pemetaan lintas platform konsisten:

| Kategori | Contoh `code` |
| --- | --- |
| Letters | `KeyA` ... `KeyZ` |
| Digits | `Digit0` ... `Digit9` |
| Modifier | `ShiftLeft`, `ControlLeft`, `AltLeft`, `MetaLeft` |
| Enter | `Enter`, `NumpadEnter` |
| Navigation | `Tab`, `Backspace`, `Delete`, `Home`, `End`, `PageUp`, `PageDown` |
| Arrows | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` |
| Space | `Space` |
| Function | `F1` ... `F12` |
| Symbol | `Semicolon`, `Comma`, `Period`, `Slash`, `Backslash`, `BracketLeft/Right`, `Quote`, `Minus`, `Equal`, `Backquote` |

Desktop melakukan lookup `code` -> Enigo `Key` / `KeyCode`. Payload tidak memakai `keyCode` (usang) dan tidak mengirim karakter mentah untuk special keys.

### 15.3 Modifier State

- Modifier adalah tombol biasa yang mengirim `key_down`/`key_up` sendiri.
- Saat `key_down` tombol biasa (misal `KeyC`) terkirim, payload membawa snapshot `modifiers`.
- Desktop menekan modifier jika belum ditekan, lalu menekan tombol, lalu melepas sesuai state.
- Toggle UI modifier di mobile: Shift latching (satu ketuk -> next key dikapitalisasi), Ctrl/Alt latch sampai dilepas lagi.

### 15.4 Hybrid Fast-Path (Teks Murni)

Untuk mengurangi latensi saat mengetik teks biasa (tanpa modifier/special key):

```json
{
  "type": "type_text",
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "eventId": "evt-002",
  "clientId": "mobile-anonymous-001",
  "text": "hello",
  "timestamp": "2026-08-12T12:00:00.120Z"
}
```

Aturan:
- Mobile men-buffer karakter murni selama window `textBurstMs` (default 80 ms). Jika user terus mengetik, buffer terus digabung.
- Jika dalam window tersebut muncul special key, modifier, atau jeda lebih dari `textBurstMs`, buffer dikirim sebagai `type_text` lalu event lanjutan dikirim terpisah.
- Desktop mengetik teks dengan Enigo `type()`, jauh lebih cepat daripada per-tombol.
- Teks di-santize (mis. `\n` harus jadi `Enter`, bukan karakter).

Trade-off: `type_text` tidak cocok untuk aplikasi yang memetakan keydown (mis. game). Untuk aplikasi sensitif key event, user bisa memilih mode **strict key events** di settings.

---

## 16. Realtime Channel & Event Naming

Channel:

```text
airtype:session:<sessionId>
```

Event:

| Event | Publisher | Subscriber | Deskripsi |
| --- | --- | --- | --- |
| `client_joined` | Mobile | Desktop | Mobile terhubung |
| `client_left` | Mobile | Desktop | Mobile terputus |
| `client_heartbeat` | Mobile | Desktop | Keep-alive |
| `desktop_status` | Desktop | Mobile | Status desktop (ready/paused) |
| `key_down` | Mobile | Desktop | Tekan tombol |
| `key_up` | Mobile | Desktop | Lepas tombol |
| `type_text` | Mobile | Desktop | Fast-path teks murni |
| `ack` | Desktop | Mobile | Konfirmasi (opsional, bisa dimatikan) |

---

## 17. Session Lifecycle

| State | Trigger | Next State |
| --- | --- | --- |
| `idle` | Desktop dibuka | `creating_session` |
| `creating_session` | Session dibuat | `subscribing` |
| `subscribing` | Channel subscribed | `waiting_pairing` |
| `waiting_pairing` | Mobile join | `connected` |
| `connected` | Key event diterima | `connected` |
| `connected` | User pause | `paused` |
| `paused` | User resume | `connected` |
| `connected` | Network error | `reconnecting` |
| `reconnecting` | Subscribe berhasil | `connected` |
| `connected` | User disconnect | `idle` |

---

## 18. Keyboard Simulation Flow (Desktop)

```
Receive event
  |
  v
Validate (session, code, eventId)
  |
  v
Load settings (keyEventMode / fastPath)
  |
  v
Apply modifier state (Shift/Ctrl/Alt/Meta)
  |
  v
key_down / key_up via Enigo
  |
  v
Optional ACK
```

Rules:

| Rule | Deskripsi |
| --- | --- |
| Modifier ditekan/dilepas eksplisit | Jangan asumsikan release otomatis |
| Pasangan down/up | Pastikan `eventId` down selalu diikuti up |
| Focus window | Desktop tidak memindahkan fokus; user memilih field target |
| Duplicate event | Abaikan `eventId` yang sudah diproses (dedup window pendek) |
| Unknown code | Log warn, kirim ACK gagal, jangan crash |

---

## 19. Keyboard Layout (Mobile MVP)

```
+--------------------------------------------------+
| [ Tab ] [q w e r t y u i o p] [Backspace]        |
| [caps?][a s d f g h j k l]      [Enter]          |
| [Shift][z x c v b n m , . /]    [Shift]          |
| [Ctrl][Alt][Space][Alt][Ctrl]   [arrows]         |
+--------------------------------------------------+
```

Elemen wajib MVP:
- 3 baris huruf QWERTY + baris angka.
- Special keys: Tab, Enter, Backspace, Delete, Space, Home, End, PageUp, PageDown, ArrowUp/Down/Left/Right.
- Modifier: Shift (left/right, latch), Ctrl, Alt.
- Opsional: CapsLock, Meta/Win, simbol baris (`!@#$%...`), F1-F12 di layer kedua.

Navigation layer: ketuk tombol angka/simbol untuk membuka layer kedua dengan F-keys dan tanda baca.

---

## 20. Latency Strategy

| Teknik | Deskripsi | Efek |
| --- | --- | --- |
| Fast-path `type_text` | Bundel karakter murni | Teks murni < 150 ms |
| Key event per tombol | Untuk special/modifier | Kompatibilitas universal |
| Optimistic UI | Tombol highlight langsung saat ditekan | Persepsi responsif |
| Heartbeat | Deteksi putus cepat | Auto reconnect |
| Ordering | `eventId` berurutan + timestamp | Urutan tetap terjaga |

---

## 21. Security

| Risiko | Mitigasi |
| --- | --- |
| Session ditebak | Session ID acak panjang (32 hex), sulit ditebak |
| Channel diakses orang lain | Channel memakai session ID panjang dan sementara |
| Keystroke disimpan di cloud | Jangan insert ke database; broadcast saja |
| Keystroke sensitif (password) | Banner peringatan; saran jangan ketik password lewat relay cloud; future: E2E |
| Abuse anon key | Pahami RLS/policy Supabase |
| Event spoofing | Validasi session + clientId; future: signed token |
| Pause saat tidak dipakai | Mode paused default saat idle |

Catatan: keystroke melewati relay cloud. Untuk field sensitif (password, kartu), disarankan keyboard fisik. Ditandai di UI mobile sebagai peringatan.

---

## 22. Error Handling

| Error | Mobile Behavior | Desktop Behavior |
| --- | --- | --- |
| Koneksi putus | Status reconnecting | Status reconnecting |
| Session invalid | Tampilkan error session | Tidak terkait |
| Broadcast gagal | Toast gagal + retry otomatis | Tidak menerima |
| Unknown key code | Tidak terkait | Log warn, ACK gagal |
| Enigo gagal | ACK gagal jika aktif | Log error lokal |
| Duplicate eventId | Tidak terkait | Abaikan |
| Mode pause aktif | Tombol tidak responsif (visual dim) | Input diabaikan |

---

## 23. Logging

| Log | Level | Contoh |
| --- | --- | --- |
| App started | Info | AirType Helper started |
| Session created | Info | Session ID created |
| Realtime connected | Info | Subscribed to channel |
| Key event received | Info | code + modifiers (tanpa teks sensitif) |
| type_text received | Info | Panjang teks saja (hash opsional) |
| Enigo error | Error | key simulation failed |
| Reconnect attempt | Warn | Reconnecting to Supabase |

> Privacy: jangan log isi teks, hanya panjang/metadata.

---

## 24. Configuration

| Key | Default | Scope | Deskripsi |
| --- | --- | --- | --- |
| `supabaseUrl` | env | Desktop/Mobile | URL project Supabase |
| `supabaseAnonKey` | env | Desktop/Mobile | Anonymous key |
| `keyEventMode` | `"auto"` | Desktop | `auto` (fast-path) / `strict` (semua key event) |
| `textBurstMs` | `80` | Mobile | Window bundel teks murni |
| `autoPauseAfterMs` | `60000` | Desktop | Pause otomatis saat idle |
| `ackEnabled` | `false` | Desktop | Kirim ACK per event |
| `historyEnabled` | `true` | Desktop | Simpan history lokal |
| `historyLimit` | `100` | Desktop | Jumlah item history |
| `vibrate` | `true` | Mobile | Haptic feedback |
| `layoutSize` | `"default"` | Mobile | Ukuran tombol |

Contoh `.env` mobile:

```text
VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key
```

---

## 25. Data Model (Lokal)

Local desktop settings:

```json
{
  "keyEventMode": "auto",
  "autoPauseAfterMs": 60000,
  "ackEnabled": false,
  "historyEnabled": true,
  "historyLimit": 100
}
```

Local history item:

```json
{
  "id": "local-001",
  "kind": "key_down" | "key_up" | "type_text",
  "code": "KeyA",
  "text": null,
  "modifiers": { "shift": false, "ctrl": false, "alt": false },
  "receivedAt": "2026-08-12T12:00:00.120Z",
  "simulated": true
}
```

Data model MVP bersifat lokal. Tidak ada tabel database wajib.

---

## 26. Testing Strategy

### Unit Test

| Area | Test |
| --- | --- |
| Session | Session ID valid + channel name benar |
| Event parser | `key_down`/`key_up`/`type_text` valid/invalid |
| Code mapping | `KeyA` -> Enigo Key, `ArrowUp` -> key, dst |
| Modifier state | Kombinasi Shift/Ctrl/Alt benar |
| Fast-path | Buffering dan pemecahan burst benar |
| Dedup | `eventId` ganda diabaikan |

### Integration Test

| Area | Test |
| --- | --- |
| Mobile publish | Key event terkirim ke channel test |
| Desktop subscribe | Event diterima dan disimulasikan |
| Reconnect | Putus jaringan lalu subscribe ulang |

### Manual QA

| Scenario | Expected |
| --- | --- |
| Ketik "hello" di Notepad | Muncul "hello" |
| Tekan Enter | Baris baru |
| Tekan Tab | Pindah fokus / tab character |
| Ctrl+C di Notepad | Menyalin |
| Alt+Tab | Berpindah window |
| ArrowUp di editor | Kursor naik |
| Backspace | Menghapus karakter |

---

## 27. Acceptance Criteria MVP

| Criteria | Status Target |
| --- | --- |
| Desktop app berjalan di Windows | Wajib |
| Tray icon muncul | Wajib |
| Desktop membuat session | Wajib |
| Kode pairing + QR muncul | Wajib |
| Mobile connect dari kode/QR | Wajib |
| Mobile menampilkan QWERTY penuh | Wajib |
| Karakter diketik ke Notepad | Wajib |
| Enter/Tab/Backspace berfungsi | Wajib |
| Shift/Ctrl/Alt kombinasi berfungsi | Wajib |
| Auto reconnect berjalan | Wajib |
| 1.000 keystroke tidak crash | Wajib |

---

## 28. Roadmap

| Phase | Fokus | Output |
| --- | --- | --- |
| Phase 1 | MVP: key event + fast-path | Ketik karakter + Enter di Notepad |
| Phase 2 | Special keys & modifier | Shift/Ctrl/Alt/arrow/Home/End |
| Phase 3 | Reliability | Reconnect, pause, stress test |
| Phase 4 | Packaging | Installer + deploy Vercel |
| Phase 5 | Productivity | Custom layout, F-keys, profil |

---

## 29. Future Features

| Feature | Deskripsi |
| --- | --- |
| E2E encryption | Enkripsi payload agar aman untuk password |
| BLE pairing | Tanpa relay cloud, latensi lebih rendah |
| Mouse/trackpad | Mode pointer |
| Custom layout editor | User mendesain tombol sendiri |
| Macros | Urutan keystroke sekali ketuk |
| Clipboard bridge | Sinkronisasi clipboard antar device |
| Profiles | Seting berbeda per aplikasi target |
| Multi-device | Banyak HP per desktop |

---

## 30. Deployment Guide

### Mobile PWA ke Vercel

1. Set env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. `npm run build`.
3. Deploy ke Vercel.
4. Domain: `https://airtype.app`.

### Desktop Installer

1. Set Supabase config untuk desktop.
2. `cargo tauri build`.
3. Ambil installer dari bundler.
4. Test install di Windows bersih.

---

## 31. Developer Setup Guide

Prerequisites: Node.js LTS, Rust stable, Tauri CLI, Supabase project (Realtime enabled), Windows 10/11.

```text
cd mobile && npm install && npm run dev
cd desktop && npm install && cargo tauri dev
```

Supabase setup: buat project, aktifkan Realtime, pakai anonymous auth, simpan URL + anon key di env, test broadcast dengan session dummy.

---

## 32. Known Risks / Dependencies

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Latensi relay cloud | Ketikan terasa lambat | Fast-path + mode strict opsional |
| Enigo pada kombinasi tertentu | Beberapa kombinasi (mis. Ctrl+Shift switch layout) aneh | Dokumentasikan, uji dengan aplikasi target |
| iOS memotong PWA kamera/keyboard | Perlu hati-hati dengan Screen Wake Lock | Gunakan Wake Lock API, fallback |
| Keystroke sensitif lewat relay | Privasi | Peringatan UI + future E2E |
| Aplikasi yang menangkap keydown (game) | Fast-path tidak cocok | Mode strict key events |

---

## 33. Definition of Done MVP

1. Desktop dapat dijalankan.
2. Tray icon muncul.
3. Kode pairing + QR berhasil.
4. HP berhasil connect.
5. Karakter terketik di Notepad.
6. Enter/Tab/Backspace berfungsi.
7. Shift/Ctrl/Alt kombinasi berfungsi.
8. Auto reconnect berjalan.
9. Tidak crash setelah 1.000 keystroke.

---

## 34. Appendix

### Glossary

| Istilah | Definisi |
| --- | --- |
| Key event | Pasangan `key_down`/`key_up` yang mensimulasikan keyboard fisik |
| Fast-path | `type_text` untuk teks murni agar latensi rendah |
| Modifier | Shift, Ctrl, Alt, Meta |
| Special key | Enter, Tab, Backspace, arrows, Home/End, dst |
| Session | ID pairing desktop-mobile |

### Contoh URL Pairing

```text
https://airtype.app/connect?session=4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01
```

### Final Technical Notes

1. AirType mengirim key event, bukan teks — itu pembeda utamanya.
2. Fast-path `type_text` opsional dan bisa dimatikan.
3. Keystroke melewati relay cloud; jangan ketik password tanpa E2E.
4. Desktop dan mobile sama-sama client Supabase.
5. Fokus window tidak boleh dipindahkan otomatis oleh desktop.
6. Semua kombinasi harus diuji di aplikasi target nyata.
