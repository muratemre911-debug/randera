export const PAGE_SWIPE_PROGRESS_EVENT = "randera:page-swipe-progress";

export interface PageSwipeProgress {
  fromHref: string;
  toHref: string | null;
  progress: number;
  phase: "drag" | "settle" | "commit";
}

export function publishPageSwipeProgress(detail: PageSwipeProgress) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PageSwipeProgress>(PAGE_SWIPE_PROGRESS_EVENT, { detail }),
  );
}
