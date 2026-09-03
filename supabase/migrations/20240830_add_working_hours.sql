-- Add working_hours column to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
  "pazartesi": {"isOpen": true, "openTime": "09:00", "closeTime": "18:00"},
  "sali": {"isOpen": true, "openTime": "09:00", "closeTime": "18:00"},
  "carsamba": {"isOpen": true, "openTime": "09:00", "closeTime": "18:00"},
  "persembe": {"isOpen": true, "openTime": "09:00", "closeTime": "18:00"},
  "cuma": {"isOpen": true, "openTime": "09:00", "closeTime": "18:00"},
  "cumartesi": {"isOpen": true, "openTime": "10:00", "closeTime": "16:00"},
  "pazar": {"isOpen": false, "openTime": "00:00", "closeTime": "00:00"}
}'::jsonb;

COMMENT ON COLUMN tenants.working_hours IS 'Weekly working hours for the business';