import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { guestCheckout, shipping as shippingApi } from '../api/endpoints';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Spinner, ErrorText, Money } from './ui';
import SalePrice from './SalePrice';
import { newIdempotencyKey } from '../utils/idempotencyKey';
import DestinationCombobox from './DestinationCombobox';
import useLocationPrefill, { areaFromAddress } from '../hooks/useLocationPrefill';

const EMPTY_GUEST = {
  name: '', phone: '', province: '', district: '', municipality: '', area: '', landmark: '', notes: '', parcelmoover_destination_id: '', parcelmoover_destination_name: '',
};

export default function GuestCheckoutForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { cart, clear } = useCart();
  const location = useLocationPrefill();
  const [destinationContext, setDestinationContext] = useState(null);

  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [destinationsError, setDestinationsError] = useState(null);
  const quoteRequest = useRef(0);
  // One Idempotency-Key per submission: double clicks, Enter and network
  // retries of the same payload reuse it; a changed payload gets a new one.
  const submission = useRef(null);
  const inFlight = useRef(false);

  const setField = (field) => (e) => setGuest((g) => ({ ...g, [field]: e.target.value }));

  useEffect(() => {
    shippingApi.parcelmooverDestinations().then((r) => setDestinations(r.data)).catch((e) => setDestinationsError(e));
  }, []);

  useEffect(() => {
    const items = cart.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }));
    if (!items.length) return;
    const requestId = ++quoteRequest.current;
    setPreview(null);
    setPreviewError(null);
    guestCheckout
      .preview({
        items,
        guest: guest.municipality && guest.province && guest.parcelmoover_destination_id ? { municipality: guest.municipality, province: guest.province, parcelmoover_destination_id: guest.parcelmoover_destination_id } : undefined,
      })
      .then((r) => { if (quoteRequest.current === requestId) setPreview(r.data); })
      .catch((e) => {
        if (quoteRequest.current === requestId) { setPreview(null); setPreviewError(e); }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items, guest.municipality, guest.province, guest.parcelmoover_destination_id]);

  const placeOrder = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPlacing(true);
    setPlaceError(null);
    const body = {
      items: cart.items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      // Address fields only: a looked-up position is never part of the order.
      guest,
    };
    const signature = JSON.stringify(body);
    if (!submission.current || submission.current.signature !== signature) {
      submission.current = { key: newIdempotencyKey(), signature };
    }
    const { key } = submission.current;
    try {
      let res;
      try {
        res = await guestCheckout.place(body, key);
      } catch (err) {
        // No response at all (dropped connection, timeout): the order may have
        // been created. Retry once with the SAME key; the server replays it.
        if (err.status) throw err;
        await new Promise((resolve) => setTimeout(resolve, 800));
        res = await guestCheckout.place(body, key);
      }
      submission.current = null;
      await clear();
      toast.success(`Order ${res.data.order_number} placed. Thank you!`);
      navigate(`/order/guest/${res.guest_token}`, { replace: true });
    } catch (err) {
      // A reused key means this attempt no longer matches the original one; the
      // next attempt starts a fresh submission.
      if (err.code === 'idempotency_key_reused') submission.current = null;
      setPlaceError(err);
      toast.error(err.message || 'We couldn’t place your order. Please try again.');
    } finally {
      inFlight.current = false;
      setPlacing(false);
    }
  };

  // Fills only what the lookup actually returned; every field stays editable.
  const fillFromLocation = async () => {
    const address = await location.locate();
    if (!address) return;
    const suggestion = address.suggested_destination;
    const destination = suggestion && destinations.find((item) => item.id === suggestion.id);
    setGuest((g) => ({
      ...g,
      province: address.province || g.province,
      district: address.district || g.district,
      municipality: address.municipality || g.municipality,
      area: areaFromAddress(address) || g.area,
      ...(destination ? { parcelmoover_destination_id: destination.id, parcelmoover_destination_name: destination.name } : {}),
    }));
    if (destination || !guest.parcelmoover_destination_id) {
      setDestinationContext({
        place: address.locality || null,
        municipality: address.municipality,
        district: address.district,
        destination: destination ? (destination.label || destination.name) : null,
        match: suggestion?.match || null,
      });
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
            <button type="button" className="btn ghost sm" onClick={fillFromLocation} disabled={location.status === 'detecting'}>
              {location.status === 'detecting' ? 'Detecting location…' : 'Use my location'}
            </button>
          </div>
          <LocationStatus location={location} />
          <div className="stack" style={{ marginTop: 8 }}>
            <DestinationCombobox
              destinations={destinations}
              value={guest.parcelmoover_destination_id}
              loadError={destinationsError}
              context={destinationContext}
              onChange={(id, destination) => setGuest((value) => ({ ...value, parcelmoover_destination_id: id, parcelmoover_destination_name: destination?.name || '' }))}
            />
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
              <p className="muted small" style={{ marginTop: 8 }}>Choose a ParcelMoover delivery destination and enter your physical address for an exact shipping cost.</p>
            )}
          </div>
        )}
        <ErrorText error={previewError} />
        <ErrorText error={placeError} />
        <p className="checkout-payment-note">
          {totals && totals.advance_amount != null ? <>After placing your order, you will be asked to pay a <Money value={totals.advance_amount} /> eSewa advance and upload your payment proof. Remaining on delivery: <Money value={totals.remaining_due} />.</> : 'Advance amount will appear after delivery pricing is calculated.'}
        </p>
        <button type="submit" className="btn block" style={{ marginTop: 14 }} disabled={placing || !totals || !guest.parcelmoover_destination_id || !cart.items.length || cart.has_stock_issue}>
          {placing ? 'Placing order' : 'Place order & continue to payment'}
        </button>
      </div>
    </form>
  );
}

function LocationStatus({ location }) {
  const { status, address, error } = location;
  if (status === 'idle') return null;
  let body;
  if (status === 'detecting') body = <p className="muted small">Detecting location…</p>;
  else if (status === 'detected') {
    const place = [address.locality || address.municipality, address.district].filter(Boolean).join(', ');
    body = (
      <>
        <p className="small" style={{ margin: 0 }}><strong>Location detected{place ? `: ${place}` : ''}</strong></p>
        <p className="muted small" style={{ margin: '4px 0 0' }}>We filled the available address details. Please review them.</p>
        <p className="muted small location-credit" style={{ margin: '4px 0 0' }}>Address data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p>
      </>
    );
  } else if (status === 'denied') body = <p className="small" style={{ margin: 0 }}><strong>Permission denied.</strong> Allow location access in your browser settings, or enter your address below.</p>;
  else if (status === 'timeout') body = <p className="small" style={{ margin: 0 }}><strong>Timeout.</strong> We could not get your location in time. Try again, or enter your address below.</p>;
  else if (status === 'unavailable') body = <p className="small" style={{ margin: 0 }}><strong>Location unavailable.</strong> Your device could not share a location here. Enter your address below.</p>;
  else body = <p className="small" style={{ margin: 0 }}><strong>Location detected, address not found.</strong> {error || 'Please enter your address below.'}</p>;
  return <div className="location-status" role="status" aria-live="polite" data-testid="location-status" data-status={status}>{body}</div>;
}
