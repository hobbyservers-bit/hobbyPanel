import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eggId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { eggId } = await params;
  const egg = await prisma.egg.findUnique({
    where: { id: eggId },
    include: {
      variables: { orderBy: { sortOrder: "asc" } },
      _count: { select: { servers: true } },
    },
  });
  if (!egg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ egg });
}

const UpdateEggSchema = z.object({
  name:             z.string().min(1).max(100).optional(),
  author:           z.string().max(100).optional(),
  description:      z.string().max(500).optional(),
  dockerImage:      z.string().min(1).max(200).optional(),
  dockerImages:     z.record(z.string()).optional(),
  startup:          z.string().min(1).max(500).optional(),
  configStop:       z.string().optional(),
  configStartup:    z.string().optional(),
  configFiles:      z.string().optional(),
  installScript:    z.string().optional(),
  installContainer: z.string().optional(),
  itzgType:         z.string().optional(),
  features:         z.array(z.string()).optional(),
});

const VariableSchema = z.object({
  id:           z.string().cuid().optional(),
  name:         z.string().min(1).max(100),
  description:  z.string().max(500).default(""),
  envVariable:  z.string().min(1).max(100).regex(/^[A-Z0-9_]+$/, "Must be UPPER_SNAKE_CASE"),
  defaultValue: z.string().max(500).default(""),
  userViewable: z.boolean().default(true),
  userEditable: z.boolean().default(true),
  rules:        z.string().max(200).default(""),
  sortOrder:    z.number().int().default(0),
});

const PatchBodySchema = UpdateEggSchema.extend({
  variables: z.array(VariableSchema).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eggId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { eggId } = await params;
  const egg = await prisma.egg.findUnique({ where: { id: eggId } });
  if (!egg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { variables, ...eggData } = parsed.data;

  if (eggData.name && eggData.name !== egg.name) {
    const conflict = await prisma.egg.findUnique({ where: { name: eggData.name } });
    if (conflict) return NextResponse.json({ error: "An egg with that name already exists" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const e = await tx.egg.update({ where: { id: eggId }, data: eggData });

    if (variables !== undefined) {
      // Replace all variables with the new set
      await tx.eggVariable.deleteMany({ where: { eggId } });
      if (variables.length > 0) {
        await tx.eggVariable.createMany({
          data: variables.map(({ id: _id, ...v }) => ({ ...v, eggId })),
        });
      }
    }

    return tx.egg.findUnique({
      where: { id: eggId },
      include: { variables: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return NextResponse.json({ egg: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eggId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { eggId } = await params;
  const egg = await prisma.egg.findUnique({
    where: { id: eggId },
    include: { _count: { select: { servers: true } } },
  });
  if (!egg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (egg._count.servers > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${egg._count.servers} server(s) use this egg.` },
      { status: 409 }
    );
  }

  await prisma.egg.delete({ where: { id: eggId } });
  return NextResponse.json({ success: true });
}
