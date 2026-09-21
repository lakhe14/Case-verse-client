import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, Money, Pagination } from '../../components/ui';

export default function AdminCustomers() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const list = useAsync(() => admin.customers({ page, limit: 20, q: q || undefined }), [page, q]);
  const detail = useAsync(() => (selected ? admin.customer(selected) : Promise.resolve(null)), [selected], {
    immediate: Boolean(selected),
  });

  return (
    <div className="col">
      <h1>Customers</h1>
      <input
        placeholder="Search name or email…"
        defaultValue={q}
        onKeyDown={(e) => e.key === 'Enter' && (setPage(1), setQ(e.target.value.trim()))}
        style={{ maxWidth: 280 }}
      />
      <ErrorText error={list.error} />

      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px' }}>
          {list.loading ? (
            <Spinner />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Name</th><th>Email</th><th>Points</th><th>Joined</th></tr></thead>
                  <tbody>
                    {(list.data?.data || []).map((c) => (
                      <tr key={c.id} className={selected === c.id ? 'is-selected' : ''}>
                        <td>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => setSelected(c.id)}
                            aria-pressed={selected === c.id}
                          >
                            {c.name}
                          </button>
                        </td>
                        <td>{c.email}</td>
                        <td>{c.loyalty_points}</td>
                        <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={list.data?.pagination?.page || 1} pages={list.data?.pagination?.pages || 1} onChange={setPage} />
            </>
          )}
        </div>

        {selected && (
          <div className="card" style={{ flex: '0 0 320px' }}>
            {detail.loading ? (
              <Spinner />
            ) : detail.data?.data ? (
              <>
                <div className="spread">
                  <h3 style={{ margin: 0 }}>{detail.data.data.name}</h3>
                  <button className="btn ghost sm" onClick={() => setSelected(null)}>×</button>
                </div>
                <div className="muted small">{detail.data.data.email}</div>
                <div className="muted small">{detail.data.data.phone || 'No phone on file'}</div>
                <div className="spread" style={{ marginTop: 8 }}>
                  <span className="muted">Lifetime value</span><Money value={detail.data.data.lifetime_value} />
                </div>
                <div className="spread"><span className="muted">Loyalty points</span><span>{detail.data.data.loyalty_points}</span></div>
                <h4 style={{ marginTop: 12 }}>Recent orders</h4>
                {(detail.data.data.orders || []).slice(0, 8).map((o) => (
                  <div key={o.id} className="spread small">
                    <span>{o.order_number} <span className="badge">{o.status}</span></span>
                    <Money value={o.total_amount} />
                  </div>
                ))}
              </>
            ) : (
              <p className="muted">Not found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
