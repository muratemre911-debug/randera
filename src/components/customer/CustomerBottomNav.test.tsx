import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import CustomerBottomNav from "./CustomerBottomNav";
import { PAGE_SWIPE_PROGRESS_EVENT } from "@/components/layout/pageSwipeProgress";

const nav = vi.hoisted(() => ({
  pathname: "/discover",
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.routerPush, prefetch: vi.fn() }),
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
    nav.routerPush.mockClear();
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("geçerli yola göre ilgili sekme aktif vurgulanır", () => {
    nav.pathname = "/discover";
    const { container, rerender } = render(<CustomerBottomNav tabs={tabs} />);
    expect(links(container)[0]).toHaveAttribute("aria-current", "page");
    expect(links(container)[0].className).toContain("shell-nav-item-active");
    expect(links(container)[1].className).not.toContain("shell-nav-item-active");

    nav.pathname = "/favorites";
    rerender(<CustomerBottomNav tabs={tabs} />);
    expect(links(container)[0]).not.toHaveAttribute("aria-current");
    expect(links(container)[1]).toHaveAttribute("aria-current", "page");
  });

  it("sekme olmayan sayfada (/b/[slug]) hiçbiri aktif görünmez", () => {
    nav.pathname = "/b/kuafor";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);

    expect(links(container).every((link) => !link.hasAttribute("aria-current"))).toBe(
      true,
    );
  });

  it("mobil çubuk üzerinde sürükleyince hedef sekmeye geçer", () => {
    nav.pathname = "/discover";
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === "(max-width: 1023px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);

    Object.defineProperty(navBar, "getBoundingClientRect", {
      value: () => ({ left: 0, right: 400, width: 400, top: 0, bottom: 64, height: 64 }),
    });
    tabLinks.forEach((link, index) => {
      Object.defineProperty(link, "getBoundingClientRect", {
        value: () => ({
          left: index * 100,
          right: (index + 1) * 100,
          width: 100,
          top: 0,
          bottom: 64,
          height: 64,
        }),
      });
    });
    window.dispatchEvent(new Event("resize"));

    const dispatchPointer = (
      target: Element,
      type: string,
      values: Record<string, unknown>,
    ) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      for (const [key, value] of Object.entries(values)) {
        Object.defineProperty(event, key, { value });
      }
      fireEvent(target, event);
    };

    dispatchPointer(tabLinks[0], "pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 25,
    });
    dispatchPointer(navBar, "pointermove", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 250,
    });
    expect(
      Number.parseFloat(
        navBar.style.getPropertyValue("--shell-nav-body-scale-x"),
      ),
    ).toBeGreaterThan(1);
    expect(
      Number.parseFloat(
        navBar.style.getPropertyValue("--shell-nav-body-scale-y"),
      ),
    ).toBeLessThan(1);
    expect(navBar.style.getPropertyValue("--shell-nav-body-origin")).toBe(
      "left center",
    );
    dispatchPointer(navBar, "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 250,
    });

    expect(nav.routerPush).toHaveBeenCalledWith("/my-appointments");
    expect(navBar.style.getPropertyValue("--shell-nav-body-scale-x")).toBe("1");
    expect(navBar.style.getPropertyValue("--shell-nav-body-scale-y")).toBe("1");
  });

  it("sayfa swipe'ında seçili kapsülü parmak ilerlemesine göre uzatıp taşır", () => {
    nav.pathname = "/discover";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);

    Object.defineProperty(navBar, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        right: 400,
        width: 400,
        top: 0,
        bottom: 64,
        height: 64,
      }),
    });
    tabLinks.forEach((link, index) => {
      Object.defineProperty(link, "getBoundingClientRect", {
        value: () => ({
          left: index * 100,
          right: (index + 1) * 100,
          width: 100,
          top: 0,
          bottom: 64,
          height: 64,
        }),
      });
    });
    window.dispatchEvent(new Event("resize"));

    window.dispatchEvent(
      new CustomEvent(PAGE_SWIPE_PROGRESS_EVENT, {
        detail: {
          fromHref: "/discover",
          toHref: "/favorites",
          progress: 0.5,
          phase: "drag",
        },
      }),
    );

    expect(navBar).toHaveAttribute("data-page-dragging", "true");
    expect(
      Number.parseFloat(navBar.style.getPropertyValue("--shell-nav-x")),
    ).toBe(54);
    expect(
      Number.parseFloat(navBar.style.getPropertyValue("--shell-nav-stretch")),
    ).toBeGreaterThan(1);

    window.dispatchEvent(
      new CustomEvent(PAGE_SWIPE_PROGRESS_EVENT, {
        detail: {
          fromHref: "/discover",
          toHref: "/favorites",
          progress: 0,
          phase: "settle",
        },
      }),
    );
    expect(navBar).toHaveAttribute("data-page-settling", "true");
    expect(
      Number.parseFloat(navBar.style.getPropertyValue("--shell-nav-x")),
    ).toBe(4);
  });
});
