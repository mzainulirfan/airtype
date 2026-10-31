# AirType Mobile

React 19 + Vite PWA that turns a phone browser into a keyboard and touchpad.

- `/` — landing page.
- `/connect` — pairing app (PWA `start_url`). Accepts `?session=<32 hex>` QR
  links and strips the parameter after connecting.

## Development

```sh
cp .env.example .env.local   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm ci
npm run dev
```

## Build and deploy

```sh
npm run build   # tsc + vite build + PWA service worker into dist/
```

Deploy `dist/` to Vercel. `vercel.json` contains the SPA rewrite and security
headers (CSP, HSTS, frame and permissions policies). Set the two `VITE_*`
variables in the Vercel project.

See the [root README](../README.md) for architecture, the desktop helper, and
security notes.
