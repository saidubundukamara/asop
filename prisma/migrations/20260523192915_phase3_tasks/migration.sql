-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('assigned', 'in_progress', 'submitted', 'completed', 'blocked', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "task_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDescription" TEXT,
    "defaultPriority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "defaultDepartmentId" TEXT,
    "dueDateOffsetDays" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'assigned',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT NOT NULL,
    "assignerId" TEXT,
    "departmentId" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_event" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "mentionedUserIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_template_isArchived_name_idx" ON "task_template"("isArchived", "name");

-- CreateIndex
CREATE INDEX "task_template_defaultDepartmentId_idx" ON "task_template"("defaultDepartmentId");

-- CreateIndex
CREATE INDEX "task_assigneeId_status_idx" ON "task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "task_dueDate_idx" ON "task"("dueDate");

-- CreateIndex
CREATE INDEX "task_assignerId_idx" ON "task"("assignerId");

-- CreateIndex
CREATE INDEX "task_departmentId_status_idx" ON "task"("departmentId", "status");

-- CreateIndex
CREATE INDEX "task_deletedAt_idx" ON "task"("deletedAt");

-- CreateIndex
CREATE INDEX "task_status_event_taskId_at_idx" ON "task_status_event"("taskId", "at" DESC);

-- CreateIndex
CREATE INDEX "task_comment_taskId_createdAt_idx" ON "task_comment"("taskId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "task_template" ADD CONSTRAINT "task_template_defaultDepartmentId_fkey" FOREIGN KEY ("defaultDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template" ADD CONSTRAINT "task_template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assignerId_fkey" FOREIGN KEY ("assignerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_event" ADD CONSTRAINT "task_status_event_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_event" ADD CONSTRAINT "task_status_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
