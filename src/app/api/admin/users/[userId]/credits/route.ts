import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { applyAffiliateCommission } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  amount:           z.number().int().min(1).max(100_000),
  type:             z.enum(["ADMIN_GRANT", "ADMIN_DEDUCT"]),
  description:      z.string().max(200).default(""),
  // When true, treats this grant as a real purchase and pays out affiliate commission
  triggerAffiliate: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, credits: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { amount, type, description, triggerAffiliate } = parsed.data;
  const delta = type === "ADMIN_GRANT" ? amount : -amount;
  const newBalance = user.credits + delta;

  if (newBalance < 0) {
    return NextResponse.json({ error: "Cannot deduct more credits than the user has." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { credits: newBalance },
      select: { credits: true },
    });

    await tx.creditTransaction.create({
      data: { userId, amount: delta, type, description },
    });

    // Apply affiliate commission if this grant represents a real purchase
    if (type === "ADMIN_GRANT" && triggerAffiliate && amount > 0) {
      await applyAffiliateCommission(userId, amount, tx as typeof prisma);
    }

    return u;
  });

  return NextResponse.json({ balance: updated.credits });
}
