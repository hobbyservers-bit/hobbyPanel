import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../../_shared";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const { webhookUrl } = await req.json().catch(() => ({})) as { webhookUrl?: string };
  if (!webhookUrl) return NextResponse.json({ error: "Missing webhookUrl" }, { status: 400 });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "✅ HobbyPanel Test Alert",
          description: `Webhook successfully connected to **${access.server.name}**`,
          color: 0x57F287,
          timestamp: new Date().toISOString(),
          footer: { text: "HobbyPanel" },
        }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Discord returned ${res.status}: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
