import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { orders as api, reviews as reviewsApi } from '../../api/endpoints';
import { Spinner, ErrorText } from '../../components/ui';
import { OrderDelivery, OrderHeader, OrderStatusPanel, OrderSummary } from '../../components/OrderParts';
import { trackOrderLink } from '../../utils/orderStatus';
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
      <div className="order-detail-actions">
        <Link to="/account/orders" className="muted small">All orders</Link>
        <Link to="/covers" className="muted small">Continue shopping</Link>
        <Link to={trackOrderLink(o.order_number)} className="muted small" data-testid="track-order-link">Public tracking link</Link>
        {canCancel && <button className="btn danger sm" onClick={() => setCancelOpen(true)}>Cancel order</button>}
      </div>
      <OrderHeader order={o} />

      {o.paymentConfirmation && <PaymentConfirmation order={o} onUpdated={reload} />}

      <OrderStatusPanel order={o}>
        {o.status === 'cancelled' && <p className="small"><Link to="/covers">Shop other covers</Link> or <Link to="/account/orders">view your orders</Link>.</p>}
      </OrderStatusPanel>

      <OrderSummary
        order={o}
        renderItemExtra={(it) => (
          <>
            {canReview && it.product?.id && !reviewed.includes(it.id) && (
              reviewing === it.id ? (
                <ReviewForm
                  productId={it.product.id}
                  onDone={() => { setReviewed((r) => [...r, it.id]); setReviewing(null); }}
                />
              ) : (
                <button className="btn ghost sm" onClick={() => setReviewing(it.id)}>Write a review</button>
              )
            )}
            {reviewed.includes(it.id) && <span className="badge approved">Review submitted</span>}
          </>
        )}
      />
      <OrderDelivery order={o} />

      {cancelOpen && <div className="customer-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title"><div className="customer-cancel-dialog"><h2 id="cancel-order-title">Cancel this order?</h2><p>Your reserved items will be released and you can return to the shop to choose another design or model.</p>{o.paymentConfirmation?.status === 'proof_uploaded' && <p className="alert error">A payment proof has already been submitted. Cancelling will make it ineligible for review.</p>}<ErrorText error={cancelError} /><div className="row"><button className="btn subtle" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>Keep order</button><button className="btn danger" onClick={cancelOrder} disabled={cancelBusy}>{cancelBusy ? 'Cancelling…' : 'Cancel order'}</button></div></div></div>}
    </div>
  );
}
