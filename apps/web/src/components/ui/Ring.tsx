import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface RingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  caption?: string;
  tone?: 'pine' | 'ember' | 'mustard';
  className?: string;
}

const TONE: Record<string, string> = {
  pine: 'var(--pine)',
  ember: 'var(--ember)',
  mustard: 'var(--mustard)',
};

/** Circular progress ring used for mastery and the Explain score. */
export function Ring({
  value,
  size = 96,
  stroke = 7,
  label,
  caption,
  tone = 'pine',
  className,
}: RingProps) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 0.45, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[1.35rem] leading-none tabular-nums">
          {label ?? `${Math.round(clamped)}`}
          {!label && <span className="text-[0.7rem] align-super">%</span>}
        </span>
        {caption && <span className="mt-1 text-[10px] uppercase tracking-wider text-muted">{caption}</span>}
      </div>
      <span className="sr-only">
        {label ?? `${Math.round(clamped)} percent`}
        {caption ? ` ${caption}` : ''}
      </span>
    </div>
  );
}
