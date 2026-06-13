import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerAccess } from "../_shared";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/task-runner";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name:     z.string().min(1).max(64),
  schedule: z.string().min(1),
  action:   z.enum(["command", "restart", "stop", "start"]),
  payload:  z.string().max(256).default(""),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const tasks = await prisma.scheduledTask.findMany({
    where: { serverId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid task" }, { status: 400 });

  const { name, schedule, action, payload } = parsed.data;
  const nextRunAt = computeNextRun(schedule);
  if (!nextRunAt) return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });

  const task = await prisma.scheduledTask.create({
    data: { serverId: id, name, schedule, action, payload, nextRunAt },
  });
  return NextResponse.json({ task }, { status: 201 });
}
