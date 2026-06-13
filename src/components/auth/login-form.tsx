"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email    = formData.get("email")    as string;
    const password = formData.get("password") as string;

    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        error?: string;
        requires2fa?: boolean;
        requiresEmailCode?: boolean;
        requiresEmailVerification?: boolean;
      };

      if (res.status === 403 && data.requiresEmailVerification) {
        setUnverifiedEmail(email);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }

      if (data.requires2fa) {
        router.push("/login/2fa");
        return;
      }

      if (data.requiresEmailCode) {
        router.push("/login/email-2fa");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (unverifiedEmail) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-3 text-sm text-yellow-300">
          <p className="font-medium mb-1">Email not verified</p>
          <p className="text-xs text-yellow-300/80">
            Please check your inbox for{" "}
            <span className="font-medium text-yellow-200">{unverifiedEmail}</span>{" "}
            and click the verification link before signing in.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-center text-xs font-medium text-foreground hover:border-accent/50 transition-colors"
          >
            Resend verification email
          </Link>
          <button
            onClick={() => setUnverifiedEmail(null)}
            className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:text-foreground transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="••••••••"
      />

      <Button type="submit" loading={loading} className="mt-1 w-full">
        Sign in
      </Button>

      <p className="text-center text-xs text-muted">
        <Link href="/forgot-password" className="hover:text-foreground transition-colors">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
