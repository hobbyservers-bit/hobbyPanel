import { prisma } from "./db";

// Commission tiers: sorted descending so the first match wins.
export const AFFILIATE_TIERS = [
  { minCredits: 2000, rate: 0.15, label: "$20+" },
  { minCredits: 1000, rate: 0.12, label: "$10 – $19.99" },
  { minCredits: 500,  rate: 0.08, label: "$5 – $9.99" },
  { minCredits: 100,  rate: 0.05, label: "$1 – $4.99" },
] as const;

export function getAffiliateRate(purchaseCredits: number): number {
  for (const tier of AFFILIATE_TIERS) {
    if (purchaseCredits >= tier.minCredits) return tier.rate;
  }
  return 0;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function generateAffiliateCode(): string {
  return Array.from(
    { length: 8 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

/**
 * Pay out affiliate commission for a credit purchase.
 * Call this inside an existing prisma.$transaction or pass the main client.
 *
 * @param purchasedUserId  The user who made the purchase
 * @param purchaseCredits  The amount of credits purchased (determines rate tier)
 * @param db               Prisma client or transaction client
 */
export async function applyAffiliateCommission(
  purchasedUserId: string,
  purchaseCredits: number,
  db: typeof prisma = prisma
): Promise<void> {
  const referral = await db.affiliateReferral.findUnique({
    where: { referredUserId: purchasedUserId },
    include: { affiliateCode: { select: { id: true, userId: true, active: true } } },
  });

  if (!referral || !referral.affiliateCode.active) return;

  const rate = getAffiliateRate(purchaseCredits);
  if (rate === 0) return;

  const earned = Math.floor(purchaseCredits * rate);
  if (earned === 0) return;

  const affiliateUserId = referral.affiliateCode.userId;

  await db.user.update({
    where: { id: affiliateUserId },
    data: { credits: { increment: earned } },
  });

  await db.creditTransaction.create({
    data: {
      userId: affiliateUserId,
      amount: earned,
      type: "AFFILIATE",
      description: `Affiliate commission (${Math.round(rate * 100)}%) — referred user purchased ${purchaseCredits} credits`,
    },
  });

  await db.affiliateEarning.create({
    data: { referralId: referral.id, amount: earned, rate },
  });

  await db.affiliateCode.update({
    where: { id: referral.affiliateCodeId },
    data: { totalEarned: { increment: earned } },
  });
}
