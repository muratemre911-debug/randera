/**
 * Sekmeler arası parmakla kaydırmalı geçiş yardımcıları.
 */

/**
 * Kaydırma tam bir sayfaya oturduysa o sayfanın indeksini döner.
 *
 * Kaydırma hâlâ arada bir yerdeyse (momentum / animasyon sürüyor) `null` döner;
 * böylece URL, parmağın geçtiği ara sayfalara zıplamaz.
 */
export function settledTabIndex(
 scrollLeft: number,
 pageWidth: number,
 count: number,
): number | null {
 if (pageWidth <= 0) return null;
 const position = scrollLeft / pageWidth;
 const nearest = Math.round(position);
 if (nearest < 0 || nearest >= count) return null;
 // snap oturması için küçük bir tolerans (yarım piksel yuvarlama farkı)
 return Math.abs(position - nearest) <= 0.02 ? nearest : null;
}

/**
 * Ray konumu olayı: pager kaydırılırken alt menüdeki aktiflik vurgusunun
 * parmakla eşzamanlı kayması için konum (sekme cinsinden, ondalıklı) yayınlanır.
 */
export const TAB_SCROLL_EVENT = "randera:tab-scroll";

/** Ray kaydırma konumunu alt menüye bildirir (0 = ilk sekme, 1.5 = ikisi arası) */
export function emitTabScroll(position: number) {
 window.dispatchEvent(new CustomEvent(TAB_SCROLL_EVENT, { detail: position }));
}

/** Alt menü ray konumunu dinler; abonelikten çıkma fonksiyonu döner */
export function onTabScroll(handler: (position: number) => void) {
 const listener = (event: Event) =>
  handler((event as CustomEvent<number>).detail);
 window.addEventListener(TAB_SCROLL_EVENT, listener);
 return () => window.removeEventListener(TAB_SCROLL_EVENT, listener);
}
