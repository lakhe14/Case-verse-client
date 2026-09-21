import { motion, useReducedMotion } from 'motion/react';
import { motionTokens, reveal, stagger } from './motionConfig';

export function Reveal({ children, className, delay = 0, as = 'div', ...props }) {
  const reduce = useReducedMotion();
  const Component = motion[as] || motion.div;
  return <Component className={className} initial={reduce ? false : 'hidden'} whileInView="visible" viewport={{ once: true, amount: 0.16 }} variants={reduce ? undefined : reveal} transition={{ delay }} {...props}>{children}</Component>;
}

export function StaggerGroup({ children, className, ...props }) {
  const reduce = useReducedMotion();
  return <motion.div className={className} initial={reduce ? false : 'hidden'} whileInView="visible" viewport={{ once: true, amount: 0.08 }} variants={reduce ? undefined : stagger} {...props}>{children}</motion.div>;
}

export function PageTransition({ children, calm = false }) {
  const reduce = useReducedMotion();
  return <motion.div initial={reduce || calm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.fast, ease: motionTokens.ease.standard }}>{children}</motion.div>;
}

export function MotionButton({ children, className = 'btn', ...props }) {
  const reduce = useReducedMotion();
  return <motion.button className={className} whileHover={reduce ? undefined : { y: -1 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={motionTokens.spring.snappy} {...props}>{children}</motion.button>;
}
