-- CreateTable
CREATE TABLE "DiscordWebhook" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "onStart" BOOLEAN NOT NULL DEFAULT true,
    "onStop" BOOLEAN NOT NULL DEFAULT true,
    "onCrash" BOOLEAN NOT NULL DEFAULT true,
    "onHighRam" BOOLEAN NOT NULL DEFAULT false,
    "ramThreshold" INTEGER NOT NULL DEFAULT 90,
    "onLowTps" BOOLEAN NOT NULL DEFAULT false,
    "tpsThreshold" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "onPlayerJoin" BOOLEAN NOT NULL DEFAULT false,
    "watchedPlayer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordWebhook_serverId_key" ON "DiscordWebhook"("serverId");

-- CreateIndex
CREATE INDEX "DiscordWebhook_serverId_idx" ON "DiscordWebhook"("serverId");

-- AddForeignKey
ALTER TABLE "DiscordWebhook" ADD CONSTRAINT "DiscordWebhook_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
