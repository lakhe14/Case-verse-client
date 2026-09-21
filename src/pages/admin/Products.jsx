import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import { admin } from '../../api/endpoints';
import { Spinner, ErrorText, Money, Pagination, StatusBadge } from '../../components/ui';

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => admin.products({ page, limit: 20, q: q || undefined }),
    [page, q]
  );

  const del = async (id) => {
    if (!confirm('Delete this product and all its variants?')) return;
    await admin.deleteProduct(id);
    reload();
  };

  return (
    <div className="col">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Products</h1>
        <Link to="/admin/products/new" className="btn sm">New product</Link>
      </div>
      <input
        placeholder="Search products…"
        defaultValue={q}
        onKeyDown={(e) => e.key === 'Enter' && (setPage(1), setQ(e.target.value.trim()))}
        style={{ maxWidth: 280 }}
      />
      <ErrorText error={error} />
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Name</th><th>Category</th><th>Variants</th><th>Price</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {(data?.data || []).map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/admin/products/${p.id}`}>{p.name}</Link></td>
                    <td>{p.category?.name}</td>
                    <td>{p.variants?.length || 0}</td>
                    <td><Money value={p.price_from} /></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: 8 }}>
                        <Link className="btn subtle sm" to={`/admin/products/${p.id}`}>Edit</Link>
                        <button className="btn ghost sm danger" onClick={() => del(p.id)}>Delete</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.pagination?.page || 1} pages={data?.pagination?.pages || 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}
