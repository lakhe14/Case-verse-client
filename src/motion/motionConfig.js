export const motionTokens = {
  duration: { fast: 0.16, normal: 0.28, slow: 0.48 },
  ease: { standard: [0.22, 1, 0.36, 1], exit: [0.4, 0, 1, 1] },
  spring: { soft: { type: 'spring', stiffness: 260, damping: 26 }, snappy: { type: 'spring', stiffness: 420, damping: 30 } },
};

export const reveal = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.normal, ease: motionTokens.ease.standard } },
};

export const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.075, delayChildren: 0.04 } },
};
