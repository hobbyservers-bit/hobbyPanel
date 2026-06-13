import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPanelSettings } from "@/lib/settings";
import { ServerClient } from "./client";

export const dynamic = "force-dynamic";

async function getServerData(panelId: string, userId: string) {
  const server = await prisma.server.findFirst({
    where: {
      id: panelId,
      OR: [{ userId }, { subUsers: { some: { userId } } }],
    },
    include: {
      node: true,
      user: { select: { plan: true } },
      allocations: { orderBy: { port: "asc" }, take: 1 },
    },
  });


  if (!server) return null;

  const isOwner = server.userId === userId;
  let permissions = { canConsole: true, canFiles: true, canPower: true, canSettings: true };

  if (!isOwner) {
    const su = await prisma.serverUser.findUnique({
      where: { userId_serverId: { userId, serverId: panelId } },
    });
    permissions = {
      canConsole: su?.canConsole ?? false,
      canFiles: su?.canFiles ?? false,
      canPower: su?.canPower ?? false,
      canSettings: su?.canSettings ?? false,
    };
  }

  return {
    id: server.id,
    name: server.name,
    externalId: server.externalId,
    status: server.status,
    memoryMb: server.memoryMb,
    diskMb: server.diskMb,
    cpuLimit: server.cpuLimit,
    mcVersion: server.mcVersion,
    jarType: server.jarType,
    startupCommand: server.startupCommand ?? "",
    dockerImage: server.dockerImage ?? "",
    isOwner,
    ...permissions,
    nodeFqdn: server.node.fqdn,
    ownerPlan: server.user.plan as string,
    suspended: server.suspended,
    nodeMaintenance: server.node.maintenanceMode,
    serverAddress: server.allocations[0]
      ? `${server.allocations[0].alias ?? server.node.fqdn}:${server.allocations[0].port}`
      : null,
  };
}

export type ServerPageData = NonNullable<Awaited<ReturnType<typeof getServerData>>>;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { user } = await validateRequest();
  if (!user) return { title: "Server" };
  const server = await getServerData(id, user.id);
  return { title: server ? `${server.name} — HobbyPanel` : "Not found" };
}

export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await validateRequest();
  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    const { maintenanceMode } = await getPanelSettings();
    if (maintenanceMode) redirect("/maintenance");
  }

  const { id } = await params;
  const server = await getServerData(id, user.id);
  if (!server) notFound();

  return <ServerClient server={server} userEmail={user.email} isAdmin={user.role === "ADMIN"} />;
}
