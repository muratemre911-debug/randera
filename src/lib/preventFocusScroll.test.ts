import { describe, expect, it, vi, beforeEach } from "vitest";
import { preventFocusScroll } from "./preventFocusScroll";

/** Dokunmatik cihazı taklit et (masaüstünde fonksiyon zaten devre dışı) */
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: coarse"),
  }));
});

/** preventDefault çağrısını izleyen sahte mouse olayı üretir */
function mouseEvent(target: HTMLElement | null) {
  const preventDefault = vi.fn();
  return {
    event: { target, preventDefault } as unknown as Parameters<
      typeof preventFocusScroll
    >[0],
    preventDefault,
  };
}

describe("preventFocusScroll", () => {
  it("dokunmatik cihazda buton/link öğelerinde odaklanmayı (ve kaydırmayı) engeller", () => {
    const button = document.createElement("button");
    const { event, preventDefault } = mouseEvent(button);
    preventFocusScroll(event);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("masaüstünde (ince işaretçi) dokunmaz: metin seçimi bozulmasın", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const button = document.createElement("button");
    const { event, preventDefault } = mouseEvent(button);
    preventFocusScroll(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("metin girişlerinde ve labellarında engellemez (klavye/odak gerekli)", () => {
    const input = document.createElement("input");
    const { event, preventDefault } = mouseEvent(input);
    preventFocusScroll(event);
    expect(preventDefault).not.toHaveBeenCalled();

    const label = document.createElement("label");
    const inner = document.createElement("span");
    label.appendChild(inner);
    const second = mouseEvent(inner);
    preventFocusScroll(second.event);
    expect(second.preventDefault).not.toHaveBeenCalled();
  });
});
