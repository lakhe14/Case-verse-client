import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { addresses as addressApi, orders as orderApi, loyalty as loyaltyApi, shipping as shippingApi } from '../api/endpoints';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner, ErrorText, Money, EmptyState } from '../components/ui';
import SalePrice from '../components/SalePrice';
import GuestCheckoutForm from '../components/GuestCheckoutForm';
import usePageMeta from '../hooks/usePageMeta';
import { useCampaign } from '../hooks/useCampaign';

// The applied coupon survives a trip to the cart and back within this tab;
// every preview re-validates it on the server, so nothing stale is trusted.
const COUPON_KEY = 'caseverse_checkout_coupon';
function readSavedCoupon() {
  try { return sessionStorage.getItem(COUPON_KEY) || ''; } catch { return ''; }
}
function saveCoupon(code) {
  try { if (code) sessionStorage.setItem(COUPON_KEY, code); else sessionStorage.removeItem(COUPON_KEY); } catch { /* storage unavailable */ }
}

const BUNDLE_COUPON_NOTE = 'Coupons can’t be combined with the Dashain Trio Offer.';

// Server refusals that mean the coupon, not the order, is the problem.
const COUPON_REFUSALS = new Set(['coupon_exhausted', 'coupon_used_by_user', 'coupon_invalid', 'coupon_expired', 'coupon_not_started', 'coupon_min_order', 'coupon_not_combinable_with_campaign']);

export default function Checkout() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isCustomer } = useAuth();
  const { cart, refresh } = useCart();
  // Only used to re-price when the campaign starts or ends while on this page.
  const campaignActive = useCampaign()?.active ?? null;
  usePageMeta('Checkout', 'Complete your CaseVerse order.');

  const [addrs, setAddrs] = useState(null);
  const [shippingId, setShippingId] = useState(null);
  const [billingSame, setBillingSame] = useState(true);
  const [billingId, setBillingId] = useState(null);
  const [couponCode, setCouponCode] = useState(readSavedCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState(readSavedCoupon);
  useEffect(() => saveCoupon(appliedCoupon), [appliedCoupon]);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState(null);
  // A coupon refused at final placement (e.g. its last use was just taken).
  const [couponRejected, setCouponRejected] = useState(null);
  // Status line for a coupon the page removed on its own (bundle now applies).
  const [couponNotice, setCouponNotice] = useState('');
  // Re-price whenever the cart contents change, not only on form changes.
  const cartSignature = cart.items.map((item) => `${item.variant_id}:${item.quantity}`).join(',');
  const [loadError, setLoadError] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [destinationId, setDestinationId] = useState('');
  const [destinationError, setDestinationError] = useState(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const quoteRequest = useRef(0);

  useEffect(() => {
    if (!isCustomer) {
      setAddrs([]);
      return;
    }
    addressApi
      .list()
      .then((r) => {
        setAddrs(r.data);
        const def = r.data.find((a) => a.is_default) || r.data[0];
        if (def) {
          setShippingId(def.id);
          setBillingId(def.id);
        }
      })
      .catch((e) => {
        setAddrs([]);
        setLoadError(e);
      });
    loyaltyApi.balance().then((r) => setPointsBalance(r.data.points)).catch(() => {});
    shippingApi.parcelmooverDestinations().then((r) => setDestinations(r.data)).catch((e) => setDestinationError(e));
  }, [isCustomer]);

  useEffect(() => {
    if (!isCustomer || !shippingId || !destinationId) {
      quoteRequest.current += 1;
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const requestId = ++quoteRequest.current;
    setPreview(null);
    setPreviewError(null);
    orderApi
      .preview({
        shipping_address_id: shippingId,
        parcelmoover_destination_id: destinationId,
        coupon_code: appliedCoupon || undefined,
        redeem_points: redeemPoints || undefined,
      })
      .then((result) => { if (quoteRequest.current === requestId) setPreview(result); })
      .catch((e) => {
        if (quoteRequest.current !== requestId) return;
        setPreview(null);
        if (appliedCoupon && e.code === 'coupon_not_combinable_with_campaign') {
          // The cart now gets the Dashain bundle: drop the coupon and re-price
          // without it (this effect re-runs) instead of keeping a refused code.
          setAppliedCoupon('');
          setCouponCode('');
          setCouponNotice('Your coupon was removed because the Dashain Trio Offer is now applied.');
          return;
        }
        setPreviewError(e);
      });
  }, [shippingId, destinationId, appliedCoupon, redeemPoints, quoteAttempt, cartSignature, campaignActive]);

  // The cart's own pricing (and its coupon_allowed) must follow a campaign
  // start or end that happens while this page is open.
  const campaignSeen = useRef(campaignActive);
  useEffect(() => {
    if (campaignSeen.current !== null && campaignActive !== null && campaignSeen.current !== campaignActive) refresh();
    campaignSeen.current = campaignActive;
  }, [campaignActive, refresh]);

  // Coupon eligibility comes from the server (preview once priced, else the
  // cart): blocked only while a Dashain pair is priced into this order.
  const couponAllowed = preview?.data ? preview.data.coupon_allowed !== false : cart.coupon_allowed !== false;
  const couponBlockedRef = useRef(null);
  // True while focus is inside the coupon form (a removed element may never fire blur).
  const couponFormFocused = useRef(false);
  useEffect(() => {
    // Only when the field was removed while it had focus: move focus to the
    // note instead of stranding it on the page body. Never on page load.
    if (!couponAllowed && couponFormFocused.current) {
      couponFormFocused.current = false;
      couponBlockedRef.current?.focus();
    }
  }, [couponAllowed]);
  // preview response is { data } shaped? endpoint returns r.data => the JSON body { data }
  // orderApi.preview returns response.data (the body). body = { data: {...} }

  if (addrs === null) return <Spinner />;
  if (loadError) {
    return (
      <EmptyState title="We couldn't load checkout">
        <p className="muted" style={{ maxWidth: '40ch', margin: '0 auto 14px' }}>{loadError.message}</p>
        <button className="btn sm" onClick={() => window.location.reload()}>Try again</button>
      </EmptyState>
    );
  }
  if (!cart.items.length) {
    return (
      <EmptyState title="Your cart is empty">
        <p className="muted" style={{ margin: '0 auto 14px' }}>Add something to your cart before checking out.</p>
        <Link to="/shop" className="btn sm">Browse the shop</Link>
      </EmptyState>
    );
  }
  if (!isCustomer) {
    return (
      <div>
        <div className="checkout-backlinks"><Link to="/cart">← Back to cart</Link><Link to="/covers">Continue shopping</Link></div>
        <h1>Checkout</h1>
        <GuestCheckoutForm />
      </div>
    );
  }
  if (addrs.length === 0) {
    return (
      <EmptyState title="Add a delivery address first">
        <Link to="/account/addresses" className="btn sm">Add address</Link>
      </EmptyState>
    );
  }

  const totals = preview?.data;

  const applyCoupon = (e) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    setCouponRejected(null);
    setCouponNotice('');
    setAppliedCoupon(code);
    if (code) toast.info(`Checking coupon ${code}…`);
  };

  const removeCoupon = () => {
    setCouponRejected(null);
    setCouponNotice('');
    setAppliedCoupon('');
    setCouponCode('');
  };

  const placeOrder = async () => {
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await orderApi.place({
        shipping_address_id: shippingId,
        parcelmoover_destination_id: destinationId,
        billing_address_id: billingSame ? shippingId : billingId,
        coupon_code: appliedCoupon || undefined,
        redeem_points: redeemPoints || undefined,
      });
      await refresh();
      toast.success(`Order ${res.data.order_number} placed. Thank you!`);
      saveCoupon('');
      navigate(`/account/orders/${res.data.id}`, { replace: true });
    } catch (e) {
      if (appliedCoupon && COUPON_REFUSALS.has(e.code)) {
        // Nothing was placed. Drop the coupon so the preview re-prices the
        // order without it (no stale discount stays visible); the cart,
        // address and destination stay as they are.
        setCouponRejected({ code: appliedCoupon, message: e.message });
        setAppliedCoupon('');
        setCouponCode('');
        toast.error('Your coupon could not be applied. Review the updated total and place your order again.');
        return;
      }
      setPlaceError(e);
      toast.error(e.message || 'We couldn’t place your order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div>
      <div className="checkout-backlinks"><Link to="/cart">← Back to cart</Link><Link to="/covers">Continue shopping</Link></div>
      <h1>Checkout</h1>
      <div className="row checkout-layout" style={{ alignItems: 'flex-start', gap: '32px 40px', flexWrap: 'wrap' }}>
        <div className="col checkout-form" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="card">
            <h3>Shipping address</h3>
            <label className="field" style={{ marginBottom: 12 }}>
              <span className="field-label">ParcelMoover delivery destination</span>
              <select required value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
                <option value="">Select a delivery destination</option>
                {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}{destination.zone ? ` — ${destination.zone}` : ''}</option>)}
              </select>
              {destinationError && <span className="field-error">Delivery destinations are temporarily unavailable. Please try again.</span>}
            </label>
            <div className="stack">
              {addrs.map((a) => (
                <label key={a.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <input
                    type="radio"
                    name="ship"
                    checked={shippingId === a.id}
                    onChange={() => setShippingId(a.id)}
                    style={{ width: 'auto', marginTop: 4 }}
                  />
                  <span>
                    <strong style={{ fontWeight: 500 }}>{a.recipient_name}</strong>
                    <br />
                    <span className="muted small">
                      {a.phone}
                      <br />
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}
                      {a.state ? `, ${a.state}` : ''}, {a.country}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="row" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <span>Billing address same as shipping</span>
            </label>
            {!billingSame && (
              <select value={billingId || ''} onChange={(e) => setBillingId(Number(e.target.value))}>
                {addrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.recipient_name}, {a.line1}, {a.city}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="card">
            <h3>Coupon</h3>
            <p className="small" role="status" aria-live="polite" data-testid="coupon-notice" style={{ margin: couponNotice ? '0 0 8px' : 0 }}>
              {couponNotice}
            </p>
            {!couponAllowed ? (
              <p className="muted small" data-testid="coupon-blocked" ref={couponBlockedRef} tabIndex={-1} style={{ marginBottom: 0 }}>
                {BUNDLE_COUPON_NOTE}
              </p>
            ) : (
              <form className="row" style={{ gap: 8 }} onSubmit={applyCoupon} onFocus={() => { couponFormFocused.current = true; }} onBlur={() => { couponFormFocused.current = false; }}>
                <input
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn subtle">Apply</button>
              </form>
            )}
            {appliedCoupon && totals?.coupon && (
              <p className="small" style={{ color: 'var(--sage)', marginBottom: 0 }}>
                “{appliedCoupon}” applied: {totals.coupon.description}.{' '}
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ padding: 0, fontSize: '0.82rem' }}
                  onClick={removeCoupon}
                >
                  Remove
                </button>
              </p>
            )}
            {couponRejected && (
              <p className="small" role="alert" data-testid="coupon-rejected" style={{ color: 'var(--danger)', marginBottom: 0 }}>
                “{couponRejected.code}” was not applied: {couponRejected.message} Your order has not been placed yet; the total below is without the coupon.
              </p>
            )}
            {appliedCoupon && previewError && (
              <p className="small" style={{ color: 'var(--danger)', marginBottom: 0 }}>
                {previewError.message || 'That coupon could not be applied.'}
              </p>
            )}
          </div>

          {pointsBalance > 0 && (
            <div className="card">
              <h3>Loyalty points</h3>
              <p className="muted small">You have {pointsBalance} points.</p>
              <label className="row">
                <input
                  type="checkbox"
                  checked={redeemPoints > 0}
                  onChange={(e) => setRedeemPoints(e.target.checked ? pointsBalance : 0)}
                  style={{ width: 'auto' }}
                />
                <span>Redeem {pointsBalance} points</span>
              </label>
            </div>
          )}
        </div>

        <div className="summary-box checkout-summary" style={{ flex: '1 1 300px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, marginTop: 0 }}>Order total</h3>
          {!totals ? (
            previewError ? (
              <div>
                <ErrorText error={previewError} />
                <button type="button" className="btn subtle sm" onClick={() => setQuoteAttempt((n) => n + 1)}>Try again</button>
              </div>
            ) : !destinationId ? (
              <p className="muted small">Select a ParcelMoover delivery destination to see shipping and your total.</p>
            ) : (
              <Spinner />
            )
          ) : (
            <div>
              {totals.campaign_active && totals.bundle_discount > 0 && (
                <p className="eyebrow" style={{ marginBottom: 6 }}>{totals.campaign_label}</p>
              )}
              <div className="checkout-price-lines">{(totals.lines || []).map((line) => <div className="spread small" key={line.variant_id}><span>{line.name} × {line.quantity}</span><SalePrice price={line.unit_price} compareAt={line.compare_at_price} compact /></div>)}</div>
              <div className="summary-row"><span className="muted">Subtotal</span><Money value={totals.subtotal} /></div>
              {totals.bundle_discount > 0 && (
                <>
                  <div className="summary-row">
                    <span className="muted">Dashain bundle discount</span>
                    <span style={{ whiteSpace: 'nowrap' }}>−<Money value={totals.bundle_discount} /></span>
                  </div>
                  {(totals.free_items || []).map((item) => (
                    <div className="summary-row" key={item.type}>
                      <span className="muted">{item.name} × {item.quantity}</span>
                      <span>FREE</span>
                    </div>
                  ))}
                </>
              )}
              {totals.coupon_discount > 0 && (
                <div className="summary-row"><span className="muted">Coupon</span><span>−<Money value={totals.coupon_discount} /></span></div>
              )}
              {totals.points_discount > 0 && (
                <div className="summary-row"><span className="muted">Points</span><span>−<Money value={totals.points_discount} /></span></div>
              )}
              <div className="summary-row"><span className="muted">Shipping</span><Money value={totals.shipping_amount} /></div>
              <div className="summary-total"><span>Total</span><Money value={totals.total_amount} /></div>
              {totals.shipping_method && (
                <p className="muted small" style={{ marginTop: 8 }}>{totals.shipping_method}</p>
              )}
            </div>
          )}
          <ErrorText error={placeError} />
          <p className="checkout-payment-note">
            {totals && totals.advance_amount != null ? <>After placing your order, you will be asked to pay a <Money value={totals.advance_amount} /> eSewa advance and upload your payment proof. Remaining on delivery: <Money value={totals.remaining_due} />.</> : 'Advance amount will appear after delivery pricing is calculated.'}
          </p>
          <button
            className="btn block"
            style={{ marginTop: 14 }}
            disabled={placing || !totals || !destinationId || cart.has_stock_issue}
            onClick={placeOrder}
          >
            {placing ? 'Placing order' : 'Place order & continue to payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
