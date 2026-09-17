import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import CustomerBottomNav from "./CustomerBottomNav";

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

  it("geçerli yola göre ilgili sekme aktif vurgulanır", () => {
    nav.pathname = "/discover";
    const { container, rerender } = render(<CustomerBottomNav tabs={tabs} />);
    expect(links(container)[0].className).toContain("font-extrabold");
    expect(links(container)[1].className).toContain("font-medium");

    nav.pathname = "/favorites";
    rerender(<CustomerBottomNav tabs={tabs} />);
    expect(links(container)[0].className).toContain("font-medium");
    expect(links(container)[1].className).toContain("font-extrabold");
  });

  it("sekme olmayan sayfada (/b/[slug]) hiçbiri aktif görünmez", () => {
    nav.pathname = "/b/kuafor";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);

    expect(
      links(container).every((link) => link.className.includes("font-medium")),
    ).toBe(true);
  });
});
