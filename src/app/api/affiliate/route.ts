import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateAffiliateCode } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = await prisma.affiliateCode.findUnique({
    where: { userId: user.id },
    include: {
      referrals: {
        include: {
          earnings: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      },
    },
  });

  if (!code) return NextResponse.json({ code: null });

  const referralCount = code.referrals.length;
  const recentEarnings = code.referrals
    .flatMap((r) => r.earnings.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  return NextResponse.json({
    code:          code.code,
    active:        code.active,
    totalEarned:   code.totalEarned,
    referralCount,
    recentEarnings,
  });
}

export async function POST() {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.affiliateCode.findUnique({ where: { userId: user.id } });
  if (existing) return NextResponse.json({ code: existing.code });

  // Generate a unique code (retry on collision)
  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = generateAffiliateCode();
    const conflict = await prisma.affiliateCode.findUnique({ where: { code: candidate } });
    if (!conflict) { code = candidate; break; }
  }
  if (!code) return NextResponse.json({ error: "Failed to generate unique code" }, { status: 500 });

  const created = await prisma.affiliateCode.create({
    data: { userId: user.id, code },
  });

  return NextResponse.json({ code: created.code }, { status: 201 });
}
