import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock,
  MapPin,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ExplanationDto, TopicDto, Verdict } from '@pinpoint/shared';
import { MIN_TRANSCRIPT_WORDS, countWords } from '@pinpoint/shared';
import { apiGet, apiPost, ApiRequestError } from '../lib/api';
import { queryKeys } from '../lib/query';
import { useSpeech } from '../hooks/useSpeech';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { Button } from '../components/ui/Button';
import { Ring } from '../components/ui/Ring';
import { FadeIn } from '../components/ui/Motion';
import { EmptyState } from '../components/ui/States';
import { cn, mmss } from '../lib/utils';

const DURATIONS = [
  { seconds: 60, label: '1 min' },
  { seconds: 120, label: '2 min' },
  { seconds: 180, label: '3 min' },
  { seconds: 300, label: '5 min' },
];

const VERDICT_STYLE: Record<Verdict, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  covered: { label: 'Covered', color: 'var(--good)', icon: CheckCircle2 },
  partial: { label: 'Partial', color: 'var(--warn)', icon: TriangleAlert },
  incorrect: { label: 'Incorrect', color: 'var(--bad)', icon: AlertCircle },
  missing: { label: 'Missing', color: 'var(--bad)', icon: CircleDashed },
};

type Phase = 'setup' | 'recording' | 'review' | 'judging' | 'result';

export function Explain() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const speech = useSpeech();

  const [phase, setPhase] = useState<Phase>('setup');
  const [topicId, setTopicId] = useState(params.get('topic') ?? '');
  const [limit, setLimit] = useState(120);
  const [remaining, setRemaining] = useState(120);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<ExplanationDto | null>(null);
  const [visiblePoints, setVisiblePoints] = useState(0);
  const timerRef = useRef<number | null>(null);

  useLiveUpdates();

  const topicsQuery = useQuery({ queryKey: queryKeys.topics, queryFn: () => apiGet<TopicDto[]>('/topics') });
  const topic = topicsQuery.data?.find((t) => t.id === topicId) ?? null;

  const words = countWords(transcript);
  const tooShort = words < MIN_TRANSCRIPT_WORDS;

  const stopTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    stopTimer();
    speech.stop();
    setTranscript((current) => (current.trim() ? current : speech.combined));
    setPhase('review');
  }, [speech, stopTimer]);

  useEffect(() => {
    if (phase !== 'recording') return;
    timerRef.current = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timerRef.current ?? undefined);
          timerRef.current = null;
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording' && remaining === 0) stopRecording();
  }, [phase, remaining, stopRecording]);

  // The live transcript flows into the textarea while recording.
  useEffect(() => {
    if (phase === 'recording' && speech.combined) setTranscript(speech.combined);
  }, [phase, speech.combined]);

  const judge = useMutation({
    mutationFn: () =>
      apiPost<ExplanationDto>(`/topics/${topicId}/explain`, {
        transcript: transcript.trim(),
        durationSec: Math.max(0, limit - remaining),
        timeLimitSec: limit,
      }),
    onMutate: () => setPhase('judging'),
    onSuccess: (data) => {
      setResult(data);
      setVisiblePoints(0);
      setPhase('result');
      // Gap map items turn colour one by one.
      data.points.forEach((_, index) => {
        window.setTimeout(() => setVisiblePoints((count) => Math.max(count, index + 1)), reduce ? 0 : 140 * (index + 1));
      });
    },
    onError: (err) => {
      setPhase('review');
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not check that attempt');
    },
  });

  const startRecording = useCallback(() => {
    speech.reset();
    setTranscript('');
    setResult(null);
    setRemaining(limit);
    setPhase('recording');
    speech.start();
  }, [limit, speech]);

  const gaps = useMemo(() => {
    if (!result || !topic) return [];
    const unmet = new Set(
      result.points.filter((p) => p.verdict !== 'covered').map((p) => p.keyPointId),
    );
    return topic.keyPoints.filter((kp) => unmet.has(kp.id));
  }, [result, topic]);

  if (topicsQuery.isLoading) return <div className="pt-6 text-[13px] text-muted">Loading topics…</div>;

  if (!topicsQuery.data || topicsQuery.data.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState
          icon={Mic}
          title="Nothing to explain yet"
          body="Add one page of notes first. Explaining works only when there is material to check against."
          action={<Button size="sm" onClick={() => navigate('/topic')}>Add material</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <FadeIn>
        <header>
          <p className="eyebrow">Explain</p>
          <h1 className="mt-1 text-[1.7rem]">Say it out loud</h1>
          <p className="mt-1 max-w-[54ch] text-[13.5px] leading-relaxed text-muted">
            No notes, no re-reading. Speak the topic as if teaching a friend, then see exactly which key
            points you skipped.
          </p>
        </header>
      </FadeIn>

      {phase === 'setup' && (
        <FadeIn delay={0.05}>
          <div className="card space-y-4 p-4">
            <label className="block">
              <span className="eyebrow">Topic</span>
              <select
                className="field mt-1"
                value={topicId}
                onChange={(event) => {
                  setTopicId(event.target.value);
                  setParams(event.target.value ? { topic: event.target.value } : {});
                }}
              >
                <option value="">Choose a topic</option>
                {topicsQuery.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.keyPoints.length} key points
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="eyebrow">Time</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DURATIONS.map((option) => (
                  <button
                    key={option.seconds}
                    type="button"
                    onClick={() => setLimit(option.seconds)}
                    className={cn(
                      'rounded-[8px] border px-3 py-1.5 text-[12.5px]',
                      limit === option.seconds
                        ? 'border-pine bg-[color-mix(in_srgb,var(--pine)_10%,transparent)] text-pine'
                        : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {topic && topic.keyPoints.length === 0 && (
              <p className="text-[12.5px] text-warn">
                This topic has no key points yet, so there is nothing to check against.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button
                variant="accent"
                size="lg"
                onClick={startRecording}
                disabled={!topicId || (topic?.keyPoints.length ?? 0) === 0}
              >
                <Mic size={17} strokeWidth={1.8} />
                Start explaining
              </Button>
              {!speech.supported && (
                <span className="text-[11.5px] text-muted">
                  This browser cannot listen - you can type instead.
                </span>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {phase === 'recording' && (
        <FadeIn>
          <motion.div
            className="card relative overflow-hidden p-5"
            animate={reduce ? {} : { boxShadow: ['0 0 0 0 rgba(224,122,63,0)', '0 0 0 3px rgba(224,122,63,0.18)', '0 0 0 0 rgba(224,122,63,0)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
                </span>
                <span className="text-[12.5px] font-medium">{speech.listening ? 'Listening' : 'Mic idle'}</span>
              </div>
              <div className="font-display text-[1.6rem] tabular-nums">
                <Clock size={16} strokeWidth={1.7} className="mr-1 inline text-muted" />
                {mmss(remaining)}
              </div>
            </div>

            <p className="mt-4 min-h-[120px] whitespace-pre-wrap text-[14px] leading-relaxed">
              {transcript || <span className="text-muted">Start talking. Your words appear here.</span>}
            </p>

            {speech.error && <p className="mt-2 text-[12px] text-warn">{speech.error}</p>}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <Button variant="primary" onClick={stopRecording}>
                <Send size={15} strokeWidth={1.8} />
                I'm done
              </Button>
              <Button
                variant="outline"
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
              >
                {speech.listening ? <MicOff size={15} strokeWidth={1.8} /> : <Mic size={15} strokeWidth={1.8} />}
                {speech.listening ? 'Pause mic' : 'Resume mic'}
              </Button>
            </div>
          </motion.div>
        </FadeIn>
      )}

      {phase === 'review' && (
        <FadeIn>
          <div className="card space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[1.1rem]">Your transcript</h2>
              <span className={cn('text-[11.5px]', tooShort ? 'text-warn' : 'text-muted')}>
                {words} words
              </span>
            </div>
            <textarea
              className="field min-h-[180px] text-[13.5px] leading-relaxed"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Speech recognition got something wrong? Fix it here before checking."
            />
            {tooShort && (
              <p className="text-[12.5px] text-warn">
                At least {MIN_TRANSCRIPT_WORDS} words. Say a little more - even a rough explanation counts.
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <Button
                variant="accent"
                onClick={() => judge.mutate()}
                disabled={tooShort || judge.isPending}
              >
                <Send size={15} strokeWidth={1.8} />
                Check my explanation
              </Button>
              <Button variant="quiet" onClick={startRecording}>
                <RotateCcw size={15} strokeWidth={1.8} />
                Record again
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {phase === 'judging' && (
        <div className="card space-y-3 p-6 text-center">
          <motion.div
            className="mx-auto h-9 w-9 rounded-full border-2 border-line border-t-pine"
            animate={reduce ? {} : { rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-[13px] text-muted">Reading your explanation against the key points…</p>
        </div>
      )}

      <AnimatePresence>
        {phase === 'result' && result && topic && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26 }}
            className="space-y-3"
          >
            <div className="card flex items-center gap-4 p-4">
              <Ring
                value={result.score}
                size={92}
                tone={result.passed ? 'pine' : 'ember'}
                caption={result.passed ? 'passed' : 'keep going'}
              />
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium">
                  You covered {result.points.filter((p) => p.verdict === 'covered').length} of{' '}
                  {result.points.length} key points.
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{result.summary}</p>
                {result.fallback && (
                  <p className="mt-1 text-[11px] text-warn">
                    Checked with the offline matcher - the AI service was not reachable.
                  </p>
                )}
              </div>
            </div>

            <section className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[1.1rem]">Gap map</h2>
                <span className="text-[11.5px] text-muted">
                  {result.points.filter((p) => p.verdict !== 'covered').length} to fix
                </span>
              </div>
              <ul className="space-y-1.5">
                {result.points.map((point, index) => {
                  const kp = topic.keyPoints.find((k) => k.id === point.keyPointId);
                  const style = VERDICT_STYLE[point.verdict];
                  const Icon = style.icon;
                  const revealed = index < visiblePoints;
                  return (
                    <motion.li
                      key={point.keyPointId}
                      className="card p-3"
                      animate={{
                        borderColor: revealed ? `color-mix(in srgb, ${style.color} 45%, transparent)` : 'var(--line)',
                        backgroundColor: revealed
                          ? `color-mix(in srgb, ${style.color} 7%, var(--surface))`
                          : 'var(--surface)',
                      }}
                      transition={{ duration: reduce ? 0 : 0.28 }}
                    >
                      <div className="flex items-start gap-2">
                        <Icon size={15} strokeWidth={1.9} style={{ color: style.color }} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium">{kp?.text ?? `Key point ${point.keyPointId}`}</p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{point.feedback}</p>
                          {point.evidence && (
                            <p className="mt-1 border-l-2 border-line pl-2 text-[12px] italic text-muted">
                              “{point.evidence}”
                            </p>
                          )}
                        </div>
                        <span
                          className="shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-medium"
                          style={{ color: style.color, background: `color-mix(in srgb, ${style.color} 12%, transparent)` }}
                        >
                          {style.label}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={startRecording}>
                <RotateCcw size={15} strokeWidth={1.8} />
                Retry the gaps
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (gaps.length === 0) {
                    toast.success('Nothing left to pin - every point is covered.');
                    return;
                  }
                  navigate(`/palace?pinTopic=${topic.id}`);
                }}
              >
                <MapPin size={15} strokeWidth={1.8} />
                Pin the gaps ({gaps.length})
              </Button>
              <Button variant="quiet" onClick={() => navigate(`/topic/${topic.id}`)}>
                Back to topic
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
