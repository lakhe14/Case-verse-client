import { useRef, useState } from 'react';
import { orders as orderApi } from '../api/endpoints';
import { ErrorText, Money, StatusBadge } from './ui';
import { whatsapp } from '../config';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const labels = { pending: 'Awaiting payment', proof_uploaded: 'Proof submitted', approved: 'Verified', rejected: 'Proof rejected', cod_pending: 'COD pending', cod_confirmed: 'COD confirmed' };

export default function PaymentConfirmation({ order, onUpdated }) {
  const payment = order.paymentConfirmation;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  if (order.status === 'cancelled') return <section className="payment-confirmation card"><div className="spread"><div><p className="eyebrow">ORDER CANCELLED</p><h3>Payment confirmation closed</h3></div><StatusBadge status="cancelled" label="Cancelled" /></div><p className="payment-confirmation__message">This order was cancelled before confirmation. Payment proof upload and COD requests are no longer available.</p></section>;
  const completed = ['approved', 'cod_confirmed'].includes(payment.status);

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    setError(null);
    if (!selected) return setFile(null);
    if (!ACCEPTED.has(selected.type) || selected.size > MAX_SIZE) {
      event.target.value = '';
      setFile(null);
      setError('Choose a JPG, PNG, or WebP image up to 5 MB.');
      return;
    }
    setFile(selected);
  };
  const submit = async () => {
    if (!file) return setError('Select your payment screenshot before submitting.');
    setBusy(true); setError(null);
    try {
      const formData = new FormData(); formData.append('proof', file);
      await orderApi.uploadPaymentProof(order.id, formData);
      setFile(null); if (inputRef.current) inputRef.current.value = '';
      onUpdated?.();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const cod = async () => {
    setBusy(true); setError(null);
    try {
      await orderApi.requestCod(order.id);
      if (whatsapp.number) {
        const message = `Hello CaseVerse, I would like to confirm Cash on Delivery for order ${order.order_number}. Order total: NPR ${Number(order.total_amount).toFixed(0)}.`;
        window.open(`https://wa.me/${whatsapp.number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      }
      onUpdated?.();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return <section className="payment-confirmation card" aria-labelledby="payment-title">
    <div className="spread payment-confirmation__head"><div><p className="eyebrow">ORDER CONFIRMATION</p><h3 id="payment-title">Confirm your order</h3></div><StatusBadge status={payment.status} label={labels[payment.status]} /></div>
    {completed ? <p className="payment-confirmation__message">Your payment confirmation has been verified. Your order is now being prepared.</p> : <>
      <p className="payment-confirmation__message">To confirm order <strong>{order.order_number}</strong>, pay <strong>NPR {Number(payment.advance_amount || 100).toFixed(0)}</strong> in advance with eSewa and upload your payment screenshot.</p>
      <div className="payment-confirmation__grid"><div className="payment-confirmation__details"><div className="payment-amount"><span>Advance amount</span><strong><Money value={payment.advance_amount || 100} /></strong></div><p className="muted small">Provider: eSewa. Your order total remains <Money value={order.total_amount} />.</p><ol><li>Scan the QR with eSewa.</li><li>Pay the advance amount.</li><li>Upload the payment screenshot below.</li></ol></div><figure className="payment-qr"><img src="/assets/caseverse/esewa_qr.jpeg" alt="eSewa advance payment QR code" /><figcaption>Scan to pay with eSewa</figcaption></figure></div>
      {payment.status === 'rejected' && <p className="alert error">Proof rejected{payment.admin_note ? `: ${payment.admin_note}` : '. Please upload a new screenshot.'}</p>}
      {payment.status !== 'cod_pending' && <div className="payment-upload"><label htmlFor={`proof-${order.id}`}>Payment screenshot</label><input ref={inputRef} id={`proof-${order.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} /><p className="muted small">JPG, PNG, or WebP — maximum 5 MB.</p>{file && <p className="payment-file">Selected: {file.name}</p>}<button type="button" className="btn" disabled={busy || payment.status === 'proof_uploaded'} onClick={submit}>{busy ? 'Submitting…' : payment.status === 'proof_uploaded' ? 'Proof submitted' : 'Submit payment proof'}</button></div>}
      {payment.status === 'pending' && <div className="payment-cod"><span>Prefer cash on delivery? We will open WhatsApp when configured; your order still requires staff confirmation.</span><button type="button" className="btn subtle" disabled={busy} onClick={cod}>Request COD confirmation</button></div>}
      {payment.status === 'cod_pending' && <p className="alert ok">Your COD request is awaiting staff confirmation. Opening WhatsApp alone does not confirm an order.</p>}
    </>}
    <ErrorText error={error} />
  </section>;
}
