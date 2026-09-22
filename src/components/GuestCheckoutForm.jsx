import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { guestCheckout } from '../api/endpoints';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Spinner, ErrorText, Money } from './ui';
import SalePrice from './SalePrice';

const EMPTY_GUEST = {
  name: '', phone: '', province: '', district: '', municipality: '', area: '', landmark: '', notes: '',
};

function useGeolocation() {
  const [status, setStatus] = useState('idle'); // idle | locating | done | denied | unavailable
  const [coords, setCoords] = useState(null);
  const [message, setMessage] = useState(null);

  const locate = () => {
    if (!window.isSecureContext) {
      setStatus('unavailable');
      setMessage('Location needs a secure (https) connection here — enter your address manually.');
      return;
    }
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setMessage('Your browser does not support location — enter your address manually.');
      return;
    }
    setStatus('locating');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus('done');
        setMessage('Location captured. Please still fill in your address below.');
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was not given — no problem, just fill in your address below.'
            : 'Could not get your location right now — enter your address manually.'
        );
      },
      { timeout: 8000 }
    );
  };

  return { status, coords, message, locate };
}

export default function GuestCheckoutForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { cart, clear } = useCart();
  const geo = useGeolocation();

  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState(null);

  const setField = (field) => (e) => setGuest((g) => ({ ...g, [field]: e.target.value }));

  useEffect(() => {
    const items = cart.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }));
    if (!items.length) return;
    setPreviewError(null);
    guestCheckout
      .preview({
        items,
        guest: guest.municipality && guest.province ? { municipality: guest.municipality, province: guest.province } : undefined,
      })
      .then((r) => setPreview(r.data))
      .catch((e) => {
        setPreview(null);
        setPreviewError(e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items, guest.municipality, guest.province]);

  const placeOrder = async (e) => {
    e.preventDefault();
    setPlacing(true);
    setPlaceError(null);
    try {
      const items = cart.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }));
      const res = await guestCheckout.place({
        items,
        guest: {
          ...guest,
          latitude: geo.coords?.latitude,
          longitude: geo.coords?.longitude,
        },
      });
      await clear();
      toast.success(`Order ${res.data.order_number} placed. Thank you!`);
      navigate(`/order/guest/${res.guest_token}`, { replace: true });
    } catch (err) {
      setPlaceError(err);
      toast.error(err.message || 'We couldn’t place your order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const totals = preview;

  return (
    <form onSubmit={placeOrder} className="row checkout-layout" style={{ alignItems: 'flex-start', gap: '32px 40px', flexWrap: 'wrap' }}>
      <div className="col checkout-form" style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div className="card">
          <h3>Your details</h3>
          <div className="stack">
            <label className="field">
              <span className="field-label">Full name</span>
              <input required value={guest.name} onChange={setField('name')} maxLength={120} />
            </label>
            <label className="field">
              <span className="field-label">Phone number</span>
              <input required value={guest.phone} onChange={setField('phone')} placeholder="98XXXXXXXX" maxLength={20} />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="spread" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Delivery address</h3>
            <button type="button" className="btn ghost sm" onClick={geo.locate} disabled={geo.status === 'locating'}>
              {geo.status === 'locating' ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          {geo.message && <p className="muted small" role="status">{geo.message}</p>}
          <div className="stack" style={{ marginTop: 8 }}>
            <label className="field">
              <span className="field-label">Province</span>
              <input required value={guest.province} onChange={setField('province')} maxLength={100} />
            </label>
            <label className="field">
              <span className="field-label">District</span>
              <input required value={guest.district} onChange={setField('district')} maxLength={100} />
            </label>
            <label className="field">
              <span className="field-label">Municipality / City</span>
              <input required value={guest.municipality} onChange={setField('municipality')} maxLength={150} />
            </label>
            <label className="field">
              <span className="field-label">Area / Street</span>
              <input required value={guest.area} onChange={setField('area')} maxLength={255} />
            </label>
            <label className="field">
              <span className="field-label">Landmark (optional)</span>
              <input value={guest.landmark} onChange={setField('landmark')} maxLength={255} />
            </label>
            <label className="field">
              <span className="field-label">Delivery notes (optional)</span>
              <textarea rows={2} value={guest.notes} onChange={setField('notes')} maxLength={500} />
            </label>
          </div>
        </div>

        <p className="muted small">
          Have an account? <Link to="/login" state={{ from: { pathname: '/checkout' } }}>Sign in</Link> instead to use saved
          details and see this order in your history.
        </p>
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
            <div className="checkout-price-lines">
              {(totals.lines || []).map((line) => (
                <div className="spread small" key={line.variant_id}>
                  <span>{line.name} × {line.quantity}</span>
                  <SalePrice price={line.unit_price} compareAt={line.compare_at_price} compact />
                </div>
              ))}
            </div>
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
            <div className="summary-row"><span className="muted">Shipping</span><Money value={totals.shipping_amount} /></div>
            <div className="summary-total"><span>Total</span><Money value={totals.total_amount} /></div>
            {totals.shipping_method && <p className="muted small" style={{ marginTop: 8 }}>{totals.shipping_method}</p>}
            {!totals.shipping_method && (
              <p className="muted small" style={{ marginTop: 8 }}>Fill in your municipality and province for an exact shipping cost.</p>
            )}
          </div>
        )}
        <ErrorText error={previewError} />
        <ErrorText error={placeError} />
        <p className="checkout-payment-note">
          After placing your order, you will be asked to pay a NPR 100 eSewa advance and upload your
          payment proof.{' '}
          {totals && <>Remaining on delivery: <Money value={Math.max(totals.total_amount - 100, 0)} />.</>}
        </p>
        <button type="submit" className="btn block" style={{ marginTop: 14 }} disabled={placing || !totals || !cart.items.length || cart.has_stock_issue}>
          {placing ? 'Placing order' : 'Place order & continue to payment'}
        </button>
      </div>
    </form>
  );
}
