import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, Money, Pagination, StatusBadge } from '../../components/ui';

const STATUSES = ['', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, loading, error } = useAsync(
    () => admin.orders({ page, limit: 20, status: status || undefined }),
    [page, status]
  );

  return (
    <div className="col">
      <h1>Orders</h1>
      <div className="row">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            className={`btn sm ${status === s ? '' : 'subtle'}`}
            onClick={() => { setStatus(s); setPage(1); }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {(data?.data || []).map((o) => (
                  <tr key={o.id}>
                    <td>{o.order_number}</td>
                    <td>{o.user ? o.user.name : `${o.guest_name} (guest)`}<div className="muted small">{o.user ? o.user.email : o.guest_phone}</div></td>
                    <td>{new Date(o.placed_at).toLocaleDateString()}</td>
                    <td><Money value={o.total_amount} /></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><Link to={`/admin/orders/${o.id}`}>Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.pagination?.page || 1} pages={data?.pagination?.pages || 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}
