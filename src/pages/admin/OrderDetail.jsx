import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, Money, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const NEXT = {
  pending: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => admin.order(id), [id]);
  const { can } = useAuth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [paymentNote, setPaymentNote] = useState('');
  const [proofUrl, setProofUrl] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorText error={error} />;
  const o = data?.data;
  if (!o) return null;

  const changeStatus = async (status) => {
    setBusy(true);
    setActionError(null);
    try {
      await admin.updateOrderStatus(o.id, { status, note: note || undefined });
      setNote('');
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };
  const payment = o?.paymentConfirmation;
  const paymentConfirmed = payment && ((payment.method === 'advance_qr' && payment.status === 'approved') || (payment.method === 'whatsapp_cod' && payment.status === 'cod_confirmed'));
  const paymentBlocked = payment && !paymentConfirmed;
  const reviewPayment = async (action) => {
    setBusy(true); setActionError(null);
    try {
      if (action === 'approve') await admin.approvePayment(payment.id, paymentNote || undefined);
      else await admin.rejectPayment(payment.id, paymentNote || undefined);
      setPaymentNote(''); reload();
    } catch (e) { setActionError(e); } finally { setBusy(false); }
  };
  const viewProof = async () => {
    setActionError(null);
    try { const result = await admin.paymentProof(payment.id); setProofUrl(URL.createObjectURL(result.data)); }
    catch (e) { setActionError(e); }
  };

  return (
    <div className="col">
      <Link to="/admin/orders" className="small">All orders</Link>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{o.order_number}</h1>
        <StatusBadge status={o.status} />
      </div>
      <div className="muted small">
        {o.user ? `${o.user.name}, ${o.user.email}` : `${o.guest_name} (guest), ${o.guest_phone}`}
      </div>
      <div className="muted small">Placed {new Date(o.placed_at).toLocaleString()}</div>

      <div className="card">
        <h3>Delivery</h3>
        {o.shippingAddress ? (
          <div className="muted small">
            {o.shippingAddress.recipient_name}, {o.shippingAddress.phone}<br />
            {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}, {o.shippingAddress.city}
            {o.shippingAddress.state ? `, ${o.shippingAddress.state}` : ''}, {o.shippingAddress.country}
          </div>
        ) : (
          <div className="muted small">
            {o.guest_name} (guest), {o.guest_phone}<br />
            {o.guest_area}, {o.guest_municipality}, {o.guest_district}, {o.guest_province}
            {o.guest_landmark && <><br />Landmark: {o.guest_landmark}</>}
            {o.guest_delivery_notes && <><br />Notes: {o.guest_delivery_notes}</>}
            {o.guest_latitude != null && o.guest_longitude != null && (
              <><br />Pinned location: {o.guest_latitude}, {o.guest_longitude}</>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Update status</h3>
        <ErrorText error={actionError} />
        {paymentBlocked && <p className="alert error">{payment.status === 'rejected' ? 'Payment proof rejected. Waiting for the customer to upload a new proof.' : payment.status === 'proof_uploaded' ? 'Payment proof submitted. Review the screenshot before processing this order.' : 'Payment confirmation required. This order cannot be processed until its payment is approved.'}</p>}
        {NEXT[o.status].length === 0 ? (
          <p className="muted">This order is in a final state.</p>
        ) : (
          <>
            <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              {NEXT[o.status].map((s) => (
                <button key={s} className="btn sm" disabled={busy || (paymentBlocked && ['processing', 'shipped', 'delivered'].includes(s))} onClick={() => changeStatus(s)}>
                  Mark {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {payment && <div className="card admin-payment-panel"><div className="spread"><h3>Payment confirmation</h3><StatusBadge status={payment.status} /></div><dl><div><dt>Method</dt><dd>{payment.method === 'whatsapp_cod' ? 'WhatsApp COD' : 'eSewa advance'}</dd></div><div><dt>Advance</dt><dd><Money value={payment.advance_amount} /></dd></div><div><dt>Submitted</dt><dd>{payment.proof_filename ? new Date(payment.updated_at).toLocaleString() : 'Not submitted'}</dd></div>{payment.reviewed_at && <div><dt>Reviewed</dt><dd>{new Date(payment.reviewed_at).toLocaleString()}{payment.reviewedByStaff?.name ? ` by ${payment.reviewedByStaff.name}` : ''}</dd></div>}</dl>{payment.admin_note && <p className="muted small">Note: {payment.admin_note}</p>}{can('manage_order_payments') && <div className="admin-payment-actions">{payment.proof_filename && <button className="btn subtle sm" onClick={viewProof}>View payment proof</button>}{payment.status === 'proof_uploaded' && <><textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} maxLength="500" rows="3" placeholder="Optional review or rejection note" /><div className="row"><button className="btn sm" disabled={busy} onClick={() => reviewPayment('approve')}>Approve payment</button><button className="btn danger sm" disabled={busy} onClick={() => reviewPayment('reject')}>Reject payment</button></div></>}{payment.status === 'cod_pending' && <button className="btn sm" disabled={busy} onClick={() => reviewPayment('approve')}>Confirm COD</button>}</div>}</div>}

      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 320px' }}>
          <h3>Items</h3>
          {o.items.map((it) => (
            <div key={it.id} className="spread" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <span>{it.product_name_snap} × {it.quantity} <span className="muted small">({it.sku_snap})</span></span>
              <Money value={it.line_total} />
            </div>
          ))}
          {(o.promoItems || []).map((p) => (
            <div key={p.id} className="spread" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <span>{p.name_snap} × {p.quantity} <span className="muted small">(promo item)</span></span>
              <span>FREE</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: '0 0 260px' }}>
          <h3>Totals</h3>
          {o.campaign_name_snap && <p className="muted small" style={{ marginTop: 0 }}>{o.campaign_name_snap} ({o.campaign_code})</p>}
          <div className="spread"><span className="muted">Subtotal</span><Money value={o.subtotal_amount} /></div>
          {Number(o.bundle_discount_amount) > 0 && (
            <div className="spread">
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>Bundle discount</span>
              <span style={{ whiteSpace: 'nowrap' }}>−<Money value={o.bundle_discount_amount} /></span>
            </div>
          )}
          <div className="spread"><span className="muted">Discount</span><Money value={o.discount_amount} /></div>
          <div className="spread"><span className="muted">Shipping</span><Money value={o.shipping_amount} /></div>
          <div className="spread" style={{ fontWeight: 700 }}><span>Total</span><Money value={o.total_amount} /></div>
        </div>
      </div>

      <div className="card">
        <h3>History</h3>
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
      {proofUrl && <div className="admin-proof-modal" role="dialog" aria-modal="true" aria-label="Payment proof preview" onClick={() => { URL.revokeObjectURL(proofUrl); setProofUrl(null); }}><img src={proofUrl} alt="Customer payment proof" /></div>}
    </div>
  );
}
