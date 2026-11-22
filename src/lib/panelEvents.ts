"use client";

export type PanelChange = "appointments" | "services" | "staff";

const CHANGE_EVENT = "randera:panel-data-changed";

export function notifyPanelChange(change: PanelChange) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PanelChange>(CHANGE_EVENT, { detail: change }));
}

export function subscribePanelChanges(
  changes: PanelChange[],
  callback: () => void,
) {
  const listener = (event: Event) => {
    if (changes.includes((event as CustomEvent<PanelChange>).detail)) {
      callback();
    }
  };
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
