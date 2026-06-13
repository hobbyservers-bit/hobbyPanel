import type { Metadata } from "next";
import { Server } from "lucide-react";
import { TwoFactorForm } from "./form";

export const metadata: Metadata = { title: "Two-Factor Authentication" };

export default function TwoFactorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Server className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Two-Factor Authentication</h1>
          <p className="text-sm text-muted text-center">Enter the 6-digit code from your authenticator app.</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <TwoFactorForm />
        </div>
      </div>
    </div>
  );
}
