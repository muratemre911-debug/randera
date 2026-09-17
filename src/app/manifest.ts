import type { MetadataRoute } from "next";

/**
 * Web App Manifest (Next.js App Router dosya konvansiyonu).
 *
 * Telefona "Ana ekrana ekle" ile kurulduğunda uygulama, tarayıcı çubuğu
 * olmadan tam ekran (standalone) açılır. Simgeler `public/` altında
 * `logo-light.png` kaynağından üretilmiştir.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Randera - Randevu & İşletme Yönetimi",
    short_name: "Randera",
    description:
      "Randera ile işletmeniz için profesyonel randevu yönetimi. Berber, doktor, danışman ve tüm zaman tabanlı hizmetler için.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f8fafc",
    theme_color: "#f8fafc",
    lang: "tr",
    dir: "ltr",
    categories: ["business", "productivity", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Keşfet",
        short_name: "Keşfet",
        url: "/discover",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Randevularım",
        short_name: "Randevularım",
        url: "/my-appointments",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Favorilerim",
        short_name: "Favorilerim",
        url: "/favorites",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Profilim",
        short_name: "Profilim",
        url: "/profile",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
