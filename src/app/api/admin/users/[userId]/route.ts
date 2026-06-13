import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

const PatchUserSchema = z.object({
  email:    z.string().email().max(255).transform((e) => e.toLowerCase()).optional(),
  password: z.string().min(8).max(128).optional(),
  role:     z.enum(["USER", "ADMIN"]).optional(),
  plan:     z.enum(["FREE", "PRO"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { userId } = await params;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, password, role, plan } = parsed.data;

  if (email && email !== target.email) {
    const conflict = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (conflict) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const updateData: Record<string, unknown> = {};
  if (email)    updateData.email        = email;
  if (password) updateData.passwordHash = await hash(password, ARGON2_OPTIONS);
  if (role)     updateData.role         = role;
  if (plan)     updateData.plan         = plan;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, role: true, plan: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      action: "admin.user.edit",
      metadata: { targetUserId: userId, changes: Object.keys(updateData) },
    },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { userId } = await params;

  if (userId === access.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.delete({ where: { id: userId } });

  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      action: "admin.user.delete",
      metadata: { targetEmail: target.email },
    },
  });

  return NextResponse.json({ ok: true });
}
