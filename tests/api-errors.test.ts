import assert from "node:assert/strict";
import test from "node:test";

import { getSafeErrorDetail, getSafeProviderDetail } from "../lib/api-errors";

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
    return;
  }

  Reflect.set(process.env, "NODE_ENV", value);
}

test.afterEach(() => {
  setNodeEnv(originalNodeEnv);
});

test("getSafeErrorDetail returns detailed messages outside production", () => {
  setNodeEnv("development");

  assert.equal(getSafeErrorDetail(new Error("database exploded")), "database exploded");
});

test("getSafeErrorDetail returns a generic message in production", () => {
  setNodeEnv("production");

  assert.equal(getSafeErrorDetail(new Error("database exploded")), "An unexpected server error occurred.");
});

test("getSafeErrorDetail supports production-safe custom details", () => {
  setNodeEnv("production");

  assert.equal(
    getSafeErrorDetail(new Error("provider secret"), "The AI service is temporarily unavailable."),
    "The AI service is temporarily unavailable.",
  );
});

test("getSafeProviderDetail hides provider details in production", () => {
  setNodeEnv("production");

  assert.equal(
    getSafeProviderDetail("raw provider response", "Provider unavailable."),
    "Provider unavailable.",
  );
});

test("getSafeProviderDetail exposes provider details in development", () => {
  setNodeEnv("development");

  assert.equal(
    getSafeProviderDetail("raw provider response", "Provider unavailable."),
    "raw provider response",
  );
});
