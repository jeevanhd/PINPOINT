import { useCallback, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, ImagePlus, RotateCcw, Check, VideoOff } from 'lucide-react';
import { Button } from './ui/Button';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  compress?: boolean;
}

type Phase = 'idle' | 'streaming' | 'preview' | 'blocked';

/**
 * One camera component for both flows: document pages (Topic) and places
 * (Palace). Rear camera by default, client-side compression, and a plain
 * <input capture="environment"> fallback whenever getUserMedia is refused.
 *
 * Camera access needs HTTPS or localhost - see the README.
 */
export function CameraCapture({
  onCapture,
  label = 'Take photo',
  hint = 'Hold steady, fill the frame',
  disabled = false,
  compress = true,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('blocked');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('streaming');
      // The element mounts with the streaming phase.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setPhase('blocked');
    }
  }, []);

  const compressFile = useCallback(
    async (file: File): Promise<File> => {
      if (!compress) return file;
      try {
        return await imageCompression(file, {
          maxSizeMB: 1.2,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          initialQuality: 0.82,
        });
      } catch {
        return file;
      }
    },
    [compress],
  );

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    stopStream();
    if (!blob) {
      setBusy(false);
      setPhase('idle');
      return;
    }
    const raw = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const file = await compressFile(raw);
    setShot({ file, url: URL.createObjectURL(file) });
    setPhase('preview');
    setBusy(false);
  }, [compressFile, stopStream]);

  const retake = useCallback(() => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setPhase('idle');
    void start();
  }, [shot, start]);

  const confirm = useCallback(() => {
    if (!shot) return;
    onCapture(shot.file);
    URL.revokeObjectURL(shot.url);
    setShot(null);
    setPhase('idle');
  }, [onCapture, shot]);

  const onFilePicked = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setBusy(true);
      const compressed = await compressFile(file);
      setBusy(false);
      onCapture(compressed);
    },
    [compressFile, onCapture],
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void onFilePicked(event)}
      />

      {phase === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void start()} disabled={disabled || busy}>
            <Camera size={17} strokeWidth={1.75} />
            {label}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={disabled || busy}>
            <ImagePlus size={17} strokeWidth={1.75} />
            Choose file
          </Button>
        </div>
      )}

      {phase === 'streaming' && (
        <div className="overflow-hidden rounded-card border border-line bg-[#1C1A17]">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="flex items-center justify-between gap-3 p-3">
            <span className="text-[12px] text-[#EFE9DC]">{hint}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  stopStream();
                  setPhase('idle');
                }}
              >
                Cancel
              </Button>
              <Button variant="accent" size="sm" onClick={() => void capture()} disabled={busy}>
                <Camera size={15} strokeWidth={1.75} />
                Capture
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'preview' && shot && (
        <div className="overflow-hidden rounded-card border border-line">
          <img src={shot.url} alt="Captured preview" className="aspect-[4/3] w-full object-cover" />
          <div className="flex items-center justify-between gap-2 p-3">
            <span className="text-[12px] text-muted">{(shot.file.size / 1024).toFixed(0)} KB after compression</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={retake}>
                <RotateCcw size={15} strokeWidth={1.75} />
                Retake
              </Button>
              <Button variant="primary" size="sm" onClick={confirm}>
                <Check size={15} strokeWidth={1.75} />
                Use photo
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'blocked' && (
        <div className="card-quiet space-y-3 p-4">
          <div className="flex items-center gap-2 text-muted">
            <VideoOff size={16} strokeWidth={1.75} />
            <span className="text-[13px]">
              Camera is not available here. Use the file picker - on a phone it still opens the camera.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={15} strokeWidth={1.75} />
            Choose file
          </Button>
        </div>
      )}
    </div>
  );
}
