"use client";

import { useState, useTransition } from "react";
import {
  Shield, ShieldCheck, ShieldOff, RefreshCw, Copy, Check, KeyRound, AlertTriangle, Mail,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SetupStep = "idle" | "scanning" | "confirming" | "backup_codes";

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/30">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent";
const btnPrimary = "flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50";
const btnGhost   = "flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50";
const btnDanger  = "flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50";

// ── Two-Factor Settings ───────────────────────────────────────────────────────

function TwoFactorSettings({
  twoFactorEnabled: initialEnabled,
  backupCodeCount: initialBackupCount,
}: {
  twoFactorEnabled: boolean;
  backupCodeCount: number;
}) {
  const [enabled,       setEnabled]       = useState(initialEnabled);
  const [backupCount,   setBackupCount]   = useState(initialBackupCount);
  const [step,          setStep]          = useState<SetupStep>("idle");
  const [qrCode,        setQrCode]        = useState<string | null>(null);
  const [secret,        setSecret]        = useState<string | null>(null);
  const [verifyCode,    setVerifyCode]    = useState("");
  const [disableCode,   setDisableCode]   = useState("");
  const [regenCode,     setRegenCode]     = useState("");
  const [backupCodes,   setBackupCodes]   = useState<string[]>([]);
  const [showDisable,   setShowDisable]   = useState(false);
  const [showRegen,     setShowRegen]     = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [pending,       startT]           = useTransition();

  // ── Start setup ──────────────────────────────────────────────────────────

  function startSetup() {
    setError(null);
    startT(async () => {
      const res  = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json() as { secret?: string; qrCode?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Setup failed"); return; }
      setQrCode(data.qrCode!);
      setSecret(data.secret!);
      setStep("scanning");
    });
  }

  function goToConfirm() {
    setVerifyCode("");
    setError(null);
    setStep("confirming");
  }

  // ── Confirm enable ───────────────────────────────────────────────────────

  function confirmEnable() {
    if (!verifyCode.trim()) return;
    setError(null);
    startT(async () => {
      const res  = await fetch("/api/auth/2fa/enable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json() as { ok?: boolean; backupCodes?: string[]; error?: string };
      if (!res.ok) { setError(data.error ?? "Verification failed"); return; }
      setBackupCodes(data.backupCodes!);
      setEnabled(true);
      setBackupCount(8);
      setStep("backup_codes");
      setVerifyCode("");
    });
  }

  // ── Disable ──────────────────────────────────────────────────────────────

  function confirmDisable() {
    if (!disableCode.trim()) return;
    setError(null);
    startT(async () => {
      const res  = await fetch("/api/auth/2fa/disable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: disableCode.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Disable failed"); return; }
      setEnabled(false);
      setBackupCount(0);
      setShowDisable(false);
      setDisableCode("");
      setStep("idle");
    });
  }

  // ── Regenerate backup codes ──────────────────────────────────────────────

  function confirmRegen() {
    if (!regenCode.trim()) return;
    setError(null);
    startT(async () => {
      const res  = await fetch("/api/auth/2fa/backup-codes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: regenCode.trim() }),
      });
      const data = await res.json() as { backupCodes?: string[]; error?: string };
      if (!res.ok) { setError(data.error ?? "Regeneration failed"); return; }
      setBackupCodes(data.backupCodes!);
      setBackupCount(8);
      setShowRegen(false);
      setRegenCode("");
      setStep("backup_codes");
    });
  }

  // ── Copy backup codes ────────────────────────────────────────────────────

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // Show backup codes (after enable or regen)
  if (step === "backup_codes") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-400" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Save these backup codes now</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              They won&apos;t be shown again. Each can only be used once.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((c) => (
            <div key={c} className="rounded-md bg-background border border-border px-3 py-2 text-center font-mono text-sm tracking-widest text-foreground">
              {c}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button className={btnGhost} onClick={copyBackupCodes}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy all"}
          </button>
          <button className={btnPrimary} onClick={() => setStep("idle")}>
            I&apos;ve saved these codes
          </button>
        </div>
      </div>
    );
  }

  // Setup: scanning QR
  if (step === "scanning") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.).
        </p>

        {qrCode && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="TOTP QR code" className="h-44 w-44 rounded-lg border border-border bg-white p-2" />
          </div>
        )}

        {secret && (
          <div className="space-y-1">
            <p className="text-xs text-muted">Can&apos;t scan? Enter this key manually:</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <code className="flex-1 break-all text-xs font-mono text-foreground">{secret}</code>
              <button
                onClick={() => navigator.clipboard.writeText(secret)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => { setStep("idle"); setError(null); }}>Cancel</button>
          <button className={btnPrimary} onClick={goToConfirm} disabled={pending}>
            Next: Verify Code
          </button>
        </div>
      </div>
    );
  }

  // Setup: verify code
  if (step === "confirming") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Enter the 6-digit code from your authenticator app to confirm setup.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={verifyCode}
          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-center text-2xl font-mono tracking-widest text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => { setStep("scanning"); setError(null); }}>Back</button>
          <button
            className={btnPrimary}
            onClick={confirmEnable}
            disabled={pending || verifyCode.length < 6}
          >
            {pending ? "Verifying…" : "Enable 2FA"}
          </button>
        </div>
      </div>
    );
  }

  // Main state: enabled or disabled
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${enabled ? "bg-green-500/10" : "bg-muted/10"}`}>
          {enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-400" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {enabled ? "2FA is enabled" : "2FA is not enabled"}
          </p>
          <p className="text-xs text-muted">
            {enabled
              ? `${backupCount} backup code${backupCount !== 1 ? "s" : ""} remaining`
              : "Protect your account with an authenticator app"}
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!enabled && (
        <button className={btnPrimary} onClick={startSetup} disabled={pending}>
          <Shield className="h-3.5 w-3.5" />
          {pending ? "Loading…" : "Enable Two-Factor Auth"}
        </button>
      )}

      {enabled && (
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => { setShowRegen(true); setShowDisable(false); setError(null); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate backup codes
          </button>
          <button className={btnDanger} onClick={() => { setShowDisable(true); setShowRegen(false); setError(null); }}>
            <ShieldOff className="h-3.5 w-3.5" /> Disable 2FA
          </button>
        </div>
      )}

      {/* Inline disable form */}
      {showDisable && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-xs text-muted">Enter your authenticator code or a backup code to disable 2FA:</p>
          <input
            type="text"
            autoFocus
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="Code"
            maxLength={20}
            className={inputCls}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => { setShowDisable(false); setDisableCode(""); setError(null); }}>Cancel</button>
            <button className={btnDanger} onClick={confirmDisable} disabled={pending || !disableCode.trim()}>
              {pending ? "Disabling…" : "Disable 2FA"}
            </button>
          </div>
        </div>
      )}

      {/* Inline regen form */}
      {showRegen && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-xs text-muted">Enter your current authenticator code to generate new backup codes:</p>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={regenCode}
            onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className={`${inputCls} text-center font-mono tracking-widest text-lg`}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => { setShowRegen(false); setRegenCode(""); setError(null); }}>Cancel</button>
            <button className={btnPrimary} onClick={confirmRegen} disabled={pending || regenCode.length < 6}>
              {pending ? "Generating…" : "Regenerate codes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Email Two-Factor Settings ─────────────────────────────────────────────────

function EmailTwoFactorSettings({ emailTwoFactorEnabled: initialEnabled }: { emailTwoFactorEnabled: boolean }) {
  const [enabled,   setEnabled]   = useState(initialEnabled);
  const [step,      setStep]      = useState<"idle" | "entering_code">("idle");
  const [action,    setAction]    = useState<"enable" | "disable">("enable");
  const [code,      setCode]      = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [pending,   startT]       = useTransition();

  function start(act: "enable" | "disable") {
    setError(null);
    setCode("");
    setAction(act);
    startT(async () => {
      const res  = await fetch("/api/account/2fa/email/send", { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to send code"); return; }
      setStep("entering_code");
    });
  }

  function confirm() {
    if (code.length !== 6) return;
    setError(null);
    const endpoint = action === "enable"
      ? "/api/account/2fa/email/enable"
      : "/api/account/2fa/email/disable";

    startT(async () => {
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Verification failed"); return; }
      setEnabled(action === "enable");
      setStep("idle");
      setCode("");
    });
  }

  if (step === "entering_code") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Enter the 6-digit code we just sent to your email address.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-center text-2xl font-mono tracking-widest text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => { setStep("idle"); setCode(""); setError(null); }}>Cancel</button>
          <button
            className={action === "disable" ? btnDanger : btnPrimary}
            onClick={confirm}
            disabled={pending || code.length !== 6}
          >
            {pending ? "Verifying…" : action === "enable" ? "Enable Email 2FA" : "Disable Email 2FA"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${enabled ? "bg-green-500/10" : "bg-muted/10"}`}>
          {enabled
            ? <ShieldCheck className="h-5 w-5 text-green-400" />
            : <Mail className="h-5 w-5 text-muted" />}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {enabled ? "Email 2FA is enabled" : "Email 2FA is not enabled"}
          </p>
          <p className="text-xs text-muted">
            {enabled
              ? "A code is emailed to you each time you sign in"
              : "Receive a one-time code by email when signing in"}
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!enabled && (
        <button className={btnPrimary} onClick={() => start("enable")} disabled={pending}>
          <Mail className="h-3.5 w-3.5" />
          {pending ? "Sending code…" : "Enable Email 2FA"}
        </button>
      )}

      {enabled && (
        <button className={btnDanger} onClick={() => start("disable")} disabled={pending}>
          <ShieldOff className="h-3.5 w-3.5" />
          {pending ? "Sending code…" : "Disable Email 2FA"}
        </button>
      )}
    </div>
  );
}

// ── Change Password ───────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const [pending,  startT]      = useTransition();

  function submit() {
    setError(null);
    setSuccess(false);

    if (next.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setError("Passwords do not match"); return; }

    startT(async () => {
      const res  = await fetch("/api/account/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to change password"); return; }
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    });
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Password updated successfully.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <input className={inputCls} type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        <input className={inputCls} type="password" placeholder="New password (min. 8 characters)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <input className={inputCls} type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      <button className={btnPrimary} onClick={submit} disabled={pending || !current || !next || !confirm}>
        <KeyRound className="h-3.5 w-3.5" />
        {pending ? "Saving…" : "Update Password"}
      </button>
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export function AccountClient({
  email,
  twoFactorEnabled,
  backupCodeCount,
  emailTwoFactorEnabled,
}: {
  email: string;
  twoFactorEnabled: boolean;
  backupCodeCount: number;
  emailTwoFactorEnabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Account Settings</h1>
        <p className="mt-0.5 text-xs text-muted">{email}</p>
      </div>

      <Section
        title="Authenticator App (TOTP)"
        description="Use an authenticator app like Google Authenticator or Authy."
      >
        <TwoFactorSettings
          twoFactorEnabled={twoFactorEnabled}
          backupCodeCount={backupCodeCount}
        />
      </Section>

      <Section
        title="Email Two-Factor Authentication"
        description="Receive a one-time code by email each time you sign in."
      >
        <EmailTwoFactorSettings emailTwoFactorEnabled={emailTwoFactorEnabled} />
      </Section>

      <Section
        title="Change Password"
        description="Update your account password. You'll be signed out on all other devices."
      >
        <ChangePasswordSection />
      </Section>
    </div>
  );
}
