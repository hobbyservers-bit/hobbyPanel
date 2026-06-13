"use client";

import { useState, useEffect, useCallback } from "react";
import { HardDrive, Plus, Trash2, Download, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";

interface Backup {
  id: string;
  name: string;
  sizeMb: number | null;
  status: "PENDING" | "COMPLETE" | "FAILED";
  createdAt: string;
}

interface ServerData {
  id: string;
  isOwner: boolean;
}

export function BackupsTab({ server }: { server: ServerData }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backupName, setBackupName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/backups`);
      const data = (await res.json()) as { backups: Backup[] };
      setBackups(data.backups ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [server.id]);

  useEffect(() => { load(); }, [load]);

  async function createBackup() {
    setCreating(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/backups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: backupName.trim() || undefined }),
      });
      if (res.ok) { setBackupName(""); await load(); }
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/servers/${server.id}/backups/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  function handleDownload(backup: Backup) {
    window.open(`/api/servers/${server.id}/backups/${backup.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl p-6 flex flex-col gap-4">
      {/* Create backup */}
      {server.isOwner && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={backupName}
            onChange={(e) => setBackupName(e.target.value)}
            placeholder="Backup name (optional)"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button size="sm" onClick={createBackup} loading={creating} disabled={creating}>
            <Plus className="h-3.5 w-3.5" />
            Create backup
          </Button>
        </div>
      )}

      {/* Backup list */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted">Loading…</div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <HardDrive className="h-6 w-6 text-muted/50" />
            <p className="text-sm text-muted">No backups yet.</p>
            {server.isOwner && (
              <p className="text-xs text-muted/70">Click "Create backup" to make your first backup.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {backups.map((b) => {
              const date = new Date(b.createdAt);
              const dateStr = isNaN(date.getTime()) ? "—" : date.toLocaleString();
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <HardDrive className="h-4 w-4 shrink-0 text-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                    <p className="text-xs text-muted">
                      {dateStr}
                      {b.sizeMb != null && ` · ${formatBytes(b.sizeMb * 1_048_576)}`}
                    </p>
                  </div>
                  <Badge
                    variant={b.status === "COMPLETE" ? "online" : b.status === "FAILED" ? "offline" : "starting"}
                    dot
                  >
                    {b.status === "COMPLETE" ? "Complete" : b.status === "FAILED" ? "Failed" : "Pending"}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {b.status === "COMPLETE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDownload(b)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {server.isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-status-offline"
                        onClick={() => setDeleteTarget(b)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogHeader title="Delete backup?" onClose={() => setDeleteTarget(null)} />
        <DialogBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-offline" />
            <p className="text-sm text-muted leading-relaxed">
              Backup <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently deleted.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            className="bg-status-offline/10 text-status-offline border-status-offline/30 hover:bg-status-offline/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
