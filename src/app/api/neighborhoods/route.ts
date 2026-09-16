import { NextResponse } from "next/server";
import districtIds from "@/lib/districtIds.json";

// ponytail: süreç-içi cache; çok instance'lı deploy'da her instance kendi cache'ini tutar.
const TTL = 1000 * 60 * 60 * 24;
const cache = new Map<string, { at: number; data: string[] }>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const province = (searchParams.get("province") || "").trim();
    const district = (searchParams.get("district") || "").trim();

    const districtId = (districtIds as Record<string, number>)[
      `${province}|${district}`
    ];
    if (!districtId) return NextResponse.json({ neighborhoods: [] });

    const key = `${province}|${district}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL) {
      return NextResponse.json({ neighborhoods: cached.data });
    }

    const res = await fetch(
      `https://turkiyeapi.dev/api/v1/neighborhoods?districtId=${districtId}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`turkiyeapi ${res.status}`);

    const json = (await res.json()) as { data?: { name: string }[] };
    const neighborhoods = (json.data || [])
      .map((n) => n.name)
      .sort((a, b) => a.localeCompare(b, "tr"));

    cache.set(key, { at: Date.now(), data: neighborhoods });
    return NextResponse.json({ neighborhoods });
  } catch (err) {
    console.error("neighborhoods fetch error:", err);
    return NextResponse.json({
      neighborhoods: [],
      error: "Mahalle listesi alınamadı",
    });
  }
}
