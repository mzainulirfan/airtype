import type { BroadcastPayload, EncryptedEnvelope } from '../types'

// The session id doubles as the pairing secret, so it can derive the shared
// key without any extra exchange. The prefix keeps this derivation isolated
// from other uses of the same id.
const KEY_PREFIX = 'airtype-e2e-v1:'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const keyCache = new Map<string, Promise<CryptoKey>>()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sessionKey(sessionId: string): Promise<CryptoKey> {
  let cached = keyCache.get(sessionId)
  if (!cached) {
    cached = (async () => {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(KEY_PREFIX + sessionId),
      )
      return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
        'encrypt',
        'decrypt',
      ])
    })()
    keyCache.set(sessionId, cached)
  }
  return cached
}

export async function encryptPayload(
  sessionId: string,
  payload: BroadcastPayload,
): Promise<EncryptedEnvelope> {
  const key = await sessionKey(sessionId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(payload)),
    ),
  )
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv)
  combined.set(ciphertext, iv.length)
  return { v: 1, enc: toBase64(combined) }
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== 'object') return false
  const envelope = value as Record<string, unknown>
  return envelope.v === 1 && typeof envelope.enc === 'string'
}

/** Returns null when the envelope is malformed, tampered with, or the key is
 * wrong; callers treat that as a dropped message. */
export async function decryptEnvelope(
  sessionId: string,
  envelope: EncryptedEnvelope,
): Promise<BroadcastPayload | null> {
  try {
    const raw = fromBase64(envelope.enc)
    if (raw.length < 12 + 16) return null
    const key = await sessionKey(sessionId)
    const iv = new Uint8Array(raw.subarray(0, 12))
    const ciphertext = new Uint8Array(raw.subarray(12))
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    const parsed: unknown = JSON.parse(decoder.decode(plaintext))
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as BroadcastPayload
  } catch {
    return null
  }
}
