import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState } from '../../components/ui';

const BLANK = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  min_order_amount: 0,
  usage_limit_per_user: 1,
  is_active: true,
};

export default function AdminCoupons() {
  const { data, loading, error, reload } = useAsync(() => admin.coupons({ limit: 50 }), []);
  const [form, setForm] = useState(BLANK);
  const [formErr, setFormErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      await admin.createCoupon({
        ...form,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount) || 0,
        usage_limit_per_user: form.usage_limit_per_user ? Number(form.usage_limit_per_user) : null,
      });
      setForm(BLANK);
      reload();
    } catch (e2) {
      setFormErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c) => {
    await admin.updateCoupon(c.id, { is_active: !c.is_active });
    reload();
  };

  return (
    <div className="col">
      <h1>Coupons</h1>
      <form className="card row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={create}>
        <label className="field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
          <span className="field-label">Code</span>
          <input name="code" value={form.code} onChange={onChange} required />
        </label>
        <label className="field" style={{ flex: '2 1 200px', marginBottom: 0 }}>
          <span className="field-label">Description</span>
          <input name="description" value={form.description} onChange={onChange} />
        </label>
        <label className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <span className="field-label">Type</span>
          <select name="discount_type" value={form.discount_type} onChange={onChange}>
            <option value="percentage">percentage</option>
            <option value="fixed">fixed</option>
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}>
          <span className="field-label">Value</span>
          <input name="discount_value" type="number" step="0.01" min="0" value={form.discount_value} onChange={onChange} required />
        </label>
        <label className="field" style={{ flex: '1 1 110px', marginBottom: 0 }}>
          <span className="field-label">Min order</span>
          <input name="min_order_amount" type="number" step="0.01" min="0" value={form.min_order_amount} onChange={onChange} required />
        </label>
        <label className="field" style={{ flex: '1 1 90px', marginBottom: 0 }}>
          <span className="field-label">Per user <span className="muted small">(blank = unlimited)</span></span>
          <input name="usage_limit_per_user" type="number" min="1" value={form.usage_limit_per_user} onChange={onChange} />
        </label>
        <button className="btn" disabled={busy}>Add</button>
      </form>
      <ErrorText error={formErr} />
      <ErrorText error={error} />

      {loading ? (
        <Spinner />
      ) : !data?.data?.length ? (
        <EmptyState title="No coupons" />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Code</th><th>Discount</th><th>Min order</th><th>Active uses</th><th>Active</th><th /></tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr key={c.id}>
                  <td>{c.code}<div className="muted small">{c.description}</div></td>
                  <td>{c.discount_type === 'percentage' ? `${c.discount_value}%` : c.discount_value}</td>
                  <td>{c.min_order_amount}</td>
                  <td>{c.times_used}{c.usage_limit_total ? ` / ${c.usage_limit_total}` : ''}{c.times_released > 0 && <div className="muted small">{c.times_released} released (unpaid orders cancelled)</div>}</td>
                  <td>{c.is_active ? 'Yes' : 'No'}</td>
                  <td>
                    <button className="btn subtle sm" onClick={() => toggle(c)}>{c.is_active ? 'Disable' : 'Enable'}</button>
                    <button
                      className="btn ghost sm"
                      onClick={async () => { if (confirm('Delete coupon?')) { await admin.deleteCoupon(c.id); reload(); } }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
