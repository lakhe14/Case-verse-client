import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import { ErrorText } from '../../components/ui';
import usePageMeta from '../../hooks/usePageMeta';

export default function Login() {
  const { login, isCustomer } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from?.pathname || '/';
  const form = useForm({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  usePageMeta('Sign in', 'Sign in to your CaseVerse account.');

  if (isCustomer) return <Navigate to={dest} replace />;

  const submit = form.handleSubmit(async (values) => {
    const res = await login(values);
    toast.success(`Welcome back, ${res.user?.name?.split(' ')[0] || 'there'}.`);
    navigate(dest, { replace: true });
  });

  return (
    <div className="card auth-card"><p className="auth-kicker">CASEVERSE / ACCOUNT</p>
      <h1>Welcome back.</h1><p className="auth-intro">Sign in to manage your covers, orders and saved favourites.</p>
      <ErrorText error={form.error} />
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">Email</span>
          <input name="email" type="email" placeholder="you@example.com" value={form.values.email} onChange={form.onChange} required />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Your password" value={form.values.password} onChange={form.onChange} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></span>
        </label>
        <button className="btn block" disabled={form.submitting}>
          {form.submitting ? 'Signing in' : 'Sign in'}
        </button>
      </form>
      <p className="small" style={{ marginTop: 16 }}>
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>
      <p className="small">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
