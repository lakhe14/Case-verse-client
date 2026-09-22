import { Link } from 'react-router-dom';
import { useCampaignCountdown } from '../hooks/useCampaign';

export default function LimitedSale() {
  const { campaign, left } = useCampaignCountdown();
  if (!campaign?.active || !left) return null;

  return (
    <aside
      className="limited-sale"
      aria-label={`Dashain Trio Offer — ends in ${left.days} day${left.days === 1 ? '' : 's'}`}
    >
      <div>
        <p className="eyebrow">DASHAIN TRIO OFFER</p>
        <strong>2 iPhone cases + FREE suction holder — NPR {campaign.bundle_price.toLocaleString()}</strong>
        <Link to="/covers" className="small">Build your bundle</Link>
      </div>
      <div className="sale-countdown" aria-hidden="true">
        <span>Ends in</span>
        <b>
          {String(left.days).padStart(2, '0')}d {String(left.hours).padStart(2, '0')}h{' '}
          {String(left.minutes).padStart(2, '0')}m {String(left.secs).padStart(2, '0')}s
        </b>
      </div>
    </aside>
  );
}
