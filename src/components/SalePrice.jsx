import { Money } from './ui';

export function discountPercent(price, compareAt) {
  const sale = Number(price || 0);
  const original = Number(compareAt || 0);
  return original > sale && sale > 0 ? Math.round(((original - sale) / original) * 100) : null;
}

export default function SalePrice({ price, compareAt, compact = false }) {
  const percent = discountPercent(price, compareAt);
  return <span className={`sale-price-group${compact ? ' is-compact' : ''}`}><span className="sale-price"><Money value={price} /></span>{percent && <><span className="original-price"><Money value={compareAt} /></span><span className="discount-badge">{percent}% OFF</span></>}</span>;
}
