-- CreateEnum
CREATE TYPE "BoxKind" AS ENUM ('PLASTIC_BOX', 'CARDBOARD_BOX', 'CANVAS_BAG', 'RACK', 'OTHER');

-- CreateEnum
CREATE TYPE "DoorSide" AS ENUM ('FRONT', 'BACK', 'LEFT', 'RIGHT');

-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "kind" "BoxKind" NOT NULL DEFAULT 'PLASTIC_BOX',
ADD COLUMN     "shelfCount" INTEGER;

-- AlterTable
ALTER TABLE "Container" ADD COLUMN     "doorSide" "DoorSide" NOT NULL DEFAULT 'FRONT';
