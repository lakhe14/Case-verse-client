import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import { ErrorText } from '../../components/ui';

export default function StaffLogin() {
  const { staffLogin, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from?.pathname || '/admin';
  const form = useForm({ email: '', password: '' });

  if (isStaff) return <Navigate to={dest} replace />;

  const submit = form.handleSubmit(async (values) => {
    await staffLogin(values);
    navigate(dest, { replace: true });
  });

  return (
    <div className="admin-login-page">
      <div className="card" style={{ width: 380 }}>
        <h1>Staff sign in</h1>
        <ErrorText error={form.error} />
        <form onSubmit={submit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input name="email" type="email" value={form.values.email} onChange={form.onChange} required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input name="password" type="password" value={form.values.password} onChange={form.onChange} required />
          </label>
          <button className="btn block" disabled={form.submitting}>
            {form.submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {import.meta.env.DEV && (
          <p className="muted small" style={{ marginTop: 10 }}>
            Local development accounts are configured from the server environment.
          </p>
        )}
      </div>
    </div>
  );
}
