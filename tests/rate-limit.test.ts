import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import test from "node:test";

import { checkRateLimit, getRateLimitKey } from "../lib/rate-limit";

test("checkRateLimit allows requests under the configured limit", () => {
  const key = `under-limit:${crypto.randomUUID()}`;

  const first = checkRateLimit(key, { max: 2, windowMs: 1000 });
  const second = checkRateLimit(key, { max: 2, windowMs: 1000 });

  assert.equal(first.limited, false);
  assert.equal(first.remaining, 1);
  assert.equal(second.limited, false);
  assert.equal(second.remaining, 0);
});

test("checkRateLimit blocks requests above the configured limit", () => {
  const key = `above-limit:${crypto.randomUUID()}`;

  checkRateLimit(key, { max: 1, windowMs: 1000 });
  const limited = checkRateLimit(key, { max: 1, windowMs: 1000 });

  assert.equal(limited.limited, true);
  assert.equal(limited.remaining, 0);
});

test("checkRateLimit resets after the configured window", async () => {
  const key = `reset-window:${crypto.randomUUID()}`;

  checkRateLimit(key, { max: 1, windowMs: 5 });
  assert.equal(checkRateLimit(key, { max: 1, windowMs: 5 }).limited, true);

  await setTimeout(10);

  const afterReset = checkRateLimit(key, { max: 1, windowMs: 5 });
  assert.equal(afterReset.limited, false);
  assert.equal(afterReset.remaining, 0);
});

test("getRateLimitKey prefers authenticated user id over IP", () => {
  const request = new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  assert.equal(getRateLimitKey(request, "scope", "USER@Example.com"), "scope:user:user@example.com");
});

test("getRateLimitKey falls back to forwarded IP when user id is absent", () => {
  const request = new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.4" },
  });

  assert.equal(getRateLimitKey(request, "scope"), "scope:ip:203.0.113.10");
});
