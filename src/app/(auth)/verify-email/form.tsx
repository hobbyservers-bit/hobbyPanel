"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  email: string;
  error?: string;
}

export function VerifyEmailForm({ email, error }: Props) {
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendError, setResendError] = useState("");

  async function handleResend() {
    setLoading(true);
    setResendError("");
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setResendError("Could not send email — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const errorMessages: Record<string, string> = {
    expired: "That verification link has expired.",
    invalid: "That verification link is invalid or has already been used.",
    missing: "No verification token was provided.",
  };

  return (
    <div className="flex flex-col gap-4 text-center">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessages[error] ?? "Something went wrong with your verification link."}
          {error === "expired" && " Please request a new one below."}
        </div>
      )}

      {!error && (
        <p className="text-sm text-muted leading-relaxed">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{email || "your email address"}</span>.
          Click the link in that email to activate your account.
        </p>
      )}

      <p className="text-xs text-muted">
        Check your spam folder if you don&apos;t see it within a minute.
      </p>

      {sent ? (
        <p className="text-sm text-green-400">Email sent! Check your inbox.</p>
      ) : (
        <>
          {resendError && <p className="text-xs text-destructive">{resendError}</p>}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={loading}
            onClick={handleResend}
            disabled={!email}
          >
            Resend verification email
          </Button>
        </>
      )}
    </div>
  );
}
