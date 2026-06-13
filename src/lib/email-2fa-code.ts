import { createHash, timingSafeEqual } from "crypto";

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyCode(submitted: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(hashCode(submitted), "hex");
    const b = Buffer.from(storedHash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function codeExpiry(): Date {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}
