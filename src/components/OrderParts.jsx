import { Money, StatusBadge } from './ui';
import { badgeLabel, orderHeadline, orderTimeline, PAYMENT_METHOD_LABELS, paymentStatusLabel } from '../utils/orderStatus';

const fmtDate = (value) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null);

/** Order number, placed date and the one status badge. */
export function OrderHeader({ order, as: Heading = 'h2' }) {
  return (
    <div className="order-header">
      <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <Heading style={{ margin: 0 }} data-testid="order-number">{order.order_number}</Heading>
        <StatusBadge status={order.status} label={badgeLabel(order)} />
      </div>
      <div className="muted small">Placed {fmtDate(order.placed_at)}</div>
    </div>
  );
}

/** Where the order stands, what happens next, and the status timeline. */
export function OrderStatusPanel({ order, children }) {
  const headline = orderHeadline(order);
  const timeline = orderTimeline(order);
  return (
    <section className={`card order-status-panel tone-${headline.tone}`} data-testid="order-status" data-kind={headline.kind} aria-labelledby="order-status-title">
      <h3 id="order-status-title">{headline.title}</h3>
      <p className="order-status-message" data-testid={order.status === 'cancelled' ? 'order-cancelled' : undefined}>{headline.message}</p>
      {headline.next && <p className="muted small order-status-next">{headline.next}</p>}
      {children}
      <ol className="order-timeline" aria-label="Order timeline">
        {timeline.map((entry) => (
          <li key={entry.key} className={`is-${entry.state}`} aria-current={entry.state === 'current' ? 'step' : undefined}>
            <span className="order-timeline-dot" aria-hidden="true" />
            <span className="order-timeline-label">{entry.label}</span>
            {entry.at && <span className="order-timeline-at">{fmtDate(entry.at)}</span>}
            {entry.state === 'upcoming' && <span className="sr-only"> (not yet)</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Items at order-time prices, totals from the order's own snapshot, and what is still due. */
export function OrderSummary({ order, renderItemExtra }) {
  const summary = order.payment_summary;
  const payment = order.paymentConfirmation;
  return (
    <div className="row order-detail-grid" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="card order-detail-items" style={{ flex: '1 1 340px' }}>
        <h4>Items</h4>
        {order.items.map((it, index) => (
          <div key={it.id ?? index} className="order-line">
            <div className="spread">
              <span>
                {it.product_name_snap} × {it.quantity}
                {it.model && <span className="order-line-model">{it.model}</span>}
              </span>
              <Money value={it.line_total} />
            </div>
            {renderItemExtra?.(it)}
          </div>
        ))}
        {(order.promoItems || []).map((p) => (
          <div key={`promo-${p.id}`} className="order-line">
            <div className="spread">
              <span>{p.name_snap} × {p.quantity}</span>
              <span style={{ color: 'var(--sage)' }}>FREE</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card order-detail-totals" style={{ flex: '0 0 280px' }}>
        <h4>Totals</h4>
        {order.campaign_name_snap && <p className="eyebrow" style={{ marginTop: 0 }}>{order.campaign_name_snap}</p>}
        <div className="spread"><span className="muted">Subtotal</span><Money value={order.subtotal_amount} /></div>
        {Number(order.bundle_discount_amount) > 0 && (
          <div className="spread"><span className="muted">Bundle discount</span><span className="nowrap">−<Money value={order.bundle_discount_amount} /></span></div>
        )}
        {Number(order.discount_amount) > 0 && (
          <div className="spread"><span className="muted">Coupon{order.coupon_code ? ` ${order.coupon_code}` : ''}</span><span className="nowrap">−<Money value={order.discount_amount} /></span></div>
        )}
        <div className="spread"><span className="muted">Delivery</span><Money value={order.shipping_amount} /></div>
        <div className="spread money-serif order-total"><span>Total</span><Money value={order.total_amount} /></div>
        {summary && order.status !== 'cancelled' && (
          <div className="order-due" data-testid="order-due">
            {payment && <div className="spread small"><span className="muted">Payment</span><span>{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</span></div>}
            {payment && <div className="spread small"><span className="muted">Payment status</span><span>{paymentStatusLabel(payment.status)}</span></div>}
            {summary.advance_paid > 0 && <div className="spread small"><span className="muted">Advance paid</span><Money value={summary.advance_paid} /></div>}
            <div className="spread"><span>{order.status === 'delivered' ? 'Collected on delivery' : 'To pay on delivery'}</span><strong><Money value={summary.remaining_cod} /></strong></div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Delivery details the audience is allowed to see (the tracker gets the area only). */
export function OrderDelivery({ order }) {
  const d = order.delivery;
  if (!d && !order.courier_destination_name) return null;
  return (
    <div className="card">
      <h4>Delivery</h4>
      <div className="muted small order-delivery">
        {d?.name && <div>{d.name}{d.phone ? `, ${d.phone}` : ''}</div>}
        {d?.lines?.length > 0 && <div>{d.lines.join(', ')}</div>}
        {d?.landmark && <div>Landmark: {d.landmark}</div>}
        {order.courier_destination_name && <div>ParcelMoover destination: {order.courier_destination_name}</div>}
      </div>
    </div>
  );
}
