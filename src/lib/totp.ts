import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

// ── TOTP ──────────────────────────────────────────────────────────────────────

export function generateTotpSecret(): string {
  return generateSecret({ length: 20 });
}

export async function generateQRCodeUrl(userEmail: string, secret: string): Promise<string> {
  const uri = generateURI({ issuer: "HobbyPanel", label: userEmail, secret });
  return QRCode.toDataURL(uri);
}

export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({
      token:          code.replace(/\s/g, ""),
      secret,
      epochTolerance: 30, // allow ±30s clock drift
    });
    return result.valid;
  } catch {
    return false;
  }
}

// ── Backup codes ──────────────────────────────────────────────────────────────
// Format: "ABCD-EFGH" (8 uppercase hex chars split by dash)

export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < 8; i++) {
    const hex = randomBytes(4).toString("hex").toUpperCase();
    plain.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }
  return { plain, hashed: plain.map(hashBackupCode) };
}

export function hashBackupCode(code: string): string {
  const normalized = code.replace(/-/g, "").toUpperCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function verifyAndConsumeBackupCode(
  input: string,
  storedHashes: string[]
): { valid: boolean; remaining: string[] } {
  const inputHash = Buffer.from(hashBackupCode(input), "hex");

  for (let i = 0; i < storedHashes.length; i++) {
    const stored = Buffer.from(storedHashes[i]!, "hex");
    if (stored.length === inputHash.length && timingSafeEqual(stored, inputHash)) {
      const remaining = [...storedHashes];
      remaining.splice(i, 1);
      return { valid: true, remaining };
    }
  }

  return { valid: false, remaining: storedHashes };
}
