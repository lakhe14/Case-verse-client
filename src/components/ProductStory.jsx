import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  ['01', 'Precision fit', 'Cut for the iPhone you carry — no loose edges, no compromise.'],
  ['02', 'Camera protection', 'A raised perimeter keeps the lens array clear of everyday surfaces.'],
  ['03', 'MagSafe ready', 'Select styles are designed to work beautifully with your MagSafe routine.'],
  ['04', 'Soft-touch grip', 'A confident hold that feels considered from the first touch.'],
];

export default function ProductStory({ products = [] }) {
  const root = useRef(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const visuals = useMemo(() => products.filter((p) => p.images?.[0]?.url).slice(0, 4), [products]);
  useGSAP(() => {
    if (reduce || window.matchMedia('(max-width: 700px)').matches || visuals.length < 2) return undefined;
    gsap.to({}, { scrollTrigger: { trigger: root.current, start: 'top top', end: '+=1200', scrub: .45, pin: true, anticipatePin: 1, onUpdate: (self) => setActive(Math.min(3, Math.floor(self.progress * 4))) } });
  }, { scope: root, dependencies: [reduce, visuals.length] });

  const visual = visuals[active % Math.max(visuals.length, 1)];
  return <section ref={root} className={`story-scene story-state-${active}`}>
    <div className="story-device-wrap">
      <div className="story-orbit" aria-hidden="true" />
      <div className="story-reflection" aria-hidden="true" />
      <AnimatePresence mode="wait">{visual?.images?.[0]?.url ? <motion.img key={visual.id} className="story-device" src={visual.images[0].url} alt={visual.name} loading="lazy" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: active === 1 ? 1.04 : .94, x: active === 1 ? -20 : 0, y: active === 3 ? 20 : 0, rotate: active === 0 ? -2 : 0, rotateY: active === 2 ? -5 : 0 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, clipPath: 'inset(0)' }} exit={{ opacity: 0, scale: .98, y: -8, clipPath: 'inset(4%)' }} transition={{ duration: reduce ? .15 : .55, ease: [0.22, 1, .36, 1] }} /> : <div className="story-device story-device--placeholder" />}</AnimatePresence>
    </div>
    <div className="story-copy">
      <p className="eyebrow">ENGINEERED FOR EVERYDAY</p>
      <h2>Quiet confidence,<br />built in.</h2>
      <div className="story-progress"><i style={{ transform: `scaleY(${(active + 1) / 4})` }} /></div>
      <div className="story-steps">{steps.map(([number, title, copy], index) => <article className={`story-step ${index === active ? 'is-active' : ''}`} key={title}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
    </div>
  </section>;
}
