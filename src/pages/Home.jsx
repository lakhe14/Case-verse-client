import { Link } from 'react-router-dom';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import useAsync from '../hooks/useAsync';
import { catalog } from '../api/endpoints';
import ProductCard from '../components/ProductCard';
import { Spinner, Money, Stars } from '../components/ui';
import usePageMeta from '../hooks/usePageMeta';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Reveal, StaggerGroup } from '../motion/MotionPrimitives';
import { motionTokens, reveal } from '../motion/motionConfig';

const ProductStory = lazy(() => import('../components/ProductStory'));

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
        <motion.div className="hero-product-depth" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><picture><source srcSet="/assets/caseverse/case-rotation.webp" type="image/webp" /><img className="hero-product" src={product?.images?.[0]?.url} alt="Animated CaseVerse phone cover" loading="eager" fetchPriority="high" decoding="async" /></picture></motion.div>
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
  usePageMeta(
    'CaseVerse: iPhone covers',
    'A small, carefully edited selection of iPhone covers, kept in stock and shipped across Nepal.',
    { raw: true }
  );
  const covers = useAsync(() => catalog.products({ category: 'iphone-covers', limit: 1 }), []);
  const best = useAsync(() => catalog.bestsellers({ limit: 8 }), []);
  const products = best.data?.data || [];
  const heroProduct = covers.data?.data?.[0];
  const visualProducts = useMemo(() => [heroProduct, ...products].filter((p, i, all) => p?.images?.[0]?.url && all.findIndex((v) => v.id === p.id) === i), [heroProduct, products]);
  const editorial = useMemo(() => products.filter((p) => p.images?.[0]?.url).slice(0, 3), [products]);

  return (
    <div className="home-art">
      <h1 className="sr-only">CaseVerse: iPhone covers, shipped across Nepal</h1>
      <section className="hero-single"><HeroPanel products={visualProducts} /></section>
      <section className="home-section featured-covers"><Reveal><p className="eyebrow">THE COLLECTION</p><h2>Built around<br />your iPhone.</h2></Reveal><div className="editorial-grid">{editorial.map((product, i) => <Link className={`editorial-card editorial-card--${i}`} key={product.id} to={`/p/${product.slug}`}><img src={product.images[0].url} alt={product.name} loading="lazy" /><span>{i === 0 ? 'Featured cover' : 'New arrival'}</span><strong>{product.name}</strong><em><Money value={product.price_from} /></em></Link>)}</div></section>
      {visualProducts.length && <Suspense fallback={<div className="story-fallback" />}><ProductStory products={visualProducts} /></Suspense>}
      <section className="home-section why-section"><Reveal className="line-reveal"><p className="eyebrow">WHY CASEVERSE</p><h2><span>Less noise.</span><span>More considered.</span></h2></Reveal><StaggerGroup className="feature-columns">{[['01','Exact model match','Choose the phone model that fits your device, directly from real available stock.'],['02','Selected, not crowded','A focused edit of styles for the iPhone you use every day.'],['03','Across Nepal','Protection and personality, delivered where you are.']].map(([number,title,copy]) => <motion.article variants={reveal} key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></motion.article>)}</StaggerGroup></section>
      <section className="home-section bestsellers"><Reveal className="section-head dark-head"><div><p className="eyebrow">MOST WANTED</p><h2>Chosen often.<br />Kept close.</h2></div><Link to="/shop" className="see-all">View collection →</Link></Reveal>{best.loading ? <Spinner /> : <StaggerGroup className="grid dark-grid">{products.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} />)}</StaggerGroup>}</section>
      <section className="brand-statement"><p className="eyebrow">CASEVERSE / NEPAL</p><h2>Your iPhone.<br /><i>Your CaseVerse.</i></h2><Link to="/covers" className="btn">Shop covers <span>→</span></Link></section>
    </div>
  );
}
