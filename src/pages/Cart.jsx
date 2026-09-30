import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Spinner, Money, EmptyState } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence, motion } from 'motion/react';
import { MotionButton } from '../motion/MotionPrimitives';
import { CartLine, CartTotals, DashainCartOffer, useCartLineActions } from '../components/CartParts';

export default function Cart() {
  const { cart, loading, syncError, refresh } = useCart();
  const { busyId, onQuantity, onRemove } = useCartLineActions();
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const hasItems = cart.items.length > 0;
  // The phone bar steps aside while the summary's own Checkout is on screen.
  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setSummaryVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasItems]);
  usePageMeta('Your cart', 'Review the items in your CaseVerse cart before checkout.');

  if (loading && !cart.items.length) return <Spinner />;
  if (!cart.items.length) {
    if (syncError) {
      return (
        <EmptyState title="We couldn’t load your cart">
          <p className="muted" style={{ margin: '0 auto 14px' }}>Your items are safe. Check your connection and try again.</p>
          <button type="button" className="btn sm" onClick={() => refresh()}>Try again</button>
        </EmptyState>
      );
    }
    return (
      <EmptyState title="Your cart is empty">
        <p className="muted" style={{ margin: '0 auto 14px' }}>Nothing here yet. Take a look around.</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Link to="/covers" className="btn sm">Shop phone covers</Link>
        </div>
      </EmptyState>
    );
  }

  const checkout = (
    <MotionButton className="btn block" disabled={cart.has_stock_issue} onClick={() => navigate('/checkout')}>
      {cart.has_stock_issue ? 'Fix stock issues to continue' : 'Checkout'}
    </MotionButton>
  );

  return (
    <div className="cart-page">
      <h1>Cart</h1>
      <div className="row cart-layout" style={{ alignItems: 'flex-start', gap: '32px 40px', flexWrap: 'wrap' }}>
        <div className="cart-items" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <AnimatePresence initial={false}>
            {cart.items.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <CartLine item={item} busy={busyId === item.id} onQuantity={onQuantity} onRemove={onRemove} />
              </motion.div>
            ))}
          </AnimatePresence>
          <Link to="/covers" className="muted small cart-continue">Continue shopping</Link>
        </div>

        <div className="cart-side" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DashainCartOffer cart={cart} />
          <div className="summary-box cart-summary" ref={summaryRef}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, marginTop: 0 }}>Summary</h3>
            <CartTotals cart={cart} />
            {checkout}
          </div>
        </div>
      </div>

      {/* Phones: the total and Checkout stay in reach while scrolling the lines. */}
      <div className={`cart-sticky-bar${summaryVisible ? ' is-hidden' : ''}`} aria-hidden="true">
        <div>
          <span className="muted small">Total before shipping</span>
          <strong><Money value={cart.estimated_total} /></strong>
        </div>
        <button type="button" className="btn" tabIndex={-1} disabled={cart.has_stock_issue} onClick={() => navigate('/checkout')}>
          Checkout
        </button>
      </div>
    </div>
  );
}
