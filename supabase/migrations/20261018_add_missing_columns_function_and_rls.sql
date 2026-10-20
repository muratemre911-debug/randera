-- ============================================================================
-- Eksik kolonlar, fonksiyon ve RLS politikaları
--
-- Bu migration'da 5 eksik parça var:
--   1) public.get_my_profile()  — 4 migration içinde çağrılıyor ama TANIMLANMAMIŞ.
--   2) is_active kolonları      — kod + profiles_guard_role_changes tetikleyicisi
--                                 kullanıyor ama hiçbir migration'da eklenmemiş.
--   3) profiles.nickname        — arayüz "nickname, full_name" ile okuyor, kolon yok.
--   4) appointments RLS AÇIK DEĞİL — 20261017 yalnızca KISITLAYICI politika
--      ekledi; RLS açılmadan bu politikalar etkisiz. Üstelik izin verici politika
--      olmadan RLS açılırsa yalnızca müşteri randevuları görünür, eleman/sahip
--      hiçbir şey göremez.
--   5) appointments izin verici politikaları — eleman kendi randevularına,
--      sahib kendi işletmesindeki tüm randevulara erişebilmeli.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) get_my_profile()
--    SECURITY DEFINER: profiles RLS'i özyinelemez, policy içinden güvenle
--    çağrılabilir. Dönen sütun adları migration'lardaki çağrıyla birebir
--    aynı olmalı: mp(tenant_id, role).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(tenant_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tenant_id, p.role
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) is_active kolonları
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- 3) profiles.nickname
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT;

-- ---------------------------------------------------------------------------
-- 4) appointments RLS'i aç
--    20261017'deki kısıtlayıcı politikalar yalnızca RLS açıkken işler.
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5) appointments izin verici (PERMISSIVE) politikaları
--
--    Postgres kuralı: kısıtlayıcı (RESTRICTIVE) politika, izin verici
--    politikaların birleşimiyle AND'lenir. İzin verici politika yoksa satır
--    hiç görünmez. Bu yüzden eleman/sahip için izin verici politika şart.
--
--    Kapsam, 20261017'deki is_appointment_in_my_scope ile birebir aynı:
--      * eleman → staff_id = auth.uid()
--      * sahib  → kendi işletmesindeki tüm randevular
-- ---------------------------------------------------------------------------

-- --- Eleman: kendi randevularını görebilir ---------------------------------
DROP POLICY IF EXISTS "appointments_staff_select_own" ON public.appointments;
CREATE POLICY "appointments_staff_select_own" ON public.appointments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- --- Eleman: kendi adına randevu ekleyebilir -----------------------------
DROP POLICY IF EXISTS "appointments_staff_insert_own" ON public.appointments;
CREATE POLICY "appointments_staff_insert_own" ON public.appointments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

-- --- Eleman: kendi randevularını güncelleyebilir --------------------------
DROP POLICY IF EXISTS "appointments_staff_update_own" ON public.appointments;
CREATE POLICY "appointments_staff_update_own" ON public.appointments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

-- --- Eleman: kendi randevularını silebilir --------------------------------
DROP POLICY IF EXISTS "appointments_staff_delete_own" ON public.appointments;
CREATE POLICY "appointments_staff_delete_own" ON public.appointments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (staff_id = auth.uid());

-- --- Sahip: işletmesindeki tüm randevuları görebilir ----------------------
DROP POLICY IF EXISTS "appointments_owner_select_tenant" ON public.appointments;
CREATE POLICY "appointments_owner_select_tenant" ON public.appointments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = appointments.tenant_id
    )
  );

-- --- Sahip: işletmesinde randevu ekleyebilir ------------------------------
DROP POLICY IF EXISTS "appointments_owner_insert_tenant" ON public.appointments;
CREATE POLICY "appointments_owner_insert_tenant" ON public.appointments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = appointments.tenant_id
    )
  );

-- --- Sahip: işletmesindeki randevuları güncelleyebilir ---------------------
DROP POLICY IF EXISTS "appointments_owner_update_tenant" ON public.appointments;
CREATE POLICY "appointments_owner_update_tenant" ON public.appointments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = appointments.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = appointments.tenant_id
    )
  );

-- --- Sahip: işletmesindeki randevuları silebilir ---------------------------
DROP POLICY IF EXISTS "appointments_owner_delete_tenant" ON public.appointments;
CREATE POLICY "appointments_owner_delete_tenant" ON public.appointments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = appointments.tenant_id
    )
  );
