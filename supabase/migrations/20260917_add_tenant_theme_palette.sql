-- İşletme sayfası (b/[slug]) için tema paleti seçimi.
-- Geçerli değerler src/lib/palettes.ts içindeki id'lerdir (indigo, rose, emerald, ...).
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS theme_palette TEXT DEFAULT 'indigo';

COMMENT ON COLUMN tenants.theme_palette IS 'İşletme sayfasında kullanılan tema paleti id (varsayılan: indigo)';
