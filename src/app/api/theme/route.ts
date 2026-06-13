import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { UserTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { themeData: true },
  });

  const theme = (dbUser?.themeData ?? {}) as UserTheme;
  return NextResponse.json(theme);
}

const ThemeSchema = z.object({
  preset:           z.string().max(32).optional(),
  accentOverride:   z.string().max(50).nullable().optional(),
  bgImage:          z.string().max(500).nullable().optional(),
  bgImageOpacity:   z.number().min(0).max(1).optional(),
  bgImageBlur:      z.number().min(0).max(20).optional(),
});

export async function PATCH(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ThemeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const themeData = parsed.data as UserTheme;

  await prisma.user.update({
    where: { id: user.id },
    data: { themeData: themeData as unknown as import("@prisma/client").Prisma.InputJsonValue },
  });

  const cookieStore = await cookies();
  cookieStore.set("hp_theme", JSON.stringify(themeData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
