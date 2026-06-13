import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });

  return NextResponse.json({ codes });
}

const CreateSchema = z.object({
  code:          z.string().min(2).max(32).transform((s) => s.trim().toUpperCase()),
  description:   z.string().max(200).default(""),
  discountType:  z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
  discountValue: z.number().int().min(1).max(10_000),
  maxUses:       z.number().int().min(1).nullable().default(null),
  expiresAt:     z.string().datetime().nullable().default(null),
});

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { code, description, discountType, discountValue, maxUses, expiresAt } = parsed.data;

  // Validate percentage range
  if (discountType === "PERCENT" && discountValue > 100) {
    return NextResponse.json({ error: "Percentage discount cannot exceed 100%" }, { status: 400 });
  }

  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 409 });

  const created = await prisma.promoCode.create({
    data: {
      code,
      description,
      discountType,
      discountValue,
      maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ code: created }, { status: 201 });
}
