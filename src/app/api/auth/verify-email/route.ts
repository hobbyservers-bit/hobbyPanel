import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/verify-email?error=missing`);
  }

  const user = await prisma.user.findUnique({
    where: { emailVerifyToken: token },
    select: { id: true, emailVerifyExpiry: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.redirect(`${appUrl}/verify-email?error=invalid`);
  }

  if (user.emailVerified) {
    // Already verified — just log them in
    const sessionToken = await createSession(user.id);
    const res = NextResponse.redirect(`${appUrl}/dashboard`);
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return res;
  }

  if (!user.emailVerifyExpiry || user.emailVerifyExpiry < new Date()) {
    return NextResponse.redirect(`${appUrl}/verify-email?error=expired`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified:    true,
      emailVerifyToken:  null,
      emailVerifyExpiry: null,
    },
  });

  const sessionToken = await createSession(user.id);
  const res = NextResponse.redirect(`${appUrl}/dashboard`);
  res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return res;
}
