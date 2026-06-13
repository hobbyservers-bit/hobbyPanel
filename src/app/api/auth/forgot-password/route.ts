/**
 * POST /api/auth/forgot-password
 *
 * Generates a single-use, 1-hour password reset token and emails a link.
 * Always returns 200 to avoid revealing whether an email exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendPasswordReset } from "@/lib/email";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  // ── Rate limiting: 10 attempts per IP per hour ────────────────────────────
  const ip = clientIp(req);
  const limit = await rateLimit(`fp:ip:${ip}`, 10, 60 * 60);
  if (!limit.ok) return rateLimitResponse(limit.resetAt);

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true }); // silent fail

  const email = parsed.data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    const token = randomBytes(32).toString("base64url");
    const expiry = new Date(Date.now() + 60 * 60 * 1_000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    sendPasswordReset(email, token).catch(console.error);
  }

  // Always 200 — don't leak whether the email exists
  return NextResponse.json({ ok: true });
}
