"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Clock, Terminal, Power, Loader2, Play, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface TasksTabData {
  id: string;
  isOwner: boolean;
}

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  action: string;
  payload: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

const CRON_PRESETS = [
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour",        value: "0 * * * *" },
  { label: "Every 6 hours",     value: "0 */6 * * *" },
  { label: "Every day at 3 AM", value: "0 3 * * *" },
  { label: "Every Sunday at midnight", value: "0 0 * * 0" },
  { label: "Custom…",           value: "custom" },
];

const ACTION_OPTIONS = [
  { value: "command",  label: "Run command",    icon: Terminal },
  { value: "restart",  label: "Restart server", icon: Power },
  { value: "stop",     label: "Stop server",    icon: Power },
  { value: "start",    label: "Start server",   icon: Play },
];

function actionLabel(action: string) {
  return ACTION_OPTIONS.find((a) => a.value === action)?.label ?? action;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 0) {
    // future (nextRunAt)
    const secs = Math.round(-diff / 1000);
    if (secs < 60) return `in ${secs}s`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.round(mins / 60);
    return `in ${hrs}h`;
  }
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function TaskRow({
  task,
  isOwner,
  onToggle,
  onDelete,
  toggling,
}: {
  task: ScheduledTask;
  isOwner: boolean;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
}) {
  const ActionIcon = ACTION_OPTIONS.find((a) => a.value === task.action)?.icon ?? Terminal;
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          task.enabled ? "bg-accent" : "bg-surface-2",
          toggling && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
          task.enabled ? "translate-x-4" : "translate-x-0"
        )} />
      </button>

      {/* Icon + info */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">
          <ActionIcon className="h-3.5 w-3.5 text-muted" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium truncate", !task.enabled && "text-muted")}>{task.name}</p>
          <p className="text-xs text-muted truncate">
            <span className="font-mono">{task.schedule}</span>
            {" · "}
            {actionLabel(task.action)}
            {task.action === "command" && task.payload && (
              <span className="font-mono"> · {task.payload.slice(0, 30)}{task.payload.length > 30 ? "…" : ""}</span>
            )}
          </p>
        </div>
      </div>

      {/* Times */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-right">
        <span className="text-[11px] text-muted">next: <span className="text-foreground">{formatDate(task.nextRunAt)}</span></span>
        <span className="text-[11px] text-muted">last: {formatDate(task.lastRunAt)}</span>
      </div>

      {/* Delete */}
      {isOwner && (
        <button
          onClick={onDelete}
          className="ml-1 shrink-0 rounded p-1.5 text-muted hover:bg-surface-2 hover:text-status-offline transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function CreateDialog({
  open,
  onClose,
  onCreated,
  serverId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: ScheduledTask) => void;
  serverId: string;
}) {
  const [name, setName] = useState("");
  const [presetKey, setPresetKey] = useState(CRON_PRESETS[0]!.value);
  const [customCron, setCustomCron] = useState("");
  const [action, setAction] = useState("command");
  const [payload, setPayload] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schedule = presetKey === "custom" ? customCron : presetKey;

  async function handleCreate() {
    if (!name.trim() || !schedule.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/servers/${serverId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), schedule: schedule.trim(), action, payload: payload.trim() }),
      });
      const data = await res.json() as { task?: ScheduledTask; error?: string };
      if (!res.ok || !data.task) { setError(data.error ?? "Failed to create task"); return; }
      onCreated(data.task);
      // reset
      setName(""); setPresetKey(CRON_PRESETS[0]!.value); setCustomCron(""); setAction("command"); setPayload("");
      onClose();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={() => !saving && onClose()}>
      <DialogHeader title="New scheduled task" onClose={() => !saving && onClose()} />
      <DialogBody>
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Task name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily restart"
              maxLength={64}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Schedule</label>
            <div className="relative">
              <select
                value={presetKey}
                onChange={(e) => setPresetKey(e.target.value)}
                className="w-full appearance-none rounded-md border border-border bg-surface-2 px-3 py-2 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            {presetKey === "custom" && (
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="*/5 * * * *"
                className="mt-2 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            )}
            {presetKey !== "custom" && (
              <p className="mt-1 font-mono text-[11px] text-muted">{presetKey}</p>
            )}
          </div>

          {/* Action */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Action</label>
            <div className="relative">
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full appearance-none rounded-md border border-border bg-surface-2 px-3 py-2 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </div>

          {/* Command payload */}
          {action === "command" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Command</label>
              <input
                type="text"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder="say Server has been running for 1 hour!"
                maxLength={256}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <p className="mt-1 text-[11px] text-muted">Without the leading /</p>
            </div>
          )}

          {error && <p className="text-xs text-status-offline">{error}</p>}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={handleCreate} loading={saving} disabled={!name.trim() || !schedule.trim() || (action === "command" && !payload.trim())}>
          <Clock className="h-3.5 w-3.5" />
          Create task
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export function TasksTab({ server }: { server: TasksTabData }) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/servers/${server.id}/tasks`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .finally(() => setLoading(false));
  }, [server.id]);

  async function toggleTask(task: ScheduledTask) {
    setToggling((t) => ({ ...t, [task.id]: true }));
    try {
      const res = await fetch(`/api/servers/${server.id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      const data = await res.json() as { task?: ScheduledTask };
      if (data.task) setTasks((ts) => ts.map((t) => t.id === task.id ? data.task! : t));
    } finally {
      setToggling((t) => ({ ...t, [task.id]: false }));
    }
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/servers/${server.id}/tasks/${taskId}`, { method: "DELETE" });
    setTasks((ts) => ts.filter((t) => t.id !== taskId));
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Scheduled Tasks</h2>
            <p className="text-xs text-muted mt-0.5">Automate commands and power actions on a cron schedule</p>
          </div>
          {server.isOwner && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New task
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Clock className="h-8 w-8 text-muted opacity-30" />
              <p className="text-sm text-muted">No scheduled tasks</p>
              {server.isOwner && (
                <p className="text-xs text-muted opacity-70">
                  Add a task to automate restarts, announcements, and more
                </p>
              )}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isOwner={server.isOwner}
                onToggle={() => toggleTask(task)}
                onDelete={() => deleteTask(task.id)}
                toggling={toggling[task.id] ?? false}
              />
            ))
          )}
        </div>
      </div>

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => setTasks((ts) => [...ts, t])}
        serverId={server.id}
      />
    </div>
  );
}
