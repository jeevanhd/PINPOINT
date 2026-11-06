import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Live transcript through the Web Speech API, with a typed fallback that is
 * always available. Nothing here is required for the screen to work.
 */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && Boolean(getCtor());
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError('This browser cannot listen. Type your explanation instead.');
      return;
    }
    setError(null);
    const recognition = new Ctor();
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          setFinalText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${text.trim()}`);
        } else {
          interimChunk += text;
        }
      }
      setInterim(interimChunk);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone blocked. Allow it in the browser, or type instead.'
          : 'Listening stopped. You can type the rest.',
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const reset = useCallback(() => {
    setFinalText('');
    setInterim('');
    setError(null);
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return {
    supported,
    listening,
    finalText,
    interim,
    error,
    start,
    stop,
    reset,
    setFinalText,
    combined: `${finalText}${interim ? ` ${interim}` : ''}`.trim(),
  };
}
