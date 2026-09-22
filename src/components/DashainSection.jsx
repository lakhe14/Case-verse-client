import { Link } from 'react-router-dom';
import { useCampaign } from '../hooks/useCampaign';
import { Reveal } from '../motion/MotionPrimitives';

export default function DashainSection() {
  const campaign = useCampaign();
  if (!campaign?.active) return null;

  const regular = campaign.required_case_quantity * 699;
  const save = regular - campaign.bundle_price;

  return (
    <section className="home-section dashain-section">
      <Reveal className="dashain-section-inner">
        <p className="eyebrow">DASHAIN DROP</p>
        <h2>3 items.<br />One Dashain price.</h2>
        <p className="dashain-section-copy">
          Choose any {campaign.required_case_quantity} eligible iPhone cases + a FREE suction phone holder.
        </p>
        <p className="dashain-section-price">NPR {campaign.bundle_price.toLocaleString()}</p>
        <p className="dashain-section-compare">
          Regular case total NPR {regular.toLocaleString()} — save NPR {save.toLocaleString()}
        </p>
        <Link to="/covers" className="btn">Build your bundle <span aria-hidden="true">→</span></Link>
      </Reveal>
    </section>
  );
}
