import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { ErrorText, Spinner, StatusBadge } from '../../components/ui';

export default function PaymentConfirmations() {
  const { data, loading, error, reload } = useAsync(() => admin.paymentConfirmations(), []);
  const [busy, setBusy] = useState(null);
  const [preview, setPreview] = useState(null);
  const act = async (id, action) => { setBusy(id); try { if (action === 'approve') await admin.approvePayment(id); else await admin.rejectPayment(id); reload(); } finally { setBusy(null); } };
  const openProof = async (id) => { const result = await admin.paymentProof(id); setPreview(URL.createObjectURL(result.data)); };
  if (loading) return <Spinner />;
  return <div className="admin-page"><div className="page-head"><div><h1>Payment review</h1><p className="muted">Verify advance-payment screenshots and pending COD requests.</p></div></div><ErrorText error={error} />
    <div className="table-wrap"><table className="data"><thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{(data?.data || []).map((item) => <tr key={item.id}><td>{item.order?.order_number}</td><td>{item.order?.user?.name || 'Customer'}</td><td>{item.method === 'whatsapp_cod' ? 'WhatsApp COD' : 'eSewa advance'}</td><td>NPR {Number(item.advance_amount).toFixed(0)}</td><td><StatusBadge status={item.status} /></td><td>{new Date(item.updated_at).toLocaleString()}</td><td><div className="row">{item.proof_filename && <button className="btn subtle sm" onClick={() => openProof(item.id)}>View proof</button>}<button className="btn sm" disabled={busy === item.id} onClick={() => act(item.id, 'approve')}>{item.status === 'cod_pending' ? 'Confirm COD' : 'Approve'}</button>{item.status !== 'cod_pending' && <button className="btn danger sm" disabled={busy === item.id} onClick={() => act(item.id, 'reject')}>Reject</button>}</div></td></tr>)}</tbody></table></div>
    {preview && <div className="admin-proof-modal" role="dialog" aria-modal="true" aria-label="Payment proof preview" onClick={() => { URL.revokeObjectURL(preview); setPreview(null); }}><img src={preview} alt="Customer payment proof" /></div>}
  </div>;
}
