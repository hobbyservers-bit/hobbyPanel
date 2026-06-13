"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Server, Info, ExternalLink, ShieldCheck, MapPin,
  ChevronDown, ChevronRight, RefreshCw, Check, Zap,
  HardDrive, Cpu, Database, Archive,
} from "lucide-react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  displayName: string;
  nodeCount: number;
}

interface EggVariable {
  id: string;
  envVariable: string;
  name: string;
  description: string;
  defaultValue: string;
  userViewable: boolean;
  userEditable: boolean;
  rules: string;
}

interface EggOption {
  id: string;
  name: string;
  description: string;
  itzgType: string;
  startup: string;
  variables: EggVariable[];
  dockerImage: string;
  dockerImages: Record<string, string>;
}

interface PlanResources {
  memoryMb: number;
  diskMb: number;
  cpuPercent: number;
  backups: number;
  databases: number;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  badge: string | null;
  highlight: boolean;
  priceMonthly: number;
  resources: PlanResources;
}

interface CustomPricing {
  cpuPerCoreMonthly: number;
  diskPerGbMonthly: number;
  backupPerSlotMonthly: number;
  databasePerInstanceMonthly: number;
}

interface CustomLimits {
  memoryMbMin: number; memoryMbMax: number; memoryMbStep: number;
  diskMbMin: number;   diskMbMax: number;   diskMbStep: number;
  cpuPercentMin: number; cpuPercentMax: number; cpuPercentStep: number;
  backupsMin: number;  backupsMax: number;
  databasesMin: number; databasesMax: number;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  featured: boolean;
  priceMonthly: number;
}

interface NodeTier {
  id: string;
  name: string;
  description: string;
  badge?: string;
  ramPerGbMonthly: number;
}

interface PlansConfig {
  plans: Plan[];
  addons: Addon[];
  custom: { enabled: boolean; pricing: CustomPricing; limits: CustomLimits };
  nodeTiers?: NodeTier[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

type WizardStep = "basics" | "plan" | "custom" | "upgrades" | "type" | "configure" | "eula";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "basics",    label: "Basics"    },
  { id: "plan",      label: "Plan"      },
  { id: "upgrades",  label: "Upgrades"  },
  { id: "type",      label: "Type"      },
  { id: "configure", label: "Configure" },
];

// "custom" is a sub-step of "plan" for indicator purposes
function stepIndicatorId(step: WizardStep): WizardStep {
  return step === "custom" ? "plan" : step;
}

const JAR_TYPE_MAP: Record<string, string> = {
  paper: "paper", purpur: "purpur", fabric: "fabric", vanilla: "vanilla",
};

function jarFromItzgType(itzgType: string): string {
  return JAR_TYPE_MAP[itzgType.toLowerCase()] ?? "paper";
}

function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024 % 1 === 0 ? mb / 1024 : (mb / 1024).toFixed(1))} GB` : `${mb} MB`;
}

function fmtCpu(pct: number): string {
  const cores = pct / 100;
  return cores % 1 === 0 ? `${cores} vCPU` : `${cores.toFixed(1)} vCPU`;
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }) {
  const wizardSteps = STEPS;
  const currentIdx = wizardSteps.findIndex((s) => s.id === stepIndicatorId(current));

  return (
    <div className="flex items-center justify-center gap-0 px-6 pb-4 pt-1">
      {wizardSteps.map((s, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;

        return (
          <div key={s.id} className="flex items-center">
            {i > 0 && (
              <div className={cn("h-px w-8 transition-colors", done ? "bg-accent" : "bg-border")} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
                done    && "border-accent bg-accent text-black",
                active  && "border-accent bg-accent/15 text-accent",
                !done && !active && "border-border bg-surface text-muted"
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={cn("text-[10px] font-medium transition-colors", active ? "text-foreground" : "text-muted")}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Resource row ──────────────────────────────────────────────────────────────

function ResRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted">
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="opacity-70">{label}</span>
      <span className="ml-auto font-medium text-foreground">{value}</span>
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────────────────────

function SliderRow({
  icon, label, value, min, max, step, displayValue, onChange,
}: {
  icon: React.ReactNode; label: string; value: number;
  min: number; max: number; step: number;
  displayValue: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted">
          <span className="opacity-60">{icon}</span>
          {label}
        </div>
        <span className="font-semibold text-foreground">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-border accent-[var(--accent)]"
        style={{ accentColor: "var(--accent)" }}
      />
      <div className="flex justify-between text-[10px] text-muted/50">
        <span>{displayValue.includes("GB") ? fmtMb(min) : displayValue.includes("vCPU") ? fmtCpu(min) : String(min)}</span>
        <span>{displayValue.includes("GB") ? fmtMb(max) : displayValue.includes("vCPU") ? fmtCpu(max) : String(max)}</span>
      </div>
    </div>
  );
}

// ── Plan step ─────────────────────────────────────────────────────────────────

function PlanStep({
  plansConfig,
  selectedPlanId,
  onSelectPlan,
}: {
  plansConfig: PlansConfig | null;
  selectedPlanId: string;
  onSelectPlan: (id: string) => void;
}) {
  if (!plansConfig) {
    return <div className="py-8 text-center text-xs text-muted">Loading plans…</div>;
  }

  const { plans, custom } = plansConfig;

  return (
    <div className="space-y-2">
      {plans.map((plan) => {
        const selected = selectedPlanId === plan.id;
        const isFree   = plan.priceMonthly === 0;

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelectPlan(plan.id)}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-left transition-all",
              selected
                ? plan.highlight
                  ? "border-accent bg-accent/10"
                  : "border-accent/70 bg-accent/5"
                : plan.highlight
                  ? "border-accent/30 bg-surface hover:border-accent/50"
                  : "border-border bg-surface hover:border-border/80"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-foreground/80")}>
                    {plan.name}
                  </span>
                  {plan.badge && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-black">
                      {plan.badge}
                    </span>
                  )}
                  {selected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">{plan.description}</p>
              </div>
              <div className="shrink-0 text-right">
                {isFree ? (
                  <span className="text-sm font-bold text-foreground">Free</span>
                ) : (
                  <>
                    <span className="text-sm font-bold text-foreground">${plan.priceMonthly}</span>
                    <span className="text-[10px] text-muted">/mo</span>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1 text-[11px] text-muted"><Cpu className="h-3 w-3 opacity-60" />{fmtMb(plan.resources.memoryMb)} RAM</span>
              <span className="flex items-center gap-1 text-[11px] text-muted"><Zap className="h-3 w-3 opacity-60" />{fmtCpu(plan.resources.cpuPercent)}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted"><HardDrive className="h-3 w-3 opacity-60" />{fmtMb(plan.resources.diskMb)} disk</span>
              <span className="flex items-center gap-1 text-[11px] text-muted"><Archive className="h-3 w-3 opacity-60" />{plan.resources.backups} backup{plan.resources.backups !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted"><Database className="h-3 w-3 opacity-60" />{plan.resources.databases === 0 ? "No databases" : `${plan.resources.databases} DB${plan.resources.databases !== 1 ? "s" : ""}`}</span>
            </div>
          </button>
        );
      })}

      {/* Custom — simple selectable card; sliders are on the next step */}
      {custom.enabled && (
        <button
          type="button"
          onClick={() => onSelectPlan("custom")}
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-left transition-all",
            selectedPlanId === "custom"
              ? "border-amber-500/60 bg-amber-950/20"
              : "border-border bg-surface hover:border-amber-500/30"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/assets/icons/credits_icon.png" alt="" width={14} height={14} className="opacity-75" />
              <span className="text-sm font-semibold text-foreground">Custom</span>
              {selectedPlanId === "custom" && <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
              <span>Configure resources</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Choose exactly how much RAM, CPU, disk, backups, and databases you need.
          </p>
        </button>
      )}

      {selectedPlanId !== "free" && selectedPlanId !== "" && (
        <p className="text-center text-[11px] text-muted pt-1">
          Paid plans are billed via credits. Contact an admin to get started.
        </p>
      )}
    </div>
  );
}

// ── Upgrades step ────────────────────────────────────────────────────────────

const ADDON_ICONS: Record<string, React.ReactNode> = {
  always_on:        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ddos_protection:  <ShieldCheck className="h-4 w-4" />,
  dedicated_ip:     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  priority_startup: <Zap className="h-4 w-4" />,
  auto_restart:     <RefreshCw className="h-4 w-4" />,
  extra_backups:    <Archive className="h-4 w-4" />,
};

function UpgradesStep({
  addons,
  selectedAddons,
  onToggle,
  planPrice,
}: {
  addons: Addon[];
  selectedAddons: Set<string>;
  onToggle: (id: string) => void;
  planPrice: number;
}) {
  const featured = addons.filter((a) => a.featured);
  const regular  = addons.filter((a) => !a.featured);
  const addonsTotal = addons.filter((a) => selectedAddons.has(a.id)).reduce((s, a) => s + a.priceMonthly, 0);

  return (
    <div className="space-y-4">

      {/* Featured upgrade — 24/7 */}
      {featured.map((addon) => {
        const active = selectedAddons.has(addon.id);
        return (
          <button
            key={addon.id}
            type="button"
            onClick={() => onToggle(addon.id)}
            className={cn(
              "w-full rounded-xl border-2 px-4 py-4 text-left transition-all",
              active
                ? "border-accent bg-accent/10"
                : "border-border bg-surface hover:border-accent/40"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted"
                )}>
                  {ADDON_ICONS[addon.id] ?? <Zap className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{addon.name}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      active ? "bg-accent text-black" : "bg-surface-2 text-muted"
                    )}>
                      {active ? "Added" : "Featured"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{addon.description}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-foreground">+${addon.priceMonthly}</div>
                <div className="text-[10px] text-muted">/mo</div>
              </div>
            </div>

            {/* Toggle bar */}
            <div className={cn(
              "mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors",
              active ? "bg-accent/10 text-accent" : "bg-surface-2 text-muted"
            )}>
              <span>{active ? "Click to remove" : "Click to add to your server"}</span>
              <div className={cn(
                "h-4 w-8 rounded-full border-2 transition-all relative",
                active ? "border-accent bg-accent/30" : "border-border bg-surface"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all",
                  active ? "left-[calc(100%-12px)] bg-accent" : "left-0.5 bg-muted"
                )} />
              </div>
            </div>
          </button>
        );
      })}

      {/* Regular upgrades grid */}
      {regular.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted uppercase tracking-wide">More upgrades</p>
          <div className="grid grid-cols-2 gap-2">
            {regular.map((addon) => {
              const active = selectedAddons.has(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => onToggle(addon.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-all",
                    active
                      ? "border-accent/70 bg-accent/5"
                      : "border-border bg-surface hover:border-accent/30"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      active ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted"
                    )}>
                      {ADDON_ICONS[addon.id] ?? <Zap className="h-3.5 w-3.5" />}
                    </div>
                    <div className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all",
                      active ? "border-accent bg-accent" : "border-border"
                    )}>
                      {active && <Check className="h-2.5 w-2.5 text-black" />}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-foreground">{addon.name}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted line-clamp-2">{addon.description}</p>
                  <p className={cn("mt-2 text-xs font-bold", active ? "text-accent" : "text-muted")}>
                    +${addon.priceMonthly}/mo
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost summary bar */}
      <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-muted">
            <span>Plan</span>
            <span className="font-medium text-foreground">
              {planPrice === 0 ? "Free" : `$${planPrice}/mo`}
            </span>
            {addonsTotal > 0 && (
              <>
                <span className="text-border">+</span>
                <span>Upgrades</span>
                <span className="font-medium text-foreground">+${addonsTotal}/mo</span>
              </>
            )}
          </div>
          <div className="font-bold text-foreground">
            ${planPrice + addonsTotal}<span className="text-[10px] font-normal text-muted">/mo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main dialog ────────────────────────────────────────────────────────────────

export function CreateServerDialog({ open, onClose, onCreated }: Props) {
  const [step, setStep]               = useState<WizardStep>("basics");
  const [name, setName]               = useState("");
  const [eggs, setEggs]               = useState<EggOption[]>([]);
  const [eggsLoading, setEggsLoading] = useState(false);
  const [eggId, setEggId]             = useState("");
  const [selectedEgg, setSelectedEgg] = useState<EggOption | null>(null);
  const [dockerImage, setDockerImage] = useState("");
  const [environment, setEnvironment] = useState<Record<string, string>>({});
  const [versions, setVersions]       = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [createdId, setCreatedId]     = useState<string | null>(null);
  const [eulaChecked, setEulaChecked] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [locations, setLocations]     = useState<Location[]>([]);
  const [locationId, setLocationId]   = useState<string>("");

  // Plan state
  const [plansConfig, setPlansConfig]         = useState<PlansConfig | null>(null);
  const [selectedPlanId, setSelectedPlanId]   = useState<string>("free");
  const [selectedNodeTier, setSelectedNodeTier] = useState<string>("budget");
  const [selectedAddons, setSelectedAddons]   = useState<Set<string>>(new Set());
  const [customResources, setCustomResources] = useState<PlanResources>({
    memoryMb: 4096, diskMb: 20480, cpuPercent: 200, backups: 5, databases: 1,
  });

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    setEggsLoading(true);
    Promise.all([
      fetch("/api/eggs").then((r) => r.json() as Promise<{ eggs?: EggOption[] }>),
      fetch("/api/locations").then((r) => r.json() as Promise<{ locations?: Location[] }>),
      fetch("/api/plans").then((r) => r.json() as Promise<PlansConfig>),
    ])
      .then(([eggData, locData, plans]) => {
        const eggList = eggData.eggs ?? [];
        setEggs(eggList);
        if (eggList.length > 0) {
          const first = eggList[0]!;
          setEggId(first.id);
          setSelectedEgg(first);
          setDockerImage(first.dockerImage);
          initEnv(first);
        }
        const locList = locData.locations ?? [];
        setLocations(locList);
        if (locList.length > 0 && !locationId) setLocationId(locList[0]?.id ?? "");
        setPlansConfig(plans);
        // Set custom sliders to the middle-ish of limits
        const lim = plans.custom.limits;
        setCustomResources({
          memoryMb: Math.min(4096, lim.memoryMbMax),
          diskMb:   Math.min(20480, lim.diskMbMax),
          cpuPercent: Math.min(200, lim.cpuPercentMax),
          backups:  5,
          databases: 1,
        });
      })
      .catch(() => {})
      .finally(() => setEggsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function initEnv(egg: EggOption) {
    const env: Record<string, string> = {};
    for (const v of egg.variables) {
      if (v.userViewable) env[v.envVariable] = v.defaultValue;
    }
    setEnvironment(env);
  }

  function fetchVersions(bust = false) {
    if (!selectedEgg) return;
    const jar = jarFromItzgType(selectedEgg.itzgType);
    setVersionsLoading(true);
    setVersions([]);
    fetch(`/api/versions?jar=${jar}${bust ? "&bust=true" : ""}`)
      .then((r) => r.json() as Promise<{ versions?: string[] }>)
      .then((data) => {
        const list = data.versions ?? [];
        setVersions(list);
        if (list.length > 0) {
          setEnvironment((prev) => ({
            ...prev,
            MC_VERSION: prev["MC_VERSION"] && prev["MC_VERSION"] !== "latest" ? prev["MC_VERSION"] : (list[0] ?? "latest"),
          }));
        }
      })
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false));
  }

  useEffect(() => {
    if (!open || !selectedEgg) return;
    fetchVersions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEgg, open]);

  function handleEggSelect(egg: EggOption) {
    setEggId(egg.id);
    setSelectedEgg(egg);
    setDockerImage(egg.dockerImage);
    initEnv(egg);
  }

  function handleClose() {
    if (loading) return;
    setName("");
    setError(null);
    setStep("basics");
    setCreatedId(null);
    setEulaChecked(false);
    setSelectedPlanId("free");
    setSelectedNodeTier("budget");
    setSelectedAddons(new Set());
    onClose();
  }

  function resolvedResources(): PlanResources {
    if (selectedPlanId === "custom") return customResources;
    const plan = plansConfig?.plans.find((p) => p.id === selectedPlanId);
    return plan?.resources ?? { memoryMb: 2048, diskMb: 10240, cpuPercent: 100, backups: 2, databases: 0 };
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = resolvedResources();
      const body: Record<string, unknown> = {
        name: name.trim(),
        eggId,
        dockerImage,
        environment,
        planId: selectedPlanId,
        nodeTier: selectedNodeTier,
        addons: Array.from(selectedAddons),
        memoryMb: res.memoryMb,
        diskMb: res.diskMb,
        cpuLimit: res.cpuPercent,
        maxBackups: res.backups,
        maxDatabases: res.databases,
      };
      if (locationId) body.locationId = locationId;
      const r    = await fetch("/api/servers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await r.json()) as { error?: string; id?: string };
      if (!r.ok) { setError(data.error ?? "Failed to create server"); return; }
      setCreatedId(data.id!);
      setStep("eula");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function handleEulaAccept() {
    onCreated(createdId!);
    handleClose();
  }

  // ── EULA ────────────────────────────────────────────────────────────────────

  if (step === "eula") {
    return (
      <Dialog open={open} onClose={handleClose}>
        <DialogHeader title="Minecraft EULA" onClose={handleClose} />
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p className="text-xs text-muted leading-relaxed">
              Before your server can start, you must agree to the{" "}
              <a href="https://aka.ms/MinecraftEULA" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-accent underline-offset-2 hover:underline">
                Minecraft End User License Agreement <ExternalLink className="h-2.5 w-2.5" />
              </a>
              . Mojang requires every server operator to accept the EULA.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-xs text-muted leading-relaxed space-y-2">
            <p>By accepting, you acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>You have read the Minecraft EULA at <span className="text-foreground font-mono">aka.ms/MinecraftEULA</span></li>
              <li>You agree to its terms on behalf of this server</li>
              <li>You will not charge players beyond Mojang&apos;s permitted guidelines</li>
            </ul>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 hover:border-accent/50 transition-colors">
            <input type="checkbox" checked={eulaChecked} onChange={(e) => setEulaChecked(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)] shrink-0" />
            <span className="text-xs text-foreground">I have read and agree to the Minecraft End User License Agreement</span>
          </label>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={!eulaChecked} onClick={handleEulaAccept}>
            <ShieldCheck className="h-3.5 w-3.5" /> Accept &amp; Continue
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  const mcVersion    = environment["MC_VERSION"] ?? "";
  const editableVars = selectedEgg?.variables.filter(
    (v) => v.userViewable && v.userEditable && v.envVariable !== "MC_VERSION" && v.envVariable !== "SERVER_JARFILE"
  ) ?? [];
  const canCreate = name.trim().length > 0 && !!eggId && !versionsLoading && !!mcVersion;

  // ── Step 1: Basics ───────────────────────────────────────────────────────────

  if (step === "basics") {
    return (
      <Dialog open={open} onClose={handleClose}>
        <DialogHeader title="Create a server" onClose={handleClose} />
        <StepIndicator current="basics" />
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p className="text-xs text-muted leading-relaxed">
              Free accounts get <span className="text-foreground font-medium">one server</span> with 2 GB RAM, 10 GB disk, and 1 vCPU.
              Upgrade anytime in the next step.
            </p>
          </div>

          <Input label="Server name" name="name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="My Minecraft Server" maxLength={32} required autoFocus />

          {locations.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Location</span>
              <div className="grid grid-cols-2 gap-2">
                {locations.map((loc) => (
                  <button key={loc.id} type="button" onClick={() => setLocationId(loc.id)}
                    className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      locationId === loc.id ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                    )}>
                    <MapPin className="h-3 w-3 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{loc.displayName}</p>
                      <p className="text-[10px] opacity-70">{loc.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {locations.length === 1 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              Location: <span className="text-foreground">{locations[0]?.displayName}</span>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={!name.trim()} onClick={() => setStep("plan")}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  // ── Step 2: Plan ─────────────────────────────────────────────────────────────

  if (step === "plan") {
    return (
      <Dialog open={open} onClose={handleClose} size="lg">
        <DialogHeader title="Create a server" onClose={handleClose} />
        <StepIndicator current="plan" />
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-muted">Choose a plan for your server. You can change this later.</p>
          <PlanStep
            plansConfig={plansConfig}
            selectedPlanId={selectedPlanId}
            onSelectPlan={setSelectedPlanId}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={() => setStep("basics")}>Back</Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedPlanId}
            onClick={() => setStep(selectedPlanId === "custom" ? "custom" : "upgrades")}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  // ── Step 2b: Custom plan configurator ────────────────────────────────────────

  if (step === "custom") {
    const pricing  = plansConfig?.custom.pricing;
    const limits   = plansConfig?.custom.limits;
    const tiers    = plansConfig?.nodeTiers ?? [];
    const activeTier = tiers.find((t) => t.id === selectedNodeTier) ?? tiers[0];
    const ramRate  = activeTier?.ramPerGbMonthly ?? 1.00;

    function calcPrice(r: PlanResources): number {
      if (!pricing) return 0;
      return (r.memoryMb / 1024) * ramRate
        + (r.cpuPercent / 100)  * pricing.cpuPerCoreMonthly
        + (r.diskMb / 1024)     * pricing.diskPerGbMonthly
        + r.backups              * pricing.backupPerSlotMonthly
        + r.databases            * pricing.databasePerInstanceMonthly;
    }

    const price = calcPrice(customResources);

    return (
      <Dialog open={open} onClose={handleClose} size="lg">
        <DialogHeader title="Create a server" onClose={handleClose} />
        <StepIndicator current="custom" />
        <DialogBody className="flex flex-col gap-5">

          {/* Node tier selection */}
          {tiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Node Tier</p>
              <div className="grid grid-cols-2 gap-2">
                {tiers.map((tier) => {
                  const active = selectedNodeTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedNodeTier(tier.id)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-all",
                        active
                          ? "border-accent bg-accent/10"
                          : "border-border bg-surface hover:border-accent/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-foreground/80")}>
                            {tier.name}
                          </span>
                          {tier.badge && (
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-black">
                              {tier.badge}
                            </span>
                          )}
                        </div>
                        {active && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">{tier.description}</p>
                      <p className={cn("mt-1.5 text-xs font-bold", active ? "text-accent" : "text-muted")}>
                        ${tier.ramPerGbMonthly.toFixed(2)}/GB RAM
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header summary */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <Image src="/assets/icons/credits_icon.png" alt="" width={18} height={18} className="opacity-80" />
              <span className="text-sm font-semibold text-foreground">Custom Plan</span>
              {activeTier && (
                <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300/70">
                  {activeTier.name}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-amber-300">${price.toFixed(2)}</span>
              <span className="text-xs text-muted">/mo</span>
            </div>
          </div>

          {/* Sliders */}
          {limits && (
            <div className="space-y-5">
              <SliderRow
                icon={<Cpu className="h-3.5 w-3.5" />}
                label="RAM"
                value={customResources.memoryMb}
                min={limits.memoryMbMin} max={limits.memoryMbMax} step={limits.memoryMbStep}
                displayValue={fmtMb(customResources.memoryMb)}
                onChange={(v) => setCustomResources((r) => ({ ...r, memoryMb: v }))}
              />
              <SliderRow
                icon={<Zap className="h-3.5 w-3.5" />}
                label="CPU"
                value={customResources.cpuPercent}
                min={limits.cpuPercentMin} max={limits.cpuPercentMax} step={limits.cpuPercentStep}
                displayValue={fmtCpu(customResources.cpuPercent)}
                onChange={(v) => setCustomResources((r) => ({ ...r, cpuPercent: v }))}
              />
              <SliderRow
                icon={<HardDrive className="h-3.5 w-3.5" />}
                label="Disk"
                value={customResources.diskMb}
                min={limits.diskMbMin} max={limits.diskMbMax} step={limits.diskMbStep}
                displayValue={fmtMb(customResources.diskMb)}
                onChange={(v) => setCustomResources((r) => ({ ...r, diskMb: v }))}
              />
              <SliderRow
                icon={<Archive className="h-3.5 w-3.5" />}
                label="Backups"
                value={customResources.backups}
                min={limits.backupsMin} max={limits.backupsMax} step={1}
                displayValue={`${customResources.backups} slot${customResources.backups !== 1 ? "s" : ""}`}
                onChange={(v) => setCustomResources((r) => ({ ...r, backups: v }))}
              />
              <SliderRow
                icon={<Database className="h-3.5 w-3.5" />}
                label="Databases"
                value={customResources.databases}
                min={limits.databasesMin} max={limits.databasesMax} step={1}
                displayValue={`${customResources.databases} DB${customResources.databases !== 1 ? "s" : ""}`}
                onChange={(v) => setCustomResources((r) => ({ ...r, databases: v }))}
              />
            </div>
          )}

          {/* Pricing breakdown */}
          {pricing && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 overflow-hidden">
              <div className="divide-y divide-amber-500/10 text-xs">
                {([
                  ["RAM",       `${(customResources.memoryMb / 1024).toFixed(1)} GB`,    `$${ramRate.toFixed(2)}/GB`,              (customResources.memoryMb / 1024) * ramRate],
                  ["CPU",       `${(customResources.cpuPercent / 100).toFixed(1)} vCPU`, `$${pricing.cpuPerCoreMonthly}/vCPU`,    (customResources.cpuPercent / 100) * pricing.cpuPerCoreMonthly],
                  ["Disk",      `${(customResources.diskMb / 1024).toFixed(0)} GB`,      `$${pricing.diskPerGbMonthly}/GB`,        (customResources.diskMb / 1024) * pricing.diskPerGbMonthly],
                  ["Backups",   `${customResources.backups} slots`,                       `$${pricing.backupPerSlotMonthly}/slot`,  customResources.backups * pricing.backupPerSlotMonthly],
                  ["Databases", `${customResources.databases} DBs`,                       `$${pricing.databasePerInstanceMonthly}/DB`, customResources.databases * pricing.databasePerInstanceMonthly],
                ] as [string, string, string, number][]).map(([label, qty, rate, cost]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2">
                    <span className="text-muted">{label}</span>
                    <span className="text-muted/60 tabular-nums">{qty}</span>
                    <span className="text-muted/40 tabular-nums">{rate}</span>
                    <span className="w-10 text-right font-medium text-amber-300 tabular-nums">${cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-amber-500/20 bg-amber-950/20 px-4 py-2.5">
                <span className="text-xs font-semibold text-foreground">Monthly total</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted/60">≈ {Math.ceil(price * 100).toLocaleString()} credits</span>
                  <span className="text-sm font-bold text-amber-300">${price.toFixed(2)}/mo</span>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={() => setStep("plan")}>Back</Button>
          <Button type="button" size="sm" onClick={() => setStep("upgrades")}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  // ── Step 3: Upgrades ─────────────────────────────────────────────────────────

  if (step === "upgrades") {
    const planPrice = (() => {
      if (selectedPlanId === "custom") {
        if (!plansConfig) return 0;
        const p = plansConfig.custom.pricing;
        const ramRate = plansConfig.nodeTiers?.find((t) => t.id === selectedNodeTier)?.ramPerGbMonthly ?? 1.00;
        return (customResources.memoryMb / 1024) * ramRate
          + (customResources.cpuPercent / 100) * p.cpuPerCoreMonthly
          + (customResources.diskMb / 1024)    * p.diskPerGbMonthly
          + customResources.backups             * p.backupPerSlotMonthly
          + customResources.databases           * p.databasePerInstanceMonthly;
      }
      return plansConfig?.plans.find((pl) => pl.id === selectedPlanId)?.priceMonthly ?? 0;
    })();

    return (
      <Dialog open={open} onClose={handleClose} size="lg">
        <DialogHeader title="Create a server" onClose={handleClose} />
        <StepIndicator current="upgrades" />
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-muted">Enhance your server with optional upgrades. All are billed monthly.</p>
          <UpgradesStep
            addons={plansConfig?.addons ?? []}
            selectedAddons={selectedAddons}
            onToggle={toggleAddon}
            planPrice={planPrice}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => setStep(selectedPlanId === "custom" ? "custom" : "plan")}>
            Back
          </Button>
          <Button type="button" size="sm" onClick={() => setStep("type")}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  // ── Step 4: Server type ──────────────────────────────────────────────────────

  if (step === "type") {
    return (
      <Dialog open={open} onClose={handleClose}>
        <DialogHeader title="Create a server" onClose={handleClose} />
        <StepIndicator current="type" />
        <DialogBody className="flex flex-col gap-4">
          <p className="text-xs text-muted">Choose the kind of server you want to run.</p>
          {eggsLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted">Loading server types…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {eggs.map((egg) => (
                <button key={egg.id} type="button" onClick={() => handleEggSelect(egg)}
                  className={cn("rounded-lg border px-3 py-3 text-left transition-colors",
                    eggId === egg.id ? "border-accent bg-accent/10 text-foreground" : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                  )}>
                  <p className="text-xs font-semibold truncate">{egg.name.replace(/^Minecraft Java — /, "")}</p>
                  {egg.description && <p className="mt-1 text-[11px] leading-relaxed opacity-60 line-clamp-3">{egg.description}</p>}
                </button>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" onClick={() => setStep("plan")}>Back</Button>
          <Button type="button" size="sm" disabled={!eggId} onClick={() => setStep("configure")}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  // ── Step 5: Configure ────────────────────────────────────────────────────────

  const res = resolvedResources();

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader title="Create a server" onClose={handleClose} />
      <StepIndicator current="configure" />
      <DialogBody className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {selectedEgg && Object.keys(selectedEgg.dockerImages).length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Java version</span>
            <div className="relative">
              <select value={dockerImage} onChange={(e) => setDockerImage(e.target.value)}
                className="w-full appearance-none rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {Object.entries(selectedEgg.dockerImages).map(([img, label]) => (
                  <option key={img} value={img}>{label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Minecraft version</span>
            <button type="button" onClick={() => fetchVersions(true)} disabled={versionsLoading}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors disabled:opacity-40">
              <RefreshCw className={cn("h-3 w-3", versionsLoading && "animate-spin")} />
              {versionsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <div className="relative">
            <select value={mcVersion} onChange={(e) => setEnvironment((prev) => ({ ...prev, MC_VERSION: e.target.value }))}
              disabled={versionsLoading || versions.length === 0}
              className={cn("w-full appearance-none rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                (versionsLoading || versions.length === 0) && "opacity-50 cursor-not-allowed"
              )}>
              {versionsLoading && <option value="">Loading versions…</option>}
              {!versionsLoading && versions.length === 0 && <option value="">Failed to load versions</option>}
              {versions.map((v, i) => <option key={v} value={v}>{i === 0 ? `${v} — Latest` : v}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          </div>
        </div>

        {editableVars.length > 0 && (
          <div className="flex flex-col gap-3">
            {editableVars.map((v) => {
              const isBoolean = v.rules.includes("in:TRUE,FALSE");
              return (
                <div key={v.envVariable} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">{v.name}</span>
                  {isBoolean ? (
                    <div className="flex gap-2">
                      {["TRUE", "FALSE"].map((opt) => (
                        <button key={opt} type="button"
                          onClick={() => setEnvironment((prev) => ({ ...prev, [v.envVariable]: opt }))}
                          className={cn("flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                            (environment[v.envVariable] ?? v.defaultValue) === opt
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-border bg-surface text-muted hover:border-accent/40"
                          )}>
                          {opt === "TRUE" ? "Enabled" : "Disabled"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
                      value={environment[v.envVariable] ?? v.defaultValue}
                      onChange={(e) => setEnvironment((prev) => ({ ...prev, [v.envVariable]: e.target.value }))}
                      placeholder={v.defaultValue}
                    />
                  )}
                  {v.description && <p className="text-[11px] text-muted">{v.description}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        <div className="rounded-lg border border-border bg-surface/50 divide-y divide-border text-xs">
          <ResRow icon={<Server className="h-3 w-3" />} label="Type" value={selectedEgg?.name.replace(/^Minecraft Java — /, "") ?? "—"} />
          <ResRow icon={<Cpu className="h-3 w-3" />} label="RAM" value={fmtMb(res.memoryMb)} />
          <ResRow icon={<Zap className="h-3 w-3" />} label="CPU" value={fmtCpu(res.cpuPercent)} />
          <ResRow icon={<HardDrive className="h-3 w-3" />} label="Disk" value={fmtMb(res.diskMb)} />
          <ResRow icon={<Archive className="h-3 w-3" />} label="Backups" value={String(res.backups)} />
          <ResRow icon={<Database className="h-3 w-3" />} label="Databases" value={String(res.databases)} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" size="sm" onClick={() => { setError(null); setStep("type"); }} disabled={loading}>
          Back
        </Button>
        <Button type="button" size="sm" loading={loading} disabled={!canCreate} onClick={handleSubmit}>
          <Server className="h-3.5 w-3.5" /> Create server
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
