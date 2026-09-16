-- Müşteriler kendi randevularını görebilsin ve iptal edebilsin
-- (RLS kapalıysa veya politikalar zaten varsa etkisizdir)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Customers can view own appointments'
  ) THEN
    CREATE POLICY "Customers can view own appointments"
    ON appointments FOR SELECT
    USING (auth.uid() = customer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'Customers can cancel own appointments'
  ) THEN
    CREATE POLICY "Customers can cancel own appointments"
    ON appointments FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);
  END IF;
END
$$;
