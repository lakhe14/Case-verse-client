import { NavLink, Outlet } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';

const links = [
  ['/account', 'Profile', true],
  ['/account/addresses', 'Addresses'],
  ['/account/orders', 'Orders'],
  ['/account/loyalty', 'Loyalty points'],
  ['/account/reviews', 'My reviews'],
];

export default function AccountLayout() {
  usePageMeta('Your account', 'Manage your CaseVerse profile, addresses, orders, loyalty points and reviews.');
  return (
    <div>
      <h1>Your account</h1>
      <div className="account-shell">
        <nav className="account-nav">
          {links.map(([to, label, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="account-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
