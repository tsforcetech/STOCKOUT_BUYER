import * as React from "react";

/**
 * Pre-launch cover. While on, the public home page ("/") shows the "launching soon" cover; the rest of the site
 * stays reachable for testing via the small "Explore preview" link, which remembers the choice on this device.
 * `?preview=1` turns preview on, `?cover=1` shows the cover again. Turn the cover off at launch with
 * VITE_LAUNCH_COVER=off in the deploy workflow.
 */
export const LAUNCH_COVER = import.meta.env.VITE_LAUNCH_COVER !== "off";
export const CONTACT_EMAIL = "info@stockoutme.com";
const KEY = "stockout.preview";

function readPreview(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has("cover")) localStorage.removeItem(KEY);
    else if (q.has("preview")) localStorage.setItem(KEY, "1");
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether this visitor sees the cover, and a way to step past it. */
export function useLaunchCover(): { showCover: boolean; explore: () => void } {
  const [preview, setPreview] = React.useState(readPreview);
  const explore = React.useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: preview lasts for this visit only */
    }
    setPreview(true);
    window.scrollTo?.({ top: 0 });
  }, []);
  return { showCover: LAUNCH_COVER && !preview, explore };
}
