import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Server } from "lucide-react";
import { validateRequest } from "@/lib/auth";
import { getPanelSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { CreditsClient } from "./client";
import type { CreditTransaction } from "./client";

export const metadata: Metadata = { title: "Credits — HobbyPanel" };
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    const { maintenanceMode } = await getPanelSettings();
    if (maintenanceMode) redirect("/maintenance");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      credits: true,
      creditTxns: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, amount: true, type: true, description: true, createdAt: true },
      },
    },
  });

  const balance = dbUser?.credits ?? 0;
  const transactions: CreditTransaction[] = (dbUser?.creditTxns ?? []).map((t) => ({
    ...t,
    type: t.type as CreditTransaction["type"],
    createdAt: t.createdAt.toISOString(),
  }));

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
              <Image src="/assets/icons/credits_icon.png" alt="Credits" width={16} height={16} />
              <span className="text-sm font-semibold text-foreground">Credits</span>
            </div>
          </div>
          <span className="hidden text-xs text-muted sm:block">{user.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <CreditsClient
          initialBalance={balance}
          initialTransactions={transactions}
        />
      </main>
    </div>
  );
}
