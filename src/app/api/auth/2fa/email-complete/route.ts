import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { CHALLENGE_COOKIE, verifyChallengeToken } from "@/lib/two-factor-challenge";
import { verifyCode } from "@/lib/email-2fa-code";
import { cacheGet, cacheSet } from "@/lib/redis";

export const dynamic = "force-dynamic";

const Schema = z.object({ code: z.string().min(6).max(6) });

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

  // Rate limit: 5 attempts per challenge window
  const rateLimitKey = `email2fa_attempts:${userId}`;
  const attempts = (await cacheGet<number>(rateLimitKey)) ?? 0;
  if (attempts >= 5) {
    return NextResponse.json(
      { error: "Too many attempts. Please sign in again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, emailTwoFactorEnabled: true, emailTwoFactorCode: true, emailTwoFactorExpiry: true },
  });

  if (!user?.emailTwoFactorEnabled || !user.emailTwoFactorCode) {
    return NextResponse.json({ error: "Email 2FA is not configured on this account." }, { status: 400 });
  }

  if (!user.emailTwoFactorExpiry || user.emailTwoFactorExpiry < new Date()) {
    return NextResponse.json(
      { error: "Code has expired. Please sign in again to receive a new code." },
      { status: 400 }
    );
  }

  const valid = verifyCode(parsed.data.code, user.emailTwoFactorCode);

  if (!valid) {
    await cacheSet(rateLimitKey, attempts + 1, 10 * 60);
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  // Valid — clear the code and issue session
  await prisma.user.update({
    where: { id: userId },
    data: { emailTwoFactorCode: null, emailTwoFactorExpiry: null },
  });

  const token = await createSession(userId);
  const res   = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(CHALLENGE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
