-- Süper admin hesabının işletmesi sınırsızdır: üyelik süresi işlemez,
-- panelden kapatılamaz/silinemez (API tarafında da korunur).
-- NOT: env ile eklenen diğer adminler burada bilinemediği için, API ilk işlemde
-- kendi kendini onararak o işletmeleri de 'unlimited' yapar.
UPDATE tenants
SET membership_status = 'unlimited',
    membership_ends_at = NULL,
    trial_ends_at = NULL
WHERE id IN (
  SELECT p.tenant_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = 'muratemre911@gmail.com'
    AND p.tenant_id IS NOT NULL
);

COMMENT ON COLUMN tenants.membership_status IS 'trial | active | unlimited (süper admin) | suspended (kapatıldı)';
