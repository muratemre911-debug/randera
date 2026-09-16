import { describe, expect, it } from "vitest";
import { cropMetrics, dragPosition, type CropPosition } from "./crop";

/**
 * Kırpma geometrisi: kaynak dikdörtgen her zaman görselin sınırları içinde
 * kalmalı, çerçeveyi tamamen kaplamalı ve uçlarda taşmamalı.
 */
const VIEWPORT = { width: 200, height: 200 };
const center: CropPosition = { x: 0, y: 0 };

describe("cropMetrics", () => {
  it("kare görsel + kare çerçevede tüm görseli kırpar", () => {
    const m = cropMetrics({
      natural: { width: 800, height: 800 },
      viewport: VIEWPORT,
      zoom: 1,
      position: center,
    });

    expect(m.rect).toEqual({ sx: 0, sy: 0, sw: 800, sh: 800 });
    expect(m.maxOffset).toEqual({ x: 0, y: 0 });
  });

  it("geniş görseli ortadan kare kırpar", () => {
    const m = cropMetrics({
      natural: { width: 2000, height: 1000 },
      viewport: VIEWPORT,
      zoom: 1,
      position: center,
    });

    expect(m.rect.sw).toBe(1000);
    expect(m.rect.sh).toBe(1000);
    expect(m.rect.sx).toBe(500); // 2000px genişliğin ortasındaki 1000px
    expect(m.rect.sy).toBe(0);
    expect(m.maxOffset.x).toBe(100);
    expect(m.maxOffset.y).toBe(0);
  });

  it("uçlara kaydırıldığında görsel sınırının dışına çıkmaz", () => {
    const left = cropMetrics({
      natural: { width: 2000, height: 1000 },
      viewport: VIEWPORT,
      zoom: 1,
      position: { x: 1, y: 0 },
    });
    const right = cropMetrics({
      natural: { width: 2000, height: 1000 },
      viewport: VIEWPORT,
      zoom: 1,
      position: { x: -1, y: 0 },
    });

    expect(left.rect.sx).toBe(0);
    expect(right.rect.sx).toBe(1000);
    // sınır dışına taşan pozisyon da kırpılır (clamp)
    const beyond = cropMetrics({
      natural: { width: 2000, height: 1000 },
      viewport: VIEWPORT,
      zoom: 1,
      position: { x: 5, y: 0 },
    });
    expect(beyond.rect.sx).toBe(0);
  });

  it("zoom arttıkça daha küçük bir alan kırpılır ve kenarlar içeride kalır", () => {
    const m = cropMetrics({
      natural: { width: 2000, height: 1000 },
      viewport: VIEWPORT,
      zoom: 2,
      position: center,
    });

    expect(m.rect.sw).toBe(500);
    expect(m.rect.sh).toBe(500);
    expect(m.rect.sx).toBe(750);
    expect(m.rect.sx + m.rect.sw).toBeLessThanOrEqual(2000);
    expect(m.maxOffset.x).toBe(300);
  });

  it("dikey görselde yalnızca dikey kaydırma sınırı oluşur", () => {
    const m = cropMetrics({
      natural: { width: 600, height: 1200 },
      viewport: VIEWPORT,
      zoom: 1,
      position: center,
    });

    expect(m.maxOffset.x).toBe(0);
    expect(m.maxOffset.y).toBe(100); // 1200 * (200/600) = 400 -> (400-200)/2
    expect(m.rect.sw).toBe(600); // tüm genişlik
    expect(m.rect.sh).toBe(600); // 1200px yüksekliğin ortasındaki 600px
  });
});

describe("dragPosition", () => {
  it("piksel hareketini orana çevirir ve -1..1 aralığında tutar", () => {
    const maxOffset = { x: 100, y: 50 };

    expect(dragPosition(center, { x: 50, y: -25 }, maxOffset)).toEqual({
      x: 0.5,
      y: -0.5,
    });
    expect(dragPosition(center, { x: 500, y: 500 }, maxOffset)).toEqual({
      x: 1,
      y: 1,
    });
    // kaydırma sınırı yoksa (görsel çerçeveyi tam kaplıyor) hareket etmez
    expect(
      dragPosition({ x: 0.3, y: 0.3 }, { x: 40, y: 40 }, { x: 0, y: 0 }),
    ).toEqual({
      x: 0,
      y: 0,
    });
  });
});
