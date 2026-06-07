CREATE TABLE "WalletAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletLedger" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "transactionId" TEXT,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletAccount_userId_key" ON "WalletAccount"("userId");
CREATE INDEX "WalletAccount_currency_idx" ON "WalletAccount"("currency");
CREATE INDEX "WalletLedger_walletId_createdAt_idx" ON "WalletLedger"("walletId", "createdAt");
CREATE INDEX "WalletLedger_transactionId_idx" ON "WalletLedger"("transactionId");
CREATE INDEX "WalletLedger_type_createdAt_idx" ON "WalletLedger"("type", "createdAt");

ALTER TABLE "WalletAccount"
ADD CONSTRAINT "WalletAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletLedger"
ADD CONSTRAINT "WalletLedger_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "WalletAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletLedger"
ADD CONSTRAINT "WalletLedger_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
