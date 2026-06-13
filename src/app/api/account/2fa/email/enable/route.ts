import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/email-2fa-code";

export const dynamic = "force-dynamic";

const Schema = z.object({ code: z.string().min(6).max(6) });

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailTwoFactorCode: true, emailTwoFactorExpiry: true, emailTwoFactorEnabled: true },
  });

  if (dbUser?.emailTwoFactorEnabled) {
    return NextResponse.json({ error: "Email 2FA is already enabled." }, { status: 409 });
  }

  if (!dbUser?.emailTwoFactorCode || !dbUser.emailTwoFactorExpiry || dbUser.emailTwoFactorExpiry < new Date()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }

  if (!verifyCode(parsed.data.code, dbUser.emailTwoFactorCode)) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailTwoFactorEnabled: true,
      emailTwoFactorCode:    null,
      emailTwoFactorExpiry:  null,
    },
  });

  return NextResponse.json({ ok: true });
}
