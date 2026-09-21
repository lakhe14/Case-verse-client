import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState, Stars, StatusBadge } from '../../components/ui';

export default function AdminReviews() {
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(
    () => admin.reviews({ status: status || undefined, limit: 30 }),
    [status]
  );

  const moderate = async (id, s) => {
    await admin.moderateReview(id, s);
    reload();
  };

  return (
    <div className="col">
      <h1>Reviews</h1>
      <div className="row">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s || 'all'} className={`btn sm ${status === s ? '' : 'subtle'}`} onClick={() => setStatus(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
      {loading ? (
        <Spinner />
      ) : !data?.data?.length ? (
        <EmptyState title="Nothing here" />
      ) : (
        data.data.map((r) => (
          <div key={r.id} className="card">
            <div className="spread">
              <div>
                <strong>{r.product?.name}</strong> <Stars value={r.rating} />
                <div className="muted small">{r.user?.name}, {r.user?.email}</div>
                <div className="muted small">{new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            {r.title && <div style={{ fontWeight: 600, marginTop: 6 }}>{r.title}</div>}
            <p className="small">{r.body}</p>
            {r.status !== 'approved' && <button className="btn sm" onClick={() => moderate(r.id, 'approved')}>Approve</button>}
            {r.status !== 'rejected' && <button className="btn subtle sm" onClick={() => moderate(r.id, 'rejected')}>Reject</button>}
          </div>
        ))
      )}
    </div>
  );
}
