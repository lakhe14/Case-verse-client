import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { reviews as api } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState, Stars, StatusBadge } from '../../components/ui';

export default function MyReviews() {
  const { data, loading, error } = useAsync(() => api.mine({ limit: 30 }), []);
  const list = data?.data || [];

  if (loading) return <Spinner />;
  return (
    <div className="col">
      <h3 style={{ margin: 0 }}>My reviews</h3>
      <ErrorText error={error} />
      {list.length === 0 ? (
        <EmptyState title="You haven't reviewed anything yet">
          <p className="muted" style={{ maxWidth: '40ch', margin: '0 auto' }}>
            Once an order is delivered you can review it from the product page.
          </p>
        </EmptyState>
      ) : (
        list.map((r) => (
          <div key={r.id} className="card">
            <div className="spread">
              <Link to={`/p/${r.product?.slug}`} style={{ fontWeight: 600 }}>{r.product?.name}</Link>
              <StatusBadge status={r.status} />
            </div>
            <Stars value={r.rating} />
            {r.title && <div style={{ fontWeight: 600 }}>{r.title}</div>}
            <p className="small muted">{r.body}</p>
          </div>
        ))
      )}
    </div>
  );
}
