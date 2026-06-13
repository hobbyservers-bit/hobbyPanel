import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Server, Shield, UserCircle, Palette, Users } from "lucide-react";
import { validateRequest, invalidateSession, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { getServerResources } from "@/lib/wings/client";
import { ServerGrid } from "@/components/dashboard/server-grid";
import type { ServersListResponse, ServerListItem, ServerResource } from "@/app/api/servers/route";
import type { NodeCredentials } from "@/lib/wings/types";
import { getPanelSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Dashboard" };

// RSC — re-runs on every navigation (no static cache)
export const dynamic = "force-dynamic";

function nodeCreds(node: {
  id: string; fqdn: string; port: number;
  tlsEnabled: boolean; tokenId: string; tokenSecret: string;
}): NodeCredentials {
  return {
    nodeId: node.id, fqdn: node.fqdn, port: node.port,
    tlsEnabled: node.tlsEnabled, tokenId: node.tokenId, tokenSecret: node.tokenSecret,
  };
}

// ── Logout server action ──────────────────────────────────────────────────────

async function logoutAction() {
  "use server";
  const { session } = await validateRequest();
  if (session) await invalidateSession(session.id);

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  redirect("/login");
}

// ── Server-side data fetch (used as initialData for SWR) ─────────────────────

async function loadDashboardData(userId: string, role: string): Promise<{
  response: ServersListResponse;
}> {
  const dbServers = await prisma.server.findMany({
    where: { OR: [{ userId }, { subUsers: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, externalId: true, status: true,
      mcVersion: true, jarType: true, memoryMb: true, diskMb: true,
      cpuLimit: true, userId: true,
      node: {
        select: {
          id: true, fqdn: true, port: true,
          tlsEnabled: true, tokenId: true, tokenSecret: true,
        },
      },
      allocations: {
        orderBy: { port: "asc" },
        take: 1,
        select: { port: true, ip: true, alias: true },
      },
    },
  });

  const withResources: ServerListItem[] = await Promise.all(
    dbServers.map(async (s) => {
      const key = `resources:${s.externalId}`;
      let resources: ServerResource | null = await cacheGet<ServerResource>(key);
      if (!resources) {
        try {
          const res = await getServerResources(nodeCreds(s.node), s.externalId);
          const r = res.attributes.resources;
          resources = {
            cpuPercent: parseFloat(r.cpu_absolute.toFixed(1)),
            memoryMb: Math.round(r.memory_bytes / 1_048_576),
            diskMb: Math.round(r.disk_bytes / 1_048_576),
            uptimeSeconds: Math.floor(r.uptime / 1000),
            currentState: res.attributes.current_state,
          };
          await cacheSet(key, resources, 2);
        } catch {
          resources = null;
        }
      }
      const alloc = s.allocations[0];
      return {
        id: s.id, name: s.name, externalId: s.externalId, status: s.status,
        mcVersion: s.mcVersion, jarType: s.jarType, memoryMb: s.memoryMb,
        diskMb: s.diskMb, cpuLimit: s.cpuLimit, nodeFqdn: s.node.fqdn,
        serverAddress: alloc ? `${alloc.alias ?? s.node.fqdn}:${alloc.port}` : null,
        resources,
      };
    })
  );

  const ownedCount = dbServers.filter((s) => s.userId === userId).length;
  const canCreateServer = role === "ADMIN" || ownedCount === 0;

  return { response: { servers: withResources, canCreateServer } };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    const { maintenanceMode } = await getPanelSettings();
    if (maintenanceMode) redirect("/maintenance");
  }

  const [{ response: initialData }, dbUser] = await Promise.all([
    loadDashboardData(user.id, user.role),
    prisma.user.findUnique({ where: { id: user.id }, select: { credits: true } }),
  ]);
  const credits = dbUser?.credits ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Server className="h-4 w-4 text-accent" />
            <span className="font-semibold text-sm text-foreground">
              HobbyPanel
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user.role === "ADMIN" && (
              <Link href="/admin" className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:block">Admin</span>
              </Link>
            )}
            <Link
              href="/credits"
              className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-xs font-medium text-amber-300 hover:border-amber-500/50 hover:bg-amber-950/50 transition-colors"
            >
              <Image src="/assets/icons/credits_icon.png" alt="" width={14} height={14} className="opacity-90" />
              <span className="tabular-nums">{credits.toLocaleString()}</span>
            </Link>
            <Link href="/theme" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Theme</span>
            </Link>
            <Link href="/affiliate" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Affiliate</span>
            </Link>
            <Link href="/account" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
              <UserCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Account</span>
            </Link>
            <span className="hidden text-xs text-muted sm:block">
              {user.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Servers</h1>
          <p className="mt-0.5 text-xs text-muted">
            {initialData.servers.length === 0
              ? "Create your first server to get started."
              : `${initialData.servers.length} server${initialData.servers.length === 1 ? "" : "s"} — updates every 5 seconds`}
          </p>
        </div>

        <ServerGrid initialData={initialData} />
      </main>
    </div>
  );
}
