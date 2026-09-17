import type { MouseEvent } from "react";

/** Dokunmatik cihaz mı? (masaüstünde fare ile metin seçimi bozulmasın) */
function isTouchDevice() {
 if (typeof window === "undefined") return false;
 return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Kabuk içindeki tıklamalarda tarayıcının "odağı görünür yap" kaydırmasını engeller.
 *
 * Tarayıcı, tıklanan/kodla odaklanan öğeyi görünür yapmak için en yakın kaydırma
 * alanını (sekme pane'i / SHELL.main) kendiliğinden kaydırıyor; ekrandan uzun kart
 * veya form alanlarında sayfa bu yüzden zıplıyor ("butona bastım, sayfa kaydı").
 * `mousedown` varsayılanını iptal etmek odaklanmayı engeller ama `click` event'i
 * ve butonun kendi işlevi çalışmaya devam eder.
 *
 * Klavye ile gezinme (Tab) ve metin girişlerine odaklanma (mobil klavye) etkilenmez;
 * bu yüzden input/textarea/select/label hedefleri serbest bırakılır.
 */
export function preventFocusScroll(event: MouseEvent<HTMLElement>) {
 if (!isTouchDevice()) return;
 const target = event.target as HTMLElement | null;
 if (
  target?.closest(
   "input, textarea, select, label, [contenteditable='true'], [contenteditable='']",
  )
 ) {
  return;
 }
 event.preventDefault();
}
