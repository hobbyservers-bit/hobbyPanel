import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerAccess } from "../../_shared";

export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  action: z.enum(["kick", "ban", "unban", "op", "deop", "whitelist-add", "whitelist-remove"]),
  player: z.string().min(1).max(36),
  reason: z.string().optional(),
});

function buildCommand(action: string, player: string, reason?: string): string {
  switch (action) {
    case "kick":           return `kick ${player}${reason ? ` ${reason}` : ""}`;
    case "ban":            return `ban ${player}${reason ? ` ${reason}` : ""}`;
    case "unban":          return `pardon ${player}`;
    case "op":             return `op ${player}`;
    case "deop":           return `deop ${player}`;
    case "whitelist-add":  return `whitelist add ${player}`;
    case "whitelist-remove": return `whitelist remove ${player}`;
    default:               throw new Error("Unknown action");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canConsole");
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { action, player, reason } = parsed.data;
  const cmd = buildCommand(action, player, reason);

  try {
    let output = "";
    if (process.env.MOCK_WINGS === "true") {
      const { dockerRunner } = await import("@/lib/wings/docker-runner");
      output = await dockerRunner.rcon(access.server.externalId, cmd);
    }
    return NextResponse.json({ ok: true, output });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
