import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileText, Mic, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExplanationDto, TopicDto } from '@pinpoint/shared';
import { apiDelete, apiGet, apiPatch } from '../lib/api';
import { queryKeys } from '../lib/query';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/Motion';
import { CardSkeleton } from '../components/ui/States';
import { formatDateTime } from '../lib/utils';

interface PointDraft {
  id?: number;
  text: string;
}

export function TopicDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [points, setPoints] = useState<PointDraft[]>([]);
  const [dirty, setDirty] = useState(false);

  const topicQuery = useQuery({
    queryKey: queryKeys.topic(id),
    queryFn: () => apiGet<TopicDto>(`/topics/${id}`),
    enabled: Boolean(id),
  });
  const historyQuery = useQuery({
    queryKey: queryKeys.explanations(id),
    queryFn: () => apiGet<ExplanationDto[]>(`/topics/${id}/explanations`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const topic = topicQuery.data;
    if (!topic) return;
    setTitle(topic.title);
    setNotes(topic.notes);
    setPoints(topic.keyPoints.map((kp) => ({ id: kp.id, text: kp.text })));
    setDirty(false);
  }, [topicQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      apiPatch<TopicDto>(`/topics/${id}`, {
        title: title.trim() || 'Untitled topic',
        notes,
        // Existing ids are kept so flags and explanations stay linked.
        keyPoints: points.filter((p) => p.text.trim()).map((p) => (p.id != null ? { id: p.id, text: p.text } : { text: p.text })),
      }),
    onSuccess: () => {
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.topic(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      toast.success('Topic saved');
    },
    onError: () => toast.error('Could not save the topic'),
  });

  const removeFile = useMutation({
    mutationFn: (fileId: string) => apiDelete(`/topics/${id}/files/${fileId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.topic(id) });
      toast.success('File removed');
    },
  });

  if (topicQuery.isLoading) return <div className="pt-4"><CardSkeleton /></div>;
  if (topicQuery.isError || !topicQuery.data) {
    return (
      <div className="pt-6">
        <p className="text-[13.5px] text-muted">That topic is not here.</p>
        <Link to="/topic" className="mt-2 inline-block text-[13px] text-pine underline underline-offset-4">
          Back to topics
        </Link>
      </div>
    );
  }

  const topic = topicQuery.data;

  return (
    <div className="space-y-4 pt-2">
      <button
        type="button"
        onClick={() => navigate('/topic')}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={1.8} />
        All topics
      </button>

      <FadeIn>
        <div className="card space-y-3 p-4">
          <input
            className="w-full border-none bg-transparent font-display text-[1.5rem] leading-tight outline-none"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            aria-label="Topic title"
          />
          <textarea
            className="field min-h-[80px] text-[13.5px]"
            value={notes}
            placeholder="Short notes for this topic"
            onChange={(event) => {
              setNotes(event.target.value);
              setDirty(true);
            }}
            aria-label="Topic notes"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button size="sm" variant="accent" onClick={() => navigate(`/explain?topic=${topic.id}`)}>
              <Mic size={15} strokeWidth={1.8} />
              Explain this topic
            </Button>
            <span className="ml-auto text-[11.5px] text-muted">
              {topic.source === 'ai' ? 'AI-extracted' : topic.source === 'uploaded' ? 'From your upload' : 'Typed by you'}
            </span>
          </div>
        </div>
      </FadeIn>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[1.1rem]">Key points</h2>
          <span className="text-[11.5px] text-muted">{points.length} total · ids stay stable</span>
        </div>
        <ul className="space-y-2">
          {points.map((point, index) => (
            <li key={point.id ?? `new-${index}`} className="card flex items-start gap-2 p-2.5">
              <span className="mt-2.5 w-6 shrink-0 text-right text-[11px] tabular-nums text-muted">
                {point.id ?? '+'}
              </span>
              <textarea
                className="field min-h-[44px] flex-1 py-2 text-[13.5px]"
                value={point.text}
                onChange={(event) => {
                  const next = [...points];
                  next[index] = { ...point, text: event.target.value };
                  setPoints(next);
                  setDirty(true);
                }}
              />
              <button
                type="button"
                aria-label="Remove key point"
                onClick={() => {
                  setPoints(points.filter((_, i) => i !== index));
                  setDirty(true);
                }}
                className="mt-2 text-muted hover:text-bad"
              >
                <Trash2 size={14} strokeWidth={1.7} />
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            setPoints([...points, { text: '' }]);
            setDirty(true);
          }}
        >
          <Plus size={14} strokeWidth={1.9} />
          Add key point
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-[1.1rem]">Files</h2>
        {topic.files.length === 0 ? (
          <p className="text-[12.5px] text-muted">No files yet. Upload a page from the Topic screen.</p>
        ) : (
          <ul className="space-y-1.5">
            {topic.files.map((file) => (
              <li key={file.id} className="card flex items-center gap-2 p-2.5 text-[13px]">
                <FileText size={15} strokeWidth={1.7} className="text-muted" />
                <span className="min-w-0 flex-1 truncate">{file.originalName}</span>
                <span className="pill">{file.pageCount} page{file.pageCount === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.originalName}`}
                  onClick={() => removeFile.mutate(file.id)}
                  className="text-muted hover:text-bad"
                >
                  <Trash2 size={14} strokeWidth={1.7} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-[1.1rem]">Attempts</h2>
        {historyQuery.data && historyQuery.data.length === 0 && (
          <p className="text-[12.5px] text-muted">No attempts yet. Explain it once and your gap map appears here.</p>
        )}
        <ul className="space-y-1.5">
          {historyQuery.data?.map((attempt) => (
            <li key={attempt.id} className="card flex items-center gap-2 p-2.5 text-[12.5px]">
              <span className={attempt.passed ? 'text-good' : 'text-warn'}>
                {attempt.passed ? <Check size={14} strokeWidth={2.2} /> : <span className="tabular-nums">{attempt.score}%</span>}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">{attempt.summary || 'Attempt recorded'}</span>
              <span className="shrink-0 text-[11px] text-muted">{formatDateTime(attempt.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
