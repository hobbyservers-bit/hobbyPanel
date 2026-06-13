"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { Users, Server, Plus, Pencil, Trash2, X, Crown, Shield, MapPin, Cpu, Download, Wifi, WifiOff, Copy, Check, MailCheck, MailX, Egg, Upload, ShieldOff, ShieldCheck, AlertTriangle, Wrench, Settings, RefreshCw, Coins, Tag, ToggleLeft, ToggleRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role   = "USER" | "ADMIN";
type Plan   = "FREE" | "PRO";
type Status = "OFFLINE" | "STARTING" | "ONLINE" | "STOPPING";

interface AdminUser {
  id: string;
  email: string;
  role: Role;
  plan: Plan;
  credits: number;
  emailVerified: boolean;
  createdAt: string;
  _count: { servers: number };
}

interface AdminServer {
  id: string;
  name: string;
  externalId: string;
  status: Status;
  mcVersion: string;
  jarType: string;
  memoryMb: number;
  diskMb: number;
  cpuLimit: number;
  suspended: boolean;
  createdAt: string;
  user: { id: string; email: string };
  node: { id: string; name: string; fqdn: string };
  allocations: Array<{ id: string; ip: string; alias: string | null; port: number; notes: string; serverId: string | null }>;
}

interface AdminLocation {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  _count: { nodes: number };
}

interface AdminAllocation {
  id: string;
  ip: string;
  alias: string | null;
  port: number;
  notes: string;
  serverId: string | null;
  server: { id: string; name: string } | null;
}

interface AdminNode {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  tlsEnabled: boolean;
  tokenId: string;
  locationId: string | null;
  maintenanceMode: boolean;
  location: { id: string; name: string; displayName: string } | null;
  createdAt: string;
  _count: { servers: number };
}

interface AdminEggVariable {
  id: string;
  eggId: string;
  name: string;
  description: string;
  envVariable: string;
  defaultValue: string;
  userViewable: boolean;
  userEditable: boolean;
  rules: string;
  sortOrder: number;
}

interface AdminEgg {
  id: string;
  name: string;
  author: string;
  description: string;
  dockerImage: string;
  dockerImages: Record<string, string>;
  startup: string;
  configStop: string;
  itzgType: string;
  features: string[];
  createdAt: string;
  variables: AdminEggVariable[];
  _count: { servers: number };
}

interface AdminPromoCode {
  id: string;
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  _count: { redemptions: number };
}

interface Props {
  currentUserId: string;
  initialUsers: AdminUser[];
  initialServers: AdminServer[];
  initialLocations: AdminLocation[];
  initialNodes: AdminNode[];
  initialEggs: AdminEgg[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

const STATUS_COLORS: Record<Status, string> = {
  OFFLINE:  "text-muted",
  STARTING: "text-yellow-400",
  ONLINE:   "text-green-400",
  STOPPING: "text-orange-400",
};

// ── Shared components ─────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full mx-4 rounded-lg border border-border bg-background shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls  = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent";
const selectCls = `${inputCls} appearance-none`;
const btnPrimary = "flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50";
const btnDanger  = "flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors";
const btnGhost   = "flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors";

function ConfirmModal({ title, description, onClose, onConfirm }: {
  title: string; description: string; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [pending, startT] = useTransition();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            onClick={() => startT(async () => { await onConfirm(); onClose(); })}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Copy Button ───────────────────────────────────────────────────────────────

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
      className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted hover:text-foreground border border-border hover:border-accent/50 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── User Modal ────────────────────────────────────────────────────────────────

function UserModal({ mode, user, onClose, onSave }: {
  mode: "create" | "edit"; user?: AdminUser; onClose: () => void;
  onSave: (data: Record<string, string>) => Promise<void>;
}) {
  const [email,    setEmail]    = useState(user?.email    ?? "");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<Role>(user?.role ?? "USER");
  const [plan,     setPlan]     = useState<Plan>(user?.plan ?? "FREE");
  const [error,    setError]    = useState("");
  const [pending,  startT]      = useTransition();

  function submit() {
    setError("");
    if (!email) { setError("Email is required"); return; }
    if (mode === "create" && !password) { setError("Password is required"); return; }
    if (password && password.length < 8) { setError("Password must be at least 8 characters"); return; }
    const data: Record<string, string> = { email, role, plan };
    if (password) data.password = password;
    startT(async () => {
      try { await onSave(data); onClose(); }
      catch (e) { setError(e instanceof Error ? e.message : "An error occurred"); }
    });
  }

  return (
    <Modal title={mode === "create" ? "Create User" : "Edit User"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </Field>
        <Field label={mode === "create" ? "Password" : "New Password (leave blank to keep)"}>
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "create" ? "Min. 8 characters" : "Leave blank to keep current"} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select className={selectCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <Field label="Plan">
            <select className={selectCls} value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
              <option value="FREE">Free</option>
              <option value="PRO">Pro</option>
            </select>
          </Field>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={submit} disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create User" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Server Modal ──────────────────────────────────────────────────────────────

const JAR_TYPE_MAP: Record<string, string> = {
  paper: "paper", purpur: "purpur", fabric: "fabric", vanilla: "vanilla",
};

function jarFromItzgType(itzgType: string): string {
  return JAR_TYPE_MAP[itzgType.toLowerCase()] ?? "paper";
}

function ServerModal({ mode, server, users, nodes, eggs, onClose, onSave }: {
  mode: "create" | "edit"; server?: AdminServer; users: AdminUser[]; nodes: AdminNode[]; eggs: AdminEgg[];
  onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const defaultEgg = eggs[0];
  const [name,       setName]       = useState(server?.name      ?? "");
  const [userId,     setUserId]     = useState(server?.user.id   ?? users[0]?.id ?? "");
  const [nodeId,     setNodeId]     = useState(server?.node.id   ?? nodes[0]?.id ?? "");
  const [eggId,      setEggId]      = useState(defaultEgg?.id    ?? "");
  const [mcVersion,  setMcVersion]  = useState(server?.mcVersion ?? "");
  const [onlineMode, setOnlineMode] = useState("TRUE");
  const [memoryMb,   setMemoryMb]   = useState(String(server?.memoryMb  ?? 2048));
  const [diskMb,     setDiskMb]     = useState(String(server?.diskMb    ?? 10240));
  const [cpuLimit,   setCpuLimit]   = useState(String(server?.cpuLimit  ?? 100));
  const [error,      setError]      = useState("");
  const [pending,    startT]        = useTransition();
  const [versions,   setVersions]   = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const selectedEgg = eggs.find((e) => e.id === eggId) ?? null;

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
        if (list.length > 0 && (!mcVersion || mcVersion === "latest")) setMcVersion(list[0] ?? "");
      })
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false));
  }

  useEffect(() => {
    fetchVersions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eggId]);

  function submit() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (mode === "create" && !userId) { setError("Owner is required"); return; }
    const environment: Record<string, string> = { ONLINE_MODE: onlineMode };
    if (mcVersion) environment["MC_VERSION"] = mcVersion;
    const data: Record<string, unknown> = {
      name: name.trim(),
      environment,
      memoryMb: parseInt(memoryMb), diskMb: parseInt(diskMb), cpuLimit: parseInt(cpuLimit),
    };
    if (mode === "create") {
      data.userId = userId;
      if (nodeId) data.nodeId = nodeId;
      if (eggId) data.eggId = eggId;
    } else {
      if (userId !== server?.user.id) data.userId = userId;
    }
    startT(async () => {
      try { await onSave(data); onClose(); }
      catch (e) { setError(e instanceof Error ? e.message : "An error occurred"); }
    });
  }

  return (
    <Modal title={mode === "create" ? "Create Server" : "Edit Server"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Server Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <select className={selectCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </Field>
          {mode === "create" && (
            <Field label="Node">
              <select className={selectCls} value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                <option value="">Auto-assign</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.location?.name ?? "no location"})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {mode === "create" && eggs.length > 0 && (
          <Field label="Egg (server type)">
            <select className={selectCls} value={eggId} onChange={(e) => setEggId(e.target.value)}>
              {eggs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted">Minecraft Version</label>
              <button
                type="button"
                onClick={() => fetchVersions(true)}
                disabled={versionsLoading}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors disabled:opacity-40"
                title="Refresh version list"
              >
                <RefreshCw className={`h-3 w-3 ${versionsLoading ? "animate-spin" : ""}`} />
                {versionsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <select
              className={selectCls}
              value={mcVersion}
              onChange={(e) => setMcVersion(e.target.value)}
              disabled={versionsLoading || versions.length === 0}
            >
              {versionsLoading && <option value="">Loading…</option>}
              {!versionsLoading && versions.length === 0 && <option value={mcVersion || "latest"}>{mcVersion || "latest"}</option>}
              {versions.map((v, i) => (
                <option key={v} value={v}>{i === 0 ? `${v} (latest)` : v}</option>
              ))}
            </select>
          </div>
          <Field label="Online Mode">
            <select className={selectCls} value={onlineMode} onChange={(e) => setOnlineMode(e.target.value)}>
              <option value="TRUE">Enabled</option>
              <option value="FALSE">Disabled</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="RAM (MB)">
            <input className={inputCls} type="number" min={512} max={65536} value={memoryMb} onChange={(e) => setMemoryMb(e.target.value)} />
          </Field>
          <Field label="Disk (MB)">
            <input className={inputCls} type="number" min={1024} max={524288} value={diskMb} onChange={(e) => setDiskMb(e.target.value)} />
          </Field>
          <Field label="CPU (%)">
            <input className={inputCls} type="number" min={10} max={1600} value={cpuLimit} onChange={(e) => setCpuLimit(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={submit} disabled={pending || versionsLoading}>
            {pending ? "Saving…" : mode === "create" ? "Create Server" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Location Modal ────────────────────────────────────────────────────────────

function LocationModal({ mode, location, onClose, onSave }: {
  mode: "create" | "edit"; location?: AdminLocation; onClose: () => void;
  onSave: (data: { name: string; displayName: string }) => Promise<void>;
}) {
  const [name,        setName]        = useState(location?.name        ?? "");
  const [displayName, setDisplayName] = useState(location?.displayName ?? "");
  const [error,       setError]       = useState("");
  const [pending,     startT]         = useTransition();

  function submit() {
    setError("");
    if (!name.trim())        { setError("Slug name is required"); return; }
    if (!displayName.trim()) { setError("Display name is required"); return; }
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(name)) {
      setError("Name must be lowercase letters/numbers separated by dots (e.g. us.east.1)");
      return;
    }
    startT(async () => {
      try { await onSave({ name: name.trim(), displayName: displayName.trim() }); onClose(); }
      catch (e) { setError(e instanceof Error ? e.message : "An error occurred"); }
    });
  }

  return (
    <Modal title={mode === "create" ? "Create Location" : "Edit Location"} onClose={onClose}>
      <div className="space-y-4">
        <Field label='Slug (e.g. "us.east.1", "nyc.eastern")'>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            placeholder="us.east.1"
            disabled={mode === "edit"}
          />
          {mode === "edit" && <p className="mt-1 text-[11px] text-muted">Slug cannot be changed after creation.</p>}
        </Field>
        <Field label="Display Name">
          <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="US East 1" />
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={submit} disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create Location" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Node Modal ────────────────────────────────────────────────────────────────

function NodeModal({ mode, node, locations, onClose, onSave }: {
  mode: "create" | "edit"; node?: AdminNode; locations: AdminLocation[];
  onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [name,       setName]       = useState(node?.name       ?? "");
  const [fqdn,       setFqdn]       = useState(node?.fqdn       ?? "");
  const [port,       setPort]       = useState(String(node?.port ?? 8080));
  const [tlsEnabled, setTlsEnabled] = useState(node?.tlsEnabled ?? false);
  const [locationId, setLocationId] = useState(node?.locationId ?? "");
  const [error,      setError]      = useState("");
  const [pending,    startT]        = useTransition();

  function submit() {
    setError("");
    if (!name.trim()) { setError("Name is required"); return; }
    if (!fqdn.trim()) { setError("FQDN/IP is required"); return; }
    const data: Record<string, unknown> = {
      name: name.trim(),
      fqdn: fqdn.trim(),
      port: parseInt(port),
      tlsEnabled,
      locationId: locationId || null,
    };
    startT(async () => {
      try { await onSave(data); onClose(); }
      catch (e) { setError(e instanceof Error ? e.message : "An error occurred"); }
    });
  }

  return (
    <Modal title={mode === "create" ? "Create Node" : "Edit Node"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Node Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Node 1" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="FQDN / IP Address">
              <input className={inputCls} value={fqdn} onChange={(e) => setFqdn(e.target.value)} placeholder="node1.example.com" />
            </Field>
          </div>
          <Field label="Port">
            <input className={inputCls} type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <select className={selectCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">No location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.displayName} ({l.name})</option>
              ))}
            </select>
          </Field>
          <Field label="SSL / TLS">
            <select className={selectCls} value={String(tlsEnabled)} onChange={(e) => setTlsEnabled(e.target.value === "true")}>
              <option value="false">Disabled (HTTP)</option>
              <option value="true">Enabled (HTTPS)</option>
            </select>
          </Field>
        </div>
        {mode === "create" && (
          <div className="rounded-md border border-accent/20 bg-accent/5 px-3 py-2.5 text-xs text-muted">
            Token credentials will be auto-generated. Download the Wings config after creating the node.
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={submit} disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create Node" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Wings Config Modal ────────────────────────────────────────────────────────

function WingsConfigModal({ nodeId, nodeName, onClose }: { nodeId: string; nodeName: string; onClose: () => void }) {
  const [tab, setTab]     = useState<"yaml" | "compose" | "script">("yaml");
  const [data, setData]   = useState<{ configYaml: string; dockerCompose: string; installScript: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pingResult, setPingResult] = useState<{ online: boolean; latencyMs: number; error?: string } | null>(null);
  const [pinging, setPinging] = useState(false);

  useState(() => {
    fetch(`/api/admin/nodes/${nodeId}/config`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load config"); setLoading(false); });
  });

  async function doPing() {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch(`/api/admin/nodes/${nodeId}/ping`, { method: "POST" });
      const d = await res.json();
      setPingResult(d);
    } catch {
      setPingResult({ online: false, latencyMs: 0, error: "Request failed" });
    } finally {
      setPinging(false);
    }
  }

  const TAB_LABELS: Record<typeof tab, string> = {
    yaml:    "config.yml",
    compose: "docker-compose.yml",
    script:  "Install Script",
  };

  const currentContent = data
    ? tab === "yaml" ? data.configYaml
      : tab === "compose" ? data.dockerCompose
      : data.installScript
    : "";

  return (
    <Modal title={`Wings Config — ${nodeName}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Ping row */}
        <div className="flex items-center gap-3">
          <button
            className={`${btnGhost} gap-2`}
            onClick={doPing}
            disabled={pinging}
          >
            {pinging ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <Wifi className="h-3 w-3" />
            )}
            {pinging ? "Pinging…" : "Test Connection"}
          </button>
          {pingResult && (
            <span className={`flex items-center gap-1.5 text-xs ${pingResult.online ? "text-green-400" : "text-red-400"}`}>
              {pingResult.online
                ? <><Wifi className="h-3 w-3" /> Online · {pingResult.latencyMs}ms</>
                : <><WifiOff className="h-3 w-3" /> Offline{pingResult.error ? ` — ${pingResult.error}` : ""}</>
              }
            </span>
          )}
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface/30 p-1 w-fit">
          {(["yaml", "compose", "script"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="h-48 flex items-center justify-center text-xs text-muted">Loading…</div>
        ) : error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : (
          <div className="relative">
            <div className="absolute right-2 top-2 z-10">
              <CopyButton text={currentContent} />
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface p-4 text-[11px] font-mono text-muted leading-relaxed whitespace-pre">
              {currentContent}
            </pre>
          </div>
        )}

        {/* Install instructions */}
        <div className="rounded-lg border border-border bg-surface/30 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Quick Setup</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-muted">
            <li>SSH into the Wings machine</li>
            <li>Copy <span className="font-mono text-foreground">config.yml</span> to <span className="font-mono text-foreground">/etc/pterodactyl/config.yml</span></li>
            <li>Run the install script as root (installs Docker + Wings binary + systemd service)</li>
            <li>Use <span className="font-mono text-foreground">docker-compose.yml</span> if you prefer containerised Wings</li>
            <li>Click <strong>Test Connection</strong> above to verify</li>
          </ol>
        </div>

        <div className="flex justify-end">
          <button className={btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

// ── Credit Modal ──────────────────────────────────────────────────────────────

function CreditModal({ user, onClose, onSaved }: {
  user: AdminUser; onClose: () => void; onSaved: (newBalance: number) => void;
}) {
  const [type,        setType]        = useState<"ADMIN_GRANT" | "ADMIN_DEDUCT">("ADMIN_GRANT");
  const [amount,      setAmount]      = useState("");
  const [description, setDescription] = useState("");
  const [error,       setError]       = useState("");
  const [pending,     startT]         = useTransition();

  function submit() {
    setError("");
    const n = parseInt(amount);
    if (!n || n < 1) { setError("Amount must be at least 1"); return; }
    if (n > 100_000) { setError("Amount cannot exceed 100,000"); return; }
    startT(async () => {
      try {
        const res  = await fetch(`/api/admin/users/${user.id}/credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: n, type, description }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed");
        onSaved(json.balance as number);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    });
  }

  return (
    <Modal title="Manage Credits" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3">
          <Image src="/assets/icons/credits_icon.png" alt="Credits" width={20} height={20} />
          <div>
            <div className="text-xs text-muted">Current balance</div>
            <div className="text-sm font-semibold text-amber-300">{user.credits.toLocaleString()} credits</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              type === "ADMIN_GRANT"
                ? "border-green-500/50 bg-green-500/10 text-green-400"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
            onClick={() => setType("ADMIN_GRANT")}
          >
            <Coins className="h-3.5 w-3.5" /> Grant
          </button>
          <button
            className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              type === "ADMIN_DEDUCT"
                ? "border-red-500/50 bg-red-500/10 text-red-400"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
            onClick={() => setType("ADMIN_DEDUCT")}
          >
            <Coins className="h-3.5 w-3.5" /> Deduct
          </button>
        </div>

        <Field label="Amount">
          <input
            className={inputCls}
            type="number"
            min="1"
            max="100000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500"
          />
        </Field>

        <Field label="Reason (optional)">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Welcome bonus"
          />
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button
            className={type === "ADMIN_GRANT" ? btnPrimary : "flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"}
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Saving…" : type === "ADMIN_GRANT" ? "Grant Credits" : "Deduct Credits"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────

function UsersTab({ users, setUsers, currentUserId }: {
  users: AdminUser[]; setUsers: (u: AdminUser[]) => void; currentUserId: string;
}) {
  const [userModal, setUserModal] = useState<null | { mode: "create" } | { mode: "edit"; user: AdminUser }>(null);
  const [creditTarget, setCreditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  async function createUser(data: Record<string, string>) {
    const res  = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create user");
    setUsers([...users, { ...json.user, _count: { servers: 0 } }]);
  }

  async function editUser(userId: string, data: Record<string, string>) {
    const res  = await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update user");
    setUsers(users.map((u) => (u.id === userId ? { ...u, ...json.user } : u)));
  }

  async function deleteUser(userId: string) {
    const res  = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to delete user");
    setUsers(users.filter((u) => u.id !== userId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        <button className={btnPrimary} onClick={() => setUserModal({ mode: "create" })}>
          <Plus className="h-3.5 w-3.5" /> New User
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {["Email", "Role", "Plan", "Credits", "Verified", "Servers", "Joined", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{u.email}</span>
                    {u.id === currentUserId && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">You</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.role === "ADMIN"
                    ? <span className="flex items-center gap-1 text-xs font-medium text-purple-400"><Shield className="h-3 w-3" /> Admin</span>
                    : <span className="text-xs text-muted">User</span>}
                </td>
                <td className="px-4 py-3">
                  {u.plan === "PRO"
                    ? <span className="flex items-center gap-1 text-xs font-medium text-yellow-400"><Crown className="h-3 w-3" /> Pro</span>
                    : <span className="text-xs text-muted">Free</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-amber-300">
                    <Image src="/assets/icons/credits_icon.png" alt="" width={12} height={12} className="opacity-75" />
                    <span className="tabular-nums">{u.credits.toLocaleString()}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.emailVerified
                    ? <span className="flex items-center gap-1 text-xs text-green-400"><MailCheck className="h-3 w-3" /> Verified</span>
                    : <span className="flex items-center gap-1 text-xs text-yellow-400"><MailX className="h-3 w-3" /> Pending</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{u._count.servers}</td>
                <td className="px-4 py-3 text-xs text-muted">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="flex items-center gap-1.5 rounded-md border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                      onClick={() => setCreditTarget(u)}
                      title="Manage credits"
                    >
                      <Coins className="h-3 w-3" /> Credits
                    </button>
                    <button className={btnGhost} onClick={() => setUserModal({ mode: "edit", user: u })}>
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => setDeleteTarget(u)}
                      disabled={u.id === currentUserId}
                      title={u.id === currentUserId ? "Cannot delete yourself" : undefined}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-muted">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creditTarget && (
        <CreditModal
          user={creditTarget}
          onClose={() => setCreditTarget(null)}
          onSaved={(newBalance) => {
            setUsers(users.map((u) => u.id === creditTarget.id ? { ...u, credits: newBalance } : u));
          }}
        />
      )}
      {userModal?.mode === "create" && (
        <UserModal mode="create" onClose={() => setUserModal(null)} onSave={createUser} />
      )}
      {userModal?.mode === "edit" && (
        <UserModal mode="edit" user={userModal.user} onClose={() => setUserModal(null)}
          onSave={(data) => editUser(userModal.user.id, data as Record<string, string>)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete User"
          description={`Delete ${deleteTarget.email}? This will also delete all their servers, backups, and sessions.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteUser(deleteTarget.id)}
        />
      )}
    </div>
  );
}

// ── Server Allocations Modal ──────────────────────────────────────────────────

function ServerAllocationsModal({
  server,
  onClose,
  onAllocationsChanged,
}: {
  server: AdminServer;
  onClose: () => void;
  onAllocationsChanged: (serverId: string, allocations: AdminServer["allocations"]) => void;
}) {
  const [assigned, setAssigned] = useState(server.allocations);
  const [freePool, setFreePool] = useState<AdminAllocation[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [error, setError]     = useState("");
  const [busyId, setBusyId]   = useState<string | null>(null);

  // Fetch all allocations on this server's node to show the free pool
  useEffect(() => {
    fetch(`/api/admin/nodes/${server.node.id}/allocations`)
      .then((r) => r.json() as Promise<{ allocations?: AdminAllocation[] }>)
      .then((d) => {
        const all = d.allocations ?? [];
        setFreePool(all.filter((a) => !a.serverId));
        setPoolLoading(false);
      })
      .catch(() => setPoolLoading(false));
  }, [server.node.id]);

  async function assign(alloc: AdminAllocation) {
    setBusyId(alloc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/allocations/${alloc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: server.id }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed"); return; }
      const newAlloc = { id: alloc.id, ip: alloc.ip, alias: alloc.alias, port: alloc.port, notes: alloc.notes, serverId: server.id };
      const next = [...assigned, newAlloc];
      setAssigned(next);
      setFreePool((prev) => prev.filter((a) => a.id !== alloc.id));
      onAllocationsChanged(server.id, next);
    } finally { setBusyId(null); }
  }

  async function unassign(alloc: { id: string; ip: string; alias: string | null; port: number; notes: string; serverId: string | null }) {
    setBusyId(alloc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/allocations/${alloc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed"); return; }
      const next = assigned.filter((a) => a.id !== alloc.id);
      setAssigned(next);
      setFreePool((prev) => [...prev, { ...alloc, serverId: null, server: null }].sort((a, b) => a.port - b.port));
      onAllocationsChanged(server.id, next);
    } finally { setBusyId(null); }
  }

  const primaryFqdn = server.node.fqdn;

  return (
    <Modal title={`IP Allocations — ${server.name}`} onClose={onClose} wide>
      <div className="space-y-5">
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Currently assigned */}
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">
            Assigned to this server
            <span className="ml-2 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">{assigned.length}</span>
          </p>
          {assigned.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface/30 px-4 py-3 text-xs text-muted">
              No allocations assigned. Pick one from the pool below.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    {["Address", "IP", "Alias", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assigned.map((a, i) => (
                    <tr key={a.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""}`}>
                      <td className="px-3 py-2.5 font-mono font-medium text-foreground">
                        {a.alias ?? primaryFqdn}:{a.port}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted">{a.ip}:{a.port}</td>
                      <td className="px-3 py-2.5 text-muted">{a.alias ?? <span className="opacity-40">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <button
                          className={btnDanger}
                          onClick={() => unassign(a)}
                          disabled={busyId === a.id}
                          title="Remove from this server"
                        >
                          {busyId === a.id ? "…" : <><Trash2 className="h-3 w-3" /> Remove</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Free pool */}
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">
            Free allocations on <span className="text-accent">{server.node.name}</span>
            {!poolLoading && (
              <span className="ml-2 rounded-full bg-border px-1.5 py-0.5 text-[10px] text-muted">{freePool.length} available</span>
            )}
          </p>
          {poolLoading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : freePool.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface/30 px-4 py-3 text-xs text-muted">
              No free allocations on this node. Go to the Nodes tab → Ports to add more.
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b border-border bg-surface">
                    {["Port", "IP", "Alias", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {freePool.map((a, i) => (
                    <tr key={a.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""}`}>
                      <td className="px-3 py-2.5 font-mono text-foreground">{a.port}</td>
                      <td className="px-3 py-2.5 font-mono text-muted">{a.ip}</td>
                      <td className="px-3 py-2.5 text-muted">{a.alias ?? <span className="opacity-40">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <button
                          className={btnPrimary}
                          onClick={() => assign(a)}
                          disabled={busyId === a.id}
                        >
                          {busyId === a.id ? "…" : <><Plus className="h-3 w-3" /> Assign</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button className={btnGhost} onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Servers Tab ───────────────────────────────────────────────────────────────

function ServersTab({ servers, setServers, users, nodes, eggs }: {
  servers: AdminServer[]; setServers: (s: AdminServer[]) => void;
  users: AdminUser[]; nodes: AdminNode[]; eggs: AdminEgg[];
}) {
  const [serverModal, setServerModal] = useState<null | { mode: "create" } | { mode: "edit"; server: AdminServer }>(null);
  const [allocTarget, setAllocTarget] = useState<AdminServer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminServer | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  async function toggleSuspend(server: AdminServer) {
    setSuspendingId(server.id);
    try {
      const res = await fetch(`/api/admin/servers/${server.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !server.suspended }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setServers(servers.map((s) => s.id === server.id ? { ...s, suspended: json.suspended, status: json.suspended ? "OFFLINE" : s.status } : s));
    } catch {
      // noop
    } finally {
      setSuspendingId(null);
    }
  }

  async function createServer(data: Record<string, unknown>) {
    const res  = await fetch("/api/admin/servers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create server");
    const ns = json.server;
    const owner  = users.find((u) => u.id === data.userId) ?? { id: String(data.userId), email: "Unknown" };
    const nodeObj = nodes.find((n) => n.id === data.nodeId) ?? nodes[0] ?? { id: "", name: "default", fqdn: "" };
    setServers([...servers, { ...ns, user: owner, node: { id: nodeObj.id, name: nodeObj.name, fqdn: nodeObj.fqdn } }]);
  }

  async function editServer(serverId: string, data: Record<string, unknown>) {
    const res  = await fetch(`/api/admin/servers/${serverId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update server");
    setServers(servers.map((s) => (s.id === serverId ? json.server : s)));
  }

  async function deleteServer(serverId: string) {
    const res  = await fetch(`/api/admin/servers/${serverId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to delete server");
    setServers(servers.filter((s) => s.id !== serverId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">{servers.length} server{servers.length !== 1 ? "s" : ""}</p>
        <button className={btnPrimary} onClick={() => setServerModal({ mode: "create" })} disabled={users.length === 0}>
          <Plus className="h-3.5 w-3.5" /> New Server
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {["Name", "Owner", "Node", "Address", "Version", "RAM", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((s, i) => {
              const primaryAlloc = s.allocations[0];
              const address = primaryAlloc
                ? `${primaryAlloc.alias ?? s.node.fqdn}:${primaryAlloc.port}`
                : null;
              return (
              <tr key={s.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""} ${s.suspended ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{s.name}</span>
                      {s.suspended && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Suspended</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted">{s.jarType}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{s.user.email}</td>
                <td className="px-4 py-3 text-xs text-muted">{s.node.name}</td>
                <td className="px-4 py-3">
                  {address
                    ? <span className="font-mono text-xs text-foreground">{address}</span>
                    : <span className="text-xs text-muted/40">—</span>}
                  {s.allocations.length > 1 && (
                    <span className="ml-1.5 text-[10px] text-muted">+{s.allocations.length - 1}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{s.mcVersion}</td>
                <td className="px-4 py-3 text-xs text-muted">{fmtMb(s.memoryMb)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className={btnGhost}
                      onClick={() => setAllocTarget(s)}
                      title="Manage IP allocations"
                    >
                      <MapPin className="h-3 w-3" /> IPs
                    </button>
                    <button
                      className={s.suspended ? btnPrimary : btnDanger}
                      onClick={() => toggleSuspend(s)}
                      disabled={suspendingId === s.id}
                      title={s.suspended ? "Unsuspend server" : "Suspend server"}
                    >
                      {s.suspended
                        ? <><ShieldCheck className="h-3 w-3" /> Unsuspend</>
                        : <><ShieldOff className="h-3 w-3" /> Suspend</>}
                    </button>
                    <button className={btnGhost} onClick={() => setServerModal({ mode: "edit", server: s })}>
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button className={btnDanger} onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {servers.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-muted">No servers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {allocTarget && (
        <ServerAllocationsModal
          server={allocTarget}
          onClose={() => setAllocTarget(null)}
          onAllocationsChanged={(sid, allocs) => {
            setServers(servers.map((s) => s.id === sid ? { ...s, allocations: allocs } : s));
            setAllocTarget((prev) => prev && prev.id === sid ? { ...prev, allocations: allocs } : prev);
          }}
        />
      )}
      {serverModal?.mode === "create" && (
        <ServerModal mode="create" users={users} nodes={nodes} eggs={eggs} onClose={() => setServerModal(null)} onSave={createServer} />
      )}
      {serverModal?.mode === "edit" && (
        <ServerModal mode="edit" server={serverModal.server} users={users} nodes={nodes} eggs={eggs} onClose={() => setServerModal(null)}
          onSave={(data) => editServer(serverModal.server.id, data)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Server"
          description={`Delete "${deleteTarget.name}"? All backups and settings will be permanently deleted.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteServer(deleteTarget.id)}
        />
      )}
    </div>
  );
}

// ── Locations Tab ─────────────────────────────────────────────────────────────

function LocationsTab({ locations, setLocations }: {
  locations: AdminLocation[]; setLocations: (l: AdminLocation[]) => void;
}) {
  const [modal, setModal]           = useState<null | { mode: "create" } | { mode: "edit"; location: AdminLocation }>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminLocation | null>(null);

  async function createLocation(data: { name: string; displayName: string }) {
    const res  = await fetch("/api/admin/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create location");
    setLocations([...locations, json.location]);
  }

  async function editLocation(locationId: string, data: { name: string; displayName: string }) {
    const res  = await fetch(`/api/admin/locations/${locationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update location");
    setLocations(locations.map((l) => (l.id === locationId ? { ...l, ...json.location } : l)));
  }

  async function deleteLocation(locationId: string) {
    const res  = await fetch(`/api/admin/locations/${locationId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to delete location");
    setLocations(locations.filter((l) => l.id !== locationId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">{locations.length} location{locations.length !== 1 ? "s" : ""}</p>
        <button className={btnPrimary} onClick={() => setModal({ mode: "create" })}>
          <Plus className="h-3.5 w-3.5" /> New Location
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {["Slug", "Display Name", "Nodes", "Created", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.map((l, i) => (
              <tr key={l.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""}`}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-foreground">{l.name}</span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{l.displayName}</td>
                <td className="px-4 py-3 text-xs text-muted">{l._count.nodes}</td>
                <td className="px-4 py-3 text-xs text-muted">{fmtDate(l.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button className={btnGhost} onClick={() => setModal({ mode: "edit", location: l })}>
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => setDeleteTarget(l)}
                      disabled={l._count.nodes > 0}
                      title={l._count.nodes > 0 ? "Move or delete nodes first" : undefined}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted">No locations yet. Create one to group your nodes.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.mode === "create" && (
        <LocationModal mode="create" onClose={() => setModal(null)} onSave={createLocation} />
      )}
      {modal?.mode === "edit" && (
        <LocationModal mode="edit" location={modal.location} onClose={() => setModal(null)}
          onSave={(data) => editLocation(modal.location.id, data)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Location"
          description={`Delete location "${deleteTarget.displayName}"? This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteLocation(deleteTarget.id)}
        />
      )}
    </div>
  );
}

// ── Allocations Modal ─────────────────────────────────────────────────────────

function AllocationsModal({ node, onClose }: { node: AdminNode; onClose: () => void }) {
  const [allocations, setAllocations] = useState<AdminAllocation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [mode, setMode]               = useState<"single" | "range">("single");
  const [ip, setIp]                   = useState("0.0.0.0");
  const [port, setPort]               = useState("");
  const [portStart, setPortStart]     = useState("");
  const [portEnd, setPortEnd]         = useState("");
  const [alias, setAlias]             = useState("");
  const [adding, startAdd]            = useTransition();
  const [deleteId, setDeleteId]       = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/nodes/${node.id}/allocations`)
      .then((r) => r.json() as Promise<{ allocations?: AdminAllocation[] }>)
      .then((d) => { setAllocations(d.allocations ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load allocations"); setLoading(false); });
  }, [node.id]);

  function addAllocations() {
    setError("");
    const body = mode === "single"
      ? { ip, port: parseInt(port), alias: alias || undefined }
      : { ip, portStart: parseInt(portStart), portEnd: parseInt(portEnd), alias: alias || undefined };
    startAdd(async () => {
      try {
        const res = await fetch(`/api/admin/nodes/${node.id}/allocations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Failed"); return; }
        setAllocations(json.allocations ?? []);
        setPort(""); setPortStart(""); setPortEnd(""); setAlias("");
      } catch { setError("Request failed"); }
    });
  }

  async function deleteAlloc(id: string) {
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/allocations/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to delete"); return; }
      setAllocations((prev) => prev.filter((a) => a.id !== id));
    } finally { setDeleteId(null); }
  }

  const free   = allocations.filter((a) => !a.serverId);
  const inUse  = allocations.filter((a) => a.serverId);

  return (
    <Modal title={`Allocations — ${node.name}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Summary */}
        <div className="flex gap-4 text-xs text-muted">
          <span>{allocations.length} total</span>
          <span className="text-green-400">{free.length} free</span>
          <span className="text-accent">{inUse.length} in use</span>
        </div>

        {/* Add form */}
        <div className="rounded-lg border border-border bg-surface/30 p-4 space-y-3">
          <p className="text-xs font-medium text-foreground">Add Allocations</p>
          <div className="flex gap-2">
            {(["single", "range"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === m ? "bg-accent text-black" : "border border-border text-muted hover:text-foreground"}`}
              >
                {m === "single" ? "Single Port" : "Port Range"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bind IP">
              <input className={inputCls} value={ip} onChange={(e) => setIp(e.target.value)} placeholder="0.0.0.0" />
            </Field>
            {mode === "single" ? (
              <Field label="Port">
                <input className={inputCls} type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(e.target.value)} placeholder="25565" />
              </Field>
            ) : (
              <>
                <Field label="Start Port">
                  <input className={inputCls} type="number" min={1024} max={65535} value={portStart} onChange={(e) => setPortStart(e.target.value)} placeholder="25565" />
                </Field>
                <Field label="End Port">
                  <input className={inputCls} type="number" min={1024} max={65535} value={portEnd} onChange={(e) => setPortEnd(e.target.value)} placeholder="25600" />
                </Field>
              </>
            )}
            <Field label="Alias (optional)">
              <input className={inputCls} value={alias} onChange={(e) => setAlias(e.target.value)} placeholder={node.fqdn} />
            </Field>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            className={btnPrimary}
            onClick={addAllocations}
            disabled={adding || (mode === "single" ? !port : !portStart || !portEnd)}
          >
            <Plus className="h-3.5 w-3.5" />
            {adding ? "Adding…" : mode === "single" ? "Add Port" : "Add Range"}
          </button>
        </div>

        {/* Allocation table */}
        {loading ? (
          <div className="py-6 text-center text-xs text-muted">Loading…</div>
        ) : allocations.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted">
            No allocations yet. Add ports above so servers can be assigned addresses.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  {["Port", "IP", "Alias", "Assigned To", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, i) => (
                  <tr key={a.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""}`}>
                    <td className="px-3 py-2.5 font-mono font-medium text-foreground">{a.port}</td>
                    <td className="px-3 py-2.5 font-mono text-muted">{a.ip}</td>
                    <td className="px-3 py-2.5 text-muted">{a.alias ?? <span className="opacity-40">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {a.server
                        ? <span className="text-accent">{a.server.name}</span>
                        : <span className="text-green-400">Free</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        className={btnDanger}
                        onClick={() => deleteAlloc(a.id)}
                        disabled={!!a.serverId || deleteId === a.id}
                        title={a.serverId ? "Unassign server first" : "Remove allocation"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end">
          <button className={btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Nodes Tab ─────────────────────────────────────────────────────────────────

function NodesTab({ nodes, setNodes, locations }: {
  nodes: AdminNode[]; setNodes: (n: AdminNode[]) => void; locations: AdminLocation[];
}) {
  const [modal, setModal]           = useState<null | { mode: "create" } | { mode: "edit"; node: AdminNode }>(null);
  const [configNode, setConfigNode] = useState<AdminNode | null>(null);
  const [allocNode, setAllocNode]   = useState<AdminNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminNode | null>(null);
  const [togglingMaintId, setTogglingMaintId] = useState<string | null>(null);

  async function toggleMaintenance(node: AdminNode) {
    setTogglingMaintId(node.id);
    try {
      const res = await fetch(`/api/admin/nodes/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceMode: !node.maintenanceMode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setNodes(nodes.map((n) => n.id === node.id ? { ...n, maintenanceMode: json.node.maintenanceMode } : n));
    } catch {
      // noop
    } finally {
      setTogglingMaintId(null);
    }
  }

  async function createNode(data: Record<string, unknown>) {
    const res  = await fetch("/api/admin/nodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to create node");
    setNodes([...nodes, json.node]);
    setConfigNode(json.node);
  }

  async function editNode(nodeId: string, data: Record<string, unknown>) {
    const res  = await fetch(`/api/admin/nodes/${nodeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update node");
    setNodes(nodes.map((n) => (n.id === nodeId ? json.node : n)));
  }

  async function deleteNode(nodeId: string) {
    const res  = await fetch(`/api/admin/nodes/${nodeId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to delete node");
    setNodes(nodes.filter((n) => n.id !== nodeId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">{nodes.length} node{nodes.length !== 1 ? "s" : ""}</p>
        <button className={btnPrimary} onClick={() => setModal({ mode: "create" })}>
          <Plus className="h-3.5 w-3.5" /> New Node
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {["Name", "FQDN", "Location", "Port", "Servers", "TLS", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((n, i) => (
              <tr key={n.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""} ${n.maintenanceMode ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium text-foreground">{n.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{n.fqdn}</td>
                <td className="px-4 py-3">
                  {n.location
                    ? <span className="flex items-center gap-1 text-xs text-foreground"><MapPin className="h-3 w-3 text-muted" />{n.location.displayName}</span>
                    : <span className="text-xs text-muted/50">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{n.port}</td>
                <td className="px-4 py-3 text-xs text-muted">{n._count.servers}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${n.tlsEnabled ? "text-green-400" : "text-muted"}`}>
                    {n.tlsEnabled ? "HTTPS" : "HTTP"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {n.maintenanceMode
                    ? <span className="flex items-center gap-1 text-xs text-yellow-400"><Wrench className="h-3 w-3" /> Maintenance</span>
                    : <span className="text-xs text-green-400">Online</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className={n.maintenanceMode ? btnPrimary : btnGhost}
                      onClick={() => toggleMaintenance(n)}
                      disabled={togglingMaintId === n.id}
                      title={n.maintenanceMode ? "Take node out of maintenance" : "Put node in maintenance"}
                    >
                      <Wrench className="h-3 w-3" />
                      {n.maintenanceMode ? "End Maint." : "Maintenance"}
                    </button>
                    <button className={btnGhost} onClick={() => setAllocNode(n)} title="Manage port allocations">
                      <MapPin className="h-3 w-3" /> Ports
                    </button>
                    <button className={btnGhost} onClick={() => setConfigNode(n)} title="Wings config">
                      <Download className="h-3 w-3" /> Config
                    </button>
                    <button className={btnGhost} onClick={() => setModal({ mode: "edit", node: n })}>
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => setDeleteTarget(n)}
                      disabled={n._count.servers > 0}
                      title={n._count.servers > 0 ? "Delete servers on this node first" : undefined}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted">
                  No nodes yet. Add a node and install Wings on a machine to start deploying servers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.mode === "create" && (
        <NodeModal mode="create" locations={locations} onClose={() => setModal(null)} onSave={createNode} />
      )}
      {modal?.mode === "edit" && (
        <NodeModal mode="edit" node={modal.node} locations={locations} onClose={() => setModal(null)}
          onSave={(data) => editNode(modal.node.id, data)} />
      )}
      {allocNode && (
        <AllocationsModal node={allocNode} onClose={() => setAllocNode(null)} />
      )}
      {configNode && (
        <WingsConfigModal nodeId={configNode.id} nodeName={configNode.name} onClose={() => setConfigNode(null)} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Node"
          description={`Delete node "${deleteTarget.name}"? This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteNode(deleteTarget.id)}
        />
      )}
    </div>
  );
}

// ── Eggs Tab ──────────────────────────────────────────────────────────────────

function EggsTab({ eggs, setEggs }: { eggs: AdminEgg[]; setEggs: (e: AdminEgg[]) => void }) {
  const [importModal, setImportModal] = useState(false);
  const [detailEgg, setDetailEgg] = useState<AdminEgg | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminEgg | null>(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, startImport] = useTransition();

  async function handleImport() {
    setImportError("");
    let parsed: unknown;
    try { parsed = JSON.parse(importText); }
    catch { setImportError("Invalid JSON"); return; }
    startImport(async () => {
      try {
        const res = await fetch("/api/admin/eggs/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
        const json = await res.json();
        if (!res.ok) { setImportError(json.error ?? "Import failed"); return; }
        const updated = eggs.find((e) => e.id === json.egg.id);
        if (updated) setEggs(eggs.map((e) => e.id === json.egg.id ? { ...json.egg, _count: e._count } : e));
        else setEggs([...eggs, { ...json.egg, _count: { servers: 0 } }]);
        setImportModal(false);
        setImportText("");
      } catch { setImportError("Request failed"); }
    });
  }

  async function deleteEgg(eggId: string) {
    const res = await fetch(`/api/admin/eggs/${eggId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to delete egg");
    setEggs(eggs.filter((e) => e.id !== eggId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">{eggs.length} egg{eggs.length !== 1 ? "s" : ""}</p>
        <button className={btnPrimary} onClick={() => setImportModal(true)}>
          <Upload className="h-3.5 w-3.5" /> Import Egg
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {["Name", "Author", "Docker Image", "Variables", "Servers", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eggs.map((e, i) => (
              <tr key={e.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""}`}>
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium text-foreground">{e.name}</span>
                    {e.description && <div className="text-[10px] text-muted truncate max-w-xs">{e.description}</div>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{e.author || "—"}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted truncate max-w-[180px]">{e.dockerImage}</td>
                <td className="px-4 py-3 text-xs text-muted">{e.variables.length}</td>
                <td className="px-4 py-3 text-xs text-muted">{e._count.servers}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button className={btnGhost} onClick={() => setDetailEgg(e)}>
                      <Pencil className="h-3 w-3" /> Details
                    </button>
                    <button
                      className={btnDanger}
                      onClick={() => setDeleteTarget(e)}
                      disabled={e._count.servers > 0}
                      title={e._count.servers > 0 ? "Delete servers using this egg first" : undefined}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {eggs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted">No eggs configured. Import a Pterodactyl egg JSON to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {importModal && (
        <Modal title="Import Pterodactyl Egg" onClose={() => { setImportModal(false); setImportText(""); setImportError(""); }} wide>
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Paste a Pterodactyl v1 or v2 egg JSON below. Download eggs from{" "}
              <span className="font-mono text-foreground">github.com/pterodactyl/eggs</span> or export from Pterodactyl.
            </p>
            <textarea
              className={`${inputCls} font-mono text-[11px] h-64 resize-none`}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "name": "...", "startup": "...", "variables": [...] }'
              spellCheck={false}
            />
            {importError && <p className="text-xs text-red-400">{importError}</p>}
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => { setImportModal(false); setImportText(""); setImportError(""); }}>Cancel</button>
              <button className={btnPrimary} onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Egg Detail Modal */}
      {detailEgg && (
        <Modal title={detailEgg.name} onClose={() => setDetailEgg(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted">Author:</span> <span className="text-foreground">{detailEgg.author || "—"}</span></div>
              <div><span className="text-muted">itzg Type:</span> <span className="font-mono text-foreground">{detailEgg.itzgType}</span></div>
              <div className="col-span-2"><span className="text-muted">Startup:</span> <span className="font-mono text-foreground break-all">{detailEgg.startup}</span></div>
              <div><span className="text-muted">Stop command:</span> <span className="font-mono text-foreground">{detailEgg.configStop}</span></div>
              <div><span className="text-muted">Servers using this egg:</span> <span className="text-foreground">{detailEgg._count.servers}</span></div>
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Variables ({detailEgg.variables.length})</p>
              {detailEgg.variables.length === 0 ? (
                <p className="text-xs text-muted">No variables defined.</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface/50">
                        {["ENV Variable", "Name", "Default", "Editable"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailEgg.variables.map((v) => (
                        <tr key={v.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-mono text-accent">{v.envVariable}</td>
                          <td className="px-3 py-2 text-foreground">{v.name}</td>
                          <td className="px-3 py-2 font-mono text-muted">{v.defaultValue || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={v.userEditable ? "text-green-400" : "text-muted"}>
                              {v.userEditable ? "Yes" : "No"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button className={btnDanger} onClick={() => { setDeleteTarget(detailEgg); setDetailEgg(null); }} disabled={detailEgg._count.servers > 0} title={detailEgg._count.servers > 0 ? "Delete servers first" : undefined}>
                <Trash2 className="h-3 w-3" /> Delete Egg
              </button>
              <button className={btnGhost} onClick={() => setDetailEgg(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Egg"
          description={`Delete egg "${deleteTarget.name}"? This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteEgg(deleteTarget.id)}
        />
      )}
    </div>
  );
}

// ── Promo Codes Tab ───────────────────────────────────────────────────────────

function PromoCodesTab() {
  const [codes, setCodes]         = useState<AdminPromoCode[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPromoCode | null>(null);

  // Create form state
  const [newCode,        setNewCode]        = useState("");
  const [newDesc,        setNewDesc]        = useState("");
  const [newDiscType,    setNewDiscType]    = useState<"PERCENT" | "FIXED">("PERCENT");
  const [newDiscValue,   setNewDiscValue]   = useState("");
  const [newMaxUses,     setNewMaxUses]     = useState("");
  const [newExpiresAt,   setNewExpiresAt]   = useState("");
  const [createError,    setCreateError]    = useState("");
  const [creating,       startCreate]       = useTransition();

  useEffect(() => {
    fetch("/api/admin/promo-codes")
      .then((r) => r.json() as Promise<{ codes?: AdminPromoCode[] }>)
      .then((d) => { setCodes(d.codes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggleActive(code: AdminPromoCode) {
    setTogglingId(code.id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !code.active }),
      });
      const json = await res.json() as { code?: AdminPromoCode };
      if (res.ok && json.code) {
        setCodes((prev) => prev.map((c) => (c.id === code.id ? { ...c, active: json.code!.active } : c)));
      }
    } finally { setTogglingId(null); }
  }

  async function deleteCode(id: string) {
    await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  function submitCreate() {
    setCreateError("");
    const val = parseInt(newDiscValue);
    if (!newCode.trim()) { setCreateError("Code is required"); return; }
    if (!val || val < 1) { setCreateError("Discount value must be at least 1"); return; }
    if (newDiscType === "PERCENT" && val > 100) { setCreateError("Percentage cannot exceed 100"); return; }

    startCreate(async () => {
      try {
        const res = await fetch("/api/admin/promo-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code:          newCode.trim(),
            description:   newDesc.trim(),
            discountType:  newDiscType,
            discountValue: val,
            maxUses:       newMaxUses ? parseInt(newMaxUses) : null,
            expiresAt:     newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
          }),
        });
        const json = await res.json() as { code?: AdminPromoCode; error?: string };
        if (!res.ok) { setCreateError(json.error ?? "Failed to create code"); return; }
        setCodes((prev) => [{ ...json.code!, _count: { redemptions: 0 } }, ...prev]);
        setShowCreate(false);
        setNewCode(""); setNewDesc(""); setNewDiscValue(""); setNewMaxUses(""); setNewExpiresAt("");
      } catch { setCreateError("Request failed"); }
    });
  }

  function fmtExpiry(iso: string | null | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const past = d < new Date();
    return (
      <span className={past ? "text-red-400" : "text-muted"}>
        {fmtDate(iso)}
        {past ? " (expired)" : ""}
      </span>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">{codes.length} code{codes.length !== 1 ? "s" : ""}</p>
        <button className={btnPrimary} onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3.5 w-3.5" /> New Code
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-5 rounded-lg border border-border bg-surface/30 p-5 space-y-4">
          <p className="text-xs font-semibold text-foreground">Create Promo Code</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code (auto-uppercased)">
              <input
                className={inputCls}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="SAVE20"
              />
            </Field>
            <Field label="Discount Type">
              <select className={selectCls} value={newDiscType} onChange={(e) => setNewDiscType(e.target.value as "PERCENT" | "FIXED")}>
                <option value="PERCENT">Percentage (% off)</option>
                <option value="FIXED">Fixed ($X off)</option>
              </select>
            </Field>
          </div>
          <Field label={newDiscType === "PERCENT" ? "Discount Percentage (1–100)" : "Discount Amount (USD, e.g. 5 = $5 off)"}>
            <div className="relative">
              {newDiscType === "FIXED" && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              )}
              <input
                className={`${inputCls} ${newDiscType === "FIXED" ? "pl-7" : ""}`}
                type="number"
                min={1}
                max={newDiscType === "PERCENT" ? 100 : undefined}
                value={newDiscValue}
                onChange={(e) => setNewDiscValue(e.target.value)}
                placeholder={newDiscType === "PERCENT" ? "e.g. 20" : "e.g. 5"}
              />
              {newDiscType === "PERCENT" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
              )}
            </div>
          </Field>
          <Field label="Description (optional)">
            <input
              className={inputCls}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="e.g. Summer 2024 promo"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max Uses (blank = unlimited)">
              <input
                className={inputCls}
                type="number"
                min={1}
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </Field>
            <Field label="Expires At (blank = never)">
              <input
                className={inputCls}
                type="datetime-local"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
              />
            </Field>
          </div>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={submitCreate} disabled={creating}>
              {creating ? "Creating…" : "Create Code"}
            </button>
            <button className={btnGhost} onClick={() => { setShowCreate(false); setCreateError(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs text-muted">Loading…</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                {["Code", "Description", "Discount", "Uses", "Expires", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} className={`border-b border-border last:border-0 ${i % 2 ? "bg-surface/20" : ""} ${!c.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-foreground">{c.code}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[160px] truncate">
                    {c.description || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-accent">
                    {(c.discountType ?? "PERCENT") === "PERCENT"
                      ? `${c.discountValue ?? 0}% off`
                      : `$${((c.discountValue ?? 0) / 100).toFixed(2)} off`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {c._count?.redemptions ?? 0}
                    {c.maxUses != null && (
                      <span className="text-muted/60"> / {c.maxUses}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{fmtExpiry(c.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${c.active ? "text-green-400" : "text-muted"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className={c.active ? btnGhost : btnPrimary}
                        onClick={() => toggleActive(c)}
                        disabled={togglingId === c.id}
                        title={c.active ? "Deactivate" : "Activate"}
                      >
                        {c.active
                          ? <><ToggleRight className="h-3.5 w-3.5" /> Deactivate</>
                          : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>}
                      </button>
                      <button
                        className={btnDanger}
                        onClick={() => setDeleteTarget(c)}
                        title="Delete permanently"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted">
                    No promo codes yet. Create one above to let users redeem credits.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Promo Code"
          description={`Permanently delete code "${deleteTarget.code}"? Existing redemptions are not affected.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteCode(deleteTarget.id)}
        />
      )}
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export function AdminClient({ currentUserId, initialUsers, initialServers, initialLocations, initialNodes, initialEggs }: Props) {
  const [activeTab, setActiveTab] = useState<"users" | "servers" | "locations" | "nodes" | "eggs" | "promo">("users");
  const [users,     setUsers]     = useState<AdminUser[]>(initialUsers.map((u) => ({ ...u, createdAt: String(u.createdAt) })));
  const [servers,   setServers]   = useState<AdminServer[]>(initialServers.map((s) => ({ ...s, createdAt: String(s.createdAt) })));
  const [locations, setLocations] = useState<AdminLocation[]>(initialLocations);
  const [nodes,     setNodes]     = useState<AdminNode[]>(initialNodes);
  const [eggs,      setEggs]      = useState<AdminEgg[]>(initialEggs);
  const [panelMaintenance, setPanelMaintenance] = useState<boolean | null>(null);
  const [loadingMaint, setLoadingMaint] = useState(false);

  // Fetch current panel maintenance state on mount
  useState(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setPanelMaintenance(d.settings?.maintenanceMode ?? false))
      .catch(() => setPanelMaintenance(false));
  });

  async function togglePanelMaintenance() {
    if (panelMaintenance === null) return;
    setLoadingMaint(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceMode: !panelMaintenance }),
      });
      const json = await res.json();
      if (res.ok) setPanelMaintenance(json.settings.maintenanceMode);
    } finally {
      setLoadingMaint(false);
    }
  }

  const TABS = [
    { id: "users"     as const, label: "Users",     icon: Users,  count: users.length     },
    { id: "servers"   as const, label: "Servers",   icon: Server, count: servers.length   },
    { id: "locations" as const, label: "Locations", icon: MapPin, count: locations.length },
    { id: "nodes"     as const, label: "Nodes",     icon: Cpu,    count: nodes.length     },
    { id: "eggs"      as const, label: "Eggs",      icon: Egg,    count: eggs.length      },
    { id: "promo"     as const, label: "Promo",     icon: Tag,    count: null             },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Admin Panel</h1>
          <p className="mt-0.5 text-xs text-muted">Manage users, servers, locations, Wings nodes, and server eggs.</p>
        </div>
        <button
          onClick={togglePanelMaintenance}
          disabled={loadingMaint || panelMaintenance === null}
          className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            panelMaintenance
              ? "border-yellow-600 bg-yellow-950/40 text-yellow-300 hover:bg-yellow-950/60"
              : "border-border text-muted hover:text-foreground"
          }`}
          title={panelMaintenance ? "Disable maintenance mode (non-admin users regain access)" : "Enable maintenance mode (blocks non-admin users)"}
        >
          <Settings className="h-3.5 w-3.5" />
          {panelMaintenance ? "Maintenance ON — Click to Disable" : "Panel Maintenance: Off"}
        </button>
      </div>
      {panelMaintenance && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-700 bg-yellow-950/40 px-4 py-2.5 text-xs text-yellow-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Panel maintenance mode is <strong>active</strong>. Non-admin users are being redirected to the maintenance page.</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface/30 p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === id ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count !== null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === id ? "bg-accent/20 text-accent" : "bg-border text-muted"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "users"     && <UsersTab     users={users}         setUsers={setUsers}         currentUserId={currentUserId} />}
      {activeTab === "servers"   && <ServersTab   servers={servers}     setServers={setServers}     users={users} nodes={nodes} eggs={eggs} />}
      {activeTab === "locations" && <LocationsTab locations={locations} setLocations={setLocations} />}
      {activeTab === "nodes"     && <NodesTab     nodes={nodes}         setNodes={setNodes}         locations={locations} />}
      {activeTab === "eggs"      && <EggsTab      eggs={eggs}           setEggs={setEggs} />}
      {activeTab === "promo"     && <PromoCodesTab />}
    </div>
  );
}
