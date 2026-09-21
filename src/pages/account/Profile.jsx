import { useAuth } from '../../context/AuthContext';
import { whatsapp } from '../../config';

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="card">
      <h3>Profile</h3>
      <dl className="stack">
        <div className="spread"><dt className="muted">Name</dt><dd>{user.name}</dd></div>
        <div className="spread"><dt className="muted">Email</dt><dd>{user.email}</dd></div>
        <div className="spread"><dt className="muted">Phone</dt><dd>{user.phone || 'Not set'}</dd></div>
        <div className="spread"><dt className="muted">Loyalty points</dt><dd>{user.loyalty_points}</dd></div>
        <div className="spread">
          <dt className="muted">Member since</dt>
          <dd>{new Date(user.created_at).toLocaleDateString()}</dd>
        </div>
      </dl>
      <p className="muted small">
        To update your name, email or phone,{' '}
        {whatsapp.link ? (
          <a href={whatsapp.link} target="_blank" rel="noopener">message us</a>
        ) : (
          'contact us'
        )}{' '}
        and we’ll take care of it.
      </p>
    </div>
  );
}
