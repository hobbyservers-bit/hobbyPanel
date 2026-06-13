"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpCircle, ArrowDownCircle, Gift, ShoppingCart, RefreshCw, Zap, Tag, Users, X, Check } from "lucide-react";

export type CreditTxType = "PURCHASE" | "ADMIN_GRANT" | "ADMIN_DEDUCT" | "BONUS" | "USAGE" | "REFUND" | "PROMO" | "AFFILIATE";

export interface CreditTransaction {
  id: string;
  amount: number;
  type: CreditTxType;
  description: string;
  createdAt: string;
}

interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;   // in dollars
  bonus: number;
  highlight: boolean;
}

interface AppliedDiscount {
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
}

const PACKAGES: Package[] = [
  { id: "starter",  name: "Starter",  credits: 500,  price: 5,  bonus: 0,    highlight: false },
  { id: "popular",  name: "Popular",  credits: 1200, price: 10, bonus: 200,  highlight: true  },
  { id: "value",    name: "Value",    credits: 3000, price: 25, bonus: 500,  highlight: false },
  { id: "premium",  name: "Premium",  credits: 6500, price: 50, bonus: 1500, highlight: false },
];

function calcDiscountedPrice(price: number, discount: AppliedDiscount | null): number {
  if (!discount) return price;
  if (discount.discountType === "PERCENT") {
    return Math.max(0, price * (1 - discount.discountValue / 100));
  }
  // FIXED: discountValue is in cents
  return Math.max(0, price - discount.discountValue / 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function discountLabel(discount: AppliedDiscount): string {
  if (discount.discountType === "PERCENT") return `${discount.discountValue}% off`;
  return `$${(discount.discountValue / 100).toFixed(2)} off`;
}

const TX_META: Record<CreditTxType, { label: string; color: string; icon: React.ReactNode }> = {
  PURCHASE:     { label: "Purchase",    color: "text-green-400",  icon: <ShoppingCart className="h-3.5 w-3.5" /> },
  ADMIN_GRANT:  { label: "Admin Grant", color: "text-green-400",  icon: <ArrowUpCircle className="h-3.5 w-3.5" /> },
  ADMIN_DEDUCT: { label: "Admin Deduct",color: "text-red-400",    icon: <ArrowDownCircle className="h-3.5 w-3.5" /> },
  BONUS:        { label: "Bonus",       color: "text-amber-400",  icon: <Gift className="h-3.5 w-3.5" /> },
  USAGE:        { label: "Usage",       color: "text-red-400",    icon: <ArrowDownCircle className="h-3.5 w-3.5" /> },
  REFUND:       { label: "Refund",      color: "text-blue-400",   icon: <RefreshCw className="h-3.5 w-3.5" /> },
  PROMO:        { label: "Discount",    color: "text-purple-400", icon: <Tag className="h-3.5 w-3.5" /> },
  AFFILIATE:    { label: "Affiliate",   color: "text-accent",     icon: <Users className="h-3.5 w-3.5" /> },
};

interface Props {
  initialBalance: number;
  initialTransactions: CreditTransaction[];
}

export function CreditsClient({ initialBalance, initialTransactions }: Props) {
  const [balance, setBalance]           = useState(initialBalance);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [refreshing, startRefresh]      = useTransition();

  const [discountInput, setDiscountInput]   = useState("");
  const [discountError, setDiscountError]   = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [applying, startApply]              = useTransition();

  function refresh() {
    startRefresh(async () => {
      const r = await fetch("/api/credits");
      if (r.ok) {
        const data = await r.json() as { balance: number; transactions: CreditTransaction[] };
        setBalance(data.balance);
        setTransactions(data.transactions);
      }
    });
  }

  function applyDiscount() {
    if (!discountInput.trim()) return;
    setDiscountError(null);
    startApply(async () => {
      try {
        const res = await fetch("/api/credits/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: discountInput.trim() }),
        });
        const json = await res.json() as {
          valid?: boolean;
          code?: string;
          description?: string;
          discountType?: string;
          discountValue?: number;
          error?: string;
        };
        if (!res.ok || !json.valid) {
          setDiscountError(json.error ?? "Invalid code");
        } else {
          setAppliedDiscount({
            code:          json.code!,
            description:   json.description ?? "",
            discountType:  json.discountType as "PERCENT" | "FIXED",
            discountValue: json.discountValue!,
          });
          setDiscountInput("");
        }
      } catch {
        setDiscountError("Network error — please try again");
      }
    });
  }

  return (
    <div className="space-y-8">

      {/* ── Balance card ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-background p-6">
        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-full bg-amber-600/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-4">
            <Image src="/assets/icons/credits_icon.png" alt="Credits" width={24} height={24} className="opacity-90" />
            <span className="text-sm font-medium text-amber-300/70">Your Balance</span>
          </div>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-bold text-amber-300 tabular-nums">{balance.toLocaleString()}</span>
            <span className="mb-1 text-lg text-amber-400/60 font-medium">credits</span>
          </div>
          <p className="mt-2 text-xs text-muted">
            ≈ <span className="text-amber-400/80">${(balance / 100).toFixed(2)}</span> USD equivalent
          </p>
        </div>
      </div>

      {/* ── Purchase packages ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Purchase Credits</h2>
          <span className="text-xs text-muted">$1 = 100 credits</span>
        </div>

        {/* Applied discount banner */}
        {appliedDiscount && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-400 shrink-0" />
              <span className="font-mono font-bold text-green-300">{appliedDiscount.code}</span>
              <span className="text-green-400/80">— {discountLabel(appliedDiscount)} applied</span>
              {appliedDiscount.description && (
                <span className="hidden text-xs text-green-400/60 sm:inline">· {appliedDiscount.description}</span>
              )}
            </div>
            <button
              onClick={() => setAppliedDiscount(null)}
              className="text-green-400/60 hover:text-green-300 transition-colors"
              title="Remove discount"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PACKAGES.map((pkg) => {
            const discountedPrice = calcDiscountedPrice(pkg.price, appliedDiscount);
            const hasDiscount = appliedDiscount && discountedPrice < pkg.price;
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-xl border p-4 transition-colors ${
                  pkg.highlight
                    ? "border-amber-500/50 bg-amber-950/30 hover:border-amber-500/70"
                    : "border-border bg-surface hover:border-border/80"
                }`}
              >
                {pkg.highlight && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-black">
                      POPULAR
                    </span>
                  </div>
                )}

                <div className="mb-3 flex items-center gap-1.5">
                  <Image src="/assets/icons/credits_icon.png" alt="" width={16} height={16} className="opacity-75" />
                  <span className="text-xs font-medium text-muted">{pkg.name}</span>
                </div>

                <div className="mb-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {pkg.credits.toLocaleString()}
                  </span>
                  {pkg.bonus > 0 && (
                    <div className="mt-0.5 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span className="text-xs text-amber-400">+{pkg.bonus.toLocaleString()} bonus</span>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-3">
                  {hasDiscount ? (
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-green-400">${discountedPrice.toFixed(2)}</span>
                      <span className="text-sm text-muted line-through">${pkg.price}</span>
                    </div>
                  ) : (
                    <div className="mb-2 text-lg font-semibold text-foreground">${pkg.price}</div>
                  )}
                  <button
                    disabled
                    className="w-full rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs text-muted cursor-not-allowed"
                    title="Payment processing coming soon"
                  >
                    Coming soon
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-muted text-center">
          Payment processing is being set up. Contact an admin to receive credits.
        </p>
      </div>

      {/* ── Discount code ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Discount Code</h2>
        {appliedDiscount ? (
          <p className="text-xs text-muted">
            Code <span className="font-mono font-semibold text-green-400">{appliedDiscount.code}</span> is applied above.{" "}
            <button onClick={() => setAppliedDiscount(null)} className="text-accent hover:underline">Remove it</button> to enter a different one.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={discountInput}
                onChange={(e) => { setDiscountInput(e.target.value.toUpperCase()); setDiscountError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") applyDiscount(); }}
                placeholder="Enter discount code…"
                maxLength={32}
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={applyDiscount}
                disabled={applying || !discountInput.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Tag className="h-3.5 w-3.5" />
                {applying ? "Checking…" : "Apply"}
              </button>
            </div>
            {discountError && (
              <p className="mt-2 text-xs text-red-400">{discountError}</p>
            )}
          </>
        )}
        <p className="mt-2 text-xs text-muted">
          Want to earn credits by referring others?{" "}
          <Link href="/affiliate" className="text-accent hover:underline">Join the affiliate program</Link>.
        </p>
      </div>

      {/* ── Transaction history ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Transaction History</h2>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/50 px-6 py-10 text-center">
            <Image src="/assets/icons/credits_icon.png" alt="" width={32} height={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted">No transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="px-4 py-3 text-left font-medium text-muted">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Description</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Amount</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const meta = TX_META[tx.type];
                  const isPositive = tx.amount > 0;
                  return (
                    <tr
                      key={tx.id}
                      className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? "bg-background" : "bg-surface/30"}`}
                    >
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1.5 ${meta.color}`}>
                          {meta.icon}
                          <span className="font-medium">{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted max-w-[200px] truncate">
                        {tx.description || "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
                        {isPositive ? "+" : ""}{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-muted whitespace-nowrap">
                        {fmtDate(tx.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
