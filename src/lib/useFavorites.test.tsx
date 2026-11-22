import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFavorites } from "./useFavorites";

describe("useFavorites", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("favori değişikliğini aynı sayfadaki mounted panellere anında aktarır", () => {
    const discover = renderHook(() => useFavorites());
    const favorites = renderHook(() => useFavorites());

    act(() => discover.result.current.toggleFavorite("tenant-1"));

    expect(discover.result.current.favoriteIds).toEqual(["tenant-1"]);
    expect(favorites.result.current.favoriteIds).toEqual(["tenant-1"]);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "randera_favorites",
      '["tenant-1"]',
    );

    act(() => favorites.result.current.removeFavorite("tenant-1"));

    expect(discover.result.current.favoriteIds).toEqual([]);
    expect(favorites.result.current.favoriteIds).toEqual([]);
  });
});
