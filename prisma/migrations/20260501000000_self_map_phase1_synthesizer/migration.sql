-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "mode" TEXT NOT NULL,
    "modeContext" TEXT NOT NULL DEFAULT '{}',
    "threadToResume" TEXT NOT NULL DEFAULT '[]',
    "tensionCandidates" TEXT NOT NULL DEFAULT '[]',
    "gapAreas" TEXT NOT NULL DEFAULT '[]',
    "conversationSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfMapSynthesis" (
    "id" TEXT NOT NULL,
    "snapshotKey" TEXT NOT NULL,
    "identityStatement" TEXT NOT NULL,
    "userEditedStatement" TEXT,
    "citedEntryIds" TEXT NOT NULL DEFAULT '[]',
    "tensions" TEXT NOT NULL DEFAULT '[]',
    "gaps" TEXT NOT NULL DEFAULT '[]',
    "dismissedTensionKeys" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfMapSynthesis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_conversationSessionId_key" ON "InterviewSession"("conversationSessionId");

-- CreateIndex
CREATE INDEX "InterviewSession_endedAt_idx" ON "InterviewSession"("endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SelfMapSynthesis_snapshotKey_key" ON "SelfMapSynthesis"("snapshotKey");
