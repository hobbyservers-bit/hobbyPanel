import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Server } from "lucide-react";
import { validateRequest } from "@/lib/auth";
import { getPanelSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { AccountClient } from "./client";

export const metadata: Metadata = { title: "Account Settings — HobbyPanel" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    const { maintenanceMode } = await getPanelSettings();
    if (maintenanceMode) redirect("/maintenance");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorEnabled: true, backupCodes: true, emailTwoFactorEnabled: true },
  });

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
            <span className="text-sm font-semibold text-foreground">Account</span>
          </div>
          <span className="hidden text-xs text-muted sm:block">{user.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <AccountClient
          email={user.email}
          twoFactorEnabled={dbUser?.twoFactorEnabled ?? false}
          backupCodeCount={dbUser?.backupCodes.length ?? 0}
          emailTwoFactorEnabled={dbUser?.emailTwoFactorEnabled ?? false}
        />
      </main>
    </div>
  );
}
