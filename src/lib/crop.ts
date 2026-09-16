/**
 * Görsel kırpma (crop) geometrisi.
 *
 * Kullanıcı bir fotoğrafı çerçevenin içine "cover" mantığıyla yerleştirir,
 * tekerlek/slider ile yakınlaştırır (zoom) ve sürükleyerek kaydırır.
 * Kaydırma oranı (-1..1) olarak tutulur; böylece pencere/çerçeve boyutu
 * değişse de görüntü aynı oranda kalır.
 *
 * Tüm değerler kaynak görselin doğal piksel uzayında döner.
 */

export interface Size {
  width: number;
  height: number;
}

/** Kaydırma oranı: -1 = bir uç, 0 = ortalanmış, 1 = diğer uç. */
export type CropPosition = { x: number; y: number };

export interface CropMetrics {
  /** Çerçeve içindeki görselin ölçeği: kaynak piksel -> CSS piksel */
  scale: number;
  /** Görselin çerçeve içindeki çizilmiş boyutu (CSS piksel) */
  drawn: Size;
  /** Kaydırmanın piksel sınırı (görsel çerçeveyi tamamen kaplar) */
  maxOffset: { x: number; y: number };
  /** O anki piksel kaydırması */
  offset: { x: number; y: number };
  /** Canvas drawImage için kaynak dikdörtgen */
  rect: { sx: number; sy: number; sw: number; sh: number };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function cropMetrics({
  natural,
  viewport,
  zoom,
  position,
}: {
  natural: Size;
  viewport: Size;
  zoom: number;
  position: CropPosition;
}): CropMetrics {
  const safeZoom = Math.max(1, zoom);
  const scale =
    Math.max(viewport.width / natural.width, viewport.height / natural.height) *
    safeZoom;
  const drawn = {
    width: natural.width * scale,
    height: natural.height * scale,
  };
  const maxOffset = {
    x: Math.max(0, (drawn.width - viewport.width) / 2),
    y: Math.max(0, (drawn.height - viewport.height) / 2),
  };
  const offset = {
    x: clamp(position.x, -1, 1) * maxOffset.x,
    y: clamp(position.y, -1, 1) * maxOffset.y,
  };

  return {
    scale,
    drawn,
    maxOffset,
    offset,
    rect: {
      sx: natural.width / 2 - (viewport.width / 2 + offset.x) / scale,
      sy: natural.height / 2 - (viewport.height / 2 + offset.y) / scale,
      sw: viewport.width / scale,
      sh: viewport.height / scale,
    },
  };
}

/** Sürükleme sırasında kaydırma oranını piksel hareketine göre güncelle. */
export function dragPosition(
  start: CropPosition,
  delta: { x: number; y: number },
  maxOffset: { x: number; y: number },
): CropPosition {
  return {
    x: maxOffset.x > 0 ? clamp(start.x + delta.x / maxOffset.x, -1, 1) : 0,
    y: maxOffset.y > 0 ? clamp(start.y + delta.y / maxOffset.y, -1, 1) : 0,
  };
}
