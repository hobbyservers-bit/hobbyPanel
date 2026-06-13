import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireServerAccess } from "../../_shared";
import { prisma } from "@/lib/db";
import { computeNextRun } from "@/lib/task-runner";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name:     z.string().min(1).max(64).optional(),
  schedule: z.string().min(1).optional(),
  action:   z.enum(["command", "restart", "stop", "start"]).optional(),
  payload:  z.string().max(256).optional(),
  enabled:  z.boolean().optional(),
});

async function getTask(serverId: string, taskId: string) {
  return prisma.scheduledTask.findFirst({ where: { id: taskId, serverId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;

  const task = await getTask(id, taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { schedule, ...rest } = parsed.data;
  let nextRunAt = task.nextRunAt;
  if (schedule) {
    nextRunAt = computeNextRun(schedule);
    if (!nextRunAt) return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
  }

  const updated = await prisma.scheduledTask.update({
    where: { id: taskId },
    data: { ...rest, ...(schedule ? { schedule } : {}), nextRunAt },
  });
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const access = await requireServerAccess(id, "canSettings");
  if (access.error) return access.error;
  if (!access.isOwner) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const task = await getTask(id, taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.scheduledTask.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
