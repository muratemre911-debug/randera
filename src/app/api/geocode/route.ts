import { NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS = {
  // Nominatim kullanım politikası: uygulamayı tanımlayan bir User-Agent zorunlu.
  "User-Agent": "Randera/0.1 (randevu sistemi; iletisim: destek@randera.app)",
  "Accept-Language": "tr",
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  province?: string;
  district?: string;
  neighborhood?: string;
  street?: string;
  building_no?: string;
}

// ponytail: süreç-içi cache + basit seri kuyruk; Nominatim 1 istek/sn sınırı için yeterli.
const TTL = 1000 * 60 * 60 * 24;
const cache = new Map<string, { at: number; data: GeocodeResult | null }>();
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCall));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const key = q ? `q:${q.toLowerCase()}` : `r:${lat},${lon}`;

    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL) {
      return NextResponse.json({ result: cached.data });
    }

    let result: GeocodeResult | null = null;

    if (q) {
      const res = await throttled(() =>
        fetch(
          `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=tr&q=${encodeURIComponent(q)}`,
          {
            headers: HEADERS,
            cache: "no-store",
          },
        ),
      );
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const hits = (await res.json()) as { lat: string; lon: string }[];
      if (hits[0])
        result = { lat: Number(hits[0].lat), lng: Number(hits[0].lon) };
    } else if (lat && lon) {
      const res = await throttled(() =>
        fetch(
          `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`,
          {
            headers: HEADERS,
            cache: "no-store",
          },
        ),
      );
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const json = (await res.json()) as {
        lat: string;
        lon: string;
        address?: Record<string, string>;
      };
      const a = json.address || {};
      result = {
        lat: Number(json.lat ?? lat),
        lng: Number(json.lon ?? lon),
        province: a.province || a.state,
        district: a.town || a.city_district || a.county || a.city,
        neighborhood: a.neighbourhood || a.quarter || a.suburb || a.village,
        street: a.road || a.pedestrian,
        building_no: a.house_number,
      };
    } else {
      return NextResponse.json(
        { error: "q veya lat/lon gerekli" },
        { status: 400 },
      );
    }

    cache.set(key, { at: Date.now(), data: result });
    return NextResponse.json({ result });
  } catch (err) {
    console.error("geocode error:", err);
    return NextResponse.json({
      result: null,
      error: "Adres servisine ulaşılamadı",
    });
  }
}
