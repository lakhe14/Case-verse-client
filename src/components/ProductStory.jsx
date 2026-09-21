import { useEffect, useRef, useState } from 'react';
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

const featureVisuals = [
  { src: '/assets/caseverse/story/precision-fit.jpeg', alt: 'Blue floral CaseVerse cover collection' },
  { src: '/assets/caseverse/story/camera-protection.jpeg', alt: 'CaseVerse cover with raised camera surround' },
  { src: '/assets/caseverse/story/magsafe-ready.jpeg', alt: 'Blue bird CaseVerse covers' },
  { src: '/assets/caseverse/story/soft-touch-grip.jpeg', alt: 'Red textured CaseVerse covers' },
];

export default function ProductStory() {
  const root = useRef(null);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches);
  const reduce = useReducedMotion();
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useGSAP(() => {
    if (reduce || mobile || !root.current) return undefined;
    const trigger = ScrollTrigger.create({
      trigger: root.current,
      start: 'top top',
      end: '+=1280',
      scrub: 0.35,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setActive(Math.min(3, Math.floor(self.progress * 4))),
    });
    return () => trigger.kill();
  }, { scope: root, dependencies: [reduce, mobile] });
  useEffect(() => {
    if (!mobile || reduce || !root.current) return undefined;
    const nodes = root.current.querySelectorAll('[data-story-step]');
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current) setActive(Number(current.target.dataset.storyStep));
    }, { rootMargin: '-28% 0px -45% 0px', threshold: [0.2, 0.5, 0.8] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [mobile, reduce]);
  const visual = featureVisuals[active];
  return <section ref={root} className={`story-scene story-state-${active} story-visual-${active}`}>
    <div className="story-device-wrap">
      <div className="story-orbit" aria-hidden="true" />
      <div className="story-reflection" aria-hidden="true" />
      <AnimatePresence mode="wait"><motion.img key={visual.src} className={`story-device story-device--state-${active}`} src={visual.src} alt={visual.alt} loading="lazy" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: active === 1 ? 1.04 : .94, x: active === 1 ? -20 : 0, y: active === 3 ? 20 : 0, rotate: active === 0 ? -2 : 0, rotateY: active === 2 ? -5 : 0 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0, clipPath: 'inset(0)' }} exit={{ opacity: 0, scale: .98, y: -8, clipPath: 'inset(4%)' }} transition={{ duration: reduce ? .15 : .55, ease: [0.22, 1, .36, 1] }} /></AnimatePresence>
    </div>
    <div className="story-copy">
      <p className="eyebrow">ENGINEERED FOR EVERYDAY</p>
      <h2>Quiet confidence,<br />built in.</h2>
      <div className="story-progress"><i style={{ transform: `scaleY(${(active + 1) / 4})` }} /></div>
      <div className="story-steps">{steps.map(([number, title, copy], index) => <article data-story-step={index} className={`story-step ${index === active ? 'is-active' : ''}`} key={title}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
    </div>
  </section>;
}
