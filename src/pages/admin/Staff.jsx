import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText } from '../../components/ui';

export default function AdminStaff() {
  const staff = useAsync(() => admin.staff(), []);
  const roles = useAsync(() => admin.roles(), []);
  const perms = useAsync(() => admin.permissions(), []);

  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '' });
  const [formErr, setFormErr] = useState(null);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const createStaff = async (e) => {
    e.preventDefault();
    setFormErr(null);
    try {
      await admin.createStaff({ ...form, role_id: Number(form.role_id) });
      setForm({ name: '', email: '', password: '', role_id: '' });
      staff.reload();
    } catch (e2) {
      setFormErr(e2);
    }
  };

  const togglePerm = async (role, key) => {
    const current = new Set((role.permissions || []).map((p) => p.key));
    if (current.has(key)) current.delete(key);
    else current.add(key);
    await admin.setRolePermissions(role.id, [...current]);
    roles.reload();
  };

  return (
    <div className="col">
      <h1>Staff & roles</h1>

      <div className="card">
        <h3>Add staff member</h3>
        <ErrorText error={formErr} />
        <form className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={createStaff}>
          <label className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <span className="field-label">Name</span><input name="name" value={form.name} onChange={onChange} required />
          </label>
          <label className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <span className="field-label">Email</span><input name="email" type="email" value={form.email} onChange={onChange} required />
          </label>
          <label className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
            <span className="field-label">Password</span><input name="password" type="password" value={form.password} onChange={onChange} required />
          </label>
          <label className="field" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <span className="field-label">Role</span>
            <select name="role_id" value={form.role_id} onChange={onChange} required>
              <option value="">Select…</option>
              {(roles.data?.data || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <button className="btn">Add</button>
        </form>
      </div>

      <div className="card">
        <h3>Staff</h3>
        {staff.loading ? <Spinner /> : (
          <table className="data">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead>
            <tbody>
              {(staff.data?.data || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    <select
                      defaultValue={s.role_id}
                      onChange={async (e) => { await admin.updateStaff(s.id, { role_id: Number(e.target.value) }); staff.reload(); }}
                    >
                      {(roles.data?.data || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox" checked={s.is_active} style={{ width: 'auto' }}
                      onChange={async (e) => { await admin.updateStaff(s.id, { is_active: e.target.checked }); staff.reload(); }}
                    />
                  </td>
                  <td>
                    <button
                      className="btn ghost sm"
                      onClick={async () => { if (confirm('Delete staff member?')) { await admin.deleteStaff(s.id); staff.reload(); } }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Role permissions</h3>
        {roles.loading || perms.loading ? <Spinner /> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Permission</th>
                  {(roles.data?.data || []).map((r) => <th key={r.id}>{r.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {(perms.data?.data || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.label}<div className="muted small">{p.key}</div></td>
                    {(roles.data?.data || []).map((r) => (
                      <td key={r.id}>
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          checked={(r.permissions || []).some((x) => x.key === p.key)}
                          onChange={() => togglePerm(r, p.key)}
                        />
                      </td>
                    ))}
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
