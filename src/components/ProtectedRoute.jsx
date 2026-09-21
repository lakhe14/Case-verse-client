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

export function StaffRoute({ children, permission }) {
  const { status, isStaff, can } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Spinner />;
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
