import { Link } from 'react-router-dom';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import useAsync from '../hooks/useAsync';
import { catalog } from '../api/endpoints';
import ProductCard from '../components/ProductCard';
import { Spinner, Stars } from '../components/ui';
import SalePrice from '../components/SalePrice';
import DashainSection from '../components/DashainSection';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Reveal, StaggerGroup } from '../motion/MotionPrimitives';
import { motionTokens, reveal } from '../motion/motionConfig';

const ProductStory = lazy(() => import('../components/ProductStory'));
const FEATURED_SLUGS = ['pink-floral', 'bow-cherry-iconic', 'chetah-iconic'];
const featuredReveal = {
  hidden: { opacity: 0, y: 28, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.52, ease: motionTokens.ease.standard } },
};

function canUsePointerMotion(event, reduce) {
  return !reduce && event.pointerType === 'mouse' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function usePointerMotion(reduce, type) {
  const ref = useRef(null);
  const frame = useRef(null);

  useEffect(() => () => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
  }, []);

  const reset = () => {
    const element = ref.current;
    if (!element) return;
    if (frame.current) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    element.classList.remove('is-pointer-active');
    element.style.setProperty('--pointer-x', '50%');
    element.style.setProperty('--pointer-y', '50%');
    if (type === 'card') {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
      element.style.setProperty('--image-x', '0px');
      element.style.setProperty('--image-y', '0px');
    }
    if (type === 'cta') {
      element.style.setProperty('--cta-x', '0px');
      element.style.setProperty('--cta-y', '0px');
    }
  };

  const onPointerEnter = (event) => {
    if (!canUsePointerMotion(event, reduce)) return;
    ref.current?.classList.add('is-pointer-active');
  };

  const onPointerMove = (event) => {
    if (!canUsePointerMotion(event, reduce)) return;
    const element = ref.current;
    if (!element || frame.current) return;
    const { left, top, width, height } = element.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - left) / width));
    const y = Math.min(1, Math.max(0, (event.clientY - top) / height));
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      element.style.setProperty('--pointer-x', `${x * 100}%`);
      element.style.setProperty('--pointer-y', `${y * 100}%`);
      if (type === 'card') {
        element.style.setProperty('--tilt-x', `${(0.5 - y) * 4}deg`);
        element.style.setProperty('--tilt-y', `${(x - 0.5) * 5}deg`);
        element.style.setProperty('--image-x', `${(x - 0.5) * 7}px`);
        element.style.setProperty('--image-y', `${(y - 0.5) * 6}px`);
      }
      if (type === 'cta') {
        element.style.setProperty('--cta-x', `${(x - 0.5) * 5}px`);
        element.style.setProperty('--cta-y', `${(y - 0.5) * 3}px`);
      }
    });
  };

  return { ref, onPointerEnter, onPointerMove, onPointerLeave: reset };
}

function FeaturedCase({ product, reduce }) {
  const pointer = usePointerMotion(reduce, 'card');
  if (!product) {
    return (
      <motion.article className="featured-case featured-case--missing" variants={featuredReveal}>
        <p className="featured-case__label">Featured case</p>
        <h3>Currently unavailable</h3>
        <p>We could not load this selected CaseVerse design.</p>
      </motion.article>
    );
  }

  const image = product.images?.[0]?.url;
  if (!image) {
    return (
      <motion.article className="featured-case featured-case--missing" variants={featuredReveal}>
        <p className="featured-case__label">Featured case</p>
        <h3>{product.name}</h3>
        <p>This design is temporarily unavailable.</p>
      </motion.article>
    );
  }

  return (
    <motion.div className="featured-case-entry" variants={featuredReveal}>
      <article className="featured-case" {...pointer}>
        <Link className="featured-case__link" to={`/p/${product.slug}`} aria-label={`View ${product.name}`}>
          <span className="featured-case__pointer-light" aria-hidden="true" />
          <div className="featured-case__media">
            <img src={image} alt={product.name} loading="lazy" />
            <span className="featured-case__glint" aria-hidden="true" />
          </div>
          <div className="featured-case__body">
            <p className="featured-case__label">CaseVerse / iPhone cover</p>
            <div className="featured-case__title-row">
              <h3>{product.name}</h3>
              <span className="featured-case__arrow" aria-hidden="true">↗</span>
            </div>
            <SalePrice price={product.price_from} compareAt={product.compare_at_price_from} />
            {!product.in_stock && <span className="featured-case__oos">Currently out of stock</span>}
          </div>
        </Link>
      </article>
    </motion.div>
  );
}

function HeroPanel({ products }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0); const [paused, setPaused] = useState(false);
  const visualProducts = useMemo(() => products.filter((p) => p.images?.[0]?.url).slice(0, 5), [products]);
  useEffect(() => { if (reduce || paused || visualProducts.length < 2) return undefined; const timer = window.setInterval(() => { if (!document.hidden) setIndex((value) => (value + 1) % visualProducts.length); }, 4600); return () => window.clearInterval(timer); }, [reduce, paused, visualProducts.length]);
  const product = visualProducts[index];
  return (
    <motion.div className="hero-panel hero-panel--feature premium-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.fast }}>
      <Link to="/covers" className="hero-link" aria-label="Shop phone covers">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="hero-fog hero-fog--one" aria-hidden="true" /><div className="hero-fog hero-fog--two" aria-hidden="true" />
        <motion.div className="hero-product-depth" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><picture><source srcSet="/assets/caseverse/case-rotation.webp" type="image/webp" /><img className="hero-product" src={product?.images?.[0]?.url || '/assets/caseverse/story/precision-fit.jpeg'} alt="Animated CaseVerse phone cover" loading="eager" fetchPriority="high" decoding="async" /></picture></motion.div>
        <motion.div className="hp-inner" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } } }}>
          <motion.p variants={reveal} className="hero-eyebrow">CASEVERSE / IPHONE COVERS</motion.p>
          <motion.h2 variants={reveal}>Designed to protect.<br />Built to be noticed.</motion.h2>
          <motion.p variants={reveal}>Premium iPhone covers crafted for everyday style and a precise fit.</motion.p>
          <motion.span variants={reveal} className="btn hero-cta">Shop covers <span aria-hidden="true">→</span></motion.span>
        </motion.div>
        {visualProducts.length > 1 && <div className="hero-indicator" aria-label={`Showing product ${index + 1} of ${visualProducts.length}`}>{visualProducts.map((item, itemIndex) => <i key={item.id} className={itemIndex === index ? 'is-active' : ''} />)}</div>}
      </Link>
    </motion.div>
  );
}

export default function Home() {
  const reduce = useReducedMotion();
  const featuredPointer = usePointerMotion(reduce, 'section');
  const featuredCtaPointer = usePointerMotion(reduce, 'cta');
  usePageMeta(
    'CaseVerse: iPhone covers',
    'A small, carefully edited selection of iPhone covers, kept in stock and shipped across Nepal.',
    { raw: true }
  );
  const covers = useAsync(() => catalog.products({ category: 'iphone-covers', limit: 1 }), []);
  const best = useAsync(() => catalog.bestsellers({ limit: 8 }), []);
  const featured = useAsync(
    () => Promise.all(FEATURED_SLUGS.map(async (slug) => {
      try {
        return (await catalog.product(slug)).data;
      } catch {
        return null;
      }
    })),
    []
  );
  const products = best.data?.data || [];
  const heroProduct = covers.data?.data?.[0];
  const visualProducts = useMemo(() => [heroProduct, ...products].filter((p, i, all) => p?.images?.[0]?.url && all.findIndex((v) => v.id === p.id) === i), [heroProduct, products]);

  return (
    <div className="home-art full-bleed">
      <h1 className="sr-only">CaseVerse: iPhone covers, shipped across Nepal</h1>
      <section className="hero-single"><HeroPanel products={visualProducts} /></section>
      <DashainSection />
      <section className="home-section featured-covers" aria-labelledby="featured-cases-title" {...featuredPointer}>
        <span className="featured-covers__spotlight" aria-hidden="true" />
        <Reveal className="featured-covers__head">
          <div>
            <p className="eyebrow">FEATURED CASES</p>
            <h2 id="featured-cases-title" className="featured-covers__headline">
              <span className="featured-covers__headline-clip"><motion.span initial={reduce ? false : { opacity: 0, y: '105%', filter: 'blur(3px)' }} whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, amount: 0.7 }} transition={{ duration: 0.54, ease: motionTokens.ease.standard }}>Built to</motion.span></span>
              <span className="featured-covers__headline-clip"><motion.span initial={reduce ? false : { opacity: 0, y: '105%', filter: 'blur(3px)' }} whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, amount: 0.7 }} transition={{ duration: 0.54, delay: 0.07, ease: motionTokens.ease.standard }}>stand out.</motion.span></span>
            </h2>
          </div>
          <p>A small curated selection of CaseVerse designs.</p>
        </Reveal>
        {featured.loading ? <Spinner /> : (
          <StaggerGroup className="featured-cases-grid">
            {FEATURED_SLUGS.map((slug, index) => <FeaturedCase key={slug} product={featured.data?.[index]} reduce={reduce} />)}
          </StaggerGroup>
        )}
        <motion.div className="featured-covers__footer" variants={reveal} initial={reduce ? false : 'hidden'} whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
          <Link to="/covers" className="featured-covers__cta" {...featuredCtaPointer}>Explore all covers <span aria-hidden="true">→</span></Link>
        </motion.div>
      </section>
      <Suspense fallback={<div className="story-fallback" />}><ProductStory /></Suspense>
      <section className="home-section why-section"><Reveal className="line-reveal"><p className="eyebrow">WHY CASEVERSE</p><h2><span>Less noise.</span><span>More considered.</span></h2></Reveal><StaggerGroup className="feature-columns">{[['01','Exact model match','Choose the phone model that fits your device, directly from real available stock.'],['02','Selected, not crowded','A focused edit of styles for the iPhone you use every day.'],['03','Across Nepal','Protection and personality, delivered where you are.']].map(([number,title,copy]) => <motion.article variants={reveal} key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></motion.article>)}</StaggerGroup></section>
      <section className="home-section bestsellers"><Reveal className="section-head dark-head"><div><p className="eyebrow">MOST WANTED</p><h2>Chosen often.<br />Kept close.</h2></div><Link to="/shop" className="see-all">View collection →</Link></Reveal>{best.loading ? <Spinner /> : <StaggerGroup className="grid dark-grid">{products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</StaggerGroup>}</section>
      <section className="brand-statement"><p className="eyebrow">CASEVERSE / NEPAL</p><h2>Your iPhone.<br /><i>Your CaseVerse.</i></h2><Link to="/covers" className="btn">Shop covers <span>→</span></Link></section>
    </div>
  );
}
