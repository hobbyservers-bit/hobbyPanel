import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verify, hash } from "@node-rs/argon2";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8, "New password must be at least 8 characters").max(128),
});

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await verify(dbUser.passwordHash, currentPassword);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const passwordHash = await hash(newPassword, ARGON2_OPTIONS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Invalidate all other sessions (keep current session active)
  const { session } = await validateRequest();
  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      ...(session ? { NOT: { id: session.id } } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
