/**
 * Custom Next.js server.
 *
 * Wraps Next.js with a plain Node.js HTTP server so we can intercept WebSocket
 * upgrade requests. All /api/servers/:id/console/ws upgrades are handled here;
 * everything else is forwarded to Next.js as normal.
 *
 * Run with:  npx tsx server.ts   (or tsx watch server.ts in dev)
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import type { Socket } from "node:net";
import next from "next";
import { prisma } from "./src/lib/db.js";
import { handleConsoleWs } from "./src/lib/wings/ws-handler.js";
import { startTaskRunner } from "./src/lib/task-runner.js";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

// ── Parse a single cookie value from a Cookie header ─────────────────────────
function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k?.trim() === name) return rest.join("=").trim();
  }
  return null;
}

// ── Reject a WebSocket upgrade with an HTTP error ────────────────────────────
function rejectUpgrade(socket: Socket, code: number, message: string) {
  socket.write(
    `HTTP/1.1 ${code} ${message}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`
  );
  socket.destroy();
}

async function main() {
  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  // Next.js upgrade handler handles /_next/webpack-hmr (dev HMR WebSocket)
  // Must be called for any upgrade we don't own, otherwise HMR breaks.
  const nextUpgrade = (app as unknown as { getUpgradeHandler?: () => (req: import("http").IncomingMessage, socket: Socket, head: Buffer) => Promise<void> }).getUpgradeHandler?.();

  const wss = new WebSocketServer({ noServer: true });
  const httpServer = createServer((req, res) => handle(req, res));

  // ── WebSocket upgrade handler ───────────────────────────────────────────────
  httpServer.on("upgrade", async (req, socket, head) => {
    const url = req.url ?? "";

    // Only handle our console WS endpoint; forward everything else to Next.js
    const match = url.match(/^\/api\/servers\/([^/?#]+)\/console\/ws/);
    if (!match) {
      if (nextUpgrade) {
        await nextUpgrade(req, socket as Socket, head);
      } else {
        (socket as Socket).destroy();
      }
      return;
    }

    const panelServerId = match[1]!;

    // ── Session validation ──────────────────────────────────────────────────
    const sessionToken = getCookie(req.headers.cookie, "hp_session");
    if (!sessionToken) {
      rejectUpgrade(socket as Socket, 401, "Unauthorized");
      return;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionToken },
      select: { userId: true, expiresAt: true },
    });

    if (!session || session.expiresAt < new Date()) {
      rejectUpgrade(socket as Socket, 401, "Unauthorized");
      return;
    }

    // ── Permission check ────────────────────────────────────────────────────
    const server = await prisma.server.findFirst({
      where: {
        id: panelServerId,
        OR: [
          { userId: session.userId },
          {
            subUsers: {
              some: { userId: session.userId, canConsole: true },
            },
          },
        ],
      },
      include: { node: true },
    });

    if (!server) {
      rejectUpgrade(socket as Socket, 403, "Forbidden");
      return;
    }

    // ── Upgrade to WebSocket ────────────────────────────────────────────────
    wss.handleUpgrade(req, socket as Socket, head, (ws) => {
      handleConsoleWs(ws, server);
    });
  });

  startTaskRunner();

  httpServer.listen(port, () => {
    const scheme = dev ? "http" : "https";
    console.log(`\n  \x1b[32m▲\x1b[0m HobbyPanel ready  ${scheme}://localhost:${port}\n`);
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
