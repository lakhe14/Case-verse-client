import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import { guestCheckout } from '../api/endpoints';
import { Spinner, ErrorText, Money, StatusBadge } from '../components/ui';
import PaymentConfirmation from '../components/PaymentConfirmation';
import usePageMeta from '../hooks/usePageMeta';

export default function GuestOrder() {
  const { token } = useParams();
  const { data, loading, error, reload } = useAsync(() => guestCheckout.get(token), [token]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  usePageMeta('Your order', 'Track your CaseVerse order and payment.');

  if (loading) return <Spinner />;
  if (error) {
    return (
      <div className="col" style={{ maxWidth: '60ch' }}>
        <h1>We couldn't find that order</h1>
        <p className="muted">This link may be mistyped, or the order may no longer be available.</p>
        <Link to="/" className="btn sm">Back to CaseVerse</Link>
      </div>
    );
  }
  const o = data?.data;
  if (!o) return null;

  const canCancel = o.status === 'pending' && (!o.paymentConfirmation || ['pending', 'proof_uploaded', 'rejected', 'cod_pending'].includes(o.paymentConfirmation.status));
  const cancelOrder = async () => {
    setCancelBusy(true); setCancelError(null);
    try { await guestCheckout.cancel(token); setCancelOpen(false); reload(); }
    catch (err) { setCancelError(err); }
    finally { setCancelBusy(false); }
  };

  return (
    <div className="col">
      <div className="order-detail-actions"><Link to="/" className="muted small">Continue shopping</Link>{canCancel && <button className="btn danger sm" onClick={() => setCancelOpen(true)}>Cancel order</button>}</div>
      <div className="spread">
        <h2 style={{ margin: 0 }}>{o.order_number}</h2>
        <StatusBadge status={o.status} />
      </div>
      <div className="muted small">Placed {new Date(o.placed_at).toLocaleString()}</div>
      <p className="muted small">
        Bookmark this page — it's the only way to check your order. It was also shown once when you placed the order.
      </p>

      {o.paymentConfirmation && <PaymentConfirmation order={o} guestToken={token} onUpdated={reload} />}

      {o.status === 'cancelled' && <div className="alert ok">This order was cancelled. <Link to="/covers">Shop other covers</Link>.</div>}

      <div className="row order-detail-grid" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card order-detail-items" style={{ flex: '1 1 340px' }}>
          <h4>Items</h4>
          {o.items.map((it) => (
            <div key={it.id} style={{ borderTop: '1px solid var(--brass-line-soft)', paddingTop: 8, marginTop: 8 }}>
              <div className="spread">
                <span>{it.product_name_snap} × {it.quantity}</span>
                <Money value={it.line_total} />
              </div>
              <div className="muted small">{it.sku_snap}</div>
            </div>
          ))}
          {(o.promoItems || []).map((p) => (
            <div key={p.id} style={{ borderTop: '1px solid var(--brass-line-soft)', paddingTop: 8, marginTop: 8 }}>
              <div className="spread">
                <span>{p.name_snap} × {p.quantity}</span>
                <span style={{ color: 'var(--sage)' }}>FREE</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card order-detail-totals" style={{ flex: '0 0 260px' }}>
          <h4>Totals</h4>
          {o.campaign_name_snap && <p className="eyebrow" style={{ marginTop: 0 }}>{o.campaign_name_snap}</p>}
          <div className="spread"><span className="muted">Subtotal</span><Money value={o.subtotal_amount} /></div>
          {Number(o.bundle_discount_amount) > 0 && (
            <div className="spread">
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>Bundle discount</span>
              <span style={{ whiteSpace: 'nowrap' }}>−<Money value={o.bundle_discount_amount} /></span>
            </div>
          )}
          <div className="spread"><span className="muted">Shipping</span><Money value={o.shipping_amount} /></div>
          {o.courier_destination_name && <div className="spread small"><span className="muted">ParcelMoover destination</span><span>{o.courier_destination_name}</span></div>}
          <div className="spread money-serif" style={{ fontSize: '1.1rem', borderTop: '1px solid var(--brass-line)', paddingTop: 10, marginTop: 4 }}>
            <span>Total</span><Money value={o.total_amount} />
          </div>
        </div>
      </div>

      <div className="card">
        <h4>Tracking</h4>
        <ul className="timeline">
          {(o.statusHistory || []).map((h) => (
            <li key={h.id}>
              <strong style={{ fontWeight: 500, textTransform: 'capitalize' }}>{h.status}</strong>
              <div className="muted small">{new Date(h.changed_at).toLocaleString()}</div>
              {h.note && <div className="muted small">{h.note}</div>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h4>Delivery address</h4>
        <div className="muted small">
          {o.guest_name}, {o.guest_phone}<br />
          {o.guest_area}, {o.guest_municipality}, {o.guest_district}, {o.guest_province}
          {o.guest_landmark ? <><br />Landmark: {o.guest_landmark}</> : null}
        </div>
      </div>

      {cancelOpen && (
        <div className="customer-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
          <div className="customer-cancel-dialog">
            <h2 id="cancel-order-title">Cancel this order?</h2>
            <p>Your reserved items will be released and you can return to the shop to choose another design or model.</p>
            {o.paymentConfirmation?.status === 'proof_uploaded' && <p className="alert error">A payment proof has already been submitted. Cancelling will make it ineligible for review.</p>}
            <ErrorText error={cancelError} />
            <div className="row">
              <button className="btn subtle" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Keep order</button>
              <button className="btn danger" onClick={cancelOrder} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Cancel order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
