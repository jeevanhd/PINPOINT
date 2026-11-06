import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-quiet flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="rounded-full border border-line bg-surface p-3 text-muted">
        <Icon size={20} strokeWidth={1.6} />
      </span>
      <h3 className="text-[1.05rem]">{title}</h3>
      <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="card space-y-3 p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
