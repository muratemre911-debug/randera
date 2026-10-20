-- ============================================================================
-- Eleman çalışma saatleri + rol yükseltme koruması
--   1) staff_working_hours → her ekip üyesinin kendi aktif saatleri.
--      Randevu akışında seçilen elemanın o güne ait ayarı varsa o, yoksa
--      işletme saatinin (tenants.working_hours) o günkü ayarı uygulanır.
--   2) profiles güncelleme koruması → kimse KENDİ rolünü/tenant'ını
--      değiştiremez; yalnızca aynı işletmenin sahibi başkasınınkini
--      değiştirebilir (ekip sayfasındaki "ekipten çıkar" akışı bunu kullanır).
--      Sunucu tarafı akışları (service role, auth.uid() yok) etkilenmez.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) staff_working_hours
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_working_hours (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  working_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_working_hours_tenant
  ON staff_working_hours(tenant_id);

COMMENT ON TABLE staff_working_hours IS
  'Ekip üyesinin müşterilere açtığı aktif saatleri. tenants.working_hours ile '
  'aynı JSONB biçimi: {gun: {isOpen, openTime, closeTime}}. Gün bazlı eleman '
  'ayarı, işletme ayarından önce gelir.';

ALTER TABLE staff_working_hours ENABLE ROW LEVEL SECURITY;

-- Okuma herkese açık: müşteri randevu akışı saatleri görüntüler (özel veri
-- içermez; staff API'si zaten herkese açık döner).
DROP POLICY IF EXISTS "staff_working_hours_public_read" ON staff_working_hours;
CREATE POLICY "staff_working_hours_public_read" ON staff_working_hours
  FOR SELECT USING (true);

-- Yazma yalnızca satırın sahibine: kendi profilidir ve aynı işletmede
-- owner/staff rolündedir.
DROP POLICY IF EXISTS "staff_working_hours_self_manage" ON staff_working_hours;
CREATE POLICY "staff_working_hours_self_manage" ON staff_working_hours
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.tenant_id = staff_working_hours.tenant_id
        AND mp.role IN ('owner', 'staff')
    )
  );

-- ---------------------------------------------------------------------------
-- 2) profiles rol koruması
--    RLS satır bazlıdır, kolon bazlı değil: "kullanıcı kendi satırını
--    güncelleyebilir" politikası olan bir veritabanında eleman kendi rolünü
--    'owner' yapıp işletme ayarlarını değiştirebilirdi. Bu tetikleyici o yolu
--    kapatır. Meşru akışlar korunur:
--      * Service role / sunucu uçları (auth.uid() NULL) → serbest
--      * Kendi telefon/ad gibi alanlarını güncelleyen kullanıcı → rol/tenant
--        kolonlarına dokunmadığı sürece serbest
--      * İşletme sahibinin ekip sayfasından eleman çıkarması → serbest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_guard_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role text;
  my_tenant uuid;
BEGIN
  -- Sunucu tarafı (service role) akışları etkilenmez
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rol / işletme / aktiflik değişmiyorsa dokunma
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  SELECT mp.role, mp.tenant_id INTO my_role, my_tenant
  FROM public.get_my_profile() mp(tenant_id, role);

  -- Kimse kendi rolünü / işletmesini kendisi değiştiremez
  IF OLD.id = auth.uid() THEN
    RAISE EXCEPTION 'Kendi rolünüzü veya işletmenizi kendiniz değiştiremezsiniz.';
  END IF;

  -- Başkasının rolünü yalnızca aynı işletmenin sahibi değiştirebilir
  IF my_role = 'owner' AND my_tenant IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Bu güncelleme için yetkiniz yok.';
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_role_changes ON profiles;
CREATE TRIGGER profiles_guard_role_changes
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_role_changes();
