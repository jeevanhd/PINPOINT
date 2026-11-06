import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarPlus, FileUp, Mic, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DashboardDto, ExamDto } from '@pinpoint/shared';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { queryKeys } from '../lib/query';
import { useAuth } from '../hooks/useAuth';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { Button } from '../components/ui/Button';
import { FadeIn, Stagger, StaggerItem } from '../components/ui/Motion';
import { CardSkeleton, EmptyState } from '../components/ui/States';
import { Ticker } from '../components/ui/Ticker';
import { ExamCalendar } from '../components/ExamCalendar';
import { TopicCard } from '../components/TopicCard';
import { daysLabel } from '../lib/utils';

const LEVEL_COLOR = {
  red: 'var(--bad)',
  amber: 'var(--warn)',
  calm: 'var(--pine)',
  past: 'var(--muted)',
} as const;

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const [addingExam, setAddingExam] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');

  useLiveUpdates();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiGet<DashboardDto>('/dashboard'),
  });

  const createExam = useMutation({
    mutationFn: () => apiPost<ExamDto>('/exams', { title: examTitle.trim(), examDate }),
    onSuccess: () => {
      setAddingExam(false);
      setExamTitle('');
      setExamDate('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Exam added to your calendar');
    },
    onError: () => toast.error('Could not add that exam. Check the date.'),
  });

  const deleteExam = useMutation({
    mutationFn: (id: string) => apiDelete(`/exams/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3 pt-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const nearest = data.nearestExam;
  const level = nearest ? nearest.level : 'calm';
  const allTopics = [...data.units.flatMap((unit) => unit.topics), ...data.looseTopics];
  const nudge = buildNudge(data);

  return (
    <div className="pt-2">
      <FadeIn>
        <header className="mb-5">
          <p className="eyebrow">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 text-[1.9rem] leading-tight">{data.greeting}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {allTopics.length === 0
              ? 'Start with one page of notes. Everything else follows.'
              : `${allTopics.length} topic${allTopics.length === 1 ? '' : 's'}, ${data.stats.flags} flag${
                  data.stats.flags === 1 ? '' : 's'
                } pinned.`}
          </p>
        </header>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_318px]">
        <div className="space-y-4">
          {nearest && (
            <FadeIn delay={0.04}>
              <section className="card relative overflow-hidden p-5" aria-label="Days until nearest exam">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow">Nearest exam</p>
                    <p className="mt-1 text-[14px] font-medium">{nearest.title}</p>
                    <p className="text-[12.5px] text-muted">
                      {new Date(`${nearest.examDate}T00:00:00Z`).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'long',
                        timeZone: 'UTC',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-display text-[3.6rem] leading-none tabular-nums"
                      style={{ color: LEVEL_COLOR[level] }}
                    >
                      <Ticker value={Math.max(0, nearest.daysLeft)} />
                    </div>
                    <p className="text-[11.5px] uppercase tracking-[0.14em] text-muted">
                      {daysLabel(nearest.daysLeft)} to go
                    </p>
                  </div>
                </div>
                {nudge && (
                  <motion.button
                    type="button"
                    onClick={() => navigate(nudge.to)}
                    className="mt-4 flex w-full items-center gap-2 rounded-[10px] border border-line bg-[color-mix(in_srgb,var(--mustard)_14%,transparent)] px-3 py-2 text-left text-[12.5px]"
                    animate={reduce ? {} : { opacity: [0.85, 1, 0.85] }}
                    transition={{ duration: 2.4, repeat: Infinity }}
                  >
                    <Sparkles
                      size={15}
                      strokeWidth={1.7}
                      className="shrink-0 text-[color-mix(in_srgb,var(--mustard)_80%,black)]"
                    />
                    <span>{nudge.text}</span>
                  </motion.button>
                )}
              </section>
            </FadeIn>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/topic')} size="sm">
              <FileUp size={15} strokeWidth={1.8} />
              Add material
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/explain')}>
              <Mic size={15} strokeWidth={1.8} />
              Explain a topic
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setAddingExam((v) => !v)}>
              <CalendarPlus size={15} strokeWidth={1.8} />
              Add exam
            </Button>
          </div>

          {addingExam && (
            <FadeIn>
              <form
                className="card space-y-3 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createExam.mutate();
                }}
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                  <input
                    className="field"
                    placeholder="Physics - Unit 2"
                    value={examTitle}
                    onChange={(event) => setExamTitle(event.target.value)}
                    required
                  />
                  <input
                    className="field"
                    type="date"
                    value={examDate}
                    onChange={(event) => setExamDate(event.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={createExam.isPending}>
                    Save exam
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => setAddingExam(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </FadeIn>
          )}

          {allTopics.length === 0 ? (
            <EmptyState
              icon={FileUp}
              title="No topics yet"
              body="Upload one page of notes or snap a photo. Pinpoint pulls out the key points you should be able to explain."
              action={
                <Button size="sm" onClick={() => navigate('/topic')}>
                  <Plus size={15} strokeWidth={1.9} />
                  Add your first topic
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {data.units.map((unit) => (
                <section key={unit.id}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[1.1rem]">{unit.title}</h2>
                    <span className="text-[11.5px] text-muted">{unit.topics.length} topics</span>
                  </div>
                  <Stagger className="grid gap-3 sm:grid-cols-2">
                    {unit.topics.map((topic) => (
                      <StaggerItem key={topic.id}>
                        <TopicCard topic={topic} onExplain={() => navigate(`/explain?topic=${topic.id}`)} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </section>
              ))}

              {data.looseTopics.length > 0 && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-[1.1rem]">Loose topics</h2>
                    <span className="text-[11.5px] text-muted">not in a unit</span>
                  </div>
                  <Stagger className="grid gap-3 sm:grid-cols-2">
                    {data.looseTopics.map((topic) => (
                      <StaggerItem key={topic.id}>
                        <TopicCard topic={topic} onExplain={() => navigate(`/explain?topic=${topic.id}`)} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </section>
              )}
            </div>
          )}

          {data.exams.length > 0 && (
            <section className="card p-4 lg:hidden">
              <h2 className="mb-2 text-[1rem]">Your exams</h2>
              <ul className="space-y-1.5">
                {data.exams.map((exam) => (
                  <li key={exam.id} className="flex items-center gap-2 text-[13px]">
                    <span className="truncate">{exam.title}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-muted">{daysLabel(exam.daysLeft)}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${exam.title}`}
                      onClick={() => deleteExam.mutate(exam.id)}
                      className="text-muted hover:text-bad"
                    >
                      <Trash2 size={13} strokeWidth={1.7} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-3">
            <ExamCalendar exams={data.exams} nearestExamId={nearest?.id ?? null} />
            <section className="card p-4">
              <p className="eyebrow">This week</p>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Topics</dt>
                  <dd className="tabular-nums">{data.stats.topics}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Explain attempts</dt>
                  <dd className="tabular-nums">{data.stats.explanations}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Places</dt>
                  <dd className="tabular-nums">{data.stats.places}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Flags</dt>
                  <dd className="tabular-nums">{data.stats.flags}</dd>
                </div>
              </dl>
              <Link
                to="/palace"
                className="mt-3 inline-block text-[12.5px] font-medium text-pine underline decoration-[color-mix(in_srgb,var(--pine)_35%,transparent)] underline-offset-4"
              >
                Open the palace
              </Link>
            </section>
          </div>
        </aside>
      </div>
      {user && <span className="sr-only">Signed in as {user.email}</span>}
    </div>
  );
}

function buildNudge(data: DashboardDto): { text: string; to: string } | null {
  const nearest = data.nearestExam;
  if (!nearest) return null;
  const weakest = [...data.units.flatMap((u) => u.topics), ...data.looseTopics]
    .filter((topic) => (topic.bestScore ?? 0) < (data.user.passMark ?? 70))
    .sort((a, b) => (a.bestScore ?? 0) - (b.bestScore ?? 0))[0];
  if (!weakest) return null;
  const when =
    nearest.daysLeft === 0 ? 'is today' : nearest.daysLeft === 1 ? 'is tomorrow' : `is in ${nearest.daysLeft} days`;
  return {
    text: `${nearest.title} ${when}. ${weakest.title} is your weakest topic - explain it now?`,
    to: `/explain?topic=${weakest.id}`,
  };
}
