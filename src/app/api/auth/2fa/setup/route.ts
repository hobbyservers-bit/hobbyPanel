/**
 * POST /api/auth/2fa/setup
 *
 * Generates a new TOTP secret, saves it as pendingTotpSecret on the user,
 * and returns the QR code data URL + the secret for manual entry.
 * The secret is NOT yet active — POST /api/auth/2fa/enable confirms it.
 */

import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTotpSecret, generateQRCodeUrl } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateTotpSecret();

  await prisma.user.update({
    where: { id: user.id },
    data: { pendingTotpSecret: secret },
  });

  const qrCode = await generateQRCodeUrl(user.email, secret);

  return NextResponse.json({ secret, qrCode });
}
