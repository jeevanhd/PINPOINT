import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Bottom sheet on mobile, side panel on desktop - one component, one behaviour. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-[rgba(35,32,28,0.42)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-sheet border border-line bg-surface p-5 pb-6 shadow-lift md:inset-y-0 md:left-auto md:right-0 md:w-[380px] md:max-h-none md:rounded-none md:rounded-l-sheet"
            initial={reduce ? false : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 30, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: 'easeOut' }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-[1.15rem]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted hover:bg-[color-mix(in_srgb,var(--line)_40%,transparent)] hover:text-ink"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            {children}
            {footer && <div className="mt-6 border-t border-line pt-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
