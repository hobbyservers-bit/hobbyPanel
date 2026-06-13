/**
 * POST /api/auth/2fa/backup-codes
 *
 * Regenerates all 8 backup codes for the current user.
 * Requires a valid TOTP code to authorize the regeneration.
 * Returns the new plaintext codes (shown once — not stored plaintext).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotpCode, generateBackupCodes } from "@/lib/totp";
import { sendBackupCodes } from "@/lib/email";

export const dynamic = "force-dynamic";

const Schema = z.object({ code: z.string().min(6).max(8) });

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "TOTP code required" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorEnabled: true, totpSecret: true },
  });

  if (!dbUser?.twoFactorEnabled || !dbUser.totpSecret) {
    return NextResponse.json({ error: "2FA is not enabled." }, { status: 400 });
  }

  if (!(await verifyTotpCode(parsed.data.code, dbUser.totpSecret))) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  const { plain, hashed } = generateBackupCodes();

  await prisma.user.update({
    where: { id: user.id },
    data: { backupCodes: hashed },
  });

  sendBackupCodes(user.email, plain).catch(console.error);

  return NextResponse.json({ backupCodes: plain });
}
