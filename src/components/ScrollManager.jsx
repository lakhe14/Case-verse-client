import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const HASH_RETRY_FRAMES = 30;
const SETTLE_DELAYS_MS = [150, 400, 900, 1600];

/**
 * Route scroll behaviour for the whole app (BrowserRouter has no built-in
 * ScrollRestoration):
 * - a link or redirect to a different pathname starts at the top;
 * - a URL with a #hash scrolls to that element once it has rendered;
 * - back/forward (POP) is left to the browser's own scroll restoration;
 * - query-only changes (filters, pagination) keep the current position.
 */
export default function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);

  useLayoutEffect(() => {
    const pathChanged = previousPath.current !== pathname;
    previousPath.current = pathname;

    if (hash) {
      let frame = 0;
      let handle;
      const timers = [];
      const id = decodeURIComponent(hash.slice(1));
      let placedAt = null;
      const align = () => {
        const target = document.getElementById(id);
        if (!target) return false;
        target.scrollIntoView();
        placedAt = window.scrollY;
        return true;
      };
      const tryScroll = () => {
        if (align()) {
          // Content above the target (images, API data) can still load and push
          // it down: re-align a few times, unless the visitor has scrolled since.
          for (const delay of SETTLE_DELAYS_MS) {
            timers.push(setTimeout(() => { if (window.scrollY === placedAt) align(); }, delay));
          }
          return;
        }
        if ((frame += 1) < HASH_RETRY_FRAMES) handle = requestAnimationFrame(tryScroll);
      };
      tryScroll();
      return () => { cancelAnimationFrame(handle); timers.forEach(clearTimeout); };
    }
    if (navigationType !== 'POP' && pathChanged) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    return undefined;
  }, [pathname, hash, key, navigationType]);

  return null;
}
