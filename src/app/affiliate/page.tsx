import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Server, Users } from "lucide-react";
import { validateRequest } from "@/lib/auth";
import { getPanelSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { AffiliateClient } from "./client";

export const metadata: Metadata = { title: "Affiliate — HobbyPanel" };
export const dynamic = "force-dynamic";

export default async function AffiliatePage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    const { maintenanceMode } = await getPanelSettings();
    if (maintenanceMode) redirect("/maintenance");
  }

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

  const initialData = code
    ? {
        code:          code.code,
        active:        code.active,
        totalEarned:   code.totalEarned,
        referralCount: code.referrals.length,
        recentEarnings: code.referrals
          .flatMap((r) =>
            r.earnings.map((e) => ({
              id:        e.id,
              amount:    e.amount,
              rate:      e.rate,
              createdAt: e.createdAt.toISOString(),
            }))
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 20),
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">HobbyPanel</span>
            </Link>
            <span className="text-border">/</span>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Affiliate</span>
            </div>
          </div>
          <span className="hidden text-xs text-muted sm:block">{user.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <AffiliateClient initialData={initialData} />
      </main>
    </div>
  );
}
