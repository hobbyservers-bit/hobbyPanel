/**
 * Stateless, HMAC-signed "pending 2FA" challenge cookie.
 *
 * After the user passes password check but before they verify their TOTP code,
 * we issue this short-lived cookie instead of a full session. The cookie value
 * is signed so it cannot be forged; no DB write is needed.
 *
 * Cookie: hp_2fa_challenge = base64url( userId:timestamp:nonce:hmac )
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const CHALLENGE_COOKIE = "hp_2fa_challenge";

const EXPIRES_MS = 10 * 60 * 1_000; // 10 minutes

function secret(): string {
  const s = process.env.TWO_FACTOR_CHALLENGE_SECRET;
  if (!s) console.warn("[2fa] TWO_FACTOR_CHALLENGE_SECRET is not set — using insecure dev default");
  return s ?? "dev-challenge-secret-CHANGE-IN-PRODUCTION";
}

export function issueChallengeToken(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const ts    = Date.now().toString();
  const payload = `${userId}:${ts}:${nonce}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyChallengeToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    // format: userId:timestamp:nonce:hmac  — userId may contain cuid chars (no colons)
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;
    const sig     = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);

    const parts = payload.split(":");
    if (parts.length < 3) return null;
    // parts: [userId, timestamp, nonce]
    const ts     = parts[parts.length - 2]!;
    const userId = parts.slice(0, parts.length - 2).join(":");

    // Timing-safe HMAC comparison
    const expected    = createHmac("sha256", secret()).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf      = Buffer.from(sig, "hex");
    if (expectedBuf.length !== sigBuf.length) return null;
    if (!timingSafeEqual(expectedBuf, sigBuf)) return null;

    // Expiry check
    if (Date.now() - parseInt(ts) > EXPIRES_MS) return null;

    return userId;
  } catch {
    return null;
  }
}

export function challengeCookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path:     "/",
    maxAge:   10 * 60, // 10 minutes
  };
}
