import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import HapticFeedback from "./HapticFeedback";
import { triggerHapticFeedback } from "@/lib/haptics";

const navigatorKeys = [
  "userAgent",
  "platform",
  "maxTouchPoints",
  "vibrate",
] as const;

const originalNavigatorProperties = Object.fromEntries(
  navigatorKeys.map((key) => [
    key,
    Object.getOwnPropertyDescriptor(navigator, key),
  ]),
);

function setNavigatorProperty(key: string, value: unknown) {
  Object.defineProperty(navigator, key, {
    configurable: true,
    value,
  });
}

describe("HapticFeedback", () => {
  afterEach(() => {
    vi.useRealTimers();
    for (const key of navigatorKeys) {
      const descriptor = originalNavigatorProperties[key];
      if (descriptor) {
        Object.defineProperty(navigator, key, descriptor);
      } else {
        Reflect.deleteProperty(navigator, key);
      }
    }
  });

  it("desteklenen cihazlarda buton tıklamasında kısa titreşim ister", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const vibrate = vi.fn(() => true);
    setNavigatorProperty("vibrate", vibrate);

    render(
      <>
        <HapticFeedback />
        <button type="button">Kaydet</button>
        <a href="/dashboard/takvim">Takvim</a>
      </>,
    );

    fireEvent.click(document.querySelector("button")!);
    vi.advanceTimersByTime(61);
    fireEvent.click(document.querySelector("a")!);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(vibrate).toHaveBeenNthCalledWith(2, 10);
  });

  it("iOS Safari'de görünmez switch input'unu tetikler", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:01:00Z"));
    setNavigatorProperty(
      "userAgent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    setNavigatorProperty("platform", "iPhone");
    setNavigatorProperty("maxTouchPoints", 5);
    setNavigatorProperty("vibrate", undefined);

    const { container } = render(<HapticFeedback />);
    const switchInput = container.querySelector<HTMLInputElement>(
      "[data-haptic-switch]",
    )!;

    triggerHapticFeedback();

    expect(switchInput.checked).toBe(true);
  });
});
