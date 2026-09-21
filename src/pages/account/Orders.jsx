import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { orders as api } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState, Money, StatusBadge } from '../../components/ui';

export default function Orders() {
  const { data, loading, error } = useAsync(() => api.listMine({ limit: 20 }), []);
  const list = data?.data || [];

  if (loading) return <Spinner />;
  return (
    <div className="col">
      <h3 style={{ margin: 0 }}>Orders</h3>
      <ErrorText error={error} />
      {list.length === 0 ? (
        <EmptyState title="No orders yet">
          <p className="muted" style={{ margin: '0 auto 14px' }}>When you place an order it’ll show up here.</p>
          <Link to="/shop" className="btn sm">Start shopping</Link>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_number}</td>
                  <td>{new Date(o.placed_at).toLocaleDateString()}</td>
                  <td>{o.items?.reduce((n, i) => n + i.quantity, 0) ?? 0}</td>
                  <td><Money value={o.total_amount} /></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><Link to={`/account/orders/${o.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
