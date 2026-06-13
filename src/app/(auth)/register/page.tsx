import type { Metadata } from "next";
import Link from "next/link";
import { Server } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Server className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
        </div>

        {/* Form */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <RegisterForm />
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
