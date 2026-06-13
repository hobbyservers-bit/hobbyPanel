"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function EmailTwoFactorForm() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code,    setCode]    = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent,  setResent]  = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);

    try {
      const res  = await fetch("/api/auth/2fa/email-complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        setCode("");
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

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/2fa/email-resend", { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Could not resend code"); return; }
      setResent(true);
      setCode("");
      setTimeout(() => setResent(false), 5000);
    } catch {
      setError("Network error — please try again");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {resent && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          New code sent — check your inbox.
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        maxLength={6}
        className="w-full rounded-md border border-border bg-background px-3 py-3 text-center text-2xl font-mono tracking-widest text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent"
        required
      />

      <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full">
        Verify
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="text-center text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
      >
        {resending ? "Sending…" : "Resend code"}
      </button>

      <button
        type="button"
        onClick={() => router.push("/login")}
        className="text-center text-xs text-muted hover:text-foreground transition-colors"
      >
        Back to sign in
      </button>
    </form>
  );
}
