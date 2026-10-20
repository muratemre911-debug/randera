import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme rozetini (sağ alt "N Issues") gizler; derleme/runtime hataları yine konsola düşer.
  devIndicators: false,

  async headers() {
    return [
      {
        /*
         * Önceden optimize edilmiş marka logoları (`public/logo/*-160.png`).
         *
         * Varsayılan `public/` başlığı `Cache-Control: public, max-age=0`'dı;
         * yani logo her tam sayfa yüklemesinde yeniden indiriliyordu. Bu
         * dosyalar sabit ölçülü (boyut adında yazar) ve yalnızca logo gerçekten
         * değiştiğinde yenilenir, bu yüzden kalıcı önbelleğe alınabilir.
         * PWA'da service worker bu yolları zaten cache-first tutuyor
         * (bkz. public/sw.js, `isImmutable`).
         */
        source: "/logo/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
