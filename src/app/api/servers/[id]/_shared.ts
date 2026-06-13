import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as nodePath from "path";
import type { Server, Node, Plan } from "@prisma/client";

export type ServerWithNode = Server & { node: Node };

type Permission = "canConsole" | "canFiles" | "canPower" | "canSettings";

interface AccessOk {
  error: null;
  user: { id: string; email: string; role: string };
  server: ServerWithNode;
  isOwner: boolean;
  ownerPlan: Plan;
}
interface AccessErr {
  error: NextResponse;
  user: null;
  server: null;
  isOwner: false;
  ownerPlan: Plan;
}

export async function requireServerAccess(
  panelId: string,
  permission?: Permission
): Promise<AccessOk | AccessErr> {
  const { user } = await validateRequest();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null, server: null, isOwner: false, ownerPlan: "FREE" };
  }

  const serverRaw = await prisma.server.findFirst({
    where: {
      id: panelId,
      OR: [{ userId: user.id }, { subUsers: { some: { userId: user.id } } }],
    },
    include: { node: true, user: { select: { plan: true } } },
  });

  if (!serverRaw) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), user: null, server: null, isOwner: false, ownerPlan: "FREE" };
  }

  const ownerPlan = serverRaw.user.plan;
  const server = serverRaw as unknown as ServerWithNode;
  const isOwner = serverRaw.userId === user.id;

  if (!isOwner && permission) {
    const subUser = await prisma.serverUser.findUnique({
      where: { userId_serverId: { userId: user.id, serverId: panelId } },
    });
    if (!subUser?.[permission]) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null, server: null, isOwner: false, ownerPlan };
    }
  }

  return { error: null, user, server, isOwner, ownerPlan };
}

// Returns true if the file is restricted for FREE plan users.
// server.properties and *.jar are only restricted when at the root level — those are
// server config / the server binary. Plugin JARs in /plugins and mod JARs in /mods
// are perfectly fine for free users to see and manage.
export function isRestrictedForFreePlan(filePath: string, directoryCtx?: string): boolean {
  const name = nodePath.basename(filePath).toLowerCase();
  // Derive the directory: explicit context wins, otherwise dirname of full path
  const rawDir = directoryCtx !== undefined
    ? directoryCtx
    : nodePath.dirname(filePath);
  const dir = rawDir.replace(/\/+$/, "") || "/";

  if (dir !== "/") return false; // only root-level files are restricted
  return name === "server.properties" || name.endsWith(".jar");
}
