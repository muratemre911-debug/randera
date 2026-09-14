-- booking_rules içine iptal süresi (cancelDeadlineHours) ekle
-- Yeni kayıtlar için DEFAULT'u güncelle
ALTER TABLE tenants
ALTER COLUMN booking_rules SET DEFAULT '{
  "slotDuration": 30,
  "autoApprove": true,
  "notifyEmail": true,
  "notifySms": false,
  "notifyWhatsapp": false,
  "cancelDeadlineHours": 24
}'::jsonb;

-- Mevcut kayıtlarda alan yoksa ekle (diğer alanlara dokunmaz)
UPDATE tenants
SET booking_rules = COALESCE(booking_rules, '{}'::jsonb) || '{"cancelDeadlineHours": 24}'::jsonb
WHERE NOT (COALESCE(booking_rules, '{}'::jsonb) ? 'cancelDeadlineHours');
