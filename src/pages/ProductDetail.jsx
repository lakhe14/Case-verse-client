import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import useAsync from '../hooks/useAsync';
import { catalog, reviews as reviewsApi } from '../api/endpoints';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { categoryPath } from '../components/Layout';
import { Spinner, ErrorText, Money, Stars, QuantityStepper } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence, motion } from 'motion/react';
import { MotionButton, StaggerGroup } from '../motion/MotionPrimitives';
import SalePrice from '../components/SalePrice';

/** Trim a product description into a ~155-char meta description. */
function metaFromProduct(product) {
  if (!product) return undefined;
  const base = (product.description || '').trim();
  const text = base || `${product.name}. Available now at CaseVerse.`;
  const priced = product.price_from
    ? `${text} From NPR ${Number(product.price_from).toLocaleString()}.`
    : text;
  return priced.length > 158 ? `${priced.slice(0, 155).trimEnd()}…` : priced;
}

function VariantPicker({ variants, value, onChange }) {
  const attrNames = useMemo(() => {
    const names = [];
    variants.forEach((v) => v.attributes.forEach((a) => !names.includes(a.name) && names.push(a.name)));
    return names;
  }, [variants]);

  const [selection, setSelection] = useState(() => {
    const init = {};
    (value?.attributes || variants[0]?.attributes || []).forEach((a) => {
      init[a.name] = a.value;
    });
    return init;
  });

  const pick = (name, val) => {
    const next = { ...selection, [name]: val };
    setSelection(next);
    const match = variants.find((v) => v.attributes.every((a) => next[a.name] === a.value));
    if (match) onChange(match);
  };

  return (
    <div className="stack">
      {attrNames.map((name) => {
        const options = [
          ...new Set(variants.flatMap((v) => v.attributes.filter((a) => a.name === name).map((a) => a.value))),
        ];
        // A single value across all variants isn't a choice; state it plainly.
        if (options.length <= 1) {
          return (
            <div key={name} className="opt-group">
              <span className="opt-label" style={{ display: 'inline' }}>{name}: </span>
              <span>{options[0] || 'One option'}</span>
            </div>
          );
        }
        return (
          <div key={name} className="opt-group">
            <div className="opt-label">{name}</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {options.map((opt) => (
                <button
                  key={opt}
                  className={`opt-chip ${selection[name] === opt ? 'active' : ''}`}
                  onClick={() => pick(name, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StarInput({ value, onChange }) {
  return (
    <div className="row" style={{ gap: 2 }} role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 3px',
            cursor: 'pointer',
            fontSize: '1.5rem',
            lineHeight: 1,
            color: n <= value ? 'var(--oxblood)' : 'var(--brass-line)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ productId, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await reviewsApi.create({
        product_id: productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      onSubmitted();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ maxWidth: '46ch' }}>
      <ErrorText error={err} />
      <div>
        <div className="muted small" style={{ fontWeight: 500, marginBottom: 4 }}>Your rating</div>
        <StarInput value={rating} onChange={setRating} />
      </div>
      <input
        placeholder="Title (optional)"
        value={title}
        maxLength={150}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="What did you think of it?"
        rows={4}
        value={body}
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
      />
      <button className="btn" disabled={busy}>
        {busy ? 'Submitting your review' : 'Submit review'}
      </button>
    </form>
  );
}

function WriteReview({ productId, slug }) {
  const { isCustomer } = useAuth();
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const { data, loading } = useAsync(
    () => (isCustomer ? reviewsApi.eligibility(productId) : Promise.resolve(null)),
    [productId, isCustomer]
  );

  const heading = (
    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, margin: '30px 0 12px' }}>
      Write a review
    </h3>
  );
  const wrap = (child) => (
    <div style={{ maxWidth: '68ch' }}>
      {heading}
      {child}
    </div>
  );

  if (!isCustomer) {
    return wrap(
      <p className="muted">
        <Link to="/login" state={{ from: { pathname: `/p/${slug}` } }}>Sign in</Link> to leave a
        review.
      </p>
    );
  }
  if (submitted) {
    return wrap(
      <div className="alert ok">Thanks. Your review has been submitted and is awaiting approval.</div>
    );
  }
  if (loading) return wrap(<Spinner />);

  const e = data?.data;
  if (e?.review) {
    if (e.review.status === 'pending') {
      return wrap(<p className="muted">Your review is pending approval.</p>);
    }
    if (e.review.status === 'approved') {
      return wrap(
        <div className="review-item">
          <div className="spread">
            <strong style={{ fontWeight: 500 }}>{e.review.title || 'Your review'}</strong>
            <Stars value={e.review.rating} />
          </div>
          {e.review.body && <p style={{ margin: '6px 0' }}>{e.review.body}</p>}
          <div className="muted small">Your review</div>
        </div>
      );
    }
    return wrap(<p className="muted">Your review of this product was not published.</p>);
  }
  if (!e?.can_review) {
    return wrap(
      <p className="muted small">
        Only customers who have received this product can leave a review.
      </p>
    );
  }
  return wrap(
    <ReviewForm
      productId={productId}
      onSubmitted={() => {
        setSubmitted(true);
        toast.success('Thanks. Your review has been submitted for approval.');
      }}
    />
  );
}

function ReviewsPanel({ productId }) {
  const { data, loading } = useAsync(() => reviewsApi.forProduct(productId, { limit: 5 }), [productId]);
  if (loading) return <Spinner />;
  const summary = data?.summary;
  return (
    <div style={{ marginTop: 48 }}>
      <div className="section-head">
        <h2>Reviews</h2>
        {summary?.count ? (
          <span className="see-all">
            <Stars value={summary.average} /> {summary.average} out of 5, {summary.count} review
            {summary.count === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="see-all">No reviews yet</span>
        )}
      </div>
      {(data?.data || []).length > 0 && (
        <div style={{ maxWidth: '68ch' }}>
          {data.data.map((r) => (
            <div key={r.id} className="review-item">
              <div className="spread">
                <strong style={{ fontWeight: 500 }}>{r.title || 'Review'}</strong>
                <Stars value={r.rating} />
              </div>
              <p style={{ margin: '6px 0' }}>{r.body}</p>
              <div className="muted small">{r.reviewer_name || 'A customer'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isCustomer } = useAuth();
  const toast = useToast();
  const { data, loading, error } = useAsync(() => catalog.product(slug), [slug]);

  const product = data?.data;
  usePageMeta(
    product ? `${product.name}${product.category ? `, ${product.category.name}` : ''}` : 'Product',
    metaFromProduct(product)
  );
  const [variant, setVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [added, setAdded] = useState(false);

  const active = variant || product?.variants?.find((v) => v.in_stock) || product?.variants?.[0];

  if (loading) return <Spinner />;
  if (error) return <ErrorText error={error} />;
  if (!product) return null;

  const gallery = active?.images?.length ? active.images : product.images;
  const hero = gallery?.[imgIdx] || gallery?.[0];

  const onAdd = async () => {
    if (!isCustomer) return navigate('/login', { state: { from: { pathname: `/p/${slug}` } } });
    if (!active) return;
    setAdding(true);
    setAddError(null);
    try {
      await addItem(active.id, qty);
      setAdded(true);
      toast.success(`Added ${product.name} to your cart.`, {
        action: { label: 'View cart', onClick: () => navigate('/cart') },
      });
      setTimeout(() => setAdded(false), 2000);
    } catch (e) {
      setAddError(e);
      toast.error(e.message || 'Could not add this to your cart.');
    } finally {
      setAdding(false);
    }
  };

  const stockNote = () => {
    if (!active) return null;
    if (!active.in_stock) return <span className="stock-out">Out of stock</span>;
    if (active.stock_quantity <= 5) return <span className="stock-low">Only {active.stock_quantity} left</span>;
    return <span className="stock-in">In stock</span>;
  };

  const backTo = product.category ? categoryPath(product.category.slug) : '/shop';

  return (
    <div>
      <Link to={backTo} className="muted small">
        Back to {product.category?.name || 'shop'}
      </Link>

      <StaggerGroup className="row pdp-layout" style={{ marginTop: 16, alignItems: 'flex-start', gap: '28px 48px', flexWrap: 'wrap' }}>
        <div className="pdp-gallery" style={{ flex: '1 1 300px', maxWidth: 520, minWidth: 0 }}>
          <div className="pdp-media">
            <AnimatePresence mode="wait">
            {hero?.url ? (
              <motion.img
                key={hero.url}
                className="pdp-hero-img"
                src={hero.url}
                alt={product.name}
                decoding="async"
                initial={{ opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              />
            ) : (
              <div className="center muted" style={{ padding: '42% 0' }}>{product.name}</div>
            )}</AnimatePresence>
          </div>
          {gallery?.length > 1 && (
            <div className="pdp-thumbs">
              {gallery.map((g, i) => (
                <button
                  key={g.id || i}
                  className={i === imgIdx ? 'active' : ''}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Image ${i + 1}`}
                >
                  {g.url ? <img src={g.url} alt="" loading="lazy" decoding="async" /> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 300px', minWidth: 0 }} className="stack pdp-info">
          <div>
            <div className="pdp-cat">{product.category?.name}</div>
            <h1 style={{ margin: '6px 0 14px' }}>{product.name}</h1>
            <div className="pdp-price">
              <SalePrice price={active?.price ?? product.base_price} compareAt={active?.compare_at_price} />
            </div>
          </div>

          <p style={{ maxWidth: '46ch', color: 'var(--ink-soft)' }}>{product.description}</p>

          {product.variants?.length > 1 && (
            <VariantPicker variants={product.variants} value={active} onChange={(v) => { setVariant(v); setImgIdx(0); }} />
          )}

          <div className="row" style={{ alignItems: 'center', gap: 14 }}>
            <QuantityStepper value={qty} max={Math.max(1, active?.stock_quantity || 1)} onChange={setQty} />
            {stockNote()}
          </div>

          <ErrorText error={addError} />
          <div className="pdp-cart-actions">
            <MotionButton className="btn block" disabled={adding || !active?.in_stock} onClick={onAdd}>
              {added ? 'Added to cart' : adding ? 'Adding' : 'Add to cart'}
            </MotionButton>
            {added && (
              <Link to="/cart" className="btn subtle block pdp-view-cart">
                View cart
              </Link>
            )}
          </div>
          {active?.sku && <div className="muted small">SKU {active.sku}</div>}
        </div>
      </StaggerGroup>

      <ReviewsPanel productId={product.id} />
      <WriteReview productId={product.id} slug={slug} />
    </div>
  );
}
