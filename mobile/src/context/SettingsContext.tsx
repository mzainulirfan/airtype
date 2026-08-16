import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type KeySize = 'small' | 'default' | 'large'
export type CursorSensitivity = 1 | 1.5 | 2

export interface Settings {
  haptic: boolean
  keySize: KeySize
  theme: ThemePreference
  autoReturnToLetters: boolean
  strictMode: boolean
  cursorSensitivity: CursorSensitivity
  showTypingPreview: boolean
  seenGestureGuide: boolean
  favoriteShortcuts: string[]
}

const STORAGE_KEY = 'airtype_settings'

const DEFAULTS: Settings = {
  haptic: true,
  keySize: 'default',
  theme: 'system',
  autoReturnToLetters: true,
  strictMode: false,
  cursorSensitivity: 2,
  showTypingPreview: true,
  seenGestureGuide: false,
  favoriteShortcuts: ['Esc', 'Ctrl+C', 'Ctrl+V', 'Alt+Tab', 'Ctrl+Z'],
}

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULTS
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const effective =
        settings.theme === 'system' ? (mq.matches ? 'light' : 'dark') : settings.theme
      document.documentElement.dataset.theme = effective
      document.documentElement.dataset.keySize = settings.keySize
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme, settings.keySize])

  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
