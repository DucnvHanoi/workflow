import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison for authentication secrets (CRON bearer
 * tokens, inbound-webhook shared secrets, etc.). A plain `a === b` short-circuits
 * on the first differing byte and leaks length/prefix information through timing;
 * this compares in time independent of how many leading bytes match.
 *
 * Returns false if either value is missing.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  // timingSafeEqual throws on length mismatch; compare against a fixed-length
  // digest-free guard by padding is unnecessary — the length check itself is not
  // secret here, but we still avoid the throw and the early-return timing signal.
  if (bufA.length !== bufB.length) {
    // Still perform a comparison to keep timing roughly constant.
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
