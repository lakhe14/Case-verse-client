import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { reviews as reviewsApi } from '../api/endpoints';
import { Spinner, ErrorText, EmptyState, Stars } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';

const CATEGORIES = [
  ['', 'All'],
  ['iphone-covers', 'Phone covers'],
];

const RATINGS = [
  ['', 'All ratings'],
  ['5', '5 stars'],
  ['4', '4 stars and up'],
  ['3', '3 stars and up'],
];

const PAGE_SIZE = 12;

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function Reviews() {
  usePageMeta(
    'Customer reviews',
    'Read what CaseVerse customers say about our iPhone covers after their orders arrive.'
  );
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const rating = params.get('rating') || '';

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const setFilter = (key, value) => {
    const merged = new URLSearchParams(params);
    if (value) merged.set(key, value);
    else merged.delete(key);
    setParams(merged);
  };

  const fetchPage = (nextPage) =>
    reviewsApi.all({
      page: nextPage,
      limit: PAGE_SIZE,
      category: category || undefined,
      rating: rating || undefined,
    });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(1)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data);
        setPage(1);
        setPages(res.pagination.pages);
        setTotal(res.pagination.total);
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, rating]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(page + 1);
      setItems((prev) => [...prev, ...res.data]);
      setPage((p) => p + 1);
      setPages(res.pagination.pages);
    } catch (e) {
      setError(e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 6 }}>Reviews</h1>
      <p className="muted" style={{ maxWidth: '58ch', marginTop: 0 }}>
        What customers say once their order has arrived, across every cover we stock.
      </p>

      <div className="reviews-filters">
        <div className="filter-group">
          <span className="filter-label">Category</span>
          <div className="chip-row">
            {CATEGORIES.map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                className={`opt-chip ${category === value ? 'active' : ''}`}
                onClick={() => setFilter('category', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">Rating</span>
          <div className="chip-row">
            {RATINGS.map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                className={`opt-chip ${rating === value ? 'active' : ''}`}
                onClick={() => setFilter('rating', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ErrorText error={error} />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="No reviews yet">
          <p className="muted" style={{ maxWidth: '42ch', margin: '0 auto' }}>
            {category || rating
              ? 'No reviews match this filter yet. Try another category or rating.'
              : 'Be the first to share one after your order arrives.'}
          </p>
        </EmptyState>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            {total} approved review{total === 1 ? '' : 's'}
          </p>
          <div className="reviews-grid">
            {items.map((r) => (
              <article key={r.id} className="review-card">
                <Stars value={r.rating} />
                {r.title && <h3>{r.title}</h3>}
                {r.body && <p className="review-body">{r.body}</p>}
                <div className="review-meta">
                  <span className="review-author">{r.reviewer_name}</span>
                  {r.product && (
                    <>
                      , on <Link to={`/p/${r.product.slug}`}>{r.product.name}</Link>
                    </>
                  )}
                </div>
                <div className="review-date">{formatDate(r.created_at)}</div>
              </article>
            ))}
          </div>
          {page < pages && (
            <div className="center" style={{ marginTop: 32 }}>
              <button className="btn subtle" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading' : 'Load more reviews'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
