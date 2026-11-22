import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SwipePager, { type SwipeTab } from "./SwipePager";
import {
  PAGE_SWIPE_PROGRESS_EVENT,
  type PageSwipeProgress,
} from "./pageSwipeProgress";

const navigation = vi.hoisted(() => ({
  pathname: "/discover",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

const mountedTabs: string[] = [];
const recordTabRender = vi.hoisted(() => vi.fn());

function StatefulTab({ name }: { name: string }) {
  recordTabRender(name);
  const [value, setValue] = useState("");
  useEffect(() => {
    mountedTabs.push(name);
  }, [name]);

  return (
    <label>
      {name}
      <input
        aria-label={`${name} state`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  );
}

const tabs: SwipeTab[] = [
  { href: "/discover", content: <StatefulTab name="discover" /> },
  { href: "/favorites", content: <StatefulTab name="favorites" /> },
  { href: "/my-appointments", content: <StatefulTab name="appointments" /> },
  { href: "/profile", content: <StatefulTab name="profile" /> },
];

describe("SwipePager", () => {
  afterEach(() => {
    navigation.pathname = "/discover";
    navigation.push.mockClear();
    mountedTabs.length = 0;
    recordTabRender.mockClear();
  });

  it("ana sekmeleri aynı anda mount eder ve URL değişiminde state/scroll'u korur", () => {
    navigation.pathname = "/discover";
    const { container, rerender } = render(
      <SwipePager tabs={tabs} className="shell">
        <div>detail</div>
      </SwipePager>,
    );

    expect(mountedTabs).toEqual([
      "discover",
      "favorites",
      "appointments",
      "profile",
    ]);
    expect(recordTabRender).toHaveBeenCalledTimes(4);

    const favoritesInput = screen.getByLabelText("favorites state");
    fireEvent.change(favoritesInput, { target: { value: "seçili filtre" } });
    const renderCountAfterInteraction = recordTabRender.mock.calls.length;
    const discoverPane = container.querySelector("section")!
      .firstElementChild as HTMLElement;
    discoverPane.scrollTop = 320;

    navigation.pathname = "/b/ornek-isletme";
    rerender(
      <SwipePager tabs={tabs} className="shell">
        <div data-testid="business-detail">business detail</div>
      </SwipePager>,
    );
    expect(screen.getByTestId("business-detail")).toBeInTheDocument();

    navigation.pathname = "/favorites";
    rerender(
      <SwipePager tabs={tabs} className="shell">
        <div>detail</div>
      </SwipePager>,
    );

    expect(screen.getByLabelText("favorites state")).toHaveValue("seçili filtre");
    expect(container.querySelector("section")!.firstElementChild).toBe(
      discoverPane,
    );
    expect(discoverPane.scrollTop).toBe(320);
    expect(mountedTabs).toHaveLength(4);
    expect(recordTabRender).toHaveBeenCalledTimes(renderCountAfterInteraction);
  });

  it("parmak sürüklenirken sonraki mounted paneli track üzerinde canlı taşır", () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(max-width: 1023px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const { container } = render(
      <SwipePager tabs={tabs} className="shell">
        <div>detail</div>
      </SwipePager>,
    );
    const main = container.querySelector("main")!;
    Object.defineProperty(main, "clientWidth", { value: 400 });
    const track = container.querySelector(".swipe-pager-track") as HTMLDivElement;
    const progressEvents: PageSwipeProgress[] = [];
    const onProgress = (event: Event) => {
      progressEvents.push((event as CustomEvent<PageSwipeProgress>).detail);
    };
    window.addEventListener(PAGE_SWIPE_PROGRESS_EVENT, onProgress);

    const dispatchTouch = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, "touches", {
        value: [{ clientX, clientY }],
      });
      fireEvent(main, event);
    };

    dispatchTouch("touchstart", 300, 100);
    dispatchTouch("touchmove", 200, 100);

    expect(container.querySelectorAll("section")).toHaveLength(4);
    expect(track.style.transform).toContain("px");
    expect(track.style.transform).not.toContain("+ 0px");
    expect(progressEvents.at(-1)).toMatchObject({
      fromHref: "/discover",
      toHref: "/favorites",
      phase: "drag",
    });
    expect(progressEvents.at(-1)?.progress).toBeGreaterThan(0);

    dispatchTouch("touchend", 200, 100);
    window.removeEventListener(PAGE_SWIPE_PROGRESS_EVENT, onProgress);
    expect(navigation.push).toHaveBeenCalledWith("/favorites");
  });
});
