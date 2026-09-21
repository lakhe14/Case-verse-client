import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import { ErrorText } from '../../components/ui';
import { useState } from 'react';

export default function StaffLogin() {
  const { staffLogin, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from?.pathname || '/admin';
  const form = useForm({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

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
            <span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} value={form.values.password} onChange={form.onChange} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></span>
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
