-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
