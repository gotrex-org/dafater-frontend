'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { WindowedContext } from './windowed';

// A generic "minimizable window" manager, mounted once at the app root. Any section can
// open an editor as a window: it renders as an overlay on top of the current page, and a
// "🗕 تصغير" button collapses it into a bottom dock while keeping it fully mounted — so
// its form state survives both minimizing AND navigating to another section. Click the
// dock chip to bring it back. This is what makes "start a فاتورة / بيع خارجي / كشف, leave
// to check something, come back and finish it" work across every section.
interface WinItem {
  id: string;
  title: string;
  render: (close: () => void) => ReactNode;
}

interface WindowsCtx {
  /** open (or focus, if the id already exists) an editor as a window */
  open: (opts: { id?: string; title: string; render: (close: () => void) => ReactNode }) => void;
  close: (id: string) => void;
}

const Ctx = createContext<WindowsCtx | null>(null);

export function useWindows() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWindows must be used within WindowsProvider');
  return c;
}

let _seq = 0;

export function WindowsProvider({ children }: { children: ReactNode }) {
  const [wins, setWins] = useState<WinItem[]>([]);
  // The single foreground (visible) window; all others are minimized in the dock. null =
  // everything minimized. Keeping only one visible avoids stacked full-page editors.
  const [fg, setFg] = useState<string | null>(null);

  const open = useCallback((opts: { id?: string; title: string; render: (close: () => void) => ReactNode }) => {
    const id = opts.id ?? `win_${++_seq}_${Date.now()}`;
    setWins((list) =>
      list.some((w) => w.id === id)
        ? list.map((w) => (w.id === id ? { ...w, title: opts.title, render: opts.render } : w))
        : [...list, { id, title: opts.title, render: opts.render }],
    );
    setFg(id);
  }, []);

  const close = useCallback((id: string) => {
    setWins((list) => list.filter((w) => w.id !== id));
    setFg((cur) => (cur === id ? null : cur));
  }, []);

  const minimized = wins.filter((w) => w.id !== fg);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}

      {/* Every window stays mounted (state preserved); only the foreground is shown. */}
      {wins.map((w) => (
        <div key={w.id} className="draft-overlay" style={{ display: w.id === fg ? 'flex' : 'none' }}>
          <div className="draft-overlay-inner">
            <div className="win-chrome">
              <span className="win-title">{w.title}</span>
              <button
                className="btn btn-ghost btn-sm"
                title="تصغير — يفضل مفتوح وتقدر تكمّله بعدين"
                onClick={() => setFg(null)}
              >
                🗕 تصغير
              </button>
            </div>
            <WindowedContext.Provider value={true}>
              {w.render(() => close(w.id))}
            </WindowedContext.Provider>
          </div>
        </div>
      ))}

      {/* Dock of minimized windows */}
      {minimized.length > 0 && (
        <div className="draft-dock">
          {minimized.map((w) => (
            <div key={w.id} className="draft-chip" title={w.title}>
              <button className="draft-chip-open" onClick={() => setFg(w.id)}>
                <span className="draft-chip-icon">🗔</span>
                <span className="draft-chip-label">{w.title}</span>
              </button>
              <button className="draft-chip-x" title="إغلاق" onClick={() => close(w.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}
