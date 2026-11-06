import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogOut, MapPin } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { BottomNav } from './components/BottomNav';
import { ConnectionPill } from './components/ConnectionPill';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Topic } from './pages/Topic';
import { TopicDetail } from './pages/TopicDetail';
import { Explain } from './pages/Explain';
import { Palace } from './pages/Palace';
import { PlaceView } from './pages/PlaceView';
import { Recall } from './pages/Recall';

function Shell() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const reduce = useReducedMotion();

  if (loading) {
    return (
      <div className="app-shell">
        <div className="skeleton mt-10 h-24 w-full rounded-card" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <div className="app-shell">
        <header className="mb-4 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-display text-[1.05rem] text-pine">
            <MapPin size={16} strokeWidth={1.9} />
            Pinpoint
          </span>
          <div className="flex items-center gap-2">
            <ConnectionPill />
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="rounded-full p-1.5 text-muted hover:text-ink"
            >
              <LogOut size={15} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
      <BottomNav />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/topic" element={<Topic />} />
        <Route path="/topic/:id" element={<TopicDetail />} />
        <Route path="/explain" element={<Explain />} />
        <Route path="/palace" element={<Palace />} />
        <Route path="/palace/:id" element={<PlaceView />} />
        <Route path="/recall" element={<Recall />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
