import { NavLink } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Home, FileText, Mic, MapPin, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

const TABS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/topic', label: 'Topic', icon: FileText },
  { to: '/explain', label: 'Explain', icon: Mic },
  { to: '/palace', label: 'Palace', icon: MapPin },
  { to: '/recall', label: 'Recall', icon: RotateCcw },
];

export function BottomNav() {
  const reduce = useReducedMotion();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-medium transition-colors',
                  isActive ? 'text-pine' : 'text-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-x-2 inset-y-1 rounded-[10px] bg-[color-mix(in_srgb,var(--pine)_10%,transparent)]"
                      transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
                    />
                  )}
                  <tab.icon size={19} strokeWidth={1.7} className="relative" />
                  <span className={cn('relative', isActive && 'scribble')}>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
