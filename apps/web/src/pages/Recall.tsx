import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Clock, RotateCcw, Shuffle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PlaceDto, RecallRoundDto } from '@pinpoint/shared';
import { RECALL_TIME_OPTIONS } from '@pinpoint/shared';
import { apiGet, apiPost } from '../lib/api';
import { queryKeys } from '../lib/query';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { connectSocket } from '../lib/socket';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/Motion';
import { EmptyState } from '../components/ui/States';
import { Ring } from '../components/ui/Ring';
import { cn, mmss } from '../lib/utils';

type Phase = 'setup' | 'playing' | 'done';
type Outcome = 'green' | 'red';

export function Recall() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('setup');
  const [round, setRound] = useState<RecallRoundDto | null>(null);
  const [placeId, setPlaceId] = useState('');
  const [timePerFlag, setTimePerFlag] = useState<number>(20);
  const [activeFlag, setActiveFlag] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [results, setResults] = useState<Record<string, Outcome>>({});
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useLiveUpdates();

  const placesQuery = useQuery({ queryKey: queryKeys.places, queryFn: () => apiGet<PlaceDto[]>('/places') });

  const finishRound = useCallback(
    async (roundId: string) => {
      try {
        const finished = await apiPost<RecallRoundDto>(`/recall/${roundId}/finish`);
        setRound(finished);
        setPhase('done');
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      } catch {
        toast.error('Could not finish that round');
      }
    },
    [queryClient],
  );

  const submit = useCallback(
    async (flagId: string, outcome: Outcome) => {
      if (!round) return;
      const msTaken = Math.max(0, Date.now() - startedAtRef.current);
      setResults((current) => ({ ...current, [flagId]: outcome }));
      setActiveFlag(null);
      setRevealed(false);
      try {
        const res = await apiPost<{ greenCount: number; redCount: number; finished: boolean }>(
          `/recall/${round.id}/result`,
          { flagId, outcome, msTaken },
        );
        if (res.finished) await finishRound(round.id);
      } catch {
        toast.error('Could not save that answer');
      }
    },
    [finishRound, round],
  );

  // Per-flag countdown; a timeout counts as red.
  useEffect(() => {
    if (!activeFlag) return;
    timerRef.current = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timerRef.current ?? undefined);
          timerRef.current = null;
          void submit(activeFlag, 'red');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [activeFlag, submit]);

  const startRound = useMutation({
    mutationFn: () =>
      apiPost<RecallRoundDto>('/recall/start', {
        ...(placeId ? { placeId } : {}),
        timePerFlagSec: timePerFlag,
      }),
    onSuccess: (data) => {
      setRound(data);
      setResults({});
      setPhase('playing');
      setParams({ round: data.id }, { replace: true });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not start a round'),
  });

  // Reconnect: ask the server for the round state instead of trusting local memory.
  useEffect(() => {
    const roundId = params.get('round');
    if (!roundId) return;
    const socket = connectSocket();
    socket.emit('recall:resume', { roundId }, (state) => {
      if (!state) return;
      void apiGet<RecallRoundDto>(`/recall/${roundId}`).then((data) => {
        setRound(data);
        const map: Record<string, Outcome> = {};
        for (const result of state.results) map[result.flagId] = result.outcome;
        setResults(map);
        setPhase(data.status === 'finished' ? 'done' : 'playing');
      });
    });
  }, [params]);

  const flags = round?.flags ?? [];
  const answered = Object.keys(results).length;
  const green = Object.values(results).filter((v) => v === 'green').length;
  const activeFlagData = flags.find((f) => f.id === activeFlag) ?? null;

  const heat = useMemo(() => {
    if (!round) return [];
    const byId = new Map(round.flags.map((f) => [f.id, f]));
    return Object.entries(results).map(([flagId, outcome]) => ({ flag: byId.get(flagId), outcome }));
  }, [results, round]);

  if (placesQuery.data && placesQuery.data.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState
          icon={Shuffle}
          title="Recall needs a place"
          body="Add a place with at least one flag. Then come back and test yourself against the clock."
          action={<Button size="sm" onClick={() => navigate('/palace')}>Add a place</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <FadeIn>
        <header>
          <p className="eyebrow">Recall</p>
          <h1 className="mt-1 text-[1.7rem]">{phase === 'playing' ? round?.placeName : 'Test what stuck'}</h1>
          <p className="mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
            Flags are hidden. Tap one, say what it is out loud, then reveal. Honest answers only - this is
            for you.
          </p>
        </header>
      </FadeIn>

      {phase === 'setup' && (
        <div className="card space-y-4 p-4">
          <label className="block">
            <span className="eyebrow">Place</span>
            <select className="field mt-1" value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
              <option value="">Pick a random place</option>
              {placesQuery.data?.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} · {place.flagCount} flags
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="eyebrow">Seconds per flag</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {RECALL_TIME_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTimePerFlag(option)}
                  className={cn(
                    'rounded-[8px] border px-3 py-1.5 text-[12.5px] tabular-nums',
                    timePerFlag === option
                      ? 'border-pine bg-[color-mix(in_srgb,var(--pine)_10%,transparent)] text-pine'
                      : 'border-line text-muted hover:text-ink',
                  )}
                >
                  {option}s
                </button>
              ))}
            </div>
          </div>
          <Button variant="accent" size="lg" onClick={() => startRound.mutate()} disabled={startRound.isPending}>
            <Shuffle size={16} strokeWidth={1.8} />
            Start round
          </Button>
        </div>
      )}

      {phase === 'playing' && round && (
        <>
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>
              {answered} of {flags.length} done · <span className="text-good">{green} green</span>
            </span>
            <span className="tabular-nums">{round.timePerFlagSec}s per flag</span>
          </div>

          <div className="relative overflow-hidden rounded-card border border-line bg-[#1C1A17]">
            <div className="relative">
              <img src={round.imageUrl} alt={round.placeName} className="block w-full opacity-[0.92]" />
              {flags.map((flag) => {
                const outcome = results[flag.id];
                const isActive = activeFlag === flag.id;
                return (
                  <button
                    key={flag.id}
                    type="button"
                    onClick={() => {
                      if (outcome) return;
                      setActiveFlag(flag.id);
                      setRevealed(false);
                      setRemaining(round.timePerFlagSec);
                      startedAtRef.current = Date.now();
                    }}
                    disabled={Boolean(outcome) || Boolean(activeFlag)}
                    aria-label={outcome ? `Flag answered ${outcome}` : 'Hidden flag'}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${flag.xPct}%`, top: `${flag.yPct}%` }}
                  >
                    <motion.span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-lift',
                        outcome === 'green'
                          ? 'border-[#FFFDF8] bg-good'
                          : outcome === 'red'
                            ? 'border-[#FFFDF8] bg-bad'
                            : 'border-[#FFFDF8] bg-[rgba(35,32,28,0.55)]',
                        isActive && 'ring-2 ring-ember ring-offset-2 ring-offset-transparent',
                      )}
                      animate={isActive && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                      transition={{ duration: 1.1, repeat: isActive ? Infinity : 0 }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FFFDF8]" />
                    </motion.span>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {activeFlagData && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: reduce ? 0 : 0.22 }}
                className="card space-y-3 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-muted">This flag</span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-[1.15rem] font-display tabular-nums',
                      remaining <= 5 ? 'text-bad' : 'text-ink',
                    )}
                  >
                    <Clock size={15} strokeWidth={1.8} />
                    {mmss(remaining)}
                  </span>
                </div>

                {revealed ? (
                  <div className="space-y-2">
                    <p className="text-[15px] font-medium">{activeFlagData.label}</p>
                    {activeFlagData.notes && (
                      <p className="text-[13px] leading-relaxed text-muted">{activeFlagData.notes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">Say it out loud before you reveal.</p>
                )}

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {!revealed ? (
                    <Button onClick={() => setRevealed(true)}>Reveal</Button>
                  ) : (
                    <>
                      <Button variant="primary" onClick={() => void submit(activeFlagData.id, 'green')}>
                        <Check size={15} strokeWidth={2.2} />
                        Got it
                      </Button>
                      <Button variant="danger" onClick={() => void submit(activeFlagData.id, 'red')}>
                        <X size={15} strokeWidth={2.2} />
                        Missed
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="quiet"
            size="sm"
            onClick={() => void finishRound(round.id)}
            disabled={answered === 0}
          >
            End round early
          </Button>
        </>
      )}

      {phase === 'done' && round && (
        <div className="space-y-3">
          <div className="card flex items-center gap-4 p-4">
            <Ring
              value={flags.length === 0 ? 0 : Math.round((green / flags.length) * 100)}
              size={88}
              tone={green / Math.max(flags.length, 1) >= 0.6 ? 'pine' : 'ember'}
              caption="green"
            />
            <div>
              <p className="text-[14.5px] font-medium">
                {green} green, {flags.length - green} red
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {green / Math.max(flags.length, 1) >= 0.6
                  ? 'Mostly green. This place is working.'
                  : 'Red flags first next time. Say those out loud tonight.'}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-[#1C1A17]">
            <div className="relative">
              <img src={round.imageUrl} alt={round.placeName} className="block w-full opacity-90" />
              {heat.map(({ flag, outcome }) =>
                flag ? (
                  <span
                    key={flag.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${flag.xPct}%`, top: `${flag.yPct}%` }}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#FFFDF8] text-[#FFFDF8] shadow-lift',
                        outcome === 'green' ? 'bg-good' : 'bg-bad',
                      )}
                    >
                      {outcome === 'green' ? <Check size={14} strokeWidth={2.4} /> : <X size={14} strokeWidth={2.4} />}
                    </span>
                  </span>
                ) : null,
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setPhase('setup');
                setRound(null);
                setResults({});
                setParams({}, { replace: true });
              }}
            >
              <RotateCcw size={15} strokeWidth={1.8} />
              Another round
            </Button>
            <Button variant="quiet" onClick={() => navigate('/palace')}>
              Open the palace
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
