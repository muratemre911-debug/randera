-- İşletme konumunu yapılandırılmış adres + harita noktası olarak sakla
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS building_no TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN tenants.neighborhood IS 'Mahalle (il/ilçe ile birlikte yapılandırılmış adres)';
COMMENT ON COLUMN tenants.street IS 'Cadde/sokak adı';
COMMENT ON COLUMN tenants.building_no IS 'Bina/kapı numarası';
COMMENT ON COLUMN tenants.latitude IS 'Haritada seçilen konumun enlemi';
COMMENT ON COLUMN tenants.longitude IS 'Haritada seçilen konumun boylamı';
COMMENT ON COLUMN tenants.address IS 'Elle yazılan açık adres / tarif (yapılandırılmış alanların üzerine ek bilgi)';
