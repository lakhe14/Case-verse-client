import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState } from '../../components/ui';

export default function AdminAttributes() {
  const attrs = useAsync(() => admin.attributes(), []);
  const cats = useAsync(() => admin.categoriesWithAttributes(), []);

  const [newAttr, setNewAttr] = useState('');
  const [newCat, setNewCat] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const reloadAll = () => {
    attrs.reload();
    cats.reload();
  };

  const run = async (fn) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      reloadAll();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const createAttr = (e) => {
    e.preventDefault();
    const name = newAttr.trim();
    if (!name) return;
    run(async () => {
      await admin.createAttribute({ name });
      setNewAttr('');
    });
  };

  const createCat = (e) => {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    run(async () => {
      await admin.createCategory({ name, attribute_ids: [] });
      setNewCat('');
    });
  };

  const rename = (a) => {
    const name = prompt('Rename attribute', a.name);
    if (name && name.trim() && name.trim() !== a.name) {
      run(() => admin.renameAttribute(a.id, { name: name.trim() }));
    }
  };

  const removeAttr = (a) => {
    if (confirm(`Delete attribute "${a.name}"? (only allowed if unused)`)) {
      run(() => admin.deleteAttribute(a.id));
    }
  };

  const toggleLink = (cat, attrId) => {
    const has = cat.attribute_ids.includes(attrId);
    const next = has
      ? cat.attribute_ids.filter((x) => x !== attrId)
      : [...cat.attribute_ids, attrId];
    run(() => admin.setCategoryAttributes(cat.id, next));
  };

  const attributes = attrs.data?.data || [];
  const categories = cats.data?.data || [];

  return (
    <div className="col">
      <h1>Attributes & categories</h1>
      <p className="muted small">
        Attributes are the vocabulary a variant can be described with (Phone Model,
        Color…). Assign them to categories so the product form knows which inputs to
        show for a variant.
      </p>
      <ErrorText error={err || attrs.error || cats.error} />

      {/* Attributes */}
      <div className="card">
        <h3>Attributes</h3>
        {attrs.loading ? (
          <Spinner />
        ) : attributes.length === 0 ? (
          <EmptyState title="No attributes yet" />
        ) : (
          <table className="data">
            <thead><tr><th>Name</th><th>Values in use</th><th /></tr></thead>
            <tbody>
              {attributes.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="muted small">{a.values.length ? a.values.join(', ') : 'None yet'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn subtle sm" disabled={busy} onClick={() => rename(a)}>Rename</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => removeAttr(a)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form className="row" style={{ marginTop: 10 }} onSubmit={createAttr}>
          <input
            placeholder="New attribute name, e.g. Capacity"
            value={newAttr}
            onChange={(e) => setNewAttr(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button className="btn sm" disabled={busy}>Add attribute</button>
        </form>
      </div>

      {/* Category ↔ attribute matrix */}
      <div className="card">
        <h3>Which attributes apply to which category</h3>
        {cats.loading || attrs.loading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  {attributes.map((a) => <th key={a.id}>{a.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}<div className="muted small">/{c.slug}</div></td>
                    {attributes.map((a) => (
                      <td key={a.id} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          disabled={busy}
                          checked={c.attribute_ids.includes(a.id)}
                          onChange={() => toggleLink(c, a.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form className="row" style={{ marginTop: 10 }} onSubmit={createCat}>
          <input
            placeholder="New category name"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button className="btn subtle sm" disabled={busy}>Add category</button>
        </form>
      </div>
    </div>
  );
}
