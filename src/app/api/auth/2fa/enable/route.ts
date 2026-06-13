/**
 * POST /api/auth/2fa/enable
 *
 * Verifies the TOTP code against the pending secret, then:
 *   - Promotes pendingTotpSecret → totpSecret
 *   - Sets twoFactorEnabled = true
 *   - Generates + stores backup code hashes
 *   - Emails the plaintext backup codes to the user
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { pendingTotpSecret: true, twoFactorEnabled: true },
  });

  if (!dbUser?.pendingTotpSecret) {
    return NextResponse.json({ error: "No pending 2FA setup. Call /api/auth/2fa/setup first." }, { status: 400 });
  }
  if (dbUser.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA is already enabled." }, { status: 400 });
  }

  const valid = await verifyTotpCode(parsed.data.code, dbUser.pendingTotpSecret);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect code. Check your authenticator app and try again." }, { status: 400 });
  }

  const { plain, hashed } = generateBackupCodes();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret:        dbUser.pendingTotpSecret,
      pendingTotpSecret: null,
      twoFactorEnabled:  true,
      backupCodes:       hashed,
    },
  });

  // Send backup codes via email (non-blocking — don't fail the enable on email errors)
  sendBackupCodes(user.email, plain).catch(console.error);

  return NextResponse.json({ ok: true, backupCodes: plain });
}
