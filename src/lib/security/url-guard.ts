import { isIP } from 'net'
import { lookup } from 'dns/promises'

/**
 * SSRF guard for server-side outbound requests to user/tenant-supplied URLs
 * (e.g. custom outbound webhooks).
 *
 * A tenant admin controls the destination URL, and the delivery worker fetches
 * it server-side and logs the response. Without this guard an admin could point
 * a webhook at cloud metadata (169.254.169.254), loopback, or internal RFC1918
 * hosts and use the app as a proxy to probe / read the internal network.
 *
 * The check runs at save time and again at delivery time (DNS is re-resolved on
 * every delivery to defeat DNS-rebinding — a hostname that resolved public at
 * save time but flips to a private IP later is caught before the fetch).
 */

// ── IPv4 ───────────────────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    value = value * 256 + n
  }
  return value >>> 0
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe

  const inRange = (base: string, maskBits: number) => {
    const baseInt = ipv4ToInt(base)!
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0
    return (n & mask) === (baseInt & mask)
  }

  return (
    inRange('0.0.0.0', 8) || // "this" network
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // CGNAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (incl. cloud metadata 169.254.169.254)
    inRange('172.16.0.0', 12) || // private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // TEST-NET-1
    inRange('192.168.0.0', 16) || // private
    inRange('198.18.0.0', 15) || // benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) || // TEST-NET-3
    inRange('224.0.0.0', 4) || // multicast
    inRange('240.0.0.0', 4) // reserved / broadcast
  )
}

// ── IPv6 ───────────────────────────────────────────────────────────────────

function expandIPv6(ip: string): string[] | null {
  // Strip zone id (fe80::1%eth0)
  const zoneless = ip.split('%')[0]

  // Handle IPv4-mapped/embedded tail (::ffff:192.168.0.1)
  const v4Match = zoneless.match(/^(.*:)((\d{1,3}\.){3}\d{1,3})$/)
  let head = zoneless
  let v4Tail: string[] = []
  if (v4Match) {
    const n = ipv4ToInt(v4Match[2])
    if (n === null) return null
    v4Tail = [((n >>> 16) & 0xffff).toString(16), (n & 0xffff).toString(16)]
    head = v4Match[1]
  }

  const sides = head.split('::')
  if (sides.length > 2) return null

  const parseGroups = (s: string): string[] => (s === '' ? [] : s.split(':').filter(Boolean))
  const left = parseGroups(sides[0])
  const right = sides.length === 2 ? parseGroups(sides[1]) : []

  const groups = [...left]
  if (sides.length === 2) {
    const fill = 8 - left.length - right.length - v4Tail.length
    if (fill < 0) return null
    for (let i = 0; i < fill; i++) groups.push('0')
  }
  groups.push(...right, ...v4Tail)

  if (groups.length !== 8) return null
  return groups.map((g) => g.padStart(4, '0'))
}

function isPrivateIPv6(ip: string): boolean {
  const groups = expandIPv6(ip)
  if (!groups) return true

  const first = parseInt(groups[0], 16)

  // ::1 loopback / :: unspecified
  const allZeroButLast = groups.slice(0, 7).every((g) => g === '0000')
  if (allZeroButLast && (groups[7] === '0001' || groups[7] === '0000')) return true

  // fc00::/7 unique-local
  if ((first & 0xfe00) === 0xfc00) return true
  // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfe80) return true

  // ::ffff:0:0/96 IPv4-mapped → check embedded v4
  if (groups.slice(0, 5).every((g) => g === '0000') && groups[5] === 'ffff') {
    const a = parseInt(groups[6], 16)
    const b = parseInt(groups[7], 16)
    const v4 = `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`
    return isPrivateIPv4(v4)
  }

  return false
}

function isBlockedIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIPv4(ip)
  if (version === 6) return isPrivateIPv6(ip)
  return true // not a valid IP literal → unsafe
}

// ── Public API ───────────────────────────────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal'])

export type UrlGuardResult = { ok: true } | { ok: false; reason: string }

/**
 * Structural (synchronous) checks — no DNS. Enforces https, forbids embedded
 * credentials, and blocks obviously-internal hostnames / private IP literals.
 */
export function checkUrlStructure(rawUrl: string): UrlGuardResult {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'Invalid URL.' }
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'URL must use HTTPS.' }
  if (url.username || url.password)
    return { ok: false, reason: 'URL must not contain credentials.' }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!hostname) return { ok: false, reason: 'URL has no host.' }
  if (BLOCKED_HOSTNAMES.has(hostname)) return { ok: false, reason: 'Host is not allowed.' }
  if (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  )
    return { ok: false, reason: 'Host is not allowed.' }

  // IP literal? block private ranges outright.
  const bracketless = hostname.replace(/^\[|\]$/g, '')
  if (isIP(bracketless) && isBlockedIp(bracketless))
    return { ok: false, reason: 'URL resolves to a private or reserved address.' }

  return { ok: true }
}

/**
 * Full check including DNS resolution. Every resolved address must be public.
 * Use this immediately before fetching a tenant-supplied URL.
 */
export async function assertSafeUrl(rawUrl: string): Promise<UrlGuardResult> {
  const structural = checkUrlStructure(rawUrl)
  if (!structural.ok) return structural

  const hostname = new URL(rawUrl).hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')

  // Already an IP literal — structural check covered it.
  if (isIP(hostname)) return { ok: true }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    return { ok: false, reason: 'Could not resolve host.' }
  }

  if (addresses.length === 0) return { ok: false, reason: 'Host did not resolve.' }
  for (const { address } of addresses) {
    if (isBlockedIp(address))
      return { ok: false, reason: 'URL resolves to a private or reserved address.' }
  }

  return { ok: true }
}
