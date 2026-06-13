import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../_shared";
import { dockerRunner } from "@/lib/wings/docker-runner";
import { fireAlert } from "@/lib/discord-alerts";

export const dynamic = "force-dynamic";

// Paper/Spigot: "TPS from last 1m, 5m, 15m: 20.0, 19.98, 19.95"
// Strip §x color codes before parsing.
function parseTps(raw: string): { tps1m: number; tps5m: number; tps15m: number } | null {
  const clean = raw.replace(/§./g, "").replace(/§./g, "");
  const m = clean.match(/([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return null;
  return {
    tps1m:  Math.min(parseFloat(m[1]!), 20),
    tps5m:  Math.min(parseFloat(m[2]!), 20),
    tps15m: Math.min(parseFloat(m[3]!), 20),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canConsole");
  if (access.error) return access.error;

  try {
    const raw = await dockerRunner.rcon(access.server.externalId, "tps");
    const tps = parseTps(raw);
    if (!tps) return NextResponse.json({ error: "tps_unavailable" }, { status: 503 });

    // Fire low-TPS alert (fire-and-forget); server name resolved inside discord-alerts
    fireAlert(access.server.externalId, "low_tps", { tps: tps.tps1m }).catch(() => {});

    return NextResponse.json(tps);
  } catch {
    return NextResponse.json({ error: "tps_unavailable" }, { status: 503 });
  }
}
