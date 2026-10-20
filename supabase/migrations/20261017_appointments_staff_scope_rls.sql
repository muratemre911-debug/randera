-- ============================================================================
-- Randevu görünürlüğü ve yönetimi: eleman yalnızca KENDİ randevuları
--
-- Neden gerekti: panel sayfalarındaki filtre yalnızca arayüzü kısıtlar; eleman
-- kendi oturumuyla doğrudan API'ye sorgu atarsa işletmenin tüm randevularını
-- okuyup değiştirebiliyordu ("işletme üstünde tam yetki").
--
-- Yöntem: RESTRICTIVE (kısıtlayıcı) politika. Mevcut izin verici politikaları
-- silmeye gerek yok — kısıtlayıcı politikalar onlarla AND'lenir, yani sonuç
--     (mevcut izin verici politikalar) VE (bu kapsam kuralı)
-- olur. Politika adları panelde tanımlı olduğu için bu yöntem seçildi.
--
-- Kapsam:
--   * müşteri → kendi randevusu        (customer_id = auth.uid())
--   * eleman  → kendisine atanan randevu (staff_id = auth.uid())
--   * sahip   → işletmesindeki tüm randevular
--   * süper admin / sunucu uçları → service-role RLS'i atlar, etkilenmez
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_appointment_in_my_scope(
  appt_tenant_id uuid,
  appt_customer_id uuid,
  appt_staff_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    appt_customer_id = auth.uid()
    OR appt_staff_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner'
        AND mp.tenant_id = appt_tenant_id
    );
$$;

COMMENT ON FUNCTION public.is_appointment_in_my_scope(uuid, uuid, uuid) IS
  'Randevu satırı isteği yapanın kapsamında mı? Müşteri kendi randevusu, eleman '
  'kendisine atanan randevu, işletme sahibi işletmesindeki tüm randevular. '
  'appointments üzerindeki kısıtlayıcı RLS politikalarında kullanılır.';

-- Okuma: eleman başkasının randevusunu göremez
DROP POLICY IF EXISTS "appointments_scope_restrictive_select" ON appointments;
CREATE POLICY "appointments_scope_restrictive_select" ON appointments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_appointment_in_my_scope(tenant_id, customer_id, staff_id));

-- Güncelleme: eleman başkasının randevusunu onaylayamaz/iptal edemez/taşıyamaz
DROP POLICY IF EXISTS "appointments_scope_restrictive_update" ON appointments;
CREATE POLICY "appointments_scope_restrictive_update" ON appointments
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_appointment_in_my_scope(tenant_id, customer_id, staff_id))
  WITH CHECK (public.is_appointment_in_my_scope(tenant_id, customer_id, staff_id));
