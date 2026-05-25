import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length !== 64) {
    throw new Error('AI_KEY_ENCRYPTION_SECRET must be set to a 64-char hex string (32 bytes)')
  }
  return Buffer.from(secret, 'hex')
}

// Returns "iv:tag:ciphertext" (all hex)
export function encryptApiKey(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptApiKey(stored: string): string {
  const key = getKey()
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted key format')
  const [ivHex, tagHex, encHex] = parts
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString(
    'utf8'
  )
}
