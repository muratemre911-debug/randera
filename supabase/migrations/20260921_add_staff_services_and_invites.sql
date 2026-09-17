-- ============================================================================
-- Eleman (staff) yönetimi
--   1) services.staff_id   → hizmeti veren ekip üyesi (owner veya staff)
--   2) appointments.staff_id mevcut kayıtlar için hizmetten türetilir
--   3) staff_invites       → WhatsApp davet linki ile ekibe katılma
--   4) RLS politikaları    → eleman sadece kendi hizmetlerini yönetir,
--                            sahip işletmesindeki herkesi yönetir
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) services.staff_id
-- ---------------------------------------------------------------------------
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_services_staff_id ON services(staff_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_staff ON services(tenant_id, staff_id);

-- Eski hizmetlerin sahibi yok: işletme sahibine bağlanmazsa hiçbir elemanda
-- görünmez ve randevu akışında kaybolurdu.
UPDATE services s
SET staff_id = owner.id
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, id
  FROM profiles
  WHERE role = 'owner' AND tenant_id IS NOT NULL
  ORDER BY tenant_id, created_at
) owner
WHERE s.staff_id IS NULL
  AND s.tenant_id = owner.tenant_id;

-- ---------------------------------------------------------------------------
-- 2) appointments.staff_id geri doldurma (hizmetin elemanından)
-- ---------------------------------------------------------------------------
UPDATE appointments a
SET staff_id = s.staff_id
FROM services s
WHERE a.service_id = s.id
  AND a.staff_id IS NULL
  AND s.staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_staff_time
  ON appointments(tenant_id, staff_id, start_time);

-- ---------------------------------------------------------------------------
-- 3) staff_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Token istemci tarafında üretilir (crypto.randomUUID): pgcrypto bağımlılığı yok
  token TEXT NOT NULL UNIQUE CHECK (length(token) >= 32),
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  note TEXT,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_tenant_status
  ON staff_invites(tenant_id, status);

COMMENT ON TABLE staff_invites IS
  'WhatsApp/e-posta ile paylaşılan eleman davet linkleri. /davet/[token] ile kabul edilir.';

-- ---------------------------------------------------------------------------
-- 4) RLS
--   Not: public.get_my_profile() zaten SECURITY DEFINER'dır, bu yüzden policy
--   içinden güvenle çağrılabilir (profiles RLS'i özyinelemez).
--
--   services üzerinde mevcut politikalar korunur:
--     services_select_public  → vitrin/randevu sayfası girişsiz çalışır
--     services_insert_owner / update_owner / delete_owner → işletme sahibi
--   Buraya yalnızca eksik olan "eleman kendi hizmetini yönetir" eklenir.
-- ---------------------------------------------------------------------------
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_invites_owner_all" ON staff_invites;
CREATE POLICY "staff_invites_owner_all" ON staff_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = staff_invites.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.role = 'owner' AND mp.tenant_id = staff_invites.tenant_id
    )
  );

-- Eleman: sadece kendine atanmış hizmetleri ekleyip düzenleyebilir/silebilir.
DROP POLICY IF EXISTS "services_staff_manage_own" ON services;
CREATE POLICY "services_staff_manage_own" ON services
  FOR ALL TO authenticated
  USING (
    staff_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.tenant_id = services.tenant_id
    )
  )
  WITH CHECK (
    staff_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.get_my_profile() mp(tenant_id, role)
      WHERE mp.tenant_id = services.tenant_id
    )
  );
