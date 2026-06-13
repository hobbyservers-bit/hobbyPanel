"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Server } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-destructive text-center">
        Invalid reset link. <Link href="/forgot-password" className="text-accent hover:underline">Request a new one.</Link>
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-center text-foreground">
        Password updated. Redirecting to sign in…
      </p>
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
        label="New Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        placeholder="Min. 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Confirm Password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        placeholder="Repeat password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button type="submit" loading={loading} className="w-full">
        Set new password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Server className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Set new password</h1>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <Suspense fallback={<p className="text-sm text-muted text-center">Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-accent hover:text-accent/80 transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
