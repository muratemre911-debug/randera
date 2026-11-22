const HAPTIC_SWITCH_SELECTOR = "[data-haptic-switch]";
const HAPTIC_DEBOUNCE_MS = 60;

let lastHapticAt = 0;

function isIOSSafari() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA)/i.test(userAgent);

  return isIOS && isSafari;
}

/** Hafif dokunsal bildirim: Vibration API, iOS Safari'de gizli switch fallback'i. */
export function triggerHapticFeedback() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  const now = Date.now();
  if (now - lastHapticAt < HAPTIC_DEBOUNCE_MS) return;
  lastHapticAt = now;

  if (typeof navigator.vibrate === "function") {
    try {
      if (navigator.vibrate(10)) return;
    } catch {
      // API mevcut olsa da cihaz/tarayıcı titreşimi reddedebilir.
    }
  }

  if (isIOSSafari()) {
    document
      .querySelector<HTMLInputElement>(HAPTIC_SWITCH_SELECTOR)
      ?.click();
  }
}
