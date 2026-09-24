import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText } from '../../components/ui';
import { mediaUrl } from '../../utils/mediaUrl';

const BLANK = { name: '', category_id: '', base_price: '', description: '', status: 'active' };

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]); // [{id,name,slug,attributes:[{id,name}]}]
  const [knownValues, setKnownValues] = useState({}); // attrId -> [values]
  const [form, setForm] = useState(BLANK);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [cats, attrs] = await Promise.all([
      admin.categoriesWithAttributes(),
      admin.attributes(),
    ]);
    setCategories(cats.data);
    setKnownValues(
      Object.fromEntries((attrs.data || []).map((a) => [a.id, a.values || []]))
    );
    if (editing) {
      const { data } = await admin.product(id);
      setProduct(data);
      setForm({
        name: data.name,
        category_id: data.category?.id || '',
        base_price: data.base_price,
        description: data.description || '',
        status: data.status,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load().catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const categoryAttributes = useMemo(() => {
    const cat = categories.find((c) => c.id === Number(form.category_id));
    return cat?.attributes || [];
  }, [categories, form.category_id]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        category_id: Number(form.category_id),
        base_price: Number(form.base_price),
        description: form.description || null,
        status: form.status,
      };
      if (editing) {
        await admin.updateProduct(id, payload);
        await load();
      } else {
        const { data } = await admin.createProduct(payload);
        navigate(`/admin/products/${data.id}`, { replace: true });
      }
    } catch (e2) {
      setError(e2);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="col">
      <Link to="/admin/products" className="small">All products</Link>
      <h1>{editing ? form.name || 'Edit product' : 'New product'}</h1>
      <ErrorText error={error} />

      <form className="card" onSubmit={save}>
        <label className="field">
          <span className="field-label">Name</span>
          <input name="name" value={form.name} onChange={onChange} required />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '1 1 200px' }}>
            <span className="field-label">Category</span>
            <select name="category_id" value={form.category_id} onChange={onChange} required>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {form.category_id && (
              <span className="muted small">
                Variant attributes:{' '}
                {categoryAttributes.length
                  ? categoryAttributes.map((a) => a.name).join(', ')
                  : 'none assigned yet; add them on the Attributes page'}
              </span>
            )}
          </label>
          <label className="field" style={{ flex: '1 1 140px' }}>
            <span className="field-label">Base price</span>
            <input name="base_price" type="number" step="0.01" min="0" value={form.base_price} onChange={onChange} required />
          </label>
          <label className="field" style={{ flex: '1 1 140px' }}>
            <span className="field-label">Status</span>
            <select name="status" value={form.status} onChange={onChange}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="draft">draft</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Description</span>
          <textarea name="description" rows={4} value={form.description} onChange={onChange} />
        </label>
        <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
        {!editing && <p className="muted small">Save the product first, then add variants and images.</p>}
      </form>

      {editing && product && (
        <>
          <Variants
            product={product}
            categoryAttributes={categoryAttributes}
            knownValues={knownValues}
            onChange={load}
          />
          <Images product={product} onChange={load} />
        </>
      )}
    </div>
  );
}

/* ------------------------------- Variants ------------------------------- */

// Attributes to show for a variant: those on the category, plus any the variant
// already has a value for (so editing never silently drops data).
function attrsForVariant(categoryAttributes, variant) {
  const map = new Map(categoryAttributes.map((a) => [a.id, a.name]));
  for (const av of variant?.attributes || []) {
    if (!map.has(av.attribute_id)) map.set(av.attribute_id, av.name);
  }
  return [...map].map(([attribute_id, name]) => ({ id: attribute_id, name }));
}

function AttrDatalists({ knownValues }) {
  return (
    <>
      {Object.entries(knownValues).map(([attrId, values]) => (
        <datalist key={attrId} id={`attr-values-${attrId}`}>
          {values.map((v) => <option key={v} value={v} />)}
        </datalist>
      ))}
    </>
  );
}

function VariantRow({ product, variant, attrDefs, onChange }) {
  const initial = () => ({
    sku: variant.sku,
    price: variant.price,
    stock_quantity: variant.stock_quantity,
    is_active: variant.is_active,
    attrs: Object.fromEntries(
      attrDefs.map((d) => [d.id, variant.attributes.find((a) => a.attribute_id === d.id)?.value || ''])
    ),
  });
  const [row, setRow] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Re-sync if the variant data changes underneath us (e.g. after a reload).
  useEffect(() => setRow(initial()), [variant, attrDefs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    row.sku !== variant.sku ||
    Number(row.price) !== Number(variant.price) ||
    Number(row.stock_quantity) !== variant.stock_quantity ||
    row.is_active !== variant.is_active ||
    attrDefs.some(
      (d) => (row.attrs[d.id] || '') !== (variant.attributes.find((a) => a.attribute_id === d.id)?.value || '')
    );

  const saveRow = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await admin.updateVariant(product.id, variant.id, {
        sku: row.sku,
        price: Number(row.price),
        stock_quantity: Number(row.stock_quantity),
        is_active: row.is_active,
        attributes: attrDefs
          .map((d) => ({ attribute_id: d.id, value: (row.attrs[d.id] || '').trim() }))
          .filter((a) => a.value),
      });
      onChange();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete variant ${variant.sku}?`)) return;
    setErr(null);
    try {
      await admin.deleteVariant(product.id, variant.id);
      onChange();
    } catch (e) {
      setErr(e);
    }
  };

  // Admin shape: stock_quantity is physical; reserved/available come with it.
  const reserved = variant.reserved_quantity ?? 0;
  const floorError = err?.code === 'stock_below_reserved' ? err.details : null;

  return (
    <form className="card" style={{ padding: 12 }} onSubmit={saveRow} data-testid={`variant-row-${variant.id}`}>
      {floorError ? (
        <div className="alert error" role="alert" data-testid="stock-floor-error">
          Stock cannot be set below {floorError.minimum_allowed_stock}. That many units are now reserved by pending orders.
        </div>
      ) : err?.code === 'variant_in_use' ? (
        <div className="alert error" role="alert" data-testid="delete-conflict">
          This variant has order history and cannot be deleted. Deactivate it instead: untick Active and save.
        </div>
      ) : (
        <ErrorText error={err} />
      )}
      {variant.reserved_quantity != null && (
        <dl className="inv-stats" data-testid="variant-inventory">
          <div><dt>Physical</dt><dd data-testid="inv-physical">{variant.stock_quantity}</dd></div>
          <div><dt>Reserved</dt><dd data-testid="inv-reserved">{reserved}</dd></div>
          <div><dt>Available</dt><dd data-testid="inv-available">{variant.available_quantity}</dd></div>
        </dl>
      )}
      {reserved > 0 && (
        <p className="inv-warning" id={`reserved-${variant.id}`} data-testid="reserved-warning">
          {reserved} {reserved === 1 ? 'unit is' : 'units are'} reserved by pending orders. Physical stock cannot be reduced below {reserved}.
        </p>
      )}
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 150px', marginBottom: 0 }}>
          <span className="small muted">SKU</span>
          <input value={row.sku} onChange={(e) => setRow({ ...row, sku: e.target.value })} required />
        </label>
        <label className="field" style={{ flex: '0 1 100px', marginBottom: 0 }}>
          <span className="small muted">Price</span>
          <input type="number" step="0.01" min="0" required value={row.price}
            onChange={(e) => setRow({ ...row, price: e.target.value })} />
        </label>
        <label className="field" style={{ flex: '0 1 90px', marginBottom: 0 }}>
          <span className="small muted">Physical stock</span>
          {/* The server enforces the same floor; this only saves a round trip. */}
          <input type="number" min={Math.min(reserved, variant.stock_quantity)} step="1" required value={row.stock_quantity}
            aria-describedby={reserved > 0 ? `reserved-${variant.id}` : undefined}
            onChange={(e) => setRow({ ...row, stock_quantity: e.target.value })} />
        </label>
        {attrDefs.map((d) => (
          <label className="field" key={d.id} style={{ flex: '1 1 130px', marginBottom: 0 }}>
            <span className="small muted">{d.name}</span>
            <input
              list={`attr-values-${d.id}`}
              value={row.attrs[d.id] || ''}
              onChange={(e) => setRow({ ...row, attrs: { ...row.attrs, [d.id]: e.target.value } })}
            />
          </label>
        ))}
        <label className="row" style={{ gap: 4, marginBottom: 4 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={row.is_active}
            onChange={(e) => setRow({ ...row, is_active: e.target.checked })} />
          <span className="small">Active</span>
        </label>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="submit" className="btn sm" disabled={!dirty || busy}>
          {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
        <button type="button" className="btn ghost sm" onClick={del}>Delete</button>
      </div>
    </form>
  );
}

function AddVariant({ product, attrDefs, onChange }) {
  const blank = { sku: '', price: '', stock_quantity: 0, attrs: {} };
  const [row, setRow] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await admin.createVariant(product.id, {
        sku: row.sku,
        price: Number(row.price),
        stock_quantity: Number(row.stock_quantity),
        attributes: attrDefs
          .map((d) => ({ attribute_id: d.id, value: (row.attrs[d.id] || '').trim() }))
          .filter((a) => a.value),
      });
      setRow(blank);
      onChange();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" style={{ padding: 12 }} onSubmit={add}>
      <strong className="small">Add a variant</strong>
      <ErrorText error={err} />
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6 }}>
        <input placeholder="SKU" required value={row.sku}
          onChange={(e) => setRow({ ...row, sku: e.target.value })} style={{ flex: '1 1 150px' }} />
        <input placeholder="Price" type="number" step="0.01" min="0" required value={row.price}
          onChange={(e) => setRow({ ...row, price: e.target.value })} style={{ flex: '0 1 100px' }} />
        <input placeholder="Stock" type="number" min="0" required value={row.stock_quantity}
          onChange={(e) => setRow({ ...row, stock_quantity: e.target.value })} style={{ flex: '0 1 90px' }} />
        {attrDefs.map((d) => (
          <input
            key={d.id}
            placeholder={d.name}
            list={`attr-values-${d.id}`}
            value={row.attrs[d.id] || ''}
            onChange={(e) => setRow({ ...row, attrs: { ...row.attrs, [d.id]: e.target.value } })}
            style={{ flex: '1 1 130px' }}
          />
        ))}
        <button className="btn sm" disabled={busy}>Add</button>
      </div>
    </form>
  );
}

function Variants({ product, categoryAttributes, knownValues, onChange }) {
  return (
    <div className="card">
      <h3>Variants</h3>
      {categoryAttributes.length === 0 && (
        <p className="muted small">
          This product's category has no attributes assigned, so variants have no
          model/color inputs. Add attributes on the <Link to="/admin/attributes">Attributes</Link> page.
        </p>
      )}
      <AttrDatalists knownValues={knownValues} />
      <div className="col" style={{ gap: 10 }}>
        {product.variants.map((v) => (
          <VariantRow
            key={v.id}
            product={product}
            variant={v}
            attrDefs={attrsForVariant(categoryAttributes, v)}
            onChange={onChange}
          />
        ))}
        <AddVariant product={product} attrDefs={categoryAttributes} onChange={onChange} />
      </div>
    </div>
  );
}

/* -------------------------------- Images -------------------------------- */

function Images({ product, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const upload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      [...files].forEach((f) => fd.append('images', f));
      await admin.uploadImages(product.id, fd);
      onChange();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="card">
      <h3>Images</h3>
      <ErrorText error={err} />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {product.images.map((img) => (
          <div key={img.id} style={{ position: 'relative' }}>
            <img src={mediaUrl(img.url)} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }} />
            <button
              className="btn danger sm"
              style={{ position: 'absolute', top: 2, right: 2, padding: '0 6px' }}
              onClick={async () => { await admin.deleteImage(product.id, img.id); onChange(); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <label className="btn subtle sm" style={{ marginTop: 10 }}>
        {busy ? 'Uploading…' : 'Upload images'}
        <input type="file" accept="image/*" multiple hidden onChange={upload} />
      </label>
    </div>
  );
}
