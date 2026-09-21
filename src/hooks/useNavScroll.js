import { useEffect, useRef, useState } from 'react';

// Single scroll listener shared by the navbar and sale banner: tracks the
// compact ("scrolled") state and a brief downward-scroll recede signal,
// throttled to one measurement per animation frame.
export function useNavScroll(compactAt = 12, recedeAt = 140) {
  const [scrolled, setScrolled] = useState(false);
  const [recede, setRecede] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const measure = () => {
      const y = window.scrollY;
      setScrolled(y > compactAt);
      if (y > recedeAt && y > lastY.current) setRecede(true);
      else if (y <= recedeAt || y < lastY.current) setRecede(false);
      lastY.current = y;
      ticking.current = false;
    };
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [compactAt, recedeAt]);

  return { scrolled, recede };
}
