"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ServerData {
  id: string;
  name: string;
  mcVersion: string;
  startupCommand: string | null;
  dockerImage: string | null;
  isOwner: boolean;
  canSettings: boolean;
}

export function SettingsTab({ server }: { server: ServerData }) {
  const router = useRouter();
  const canEdit = server.isOwner || server.canSettings;
  const [name, setName] = useState(server.name);
  const [startup, setStartup] = useState(server.startupCommand ?? "");
  const [dockerImage, setDockerImage] = useState(server.dockerImage ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reinstallOpen, setReinstallOpen] = useState(false);
  const [reinstalling, setReinstalling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isDirty =
    name !== server.name ||
    startup !== (server.startupCommand ?? "") ||
    dockerImage !== (server.dockerImage ?? "");

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startupCommand: startup.trim(), dockerImage: dockerImage.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  async function handleReinstall() {
    setReinstalling(true);
    try {
      await fetch(`/api/servers/${server.id}/reinstall`, { method: "POST" });
    } catch { /* ignore */ }
    finally {
      setReinstalling(false);
      setReinstallOpen(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/servers/${server.id}`, { method: "DELETE" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setDeleteError(data.error ?? "Delete failed"); return; }
      router.push("/dashboard");
    } catch { setDeleteError("Network error"); }
    finally { setDeleting(false); }
  }

  return (
    <div className="mx-auto max-w-xl p-6 flex flex-col gap-6">
      {/* General settings */}
      <section className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">General</h2>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          <Input
            label="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            maxLength={32}
          />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Startup command
            </label>
            <textarea
              value={startup}
              onChange={(e) => setStartup(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className={cn(
                "w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground",
                "placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                "disabled:cursor-not-allowed disabled:opacity-60 resize-none"
              )}
            />
          </div>
          <Input
            label="Docker image"
            value={dockerImage}
            onChange={(e) => setDockerImage(e.target.value)}
            disabled={!canEdit}
            placeholder="ghcr.io/pterodactyl/yolks:java_21"
          />

          {error && (
            <p className="text-xs text-status-offline">{error}</p>
          )}

          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || saving}
                loading={saving}
              >
                <Save className="h-3.5 w-3.5" />
                {saved ? "Saved!" : "Save changes"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      {server.isOwner && (
        <section className="rounded-lg border border-status-offline/30 bg-surface">
          <div className="border-b border-status-offline/20 px-4 py-3">
            <h2 className="text-sm font-semibold text-status-offline">Danger zone</h2>
          </div>
          <div className="flex items-center justify-between px-4 py-4 border-b border-status-offline/10">
            <div>
              <p className="text-sm font-medium text-foreground">Reinstall server</p>
              <p className="mt-0.5 text-xs text-muted">
                Wipe all files and reinstall a fresh Minecraft server. This cannot be undone.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReinstallOpen(true)}
              className="shrink-0 text-status-offline hover:border-status-offline/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reinstall
            </Button>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Delete server</p>
              <p className="mt-0.5 text-xs text-muted">
                Permanently delete this server and all its files. There is no going back.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setDeleteConfirm(""); setDeleteError(null); setDeleteOpen(true); }}
              className="shrink-0 text-status-offline hover:border-status-offline/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </section>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
        <DialogHeader title="Delete server?" onClose={() => !deleting && setDeleteOpen(false)} />
        <DialogBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-offline" />
            <div className="space-y-3">
              <p className="text-sm text-muted leading-relaxed">
                This will permanently delete{" "}
                <span className="font-medium text-foreground">{server.name}</span> and all its
                files. This action cannot be undone.
              </p>
              <div>
                <p className="mb-1.5 text-xs text-muted">
                  Type <span className="font-mono text-foreground">{server.name}</span> to confirm
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={server.name}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-offline/50"
                />
              </div>
              {deleteError && <p className="text-xs text-status-offline">{deleteError}</p>}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleteConfirm !== server.name}
            className="bg-status-offline/10 text-status-offline border-status-offline/30 hover:bg-status-offline/20 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete server
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Reinstall confirmation */}
      <Dialog open={reinstallOpen} onClose={() => setReinstallOpen(false)}>
        <DialogHeader title="Reinstall server?" onClose={() => setReinstallOpen(false)} />
        <DialogBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-offline" />
            <p className="text-sm text-muted leading-relaxed">
              All files on <span className="font-medium text-foreground">{server.name}</span> will be deleted
              and a fresh Paper installation will be created. This cannot be undone.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setReinstallOpen(false)} disabled={reinstalling}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleReinstall}
            loading={reinstalling}
            className="bg-status-offline/10 text-status-offline border-status-offline/30 hover:bg-status-offline/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reinstall
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
