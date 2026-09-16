-- İşletme üyeliği / deneme süresi takibi
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'trial';

COMMENT ON COLUMN tenants.trial_ends_at IS 'Deneme üyeliğinin bittiği tarih';
COMMENT ON COLUMN tenants.membership_ends_at IS 'Ücretli/verilen üyeliğin bittiği tarih';
COMMENT ON COLUMN tenants.membership_status IS 'trial | active | suspended (süper admin kapatırsa suspended)';

-- Mevcut işletmeler deploy sonrası kilitlenmesin: 1 aylık üyelikle başlat.
-- (Yalnızca hiç üyelik/deneme tarihi olmayan kayıtlar için çalışır.)
UPDATE tenants
SET membership_ends_at = NOW() + INTERVAL '30 days',
    membership_status = 'active'
WHERE membership_ends_at IS NULL
  AND trial_ends_at IS NULL;
