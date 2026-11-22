"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "randera_favorites";
const CHANGE_EVENT = "randera:favorites-updated";

function readFavorites(): string[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function publishFavorites(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Depolama kapalı olsa bile bu oturumdaki açık sekmeler senkronize kalır.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: ids }));
}

/**
 * Keşfet ve Favorilerim aynı favori listesini kullanır. Özel event aynı
 * sekmedeki mounted sayfaları, storage event'i ise diğer tarayıcı sekmelerini
 * senkronize eder.
 */
export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const favoriteIdsRef = useRef(favoriteIds);

  useEffect(() => {
    const sync = (ids: string[]) => {
      favoriteIdsRef.current = ids;
      setFavoriteIds(ids);
    };
    const onLocalChange = (event: Event) => {
      const ids = (event as CustomEvent<unknown>).detail;
      if (
        Array.isArray(ids) &&
        ids.every((id): id is string => typeof id === "string")
      ) {
        sync(ids);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync(readFavorites());
    };

    sync(readFavorites());
    window.addEventListener(CHANGE_EVENT, onLocalChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onLocalChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((next: string[]) => {
    favoriteIdsRef.current = next;
    setFavoriteIds(next);
    publishFavorites(next);
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      const current = favoriteIdsRef.current;
      update(
        current.includes(id)
          ? current.filter((favoriteId) => favoriteId !== id)
          : [...current, id],
      );
    },
    [update],
  );

  const removeFavorite = useCallback(
    (id: string) => {
      update(favoriteIdsRef.current.filter((favoriteId) => favoriteId !== id));
    },
    [update],
  );

  return { favoriteIds, toggleFavorite, removeFavorite };
}
