"use client";

import { useState } from "react";
import Link from "next/link";
import { Server } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
            <Server className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Forgot password?</h1>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          {submitted ? (
            <div className="text-center">
              <p className="text-sm text-foreground font-medium mb-2">Check your email</p>
              <p className="text-xs text-muted leading-relaxed">
                If an account exists for <strong className="text-foreground">{email}</strong>,
                we sent a reset link. It expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" loading={loading} className="w-full">
                Send reset link
              </Button>
            </form>
          )}
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
