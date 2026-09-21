import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useSaleCountdown } from './LimitedSale';
import { motionTokens } from '../motion/motionConfig';

// Slim sticky banner above the floating navbar. Reuses the same
// VITE_SALE_END_AT countdown as LimitedSale — no second timer, no reset.
export default function SaleBanner({ recede }) {
  const left = useSaleCountdown();
  const reduce = useReducedMotion();
  if (!left) return null;

  const time = left.days > 0
    ? `${left.days}d ${String(left.hours).padStart(2, '0')}h ${String(left.minutes).padStart(2, '0')}m`
    : `${String(left.hours).padStart(2, '0')}h ${String(left.minutes).padStart(2, '0')}m ${String(left.secs).padStart(2, '0')}s`;

  return (
    <motion.div
      className="sale-banner"
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: recede ? 0 : 1, y: recede ? -8 : 0 }}
      transition={{ duration: motionTokens.duration.normal, ease: motionTokens.ease.standard }}
      style={{ pointerEvents: recede ? 'none' : 'auto' }}
    >
      <Link to="/covers" className="sale-banner-link" tabIndex={recede ? -1 : undefined}>
        <span className="sale-banner-tag">LIMITED DROP</span>
        <span className="sale-banner-sep" aria-hidden="true">·</span>
        <span className="sale-banner-price">NPR 699</span>
        <span className="sale-banner-sep" aria-hidden="true">·</span>
        <span className="sale-banner-time" aria-live="polite">Ends in {time}</span>
        <span className="sale-banner-cta">Shop now <span aria-hidden="true">→</span></span>
      </Link>
    </motion.div>
  );
}
