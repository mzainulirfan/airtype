import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LandingPage from './LandingPage.tsx'
import { SettingsProvider } from './context/SettingsContext'

// `/` is the marketing page; the pairing app lives at `/connect` (the PWA
// start_url). A `?session=` link still opens the app directly for old QRs.
function isAppRoute(): boolean {
  if (window.location.pathname.startsWith('/connect')) return true
  return new URLSearchParams(window.location.search).has('session')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAppRoute() ? (
      <App />
    ) : (
      <SettingsProvider>
        <LandingPage />
      </SettingsProvider>
    )}
  </StrictMode>,
)
