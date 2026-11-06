import { motion, useReducedMotion } from 'framer-motion';

interface XMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** The exam X, drawn stroke by stroke. */
export function XMark({ size = 14, className, title = 'exam' }: XMarkProps) {
  const reduce = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      <motion.path
        d="M2.4 2.6c3.4 3.2 7.4 7.6 11.2 10.8"
        stroke="var(--ember)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.26, ease: 'easeOut' }}
      />
      <motion.path
        d="M13.6 2.4C10.4 5.8 6.6 9.8 2.6 13.4"
        stroke="var(--ember)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.26, delay: reduce ? 0 : 0.16, ease: 'easeOut' }}
      />
    </svg>
  );
}
