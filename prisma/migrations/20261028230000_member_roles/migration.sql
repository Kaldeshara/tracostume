-- Roles: dancers, repairers and choreographers join keepers and admins. Loans get a contact
-- (choreographer) and a "collected" step between the dancer and the container.
ALTER TYPE "UserRole" RENAME VALUE 'MEMBER' TO 'DANCER';
ALTER TYPE "UserRole" ADD VALUE 'REPAIRER' BEFORE 'KEEPER';
ALTER TYPE "UserRole" ADD VALUE 'CHOREOGRAPHER' BEFORE 'KEEPER';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'DANCER';

ALTER TYPE "MovementType" ADD VALUE 'COLLECTED' BEFORE 'RETURNED';

ALTER TABLE "Loan" ADD COLUMN "contactUserId" TEXT,
                   ADD COLUMN "collectedAt" TIMESTAMP(3),
                   ADD COLUMN "collectedById" TEXT;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
