import { Link } from 'react-router-dom';
import { Check, Mic, MapPin, RotateCcw, FileText, ArrowUpRight } from 'lucide-react';
import type { TaskId, TopicCardDto } from '@pinpoint/shared';
import { cn } from '../lib/utils';
import { Ring } from './ui/Ring';

const TASK_ICON: Record<TaskId, typeof Check> = {
  material: FileText,
  explain: Mic,
  pin: MapPin,
  recall: RotateCcw,
};

export function TopicCard({ topic, onExplain }: { topic: TopicCardDto; onExplain?: () => void }) {
  const done = topic.tasksDone;
  return (
    <article className="card group relative overflow-hidden p-4">
      <div className="flex items-start gap-4">
        <Ring value={topic.mastery} size={62} stroke={5} caption="mastery" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="eyebrow truncate">{topic.unitTitle ?? 'Loose topic'}</p>
              <h3 className="mt-0.5 truncate text-[1.05rem]">{topic.title}</h3>
            </div>
            <Link
              to={`/topic/${topic.id}`}
              aria-label={`Open ${topic.title}`}
              className="rounded-full border border-line p-1.5 text-muted transition-colors hover:border-pine hover:text-pine"
            >
              <ArrowUpRight size={15} strokeWidth={1.8} />
            </Link>
          </div>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
            {topic.notes || 'No notes yet - upload a page and Pinpoint will write them.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
            <span>{topic.keyPointCount} key points</span>
            <span aria-hidden>·</span>
            <span>{topic.attempts} explain{topic.attempts === 1 ? '' : 's'}</span>
            {topic.bestScore != null && (
              <>
                <span aria-hidden>·</span>
                <span className={cn(topic.bestScore >= 70 ? 'text-good' : 'text-warn')}>
                  best {topic.bestScore}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {topic.tasks.map((task) => {
          const Icon = TASK_ICON[task.id];
          return (
            <span
              key={task.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[7px] border px-2 py-1 text-[11px]',
                task.done
                  ? 'border-[color-mix(in_srgb,var(--good)_35%,transparent)] bg-[color-mix(in_srgb,var(--good)_10%,transparent)] text-good'
                  : 'border-line text-muted',
              )}
            >
              {task.done ? <Check size={12} strokeWidth={2.2} /> : <Icon size={12} strokeWidth={1.7} />}
              {task.label}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[11.5px] text-muted">
          {done} of {topic.tasks.length} steps done
        </span>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            className="text-[12px] font-medium text-pine underline decoration-[color-mix(in_srgb,var(--pine)_35%,transparent)] underline-offset-4"
          >
            Explain this
          </button>
        )}
      </div>
    </article>
  );
}
