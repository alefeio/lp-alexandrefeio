-- AlterTable
ALTER TABLE "course" ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "module" ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "coverImagePublicId" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "lesson" ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "coverImagePublicId" TEXT,
ADD COLUMN "updatedById" TEXT;

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "alt" TEXT NOT NULL DEFAULT '',
    "decorative" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_publicId_key" ON "media_asset"("publicId");
