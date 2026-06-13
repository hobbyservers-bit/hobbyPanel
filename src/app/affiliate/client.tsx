"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Check, Users, TrendingUp, DollarSign, Percent } from "lucide-react";
import { AFFILIATE_TIERS } from "@/lib/affiliate";

interface Earning {
  id: string;
  amount: number;
  rate: number;
  createdAt: string;
}

interface AffiliateData {
  code: string;
  active: boolean;
  totalEarned: number;
  referralCount: number;
  recentEarnings: Earning[];
}

interface Props {
  initialData: AffiliateData | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={doCopy}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/50 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export function AffiliateClient({ initialData }: Props) {
  const [data, setData]             = useState<AffiliateData | null>(initialData);
  const [generating, startGenerate] = useTransition();
  const [error, setError]           = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = data ? `${origin}/register?ref=${data.code}` : "";

  function generateCode() {
    setError(null);
    startGenerate(async () => {
      try {
        const res = await fetch("/api/affiliate", { method: "POST" });
        const json = await res.json() as { code?: string; error?: string };
        if (!res.ok || !json.code) { setError(json.error ?? "Failed to generate code"); return; }
        setData({
          code:           json.code,
          active:         true,
          totalEarned:    0,
          referralCount:  0,
          recentEarnings: [],
        });
      } catch {
        setError("Network error — please try again");
      }
    });
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {/* How it works */}
        <div className="rounded-xl border border-border bg-surface/50 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: "1", label: "Get your link", desc: "Generate your unique referral link below." },
              { step: "2", label: "Share it", desc: "Share with friends, on social media, or in your community." },
              { step: "3", label: "Earn credits", desc: "When they buy credits, you earn a commission — automatically." },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                  {step}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <div className="text-xs text-muted mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commission tiers */}
        <div className="rounded-xl border border-border bg-surface/50 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Commission Rates</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AFFILIATE_TIERS.map((tier) => (
              <div key={tier.label} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-1.5 text-accent font-semibold">
                  <Percent className="h-3.5 w-3.5" />
                  <span>{Math.round(tier.rate * 100)}%</span>
                </div>
                <div className="mt-1 text-xs text-muted">{tier.label} purchase</div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          onClick={generateCode}
          disabled={generating}
          className="flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate My Affiliate Code"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface/50 p-5">
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <Users className="h-3.5 w-3.5" />
            Referrals
          </div>
          <div className="text-3xl font-bold text-foreground tabular-nums">{data.referralCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface/50 p-5">
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <DollarSign className="h-3.5 w-3.5" />
            Total Earned
          </div>
          <div className="text-3xl font-bold text-amber-300 tabular-nums">{data.totalEarned.toLocaleString()}</div>
          <div className="text-xs text-muted mt-0.5">credits</div>
        </div>
        <div className="rounded-xl border border-border bg-surface/50 p-5">
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Commission
          </div>
          <div className="text-3xl font-bold text-foreground">5–15%</div>
          <div className="text-xs text-muted mt-0.5">of purchase</div>
        </div>
      </div>

      {/* Code + link */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Your Affiliate Code</h2>

        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 font-mono text-xl font-bold tracking-widest text-accent">
            {data.code}
          </code>
          <CopyButton text={data.code} />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">Referral Link</div>
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-muted truncate">
              {referralLink}
            </code>
            <CopyButton text={referralLink} />
          </div>
        </div>

        <p className="text-xs text-muted">
          Share this link — when someone registers using it, they are attributed to you.
          You earn a commission any time they purchase credits.
        </p>
      </div>

      {/* Commission tiers */}
      <div className="rounded-xl border border-border bg-surface/50 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Commission Rates</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {AFFILIATE_TIERS.map((tier) => (
            <div key={tier.label} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-1.5 text-accent font-semibold">
                <Percent className="h-3.5 w-3.5" />
                <span>{Math.round(tier.rate * 100)}%</span>
              </div>
              <div className="mt-1 text-xs text-muted">{tier.label} purchase</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent earnings */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Earnings</h2>

        {data.recentEarnings.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/50 px-6 py-10 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-3 text-muted opacity-30" />
            <p className="text-sm text-muted">No earnings yet. Share your referral link to get started.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">Amount Earned</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Rate</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEarnings.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? "bg-background" : "bg-surface/30"}`}
                  >
                    <td className="px-4 py-3 font-semibold text-amber-300 tabular-nums">
                      +{e.amount.toLocaleString()} credits
                    </td>
                    <td className="px-4 py-3 text-muted">{Math.round(e.rate * 100)}%</td>
                    <td className="px-4 py-3 text-right text-muted whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        View your credit balance on the{" "}
        <Link href="/credits" className="text-accent hover:underline">Credits page</Link>.
      </div>
    </div>
  );
}
