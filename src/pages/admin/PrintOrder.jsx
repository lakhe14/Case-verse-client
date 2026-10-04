import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText } from '../../components/ui';
import { contact } from '../../config';
import { orderStatusLabel, paymentStatusLabel, PAYMENT_METHOD_LABELS } from '../../utils/orderStatus';

/*
 * Staff-only print views of one order: an A4 customer invoice and an A6
 * CaseVerse parcel label. Both render GET /api/admin/orders/:id (manage_orders
 * on the server) inside StaffRoute, and read only what the order stored when
 * it was placed: line prices, totals, discounts and delivery charge are the
 * order's own columns, never today's catalog. Nothing here is a ParcelMoover
 * document: no courier tracking number, shipment id or barcode exists yet.
 */

const npr = (value) => `NPR ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** Recipient and address from whichever the order has: guest details or the customer's shipping address. */
function recipientOf(o) {
  if (o.user_id) {
    const a = o.shippingAddress || {};
    return {
      name: a.recipient_name || o.user?.name || null,
      phone: a.phone || null,
      email: o.user?.email || null,
      street: [a.line1, a.line2].filter(Boolean).join(', ') || null,
      municipality: a.city || null,
      district: null,
      province: a.state || null,
      landmark: null,
      notes: null,
    };
  }
  return {
    name: o.guest_name,
    phone: o.guest_phone,
    email: null, // guest checkout does not ask for an email
    street: o.guest_area || null,
    municipality: o.guest_municipality || null,
    district: o.guest_district || null,
    province: o.guest_province || null,
    landmark: o.guest_landmark || null,
    notes: o.guest_delivery_notes || null,
  };
}

function usePrintOrder() {
  const { id } = useParams();
  const result = useAsync(() => admin.order(id), [id]);
  return { id, ...result, order: result.data?.data };
}

function Toolbar({ id, title }) {
  return (
    <div className="print-toolbar">
      <Link to={`/admin/orders/${id}`}>← Back to order</Link>
      <span>{title}</span>
      <button type="button" className="btn sm" onClick={() => window.print()}>Print / Save as PDF</button>
    </div>
  );
}

/** One @page rule per view, present only while that view is mounted. */
function PageSize({ css }) {
  return <style>{css}</style>;
}

function usePrintTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}

export function PrintInvoice() {
  const { id, order: o, loading, error } = usePrintOrder();
  usePrintTitle(o ? `Invoice ${o.order_number}` : 'Invoice');
  if (loading) return <Spinner />;
  if (error) return <div className="print-shell"><ErrorText error={error} /></div>;
  if (!o) return null;
  const r = recipientOf(o);
  const payment = o.paymentConfirmation;
  const summary = o.payment_summary || {};
  const address = [r.street, r.municipality, r.district, r.province].filter(Boolean).join(', ');

  return (
    <div className="print-shell">
      <PageSize css="@page { size: A4; margin: 14mm; }" />
      <Toolbar id={id} title="Customer invoice (A4)" />
      <article className="print-doc print-invoice" data-testid="print-invoice">
        <header className="inv-head">
          <div>
            <div className="print-brand">CaseVerse</div>
            <div className="print-muted">iPhone covers · Nepal{contact.phoneDisplay ? ` · ${contact.phoneDisplay}` : ''}{contact.email ? ` · ${contact.email}` : ''}</div>
          </div>
          <div className="inv-meta">
            <h1>Invoice</h1>
            <dl>
              <dt>Invoice / order no.</dt><dd data-testid="invoice-number">{o.order_number}</dd>
              <dt>Order date</dt><dd>{date(o.placed_at)}</dd>
              <dt>Order status</dt><dd>{orderStatusLabel(o.status)}</dd>
              {payment && <><dt>Payment status</dt><dd>{paymentStatusLabel(payment.status)}</dd></>}
            </dl>
          </div>
        </header>

        <section className="inv-parties">
          <div>
            <h2>Bill / deliver to</h2>
            {r.name && <p><strong>{r.name}</strong></p>}
            {r.phone && <p>Phone: {r.phone}</p>}
            {r.email && <p>Email: {r.email}</p>}
            {address && <p>{address}</p>}
            {r.landmark && <p>Landmark: {r.landmark}</p>}
          </div>
          {o.courier_destination_name && (
            <div>
              <h2>Delivery</h2>
              <p>ParcelMoover destination: {o.courier_destination_name}</p>
            </div>
          )}
        </section>

        <table className="inv-items">
          <thead>
            <tr><th>Design</th><th>iPhone model</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Line total</th></tr>
          </thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.id} data-testid="invoice-line">
                <td>{it.product_name_snap}<div className="print-muted">{it.sku_snap}</div></td>
                <td>{it.model || '—'}</td>
                <td className="num">{it.quantity}</td>
                <td className="num">{npr(it.unit_price)}</td>
                <td className="num">{npr(it.line_total)}</td>
              </tr>
            ))}
            {(o.promoItems || []).map((p) => (
              <tr key={`promo-${p.id}`}>
                <td>{p.name_snap}</td><td>—</td><td className="num">{p.quantity}</td><td className="num">FREE</td><td className="num">{npr(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-bottom">
          <section className="inv-payment">
            <h2>Payment</h2>
            {payment ? (
              <dl>
                <dt>Method</dt><dd>{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</dd>
                <dt>Status</dt><dd>{paymentStatusLabel(payment.status)}</dd>
                <dt>Advance paid</dt><dd data-testid="invoice-advance">{npr(summary.advance_paid)}</dd>
                <dt>Remaining (cash on delivery)</dt><dd data-testid="invoice-remaining">{o.status === 'cancelled' ? 'Nothing owed' : npr(summary.remaining_cod)}</dd>
              </dl>
            ) : <p className="print-muted">No payment record on this order.</p>}
          </section>
          <table className="inv-totals" data-testid="invoice-totals">
            <tbody>
              <tr><th>Subtotal</th><td>{npr(o.subtotal_amount)}</td></tr>
              {Number(o.bundle_discount_amount) > 0 && <tr><th>{o.campaign_name_snap || 'Bundle'} discount</th><td>−{npr(o.bundle_discount_amount)}</td></tr>}
              {Number(o.discount_amount) > 0 && <tr><th>Coupon{o.coupon?.code ? ` ${o.coupon.code}` : ''}</th><td>−{npr(o.discount_amount)}</td></tr>}
              <tr><th>Shipping</th><td>{npr(o.shipping_amount)}</td></tr>
              <tr className="inv-grand"><th>Grand total</th><td data-testid="invoice-total">{npr(o.total_amount)}</td></tr>
            </tbody>
          </table>
        </div>

        <footer className="print-muted inv-foot">
          Prices, discounts and delivery charge are as charged when the order was placed. Thank you for shopping with CaseVerse.
        </footer>
      </article>
    </div>
  );
}

export function PrintLabel() {
  const { id, order: o, loading, error } = usePrintOrder();
  usePrintTitle(o ? `Label ${o.order_number}` : 'Parcel label');
  if (loading) return <Spinner />;
  if (error) return <div className="print-shell"><ErrorText error={error} /></div>;
  if (!o) return null;
  const r = recipientOf(o);
  const payment = o.paymentConfirmation;
  const cod = o.payment_summary?.remaining_cod ?? Number(o.total_amount);
  const pieces = o.items.reduce((n, it) => n + it.quantity, 0);
  const freebies = (o.promoItems || []).reduce((n, p) => n + p.quantity, 0);

  return (
    <div className="print-shell">
      <PageSize css="@page { size: 105mm 148mm; margin: 4mm; }" />
      <Toolbar id={id} title="CaseVerse parcel label (A6 / thermal)" />
      {o.status === 'cancelled' && <p className="alert error print-hide">This order is cancelled. Do not ship it.</p>}
      <article className="print-doc print-label" data-testid="print-label">
        <header className="lbl-head">
          <span className="print-brand">CaseVerse</span>
          <span className="lbl-kind">Parcel label · not a courier label</span>
        </header>
        <div className="lbl-ref">
          <span className="lbl-caption">CaseVerse order reference</span>
          <strong data-testid="label-ref">{o.order_number}</strong>
          <span className="lbl-caption">{date(o.placed_at)}</span>
        </div>
        <section className="lbl-to">
          <span className="lbl-caption">Deliver to</span>
          <strong className="lbl-name">{r.name}</strong>
          {r.phone && <strong className="lbl-phone">{r.phone}</strong>}
          {r.street && <span>{r.street}</span>}
          {r.municipality && <span>Municipality / locality: {r.municipality}</span>}
          {r.district && <span>District: {r.district}</span>}
          {r.province && <span>{r.province}</span>}
          {o.courier_destination_name && <span>ParcelMoover destination: <strong>{o.courier_destination_name}</strong></span>}
          {r.landmark && <span>Landmark: {r.landmark}</span>}
          {r.notes && <span>Note: {r.notes}</span>}
        </section>
        <section className={`lbl-cod${cod > 0 ? '' : ' is-paid'}`} data-testid="label-cod">
          {cod > 0 ? <>COLLECT CASH <strong>{npr(cod)}</strong></> : <strong>NOTHING TO COLLECT</strong>}
          <span className="lbl-caption">{payment ? `${PAYMENT_METHOD_LABELS[payment.method] || payment.method} · ${paymentStatusLabel(payment.status)}` : 'No payment record'}</span>
        </section>
        <footer className="lbl-foot">
          <span>Contents: {pieces} iPhone cover{pieces === 1 ? '' : 's'}{freebies ? ` + ${freebies} free holder${freebies === 1 ? '' : 's'}` : ''}</span>
          <span>Handle with care · keep dry</span>
          {contact.phoneDisplay && <span>From: CaseVerse, {contact.phoneDisplay}</span>}
        </footer>
      </article>
    </div>
  );
}
