import { Link, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import useAsync from '../hooks/useAsync';
import { catalog } from '../api/endpoints';
import ProductCard from '../components/ProductCard';
import { Spinner, ErrorText, EmptyState, Pagination } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence } from 'motion/react';
import { Reveal, StaggerGroup } from '../motion/MotionPrimitives';

const SORTS = [['newest', 'Newest'], ['name_asc', 'Name A to Z'], ['name_desc', 'Name Z to A']];
const COPY = {
  'iphone-covers': {
    title: 'Phone covers',
    intro: 'Every cover here is cut for a specific iPhone model, so pick yours and the fit is exact.',
    meta: 'iPhone covers cut for a specific model: soft-touch silicone, clear bumpers and MagSafe cases. In stock and shipped across Nepal by CaseVerse.',
  },
  all: {
    title: 'Everything',
    intro: 'The full selection of iPhone covers currently in stock.',
    meta: 'Browse every CaseVerse iPhone cover in one place. A small, in-stock selection shipped across Nepal.',
  },
};

export default function Listing({ categorySlug }) {
  const [params, setParams] = useSearchParams();
  const effectiveCategory = categorySlug || params.get('category') || undefined;
  const copy = COPY[effectiveCategory] || COPY.all;
  const query = useMemo(() => ({
    category: effectiveCategory, q: params.get('q') || undefined, sort: params.get('sort') || 'newest',
    page: Number(params.get('page') || 1), limit: 12,
  }), [effectiveCategory, params]);
  const { data, loading, error, reload } = useAsync(() => catalog.products(query), [JSON.stringify(query)]);
  const patch = (next) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === null) merged.delete(key);
      else merged.set(key, value);
    });
    if (!('page' in next)) merged.delete('page');
    setParams(merged);
  };
  const isShop = !categorySlug;
  const heading = isShop && query.q ? `Results for "${query.q}"` : copy.title;
  usePageMeta(heading, isShop && query.q ? `Search results for "${query.q}" at CaseVerse.` : copy.meta);

  return (
    <div className="shop-page">
      <div className="listing-hero">
      <Reveal as="p" className="eyebrow">CASEVERSE / COLLECTION</Reveal>
      <Reveal as="h1" style={{ marginBottom: 10 }}>{heading}</Reveal>
      <Reveal as="p" className="muted" style={{ maxWidth: '58ch', marginTop: 0 }}>{copy.intro}</Reveal>
      <div className="spread" style={{ margin: '28px 0 0', gap: 12, flexWrap: 'wrap' }}>
        {isShop ? (
          <form style={{ flex: '1 1 200px', maxWidth: 300 }} onSubmit={(event) => { event.preventDefault(); patch({ q: event.target.q.value.trim() || undefined }); }}>
            <input name="q" placeholder="Search phone covers" defaultValue={query.q || ''} />
          </form>
        ) : <span className="muted small">{data?.pagination?.total ? `${data.pagination.total} item${data.pagination.total === 1 ? '' : 's'}` : ''}</span>}
        <select value={query.sort} onChange={(event) => patch({ sort: event.target.value })} style={{ width: 170, maxWidth: '100%' }}>
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div></div>
      {error ? <div className="catalog-error"><ErrorText error={error} /><button type="button" className="btn subtle" onClick={() => reload().catch(() => {})}>Try again</button></div> : loading ? <div className="catalog-skeleton" aria-label="Loading products">{Array.from({ length: 8 }, (_, i) => <div className="skel" key={i} />)}</div> : !data?.data?.length ? (
        <EmptyState title={query.q ? `No results for "${query.q}"` : 'Nothing here yet'}>
          <p className="muted" style={{ maxWidth: '38ch', margin: '0 auto 14px' }}>{query.q ? 'Nothing matched that search. Try a different word, or browse the full range.' : 'This section is being stocked. Check back soon.'}</p>
          <Link to="/shop" className="btn sm">Browse everything</Link>
        </EmptyState>
      ) : <><StaggerGroup className="grid"><AnimatePresence mode="popLayout">{data.data.map((product) => <ProductCard key={product.id} product={product} />)}</AnimatePresence></StaggerGroup><Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={(page) => patch({ page })} /></>}
    </div>
  );
}
