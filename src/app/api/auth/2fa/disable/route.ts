/**
 * POST /api/auth/2fa/disable
 *
 * Disables 2FA on the account. Requires either a valid TOTP code
 * or a valid backup code to prevent casual bypass.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotpCode, verifyAndConsumeBackupCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

const Schema = z.object({ code: z.string().min(1).max(20) });

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorEnabled: true, totpSecret: true, backupCodes: true },
  });

  if (!dbUser?.twoFactorEnabled || !dbUser.totpSecret) {
    return NextResponse.json({ error: "2FA is not enabled on this account." }, { status: 400 });
  }

  const { code } = parsed.data;

  // Try TOTP first, then backup codes
  const totpValid = await verifyTotpCode(code, dbUser.totpSecret);
  const { valid: backupValid } = totpValid
    ? { valid: false }
    : verifyAndConsumeBackupCode(code, dbUser.backupCodes);

  if (!totpValid && !backupValid) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled:  false,
      totpSecret:        null,
      pendingTotpSecret: null,
      backupCodes:       [],
    },
  });

  return NextResponse.json({ ok: true });
}
