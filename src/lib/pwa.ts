/**
 * PWA yardımcıları (istemci tarafı).
 */

/**
 * Uygulama ana ekrandan mı (standalone) açıldı?
 *
 * İki sinyal birleştirilir: standart `display-mode` media query'si ve iOS
 * Safari'nin kendi (resmî olmayan ama tüm sürümlerde bulunan) bayrağı.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // SAFETY: iOS Safari `navigator.standalone` bayrağını sağlar; bu alan
  // TypeScript'in DOM lib tiplerinde tanımlı değildir.
  const iosNavigator = window.navigator as unknown as {
    standalone?: boolean;
  };
  return iosNavigator.standalone === true;
}

/** iOS cihaz mı? */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ kendini macOS gibi tanıtır; dokunmatik nokta sayısıyla ayırt edilir.
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}
