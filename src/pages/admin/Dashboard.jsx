import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { ErrorText } from '../../components/ui';

const PERIOD_DAYS = 30;
const npr = (n) => `NPR ${Math.round(Number(n) || 0).toLocaleString()}`;

function Delta({ metric, invert = false }) {
  if (!metric || metric.change_pct == null) {
    return <div className="dash-delta muted">No comparison yet</div>;
  }
  const up = metric.change_pct >= 0;
  const good = invert ? !up : up;
  return (
    <div className={`dash-delta ${good ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(metric.change_pct)}% vs previous {PERIOD_DAYS} days
    </div>
  );
}

function StatCard({ label, value, icon, children }) {
  return (
    <div className="stat-card">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {children}
      </div>
      <div className="stat-icon" aria-hidden="true">{icon}</div>
    </div>
  );
}

function RevenueChart({ series }) {
  const max = Math.max(...series.map((d) => d.revenue), 0);
  if (max <= 0) {
    return <p className="muted small" style={{ margin: '10px 0 0' }}>No revenue in the last 7 days.</p>;
  }
  return (
    <>
      <div className="dash-bars">
        {series.map((d) => (
          <div
            key={d.date}
            className="dash-bar"
            style={{ height: `${Math.max((d.revenue / max) * 100, d.revenue > 0 ? 4 : 1.5)}%` }}
            title={`${d.label} ${d.date}: ${npr(d.revenue)}`}
          />
        ))}
      </div>
      <div className="dash-bar-labels">
        {series.map((d) => (
          <span key={d.date}>{d.label}</span>
        ))}
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="stat-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ width: 90, height: 12 }} />
              <div className="skel" style={{ width: 130, height: 26, marginTop: 10 }} />
              <div className="skel" style={{ width: 110, height: 11, marginTop: 10 }} />
            </div>
            <div className="skel" style={{ width: 44, height: 44 }} />
          </div>
        ))}
      </div>
      <div className="content-grid">
        <div className="dash-panel"><div className="skel" style={{ height: 130 }} /></div>
        <div className="dash-panel"><div className="skel" style={{ height: 130 }} /></div>
      </div>
      <div className="dash-panel"><div className="skel" style={{ height: 150 }} /></div>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useAsync(() => admin.dashboard({ period_days: PERIOD_DAYS }), []);
  const d = data?.data;

  return (
    <div className="dash">
      <div className="dash-head">
        <h1>Dashboard</h1>
        <div className="dash-sub">Overview for the last {PERIOD_DAYS} days</div>
      </div>

      <ErrorText error={error} />

      {loading || !d ? (
        !error && <DashboardSkeleton />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Total revenue" value={npr(d.stats.revenue.value)} icon="Rs">
              <Delta metric={d.stats.revenue} />
            </StatCard>
            <StatCard label="Orders" value={d.stats.orders.value} icon="#">
              <Delta metric={d.stats.orders} />
            </StatCard>
            <StatCard label="New customers" value={d.stats.new_customers.value} icon="+">
              <Delta metric={d.stats.new_customers} />
            </StatCard>
            <StatCard label="Pending orders" value={d.stats.pending_orders} icon="!">
              {d.stats.pending_orders > 0 ? (
                <div className="dash-delta down">Needs attention</div>
              ) : (
                <div className="dash-delta muted">All caught up</div>
              )}
            </StatCard>
          </div>

          {!d.has_orders ? (
            <div className="dash-panel dash-empty">
              <h3>No orders yet</h3>
              <p className="muted" style={{ maxWidth: '46ch' }}>
                Once orders start coming in, revenue, top products and recent activity show up
                here. In the meantime you can add products or set up a launch coupon.
              </p>
              <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                <Link to="/admin/products/new" className="btn sm">Add a product</Link>
                <Link to="/admin/coupons" className="btn subtle sm">Create a coupon</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="content-grid">
                <div className="dash-panel">
                  <h3>Revenue this week</h3>
                  <RevenueChart series={d.revenue_week} />
                </div>

                <div className="dash-panel">
                  <h3>Top products</h3>
                  {d.top_products.length === 0 ? (
                    <p className="muted small" style={{ margin: '10px 0 0' }}>
                      No sales in the last {PERIOD_DAYS} days.
                    </p>
                  ) : (
                    <ul className="dash-top">
                      {d.top_products.map((p) => (
                        <li key={p.id}>
                          <Link to={`/admin/products/${p.id}`} className="name">{p.name}</Link>
                          <span className="units">{p.units_sold} sold</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="dash-panel">
                <h3>Recent orders</h3>
                {d.recent_orders.length === 0 ? (
                  <p className="muted small" style={{ margin: '10px 0 0' }}>No orders yet.</p>
                ) : (
                  <div className="table-wrap" style={{ border: 0 }}>
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.recent_orders.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <Link to={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                            </td>
                            <td>{o.customer_name}</td>
                            <td>{o.item_count}</td>
                            <td>{npr(o.total_amount)}</td>
                            <td>
                              <span className={`dash-badge ${o.status}`}>{o.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
