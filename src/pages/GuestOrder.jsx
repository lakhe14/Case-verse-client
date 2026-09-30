import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import { guestCheckout } from '../api/endpoints';
import { Spinner, ErrorText } from '../components/ui';
import PaymentConfirmation from '../components/PaymentConfirmation';
import { OrderDelivery, OrderHeader, OrderStatusPanel, OrderSummary } from '../components/OrderParts';
import usePageMeta from '../hooks/usePageMeta';
import { trackOrderLink } from '../utils/orderStatus';

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
        <p className="muted">You can still look it up with your order ID and phone number.</p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Link to="/track-order" className="btn sm">Track an order</Link>
          <Link to="/" className="btn subtle sm">Back to CaseVerse</Link>
        </div>
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
      <div className="order-detail-actions">
        <Link to="/" className="muted small">Continue shopping</Link>
        <Link to={trackOrderLink(o.order_number)} className="muted small" data-testid="track-order-link">Track with order ID + phone</Link>
        {canCancel && <button className="btn danger sm" onClick={() => setCancelOpen(true)}>Cancel order</button>}
      </div>
      <OrderHeader order={o} />
      <p className="muted small">
        Bookmark this page to pay or cancel. To only check progress later, use Track order with your order ID <strong>{o.order_number}</strong> and phone number.
      </p>

      {o.paymentConfirmation && <PaymentConfirmation order={o} guestToken={token} onUpdated={reload} />}

      <OrderStatusPanel order={o}>
        {o.status === 'cancelled' && <p className="small"><Link to="/covers">Shop other covers</Link></p>}
      </OrderStatusPanel>
      <OrderSummary order={o} />
      <OrderDelivery order={o} />

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
