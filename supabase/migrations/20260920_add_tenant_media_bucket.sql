-- İşletme vitrin görselleri (profil fotoğrafı + kapak) için public storage bucket.
-- Yol kuralı: <tenant_id>/<dosya>.jpg  (örn. 3f1c.../profile-1726400000000.jpg)
--
-- Politika özeti:
--   * herkes okuyabilir (vitrin görselleri müşteri sayfalarında gösterilir)
--   * giriş yapmış işletme sahibi yalnızca KENDİ tenant klasörüne yükleyebilir
--
-- Not: aynı SQL bloğu Supabase panelindeki SQL Editor'e yapıştırılarak da
-- uygulanabilir. Bucket manuel oluşturulacaksa: Storage > New bucket >
-- name: tenants, public: true, ardından aşağıdaki iki policy eklenmelidir.

insert into storage.buckets (id, name, public)
values ('tenants', 'tenants', true)
on conflict (id) do update set public = true;

-- 1) Herkes okuyabilir (public bucket vitrin görselleri için)
drop policy if exists "tenant_media_read" on storage.objects;
create policy "tenant_media_read"
  on storage.objects for select
  using (bucket_id = 'tenants');

-- 2) İşletme sahibi kendi klasörüne yükleyebilir
drop policy if exists "tenant_media_insert_own" on storage.objects;
create policy "tenant_media_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tenants'
    and (storage.foldername(name))[1] = (
      select p.tenant_id::text from public.profiles p where p.id = auth.uid()
    )
  );
