import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function createRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return Redis.fromEnv()
}

const redis = createRedis()

function makeLimiter(
  prefix: string,
  requests: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1]
) {
  if (!redis) return null
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix })
}

// 5 new tenant signups per hour per IP
const signupLimiter = makeLimiter('rl:signup', 5, '1 h')

// 30 invitations per hour per tenant
const inviteLimiter = makeLimiter('rl:invite', 30, '1 h')

export async function checkSignupRate(ip: string): Promise<boolean> {
  if (!signupLimiter) return true
  const { success } = await signupLimiter.limit(ip)
  return success
}

export async function checkInviteRate(tenantId: string): Promise<boolean> {
  if (!inviteLimiter) return true
  const { success } = await inviteLimiter.limit(tenantId)
  return success
}
