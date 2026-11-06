import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface TickerProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
}

/** Count-up number for the days-left countdown and scores. */
export function Ticker({ value, duration = 450, className, suffix }: TickerProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduce, value]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}
