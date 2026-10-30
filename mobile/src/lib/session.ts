import type { SessionInfo } from '../types'
import { getChannelName } from './supabase'

const SESSION_ID_RE = /^[0-9a-f]{32}$/

export function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function parseSessionFromUrl(url: string): SessionInfo | null {
  try {
    const parsed = new URL(url)
    const session = parsed.searchParams.get('session')
    if (session && SESSION_ID_RE.test(session)) {
      return { sessionId: session, channel: getChannelName(session) }
    }
  } catch {
    return null
  }
  return null
}

export function validateSessionId(session: string): boolean {
  return SESSION_ID_RE.test(session)
}
