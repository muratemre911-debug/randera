import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import CustomerBottomNav from "./CustomerBottomNav";
import { emitTabScroll } from "@/lib/tabSwipe";

const nav = vi.hoisted(() => ({ pathname: "/discover" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

const tabs = [
  { href: "/discover", icon: () => <svg />, label: "Keşfet" },
  { href: "/favorites", icon: () => <svg />, label: "Favorilerim" },
  { href: "/my-appointments", icon: () => <svg />, label: "Randevularım" },
  { href: "/profile", icon: () => <svg />, label: "Profilim" },
];

const links = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("a"));

describe("CustomerBottomNav", () => {
  afterEach(() => {
    nav.pathname = "/discover";
  });

  it("ray yarım kaydırıldığında vurgu komşu sekmeye geçer", () => {
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    expect(links(container)[0].className).toContain("font-extrabold");

    act(() => emitTabScroll(0.6)); // parmak yarıyı geçti

    expect(links(container)[0].className).toContain("font-medium");
    expect(links(container)[1].className).toContain("font-extrabold");
    expect(links(container)[2].className).toContain("font-medium");
  });

  it("ray henüz yarıma gelmediyse vurgu yerinde kalır", () => {
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    act(() => emitTabScroll(0.4));

    expect(links(container)[0].className).toContain("font-extrabold");
    expect(links(container)[1].className).toContain("font-medium");
  });

  it("sekme olmayan sayfada (/b/[slug]) hiçbiri aktif görünmez", () => {
    nav.pathname = "/b/kuafor";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);

    expect(
      links(container).every((link) => link.className.includes("font-medium")),
    ).toBe(true);
  });
});
