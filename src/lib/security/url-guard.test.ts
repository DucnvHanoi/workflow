import { describe, it, expect } from 'vitest'
import { checkUrlStructure } from './url-guard'

// These exercise the synchronous structural guard (no DNS). The delivery-time
// assertSafeUrl() adds DNS resolution on top of these same IP checks.

describe('checkUrlStructure — blocks SSRF vectors', () => {
  const blocked = [
    'http://example.com/hook', // not https
    'https://user:pass@example.com/hook', // embedded credentials
    'https://localhost/hook',
    'https://app.local/hook',
    'https://svc.internal/hook',
    'https://127.0.0.1/hook', // loopback
    'https://169.254.169.254/latest/meta-data/', // cloud metadata
    'https://10.0.0.5/hook', // RFC1918
    'https://172.16.9.9/hook', // RFC1918
    'https://192.168.1.1/hook', // RFC1918
    'https://100.64.0.1/hook', // CGNAT
    'https://[::1]/hook', // IPv6 loopback
    'https://[fd00::1]/hook', // IPv6 ULA
    'https://[fe80::1]/hook', // IPv6 link-local
    'https://[::ffff:127.0.0.1]/hook', // IPv4-mapped loopback
  ]

  for (const url of blocked) {
    it(`blocks ${url}`, () => {
      expect(checkUrlStructure(url).ok).toBe(false)
    })
  }
})

describe('checkUrlStructure — allows legitimate public https hosts', () => {
  const allowed = [
    'https://hooks.slack.com/services/T000/B000/xxxx',
    'https://example.com/webhooks/incoming',
    'https://api.zapier.com/hooks/catch/123/abc',
    'https://8.8.8.8/hook', // public IP literal
  ]

  for (const url of allowed) {
    it(`allows ${url}`, () => {
      expect(checkUrlStructure(url).ok).toBe(true)
    })
  }
})
