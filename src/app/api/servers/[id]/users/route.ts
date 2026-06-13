import { NextRequest, NextResponse } from "next/server";
import { requireServerAccess } from "../_shared";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/servers/[id]/users
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;

  const subUsers = await prisma.serverUser.findMany({
    where: { serverId: id },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const users = subUsers.map((su) => ({
    id: su.id,
    userId: su.userId,
    email: su.user.email,
    canConsole: su.canConsole,
    canFiles: su.canFiles,
    canPower: su.canPower,
    canSettings: su.canSettings,
  }));

  return NextResponse.json({ users });
}

// POST /api/servers/[id]/users  — add subuser by email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id);
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Only the server owner can add users" }, { status: 403 });

  const body = (await req.json()) as {
    email: string;
    canConsole?: boolean;
    canFiles?: boolean;
    canPower?: boolean;
    canSettings?: boolean;
  };

  if (!body.email?.trim()) return NextResponse.json({ error: "email required" }, { status: 400 });

  const targetUser = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!targetUser) return NextResponse.json({ error: "No account found with that email address" }, { status: 404 });
  if (targetUser.id === access.user.id) return NextResponse.json({ error: "You cannot add yourself as a subuser" }, { status: 400 });

  const existing = await prisma.serverUser.findUnique({
    where: { userId_serverId: { userId: targetUser.id, serverId: id } },
  });
  if (existing) return NextResponse.json({ error: "That user already has access to this server" }, { status: 409 });

  const su = await prisma.serverUser.create({
    data: {
      userId: targetUser.id,
      serverId: id,
      canConsole: body.canConsole ?? true,
      canFiles: body.canFiles ?? false,
      canPower: body.canPower ?? false,
      canSettings: body.canSettings ?? false,
    },
  });

  return NextResponse.json({ id: su.id }, { status: 201 });
}
