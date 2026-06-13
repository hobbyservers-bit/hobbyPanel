import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const LocationSchema = z.object({
  name:        z.string().min(1).max(64).regex(/^[a-z0-9]+(\.[a-z0-9]+)*$/, "Name must be lowercase letters/numbers separated by dots (e.g. us.east.1)"),
  displayName: z.string().min(1).max(64),
});

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { nodes: true } } },
  });

  return NextResponse.json({ locations });
}

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = LocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.location.findUnique({ where: { name: parsed.data.name } });
  if (existing) return NextResponse.json({ error: "A location with that name already exists" }, { status: 409 });

  const location = await prisma.location.create({
    data: parsed.data,
    include: { _count: { select: { nodes: true } } },
  });

  return NextResponse.json({ location }, { status: 201 });
}
