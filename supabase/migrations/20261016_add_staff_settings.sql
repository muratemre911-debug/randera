-- ============================================================================
-- Elemana özel ayarlar: çalışma saatleri + randevu kuralları
--
--   staff_working_hours tablosu artık yalnızca saat tutmuyor; elemanın kendi
--   randevu kurallarını da sakladığı için staff_settings olarak yeniden
--   adlandırılıyor. İşletme geneli ayarlar (tenants.working_hours,
--   tenants.booking_rules) yalnızca işletme sahibine aittir.
--
--   Kural: elemanın bir alanı boşsa işletmenin değeri geçerli olur
--   (alan bazlı geri düşme, saatlerdeki gün bazlı geri düşmeyle aynı mantık).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Eski adı yeni ada taşı (veri korunur, politikalar tabloyla taşınır)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff_working_hours'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff_settings'
  ) THEN
    ALTER TABLE public.staff_working_hours RENAME TO staff_settings;
  END IF;
END $$;

-- Tablo hiç yoksa (temiz kurulum) oluştur
CREATE TABLE IF NOT EXISTS public.staff_settings (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  booking_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2) booking_rules kolonu (yeniden adlandırma yolundan geçen tablolar için)
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_settings
  ADD COLUMN IF NOT EXISTS booking_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_staff_settings_tenant
  ON public.staff_settings(tenant_id);

-- Eski index adı kalmışsa temizle
DROP INDEX IF EXISTS public.idx_staff_working_hours_tenant;

COMMENT ON TABLE public.staff_settings IS
  'Elemana özel ayarlar: müşterilere açtığı aktif saatler (working_hours) ve '
  'kendi randevu kuralları (booking_rules). Boş bırakılan alanlarda işletmenin '
  '(tenants) değeri geçerlidir.';

-- ---------------------------------------------------------------------------
-- 3) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_settings ENABLE ROW LEVEL SECURITY;

-- Okuma herkese açık: müşteri randevu akışı elemanın saat ve kurallarını
-- görüntüler (özel veri içermez; herkese açık staff API'si zaten döner).
DROP POLICY IF EXISTS "staff_working_hours_public_read" ON public.staff_settings;
DROP POLICY IF EXISTS "staff_settings_public_read" ON public.staff_settings;
CREATE POLICY "staff_settings_public_read" ON public.staff_settings
  FOR SELECT USING (true);

-- Yazma yalnızca satırın sahibine: kendi profilidir ve aynı işletmede
-- owner/staff rolündedir.
DROP POLICY IF EXISTS "staff_working_hours_self_manage" ON public.staff_settings;
DROP POLICY IF EXISTS "staff_settings_self_manage" ON public.staff_settings;
CREATE POLICY "staff_settings_self_manage" ON public.staff_settings
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.tenant_id = staff_settings.tenant_id
        AND mp.role IN ('owner', 'staff')
    )
  );
