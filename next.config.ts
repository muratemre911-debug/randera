import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme rozetini (sağ alt "N Issues") gizler; derleme/runtime hataları yine konsola düşer.
  devIndicators: false,
};

export default nextConfig;
