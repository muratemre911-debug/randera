-- Add description column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN tenants.description IS 'Business description/about text';