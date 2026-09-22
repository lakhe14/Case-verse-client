import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Money, QuantityStepper } from './ui';
import SalePrice from './SalePrice';
import SaleBanner from './SaleBanner';
import { whatsapp, contact } from '../config';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PageTransition } from '../motion/MotionPrimitives';
import { motionTokens } from '../motion/motionConfig';
import { useNavScroll } from '../hooks/useNavScroll';

const BLANK_IMG =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// Friendly path for a category slug (falls back to /shop?category=).
export function categoryPath(slug) {
  if (/cover/.test(slug)) return '/covers';
  return `/shop?category=${slug}`;
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-4.3A8.5 8.5 0 1 1 21 11.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function ContactPill({ className = 'contact-pill' }) {
  if (!whatsapp.link) return null;
  return (
    <a className={className} href={whatsapp.link} target="_blank" rel="noopener">
      <ChatBubbleIcon />
      Contact us
    </a>
  );
}

const PRIMARY_LINKS = [
  ['/covers', 'Phone covers'],
  ['/shop', 'All'],
  ['/reviews', 'Reviews'],
];

function CartPill({ count }) {
  const [bumped, setBumped] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 460);
      prev.current = count;
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count]);

  if (count <= 0) return null;
  return <span className={`cart-pill ${bumped ? 'is-bumped' : ''}`}>{count}</span>;
}

function Navbar({ onCartOpen, cartButtonRef, scrolled, recede }) {
  const { isCustomer, user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const reduce = useReducedMotion();
  const drawerRef = useRef(null);
  const toggleRef = useRef(null);
  const menuId = 'nav-mobile-menu';

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // One listener pair for both dismiss gestures; only attached while open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (e) => {
      if (drawerRef.current?.contains(e.target) || toggleRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);
  const openCart = () => {
    close();
    onCartOpen();
  };

  return (
    <motion.header
      className={`nav ${scrolled ? 'is-scrolled' : ''}`}
      initial={false}
      animate={reduce ? undefined : { y: recede && !menuOpen ? -10 : 0 }}
      transition={{ duration: motionTokens.duration.normal, ease: motionTokens.ease.standard }}
    >
      <div className="nav-inner">
        <Link to="/" className="brand">CaseVerse</Link>

        <nav className="nav-primary" aria-label="Primary">
          {PRIMARY_LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} className="navlink">{({ isActive }) => <>{label}{isActive && <motion.i className="nav-active-indicator" layoutId="nav-active-indicator" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}</>}</NavLink>
          ))}
        </nav>

        <span className="spacer" />

        <div className="nav-right">
          <NavLink to="/wishlist" className="navlink">Wishlist</NavLink>
          <button ref={cartButtonRef} type="button" className="navlink" onClick={onCartOpen} aria-haspopup="dialog">
            Cart<CartPill count={itemCount} />
          </button>
          {isCustomer ? (
            <>
              <NavLink to="/account" className="navlink">{user?.name?.split(' ')[0] || 'Account'}</NavLink>
              <button className="btn ghost sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <NavLink to="/login" className="navlink">Sign in</NavLink>
          )}
          <ContactPill />
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={`nav-toggle-bars ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <AnimatePresence>
      {menuOpen && (
        <motion.div
          id={menuId}
          ref={drawerRef}
          role="menu"
          className="nav-drawer"
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: motionTokens.duration.normal, ease: motionTokens.ease.standard }}
        >
          <div className="nav-drawer-inner">
            {PRIMARY_LINKS.map(([to, label]) => (
              <NavLink key={to} to={to} className="nav-drawer-link" onClick={close}>{label}</NavLink>
            ))}
            <div className="nav-drawer-rule" />
            <NavLink to="/wishlist" className="nav-drawer-link" onClick={close}>Wishlist</NavLink>
            <button type="button" className="nav-drawer-link nav-drawer-btn" onClick={openCart}>
              Cart{itemCount > 0 ? ` (${itemCount})` : ''}
            </button>
            {isCustomer ? (
              <>
                <NavLink to="/account" className="nav-drawer-link" onClick={close}>Your account</NavLink>
                <button type="button" className="nav-drawer-link nav-drawer-btn" onClick={() => { close(); logout(); }}>
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login" className="nav-drawer-link" onClick={close}>Sign in</NavLink>
            )}
            {whatsapp.link && (
              <a
                className="nav-drawer-link"
                href={whatsapp.link}
                target="_blank"
                rel="noopener"
                onClick={close}
              >
                Contact us
              </a>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.header>
  );
}

function MiniCartDrawer({ open, onClose, returnFocusRef }) {
  const { cart, updateItem, removeItem } = useCart();
  const toast = useToast();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const items = cart.items || [];

  useEffect(() => {
    const panel = panelRef.current;
    if (panel) panel.inert = !open;
    if (!open) return;

    document.body.classList.add('minicart-open');
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 60);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('minicart-open');
      returnFocusRef?.current?.focus?.();
    };
  }, [open, onClose, returnFocusRef]);

  const onQty = async (id, q) => {
    try {
      await updateItem(id, q);
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

  let body;
  if (items.length === 0) {
    body = (
      <div className="minicart-body">
        <div className="minicart-empty">
          <p>Your cart is empty</p>
          <p className="muted">Nothing here yet. Take a look around.</p>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="minicart-body">
          {items.map((item) => (
            <div className="minicart-line" key={item.id}>
              <img className="minicart-thumb" src={item.product?.image || BLANK_IMG} alt="" loading="lazy" />
              <div className="minicart-line-main">
                <Link to={`/p/${item.product?.slug}`} className="minicart-line-name" onClick={onClose}>
                  {item.product?.name}
                </Link>
                <div className="minicart-line-meta">SKU {item.sku}</div>
                {!item.stock_ok && (
                  <div className="stock-out small">Only {item.available_stock} available</div>
                )}
                <div className="minicart-line-foot">
                  <QuantityStepper
                    value={item.quantity}
                    min={1}
                    max={item.available_stock || 99}
                    onChange={(q) => onQty(item.id, q)}
                  />
                  <span className="minicart-line-price"><SalePrice price={item.unit_price} compareAt={item.compare_at_price} compact /><small>× {item.quantity}</small></span>
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ paddingLeft: 0, marginTop: 2 }}
                  onClick={() => onRemove(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="minicart-foot">
          <div className="minicart-subtotal"><span>Subtotal</span><Money value={cart.subtotal} /></div>
          <p className="muted">Shipping and any discounts are calculated at checkout.</p>
          <div className="minicart-actions">
            <Link to="/checkout" className="btn block" onClick={onClose}>Checkout</Link>
            <Link to="/cart" className="btn subtle block" onClick={onClose}>View full cart</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <AnimatePresence>
      {open && <>
      <motion.div className="minicart-scrim is-open" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.fast }} />
      <motion.aside
        ref={panelRef}
        className="minicart-panel is-open"
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={motionTokens.spring.soft}>
        <div className="minicart-head">
          <h2>Your cart</h2>
          <button ref={closeRef} type="button" className="minicart-close" onClick={onClose} aria-label="Close cart">
            ×
          </button>
        </div>
        {body}
      </motion.aside>
      </>}
    </AnimatePresence>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="foot-brand">CaseVerse</div>
            <p>iPhone covers, selected for a precise fit and shipped across Nepal.</p>
            <Link to="/contact">Contact us</Link>
          </div>

          <nav className="footer-col" aria-label="Shop">
            <h4>Shop</h4>
            <Link to="/covers">Phone covers</Link>
            <Link to="/shop">Everything</Link>
            <Link to="/reviews">Reviews</Link>
          </nav>

          <nav className="footer-col" aria-label="Customer care">
            <h4>Customer care</h4>
            <Link to="/faq">FAQ</Link><Link to="/shipping">Shipping & delivery</Link><Link to="/returns">Returns & refunds</Link><Link to="/contact">Contact</Link>
          </nav>
          <nav className="footer-col" aria-label="Legal">
            <h4>Legal</h4><Link to="/terms">Terms & conditions</Link><Link to="/privacy">Privacy policy</Link>
          </nav>
          <nav className="footer-col" aria-label="Account">
            <h4>Account</h4><Link to="/account">My account</Link><Link to="/account/orders">Orders</Link><Link to="/wishlist">Wishlist</Link>
          </nav>

          <div className="footer-col">
            <h4>Contact</h4>
            {whatsapp.link && (
              <a href={whatsapp.link} target="_blank" rel="noopener">Message us on WhatsApp</a>
            )}
            {contact.phoneTel && (
              <a href={`tel:${contact.phoneTel}`}>{contact.phoneDisplay}</a>
            )}
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          </div>
        </div>

        <p className="footer-legal">© {new Date().getFullYear()} CaseVerse <span><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link></span></p>
      </div>
    </footer>
  );
}

export default function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const cartButtonRef = useRef(null);
  const navStackRef = useRef(null);
  const location = useLocation();
  const { scrolled, recede } = useNavScroll();

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  // Close the drawer on navigation (a link inside it was followed).
  useEffect(() => {
    setCartOpen(false);
  }, [location.pathname]);

  // Non-home pages need real top padding now that the nav floats out of
  // flow; measure the banner+navbar stack instead of guessing a constant.
  useEffect(() => {
    const el = navStackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => document.documentElement.style.setProperty('--nav-clearance', `${el.offsetHeight}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="storefront">
      <div className="nav-stack" ref={navStackRef}>
        <SaleBanner recede={recede} />
        <Navbar onCartOpen={openCart} cartButtonRef={cartButtonRef} scrolled={scrolled} recede={recede} />
      </div>
      <main className={location.pathname === '/' ? 'page page--home' : 'content-shell page'}>
        <PageTransition calm={location.pathname === '/checkout'} key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
      <MiniCartDrawer open={cartOpen} onClose={closeCart} returnFocusRef={cartButtonRef} />
    </div>
  );
}
