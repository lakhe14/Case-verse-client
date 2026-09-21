import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { orders as api, reviews as reviewsApi } from '../../api/endpoints';
import { Spinner, ErrorText, Money, StatusBadge, Stars } from '../../components/ui';
import PaymentConfirmation from '../../components/PaymentConfirmation';

function ReviewForm({ productId, onDone }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await reviewsApi.create({ product_id: productId, rating: Number(rating), title, body });
      onDone();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ marginTop: 8 }}>
      <ErrorText error={err} />
      <select value={rating} onChange={(e) => setRating(e.target.value)} style={{ width: 120 }}>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>
        ))}
      </select>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea placeholder="Your review" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn sm" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button>
    </form>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => api.getMine(id), [id]);
  const [reviewing, setReviewing] = useState(null);
  const [reviewed, setReviewed] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorText error={error} />;
  const o = data?.data;
  if (!o) return null;

  const canReview = o.status === 'delivered';
  const canCancel = o.status === 'pending' && (!o.paymentConfirmation || ['pending', 'proof_uploaded', 'rejected', 'cod_pending'].includes(o.paymentConfirmation.status));
  const cancelOrder = async () => { setCancelBusy(true); setCancelError(null); try { await api.cancelMine(o.id); setCancelOpen(false); reload(); } catch (err) { setCancelError(err); } finally { setCancelBusy(false); } };

  return (
    <div className="col">
      <div className="order-detail-actions"><Link to="/account/orders" className="muted small">All orders</Link><Link to="/covers" className="muted small">Continue shopping</Link>{canCancel && <button className="btn danger sm" onClick={() => setCancelOpen(true)}>Cancel order</button>}</div>
      <div className="spread">
        <h2 style={{ margin: 0 }}>{o.order_number}</h2>
        <StatusBadge status={o.status} />
      </div>
      <div className="muted small">Placed {new Date(o.placed_at).toLocaleString()}</div>

      {o.paymentConfirmation && <PaymentConfirmation order={o} onUpdated={reload} />}

      {o.status === 'cancelled' && <div className="alert ok">This order was cancelled. <Link to="/covers">Shop other covers</Link> or <Link to="/account/orders">view your orders</Link>.</div>}

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
              {canReview && it.variant?.product?.id && !reviewed.includes(it.id) && (
                reviewing === it.id ? (
                  <ReviewForm
                    productId={it.variant.product.id}
                    onDone={() => { setReviewed((r) => [...r, it.id]); setReviewing(null); }}
                  />
                ) : (
                  <button className="btn ghost sm" onClick={() => setReviewing(it.id)}>Write a review</button>
                )
              )}
              {reviewed.includes(it.id) && <span className="badge approved">Review submitted</span>}
            </div>
          ))}
        </div>

        <div className="card order-detail-totals" style={{ flex: '0 0 260px' }}>
          <h4>Totals</h4>
          <div className="spread"><span className="muted">Subtotal</span><Money value={o.subtotal_amount} /></div>
          {Number(o.bundle_discount_amount) > 0 && (
            <div className="spread">
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>Bundle discount</span>
              <span style={{ whiteSpace: 'nowrap' }}>−<Money value={o.bundle_discount_amount} /></span>
            </div>
          )}
          <div className="spread"><span className="muted">Discount</span><Money value={o.discount_amount} /></div>
          <div className="spread"><span className="muted">Shipping</span><Money value={o.shipping_amount} /></div>
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
      {cancelOpen && <div className="customer-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title"><div className="customer-cancel-dialog"><h2 id="cancel-order-title">Cancel this order?</h2><p>Your reserved items will be released and you can return to the shop to choose another design or model.</p>{o.paymentConfirmation?.status === 'proof_uploaded' && <p className="alert error">A payment proof has already been submitted. Cancelling will make it ineligible for review.</p>}<ErrorText error={cancelError} /><div className="row"><button className="btn subtle" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Keep order</button><button className="btn danger" onClick={cancelOrder} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Cancel order'}</button></div></div></div>}

      <div className="card">
        <h4>Delivery address</h4>
        <div className="muted small">
          {o.shippingAddress?.recipient_name}, {o.shippingAddress?.line1}, {o.shippingAddress?.city}, {o.shippingAddress?.country}
        </div>
      </div>
    </div>
  );
}
