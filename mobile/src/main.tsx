import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import { SettingsProvider } from './context/SettingsContext'

// Split the marketing page from the PWA: `/connect` must not pay for landing
// content, and the landing page must not download the realtime client.
const App = lazy(() => import('./App.tsx'))
const LandingPage = lazy(() => import('./LandingPage.tsx'))

// `/` is the marketing page; the pairing app lives at `/connect` (the PWA
// start_url). A `?session=` link still opens the app directly for old QRs.
function isAppRoute(): boolean {
  if (window.location.pathname.startsWith('/connect')) return true
  return new URLSearchParams(window.location.search).has('session')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        {isAppRoute() ? (
          <App />
        ) : (
          <SettingsProvider>
            <LandingPage />
          </SettingsProvider>
        )}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
