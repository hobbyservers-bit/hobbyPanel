import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCode, hashCode, codeExpiry } from "@/lib/email-2fa-code";
import { sendTwoFactorCode } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailTwoFactorExpiry: true },
  });

  // Rate-limit: 60s between sends
  if (dbUser?.emailTwoFactorExpiry) {
    const issuedAt = dbUser.emailTwoFactorExpiry.getTime() - 10 * 60 * 1000;
    if (Date.now() - issuedAt < 60_000) {
      return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
    }
  }

  const code = generateCode();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailTwoFactorCode: hashCode(code), emailTwoFactorExpiry: codeExpiry() },
  });

  try {
    await sendTwoFactorCode(user.email, code);
  } catch (e) {
    console.error("[account/2fa/email/send] Failed:", e);
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
