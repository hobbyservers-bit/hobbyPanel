"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill referral code from ?ref= query param
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email    = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirm  = formData.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, string> = { email, password };
      if (referralCode.trim()) body.referralCode = referralCode.trim();

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { error?: string; requiresVerification?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      const params = new URLSearchParams({ email });
      router.push(`/verify-email?${params.toString()}`);
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

      <Input label="Email" name="email" type="email" autoComplete="email"
        required placeholder="you@example.com" />

      <Input label="Password" name="password" type="password" autoComplete="new-password"
        required placeholder="At least 8 characters" minLength={8} />

      <Input label="Confirm password" name="confirm" type="password" autoComplete="new-password"
        required placeholder="••••••••" />

      <div className="flex flex-col gap-1">
        <Input
          label="Referral code (optional)"
          name="referralCode"
          type="text"
          placeholder="e.g. ABCD1234"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          maxLength={20}
        />
        {referralCode && (
          <p className="text-xs text-accent">
            Referral code applied — your friend will earn a commission when you purchase credits.
          </p>
        )}
      </div>

      <Button type="submit" loading={loading} className="mt-1 w-full">
        Create account
      </Button>
    </form>
  );
}
