-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'MISSING';

-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "labelPrintedAt" TIMESTAMP(3);

-- AlterTable: the container gets a permanent label code. Existing rows get "C-" + 5 characters
-- from the alphabet of randomCode (src/lib/codes.ts), then the column becomes required.
ALTER TABLE "Container" ADD COLUMN     "code" TEXT,
ADD COLUMN     "labelPrintedAt" TIMESTAMP(3);

UPDATE "Container" SET "code" = 'C-' || (
  SELECT string_agg(substr('2346789ABCDEFGHJKMNPQRTUVWXYZ', 1 + floor(random() * 29)::int, 1), '')
  FROM generate_series(1, 5 + 0 * length("Container"."id"))
);

ALTER TABLE "Container" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "unitCheckId" TEXT;

-- CreateTable
CREATE TABLE "UnitCheck" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "userId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedCount" INTEGER NOT NULL,
    "foundCount" INTEGER NOT NULL,

    CONSTRAINT "UnitCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnitCheck_boxId_checkedAt_idx" ON "UnitCheck"("boxId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Container_code_key" ON "Container"("code");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_unitCheckId_fkey" FOREIGN KEY ("unitCheckId") REFERENCES "UnitCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCheck" ADD CONSTRAINT "UnitCheck_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCheck" ADD CONSTRAINT "UnitCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

