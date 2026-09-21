import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, Money, StatusBadge } from '../../components/ui';

const NEXT = {
  pending: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => admin.order(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorText error={error} />;
  const o = data?.data;
  if (!o) return null;

  const changeStatus = async (status) => {
    setBusy(true);
    setActionError(null);
    try {
      await admin.updateOrderStatus(o.id, { status, note: note || undefined });
      setNote('');
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col">
      <Link to="/admin/orders" className="small">All orders</Link>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{o.order_number}</h1>
        <StatusBadge status={o.status} />
      </div>
      <div className="muted small">
        {o.user?.name}, {o.user?.email}
      </div>
      <div className="muted small">Placed {new Date(o.placed_at).toLocaleString()}</div>

      <div className="card">
        <h3>Update status</h3>
        <ErrorText error={actionError} />
        {NEXT[o.status].length === 0 ? (
          <p className="muted">This order is in a final state.</p>
        ) : (
          <>
            <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              {NEXT[o.status].map((s) => (
                <button key={s} className="btn sm" disabled={busy} onClick={() => changeStatus(s)}>
                  Mark {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 320px' }}>
          <h3>Items</h3>
          {o.items.map((it) => (
            <div key={it.id} className="spread" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <span>{it.product_name_snap} × {it.quantity} <span className="muted small">({it.sku_snap})</span></span>
              <Money value={it.line_total} />
            </div>
          ))}
        </div>
        <div className="card" style={{ flex: '0 0 260px' }}>
          <h3>Totals</h3>
          <div className="spread"><span className="muted">Subtotal</span><Money value={o.subtotal_amount} /></div>
          {Number(o.bundle_discount_amount) > 0 && (
            <div className="spread">
              <span className="muted" style={{ whiteSpace: 'nowrap' }}>Bundle discount</span>
              <span style={{ whiteSpace: 'nowrap' }}>−<Money value={o.bundle_discount_amount} /></span>
            </div>
          )}
          <div className="spread"><span className="muted">Discount</span><Money value={o.discount_amount} /></div>
          <div className="spread"><span className="muted">Shipping</span><Money value={o.shipping_amount} /></div>
          <div className="spread" style={{ fontWeight: 700 }}><span>Total</span><Money value={o.total_amount} /></div>
        </div>
      </div>

      <div className="card">
        <h3>History</h3>
        <ul className="timeline">
          {(o.statusHistory || []).map((h) => (
            <li key={h.id}>
              <strong style={{ fontWeight: 500, textTransform: 'capitalize' }}>{h.status}</strong>
              <div className="muted small">{new Date(h.changed_at).toLocaleString()}</div>
              {h.note && <div className="muted small">{h.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
