import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildConfigYaml(node: {
  id: string;
  fqdn: string;
  port: number;
  tlsEnabled: boolean;
  tokenId: string;
  tokenSecret: string;
}): string {
  const panelUrl = process.env.APP_URL ?? "http://localhost:3000";
  const proto = node.tlsEnabled ? "https" : "http";

  return `# Wings daemon configuration for node: ${node.fqdn}
# Place this file at /etc/pterodactyl/config.yml on the Wings machine

debug: false
uuid: "${node.id}"
token_id: "${node.tokenId}"
token: "${node.tokenSecret}"

api:
  host: "0.0.0.0"
  port: ${node.port}
  ssl:
    enabled: ${node.tlsEnabled}
    cert: "/etc/letsencrypt/live/${node.fqdn}/fullchain.pem"
    key: "/etc/letsencrypt/live/${node.fqdn}/privkey.pem"
  upload_limit: 100

remote: "${panelUrl}"

remote_query:
  timeout: 30
  boot_servers_per_page: 50

allowed_mounts: []

system:
  root_directory: /var/lib/pterodactyl
  log_directory: /var/log/pterodactyl
  data: /var/lib/pterodactyl/volumes
  sftp:
    bind_port: 2022
`;
}

function buildDockerCompose(node: { fqdn: string; port: number }): string {
  return `version: "3.8"
services:
  wings:
    image: ghcr.io/pterodactyl/wings:latest
    restart: always
    networks:
      - wings
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/pterodactyl:/var/lib/pterodactyl
      - /etc/pterodactyl:/etc/pterodactyl:ro
      - /tmp/pterodactyl:/tmp/pterodactyl
    ports:
      - "${node.port}:${node.port}"
    environment:
      TZ: "UTC"
      WINGS_UID: 988
      WINGS_GID: 988
      WINGS_USERNAME: pterodactyl

networks:
  wings:
    name: wings
    driver: bridge
    ipam:
      config:
        - subnet: "172.21.0.0/16"
`;
}

function buildInstallScript(node: { fqdn: string; port: number; tlsEnabled: boolean }): string {
  return `#!/usr/bin/env bash
# Wings daemon quick-install script for ${node.fqdn}
# Run as root on the Wings machine

set -euo pipefail

echo "==> Installing Wings daemon..."

# Create directories
mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes /var/log/pterodactyl /tmp/pterodactyl

# Install Docker if not present
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# Download Wings binary
echo "==> Downloading Wings..."
curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64"
chmod +x /usr/local/bin/wings

# NOTE: Copy the config.yml from the panel to /etc/pterodactyl/config.yml

# Create systemd service
cat > /etc/systemd/system/wings.service << 'UNIT'
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now wings
echo "==> Wings installed and started on port ${node.port}."
echo "    Check status: systemctl status wings"
echo "    View logs:    journalctl -u wings -f"
`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const { nodeId } = await params;

  const node = await prisma.node.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  return NextResponse.json({
    configYaml:    buildConfigYaml(node),
    dockerCompose: buildDockerCompose(node),
    installScript: buildInstallScript(node),
  });
}
