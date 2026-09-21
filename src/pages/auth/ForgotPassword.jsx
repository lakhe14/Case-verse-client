import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth as authApi } from '../../api/endpoints';
import useForm from '../../hooks/useForm';
import { ErrorText } from '../../components/ui';

export default function ForgotPassword() {
  const form = useForm({ email: '' });
  const [sent, setSent] = useState(false);

  const submit = form.handleSubmit(async ({ email }) => {
    await authApi.forgotPassword(email);
    setSent(true);
  });

  return (
    <div className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
      <h1>Reset password</h1>
      {sent ? (
        <div className="alert ok">
          If an account exists for that email, we’ve sent a link to reset your password.
        </div>
      ) : (
        <>
          <ErrorText error={form.error} />
          <form onSubmit={submit}>
            <label className="field">
              <span className="field-label">Email</span>
              <input name="email" type="email" value={form.values.email} onChange={form.onChange} required />
            </label>
            <button className="btn block" disabled={form.submitting}>
              {form.submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
      <p className="small" style={{ marginTop: 12 }}>
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
