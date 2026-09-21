import { useEffect, useState } from 'react';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText } from '../../components/ui';

const humanize = (key) =>
  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function useEditableList(loader, saver) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loader().then((r) => setRows(r.data)).catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const r = await saver(rows);
      setRows(r.data);
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return { rows, setRows, error, saved, busy, save };
}

export default function AdminSettings() {
  const shipping = useEditableList(admin.getShipping, admin.putShipping);

  const [general, setGeneral] = useState(null);
  const [genErr, setGenErr] = useState(null);
  const [genSaved, setGenSaved] = useState(false);

  useEffect(() => {
    admin.getGeneral().then((r) => setGeneral(r.data)).catch(setGenErr);
  }, []);

  const patchRow = (list, i, patch) =>
    list.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));

  return (
    <div className="col">
      <h1>Settings</h1>

      {/* Shipping */}
      <div className="card">
        <div className="spread"><h3 style={{ margin: 0 }}>Shipping rates</h3>
          {shipping.saved && <span className="badge approved">Saved</span>}
        </div>
        <ErrorText error={shipping.error} />
        {!shipping.rows ? <Spinner /> : (
          <>
            <table className="data">
              <thead><tr><th>Zone</th><th>Method</th><th>Cost</th><th>Free above</th><th>Active</th><th /></tr></thead>
              <tbody>
                {shipping.rows.map((r, i) => (
                  <tr key={i}>
                    <td><input value={r.zone_name} onChange={(e) => shipping.setRows(patchRow(shipping, i, { zone_name: e.target.value }))} /></td>
                    <td><input value={r.method_name} onChange={(e) => shipping.setRows(patchRow(shipping, i, { method_name: e.target.value }))} /></td>
                    <td><input type="number" step="0.01" min="0" required value={r.cost} onChange={(e) => shipping.setRows(patchRow(shipping, i, { cost: Number(e.target.value) }))} style={{ width: 90 }} /></td>
                    <td><input type="number" step="0.01" min="0" placeholder="none" value={r.free_above_amount ?? ''} onChange={(e) => shipping.setRows(patchRow(shipping, i, { free_above_amount: e.target.value === '' ? null : Number(e.target.value) }))} style={{ width: 100 }} /></td>
                    <td><input type="checkbox" checked={r.is_active} style={{ width: 'auto' }} onChange={(e) => shipping.setRows(patchRow(shipping, i, { is_active: e.target.checked }))} /></td>
                    <td><button className="btn ghost sm" onClick={() => shipping.setRows(shipping.rows.filter((_, idx) => idx !== i))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn subtle sm" onClick={() => shipping.setRows([...shipping.rows, { zone_name: '', method_name: 'Standard', cost: 0, free_above_amount: null, is_active: true }])}>
                Add rate
              </button>
              <button className="btn sm" disabled={shipping.busy} onClick={shipping.save}>Save shipping</button>
            </div>
          </>
        )}
      </div>

      {/* General */}
      <div className="card">
        <div className="spread"><h3 style={{ margin: 0 }}>General</h3>
          {genSaved && <span className="badge approved">Saved</span>}
        </div>
        <ErrorText error={genErr} />
        {!general ? <Spinner /> : (
          <>
            {Object.entries(general).map(([k, v]) => (
              <label className="field" key={k}>
                <span className="field-label">{humanize(k)}</span>
                <input value={v} onChange={(e) => setGeneral((g) => ({ ...g, [k]: e.target.value }))} />
              </label>
            ))}
            <button
              className="btn sm"
              onClick={async () => {
                setGenErr(null);
                setGenSaved(false);
                try {
                  const r = await admin.putGeneral(general);
                  setGeneral(r.data);
                  setGenSaved(true);
                  if (general.currency) localStorage.setItem('cv_currency', general.currency);
                } catch (e) {
                  setGenErr(e);
                }
              }}
            >
              Save general
            </button>
          </>
        )}
      </div>
    </div>
  );
}
