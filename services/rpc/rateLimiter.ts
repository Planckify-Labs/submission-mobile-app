/**
 * Token-bucket rate limiter per RPC provider.
 */

interface Bucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export function initBucket(key: string, rpm: number): void {
  const maxTokens = rpm;
  buckets.set(key, {
    tokens: maxTokens,
    maxTokens,
    refillRate: rpm / 60_000, // tokens per ms
    lastRefill: Date.now(),
  });
}

export function tryConsume(key: string): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return true; // no limit configured

  refill(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

export async function waitForToken(key: string): Promise<void> {
  const bucket = buckets.get(key);
  if (!bucket) return;

  refill(bucket);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return;
  }

  // Wait for next token
  const waitMs = Math.ceil((1 - bucket.tokens) / bucket.refillRate);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  refill(bucket);
  bucket.tokens -= 1;
}

function refill(bucket: Bucket): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(
    bucket.maxTokens,
    bucket.tokens + elapsed * bucket.refillRate,
  );
  bucket.lastRefill = now;
}
