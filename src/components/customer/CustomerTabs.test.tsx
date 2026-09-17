import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import CustomerTabs, { type CustomerTab } from "./CustomerTabs";
import { onTabScroll } from "@/lib/tabSwipe";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/discover" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

const tabs: CustomerTab[] = [
  { href: "/discover", Page: () => <div>keşfet sayfası</div> },
  { href: "/favorites", Page: () => <div>favoriler sayfası</div> },
  { href: "/my-appointments", Page: () => <div>randevular sayfası</div> },
  { href: "/profile", Page: () => <div>profil sayfası</div> },
];

/** jsdom'da ray genişliğini ve kaydırma konumunu taklit eder */
function stubTrack(container: HTMLElement, pageWidth: number) {
  const track = container.querySelector<HTMLDivElement>("main > div")!;
  let scrollLeft = 0;
  Object.defineProperty(track, "clientWidth", {
    value: pageWidth,
    configurable: true,
  });
  Object.defineProperty(track, "scrollLeft", {
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
    configurable: true,
  });
  track.scrollTo = vi.fn() as unknown as typeof track.scrollTo;
  return track;
}

describe("CustomerTabs", () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.pathname = "/discover";
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("görünen sekmeyi ve yanındaki komşuyu yükler, uzaktakini boş bırakır", async () => {
    const { container, getByText, queryByText } = render(
      <CustomerTabs tabs={tabs} />,
    );
    stubTrack(container, 375);

    expect(getByText("keşfet sayfası")).toBeInTheDocument();
    await waitFor(() =>
      expect(getByText("favoriler sayfası")).toBeInTheDocument(),
    );
    expect(queryByText("profil sayfası")).not.toBeInTheDocument();
    expect(queryByText("randevular sayfası")).not.toBeInTheDocument();
  });

  it("kaydırma bir sekmeye oturunca o sekmenin URL'ini açar", () => {
    vi.useFakeTimers();
    const { container } = render(<CustomerTabs tabs={tabs} />);
    const track = stubTrack(container, 375);

    act(() => {
      track.scrollLeft = 750; // tam 2. sekme
      fireEvent.scroll(track);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(nav.push).toHaveBeenCalledWith("/my-appointments");
  });

  it("kaydırma iki sekme arasında kalırken URL'i değiştirmez", () => {
    vi.useFakeTimers();
    const { container } = render(<CustomerTabs tabs={tabs} />);
    const track = stubTrack(container, 375);
    const positions: number[] = [];
    const unsubscribe = onTabScroll((position) => positions.push(position));

    act(() => {
      track.scrollLeft = 560; // 1,49 sekme: momentum sürüyor
      fireEvent.scroll(track);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(nav.push).not.toHaveBeenCalled();
    // Alt menü vurgusu parmağın konumunu (ondalıklı) almış olmalı
    expect(positions[positions.length - 1]).toBeCloseTo(560 / 375);
    unsubscribe();
  });
});
