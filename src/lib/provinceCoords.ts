// Türkiye il merkezi koordinatları (kaynak: turkiyeapi.dev).
// ponytail: pinler il merkezine göre yaklaşıktır; ilçe/adres hassasiyeti için
// tenants.lat/lng kolonu + geocoding eklenmeli.
export const PROVINCE_COORDS: Record<string, { lat: number; lng: number }> = {
  Adana: { lat: 37.001667, lng: 35.328889 },
  Adıyaman: { lat: 37.764722, lng: 38.278611 },
  Afyonkarahisar: { lat: 38.750278, lng: 30.556667 },
  Aksaray: { lat: 38.36667, lng: 34.03333 },
  Amasya: { lat: 40.649722, lng: 35.835278 },
  Ankara: { lat: 39.92077, lng: 32.85411 },
  Antalya: { lat: 36.88414, lng: 30.70563 },
  Ardahan: { lat: 41.10833, lng: 42.7 },
  Artvin: { lat: 41.18222, lng: 41.81889 },
  Aydın: { lat: 37.84444, lng: 27.84556 },
  Ağrı: { lat: 39.719444, lng: 43.050556 },
  Balıkesir: { lat: 39.64861, lng: 27.8825 },
  Bartın: { lat: 41.63333, lng: 32.33333 },
  Batman: { lat: 37.88333, lng: 41.13333 },
  Bayburt: { lat: 40.25, lng: 40.21667 },
  Bilecik: { lat: 40.14556, lng: 29.97917 },
  Bingöl: { lat: 38.885, lng: 40.49861 },
  Bitlis: { lat: 38.39528, lng: 42.12361 },
  Bolu: { lat: 40.73528, lng: 31.60639 },
  Burdur: { lat: 37.72111, lng: 30.29056 },
  Bursa: { lat: 40.18222, lng: 29.06111 },
  Denizli: { lat: 37.77639, lng: 29.08611 },
  Diyarbakır: { lat: 37.91417, lng: 40.23056 },
  Düzce: { lat: 40.83333, lng: 31.16667 },
  Edirne: { lat: 41.67083, lng: 26.55556 },
  Elazığ: { lat: 38.68056, lng: 39.22639 },
  Erzincan: { lat: 39.75, lng: 39.5 },
  Erzurum: { lat: 39.90861, lng: 41.27694 },
  Eskişehir: { lat: 39.77639, lng: 30.52056 },
  Gaziantep: { lat: 37.06667, lng: 37.38333 },
  Giresun: { lat: 40.91667, lng: 38.4 },
  Gümüşhane: { lat: 40.45, lng: 39.48333 },
  Hakkari: { lat: 37.58333, lng: 43.73333 },
  Hatay: { lat: 36.2, lng: 36.16667 },
  Isparta: { lat: 37.76667, lng: 30.55 },
  Iğdır: { lat: 39.91667, lng: 44.03333 },
  Kahramanmaraş: { lat: 37.58333, lng: 36.93333 },
  Karabük: { lat: 41.2, lng: 32.63333 },
  Karaman: { lat: 37.18333, lng: 33.21667 },
  Kars: { lat: 40.60833, lng: 43.08333 },
  Kastamonu: { lat: 41.38889, lng: 33.78222 },
  Kayseri: { lat: 38.73111, lng: 35.47889 },
  Kilis: { lat: 36.71667, lng: 37.11667 },
  Kocaeli: { lat: 40.76667, lng: 29.91667 },
  Konya: { lat: 37.86667, lng: 32.48333 },
  Kütahya: { lat: 39.41667, lng: 29.98333 },
  Kırklareli: { lat: 41.73333, lng: 27.21667 },
  Kırıkkale: { lat: 39.85, lng: 33.51667 },
  Kırşehir: { lat: 39.14222, lng: 34.17056 },
  Malatya: { lat: 38.355, lng: 38.305 },
  Manisa: { lat: 38.61361, lng: 27.42694 },
  Mardin: { lat: 37.31111, lng: 40.74361 },
  Mersin: { lat: 36.8, lng: 34.63333 },
  Muğla: { lat: 37.21667, lng: 28.36667 },
  Muş: { lat: 38.74444, lng: 41.49611 },
  Nevşehir: { lat: 38.62444, lng: 34.72306 },
  Niğde: { lat: 37.96667, lng: 34.68333 },
  Ordu: { lat: 40.98333, lng: 37.88333 },
  Osmaniye: { lat: 37.06667, lng: 36.25 },
  Rize: { lat: 41.02083, lng: 40.52361 },
  Sakarya: { lat: 40.76667, lng: 30.41667 },
  Samsun: { lat: 41.28639, lng: 36.33139 },
  Siirt: { lat: 37.94444, lng: 41.93333 },
  Sinop: { lat: 42.02361, lng: 35.15306 },
  Sivas: { lat: 39.74722, lng: 37.0175 },
  Tekirdağ: { lat: 40.98333, lng: 27.51667 },
  Tokat: { lat: 40.31667, lng: 36.55 },
  Trabzon: { lat: 41, lng: 39.73333 },
  Tunceli: { lat: 39.11667, lng: 39.53333 },
  Uşak: { lat: 38.68333, lng: 29.41667 },
  Van: { lat: 38.5, lng: 43.4 },
  Yalova: { lat: 40.65, lng: 29.26667 },
  Yozgat: { lat: 39.81667, lng: 34.81667 },
  Zonguldak: { lat: 41.45, lng: 31.8 },
  Çanakkale: { lat: 40.15556, lng: 26.41444 },
  Çankırı: { lat: 40.6, lng: 33.61667 },
  Çorum: { lat: 40.55056, lng: 34.95556 },
  İstanbul: { lat: 41.01384, lng: 28.94966 },
  İzmir: { lat: 38.41885, lng: 27.12872 },
  Şanlıurfa: { lat: 37.15, lng: 38.8 },
  Şırnak: { lat: 37.51667, lng: 42.46667 },
};

// Türkiye'yi kapsayan varsayılan görünüm
export const TURKEY_CENTER: [number, number] = [39.0, 35.3];
export const TURKEY_ZOOM = 6;

// Pin konumu: işletmenin haritada seçtiği nokta; seçilmemişse il merkezi + hash tabanlı küçük sapma.
// ponytail: pin seçilmemiş işletmeler il merkezinde gösterilir (haritada notla belirtilir).
export function tenantCoords(tenant: {
  id: string;
  province: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): [number, number] {
  if (tenant.latitude != null && tenant.longitude != null) {
    return [tenant.latitude, tenant.longitude];
  }

  const base = tenant.province ? PROVINCE_COORDS[tenant.province] : undefined;
  if (!base) return TURKEY_CENTER;

  const hash = tenant.id
    .split("")
    .reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.015 + ((hash >> 3) % 40) / 1000; // ~1.5 - 5.5 km
  return [
    base.lat + Math.sin(angle) * radius,
    base.lng + Math.cos(angle) * radius,
  ];
}

/** İşletme haritada kendi konumunu seçmiş mi? */
export function hasExactLocation(tenant: {
  latitude?: number | null;
  longitude?: number | null;
}) {
  return tenant.latitude != null && tenant.longitude != null;
}
