import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptGithubToken,
  encryptGithubToken,
  isEncryptedGithubToken,
} from "../lib/github-token-crypto";

test("encryptGithubToken stores tokens in enc:v1 format and decrypts them", () => {
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "unit-test-encryption-key";

  const token = "gho_example_token_123";
  const encrypted = encryptGithubToken(token);

  assert.equal(isEncryptedGithubToken(encrypted), true);
  assert.match(encrypted, /^enc:v1:/);
  assert.notEqual(encrypted, token);
  assert.equal(decryptGithubToken(encrypted), token);
});

test("decryptGithubToken rejects malformed encrypted values", () => {
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = "unit-test-encryption-key";

  assert.throws(
    () => decryptGithubToken("enc:v1:not-enough-parts"),
    /malformed/i,
  );
});

test("decryptGithubToken preserves legacy plaintext tokens", () => {
  delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  const legacyToken = "legacy_plaintext_token";

  assert.equal(isEncryptedGithubToken(legacyToken), false);
  assert.equal(decryptGithubToken(legacyToken), legacyToken);
});
