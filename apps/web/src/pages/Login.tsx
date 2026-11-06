import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { FadeIn } from '../components/ui/Motion';
import { ApiRequestError } from '../lib/api';

export function Login() {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signup') await signup({ name, email, password });
      else await login({ email, password });
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Could not sign you in');
    } finally {
      setBusy(false);
    }
  };

  const useDemo = async () => {
    setBusy(true);
    try {
      await login({ email: 'demo@pinpoint.app', password: 'pinpoint123' });
      navigate('/', { replace: true });
    } catch {
      toast.error('The demo account is not seeded yet. Run npm run db:seed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[420px] flex-col justify-center px-5 py-10">
      <FadeIn>
        <div className="mb-8 flex items-center gap-2 text-pine">
          <span className="rounded-full border border-line bg-surface p-2">
            <MapPin size={18} strokeWidth={1.75} />
          </span>
          <span className="font-display text-[1.35rem] tracking-tight">Pinpoint</span>
        </div>

        <h1 className="text-[2.1rem] leading-[1.05]">
          Explain it.
          <br />
          Pin it.
          <br />
          <span className="text-pine">Own it.</span>
        </h1>
        <p className="mt-3 max-w-[36ch] text-[14px] leading-relaxed text-muted">
          Say a topic out loud, see exactly what you missed, then pin each idea to a photo of a place
          you already know.
        </p>
      </FadeIn>

      <FadeIn delay={0.08} className="mt-8">
        <div className="card p-5">
          <div className="mb-4 flex rounded-pill border border-line p-1 text-[13px]">
            {(['login', 'signup'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className="relative flex-1 rounded-pill px-3 py-1.5 font-medium"
              >
                {mode === value && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-pill bg-[color-mix(in_srgb,var(--pine)_12%,transparent)]"
                    transition={{ duration: 0.2 }}
                  />
                )}
                <span className={mode === value ? 'relative text-pine' : 'relative text-muted'}>
                  {value === 'login' ? 'Sign in' : 'Create account'}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            {mode === 'signup' && (
              <label className="block">
                <span className="eyebrow">Name</span>
                <input
                  className="field mt-1"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </label>
            )}
            <label className="block">
              <span className="eyebrow">Email</span>
              <input
                className="field mt-1"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="eyebrow">Password</span>
              <input
                className="field mt-1"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : 1}
              />
            </label>
            <Button type="submit" size="lg" full disabled={busy}>
              {mode === 'signup' ? 'Create account' : 'Sign in'}
              <ArrowRight size={16} strokeWidth={1.8} />
            </Button>
          </form>

          <button
            type="button"
            onClick={() => void useDemo()}
            disabled={busy}
            className="mt-4 w-full text-center text-[12.5px] text-muted underline decoration-line underline-offset-4 hover:text-pine"
          >
            Use the demo account
          </button>
        </div>
      </FadeIn>
    </main>
  );
}
