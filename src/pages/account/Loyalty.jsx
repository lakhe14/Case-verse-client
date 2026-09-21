import useAsync from '../../hooks/useAsync';
import { loyalty as api } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState, Money } from '../../components/ui';

export default function Loyalty() {
  const balance = useAsync(() => api.balance(), []);
  const txns = useAsync(() => api.transactions({ limit: 30 }), []);

  if (balance.loading) return <Spinner />;

  return (
    <div className="col">
      <div className="card">
        <h3>Loyalty points</h3>
        <ErrorText error={balance.error} />
        <div className="money-serif" style={{ fontSize: '2rem', lineHeight: 1.1 }}>{balance.data?.data?.points ?? 0}</div>
        <div className="muted">worth <Money value={balance.data?.data?.value ?? 0} /> at checkout</div>
      </div>

      <div className="card">
        <h4>History</h4>
        {txns.loading ? (
          <Spinner />
        ) : !txns.data?.data?.length ? (
          <EmptyState title="No point activity yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Points</th><th>Note</th></tr>
              </thead>
              <tbody>
                {txns.data.data.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td><span className="badge">{t.type}</span></td>
                    <td style={{ color: t.points < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {t.points > 0 ? `+${t.points}` : t.points}
                    </td>
                    <td className="muted small">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
