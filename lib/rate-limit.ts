import { NextResponse } from "next/server";

type RateLimitConfig = {
  max: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetAt: number;
};

// MVP limiter: this is process-local memory. It helps reduce accidental abuse
// and preview-environment spikes, but serverless instances do not share buckets.
// Replace with Redis/KV or gateway rate limiting when traffic scales.
const buckets = new Map<string, RateLimitBucket>();

export const RATE_LIMITS = {
  aiAnalyze: { max: 20, windowMs: 10 * 60 * 1000 },
  aiGenerate: { max: 5, windowMs: 10 * 60 * 1000 },
  mutation: { max: 60, windowMs: 10 * 60 * 1000 },
  projectMutation: { max: 30, windowMs: 10 * 60 * 1000 },
  githubCreate: { max: 10, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, RateLimitConfig>;

export function getRateLimitKey(request: Request, scope: string, userId?: string | null): string {
  if (userId) {
    return `${scope}:user:${userId.trim().toLowerCase()}`;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:ip:${ip}`;
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { limited: false, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  if (current.count >= config.max) {
    return { limited: true, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { limited: false, remaining: config.max - current.count, resetAt: current.resetAt };
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
      },
    },
  );
}
