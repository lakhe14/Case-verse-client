/**
 * The one customer-facing wording for order and payment states, shared by
 * the public tracker, the guest order page and the account order page.
 *
 * Only states the backend really has are mapped:
 *   order:   pending, processing, shipped, delivered, cancelled
 *   cancelled because: customer, guest, staff, payment_timeout
 *   payment: pending, proof_uploaded, approved, rejected, cod_pending, cod_confirmed
 * There is no packed, out-for-delivery, returned or refunded state, so none
 * is shown.
 */

export const ORDER_STATUS_LABELS = {
  pending: 'Order received',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS = {
  pending: 'Payment pending',
  proof_uploaded: 'Proof uploaded',
  approved: 'Payment approved',
  rejected: 'Proof rejected',
  cod_pending: 'COD pending',
  cod_confirmed: 'COD confirmed',
};

export const PAYMENT_METHOD_LABELS = {
  advance_qr: 'eSewa advance + cash on delivery',
  whatsapp_cod: 'Cash on delivery',
};

const CANCELLED_BY = {
  customer: 'You cancelled this order.',
  guest: 'You cancelled this order.',
  staff: 'CaseVerse cancelled this order.',
  payment_timeout: 'Payment was not confirmed in time, so the order was cancelled and its items were released.',
};

/** Public tracker, prefilled with the order ID only (the phone never goes in a URL). */
export const trackOrderLink = (orderNumber) => `/track-order?order=${encodeURIComponent(orderNumber)}`;

export const orderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status;
export const paymentStatusLabel = (status) => PAYMENT_STATUS_LABELS[status] || status;

/** Badge label: the payment problem when there is one, otherwise the order status. */
export function badgeLabel(order) {
  if (order.status === 'cancelled' && order.cancellation_reason === 'payment_timeout') return 'Payment expired';
  return orderStatusLabel(order.status);
}

/**
 * Where the order stands and what the customer can do next.
 * `tone`: ok | wait | action | problem | done.
 */
export function orderHeadline(order) {
  const payment = order.paymentConfirmation;
  const advance = payment?.advance_amount;
  if (order.status === 'cancelled') {
    const timeout = order.cancellation_reason === 'payment_timeout';
    return {
      tone: 'problem',
      title: timeout ? 'Payment time ran out' : 'Order cancelled',
      message: CANCELLED_BY[order.cancellation_reason] || 'This order was cancelled.',
      next: 'Nothing is owed for a cancelled order. You are welcome to place a new one.',
      kind: timeout ? 'payment_timeout' : 'cancelled',
    };
  }
  if (order.status === 'delivered') {
    return { tone: 'done', title: 'Delivered', message: 'Your order has been delivered. Thank you for shopping with CaseVerse.', next: null, kind: 'delivered' };
  }
  if (order.status === 'shipped') {
    return { tone: 'ok', title: 'On the way', message: 'Your parcel has left CaseVerse and is with the courier.', next: 'Keep your phone reachable so the rider can contact you.', kind: 'shipped' };
  }
  if (order.status === 'processing') {
    return { tone: 'ok', title: 'Preparing your order', message: 'Payment is confirmed and we are preparing your parcel.', next: 'We will update this page when it ships.', kind: 'processing' };
  }
  switch (payment?.status) {
    case 'proof_uploaded':
      return { tone: 'wait', title: 'Checking your payment', message: 'We received your payment screenshot and are checking it.', next: 'No action needed. This page updates once it is approved.', kind: 'proof_uploaded' };
    case 'rejected':
      return {
        tone: 'problem',
        title: 'Payment proof rejected',
        message: payment.admin_note ? `We could not accept your screenshot: ${payment.admin_note}` : 'We could not verify your payment screenshot.',
        next: 'Upload a new screenshot from your order page, or message us on WhatsApp.',
        kind: 'proof_rejected',
      };
    case 'cod_pending':
      return { tone: 'wait', title: 'Cash on delivery requested', message: 'We will confirm your cash-on-delivery order with you shortly.', next: 'Keep your phone reachable; the order is not confirmed until we confirm it.', kind: 'cod_pending' };
    case 'approved':
    case 'cod_confirmed':
      return { tone: 'ok', title: 'Payment confirmed', message: 'We will start preparing your parcel.', next: null, kind: payment.status };
    default:
      return {
        tone: 'action',
        title: 'Waiting for your payment',
        message: advance != null ? `Pay the NPR ${Number(advance).toLocaleString()} advance with eSewa and upload the screenshot to confirm this order.` : 'Complete the advance payment to confirm this order.',
        next: 'Use your order page to upload the screenshot or ask for cash on delivery.',
        kind: 'payment_pending',
      };
  }
}

const PROGRESS = ['processing', 'shipped', 'delivered'];

/**
 * Timeline entries, oldest first: recorded order status changes, the current
 * payment state (dated by its last change) and, for live orders, the steps
 * still to come. Nothing is dated unless the backend recorded it.
 */
export function orderTimeline(order) {
  const history = order.statusHistory || [];
  const entries = [];
  const received = history.find((h) => h.status === 'pending');
  entries.push({ key: 'pending', label: ORDER_STATUS_LABELS.pending, at: received?.changed_at || order.placed_at, state: 'done' });

  const payment = order.paymentConfirmation;
  if (payment) {
    const problem = payment.status === 'rejected';
    const settled = ['approved', 'cod_confirmed'].includes(payment.status);
    entries.push({
      key: `payment-${payment.status}`,
      label: paymentStatusLabel(payment.status),
      at: payment.status === 'pending' ? null : payment.updated_at,
      state: problem ? 'problem' : settled ? 'done' : order.status === 'cancelled' ? 'done' : 'current',
    });
  }

  for (const h of history) {
    if (h.status === 'pending') continue;
    entries.push({
      key: `status-${h.id}`,
      label: h.status === 'cancelled' && order.cancellation_reason === 'payment_timeout' ? 'Cancelled: payment expired' : orderStatusLabel(h.status),
      at: h.changed_at,
      state: h.status === 'cancelled' ? 'problem' : 'done',
    });
  }

  if (order.status !== 'cancelled') {
    const reached = PROGRESS.indexOf(order.status);
    PROGRESS.slice(reached + 1).forEach((status) => entries.push({ key: `next-${status}`, label: ORDER_STATUS_LABELS[status], at: null, state: 'upcoming' }));
    const last = [...entries].reverse().find((e) => e.state === 'done' && e.key.startsWith('status-'));
    if (last && order.status !== 'delivered') last.state = 'current';
  }
  return entries;
}
