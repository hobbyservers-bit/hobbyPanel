import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CHALLENGE_COOKIE, verifyChallengeToken } from "@/lib/two-factor-challenge";
import { generateCode, hashCode, codeExpiry } from "@/lib/email-2fa-code";
import { sendTwoFactorCode } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const userId = verifyChallengeToken(cookieStore.get(CHALLENGE_COOKIE)?.value);

  if (!userId) {
    return NextResponse.json(
      { error: "Challenge expired. Please sign in again." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailTwoFactorEnabled: true, emailTwoFactorExpiry: true },
  });

  if (!user?.emailTwoFactorEnabled) {
    return NextResponse.json({ error: "Email 2FA not configured." }, { status: 400 });
  }

  // Simple rate-limit: don't resend if a code was issued less than 60s ago
  if (user.emailTwoFactorExpiry) {
    const issuedAt = user.emailTwoFactorExpiry.getTime() - 10 * 60 * 1000;
    if (Date.now() - issuedAt < 60_000) {
      return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
    }
  }

  const code = generateCode();
  await prisma.user.update({
    where: { id: userId },
    data: { emailTwoFactorCode: hashCode(code), emailTwoFactorExpiry: codeExpiry() },
  });

  try {
    await sendTwoFactorCode(user.email, code);
  } catch (e) {
    console.error("[email-resend] Failed:", e);
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
