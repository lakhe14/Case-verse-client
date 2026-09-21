import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import { ErrorText } from '../../components/ui';
import usePageMeta from '../../hooks/usePageMeta';

export default function Register() {
  const { register, isCustomer } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm({ name: '', email: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  usePageMeta('Create an account', 'Create a CaseVerse account to check out faster and track your orders.');

  if (isCustomer) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    await register({ ...values, phone: values.phone || undefined });
    toast.success('Account created. You’re signed in.');
    navigate('/', { replace: true });
  });

  return (
    <div className="card auth-card"><p className="auth-kicker">CASEVERSE / ACCOUNT</p>
      <h1>Make it yours.</h1><p className="auth-intro">Save your favourites and check out faster.</p>
      <ErrorText error={form.error} />
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input name="name" placeholder="Your name" value={form.values.name} onChange={form.onChange} required />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input name="email" type="email" placeholder="you@example.com" value={form.values.email} onChange={form.onChange} required />
        </label>
        <label className="field">
          <span className="field-label">Phone (optional)</span>
          <input name="phone" placeholder="Optional" value={form.values.phone} onChange={form.onChange} />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" minLength={8} value={form.values.password} onChange={form.onChange} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></span>
          <span className="muted small">At least 8 characters.</span>
        </label>
        <button className="btn block" disabled={form.submitting}>
          {form.submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="small" style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
