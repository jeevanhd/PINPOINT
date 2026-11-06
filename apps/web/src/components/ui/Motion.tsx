import { motion, useReducedMotion } from 'framer-motion';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** Page-level fade + 8px slide, under 300ms, and off when motion is reduced. */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, delay: reduce ? 0 : delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  step?: number;
}

export function Stagger({ children, className, step = 0.05 }: StaggerProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduce ? 0 : step } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? {} : { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.22 } },
      }}
    >
      {children}
    </motion.div>
  );
}
