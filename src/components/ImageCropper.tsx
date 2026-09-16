"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import {
  cropMetrics,
  dragPosition,
  type CropPosition,
  type Size,
} from "@/lib/crop";

interface ImageCropperProps {
  /** Kırpılacak görselin URL'si (dosya seçiminden gelen object URL) */
  src: string;
  /** Çerçevenin en/boy oranı: profil 1, kapak 2 */
  aspect: number;
  /** Dairesel çerçeve (profil fotoğrafı) */
  round?: boolean;
  /** Dışa aktarılan görselin genişliği (px) */
  outputWidth: number;
  title: string;
  /** Yükleme sürerken butonu kilitler */
  saving?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

const MAX_ZOOM = 3;

/**
 * Fotoğrafı çerçeveye oturtma aracı: sürükle-kaydır + yakınlaştırma.
 * Kaydet'e basınca kırpılmış görseli JPEG blob olarak döner; yükleme
 * işini çağıran taraf (Supabase Storage) yapar.
 *
 * `ponytail:` iki parmakla zoom yok; mobilde zoom kaydırıcıdan yapılır.
 */
export default function ImageCropper({
  src,
  aspect,
  round = false,
  outputWidth,
  title,
  saving = false,
  onCancel,
  onSave,
}: ImageCropperProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    start: CropPosition;
  } | null>(null);

  const [natural, setNatural] = useState<Size | null>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 });

  // Görseli önceden yükle: hem çerçeve ölçüsü hem canvas için tek bitmap kullanılır.
  useEffect(() => {
    const image = new window.Image();
    image.onload = () => {
      imageRef.current = image;
      setNatural({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = src;
    return () => {
      image.onload = null;
    };
  }, [src]);

  // Çerçeve ölçüsü (responsive): kırpma oranı kaydırma oranı olarak tutulduğu
  // için pencere boyutu değişse de görsel aynı yerde kalır.
  useEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const metrics =
    natural && viewport
      ? cropMetrics({ natural, viewport, zoom, position })
      : null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!metrics) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      start: position,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !metrics) return;
    setPosition(
      dragPosition(
        drag.start,
        { x: event.clientX - drag.startX, y: event.clientY - drag.startY },
        metrics.maxOffset,
      ),
    );
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = () => {
    const image = imageRef.current;
    if (!image || !natural || !viewport) return;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(outputWidth);
    canvas.height = Math.max(
      1,
      Math.round((outputWidth * viewport.height) / viewport.width),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { rect } = cropMetrics({ natural, viewport, zoom, position });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
      },
      "image/jpeg",
      0.9,
    );
  };

  const ready = Boolean(metrics);

  // Panel kartları `backdrop-blur` kullandığı için `fixed` onların içinde
  // kapsanır; pencereyi body'ye taşıyoruz (PostModal ile aynı desen).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="animate-modal-in w-full max-w-[460px] rounded-[28px] border border-white/60 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Fotoğrafı sürükleyerek konumlandırın, kaydırıcı ile yakınlaştırın.
        </p>

        <div
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ aspectRatio: String(aspect) }}
          className={`relative mt-4 w-full cursor-grab touch-none overflow-hidden bg-slate-900/90 active:cursor-grabbing ${
            round
              ? "mx-auto max-w-[240px] rounded-full ring-2 ring-white/60"
              : "rounded-2xl"
          }`}
        >
          {metrics ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
              style={{
                width: metrics.drawn.width,
                height: metrics.drawn.height,
                transform: `translate(-50%, -50%) translate(${metrics.offset.x}px, ${metrics.offset.y}px)`,
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(2))))
            }
            disabled={zoom <= 1}
            aria-label="Uzaklaştır"
            className="rounded-xl bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Minus size={16} />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Yakınlaştır"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600 dark:bg-slate-700"
          />
          <button
            type="button"
            onClick={() =>
              setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.2).toFixed(2))))
            }
            disabled={zoom >= MAX_ZOOM}
            aria-label="Yakınlaştır"
            className="rounded-xl bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!ready || saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {saving ? "Yükleniyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
