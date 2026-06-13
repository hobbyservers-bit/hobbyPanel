import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      plan: true,
      createdAt: true,
      _count: { select: { servers: true } },
    },
  });

  return NextResponse.json({ users });
}

const CreateUserSchema = z.object({
  email:    z.string().email().max(255).transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(128),
  role:     z.enum(["USER", "ADMIN"]).default("USER"),
  plan:     z.enum(["FREE", "PRO"]).default("FREE"),
});

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, password, role, plan } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, plan, emailVerified: true },
    select: { id: true, email: true, role: true, plan: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: { userId: access.user.id, action: "admin.user.create", metadata: { targetEmail: email, role, plan } },
  });

  return NextResponse.json({ user }, { status: 201 });
}
