import { useEffect, useRef, useState } from 'react';
import { orders as orderApi, guestCheckout } from '../api/endpoints';
import { ErrorText, Money, StatusBadge } from './ui';
import { whatsapp } from '../config';

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const labels = { pending: 'Awaiting payment', proof_uploaded: 'Proof submitted', approved: 'Verified', rejected: 'Proof rejected', cod_pending: 'COD pending', cod_confirmed: 'COD confirmed' };

/** `guestToken` switches proof upload / COD request onto the public guest-checkout endpoints instead of the authenticated order endpoints — same UI, same validation, different ownership. */
export default function PaymentConfirmation({ order, onUpdated, guestToken }) {
  const payment = order.paymentConfirmation;
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Object URLs must be revoked or they leak; re-derive one whenever the file changes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!payment) return null;
  if (order.status === 'cancelled') return <section className="payment-confirmation card"><div className="spread"><div><p className="eyebrow">ORDER CANCELLED</p><h3>Payment confirmation closed</h3></div><StatusBadge status="cancelled" label="Cancelled" /></div><p className="payment-confirmation__message">This order was cancelled before confirmation. Payment proof upload and COD requests are no longer available.</p></section>;
  const completed = ['approved', 'cod_confirmed'].includes(payment.status);
  // Historical rows may predate the required advance field. Do not invent a
  // charge client-side and do not render NaN.
  const parsedAdvance = Number(payment.advance_amount);
  const hasAdvanceAmount = Number.isFinite(parsedAdvance) && parsedAdvance >= 0;

  const handleFile = (selected) => {
    setError(null);
    if (!selected) return setFile(null);
    if (!ACCEPTED.has(selected.type) || selected.size > MAX_SIZE) {
      setFile(null);
      setError('Choose a JPG, PNG, or WebP image up to 5 MB.');
      return;
    }
    setFile(selected);
  };
  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;
    handleFile(selected);
    if (selected && (!ACCEPTED.has(selected.type) || selected.size > MAX_SIZE)) {
      event.target.value = '';
    }
  };
  const onDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files?.[0] || null);
  };
  const openPicker = () => inputRef.current?.click();
  const clearFile = () => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };
  const submit = async () => {
    if (!file) return setError('Select your payment screenshot before submitting.');
    setBusy(true); setError(null);
    try {
      const formData = new FormData(); formData.append('proof', file);
      if (guestToken) await guestCheckout.uploadPaymentProof(guestToken, formData);
      else await orderApi.uploadPaymentProof(order.id, formData);
      setFile(null); if (inputRef.current) inputRef.current.value = '';
      onUpdated?.();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const cod = async () => {
    setBusy(true); setError(null);
    try {
      if (guestToken) await guestCheckout.requestCod(guestToken);
      else await orderApi.requestCod(order.id);
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
      <p className="payment-confirmation__message">To confirm order <strong>{order.order_number}</strong>, pay <strong>{hasAdvanceAmount ? `NPR ${parsedAdvance.toFixed(0)}` : 'Advance amount unavailable'}</strong> in advance with eSewa and upload your payment screenshot.</p>
      {payment.status === 'proof_uploaded' && <p className="alert ok" data-testid="proof-waiting">Payment proof received. Waiting for staff verification.</p>}
      {payment.status === 'rejected' && <p className="alert error">Proof rejected{payment.admin_note ? `: ${payment.admin_note}` : '. Please upload a new screenshot.'}</p>}
      <div className="payment-confirmation__layout">
        <div className="payment-confirmation__pay">
          <div className="payment-amount"><span>Advance amount</span><strong>{hasAdvanceAmount ? <Money value={parsedAdvance} /> : 'Advance amount unavailable'}</strong></div>
          <p className="muted small">Provider: eSewa. Your order total remains <Money value={order.total_amount} />.</p>
          <figure className="payment-qr"><img src="/assets/caseverse/esewa_qr.jpeg" alt="eSewa advance payment QR code" /><figcaption>Scan to pay with eSewa</figcaption></figure>
          <ol className="payment-steps">
            <li>Scan the QR with eSewa.</li>
            <li>Pay the required amount.</li>
            <li>Upload your screenshot as proof.</li>
            <li>Submit for review.</li>
          </ol>
        </div>

        {payment.status !== 'cod_pending' && (
          <div className="payment-confirmation__upload">
            <h4 className="payment-confirmation__upload-title">Upload payment screenshot</h4>
            <div
              className={`upload-dropzone ${dragOver ? 'is-dragover' : ''} ${error ? 'is-invalid' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                id={`proof-${order.id}`}
                className="upload-dropzone__input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={chooseFile}
                aria-describedby={`proof-help-${order.id}`}
              />
              <label htmlFor={`proof-${order.id}`} className="upload-dropzone__label">
                {!file ? (
                  <div className="upload-dropzone__empty">
                    <span className="upload-dropzone__icon" aria-hidden="true">⬆</span>
                    <strong>Upload payment screenshot</strong>
                    <span className="upload-dropzone__hint">Tap to browse, or drag and drop the image here</span>
                    <span id={`proof-help-${order.id}`} className="upload-dropzone__meta">JPG, PNG, or WebP — up to 5 MB</span>
                  </div>
                ) : (
                  <div className="upload-dropzone__filled">
                    {previewUrl && <img src={previewUrl} alt="" className="upload-dropzone__thumb" />}
                    <div className="upload-dropzone__filemeta">
                      <strong className="upload-dropzone__filename">{file.name}</strong>
                      <span className="upload-dropzone__filesize">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  </div>
                )}
              </label>
              {file && (
                <div className="upload-dropzone__actions">
                  <button type="button" className="btn ghost sm" onClick={openPicker}>Replace</button>
                  <button type="button" className="btn ghost sm" onClick={clearFile}>Remove</button>
                </div>
              )}
            </div>
            <button type="button" className="btn block" disabled={busy || payment.status === 'proof_uploaded'} onClick={submit}>{busy ? 'Submitting…' : payment.status === 'proof_uploaded' ? 'Proof submitted' : 'Submit payment proof'}</button>
          </div>
        )}
      </div>
      {payment.status === 'pending' && <div className="payment-cod"><span>Prefer cash on delivery? We will open WhatsApp when configured; your order still requires staff confirmation.</span><button type="button" className="btn subtle" disabled={busy} onClick={cod}>Request COD confirmation</button></div>}
      {payment.status === 'cod_pending' && <p className="alert ok">Your COD request is awaiting staff confirmation. Opening WhatsApp alone does not confirm an order.</p>}
      <ErrorText error={error} />
    </>}
  </section>;
}
