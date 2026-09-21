import { useEffect, useState } from 'react';
import SalePrice from './SalePrice';

function remaining(endAt) { const seconds = Math.max(0, Math.floor((new Date(endAt).getTime() - Date.now()) / 1000)); return { seconds, days: Math.floor(seconds / 86400), hours: Math.floor((seconds % 86400) / 3600), minutes: Math.floor((seconds % 3600) / 60), secs: seconds % 60 }; }
export default function LimitedSale() {
  const endAt = import.meta.env.VITE_SALE_END_AT;
  const [left, setLeft] = useState(() => endAt ? remaining(endAt) : null);
  useEffect(() => { if (!endAt || Number.isNaN(new Date(endAt).getTime())) return undefined; const update = () => setLeft(remaining(endAt)); update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer); }, [endAt]);
  if (!left || left.seconds <= 0) return null;
  return <aside className="limited-sale" aria-label="Limited-time offer"><div><p className="eyebrow">LIMITED-TIME OFFER</p><strong>Premium covers on sale</strong><SalePrice price={699} compareAt={999} compact /></div><div className="sale-countdown" aria-live="polite"><span>Ends in</span><b>{String(left.days).padStart(2, '0')}d {String(left.hours).padStart(2, '0')}h {String(left.minutes).padStart(2, '0')}m {String(left.secs).padStart(2, '0')}s</b></div></aside>;
}
