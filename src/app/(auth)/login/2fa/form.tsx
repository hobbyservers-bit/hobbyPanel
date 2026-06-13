"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TwoFactorForm() {
  const router = useRouter();
  const [code,        setCode]        = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [useBackup,   setUseBackup]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [useBackup]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res  = await fetch("/api/auth/2fa/complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: code.trim() }),
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-muted">
          {useBackup ? "Backup Code" : "Authenticator Code"}
        </label>
        <input
          ref={inputRef}
          type={useBackup ? "text" : "text"}
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={useBackup ? "XXXX-XXXX" : "000000"}
          maxLength={useBackup ? 9 : 6}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-xl font-mono tracking-widest text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent"
          required
        />
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Verify
      </Button>

      <button
        type="button"
        onClick={() => { setUseBackup((v) => !v); setCode(""); setError(null); }}
        className="text-center text-xs text-muted hover:text-foreground transition-colors"
      >
        {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
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
