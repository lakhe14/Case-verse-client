import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { auth as authApi } from '../../api/endpoints';
import useForm from '../../hooks/useForm';
import { ErrorText } from '../../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const form = useForm({ password: '', confirm: '' });
  const [done, setDone] = useState(false);

  const submit = form.handleSubmit(async ({ password, confirm }) => {
    if (password !== confirm) {
      form.setError(new Error('Passwords do not match'));
      return;
    }
    await authApi.resetPassword({ token, password });
    setDone(true);
    setTimeout(() => navigate('/login'), 1500);
  });

  if (!token) {
    return (
      <div className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
        <div className="alert error">Missing reset token in the link.</div>
        <Link to="/forgot-password">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
      <h1>Set a new password</h1>
      {done ? (
        <div className="alert ok">Password updated. Redirecting to sign in…</div>
      ) : (
        <>
          <ErrorText error={form.error} />
          <form onSubmit={submit}>
            <label className="field">
              <span className="field-label">New password</span>
              <input name="password" type="password" minLength={8} value={form.values.password} onChange={form.onChange} required />
            </label>
            <label className="field">
              <span className="field-label">Confirm password</span>
              <input name="confirm" type="password" value={form.values.confirm} onChange={form.onChange} required />
            </label>
            <button className="btn block" disabled={form.submitting}>
              {form.submitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
