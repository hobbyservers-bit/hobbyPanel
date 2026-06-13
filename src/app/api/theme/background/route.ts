import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as fs from "fs/promises";
import * as path from "path";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { UserTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "themes", user.id);

  // Remove old background files
  try {
    const existing = await fs.readdir(dir);
    await Promise.all(
      existing.filter((f) => f.startsWith("bg.")).map((f) => fs.unlink(path.join(dir, f)))
    );
  } catch { /* dir doesn't exist yet */ }

  await fs.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, `bg.${ext}`), buffer);

  const url = `/uploads/themes/${user.id}/bg.${ext}`;

  // Update themeData
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { themeData: true } });
  const current = (dbUser?.themeData ?? {}) as UserTheme;
  const updated: UserTheme = { ...current, bgImage: url };

  await prisma.user.update({ where: { id: user.id }, data: { themeData: updated as unknown as import("@prisma/client").Prisma.InputJsonValue } });

  const cookieStore = await cookies();
  cookieStore.set("hp_theme", JSON.stringify(updated), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ url });
}

export async function DELETE() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dir = path.join(process.cwd(), "public", "uploads", "themes", user.id);
  try {
    const existing = await fs.readdir(dir);
    await Promise.all(
      existing.filter((f) => f.startsWith("bg.")).map((f) => fs.unlink(path.join(dir, f)))
    );
  } catch { /* dir doesn't exist */ }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { themeData: true } });
  const { bgImage: _bi, bgImageOpacity: _bio, bgImageBlur: _bib, ...rest } =
    (dbUser?.themeData ?? {}) as UserTheme;
  void _bi; void _bio; void _bib;

  await prisma.user.update({ where: { id: user.id }, data: { themeData: rest as unknown as import("@prisma/client").Prisma.InputJsonValue } });

  const cookieStore = await cookies();
  cookieStore.set("hp_theme", JSON.stringify(rest), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
