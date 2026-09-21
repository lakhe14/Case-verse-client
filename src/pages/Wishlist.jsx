import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import { wishlist as wishlistApi } from '../api/endpoints';
import ProductCard from '../components/ProductCard';
import { Spinner, ErrorText, EmptyState } from '../components/ui';
import { useToast } from '../context/ToastContext';
import usePageMeta from '../hooks/usePageMeta';

export default function Wishlist() {
  const { data, loading, error, reload } = useAsync(() => wishlistApi.list(), []);
  const toast = useToast();
  const items = data?.data || [];
  usePageMeta('Your wishlist', 'The CaseVerse iPhone covers you have saved for later.');

  const remove = async (productId) => {
    try {
      await wishlistApi.remove(productId);
      toast.success('Removed from your wishlist.');
      reload();
    } catch (e) {
      toast.error(e.message || 'Could not remove that item.');
    }
  };

  if (loading) return <Spinner />;
  return (
    <div>
      <h1>Wishlist</h1>
      <ErrorText error={error} />
      {items.length === 0 ? (
        <EmptyState title="Nothing saved yet">
          <p className="muted" style={{ maxWidth: '40ch', margin: '0 auto 14px' }}>
            Tap the heart on any product to keep it here for later.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Link to="/covers" className="btn sm">Shop phone covers</Link>
          </div>
        </EmptyState>
      ) : (
        <div className="grid">
          {items.map((w) => (
            <div key={w.id} className="col" style={{ gap: 8 }}>
              {w.product && <ProductCard product={w.product} />}
              <button className="btn ghost sm" onClick={() => remove(w.product.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
