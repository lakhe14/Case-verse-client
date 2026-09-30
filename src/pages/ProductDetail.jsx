import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
import { mediaUrl } from '../utils/mediaUrl';
import { stockState } from '../utils/stock';
import { useCampaign } from '../hooks/useCampaign';
import { whatsapp } from '../config';

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

/** Chip label for a variant: its attribute values ("iPhone 15 Pro"). */
const modelOf = (variant) => variant.attributes.map((a) => a.value).filter(Boolean).join(' / ') || variant.sku;

/**
 * One chip per model. A sold-out model stays visible (so shoppers know it
 * exists) but cannot be chosen. With several models nothing is pre-chosen:
 * the shopper picks their iPhone before anything can go in the cart.
 */
function ModelPicker({ variants, value, onChange, invalid, groupRef }) {
  const label = variants[0]?.attributes?.[0]?.name || 'Phone Model';
  return (
    <div className="opt-group">
      <div id="model-picker-label" className="opt-label">
        {label}
        {value ? <span className="opt-chosen">: {modelOf(value)}</span> : null}
      </div>
      <div
        ref={groupRef}
        className={`row model-chips${invalid ? ' is-invalid' : ''}`}
        role="group"
        aria-labelledby="model-picker-label"
        aria-describedby={invalid ? 'model-required' : undefined}
      >
        {variants.map((v) => (
          <button
            type="button"
            key={v.id}
            className={`opt-chip ${value?.id === v.id ? 'active' : ''}`}
            aria-pressed={value?.id === v.id}
            disabled={!v.in_stock}
            onClick={() => onChange(v)}
          >
            {modelOf(v)}
            {!v.in_stock && <span className="opt-chip-note"> Sold out</span>}
          </button>
        ))}
      </div>
      {invalid && <p id="model-required" className="field-error" role="alert">Choose your iPhone model first.</p>}
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
    <div id="write-review" style={{ maxWidth: '68ch' }}>
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

function focusWriteReview() {
  const el = document.getElementById('write-review');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.querySelector('button, a, input, textarea')?.focus({ preventScroll: true });
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
          <button type="button" className="btn sm subtle" onClick={focusWriteReview}>
            Be the first to review
          </button>
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

function PdpHelp() {
  return (
    <div className="pdp-help">
      <p><strong>Delivery across Nepal</strong> by ParcelMoover. The delivery charge for your area is shown at checkout.</p>
      <p>
        <Link to="/shipping">Shipping & delivery</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/returns">Returns</Link>
        {whatsapp.link && (
          <>
            <span aria-hidden="true"> · </span>
            <a href={whatsapp.link} target="_blank" rel="noopener">Ask us on WhatsApp</a>
          </>
        )}
      </p>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addItem, ensureItem, openDrawer } = useCart();
  const toast = useToast();
  const campaign = useCampaign();
  const { data, loading, error } = useAsync(() => catalog.product(slug), [slug]);

  const product = data?.data;
  usePageMeta(
    product ? `${product.name}${product.category ? `, ${product.category.name}` : ''}` : 'Product',
    metaFromProduct(product)
  );
  const [variant, setVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [needsModel, setNeedsModel] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const pickerRef = useRef(null);
  const actionsRef = useRef(null);

  const variants = product?.variants || [];
  const requestedModel = params.get('model');

  // The only model is chosen automatically. With several, only a model named
  // in the link (from search or the cart) and actually in stock is chosen.
  useEffect(() => {
    setQty(1);
    setImgIdx(0);
    setNeedsModel(false);
    setActionError(null);
    const live = product?.variants || [];
    if (live.length === 1) setVariant(live[0]);
    else setVariant(live.find((v) => v.in_stock && requestedModel && modelOf(v) === requestedModel) || null);
  }, [product, requestedModel]);

  // Phones: a slim purchase bar once the main buttons have scrolled above the
  // viewport. A scroll check, not IntersectionObserver: a fast fling can jump
  // past the buttons without them ever intersecting, so no callback would fire.
  useEffect(() => {
    if (loading || !product) return undefined;
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = actionsRef.current;
      setShowSticky(Boolean(el) && el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [product, loading]);

  if (loading) return <Spinner />;
  if (error) return <ErrorText error={error} />;
  if (!product) return null;

  const gallery = variant?.images?.length ? variant.images : product.images;
  const hero = gallery?.[imgIdx] || gallery?.[0];
  const soldOut = !product.in_stock;
  const available = variant?.stock_quantity ?? 0;
  const stock = variant ? stockState(available) : null;
  const isCover = product.category?.slug === 'iphone-covers';

  const requireModel = () => {
    if (variant?.in_stock) return true;
    setNeedsModel(true);
    pickerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    pickerRef.current?.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    return false;
  };

  const onAdd = async (event) => {
    if (busy || !requireModel()) return;
    // The main button, even when the sticky bar was used: that bar hides once focus returns.
    const trigger = event?.currentTarget?.closest('.pdp-sticky-bar') ? actionsRef.current?.querySelector('button') : event?.currentTarget;
    setBusy('add');
    setActionError(null);
    try {
      await addItem(variant.id, qty);
      openDrawer(trigger);
    } catch (e) {
      setActionError(e);
      toast.error(e.message || 'Could not add this to your cart.');
    } finally {
      setBusy(null);
    }
  };

  // Buy now = make sure this model is in the cart, then the normal checkout.
  const onBuyNow = async () => {
    if (busy || !requireModel()) return;
    setBusy('buy');
    setActionError(null);
    try {
      await ensureItem(variant.id, qty);
      navigate('/checkout', { state: { buyNow: { variantId: variant.id } } });
    } catch (e) {
      setActionError(e);
      toast.error(e.message || 'Could not start checkout.');
      setBusy(null);
    }
  };

  const backTo = product.category ? categoryPath(product.category.slug) : '/shop';
  const price = variant?.price ?? product.price_from;
  const compareAt = variant ? variant.compare_at_price : product.compare_at_price_from;

  return (
    <div className={`pdp-page${showSticky ? ' has-sticky' : ''}`}>
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
                src={mediaUrl(hero.url)}
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
                  {g.url ? <img src={mediaUrl(g.url)} alt="" loading="lazy" decoding="async" /> : null}
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
              <SalePrice price={price} compareAt={compareAt} />
            </div>
            {isCover && campaign?.active && campaign.bundle_price != null && (
              <p className="pdp-offer" data-testid="pdp-dashain-offer">
                <strong>Dashain Trio:</strong> any {campaign.required_case_quantity} cases for NPR {campaign.bundle_price.toLocaleString()} + a FREE suction holder, applied in your cart.
              </p>
            )}
          </div>

          {variants.length ? (
            <ModelPicker
              variants={variants}
              value={variant}
              invalid={needsModel && !variant}
              groupRef={pickerRef}
              onChange={(v) => { setVariant(v); setNeedsModel(false); setQty(1); setImgIdx(0); }}
            />
          ) : (
            <p className="alert" role="status">Phone model compatibility is unavailable for this cover.</p>
          )}

          <div className="pdp-stock" aria-live="polite" data-testid="pdp-stock">
            {soldOut ? (
              <span className="stock-out">Sold out in every model</span>
            ) : stock ? (
              <span className={`stock-${stock.kind}`}>{stock.label}</span>
            ) : (
              <span className="muted small">Choose your model to see availability.</span>
            )}
          </div>

          {variant?.in_stock && available > 1 && (
            <QuantityStepper value={qty} max={available} onChange={setQty} label={product.name} />
          )}

          <ErrorText error={actionError} />
          <div className="pdp-cart-actions" ref={actionsRef}>
            <MotionButton className="btn" disabled={soldOut || Boolean(busy)} onClick={onAdd}>
              {soldOut ? 'Sold out' : busy === 'add' ? 'Adding' : 'Add to cart'}
            </MotionButton>
            <MotionButton className="btn subtle pdp-buy-now" disabled={soldOut || Boolean(busy)} onClick={onBuyNow}>
              {busy === 'buy' ? 'Starting checkout' : 'Buy now'}
            </MotionButton>
          </div>

          <PdpHelp />

          {product.description && <p className="pdp-description">{product.description}</p>}
          {variant?.sku && <div className="muted small">SKU {variant.sku}</div>}
        </div>
      </StaggerGroup>

      <ReviewsPanel productId={product.id} />
      <WriteReview productId={product.id} slug={slug} />

      {!soldOut && (
        <div className={`pdp-sticky-bar${showSticky ? ' is-visible' : ''}`} aria-hidden={!showSticky}>
          <div className="pdp-sticky-info">
            <strong><Money value={price} /></strong>
            <span className="muted small">{variant ? modelOf(variant) : 'Choose your model'}</span>
          </div>
          <button type="button" className="btn" tabIndex={showSticky ? 0 : -1} disabled={Boolean(busy)} onClick={onAdd}>
            {variant ? 'Add to cart' : 'Choose model'}
          </button>
        </div>
      )}
    </div>
  );
}