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

function mockMobileViewport() {
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
}

function mockNavGeometry(
  navBar: HTMLDivElement,
  tabLinks: HTMLElement[],
  itemWidth = 100,
) {
  Object.defineProperty(navBar, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: 0,
      right: itemWidth * tabLinks.length,
      width: itemWidth * tabLinks.length,
      top: 0,
      bottom: 64,
      height: 64,
    }),
  });
  tabLinks.forEach((link, index) => {
    Object.defineProperty(link, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: index * itemWidth,
        right: (index + 1) * itemWidth,
        width: itemWidth,
        top: 0,
        bottom: 64,
        height: 64,
      }),
    });
  });
  window.dispatchEvent(new Event("resize"));
}

function dispatchPointer(
  target: Element,
  type: string,
  values: Record<string, unknown>,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { value });
  }
  fireEvent(target, event);
}

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

  it("mobil çubuk üzerinde sürükleyince hedef sekmeye geçer ve çubuğu esnetmez", () => {
    nav.pathname = "/discover";
    mockMobileViewport();

    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);
    mockNavGeometry(navBar, tabLinks);

    dispatchPointer(tabLinks[0], "pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 25,
      clientY: 20,
    });
    dispatchPointer(navBar, "pointermove", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 220,
      clientY: 20,
    });

    expect(navBar).toHaveAttribute("data-dragging", "true");
    expect(
      Number.parseFloat(navBar.style.getPropertyValue("--shell-nav-x")),
    ).toBe(174);
    expect(navBar.style.getPropertyValue("--shell-nav-stretch")).toBe("1");
    expect(navBar.style.getPropertyValue("--shell-nav-body-scale-x")).toBe("");
    expect(navBar.style.getPropertyValue("--shell-nav-body-scale-y")).toBe("");
    expect(navBar.style.getPropertyValue("--shell-nav-body-origin")).toBe("");

    dispatchPointer(navBar, "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 220,
      clientY: 20,
    });

    expect(nav.routerPush).toHaveBeenCalledWith("/my-appointments");
    expect(navBar).not.toHaveAttribute("data-dragging");
  });

  it("sekme değiştirip geri dönünce gösterge URL ile eşleşen sekmede kalır", () => {
    nav.pathname = "/discover";
    mockMobileViewport();

    const { container, rerender } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);
    mockNavGeometry(navBar, tabLinks);

    dispatchPointer(tabLinks[0], "pointerdown", {
      pointerId: 20,
      pointerType: "touch",
      isPrimary: true,
      clientX: 25,
      clientY: 20,
    });
    dispatchPointer(navBar, "pointermove", {
      pointerId: 20,
      pointerType: "touch",
      isPrimary: true,
      clientX: 250,
      clientY: 20,
    });
    dispatchPointer(navBar, "pointerup", {
      pointerId: 20,
      pointerType: "touch",
      isPrimary: true,
      clientX: 250,
      clientY: 20,
    });
    expect(nav.routerPush).toHaveBeenCalledWith("/my-appointments");

    nav.pathname = "/my-appointments";
    rerender(<CustomerBottomNav tabs={tabs} />);
    expect(tabLinks[2]).toHaveAttribute("aria-current", "page");
    expect(navBar.style.getPropertyValue("--shell-nav-x")).toBe("204px");

    nav.pathname = "/discover";
    rerender(<CustomerBottomNav tabs={tabs} />);
    expect(tabLinks[0]).toHaveAttribute("aria-current", "page");
    expect(tabLinks[2]).not.toHaveAttribute("aria-current");
    expect(navBar.style.getPropertyValue("--shell-nav-x")).toBe("4px");
  });

  it("küçük parmak titremesinde (<= 8px) sürüklemeyi başlatmaz", () => {
    nav.pathname = "/discover";
    mockMobileViewport();

    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);
    mockNavGeometry(navBar, tabLinks);
    const initialX = navBar.style.getPropertyValue("--shell-nav-x");

    dispatchPointer(tabLinks[0], "pointerdown", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 50,
      clientY: 20,
    });
    dispatchPointer(navBar, "pointermove", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 56,
      clientY: 22,
    });

    expect(navBar).not.toHaveAttribute("data-dragging");
    expect(navBar.style.getPropertyValue("--shell-nav-x")).toBe(initialX);

    dispatchPointer(navBar, "pointerup", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 56,
      clientY: 22,
    });
    expect(nav.routerPush).not.toHaveBeenCalled();
  });

  it("sürükleme ortasında pointercancel gelince aktif sekmeye döner ve gezinmez", () => {
    nav.pathname = "/discover";
    mockMobileViewport();

    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);
    mockNavGeometry(navBar, tabLinks);

    dispatchPointer(tabLinks[0], "pointerdown", {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 25,
      clientY: 20,
    });
    dispatchPointer(navBar, "pointermove", {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 240,
      clientY: 20,
    });
    expect(navBar).toHaveAttribute("data-dragging", "true");

    dispatchPointer(navBar, "pointercancel", {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: 240,
      clientY: 20,
    });

    expect(navBar).not.toHaveAttribute("data-dragging");
    expect(
      Number.parseFloat(navBar.style.getPropertyValue("--shell-nav-x")),
    ).toBe(4);
    expect(nav.routerPush).not.toHaveBeenCalled();
  });

  it("pencere boyutu değişince gösterge konum ve genişliğini yeniden hizalar", () => {
    nav.pathname = "/favorites";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    const tabLinks = links(container);

    mockNavGeometry(navBar, tabLinks, 100);
    expect(navBar.style.getPropertyValue("--shell-nav-x")).toBe("104px");
    expect(navBar.style.getPropertyValue("--shell-nav-width")).toBe("92px");

    mockNavGeometry(navBar, tabLinks, 80);
    expect(navBar.style.getPropertyValue("--shell-nav-x")).toBe("84px");
    expect(navBar.style.getPropertyValue("--shell-nav-width")).toBe("72px");
  });

  it("kenar swipe'ında (toHref null) alt çubukta settle titremesi tetiklemez", () => {
    nav.pathname = "/discover";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    mockNavGeometry(navBar, links(container));

    window.dispatchEvent(
      new CustomEvent(PAGE_SWIPE_PROGRESS_EVENT, {
        detail: {
          fromHref: "/discover",
          toHref: null,
          progress: 0,
          phase: "drag",
        },
      }),
    );

    expect(navBar).not.toHaveAttribute("data-page-dragging");
    expect(navBar).not.toHaveAttribute("data-page-settling");
  });

  it("sayfa swipe'ında seçili kapsülü parmak ilerlemesine göre uzatıp taşır", () => {
    nav.pathname = "/discover";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    mockNavGeometry(navBar, links(container));

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

  it("sayfa swipe commit'inde gösterge sayfayla aynı sürede hedefe kayar", () => {
    nav.pathname = "/discover";
    const { container } = render(<CustomerBottomNav tabs={tabs} />);
    const navBar = container.querySelector(
      ".shell-bottomnav-inner",
    ) as HTMLDivElement;
    mockNavGeometry(navBar, links(container));

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
    window.dispatchEvent(
      new CustomEvent(PAGE_SWIPE_PROGRESS_EVENT, {
        detail: {
          fromHref: "/discover",
          toHref: "/favorites",
          progress: 1,
          phase: "commit",
        },
      }),
    );

    expect(navBar).toHaveAttribute("data-page-committing", "true");
    expect(navBar).not.toHaveAttribute("data-page-dragging");
    expect(
      Number.parseFloat(navBar.style.getPropertyValue("--shell-nav-x")),
    ).toBe(104);
  });
});
