import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  active:      z.boolean().optional(),
  description: z.string().max(200).optional(),
  maxUses:     z.number().int().min(1).nullable().optional(),
  expiresAt:   z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { active, description, maxUses, expiresAt } = parsed.data;

  const updated = await prisma.promoCode.update({
    where: { id },
    data: {
      ...(active      !== undefined && { active }),
      ...(description !== undefined && { description }),
      ...(maxUses     !== undefined && { maxUses }),
      ...(expiresAt   !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
  }).catch(() => null);

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ code: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { id } = await params;
  await prisma.promoCode.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
