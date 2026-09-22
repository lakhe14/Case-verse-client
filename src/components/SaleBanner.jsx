import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useCampaignCountdown } from '../hooks/useCampaign';
import { motionTokens } from '../motion/motionConfig';

// Slim sticky banner above the floating navbar. Shares the Dashain campaign
// fetch/countdown with LimitedSale and the homepage section — one server
// window, ticked locally, never a second source of truth.
export default function SaleBanner({ recede }) {
  const { campaign, left } = useCampaignCountdown();
  const reduce = useReducedMotion();
  if (!campaign?.active || !left) return null;

  const time = left.days > 0
    ? `${left.days}d ${String(left.hours).padStart(2, '0')}h`
    : `${String(left.hours).padStart(2, '0')}h ${String(left.minutes).padStart(2, '0')}m`;

  return (
    <motion.div
      className="sale-banner"
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: recede ? 0 : 1, y: recede ? -8 : 0 }}
      transition={{ duration: motionTokens.duration.normal, ease: motionTokens.ease.standard }}
      style={{ pointerEvents: recede ? 'none' : 'auto' }}
    >
      <Link
        to="/covers"
        className="sale-banner-link"
        tabIndex={recede ? -1 : undefined}
        aria-label={`Dashain Trio Offer: 2 cases plus a free suction holder for NPR ${campaign.bundle_price.toLocaleString()}, ${left.days} day${left.days === 1 ? '' : 's'} left`}
      >
        <span className="sale-banner-tag">DASHAIN TRIO</span>
        <span className="sale-banner-sep sale-banner-sep--detail" aria-hidden="true">·</span>
        <span className="sale-banner-detail">2 cases + free holder</span>
        <span className="sale-banner-sep" aria-hidden="true">·</span>
        <span className="sale-banner-price">NPR {campaign.bundle_price.toLocaleString()}</span>
        <span className="sale-banner-sep" aria-hidden="true">·</span>
        <span className="sale-banner-time" aria-hidden="true">{time} left</span>
        <span className="sale-banner-sep sale-banner-sep--cta" aria-hidden="true">·</span>
        <span className="sale-banner-cta">Shop offer <span aria-hidden="true">→</span></span>
      </Link>
    </motion.div>
  );
}
