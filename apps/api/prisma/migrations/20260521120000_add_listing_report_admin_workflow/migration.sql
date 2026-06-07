ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'ACTIONED';

ALTER TABLE "ListingReport" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;

DO $$
DECLARE
  listing_report_status_type text;
BEGIN
  SELECT t.typname
    INTO listing_report_status_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'ListingReport'
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF listing_report_status_type = 'ListingReportStatus' THEN
    ALTER TABLE "ListingReport" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "ListingReport"
      ALTER COLUMN "status" TYPE "ReportStatus"
      USING (
        CASE
          WHEN "status"::text IN ('OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED', 'ACTIONED')
            THEN "status"::text
          WHEN "status"::text = 'UNDER_REVIEW'
            THEN 'REVIEWED'
          ELSE 'REVIEWED'
        END
      )::"ReportStatus";
    ALTER TABLE "ListingReport"
      ALTER COLUMN "status" SET DEFAULT 'OPEN'::"ReportStatus";
  END IF;
END $$;

DO $$
DECLARE
  listing_report_reason_type text;
BEGIN
  SELECT t.typname
    INTO listing_report_reason_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'ListingReport'
    AND a.attname = 'reason'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF listing_report_reason_type = 'ListingReportReason' THEN
    ALTER TABLE "ListingReport"
      ALTER COLUMN "reason" TYPE TEXT
      USING "reason"::text;
  END IF;
END $$;
