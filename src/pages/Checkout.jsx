import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { addresses as addressApi, orders as orderApi, loyalty as loyaltyApi } from '../api/endpoints';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner, ErrorText, Money, EmptyState } from '../components/ui';
import SalePrice from '../components/SalePrice';
import GuestCheckoutForm from '../components/GuestCheckoutForm';
import usePageMeta from '../hooks/usePageMeta';

export default function Checkout() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isCustomer } = useAuth();
  const { cart, refresh } = useCart();
  usePageMeta('Checkout', 'Complete your CaseVerse order.');

  const [addrs, setAddrs] = useState(null);
  const [shippingId, setShippingId] = useState(null);
  const [billingSame, setBillingSame] = useState(true);
  const [billingId, setBillingId] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState(null);
  const [loadError, setLoadError] = useState(null);

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
  }, [isCustomer]);

  useEffect(() => {
    if (!isCustomer || !shippingId) return;
    setPreviewError(null);
    orderApi
      .preview({
        shipping_address_id: shippingId,
        coupon_code: appliedCoupon || undefined,
        redeem_points: redeemPoints || undefined,
      })
      .then(setPreview)
      .catch((e) => {
        setPreviewError(e);
        setPreview(null);
      });
  }, [shippingId, appliedCoupon, redeemPoints]);
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
    setAppliedCoupon(code);
    if (code) toast.info(`Checking coupon ${code}…`);
  };

  const removeCoupon = () => {
    setAppliedCoupon('');
    setCouponCode('');
  };

  const placeOrder = async () => {
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await orderApi.place({
        shipping_address_id: shippingId,
        billing_address_id: billingSame ? shippingId : billingId,
        coupon_code: appliedCoupon || undefined,
        redeem_points: redeemPoints || undefined,
      });
      await refresh();
      toast.success(`Order ${res.data.order_number} placed. Thank you!`);
      navigate(`/account/orders/${res.data.id}`, { replace: true });
    } catch (e) {
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
            {totals?.campaign_active ? (
              <p className="muted small" style={{ marginBottom: 0 }}>
                Coupon codes cannot be combined with the Dashain Trio Offer.
              </p>
            ) : (
              <form className="row" style={{ gap: 8 }} onSubmit={applyCoupon}>
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
            <Spinner />
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
            After placing your order, you will be asked to pay a NPR 100 eSewa advance and upload
            your payment proof.{' '}
            {totals && (
              <>Remaining on delivery: <Money value={Math.max(totals.total_amount - 100, 0)} />.</>
            )}
          </p>
          <button
            className="btn block"
            style={{ marginTop: 14 }}
            disabled={placing || !totals || cart.has_stock_issue}
            onClick={placeOrder}
          >
            {placing ? 'Placing order' : 'Place order & continue to payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
