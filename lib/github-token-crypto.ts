import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTED_TOKEN_PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getGithubTokenEncryptionKey(): Buffer {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is required to encrypt GitHub access tokens.");
  }

  return createHash("sha256").update(secret).digest();
}

export function isEncryptedGithubToken(token: string): boolean {
  return token.startsWith(ENCRYPTED_TOKEN_PREFIX);
}

export function encryptGithubToken(token: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getGithubTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_TOKEN_PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptGithubToken(storedToken: string): string {
  if (!isEncryptedGithubToken(storedToken)) {
    // Backward compatibility for existing plaintext rows. New writes are encrypted.
    return storedToken;
  }

  const [, , ivValue, tagValue, encryptedValue] = storedToken.split(":");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored GitHub token is encrypted but malformed.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getGithubTokenEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
