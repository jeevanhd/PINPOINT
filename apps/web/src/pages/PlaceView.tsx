import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Crosshair, Link2, MapPin, Pencil, Plus, Trash2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import type { FlagDto, PlaceDetailDto, TopicDto } from '@pinpoint/shared';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { queryKeys } from '../lib/query';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { FadeIn } from '../components/ui/Motion';
import { cn, clamp } from '../lib/utils';

interface GapsResponse {
  topicId: string;
  keyPoints: { id: number; text: string }[];
  gaps: { id: number; text: string }[];
}

export function PlaceView() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const pinTopic = params.get('pinTopic');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const imageWrapRef = useRef<HTMLDivElement | null>(null);

  const [placing, setPlacing] = useState(false);
  const [draftPosition, setDraftPosition] = useState<{ xPct: number; yPct: number } | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftKeyPoint, setDraftKeyPoint] = useState<number | ''>('');
  const [selected, setSelected] = useState<FlagDto | null>(null);
  const [editing, setEditing] = useState(false);

  useLiveUpdates();

  const placeQuery = useQuery({
    queryKey: queryKeys.place(id),
    queryFn: () => apiGet<PlaceDetailDto>(`/places/${id}`),
    enabled: Boolean(id),
  });
  const topicsQuery = useQuery({ queryKey: queryKeys.topics, queryFn: () => apiGet<TopicDto[]>('/topics') });
  const gapsQuery = useQuery({
    queryKey: ['gaps', pinTopic],
    queryFn: () => apiGet<GapsResponse>(`/topics/${pinTopic}/gaps`),
    enabled: Boolean(pinTopic),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.place(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.places });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  }, [id, queryClient]);

  const createFlag = useMutation({
    mutationFn: (payload: {
      xPct: number;
      yPct: number;
      label: string;
      notes: string;
      topicId?: string | null;
      keyPointId?: number | null;
    }) => apiPost<FlagDto>(`/places/${id}/flags`, payload),
    onSuccess: () => {
      invalidate();
      setDraftPosition(null);
      setDraftLabel('');
      setDraftNotes('');
      setDraftKeyPoint('');
      toast.success('Flag dropped');
    },
    onError: () => toast.error('Could not add that flag'),
  });

  const updateFlag = useMutation({
    mutationFn: ({ flagId, ...payload }: { flagId: string } & Record<string, unknown>) =>
      apiPatch<FlagDto>(`/flags/${flagId}`, payload),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      toast.success('Flag updated');
    },
    onError: () => toast.error('Could not update that flag'),
  });

  const deleteFlag = useMutation({
    mutationFn: (flagId: string) => apiDelete(`/flags/${flagId}`),
    onSuccess: () => {
      invalidate();
      setSelected(null);
      toast.success('Flag removed');
    },
  });

  const place = placeQuery.data;
  const pendingGaps = gapsQuery.data?.gaps ?? [];
  const topicKeyPoints = useMemo(
    () => topicsQuery.data?.flatMap((t) => t.keyPoints.map((kp) => ({ ...kp, topicId: t.id, topicTitle: t.title }))) ?? [],
    [topicsQuery.data],
  );

  const pctFromEvent = (event: React.MouseEvent<HTMLDivElement>): { xPct: number; yPct: number } | null => {
    const rect = imageWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      xPct: clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99),
      yPct: clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99),
    };
  };

  const onPhotoTap = (event: React.MouseEvent<HTMLDivElement>) => {
    const pct = pctFromEvent(event);
    if (!pct) return;
    if (pinTopic && pendingGaps.length > 0) {
      const next = pendingGaps[0];
      if (!next) return;
      createFlag.mutate({
        ...pct,
        label: next.text.slice(0, 80),
        notes: '',
        topicId: pinTopic,
        keyPointId: next.id,
      });
      return;
    }
    if (!placing) return;
    setDraftPosition(pct);
  };

  if (placeQuery.isLoading) return <div className="pt-6 text-[13px] text-muted">Loading place…</div>;
  if (!place) {
    return (
      <div className="pt-6">
        <p className="text-[13.5px] text-muted">That place is not here.</p>
        <Link to="/palace" className="mt-2 inline-block text-[13px] text-pine underline underline-offset-4">
          Back to the palace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('/palace')}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          All places
        </button>
        <span className="text-[11.5px] text-muted">
          <ZoomIn size={12} strokeWidth={1.8} className="mr-1 inline" />
          pinch or double-tap to zoom
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[1.5rem]">{place.name}</h1>
          <p className="text-[12px] text-muted">{place.flags.length} flags</p>
        </div>
        <Button
          size="sm"
          variant={placing ? 'accent' : 'primary'}
          onClick={() => setPlacing((v) => !v)}
          disabled={Boolean(pinTopic && pendingGaps.length > 0)}
        >
          {placing ? <Crosshair size={15} strokeWidth={1.8} /> : <Plus size={15} strokeWidth={1.9} />}
          {placing ? 'Tap the photo' : 'Add flag'}
        </Button>
      </div>

      {pinTopic && pendingGaps.length > 0 && (
        <div className="card border-[color-mix(in_srgb,var(--mustard)_50%,transparent)] bg-[color-mix(in_srgb,var(--mustard)_12%,transparent)] p-3">
          <p className="text-[12.5px] font-medium">
            Tap the photo to pin: {pendingGaps[0]?.text.slice(0, 70)}
            {pendingGaps.length > 1 ? ` (+${pendingGaps.length - 1} more)` : ''}
          </p>
        </div>
      )}

      <FadeIn>
        <div className="overflow-hidden rounded-card border border-line bg-[#1C1A17]">
          <TransformWrapper
            minScale={1}
            maxScale={4}
            doubleClick={{ mode: 'zoomIn', step: 0.7 }}
            panning={{ velocityDisabled: true }}
            wheel={{ step: 0.08 }}
          >
            <TransformComponent wrapperStyle={{ width: '100%' }} contentStyle={{ width: '100%' }}>
              <div
                ref={imageWrapRef}
                className={cn('relative w-full select-none', (placing || pendingGaps.length > 0) && 'cursor-crosshair')}
                onClick={onPhotoTap}
              >
                <img src={place.imageUrl} alt={place.name} className="block w-full" draggable={false} />
                {place.flags.map((flag) => {
                  const isSelected = selected?.id === flag.id;
                  return (
                    <motion.button
                      key={flag.id}
                      type="button"
                      drag={!reduce}
                      dragMomentum={false}
                      dragElastic={0}
                      whileDrag={{ scale: 1.18 }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(flag);
                        setEditing(false);
                      }}
                      onDragEnd={(_, info) => {
                        const rect = imageWrapRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const xPct = clamp(((info.point.x - rect.left) / rect.width) * 100, 1, 99);
                        const yPct = clamp(((info.point.y - rect.top) / rect.height) * 100, 1, 99);
                        updateFlag.mutate({ flagId: flag.id, xPct: Number(xPct.toFixed(2)), yPct: Number(yPct.toFixed(2)) });
                      }}
                      className="absolute -translate-x-1/2 -translate-y-full touch-none"
                      style={{ left: `${flag.xPct}%`, top: `${flag.yPct}%` }}
                      aria-label={`Flag: ${flag.label}`}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-lift transition-transform',
                          isSelected ? 'scale-110 border-ember bg-ember text-[#FFFDF8]' : 'border-[#FFFDF8] bg-pine text-[#FFFDF8]',
                        )}
                      >
                        <MapPin size={13} strokeWidth={2} />
                      </span>
                      <span className="mx-auto block h-2 w-[2px] bg-[#FFFDF8]/80" />
                    </motion.button>
                  );
                })}
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      </FadeIn>

      {place.flags.length === 0 && (
        <p className="text-[12.5px] text-muted">
          No flags yet. Tap Add flag, then tap a spot on the photo.
        </p>
      )}

      <Sheet
        open={Boolean(draftPosition)}
        onClose={() => setDraftPosition(null)}
        title="New flag"
        footer={
          <Button
            full
            onClick={() => {
              if (!draftPosition) return;
              createFlag.mutate({
                ...draftPosition,
                label: draftLabel.trim() || 'Untitled flag',
                notes: draftNotes,
                topicId: draftKeyPoint !== '' ? topicsQuery.data?.find((t) => t.keyPoints.some((kp) => kp.id === draftKeyPoint))?.id ?? null : null,
                keyPointId: draftKeyPoint === '' ? null : Number(draftKeyPoint),
              });
            }}
            disabled={createFlag.isPending}
          >
            Save flag
          </Button>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="eyebrow">What is here</span>
            <input
              className="field mt-1"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="Lamp = light energy"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="eyebrow">Notes</span>
            <textarea
              className="field mt-1 min-h-[80px]"
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              placeholder="Why this spot reminds you of it"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Link a key point (optional)</span>
            <select
              className="field mt-1"
              value={draftKeyPoint}
              onChange={(event) => setDraftKeyPoint(event.target.value === '' ? '' : Number(event.target.value))}
            >
              <option value="">Free note</option>
              {topicKeyPoints.map((kp) => (
                <option key={`${kp.topicId}-${kp.id}`} value={kp.id}>
                  {kp.topicTitle}: {kp.text.slice(0, 48)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setEditing(false);
        }}
        title={editing ? 'Edit flag' : 'Flag'}
        footer={
          selected && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing((v) => !v)}
                className="flex-1"
              >
                <Pencil size={14} strokeWidth={1.8} />
                {editing ? 'Cancel edit' : 'Edit'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteFlag.mutate(selected.id)}
                disabled={deleteFlag.isPending}
              >
                <Trash2 size={14} strokeWidth={1.8} />
                Delete
              </Button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-3">
            {editing ? (
              <>
                <input
                  className="field"
                  value={selected.label}
                  onChange={(event) => setSelected({ ...selected, label: event.target.value })}
                />
                <textarea
                  className="field min-h-[90px]"
                  value={selected.notes}
                  onChange={(event) => setSelected({ ...selected, notes: event.target.value })}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    updateFlag.mutate({
                      flagId: selected.id,
                      label: selected.label.trim() || 'Untitled flag',
                      notes: selected.notes,
                    })
                  }
                  disabled={updateFlag.isPending}
                >
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-medium">{selected.label}</p>
                {selected.notes && <p className="text-[13px] leading-relaxed text-muted">{selected.notes}</p>}
                {selected.topicTitle && (
                  <div className="card-quiet p-2.5 text-[12px]">
                    <p className="flex items-center gap-1.5 text-muted">
                      <Link2 size={12} strokeWidth={1.8} />
                      {selected.topicTitle}
                    </p>
                    {selected.keyPointText && <p className="mt-1">{selected.keyPointText}</p>}
                  </div>
                )}
                <p className="text-[11px] text-muted">
                  Drag the pin on the photo to move it. Position is saved as percentages.
                </p>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
