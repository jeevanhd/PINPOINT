import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { PlaceDto } from '@pinpoint/shared';
import { apiGet, apiUpload } from '../lib/api';
import { queryKeys } from '../lib/query';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { Button } from '../components/ui/Button';
import { CameraCapture } from '../components/CameraCapture';
import { FadeIn, Stagger, StaggerItem } from '../components/ui/Motion';
import { EmptyState, Skeleton } from '../components/ui/States';

export function Palace() {
  const [params] = useSearchParams();
  const pinTopic = params.get('pinTopic');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useLiveUpdates();

  const placesQuery = useQuery({ queryKey: queryKeys.places, queryFn: () => apiGet<PlaceDto[]>('/places') });

  const createPlace = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error('Add a photo first');
      const form = new FormData();
      form.append('name', name.trim());
      form.append('file', photo);
      return apiUpload<PlaceDto>('/places', form);
    },
    onSuccess: (place) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.places });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      setAdding(false);
      setName('');
      setPhoto(null);
      setPreview(null);
      toast.success('Place added');
      navigate(`/palace/${place.id}${pinTopic ? `?pinTopic=${pinTopic}` : ''}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not add that place'),
  });

  const pickPhoto = (file: File) => {
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="space-y-4 pt-2">
      <FadeIn>
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Palace</p>
            <h1 className="mt-1 text-[1.7rem]">Your places</h1>
            <p className="mt-1 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">
              A photo of somewhere you know well. Each idea gets a spot on it, so you can walk the room in
              your head.
            </p>
          </div>
          <Button size="sm" variant={adding ? 'quiet' : 'primary'} onClick={() => setAdding((v) => !v)}>
            <Plus size={15} strokeWidth={1.9} />
            Add place
          </Button>
        </header>
      </FadeIn>

      {pinTopic && (
        <div className="card flex items-center gap-2 border-[color-mix(in_srgb,var(--mustard)_50%,transparent)] bg-[color-mix(in_srgb,var(--mustard)_12%,transparent)] p-3">
          <Sparkles size={15} strokeWidth={1.8} className="shrink-0 text-[color-mix(in_srgb,var(--mustard)_80%,black)]" />
          <p className="text-[12.5px]">
            Pin the gaps from your last explanation. Open a place and tap the photo to drop each one.
          </p>
        </div>
      )}

      {adding && (
        <FadeIn>
          <div className="card space-y-3 p-4">
            <input
              className="field"
              placeholder="Name the place - Study desk, Hostel room…"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {preview ? (
              <div className="space-y-2">
                <img src={preview} alt="Place preview" className="max-h-[240px] w-full rounded-card object-cover" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => createPlace.mutate()}
                    disabled={createPlace.isPending || name.trim().length === 0}
                  >
                    {createPlace.isPending ? 'Saving…' : 'Save place'}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      if (preview) URL.revokeObjectURL(preview);
                      setPhoto(null);
                      setPreview(null);
                    }}
                  >
                    Retake
                  </Button>
                </div>
              </div>
            ) : (
              <CameraCapture
                label="Photograph the place"
                hint="A desk, a wall, a room - anything you know by heart"
                onCapture={pickPhoto}
              />
            )}
          </div>
        </FadeIn>
      )}

      {placesQuery.isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      )}

      {placesQuery.data && placesQuery.data.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No places yet"
          body="Photograph your desk, your wall, your shelf. The more familiar the place, the better the memory hooks."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={15} strokeWidth={1.9} />
              Add your first place
            </Button>
          }
        />
      )}

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {placesQuery.data?.map((place) => (
          <StaggerItem key={place.id}>
            <Link
              to={`/palace/${place.id}${pinTopic ? `?pinTopic=${pinTopic}` : ''}`}
              className="group block overflow-hidden rounded-tile border border-line bg-surface"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={place.imageUrl}
                  alt={place.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute right-1.5 top-1.5 rounded-pill bg-[rgba(35,32,28,0.62)] px-2 py-0.5 text-[10.5px] font-medium text-[#FFFDF8]">
                  {place.flagCount} flag{place.flagCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="truncate px-2.5 py-2 text-[13px] font-medium">{place.name}</p>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
