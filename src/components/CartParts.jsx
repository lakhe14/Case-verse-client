import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useCampaign } from '../hooks/useCampaign';
import { Money, QuantityStepper } from './ui';
import SalePrice from './SalePrice';
import { mediaUrl } from '../utils/mediaUrl';
import { stockState } from '../utils/stock';

export const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// Same sentence the checkout shows when it refuses a coupon for a bundle.
export const BUNDLE_COUPON_NOTE = 'Coupons can’t be combined with the Dashain Trio Offer.';

export function productLink(item) {
  const slug = item.product?.slug;
  if (!slug) return '/shop';
  return item.model ? `/p/${slug}?model=${encodeURIComponent(item.model)}` : `/p/${slug}`;
}

/** Quantity and remove handlers for cart lines; one line changes at a time. */
export function useCartLineActions() {
  const { updateItem, removeItem } = useCart();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const run = async (item, action, failure) => {
    setBusyId(item.id);
    try {
      await action();
      return true;
    } catch (e) {
      toast.error(e.message || failure);
      return false;
    } finally {
      setBusyId(null);
    }
  };
  return {
    busyId,
    onQuantity: (item, quantity) => run(item, () => updateItem(item.id, quantity), 'Could not update that item.'),
    onRemove: async (item) => {
      const name = item.product?.name || 'Item';
      if (await run(item, () => removeItem(item.id), 'Could not remove that item.')) {
        toast.success(`${name}${item.model ? ` (${item.model})` : ''} removed from your cart.`);
      }
    },
  };
}

function LineStock({ item }) {
  if (!item.stock_ok) {
    return (
      <p className="stock-out small cart-line-stock" role="status">
        {item.available_stock > 0
          ? `Only ${item.available_stock} available. Lower the quantity to continue.`
          : 'This model is sold out. Remove it to continue.'}
      </p>
    );
  }
  const state = stockState(item.available_stock);
  return state.kind === 'low' ? <p className="stock-low small cart-line-stock">{state.label}</p> : null;
}

/**
 * One cart line, shared by the cart drawer and the /cart page. Every number
 * shown is the server's (unit price, line total, available stock); the
 * quantity buttons call the cart context, which asks the server again.
 */
export function CartLine({ item, busy, onQuantity, onRemove, onNavigate }) {
  const name = item.product?.name || 'Cover';
  const label = item.model ? `${name}, ${item.model}` : name;
  const maxQty = Math.max(item.quantity, item.available_stock || 0, 1);
  return (
    <div className="cart-line" data-testid="cart-line" data-variant-id={item.variant_id} aria-busy={busy || undefined}>
      <Link to={productLink(item)} className="cart-thumb-link" onClick={onNavigate} tabIndex={-1} aria-hidden="true">
        <img className="cart-thumb" src={mediaUrl(item.product?.image) || BLANK_IMG} alt="" loading="lazy" decoding="async" />
      </Link>
      <div className="cart-line-main">
        <Link to={productLink(item)} className="cart-line-name" onClick={onNavigate}>{name}</Link>
        {item.model && <p className="cart-line-model">{item.model}</p>}
        <LineStock item={item} />
        <div className="cart-line-foot">
          <QuantityStepper
            value={item.quantity}
            min={1}
            max={maxQty}
            disabled={busy}
            label={label}
            onChange={(q) => q !== item.quantity && onQuantity(item, q)}
          />
          <div className="cart-line-prices">
            <span className="cart-line-unit">
              <SalePrice price={item.unit_price} compareAt={item.compare_at_price} compact />
              <span className="muted"> each</span>
            </span>
            <strong className="cart-line-total" data-testid="line-total"><Money value={item.line_total} /></strong>
          </div>
        </div>
        <button type="button" className="cart-line-remove" disabled={busy} onClick={() => onRemove(item)} aria-label={`Remove ${label}`}>
          Remove
        </button>
      </div>
    </div>
  );
}

/**
 * Dashain Trio status for the current cart. Whether the campaign is on, how
 * many pairs are priced and the saving all come from the server's cart; the
 * campaign record only supplies the offer's wording (pair size, price).
 */
export function DashainCartOffer({ cart, compact = false, onNavigate }) {
  const campaign = useCampaign();
  if (!cart.campaign_active || !cart.covers_qty) return null;
  const size = campaign?.required_case_quantity || 2;
  const pairs = cart.bundle_pairs || 0;
  const missing = size - (cart.covers_qty % size);
  const holders = cart.free_items?.reduce((n, f) => n + f.quantity, 0) || 0;
  const price = campaign?.bundle_price;

  return (
    <div className={`dashain-cart-card${compact ? ' is-compact' : ''}`} data-testid="dashain-offer" aria-live="polite">
      {pairs > 0 ? (
        <>
          <p className="eyebrow">Dashain Trio Offer applied</p>
          <p className="dashain-cart-line">
            {pairs} bundle pair{pairs === 1 ? '' : 's'} + {holders} FREE suction holder{holders === 1 ? '' : 's'}
          </p>
          <p className="dashain-cart-save">You save <Money value={cart.bundle_discount} /></p>
          {missing < size && (
            <p className="muted small">Add {missing} more eligible case to make another pair.</p>
          )}
        </>
      ) : (
        <>
          <p className="eyebrow">Dashain Trio Offer</p>
          <p className="dashain-cart-line">
            Add {missing} more eligible case to get {size} cases + a FREE suction holder
            {price != null && <> for NPR {price.toLocaleString()}</>}.
          </p>
          {!compact && <Link to="/covers" className="btn subtle sm" onClick={onNavigate}>Shop another case</Link>}
        </>
      )}
    </div>
  );
}

/** Money summary before shipping. Checkout re-prices everything on the server again. */
export function CartTotals({ cart }) {
  const { isCustomer } = useAuth();
  const bundle = cart.bundle_discount > 0;
  let couponNote;
  if (cart.coupon_allowed === false) couponNote = `${BUNDLE_COUPON_NOTE} Your bundle saving is already applied.`;
  else if (isCustomer) couponNote = 'Have a coupon? Apply it at checkout.';
  else couponNote = 'Coupons need an account. Sign in before checkout to use one.';

  return (
    <div className="cart-totals" data-testid="cart-totals">
      <div className="summary-row">
        <span className="muted">Subtotal</span>
        <Money value={cart.subtotal} />
      </div>
      {bundle && (
        <div className="summary-row">
          <span className="muted">Dashain bundle discount</span>
          <span className="summary-saving">−<Money value={cart.bundle_discount} /></span>
        </div>
      )}
      {(cart.free_items || []).map((item) => (
        <div className="summary-row" key={item.type}>
          <span className="muted">{item.name} × {item.quantity}</span>
          <span>FREE</span>
        </div>
      ))}
      <div className="summary-row">
        <span className="muted">Shipping</span>
        <span className="muted">At checkout</span>
      </div>
      <div className="summary-row summary-total">
        <span>Total before shipping</span>
        <strong data-testid="cart-total"><Money value={cart.estimated_total} /></strong>
      </div>
      <p className="muted small cart-coupon-note" data-testid="cart-coupon-note">{couponNote}</p>
    </div>
  );
}
