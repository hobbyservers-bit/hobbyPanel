import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendEmailVerification } from "@/lib/email";

export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Always return 200 to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, emailVerifyExpiry: true },
  });

  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  // Rate-limit: don't resend if current token was issued less than 60 seconds ago
  if (user.emailVerifyExpiry) {
    const issuedAt = user.emailVerifyExpiry.getTime() - 24 * 60 * 60 * 1000;
    if (Date.now() - issuedAt < 60_000) {
      return NextResponse.json({ ok: true }); // Silently rate-limit
    }
  }

  const emailVerifyToken  = randomBytes(32).toString("hex");
  const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken, emailVerifyExpiry },
  });

  try {
    await sendEmailVerification(email, emailVerifyToken);
  } catch (e) {
    console.error("[resend-verification] Email failed:", e);
  }

  return NextResponse.json({ ok: true });
}
