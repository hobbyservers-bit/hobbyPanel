import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { EmailTwoFactorForm } from "./form";

export const metadata: Metadata = { title: "Check your email — HobbyPanel" };

export default function EmailTwoFactorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
          <p className="text-sm text-muted text-center">
            We sent a 6-digit code to your email address.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <EmailTwoFactorForm />
        </div>
      </div>
    </div>
  );
}
