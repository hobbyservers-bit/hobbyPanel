import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { validateRequest } from "@/lib/auth";
import { getPanelSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Under Maintenance — HobbyPanel" };
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { user } = await validateRequest();

  // Admins bypass maintenance and go straight to dashboard
  if (user?.role === "ADMIN") redirect("/dashboard");

  // If maintenance mode is off and a user is logged in, send them to dashboard
  const { maintenanceMode } = await getPanelSettings();
  if (!maintenanceMode && user) redirect("/dashboard");
  if (!maintenanceMode && !user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10">
          <Wrench className="h-8 w-8 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Under Maintenance</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            HobbyPanel is currently undergoing scheduled maintenance. We&apos;ll be back shortly.
          </p>
        </div>
        <div className="w-full rounded-lg border border-border bg-surface px-5 py-4 text-left text-xs text-muted space-y-1">
          <p>• Existing servers continue running during maintenance.</p>
          <p>• Your data is safe and no servers are being affected.</p>
          <p>• Please check back in a few minutes.</p>
        </div>
        {user && (
          <p className="text-xs text-muted">
            Signed in as <span className="text-foreground">{user.email}</span>
          </p>
        )}
      </div>
    </div>
  );
}
