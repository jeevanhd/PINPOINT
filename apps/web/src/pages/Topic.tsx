import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileUp, FolderPlus, Loader2, PenLine, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type {
  FileDonePayload,
  FileErrorPayload,
  FileProgressPayload,
  TopicDto,
  UnitDto,
} from '@pinpoint/shared';
import { fileDoneSchema, fileErrorSchema, fileProgressSchema } from '@pinpoint/shared';
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from '../lib/api';
import { connectSocket } from '../lib/socket';
import { queryKeys } from '../lib/query';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { Button } from '../components/ui/Button';
import { CameraCapture } from '../components/CameraCapture';
import { FadeIn } from '../components/ui/Motion';
import { CardSkeleton, EmptyState, Skeleton } from '../components/ui/States';

type Stage = 'idle' | 'uploading' | 'analyzing' | 'review' | 'saving';

interface Draft {
  topicId: string;
  title: string;
  notes: string;
  points: string[];
  source: 'uploaded' | 'manual';
}

export function Topic() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unitTitle, setUnitTitle] = useState('');
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualPoints, setManualPoints] = useState('');

  useLiveUpdates();

  const topicsQuery = useQuery({ queryKey: queryKeys.topics, queryFn: () => apiGet<TopicDto[]>('/topics') });
  const unitsQuery = useQuery({ queryKey: queryKeys.units, queryFn: () => apiGet<UnitDto[]>('/units') });

  const createUnit = useMutation({
    mutationFn: () => apiPost<UnitDto>('/units', { title: unitTitle.trim() }),
    onSuccess: () => {
      setUnitTitle('');
      setShowUnitForm(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.units });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: () => toast.error('Could not create that unit'),
  });

  const createManual = useMutation({
    mutationFn: () =>
      apiPost<TopicDto>('/topics', {
        title: manualTitle.trim(),
        notes: '',
        source: 'manual',
        keyPoints: manualPoints
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((text) => ({ text })),
      }),
    onSuccess: (topic) => {
      setManual(false);
      setManualTitle('');
      setManualPoints('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.topics });
      navigate(`/topic/${topic.id}`);
    },
    onError: () => toast.error('Could not save that topic'),
  });

  const removeTopic = useMutation({
    mutationFn: (id: string) => apiDelete(`/topics/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.topics });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <FadeIn>
        <header>
          <p className="eyebrow">Topic</p>
          <h1 className="mt-1 text-[1.7rem]">Bring in one page</h1>
          <p className="mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
            Two pages per topic, maximum. Pinpoint reads them and hands you 5 to 8 key points - edit them
            before anything is saved.
          </p>
        </header>
      </FadeIn>

      <UploadMaterial
        units={unitsQuery.data ?? []}
        onSaved={(topicId) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.topics });
          void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
          navigate(`/topic/${topicId}`);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setManual((v) => !v)}>
          <PenLine size={15} strokeWidth={1.8} />
          Type key points myself
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setShowUnitForm((v) => !v)}>
          <FolderPlus size={15} strokeWidth={1.8} />
          New unit
        </Button>
      </div>

      <AnimatePresence>
        {showUnitForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              createUnit.mutate();
            }}
          >
            <div className="card flex gap-2 p-3">
              <input
                className="field"
                placeholder="Biology - Unit 3"
                value={unitTitle}
                onChange={(event) => setUnitTitle(event.target.value)}
                required
              />
              <Button type="submit" size="sm" disabled={createUnit.isPending}>
                Add
              </Button>
            </div>
          </motion.form>
        )}

        {manual && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault();
              createManual.mutate();
            }}
          >
            <div className="card space-y-2 p-4">
              <input
                className="field"
                placeholder="Topic title"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                required
              />
              <textarea
                className="field min-h-[120px]"
                placeholder={'One key point per line\nChlorophyll absorbs light\nWater is split'}
                value={manualPoints}
                onChange={(event) => setManualPoints(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={createManual.isPending}>
                Save topic
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {(unitsQuery.data ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unitsQuery.data?.map((unit) => (
            <span key={unit.id} className="pill">
              {unit.title} · {unit.topicCount}
            </span>
          ))}
        </div>
      )}

      {topicsQuery.isLoading && <CardSkeleton />}

      {topicsQuery.data && topicsQuery.data.length === 0 && (
        <EmptyState
          icon={FileUp}
          title="Nothing uploaded yet"
          body="A photo of one notebook page is enough. Pinpoint needs something to check your explanation against."
        />
      )}

      <ul className="space-y-2">
        {topicsQuery.data?.map((topic) => (
          <li key={topic.id} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <Link to={`/topic/${topic.id}`} className="block truncate text-[14.5px] font-medium hover:text-pine">
                {topic.title}
              </Link>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {topic.keyPoints.length} key points · {topic.files.length} file
                {topic.files.length === 1 ? '' : 's'} · {topic.source}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Delete ${topic.title}`}
              onClick={() => removeTopic.mutate(topic.id)}
              className="rounded-full p-1.5 text-muted hover:text-bad"
            >
              <Trash2 size={15} strokeWidth={1.7} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UploadMaterial({
  units,
  onSaved,
}: {
  units: UnitDto[];
  onSaved: (topicId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [unitId, setUnitId] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<Draft | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Progress arrives on the shared socket, validated against the contract.
  useEffect(() => {
    const socket = connectSocket();
    const onProgress = (raw: unknown) => {
      const parsed = fileProgressSchema.safeParse(raw);
      if (!parsed.success) return;
      const payload: FileProgressPayload = parsed.data;
      if (payload.topicId !== draftRef.current?.topicId) return;
      setProgress(payload.progress);
      setStageLabel(payload.stage);
    };
    const onDone = (raw: unknown) => {
      const parsed = fileDoneSchema.safeParse(raw);
      if (!parsed.success) return;
      const payload: FileDonePayload = parsed.data;
      if (payload.topicId !== draftRef.current?.topicId) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              title: payload.extraction.title,
              notes: payload.extraction.notes,
              points: payload.extraction.keyPoints.map((kp) => kp.text),
            }
          : current,
      );
      setStage('review');
      setProgress(100);
    };
    const onError = (raw: unknown) => {
      const parsed = fileErrorSchema.safeParse(raw);
      if (!parsed.success) return;
      const payload: FileErrorPayload = parsed.data;
      if (payload.topicId !== draftRef.current?.topicId) return;
      setStage('idle');
      toast.error(payload.message);
    };
    socket.on('file:progress', onProgress);
    socket.on('file:done', onDone);
    socket.on('file:error', onError);
    return () => {
      socket.off('file:progress', onProgress);
      socket.off('file:done', onDone);
      socket.off('file:error', onError);
    };
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setStage('uploading');
      setProgress(5);
      setStageLabel('uploading');
      try {
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 60);
        const topic = await apiPost<TopicDto>('/topics', {
          title: baseName || 'New topic',
          notes: '',
          source: 'uploaded',
          keyPoints: [],
          unitId: unitId || null,
        });
        setDraft({ topicId: topic.id, title: topic.title, notes: '', points: [], source: 'uploaded' });
        draftRef.current = { topicId: topic.id, title: topic.title, notes: '', points: [], source: 'uploaded' };

        const form = new FormData();
        form.append('file', file);
        await apiUpload(`/topics/${topic.id}/files`, form);
        setStage('analyzing');
        setStageLabel('reading');
      } catch (err) {
        setStage('idle');
        const message = err instanceof Error ? err.message : 'Upload failed';
        toast.error(message);
      }
    },
    [unitId],
  );

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setStage('saving');
    try {
      await apiPatch<TopicDto>(`/topics/${draft.topicId}`, {
        title: draft.title.trim() || 'Untitled topic',
        notes: draft.notes,
        keyPoints: draft.points.filter((p) => p.trim()).map((text) => ({ text })),
      });
      toast.success('Saved. Now explain it out loud.');
      setSaving(false);
      setStage('idle');
      setDraft(null);
      setProgress(0);
      onSaved(draft.topicId);
    } catch {
      setSaving(false);
      setStage('review');
      toast.error('Could not save. Check the key points.');
    }
  }, [draft, onSaved]);

  if (stage === 'review' && draft) {
    return (
      <FadeIn>
        <div className="card space-y-3 p-4">
          <div className="flex items-center gap-2 text-good">
            <Check size={16} strokeWidth={2} />
            <p className="text-[12.5px] font-medium">Extracted. Edit anything that is not right.</p>
          </div>
          <input
            className="field text-[15px] font-medium"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
          <textarea
            className="field min-h-[86px] text-[13.5px]"
            value={draft.notes}
            placeholder="Short notes"
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
          <div className="space-y-2">
            <p className="eyebrow">Key points ({draft.points.length})</p>
            {draft.points.map((point, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-3 w-5 shrink-0 text-right text-[11px] text-muted tabular-nums">{index + 1}</span>
                <textarea
                  className="field min-h-[46px] flex-1 py-2 text-[13.5px]"
                  value={point}
                  onChange={(event) => {
                    const next = [...draft.points];
                    next[index] = event.target.value;
                    setDraft({ ...draft, points: next });
                  }}
                />
                <button
                  type="button"
                  aria-label="Remove key point"
                  onClick={() => setDraft({ ...draft, points: draft.points.filter((_, i) => i !== index) })}
                  className="mt-2.5 text-muted hover:text-bad"
                >
                  <Trash2 size={14} strokeWidth={1.7} />
                </button>
              </div>
            ))}
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setDraft({ ...draft, points: [...draft.points, ''] })}
            >
              <Plus size={14} strokeWidth={1.9} />
              Add a point
            </Button>
          </div>
          <div className="flex gap-2 border-t border-line pt-3">
            <Button onClick={() => void save()} disabled={saving}>
              Save topic
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setDraft(null);
                setStage('idle');
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      </FadeIn>
    );
  }

  if (stage === 'uploading' || stage === 'analyzing') {
    return (
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2 text-[13px]">
          <Loader2 size={15} className="animate-spin text-pine" strokeWidth={1.9} />
          <span>{stageLabel === 'analyzing' ? 'Reading your page and finding key points…' : 'Uploading…'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-[color-mix(in_srgb,var(--line)_70%,transparent)]">
          <motion.div
            className="h-full rounded-pill bg-pine"
            animate={{ width: `${Math.max(6, progress)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  return (
    <div
      className={`card space-y-3 p-4 transition-colors ${dragging ? 'border-pine bg-[color-mix(in_srgb,var(--pine)_6%,transparent)]' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
    >
      <div className="flex items-center gap-2">
        <Upload size={16} strokeWidth={1.8} className="text-pine" />
        <p className="text-[13.5px] font-medium">Drop a PDF or a photo here</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          <FileUp size={15} strokeWidth={1.8} />
          Choose a file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        {units.length > 0 && (
          <select
            className="field h-9 w-auto py-0 text-[13px]"
            value={unitId}
            onChange={(event) => setUnitId(event.target.value)}
            aria-label="Unit"
          >
            <option value="">No unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="border-t border-dashed border-line pt-3">
        <CameraCapture
          label="Photograph a page"
          hint="Fill the frame with the page"
          onCapture={(file) => void upload(file)}
        />
      </div>
    </div>
  );
}
