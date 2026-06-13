/**
 * Console WebSocket handler.
 *
 * Implements the Wings console WebSocket protocol so the browser-side console
 * component works identically against the simulator and a real Wings node.
 *
 * Protocol (JSON frames):
 *   Browser → Panel:
 *     {"event":"auth","args":[]}        — authenticate (cookie already validated in server.ts)
 *     {"event":"send command","args":["command text"]}
 *     {"event":"request logs","args":[]}
 *
 *   Panel → Browser:
 *     {"event":"auth success"}
 *     {"event":"console output","args":["line"]}
 *     {"event":"stats","args":["<json>"]}     — WingsStatsPayload as JSON string
 *     {"event":"status","args":["running"]}   — current server state
 *     {"event":"token expiring"}
 */

import type { WebSocket } from "ws";
import type { Server, Node } from "@prisma/client";
import { dockerRunner as simulator } from "./docker-runner";
import { fireAlert, clearStartAlert } from "@/lib/discord-alerts";

type ServerWithNode = Server & { node: Node };

interface WsMessage {
  event: string;
  args?: string[];
}

interface WingsStatsPayload {
  memory_bytes: number;
  cpu_absolute: number;
  disk_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  uptime: number;
}

function send(ws: WebSocket, event: string, args?: string[]) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(args !== undefined ? { event, args } : { event }));
}

// ── Mock mode handler ─────────────────────────────────────────────────────────

function handleMock(ws: WebSocket, server: ServerWithNode) {
  const uuid = server.externalId;
  let authenticated = false;
  let unsubConsole: (() => void) | null = null;
  let statsTimer: ReturnType<typeof setInterval> | null = null;

  function startStreaming() {
    // Subscribe to console output
    unsubConsole = simulator.onConsole(uuid, (line) => {
      send(ws, "console output", [line]);
    });

    let prevState: string | null = null;

    // Emit stats + status once per second
    statsTimer = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return;
      simulator.getResources(uuid).then((res) => {
        if (ws.readyState !== ws.OPEN) return;
        const r = res.attributes.resources;
        const currentState = res.attributes.current_state;
        const stats: WingsStatsPayload = {
          memory_bytes: r.memory_bytes,
          cpu_absolute: r.cpu_absolute,
          disk_bytes: r.disk_bytes,
          network_rx_bytes: r.network_rx_bytes,
          network_tx_bytes: r.network_tx_bytes,
          uptime: Math.floor(r.uptime / 1000),
        };
        send(ws, "stats", [JSON.stringify(stats)]);
        send(ws, "status", [currentState]);

        // Backup trigger: status transition starting → running fires server_start.
        // discord-alerts deduplicates so this is safe even alongside the log-based trigger.
        if (prevState === "starting" && currentState === "running") {
          fireAlert(uuid, "server_start").catch(console.error);
        }
        // When server stops via any path, reset dedup so next start fires cleanly.
        if (prevState !== null && prevState !== "offline" && currentState === "offline") {
          clearStartAlert(uuid);
        }
        prevState = currentState;

        // Fire high-RAM alert (fire-and-forget; discord-alerts handles cooldown)
        if (server.memoryMb > 0 && r.memory_bytes > 0) {
          const ramPct = (r.memory_bytes / 1_048_576 / server.memoryMb) * 100;
          fireAlert(uuid, "high_ram", { ramPercent: ramPct }).catch(() => {});
        }
      }).catch(() => {});
    }, 1000);
  }

  ws.on("message", (raw) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.toString()) as WsMessage;
    } catch {
      return;
    }

    if (msg.event === "auth") {
      // Auth already validated via session cookie in server.ts — always succeed
      authenticated = true;
      send(ws, "auth success");
      startStreaming();
      // Send current status immediately so the header badge doesn't wait 1 s
      simulator.getResources(uuid).then((res) => {
        send(ws, "status", [res.attributes.current_state]);
      }).catch(() => {});
      return;
    }

    if (!authenticated) return;

    if (msg.event === "send command") {
      const command = msg.args?.[0] ?? "";
      simulator.handleCommand(uuid, command);
    }

    if (msg.event === "request logs") {
      for (const line of simulator.getRecentLogs(uuid)) {
        send(ws, "console output", [line]);
      }
    }
  });

  ws.on("close", () => {
    unsubConsole?.();
    if (statsTimer) clearInterval(statsTimer);
  });

  ws.on("error", () => {
    unsubConsole?.();
    if (statsTimer) clearInterval(statsTimer);
  });
}

// ── Real Wings proxy handler ──────────────────────────────────────────────────
// Proxies the browser WebSocket ↔ Wings WebSocket.
// The panel handles Wings authentication so tokens never reach the browser.

async function handleProxy(ws: WebSocket, server: ServerWithNode) {
  const { getConsoleAuth } = await import("./client");
  const { SignJWT } = await import("jose");
  const WebSocket = (await import("ws")).default;
  const { v4: uuidv4 } = await import("uuid");

  const node = server.node;
  const creds = {
    nodeId: node.id,
    fqdn: node.fqdn,
    port: node.port,
    tlsEnabled: node.tlsEnabled,
    tokenId: node.tokenId,
    tokenSecret: node.tokenSecret,
  };

  let browserAuth = false;

  // Get Wings WS details
  const auth = await getConsoleAuth(creds, server.externalId);

  // Open Wings-side WebSocket
  const wingsWs = new WebSocket(auth.socket, {
    rejectUnauthorized: node.tlsEnabled,
  });

  wingsWs.on("open", () => {
    // Authenticate with Wings using a fresh JWT
    wingsWs.send(JSON.stringify({ event: "auth", args: [auth.token] }));
  });

  // Forward Wings → browser (strip internal Wings auth events)
  wingsWs.on("message", (data) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(data);
  });

  wingsWs.on("close", () => ws.close());
  wingsWs.on("error", () => ws.close());

  // Forward browser → Wings
  ws.on("message", (raw) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.toString()) as WsMessage;
    } catch {
      return;
    }

    if (msg.event === "auth") {
      // Browser auth is already handled via cookie; just acknowledge
      browserAuth = true;
      send(ws, "auth success");
      return;
    }

    if (!browserAuth) return;

    // Forward commands etc. to Wings
    if (wingsWs.readyState === wingsWs.OPEN) {
      wingsWs.send(raw);
    }
  });

  ws.on("close", () => wingsWs.close());
  ws.on("error", () => wingsWs.close());
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function handleConsoleWs(ws: WebSocket, server: ServerWithNode): void {
  if (process.env.MOCK_WINGS === "true") {
    handleMock(ws, server);
  } else {
    handleProxy(ws, server).catch((err) => {
      console.error("[ws-handler] proxy error:", err);
      ws.close(1011, "Internal error");
    });
  }
}
