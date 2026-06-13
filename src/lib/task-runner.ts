import cron from "node-cron";
import { CronExpressionParser } from "cron-parser";
import { prisma } from "./db";

export function computeNextRun(schedule: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(schedule);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export function isValidCron(schedule: string): boolean {
  return cron.validate(schedule);
}

// Runs every minute, dispatches any tasks that are due
export function startTaskRunner() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const due = await prisma.scheduledTask.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      include: { server: { include: { node: true } } },
    });

    for (const task of due) {
      // Fire-and-forget; don't let one failure block others
      runTask(task).catch((e) => console.error(`[tasks] task ${task.id} error:`, e));
    }
  });

  console.log("[tasks] Scheduler started");
}

async function runTask(task: {
  id: string;
  serverId: string;
  action: string;
  payload: string;
  schedule: string;
  server: { externalId: string };
}) {
  const { externalId } = task.server;

  if (process.env.MOCK_WINGS === "true") {
    const { dockerRunner } = await import("./wings/docker-runner");

    if (task.action === "command") {
      dockerRunner.handleCommand(externalId, task.payload);
    } else if (task.action === "restart") {
      await dockerRunner.power(externalId, "restart");
    } else if (task.action === "stop") {
      await dockerRunner.power(externalId, "stop");
    } else if (task.action === "start") {
      await dockerRunner.power(externalId, "start");
    }
  }

  const nextRunAt = computeNextRun(task.schedule) ?? new Date(Date.now() + 60_000);
  await prisma.scheduledTask.update({
    where: { id: task.id },
    data: { lastRunAt: new Date(), nextRunAt },
  });
}
