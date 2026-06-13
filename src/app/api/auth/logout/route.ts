import { NextResponse } from "next/server";
import {
  validateRequest,
  invalidateSession,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST() {
  const { session } = await validateRequest();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await invalidateSession(session.id);

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
