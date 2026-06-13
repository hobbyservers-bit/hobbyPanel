import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const eggs = await prisma.egg.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      variables: { orderBy: { sortOrder: "asc" } },
      _count: { select: { servers: true } },
    },
  });

  return NextResponse.json({ eggs });
}

const CreateEggSchema = z.object({
  name:             z.string().min(1).max(100),
  author:           z.string().max(100).default(""),
  description:      z.string().max(500).default(""),
  dockerImage:      z.string().min(1).max(200),
  dockerImages:     z.record(z.string()).default({}),
  startup:          z.string().min(1).max(500),
  configStop:       z.string().default("stop"),
  configStartup:    z.string().default("{}"),
  configFiles:      z.string().default("{}"),
  installScript:    z.string().default(""),
  installContainer: z.string().default("ghcr.io/pterodactyl/installers:alpine"),
  itzgType:         z.string().default("PAPER"),
  features:         z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateEggSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.egg.findUnique({ where: { name: parsed.data.name } });
  if (existing) return NextResponse.json({ error: "An egg with that name already exists" }, { status: 409 });

  const egg = await prisma.egg.create({ data: parsed.data });
  return NextResponse.json({ egg }, { status: 201 });
}
