"use client";

import { useState, type ReactNode } from "react";

/**
 * Bozuk/kullanılamayan görseller için güvenli `<img>`.
 *
 * İşletme görselleri kullanıcı tarafından girilir ve çoğu zaman dış sitelere
 * bağlantılıdır (hotlink). Dış kaynak kapandığında, engellendiğinde (ör.
 * tarayıcının ORB koruması) ya da bağlantı kopuk olduğunda tarayıcı bozuk
 * görsel simgesi gösteriyordu. Bu bileşen sırayla dener:
 *
 *   1. `src`
 *   2. `fallbackSrc` (ör. sektöre göre varsayılan görsel)
 *   3. `fallbackIcon` (ör. bir ikon)
 *
 * Efekt kullanılmaz: yalnızca "hangi adres başarısız oldu" saklanır ve
 * gösterilecek adres render sırasında türetilir. Böylece `src` değiştiğinde
 * (ör. filtre değişince) durum kendiliğinden sıfırlanır.
 */
interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackIcon?: ReactNode;
  fallbackSrc?: string;
  loading?: "lazy" | "eager";
}

export default function SafeImage({
  src,
  alt,
  className,
  fallbackIcon,
  fallbackSrc,
  loading = "lazy",
}: SafeImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  let showing: string | null = null;
  if (src && failedUrl !== src) {
    showing = src;
  } else if (fallbackSrc && failedUrl !== fallbackSrc) {
    showing = fallbackSrc;
  }

  if (!showing) return <>{fallbackIcon ?? null}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={showing}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailedUrl(showing)}
      className={className}
    />
  );
}
