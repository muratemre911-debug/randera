/**
 * Leaflet harita kapsayıcısını, odaklanırken sayfayı kaydırmayacak şekilde sarar.
 *
 * Leaflet, haritaya ya da zoom kontrollerine tıklanınca `map.getContainer().focus()`
 * çağırıyor (Control._refocusOnMap ve Keyboard._onMouseDown). Tarayıcı da odaklanan
 * öğeyi görünür yapmak için en yakın kaydırma alanını (sekme pane'i / SHELL.main)
 * kaydırıyor; Leaflet yalnızca pencere kaydırmasını geri aldığı için iç kaydırma
 * alanında sayfa zıplıyor. `preventScroll` bunu tamamen engeller.
 */
export function preventMapFocusScroll(container: HTMLElement) {
 const focus = container.focus.bind(container);
 container.focus = (options?: FocusOptions) =>
  focus({ preventScroll: true, ...options });
}
