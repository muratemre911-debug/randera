"use client";

import { useEffect } from "react";
import { triggerHapticFeedback } from "@/lib/haptics";

const INTERACTIVE_SELECTOR =
  'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], a[href]';

export default function HapticFeedback() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const control = target.closest(INTERACTIVE_SELECTOR);
      if (!control || control.closest("[data-no-haptic]")) return;
      triggerHapticFeedback();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <input
      type="checkbox"
      role="switch"
      aria-hidden="true"
      tabIndex={-1}
      data-haptic-switch
      className="haptic-switch-input"
    />
  );
}
