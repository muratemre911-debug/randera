-- Add booking_rules column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS booking_rules JSONB DEFAULT '{
  "slotDuration": 30,
  "autoApprove": true,
  "notifyEmail": true,
  "notifySms": false,
  "notifyWhatsapp": false
}'::jsonb;

COMMENT ON COLUMN tenants.booking_rules IS 'Booking rules for the business (slot duration, auto-approve, notifications)';
