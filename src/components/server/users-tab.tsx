"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SubUser {
  id: string;
  userId: string;
  email: string;
  canConsole: boolean;
  canFiles: boolean;
  canPower: boolean;
  canSettings: boolean;
}

interface ServerData {
  id: string;
  isOwner: boolean;
}

const PERMISSIONS = [
  { key: "canConsole", label: "Console", desc: "View console output and send commands" },
  { key: "canFiles", label: "Files", desc: "Browse and edit server files" },
  { key: "canPower", label: "Power", desc: "Start, stop, and restart the server" },
  { key: "canSettings", label: "Settings", desc: "Modify server settings" },
] as const;

type PermKey = typeof PERMISSIONS[number]["key"];

export function UsersTab({ server }: { server: ServerData }) {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerms, setInvitePerms] = useState<Record<PermKey, boolean>>({
    canConsole: true,
    canFiles: false,
    canPower: false,
    canSettings: false,
  });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/users`);
      const data = (await res.json()) as { users: SubUser[] };
      setUsers(data.users ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [server.id]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite() {
    setInviteError(null);
    setInviting(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), ...invitePerms }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setInviteError(data.error ?? "Failed to add user"); return; }
      setInviteOpen(false);
      setInviteEmail("");
      await load();
    } catch { setInviteError("Network error"); }
    finally { setInviting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/servers/${server.id}/users/${deleteTarget.userId}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  async function togglePerm(userId: string, perm: PermKey, current: boolean) {
    await fetch(`/api/servers/${server.id}/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [perm]: !current }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-2xl p-6 flex flex-col gap-4">
      {server.isOwner && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add user
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted">Loading…</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Users className="h-6 w-6 text-muted/50" />
            <p className="text-sm text-muted">No subusers yet.</p>
            {server.isOwner && (
              <p className="text-xs text-muted/70">Add a user to share access to this server.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{u.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {PERMISSIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => server.isOwner && togglePerm(u.userId, key, u[key])}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                          u[key]
                            ? "bg-accent/15 text-accent"
                            : "bg-surface-2 text-muted",
                          server.isOwner && "cursor-pointer hover:opacity-80",
                          !server.isOwner && "cursor-default"
                        )}
                        title={server.isOwner ? `Toggle ${label}` : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {server.isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 w-7 p-0 text-status-offline"
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <DialogHeader title="Add subuser" onClose={() => setInviteOpen(false)} />
        <DialogBody className="flex flex-col gap-4">
          {inviteError && (
            <div className="rounded-md border border-status-offline/30 bg-status-offline/10 px-3 py-2 text-sm text-status-offline">
              {inviteError}
            </div>
          )}
          <Input
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@example.com"
            autoFocus
          />
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Permissions</p>
            <div className="space-y-2">
              {PERMISSIONS.map(({ key, label, desc }) => (
                <label key={key} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={invitePerms[key]}
                    onChange={(e) => setInvitePerms((p) => ({ ...p, [key]: e.target.checked }))}
                    className="mt-0.5 accent-accent"
                  />
                  <div>
                    <p className="text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setInviteOpen(false)} disabled={inviting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleInvite}
            loading={inviting}
            disabled={!inviteEmail.trim()}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add user
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogHeader title="Remove user?" onClose={() => setDeleteTarget(null)} />
        <DialogBody>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-offline" />
            <p className="text-sm text-muted leading-relaxed">
              <span className="font-medium text-foreground">{deleteTarget?.email}</span> will lose access to this server.
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
            Remove
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
