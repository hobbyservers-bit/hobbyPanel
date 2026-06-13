import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

interface AdminOk {
  error: null;
  user: SessionUser;
}
interface AdminErr {
  error: NextResponse;
  user: null;
}

export async function requireAdmin(): Promise<AdminOk | AdminErr> {
  const { user } = await validateRequest();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  }
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }
  return { error: null, user };
}
