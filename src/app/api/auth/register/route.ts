import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendEmailVerification } from "@/lib/email";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

const RegisterSchema = z.object({
  email:        z.string().email().max(255),
  password:     z.string().min(8, "Password must be at least 8 characters").max(128),
  referralCode: z.string().max(20).optional(),
});

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function POST(req: NextRequest) {
  // ── Rate limiting: 10 registrations per IP per hour ──────────────────────
  const ip = clientIp(req);
  const limit = await rateLimit(`register:ip:${ip}`, 10, 60 * 60);
  if (!limit.ok) return rateLimitResponse(limit.resetAt);

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email, password, referralCode } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  // Always hash — keeps timing consistent whether or not the email exists,
  // preventing enumeration via response timing.
  const passwordHash = await hash(password, ARGON2_OPTIONS);

  if (existing) {
    // Silent no-op: same success shape so the caller can't tell the email is taken.
    return NextResponse.json({ requiresVerification: true }, { status: 201 });
  }

  // Validate the referral code if provided (look it up but don't fail if invalid)
  let affiliateCode: { id: string; userId: string } | null = null;
  if (referralCode) {
    affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code: referralCode.trim().toUpperCase() },
      select: { id: true, userId: true, active: true },
    }).then((c) => (c?.active ? c : null));
  }

  const emailVerifyToken  = randomBytes(32).toString("hex");
  const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: "USER",
      emailVerified: false,
      emailVerifyToken,
      emailVerifyExpiry,
    },
    select: { id: true },
  });

  // Link the referral — but only if the affiliate isn't referring themselves
  if (affiliateCode && affiliateCode.userId !== newUser.id) {
    await prisma.affiliateReferral.create({
      data: {
        affiliateCodeId: affiliateCode.id,
        referredUserId:  newUser.id,
      },
    }).catch(() => { /* ignore race conditions */ });
  }

  try {
    await sendEmailVerification(normalizedEmail, emailVerifyToken);
  } catch (e) {
    console.error("[register] Failed to send verification email:", e);
  }

  return NextResponse.json({ requiresVerification: true }, { status: 201 });
}
