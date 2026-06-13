import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Schema = z.object({
  code: z.string().min(1).max(50).transform((s) => s.trim().toUpperCase()),
});

export async function POST(req: NextRequest) {
  const { user } = await validateRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = clientIp(req);
  const limit = await rateLimit(`promo:${user.id}:${ip}`, 10, 60 * 60);
  if (!limit.ok) return rateLimitResponse(limit.resetAt);

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const { code } = parsed.data;

  const promo = await prisma.promoCode.findUnique({ where: { code } });

  if (!promo || !promo.active) {
    return NextResponse.json({ error: "Code not found or inactive" }, { status: 404 });
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ error: "This code has expired" }, { status: 410 });
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ error: "This code has reached its usage limit" }, { status: 410 });
  }

  return NextResponse.json({
    valid:         true,
    code:          promo.code,
    description:   promo.description,
    discountType:  promo.discountType,
    discountValue: promo.discountValue,
  });
}
