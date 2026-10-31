# AirType

AirType turns a phone browser into a wireless keyboard and touchpad for your PC.
The desktop helper shows a QR code, the phone opens it as a PWA, and input
events travel over a Supabase Realtime broadcast channel.

## Architecture

```
Phone PWA (React 19 / Vite)                 Desktop helper (Tauri 2)
  /            landing page                   React UI + Rust core
  /connect     keyboard + touchpad            Enigo input injection
        \                                      /
         `--- Supabase Realtime broadcast ---'
              topic: airtype:session:<id>
```

- `desktop/` — Tauri helper. Generates the session, shows the QR, subscribes to
  the session topic, and injects keyboard/mouse input into the OS.
- `mobile/` — PWA. The landing page lives at `/`; the pairing app (the PWA
  `start_url`) lives at `/connect`.
- Transport — Supabase Realtime broadcast. Messages are AES-256-GCM encrypted
  once both sides understand the envelope (key derived from the session id);
  plaintext is still accepted for older builds.
- Approval — a phone that opens a session waits for the desktop user to accept
  it. Remote input is dropped until then, and every session rotation resets the
  approval list.
- Hardening — remote mouse deltas, scroll and bulk text are clamped, input is
  rate-limited per session, and the session id is stripped from the address bar
  after the phone connects.

## Requirements

- Node.js 22+
- Rust stable (desktop only)
- Windows: WebView2 runtime and the MSVC build tools (Tauri targets `nsis` and
  `msi`)
- A Supabase project with Realtime enabled

## Setup

1. Configure the mobile app:

   ```sh
   cp mobile/.env.example mobile/.env.local
   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   ```

2. Configure the desktop helper:

   ```sh
   cp desktop/.env.example desktop/.env
   # set AIRTYPE_SUPABASE_URL and AIRTYPE_SUPABASE_ANON_KEY
   ```

   `desktop/src-tauri/build.rs` bakes these values into the binary at build
   time, so an installed helper works without a local `.env`.

3. Run the mobile app:

   ```sh
   cd mobile
   npm ci
   npm run dev
   ```

4. Run the desktop helper:

   ```sh
   cd desktop
   npm ci
   npm run tauri:dev
   ```

## Build

```sh
cd mobile && npm run build        # static PWA in mobile/dist
cd desktop && npm run tauri:build # installers in src-tauri/target/release/bundle
```

Deploy `mobile/dist` to Vercel. The app env vars must be set in the Vercel
project; `mobile/vercel.json` adds SPA rewrites and security headers.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | mobile | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | mobile | Public anon key (safe to ship) |
| `AIRTYPE_SUPABASE_URL` | desktop | Supabase project URL |
| `AIRTYPE_SUPABASE_ANON_KEY` | desktop | Public anon key (baked at build) |
| `AIRTYPE_PAIRING_BASE_URL` | desktop | Base URL encoded into the QR code |
| `AIRTYPE_AUTO_PAUSE_AFTER_MS` | desktop | Idle auto-pause default (0 disables); also editable in the helper UI |
| `AIRTYPE_HISTORY_ENABLED` | desktop | Keep the local activity feed |
| `AIRTYPE_HISTORY_LIMIT` | desktop | Maximum activity entries |
| `AIRTYPE_SIGN_THUMBPRINT` | build | Override the code-signing certificate thumbprint |

## Tests and CI

- `cd desktop/src-tauri && cargo test --lib` — crypto vectors, rate limiter,
  input clamping.
- `cd mobile && npm run lint && npm run build` — lint and production build.
- `.github/workflows/ci.yml` runs both on pushes and pull requests to `main`.

## Release notes

- Windows installers are Authenticode-signed with a self-signed `CN=AirType`
  certificate (see `desktop/src-tauri/scripts/sign-windows.ps1`). The certificate
  is trusted only on the build machine, so other PCs show SmartScreen warnings
  until they import the public `airtype-codesign.cer` (attached to each GitHub
  release) into Trusted Root Certification Authorities. Replace it with a paid
  CA certificate for public distribution.
- The Tauri updater is not configured. Enabling it requires a signing keypair
  and a release host.
- No license has been declared for this repository yet; pick one before
  distributing binaries or source.
