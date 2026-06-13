/**
 * POST /api/auth/2fa/complete
 *
 * Second step of login when 2FA is enabled.
 * Reads the hp_2fa_challenge cookie (HMAC-signed, 10-min TTL),
 * verifies the submitted TOTP code or backup code, then issues a full session.
 *
 * Rate-limited to 5 attempts per challenge to prevent brute-force.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { verifyTotpCode, verifyAndConsumeBackupCode } from "@/lib/totp";
import {
  CHALLENGE_COOKIE,
  verifyChallengeToken,
} from "@/lib/two-factor-challenge";
import { cacheGet, cacheSet } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Schema = z.object({ code: z.string().min(1).max(20) });

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(CHALLENGE_COOKIE)?.value;
  const userId = verifyChallengeToken(challengeToken);

  if (!userId) {
    return NextResponse.json(
      { error: "Challenge expired or invalid. Please sign in again." },
      { status: 401 }
    );
  }

  // Rate limit: max 5 failed attempts per userId per challenge window
  const rateLimitKey = `2fa_attempts:${userId}`;
  const attempts = (await cacheGet<number>(rateLimitKey)) ?? 0;
  if (attempts >= 5) {
    return NextResponse.json(
      { error: "Too many attempts. Please sign in again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, totpSecret: true, backupCodes: true, twoFactorEnabled: true },
  });

  if (!dbUser?.twoFactorEnabled || !dbUser.totpSecret) {
    return NextResponse.json({ error: "2FA is not configured on this account." }, { status: 400 });
  }

  const { code } = parsed.data;

  // Try TOTP first
  const totpValid = await verifyTotpCode(code, dbUser.totpSecret);

  if (!totpValid) {
    // Try backup code
    const { valid: backupValid, remaining } = verifyAndConsumeBackupCode(code, dbUser.backupCodes);

    if (!backupValid) {
      // Increment attempt counter (TTL 10 min)
      await cacheSet(rateLimitKey, attempts + 1, 10 * 60);
      return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
    }

    // Backup code used — remove it from the list
    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: remaining },
    });
  }

  // Code is valid — issue full session and clear challenge cookie
  const token = await createSession(userId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  // Clear the pending challenge cookie
  res.cookies.set(CHALLENGE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

  return res;
}
