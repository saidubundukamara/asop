-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachment_ownerType_ownerId_idx" ON "attachment"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "attachment_uploadedById_idx" ON "attachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
