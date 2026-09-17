import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import DiscoverMap, { type TenantWithDetails } from "./DiscoverMap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProps = {
  getTenantPrice: () => 250,
  getTenantRating: () => ({ score: "Yeni", reviews: 0, hasReviews: false }),
  getSectorLabel: (sector: string | null) => sector ?? "Hizmet",
  getCoverImage: () => "/cover.jpg",
  lang: "tr",
};

const tenant = (id: string, province: string): TenantWithDetails => ({
  id,
  name: `İşletme ${id}`,
  sector: "berber",
  province,
  district: "Merkez",
  slug: `isletme-${id}`,
  profile_image_url: null,
});

describe("DiscoverMap", () => {
  it("gerçek Leaflet haritasını kurar ve her işletme için pin basar", async () => {
    const { container } = render(
      <DiscoverMap
        {...baseProps}
        tenants={[tenant("a", "İstanbul"), tenant("b", "Ankara")]}
        selectedTenant={null}
        onSelectTenant={() => {}}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector(".leaflet-container")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".leaflet-marker-icon")).toHaveLength(
        2,
      ),
    );
    expect(
      container.querySelector(".leaflet-control-attribution"),
    ).toBeTruthy();
  });

  it("pine tıklanınca işletmeyi seçer", async () => {
    const onSelectTenant = vi.fn();
    const istanbul = tenant("a", "İstanbul");
    const { container } = render(
      <DiscoverMap
        {...baseProps}
        tenants={[istanbul]}
        selectedTenant={null}
        onSelectTenant={onSelectTenant}
      />,
    );

    const pin = await waitFor(() => {
      const el = container.querySelector(".leaflet-marker-icon button");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });

    fireEvent.click(pin);
    expect(onSelectTenant).toHaveBeenCalledWith(istanbul);
  });

  it("seçili pin vurgulanır ve alt kart gösterilir", async () => {
    const istanbul = tenant("a", "İstanbul");
    const { container } = render(
      <DiscoverMap
        {...baseProps}
        tenants={[istanbul]}
        selectedTenant={istanbul}
        onSelectTenant={() => {}}
      />,
    );

    await waitFor(() =>
      expect(container.querySelectorAll(".leaflet-marker-icon")).toHaveLength(
        1,
      ),
    );
    const pin = container.querySelector(".leaflet-marker-icon button");
    expect(pin?.className).toContain("bg-indigo-600");
    expect(container.textContent).toContain(istanbul.name);
  });

  it("haritaya odak verilirken sayfa kaydırılmaz (preventScroll)", async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    const { container, unmount } = render(
      <DiscoverMap
        {...baseProps}
        tenants={[tenant("a", "İstanbul")]}
        selectedTenant={null}
        onSelectTenant={() => {}}
      />,
    );

    const mapEl = await waitFor(() => {
      const el = container.querySelector<HTMLElement>(".leaflet-container");
      expect(el).toBeTruthy();
      return el!;
    });

    // Leaflet, harita/zoom kontrollerine tıklanınca kapsayıcıya focus() verir
    mapEl.focus();
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
    unmount();
  });
});
