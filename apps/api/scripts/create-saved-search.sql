CREATE TABLE IF NOT EXISTS "SavedSearch" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "query" TEXT NOT NULL DEFAULT '',
  "categorySlug" TEXT NOT NULL DEFAULT '',
  "sort" TEXT NOT NULL DEFAULT 'newest',
  "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,

  CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedSearch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedSearch_userId_query_categorySlug_sort_key"
  ON "SavedSearch"("userId", "query", "categorySlug", "sort");

CREATE INDEX IF NOT EXISTS "SavedSearch_userId_updatedAt_idx"
  ON "SavedSearch"("userId", "updatedAt");
