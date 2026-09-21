import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  ['/admin', 'Dashboard', 'view_analytics', true],
  ['/admin/products', 'Products', 'manage_products'],
  ['/admin/attributes', 'Attributes', 'manage_products'],
  ['/admin/orders', 'Orders', 'manage_orders'],
  ['/admin/payment-confirmations', 'Payment review', 'manage_order_payments'],
  ['/admin/reviews', 'Reviews', 'manage_reviews'],
  ['/admin/coupons', 'Coupons', 'manage_coupons'],
  ['/admin/customers', 'Customers', 'manage_customers'],
  ['/admin/staff', 'Staff & roles', 'manage_staff'],
  ['/admin/settings', 'Settings', 'manage_settings'],
];

function currentPageLabel(pathname) {
  const match = NAV.filter(([to]) => to !== '/admin' && pathname.startsWith(to)).sort(
    (a, b) => b[0].length - a[0].length
  )[0];
  return match ? match[1] : 'Dashboard';
}

function NavItems({ can, onNavigate }) {
  return NAV.filter(([, , perm]) => !perm || can(perm)).map(([to, label, , end]) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => (isActive ? 'active' : '')}
    >
      {label}
    </NavLink>
  ));
}

function StaffFooter({ staff, logout }) {
  return (
    <div className="admin-side-foot">
      <div className="muted small">{staff?.name}</div>
      <div className="muted small">{staff?.role}</div>
      <button className="btn ghost sm" style={{ marginTop: 8, paddingLeft: 0 }} onClick={logout}>
        Log out
      </button>
      <div style={{ marginTop: 8 }}>
        <Link to="/" className="small">View storefront</Link>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { staff, can, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef(null);
  const drawerRef = useRef(null);
  const menuBtnRef = useRef(null);

  // Close the drawer whenever the route changes (a link inside it was followed).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer) drawer.inert = !menuOpen;
    if (!menuOpen) return undefined;
    document.body.classList.add('minicart-open'); // reuse the scroll-lock class
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      document.body.classList.remove('minicart-open');
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      menuBtnRef.current?.focus?.();
    };
  }, [menuOpen]);

  return (
    <div className="admin-shell">
      {/* Desktop sidebar */}
      <aside className="admin-side">
        <Link
          to="/admin"
          className="brand"
          style={{ display: 'block', padding: '2px 12px', marginBottom: 24, fontSize: '1.15rem', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          CaseVerse Admin
        </Link>
        <NavItems can={can} />
        <StaffFooter staff={staff} logout={logout} />
      </aside>

      {/* Mobile top bar */}
      <div className="admin-topbar">
        <button
          ref={menuBtnRef}
          type="button"
          className="admin-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={`nav-toggle-bars ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="admin-topbar-title">
          <span className="admin-topbar-brand">CaseVerse Admin</span>
          <span className="admin-topbar-page">{currentPageLabel(location.pathname)}</span>
        </div>
      </div>

      {/* Mobile slide-out drawer */}
      <div
        className={`admin-drawer-scrim ${menuOpen ? 'is-open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        ref={drawerRef}
        className={`admin-drawer ${menuOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
      >
        <div className="admin-drawer-head">
          <Link to="/admin" className="brand" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            CaseVerse Admin
          </Link>
          <button
            ref={closeRef}
            type="button"
            className="admin-drawer-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>
        <nav className="admin-drawer-nav">
          <NavItems can={can} onNavigate={() => setMenuOpen(false)} />
        </nav>
        <StaffFooter staff={staff} logout={logout} />
      </aside>

      <main className="admin-main">
        <header className="admin-desktop-bar">
          <div><span className="admin-crumb">CASEVERSE / OPERATIONS</span></div>
          <div className="admin-user-chip"><span>{staff?.name?.slice(0, 1) || 'A'}</span><div><b>{staff?.name}</b><small>{staff?.role}</small></div></div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
