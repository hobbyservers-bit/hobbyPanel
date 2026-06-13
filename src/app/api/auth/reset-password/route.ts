/**
 * POST /api/auth/reset-password
 *
 * Verifies the reset token (single-use, 1-hour expiry) and sets the new password.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

const Schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: token },
    select: { id: true, passwordResetExpiry: true },
  });

  if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken:  null,
      passwordResetExpiry: null,
      // Clicking a reset link proves email ownership
      emailVerified:    true,
      emailVerifyToken:  null,
      emailVerifyExpiry: null,
    },
  });

  // Invalidate all existing sessions after password reset
  await prisma.session.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
}
