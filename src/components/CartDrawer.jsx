import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useCart } from '../context/CartContext';
import { motionTokens } from '../motion/motionConfig';
import { CartLine, CartTotals, DashainCartOffer, useCartLineActions } from './CartParts';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Cart drawer opened from the header and after Add to cart. It renders the
 * shared cart context only: no copy of the cart, no prices of its own.
 * Modal: focus moves in, Tab stays inside, Escape or the scrim closes it and
 * focus returns to whatever opened it.
 */
export default function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, drawerReturnFocusRef, syncError, refresh } = useCart();
  const { busyId, onQuantity, onRemove } = useCartLineActions();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const items = cart.items || [];

  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.body.classList.add('minicart-open');
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('minicart-open');
      const back = drawerReturnFocusRef.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [drawerOpen, closeDrawer, drawerReturnFocusRef]);

  let body;
  if (!items.length) {
    body = (
      <div className="minicart-body">
        <div className="minicart-empty">
          {syncError ? (
            <>
              <p>We couldn’t load your cart</p>
              <button type="button" className="btn subtle sm" onClick={() => refresh()}>Try again</button>
            </>
          ) : (
            <>
              <p>Your cart is empty</p>
              <p className="muted">Nothing here yet. Take a look around.</p>
              <Link to="/covers" className="btn subtle sm" onClick={closeDrawer}>Shop phone covers</Link>
            </>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="minicart-body">
          {items.map((item) => (
            <CartLine
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onQuantity={onQuantity}
              onRemove={onRemove}
              onNavigate={closeDrawer}
            />
          ))}
          <DashainCartOffer cart={cart} compact onNavigate={closeDrawer} />
        </div>
        <div className="minicart-foot">
          <CartTotals cart={cart} />
          <div className="minicart-actions">
            {cart.has_stock_issue ? (
              <button type="button" className="btn block" disabled>Fix stock issues to continue</button>
            ) : (
              <Link to="/checkout" className="btn block" onClick={closeDrawer}>Checkout</Link>
            )}
            <div className="minicart-secondary">
              <Link to="/cart" className="btn subtle" onClick={closeDrawer}>View cart</Link>
              <button type="button" className="btn ghost" onClick={closeDrawer}>Continue shopping</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            className="minicart-scrim is-open"
            onClick={closeDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTokens.duration.fast }}
          />
          <motion.aside
            ref={panelRef}
            className="minicart-panel is-open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="minicart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%', transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.exit } }}
            transition={motionTokens.spring.soft}
          >
            <div className="minicart-head">
              <h2 id="minicart-title">Your cart</h2>
              <span className="muted small minicart-count">{cart.item_count ? `${cart.item_count} item${cart.item_count === 1 ? '' : 's'}` : ''}</span>
              <button ref={closeRef} type="button" className="minicart-close" onClick={closeDrawer} aria-label="Close cart">
                ×
              </button>
            </div>
            {body}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
