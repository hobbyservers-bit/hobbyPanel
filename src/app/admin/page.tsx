import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Server } from "lucide-react";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminClient } from "./client";

export const metadata: Metadata = { title: "Admin Panel — HobbyPanel" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await validateRequest();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [rawUsers, rawServers, rawLocations, rawNodes, rawEggs] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        credits: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { servers: true } },
      },
    }),
    prisma.server.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        externalId: true,
        status: true,
        mcVersion: true,
        jarType: true,
        memoryMb: true,
        diskMb: true,
        cpuLimit: true,
        suspended: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
        node: { select: { id: true, name: true, fqdn: true } },
        allocations: { orderBy: { port: "asc" }, select: { id: true, ip: true, alias: true, port: true, notes: true, serverId: true } },
      },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { nodes: true } } },
    }),
    prisma.node.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        location: { select: { id: true, name: true, displayName: true } },
        _count: { select: { servers: true } },
      },
    }),
    prisma.egg.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        variables: { orderBy: { sortOrder: "asc" } },
        _count: { select: { servers: true } },
      },
    }),
  ]);

  const users   = rawUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
  const servers = rawServers.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }));
  const locations = rawLocations.map((l) => ({ ...l, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() }));
  const nodes = rawNodes.map(({ tokenSecret: _ts, ...n }) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
  const eggs = rawEggs.map((e) => ({
    ...e,
    dockerImages: (e.dockerImages as Record<string, string>) ?? {},
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors">
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">HobbyPanel</span>
            </Link>
            <span className="text-border">/</span>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Admin</span>
            </div>
          </div>
          <span className="hidden text-xs text-muted sm:block">{user.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <AdminClient
          currentUserId={user.id}
          initialUsers={users}
          initialServers={servers}
          initialLocations={locations}
          initialNodes={nodes}
          initialEggs={eggs}
        />
      </main>
    </div>
  );
}
