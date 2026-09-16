import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import MapPoint from "./MapPoint";

describe("MapPoint", () => {
  it("konum verilince haritayı ve pini gösterir", async () => {
    const { container } = render(
      <MapPoint lat={41.0082} lng={28.9784} pinLabel="Test İşletme" />,
    );

    await waitFor(() =>
      expect(container.querySelector(".leaflet-container")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".leaflet-marker-icon")).toHaveLength(
        1,
      ),
    );
    expect(container.textContent).toContain("Test İşletme");
    expect(
      container.querySelector(".leaflet-control-attribution"),
    ).toBeTruthy();
  });

  it("konum yoksa pin basmaz (harita tıklamasıyla seçilecek)", async () => {
    const { container } = render(
      <MapPoint lat={null} lng={null} onChange={() => {}} />,
    );

    await waitFor(() =>
      expect(container.querySelector(".leaflet-container")).toBeTruthy(),
    );
    expect(container.querySelectorAll(".leaflet-marker-icon")).toHaveLength(0);
  });
});
