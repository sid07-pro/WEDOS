-- Additive: process-management simulation records. No existing table is altered.
CREATE TYPE "ProcessState" AS ENUM ('NEW', 'READY', 'RUNNING', 'WAITING', 'COMPLETED');

CREATE TABLE "task_processes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "pidNumber" INTEGER NOT NULL,
    "state" "ProcessState" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_processes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_processes_taskId_key" ON "task_processes"("taskId");
CREATE INDEX "task_processes_weddingId_idx" ON "task_processes"("weddingId");
CREATE INDEX "task_processes_state_idx" ON "task_processes"("state");
CREATE UNIQUE INDEX "task_processes_weddingId_pidNumber_key" ON "task_processes"("weddingId", "pidNumber");

ALTER TABLE "task_processes" ADD CONSTRAINT "task_processes_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_processes" ADD CONSTRAINT "task_processes_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
