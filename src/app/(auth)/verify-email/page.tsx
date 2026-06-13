import type { Metadata } from "next";
import Link from "next/link";
import { Server, Mail } from "lucide-react";
import { VerifyEmailForm } from "./form";

export const metadata: Metadata = { title: "Verify your email — HobbyPanel" };

interface Props {
  searchParams: Promise<{ email?: string; error?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email = "", error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {error ? "Verification issue" : "Check your email"}
          </h1>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <VerifyEmailForm email={email} error={error} />
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          Already verified?{" "}
          <Link href="/login" className="font-medium text-accent hover:text-accent/80 transition-colors">
            Sign in
          </Link>
        </p>

        <p className="mt-2 text-center text-sm text-muted">
          Wrong account?{" "}
          <Link href="/register" className="font-medium text-accent hover:text-accent/80 transition-colors">
            Register again
          </Link>
        </p>
      </div>
    </div>
  );
}
