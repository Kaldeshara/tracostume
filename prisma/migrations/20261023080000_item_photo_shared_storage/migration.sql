-- Identical pieces imported from one photo share the same stored file.
DROP INDEX "ItemPhoto_storageKey_key";
CREATE INDEX "ItemPhoto_storageKey_idx" ON "ItemPhoto"("storageKey");
