import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import useAsync from '../hooks/useAsync';
import { catalog } from '../api/endpoints';
import ProductCard from '../components/ProductCard';
import { ErrorText, EmptyState, Pagination } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence } from 'motion/react';
import { Reveal, StaggerGroup } from '../motion/MotionPrimitives';
import LimitedSale from '../components/LimitedSale';

const SORTS = [['newest', 'Newest'], ['name_asc', 'Name A to Z'], ['name_desc', 'Name Z to A']];
const SEARCH_EXAMPLES = ['floral', 'bow', 'black', 'cherry', 'iPhone 15'];
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

// Model words a search can name; the server does the real matching.
const MODEL_WORDS = new Set(['pro', 'max', 'plus', 'mini', 'e']);

/**
 * When the search names a model ("iphone 15 pro"), link each result straight
 * to that model in stock so the product page opens with it chosen.
 */
function modelLink(product, q) {
  const terms = String(q || '').toLowerCase().replace(/([a-z])(\d)/g, '$1 $2').split(/[^a-z0-9]+/).filter(Boolean);
  const numbers = terms.filter((t) => /^\d+$/.test(t));
  if (!numbers.length) return undefined;
  const words = terms.filter((t) => MODEL_WORDS.has(t));
  const match = product.variants?.find((v) => {
    if (!v.in_stock) return false;
    const model = v.attributes.map((a) => a.value).join(' ');
    const parts = model.toLowerCase().split(/\s+/);
    return numbers.every((n) => parts.includes(n)) && words.every((w) => parts.includes(w))
      && parts.filter((p) => MODEL_WORDS.has(p)).every((p) => words.includes(p));
  });
  if (!match) return undefined;
  return `/p/${product.slug}?model=${encodeURIComponent(match.attributes.map((a) => a.value).join(' / '))}`;
}

export default function Listing({ categorySlug }) {
  const [params, setParams] = useSearchParams();
  const effectiveCategory = categorySlug || params.get('category') || undefined;
  const copy = COPY[effectiveCategory] || COPY.all;
  const query = useMemo(() => ({
    category: effectiveCategory, q: params.get('q') || undefined, sort: params.get('sort') || 'newest',
    page: Number(params.get('page') || 1), limit: 12,
  }), [effectiveCategory, params]);
  const { data, loading, error, reload } = useAsync(() => catalog.products(query), [JSON.stringify(query)]);
  const [draft, setDraft] = useState(query.q || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => setDraft(query.q || ''), [query.q]);

  const patch = (next) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === null) merged.delete(key);
      else merged.set(key, value);
    });
    if (!('page' in next)) merged.delete('page');
    setParams(merged);
  };
  const search = (value) => patch({ q: value.trim() || undefined });
  const clearSearch = () => {
    setDraft('');
    patch({ q: undefined });
    inputRef.current?.focus();
  };

  const heading = query.q ? `Results for "${query.q}"` : copy.title;
  usePageMeta(heading, query.q ? `Search results for "${query.q}" at CaseVerse.` : copy.meta);
  const total = data?.pagination?.total;

  // Rendered once for the desktop sidebar and once for the mobile drawer;
  // both can be in the DOM at once (drawer open on a resized viewport), so
  // each instance needs its own element ids to stay valid HTML.
  const renderFilters = (idPrefix, searchInputRef) => (
    <>
      <form className="listing-search" role="search" onSubmit={(event) => { event.preventDefault(); search(draft); setFiltersOpen(false); }}>
        <label htmlFor={`${idPrefix}-search-input`} className="sr-only">Search covers by design or iPhone model</label>
        <input
          id={`${idPrefix}-search-input`}
          ref={searchInputRef}
          type="search"
          name="q"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Design or iPhone model, e.g. floral, 15 Pro"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
        />
        {draft && (
          <button type="button" className="listing-search-clear" onClick={clearSearch} aria-label="Clear search">×</button>
        )}
        <button type="submit" className="btn subtle listing-search-go">Search</button>
      </form>
      <div className="field">
        <label htmlFor={`${idPrefix}-sort-select`} className="field-label">Sort by</label>
        <select id={`${idPrefix}-sort-select`} aria-label="Sort" value={query.sort} onChange={(event) => { patch({ sort: event.target.value }); setFiltersOpen(false); }} className="listing-sort">
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <p className="muted small listing-count" aria-live="polite">
        {loading || total == null ? '' : `${total} item${total === 1 ? '' : 's'}`}
      </p>
    </>
  );

  return (
    <div className="shop-page">
      <div className="listing-hero">
        <Reveal as="p" className="eyebrow">CASEVERSE / COLLECTION</Reveal>
        <Reveal as="h1" style={{ marginBottom: 6 }}>{heading}</Reveal>
        <Reveal as="p" className="muted" style={{ maxWidth: '58ch', marginTop: 0, marginBottom: 0 }}>{copy.intro}</Reveal>
      </div>

      <div className="shop-layout">
        <aside className="shop-filters" aria-label="Filters">
          {renderFilters('shop-filters', inputRef)}
        </aside>

        <button
          type="button"
          className="shop-filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="shop-filters-drawer"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters{query.q || query.sort !== 'newest' ? ' •' : ''}
        </button>
        {filtersOpen && (
          <div id="shop-filters-drawer" className="shop-filters-drawer" aria-label="Filters">
            {renderFilters('shop-filters-drawer', null)}
          </div>
        )}

        <div className="shop-results">
          {!(query.q && data && !data.data?.length) && <LimitedSale />}
          {error ? <div className="catalog-error"><ErrorText error={error} /><button type="button" className="btn subtle" onClick={() => reload().catch(() => {})}>Try again</button></div> : loading ? <div className="catalog-skeleton" aria-label="Loading products">{Array.from({ length: 8 }, (_, i) => <div className="skel" key={i} />)}</div> : !data?.data?.length ? (
            <EmptyState title={query.q ? `No covers match "${query.q}"` : 'Nothing here yet'}>
              {query.q ? (
                <>
                  <p className="muted" style={{ maxWidth: '42ch', margin: '0 auto 14px' }}>Try a design word or just your iPhone number.</p>
                  <div className="search-suggestions">
                    {SEARCH_EXAMPLES.map((example) => (
                      <button type="button" key={example} className="opt-chip" onClick={() => search(example)}>{example}</button>
                    ))}
                  </div>
                  <button type="button" className="btn sm" onClick={clearSearch}>Clear search</button>
                </>
              ) : (
                <>
                  <p className="muted" style={{ maxWidth: '38ch', margin: '0 auto 14px' }}>This section is being stocked. Check back soon.</p>
                  <Link to="/shop" className="btn sm">Browse everything</Link>
                </>
              )}
            </EmptyState>
          ) : <><StaggerGroup className="grid"><AnimatePresence mode="popLayout">{data.data.map((product) => <ProductCard key={product.id} product={product} to={modelLink(product, query.q)} />)}</AnimatePresence></StaggerGroup><Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={(page) => patch({ page })} /></>}
        </div>
      </div>
    </div>
  );
}
