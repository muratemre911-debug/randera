"use client";

import { useState } from "react";

/**
 * Sidebar / çekmece kullanıcı kimliği yardımcıları.
 *
 * Sol altta e-postanın yerine kullanıcı adı ve profil fotoğrafı gösterilir.
 * Hem işletme panelinde hem müşteri alanında aynı görünüm kullanılır.
 */
export function getDisplayName(
  fullName?: string | null,
  email?: string | null,
  fallback: string = "Randera"
): string {
  const name = (fullName || "").trim();
  if (name) return name;
  const mail = (email || "").trim();
  if (mail) return mail.split("@")[0];
  return fallback;
}

interface UserAvatarProps {
  /** Profil fotoğrafı URL'i (profiles.avatar_url) */
  src?: string | null;
  fullName?: string | null;
  email?: string | null;
  /** Boyut/metin sınıfları, ör. "h-10 w-10 text-sm" */
  className?: string;
  shape?: "circle" | "rounded";
}

/** Profil fotoğrafı yoksa/yüklenmezse ismin ilk harfini gösterir. */
export default function UserAvatar({
  src,
  fullName,
  email,
  className = "h-10 w-10 text-sm",
  shape = "circle",
}: UserAvatarProps) {
  // Effect kullanmadan "bozuk görsel" takibi: kaynak değişince otomatik sıfırlanır
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displayName = getDisplayName(fullName, email);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 font-bold text-white shadow-sm ${
        shape === "circle" ? "rounded-full" : "rounded-2xl"
      } ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={displayName}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{displayName.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
