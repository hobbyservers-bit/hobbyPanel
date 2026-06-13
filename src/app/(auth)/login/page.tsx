import type { Metadata } from "next";
import Link from "next/link";
import { Server } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Server className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Sign in to HobbyPanel</h1>
        </div>

        {/* Form */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          No account?{" "}
          <Link
            href="/register"
            className="font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
