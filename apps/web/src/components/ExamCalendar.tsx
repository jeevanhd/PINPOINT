import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ExamDto } from '@pinpoint/shared';
import { cn } from '../lib/utils';
import { XMark } from './ui/XMark';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface ExamCalendarProps {
  exams: ExamDto[];
  nearestExamId?: string | null;
  className?: string;
}

/** Calendar with an X beside every exam date, and a pulse on the nearest one. */
export function ExamCalendar({ exams, nearestExamId, className }: ExamCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const reduce = useReducedMotion();

  const examByDay = useMemo(() => {
    const map = new Map<string, ExamDto[]>();
    for (const exam of exams) {
      const list = map.get(exam.examDate) ?? [];
      list.push(exam);
      map.set(exam.examDate, list);
    }
    return map;
  }, [exams]);

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shift = (delta: number) => setCursor(new Date(Date.UTC(year, month + delta, 1)));

  return (
    <section className={cn('card p-4', className)} aria-label="Exam calendar">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="eyebrow">Calendar</p>
          <h3 className="text-[1rem]">{monthLabel}</h3>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="rounded-full border border-line p-1.5 text-muted hover:text-ink"
          >
            <ChevronLeft size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="rounded-full border border-line p-1.5 text-muted hover:text-ink"
          >
            <ChevronRight size={15} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEK.map((day, index) => (
          <span key={`${day}-${index}`} className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {day}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayExams = examByDay.get(iso) ?? [];
          const hasExam = dayExams.length > 0;
          const isNearest = dayExams.some((exam) => exam.id === nearestExamId);
          const isToday =
            today.getUTCFullYear() === year && today.getUTCMonth() === month && today.getUTCDate() === day;

          return (
            <div key={iso} className="relative flex flex-col items-center py-1">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] tabular-nums',
                  isToday && 'border border-pine text-pine',
                  hasExam && 'font-semibold',
                )}
              >
                {day}
              </span>
              {hasExam && (
                <motion.span
                  className="absolute -right-0.5 top-0 flex items-center"
                  animate={isNearest && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                  transition={{ duration: 1.6, repeat: isNearest ? Infinity : 0, repeatDelay: 1.4 }}
                  title={dayExams.map((e) => e.title).join(', ')}
                >
                  <XMark size={12} />
                </motion.span>
              )}
            </div>
          );
        })}
      </div>

      {exams.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {exams.slice(0, 3).map((exam) => (
            <li key={exam.id} className="flex items-center gap-2 text-[12.5px]">
              <XMark size={10} />
              <span className="truncate">{exam.title}</span>
              <span className="ml-auto shrink-0 text-muted tabular-nums">
                {new Date(`${exam.examDate}T00:00:00Z`).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
