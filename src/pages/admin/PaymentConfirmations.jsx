import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { ErrorText, Spinner, StatusBadge } from '../../components/ui';

export default function PaymentConfirmations() {
  const { data, loading, error, reload } = useAsync(() => admin.paymentConfirmations(), []);
  const [busy, setBusy] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rejection, setRejection] = useState(null);
  const [actionError, setActionError] = useState(null);
  const act = async (id, action, note) => {
    setBusy(id); setActionError(null);
    try { if (action === 'approve') await admin.approvePayment(id); else await admin.rejectPayment(id, note); setRejection(null); reload(); }
    catch (err) {
      setActionError(err);
      // The order was cancelled meanwhile: drop its stale row from the queue.
      if (err?.code === 'order_cancelled') { setRejection(null); reload(); }
    } finally { setBusy(null); }
  };
  const openProof = async (id) => { const result = await admin.paymentProof(id); setPreview(URL.createObjectURL(result.data)); };
  if (loading) return <Spinner />;
  return <div className="admin-page"><div className="page-head"><div><h1>Payment review</h1><p className="muted">Verify advance-payment screenshots and pending COD requests.</p></div></div>{actionError?.code === 'order_cancelled' ? <p className="alert error" role="alert" data-testid="review-conflict">This order has already been cancelled, so its payment can no longer be reviewed.</p> : <ErrorText error={error || actionError} />}
    <div className="table-wrap"><table className="data"><thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{(data?.data || []).map((item) => <tr key={item.id}><td>{item.order?.order_number}</td><td>{item.order?.user?.name || item.order?.guest_name || item.order?.guest_phone || 'Customer'}</td><td>{item.method === 'whatsapp_cod' ? 'WhatsApp COD' : 'eSewa advance'}</td><td>NPR {Number(item.advance_amount).toFixed(0)}</td><td><StatusBadge status={item.status} />{item.review_overdue && <span className="badge overdue" data-testid="review-overdue">Review overdue</span>}</td><td>{new Date(item.updated_at).toLocaleString()}</td><td><div className="row">{item.proof_filename && <button className="btn subtle sm" onClick={() => openProof(item.id)}>View proof</button>}<button className="btn sm" disabled={busy === item.id} onClick={() => act(item.id, 'approve')}>{item.status === 'cod_pending' ? 'Confirm COD' : 'Approve'}</button>{item.status !== 'cod_pending' && <button className="btn danger sm" disabled={busy === item.id} onClick={() => setRejection({ id: item.id, order: item.order?.order_number, note: '' })}>Reject</button>}</div></td></tr>)}</tbody></table></div>
    {preview && <div className="admin-proof-modal" role="dialog" aria-modal="true" aria-label="Payment proof preview" onClick={() => { URL.revokeObjectURL(preview); setPreview(null); }}><img src={preview} alt="Customer payment proof" /></div>}
    {rejection && <div className="admin-proof-modal" role="dialog" aria-modal="true" aria-labelledby="rejection-title"><form className="admin-rejection-dialog" onSubmit={(event) => { event.preventDefault(); act(rejection.id, 'reject', rejection.note); }}><div className="spread"><h2 id="rejection-title">Reject payment proof</h2><button type="button" className="btn ghost sm" onClick={() => setRejection(null)}>Close</button></div><p className="muted small">Order {rejection.order || 'payment confirmation'}. The note is optional and will be shown to the customer.</p><label htmlFor="payment-rejection-note">Review note (optional)</label><textarea id="payment-rejection-note" rows="4" maxLength="500" value={rejection.note} onChange={(event) => setRejection((current) => ({ ...current, note: event.target.value }))} placeholder="For example: Please upload a clear screenshot showing the completed payment." autoFocus /><div className="row"><button type="button" className="btn subtle" onClick={() => setRejection(null)}>Cancel</button><button className="btn danger" disabled={busy === rejection.id}>{busy === rejection.id ? 'Rejecting…' : 'Reject proof'}</button></div></form></div>}
  </div>;
}
