import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verify } from "@node-rs/argon2";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueChallengeToken, CHALLENGE_COOKIE, challengeCookieOptions } from "@/lib/two-factor-challenge";
import { generateCode, hashCode, codeExpiry } from "@/lib/email-2fa-code";
import { sendTwoFactorCode } from "@/lib/email";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1).max(256),
});

// Matches the Argon2id parameters used at registration — always run even for
// unknown emails so response timing doesn't leak whether an account exists.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ZElXZFU3YW9TOHE5cTRpMw$7FqZ9PkhF7YGJBajw7W6sFMaBREEqpDxoYSRqDi9GDo";

export async function POST(req: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Two independent buckets so neither IP nor email blasting works alone.
  const ip = clientIp(req);

  // Parse body before rate limiting so we can key on email too.
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // 20 attempts per IP per 15 minutes
  const ipLimit = await rateLimit(`login:ip:${ip}`, 20, 15 * 60);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetAt);

  // 10 attempts per email per 15 minutes (targeted brute-force protection)
  const emailLimit = await rateLimit(`login:email:${email.toLowerCase()}`, 10, 15 * 60);
  if (!emailLimit.ok) return rateLimitResponse(emailLimit.resetAt);

  // ── Auth logic ─────────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      passwordHash: true,
      twoFactorEnabled: true,
      emailTwoFactorEnabled: true,
      emailVerified: true,
    },
  });

  const valid = await verify(user?.passwordHash ?? DUMMY_HASH, password);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json({ requiresEmailVerification: true }, { status: 403 });
  }

  // TOTP 2FA takes priority
  if (user.twoFactorEnabled) {
    const challengeToken = issueChallengeToken(user.id);
    const res = NextResponse.json({ requires2fa: true });
    res.cookies.set(CHALLENGE_COOKIE, challengeToken, challengeCookieOptions());
    return res;
  }

  // Email 2FA
  if (user.emailTwoFactorEnabled) {
    const code = generateCode();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailTwoFactorCode: hashCode(code), emailTwoFactorExpiry: codeExpiry() },
    });
    try { await sendTwoFactorCode(email.toLowerCase(), code); } catch (e) {
      console.error("[login] Failed to send email 2FA code:", e);
    }
    const challengeToken = issueChallengeToken(user.id);
    const res = NextResponse.json({ requiresEmailCode: true });
    res.cookies.set(CHALLENGE_COOKIE, challengeToken, challengeCookieOptions());
    return res;
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
