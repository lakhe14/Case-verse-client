import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

export function ProtectedRoute({ children }) {
  const { status, isCustomer } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Spinner />;
  if (!isCustomer) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// Admin pages: guests go to the staff sign-in, signed-in customers back to
// their own account. The API enforces staff permissions independently.
export function StaffRoute({ children, permission }) {
  const { status, isStaff, isCustomer, can } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Spinner />;
  if (isCustomer) return <Navigate to="/account" replace />;
  if (!isStaff) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  if (permission && !can(permission)) {
    return (
      <div className="admin-main">
        <div className="alert error">You don't have the “{permission}” permission.</div>
      </div>
    );
  }
  return children;
}

/** The staff sign-in page is part of /admin/*: a signed-in customer is sent to their account. */
export function StaffLoginRoute({ children }) {
  const { status, isCustomer } = useAuth();
  if (status === 'loading') return <Spinner />;
  if (isCustomer) return <Navigate to="/account" replace />;
  return children;
}
