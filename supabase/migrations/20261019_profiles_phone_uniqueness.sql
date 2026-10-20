-- Randera — telefon numarası bütünlüğü
--
-- Amaç: aynı telefon numarasının birden fazla hesapta kullanılmasını engellemek
-- ve eski kayıtlardaki yazım farklarını (boşluklu, +90'lı, 90'lı, baştaki 0
-- unutulmuş) tek biçime (05XXXXXXXXX) çekmek.
--
-- Uygulama tarafındaki doğrulama (biçim + bariz uydurma desenler) src/lib/phone.ts
-- içinde; bu göç yalnızca veriyi hizalar ve veritabanı seviyesinde benzersizliği
-- garanti eder.
--
-- DİKKAT: 3. ve 4. adımlar bazı kayıtların numarasını boşaltır:
--   - 3. adım: Türkiye mobil biçimine uymayan numaralar (sabit hat, eksik/fazla
--     hane, yabancı numara vb.) boşaltılır; müşteriye uygulama içinde yeniden sorulur.
--   - 4. adım: aynı numarayı paylaşan eski kayıtlarda en SON kaydolan hesabın
--     numarası boşaltılır (ilk kayıt numarayı korur).

begin;

-- 1) Boşluk, parantez, "+" gibi karakterleri at; tamamen boşalan değerleri NULL yap
update profiles
   set phone = nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '')
 where phone is not null;

-- 2) "90 5XX..." ve "5XX..." yazımlarını "05XX..." biçimine çek
update profiles
   set phone = '0' || substring(phone from 3)
 where phone ~ '^90[0-9]{10}$';

update profiles
   set phone = '0' || phone
 where phone ~ '^5[0-9]{9}$';

-- 3) Türkiye mobil biçimine uymayan numaraları boşalt (yeniden istenir)
update profiles
   set phone = null
 where phone is not null
   and phone !~ '^05[0-9]{9}$';

-- 4) Aynı numarayı paylaşan kayıtlarda en son kaydolanın numarasını boşalt
with ranked as (
  select id,
         row_number() over (partition by phone order by created_at asc, id asc) as rn
    from profiles
   where phone is not null
)
update profiles p
   set phone = null
  from ranked r
 where r.id = p.id
   and r.rn > 1;

-- 5) Benzersizlik: bir numara yalnızca bir hesapta kullanılabilir
--    (boş numaralar bu kuralın dışında)
create unique index if not exists profiles_phone_unique
  on profiles (phone)
  where phone is not null;

commit;

-- Sonuç raporu
select
  (select count(*) from profiles)                              as toplam_profil,
  (select count(*) from profiles where phone is not null)      as numarali_profil,
  (select count(*) from (
     select phone from profiles
      where phone is not null
      group by phone
     having count(*) > 1
   ) tekrar)                                                   as tekrarli_numara;
