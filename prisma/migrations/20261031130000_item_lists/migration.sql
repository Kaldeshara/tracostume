-- Costume sets and show preparation lists.
CREATE TYPE "ItemListKind" AS ENUM ('SET', 'SHOW');

CREATE TABLE "ItemList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ItemListKind" NOT NULL DEFAULT 'SHOW',
    "description" TEXT,
    "date" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemListEntry" (
    "listId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemListEntry_pkey" PRIMARY KEY ("listId","itemId")
);

CREATE INDEX "ItemListEntry_itemId_idx" ON "ItemListEntry"("itemId");

ALTER TABLE "ItemList" ADD CONSTRAINT "ItemList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemListEntry" ADD CONSTRAINT "ItemListEntry_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ItemList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemListEntry" ADD CONSTRAINT "ItemListEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
