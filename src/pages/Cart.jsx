import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Spinner, Money, EmptyState, QuantityStepper } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence, motion } from 'motion/react';
import { MotionButton } from '../motion/MotionPrimitives';
import SalePrice from '../components/SalePrice';

const BLANK_IMG =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export default function Cart() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const { isCustomer } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  usePageMeta('Your cart', 'Review the items in your CaseVerse cart before checkout.');

  const onUpdate = async (id, qty) => {
    try {
      await updateItem(id, qty);
    } catch (e) {
      toast.error(e.message || 'Could not update that item.');
    }
  };
  const onRemove = async (id) => {
    try {
      await removeItem(id);
      toast.success('Item removed from your cart.');
    } catch (e) {
      toast.error(e.message || 'Could not remove that item.');
    }
  };

  if (!isCustomer) {
    return (
      <EmptyState title="Sign in to see your cart">
        <p className="muted" style={{ maxWidth: '36ch', margin: '0 auto 14px' }}>
          Your cart is saved to your account, so sign in to pick up where you left off.
        </p>
        <Link to="/login" className="btn sm">Sign in</Link>
      </EmptyState>
    );
  }
  if (loading) return <Spinner />;
  if (!cart.items.length) {
    return (
      <EmptyState title="Your cart is empty">
        <p className="muted" style={{ margin: '0 auto 14px' }}>Nothing here yet. Take a look around.</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link to="/covers" className="btn sm">Shop phone covers</Link>
        </div>
      </EmptyState>
    );
  }

  return (
    <div>
      <h1>Cart</h1>
      <div className="row cart-layout" style={{ alignItems: 'flex-start', gap: '32px 40px', flexWrap: 'wrap' }}>
        <div className="cart-items" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <AnimatePresence initial={false}>
          {cart.items.map((item) => (
            <motion.div key={item.id} className="cart-line" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }} transition={{ duration: 0.2 }}>
              <img className="cart-thumb" src={item.product?.image || BLANK_IMG} alt="" loading="lazy" decoding="async" />
              <div style={{ flex: 1 }}>
                <Link to={`/p/${item.product?.slug}`} style={{ fontWeight: 500 }}>
                  {item.product?.name}
                </Link>
                <div className="muted small">SKU {item.sku}</div>
                {!item.stock_ok && (
                  <div className="stock-out small">Only {item.available_stock} available</div>
                )}
                <div style={{ marginTop: 8 }}>
                  <QuantityStepper
                    value={item.quantity}
                    min={1}
                    max={item.available_stock || 99}
                    onChange={(q) => onUpdate(item.id, q)}
                  />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <SalePrice price={item.unit_price} compareAt={item.compare_at_price} compact />
                <div className="money-serif" style={{ fontSize: '1.05rem' }}>
                  <Money value={item.line_total} />
                </div>
                <button className="btn ghost sm" onClick={() => onRemove(item.id)}>Remove</button>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>

        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cart.campaign_active && (
          <div className="card dashain-cart-card" aria-live="polite">
            {cart.bundle_discount > 0 ? (
              <>
                <p className="eyebrow">Dashain Trio Offer unlocked</p>
                <p className="dashain-cart-line">{cart.covers_qty} eligible case{cart.covers_qty === 1 ? '' : 's'} + FREE suction holder</p>
                <p className="muted small">
                  Regular <Money value={cart.covers_qty * 699} /> — Dashain price saves <Money value={cart.bundle_discount} />.
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow">Dashain Trio Offer</p>
                <p className="dashain-cart-line">Add 1 more eligible case to unlock 2 cases + a FREE suction holder for NPR 1,199.</p>
                <Link to="/covers" className="btn subtle sm">Shop another case</Link>
              </>
            )}
          </div>
        )}
        <div className="summary-box cart-summary">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, marginTop: 0 }}>Summary</h3>
          <div className="summary-row">
            <span className="muted">Subtotal</span>
            <Money value={cart.subtotal} />
          </div>
          {cart.bundle_discount > 0 && (
            <>
              <div className="summary-row">
                <span className="muted">Dashain bundle discount</span>
                <span style={{ whiteSpace: 'nowrap' }}>−<Money value={cart.bundle_discount} /></span>
              </div>
              {cart.free_items.map((item) => (
                <div className="summary-row" key={item.type}>
                  <span className="muted">{item.name} × {item.quantity}</span>
                  <span>FREE</span>
                </div>
              ))}
              <div className="summary-row">
                <span className="muted">Estimated total</span>
                <Money value={cart.estimated_total} />
              </div>
            </>
          )}
          <p className="muted small">
            {cart.bundle_discount > 0
              ? 'Coupons cannot be combined with the Dashain offer. Shipping is calculated at checkout.'
              : 'Shipping and any discounts are calculated at checkout.'}
          </p>
          <MotionButton
            className="btn block"
            style={{ marginTop: 8 }}
            disabled={cart.has_stock_issue}
            onClick={() => navigate('/checkout')}
          >
            {cart.has_stock_issue ? 'Fix stock issues to continue' : 'Checkout'}
          </MotionButton>
        </div>
        </div>
      </div>
    </div>
  );
}
