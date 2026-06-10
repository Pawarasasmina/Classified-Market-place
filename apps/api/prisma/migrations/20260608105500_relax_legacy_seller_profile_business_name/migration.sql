DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SellerProfile'
      AND column_name = 'businessName'
  ) THEN
    EXECUTE 'ALTER TABLE "SellerProfile" ALTER COLUMN "businessName" DROP NOT NULL';
  END IF;
END $$;
