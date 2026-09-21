import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import useForm from '../../hooks/useForm';
import { addresses as api } from '../../api/endpoints';
import { Spinner, ErrorText, EmptyState } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const BLANK = {
  label: 'Home',
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Nepal',
  is_default: false,
};

function AddressForm({ initial, onSaved, onCancel }) {
  const form = useForm(initial || BLANK);
  const toast = useToast();
  const submit = form.handleSubmit(async (values) => {
    const payload = { ...values };
    if (initial?.id) await api.update(initial.id, payload);
    else await api.create(payload);
    toast.success(initial?.id ? 'Address updated.' : 'Address saved.');
    onSaved();
  });

  return (
    <form className="card" onSubmit={submit}>
      <h3>{initial?.id ? 'Edit address' : 'New address'}</h3>
      <ErrorText error={form.error} />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 120px' }}>
          <span className="field-label">Label</span>
          <input name="label" value={form.values.label} onChange={form.onChange} />
        </label>
        <label className="field" style={{ flex: '2 1 200px' }}>
          <span className="field-label">Recipient name</span>
          <input name="recipient_name" value={form.values.recipient_name} onChange={form.onChange} required />
        </label>
        <label className="field" style={{ flex: '1 1 140px' }}>
          <span className="field-label">Phone</span>
          <input name="phone" value={form.values.phone} onChange={form.onChange} required />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Address line 1</span>
        <input name="line1" value={form.values.line1} onChange={form.onChange} required />
      </label>
      <label className="field">
        <span className="field-label">Address line 2</span>
        <input name="line2" value={form.values.line2 || ''} onChange={form.onChange} />
      </label>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 140px' }}>
          <span className="field-label">City</span>
          <input name="city" value={form.values.city} onChange={form.onChange} required />
        </label>
        <label className="field" style={{ flex: '1 1 140px' }}>
          <span className="field-label">State / Province</span>
          <input name="state" value={form.values.state || ''} onChange={form.onChange} />
        </label>
        <label className="field" style={{ flex: '1 1 120px' }}>
          <span className="field-label">Postal code</span>
          <input name="postal_code" value={form.values.postal_code || ''} onChange={form.onChange} />
        </label>
        <label className="field" style={{ flex: '1 1 120px' }}>
          <span className="field-label">Country</span>
          <input name="country" value={form.values.country} onChange={form.onChange} required />
        </label>
      </div>
      <label className="row">
        <input type="checkbox" name="is_default" checked={form.values.is_default} onChange={form.onChange} style={{ width: 'auto' }} />
        <span>Set as default</span>
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" disabled={form.submitting}>{form.submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn subtle" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Addresses() {
  const { data, loading, error, reload } = useAsync(() => api.list(), []);
  const [editing, setEditing] = useState(null); // 'new' | address object | null
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();
  const list = data?.data || [];

  const afterSave = () => {
    setEditing(null);
    reload();
  };

  const makeDefault = async (a) => {
    setBusyId(a.id);
    try {
      await api.setDefault(a.id);
      toast.success(`“${a.label || a.recipient_name}” is now your default address.`);
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not set the default address.');
    } finally {
      setBusyId(null);
    }
  };

  const removeAddress = async (a) => {
    if (!window.confirm(`Delete the address for ${a.recipient_name}?`)) return;
    setBusyId(a.id);
    try {
      await api.remove(a.id);
      toast.success('Address deleted.');
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not delete that address.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="col">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Address book</h3>
        {!editing && <button className="btn sm" onClick={() => setEditing('new')}>Add address</button>}
      </div>
      <ErrorText error={error} />

      {editing === 'new' && <AddressForm onSaved={afterSave} onCancel={() => setEditing(null)} />}

      {list.length === 0 && !editing ? (
        <EmptyState title="No addresses yet">
          <p className="muted" style={{ maxWidth: '38ch', margin: '0 auto 14px' }}>
            Add a delivery address so checkout is one step quicker.
          </p>
          <button className="btn sm" onClick={() => setEditing('new')}>Add your first address</button>
        </EmptyState>
      ) : (
        list.map((a) =>
          editing?.id === a.id ? (
            <AddressForm key={a.id} initial={a} onSaved={afterSave} onCancel={() => setEditing(null)} />
          ) : (
            <div key={a.id} className="card spread">
              <div>
                <strong style={{ fontWeight: 500 }}>{a.label}</strong>{' '}
                {a.is_default && <span className="badge delivered">Default</span>}
                <div>{a.recipient_name}</div>
                <div className="muted small">
                  {a.phone}
                  <br />
                  {[a.line1, a.line2, a.city, a.state, a.postal_code, a.country]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </div>
              <div className="col" style={{ gap: 6 }}>
                <button className="btn subtle sm" onClick={() => setEditing(a)}>Edit</button>
                {!a.is_default && (
                  <button className="btn subtle sm" disabled={busyId === a.id} onClick={() => makeDefault(a)}>
                    Make default
                  </button>
                )}
                <button className="btn ghost sm" disabled={busyId === a.id} onClick={() => removeAddress(a)}>
                  Delete
                </button>
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}
