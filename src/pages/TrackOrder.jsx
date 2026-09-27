import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { tracking } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { whatsapp } from '../config';
import usePageMeta from '../hooks/usePageMeta';
import { OrderDelivery, OrderHeader, OrderStatusPanel, OrderSummary } from '../components/OrderParts';

// Same shape the server accepts (utils/orderNumber.js); checked here only to help typing.
const ORDER_ID = /^CV-\d{8}-[0-9A-HJKMNP-TV-Z]{6}$/;
const normalizeOrderId = (value) => value.replace(/\s+/g, '').toUpperCase();

/** What went wrong, told apart without ever saying whether an order number exists. */
function describeError(error) {
  if (error.status === 422) return { kind: 'invalid', text: 'Check the order ID and phone number and try again.' };
  if (error.status === 404) return { kind: 'not_found', text: error.message };
  if (error.status === 429) return { kind: 'rate_limited', text: 'Too many attempts from this connection. Please wait 15 minutes and try again, or message us on WhatsApp.' };
  return { kind: 'server', text: 'We could not reach CaseVerse just now. Check your connection and try again in a moment.' };
}

export default function TrackOrder() {
  usePageMeta('Track your order', 'Check your CaseVerse order status with your order ID and phone number.');
  const [params] = useSearchParams();
  const { isCustomer } = useAuth();
  const [orderId, setOrderId] = useState(() => normalizeOrderId(params.get('order') || ''));
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const resultRef = useRef(null);
  const phoneRef = useRef(null);

  useEffect(() => {
    if (params.get('order')) phoneRef.current?.focus();
  }, [params]);

  const validate = () => {
    const next = {};
    if (!ORDER_ID.test(normalizeOrderId(orderId))) next.orderId = 'Enter the order ID as shown on your order, e.g. CV-20260927-8F3K2Q.';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) next.phone = 'Enter the phone number you used for the order.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    setOrder(null);
    try {
      const { data } = await tracking.lookup({ order_number: normalizeOrderId(orderId), phone });
      setOrder(data);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="track-page">
      <header className="track-intro">
        <p className="eyebrow">CASEVERSE / ORDERS</p>
        <h1>Track your order</h1>
        <p className="muted">Enter the order ID from your confirmation and the phone number you ordered with.</p>
        {isCustomer && <p className="muted small">Signed in? Your full order details are in <Link to="/account/orders">My orders</Link>.</p>}
      </header>

      <form className="card track-form" onSubmit={submit} noValidate aria-describedby={error ? 'track-error' : undefined}>
        <div className="field">
          <label htmlFor="track-order-id" className="field-label">Order ID</label>
          <input
            id="track-order-id"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onBlur={() => setOrderId((v) => normalizeOrderId(v))}
            placeholder="CV-20260927-8F3K2Q"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            aria-invalid={Boolean(fieldErrors.orderId)}
            aria-describedby={fieldErrors.orderId ? 'track-order-id-error' : undefined}
          />
          {fieldErrors.orderId && <p id="track-order-id-error" className="field-error">{fieldErrors.orderId}</p>}
        </div>
        <div className="field">
          <label htmlFor="track-phone" className="field-label">Phone number</label>
          <input
            id="track-phone"
            ref={phoneRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            maxLength={25}
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={fieldErrors.phone ? 'track-phone-error' : 'track-phone-help'}
          />
          {fieldErrors.phone
            ? <p id="track-phone-error" className="field-error">{fieldErrors.phone}</p>
            : <p id="track-phone-help" className="muted small">+977, spaces and dashes are fine.</p>}
        </div>
        <button type="submit" className="btn block" disabled={busy}>{busy ? 'Checking…' : 'Track order'}</button>
        {error && (
          <div id="track-error" className={`alert error track-error is-${error.kind}`} role="alert" data-testid="track-error" data-kind={error.kind}>
            {error.text}
            {error.kind !== 'invalid' && whatsapp.link && <> <a href={whatsapp.link} target="_blank" rel="noopener">Ask us on WhatsApp</a>.</>}
          </div>
        )}
      </form>

      {order && (
        <section className="track-result" ref={resultRef} tabIndex={-1} aria-label={`Order ${order.order_number}`} data-testid="track-result">
          <OrderHeader order={order} />
          <OrderStatusPanel order={order}>
            {order.is_guest && order.status === 'pending' && (
              <p className="small">Paying or cancelling happens on the order link shown when you ordered. Lost it? {whatsapp.link ? <a href={whatsapp.link} target="_blank" rel="noopener">Message us on WhatsApp</a> : 'Contact us'} with your order ID.</p>
            )}
            {!order.is_guest && order.status === 'pending' && (
              <p className="small"><Link to="/login">Sign in</Link> to pay for or cancel this order.</p>
            )}
            {order.status === 'cancelled' && <p className="small"><Link to="/covers">Shop phone covers</Link></p>}
          </OrderStatusPanel>
          <OrderSummary order={order} />
          <OrderDelivery order={order} />
        </section>
      )}
    </div>
  );
}
