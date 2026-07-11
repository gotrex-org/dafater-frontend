'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { WindowedContext } from './windowed';

// A generic "minimizable window" manager, mounted once at the app root. The whole app runs
// as a desktop of windows: every section (from الإدخال اليومي to تقرير اليوم) and every
// editor (فاتورة، بيع خارجي، …) opens as a window. "🗕 تصغير" collapses it into the bottom
// dock while keeping it fully mounted — so its state (what you typed, the row you opened,
// the filter you set) survives both minimizing AND opening another section. Click the dock
// chip to bring it back. Multiple windows can be open at once; one is foreground at a time.
interface WinItem {
  id: string;
  title: string;
  size: 'md' | 'lg';
  render: (close: () => void) => ReactNode;
}

interface WindowsCtx {
  /** open (or focus, if the id already exists) a window */
  open: (opts: { id?: string; title: string; size?: 'md' | 'lg'; render: (close: () => void) => ReactNode }) => void;
  close: (id: string) => void;
  /** id of the currently-foreground window (null = all minimized) */
  foregroundId: string | null;
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
  // everything minimized. Keeping only one visible avoids stacked full-page windows.
  const [fg, setFg] = useState<string | null>(null);

  const open = useCallback((opts: { id?: string; title: string; size?: 'md' | 'lg'; render: (close: () => void) => ReactNode }) => {
    const id = opts.id ?? `win_${++_seq}_${Date.now()}`;
    const size = opts.size ?? 'md';
    setWins((list) =>
      list.some((w) => w.id === id)
        ? list.map((w) => (w.id === id ? { ...w, title: opts.title, size, render: opts.render } : w))
        : [...list, { id, title: opts.title, size, render: opts.render }],
    );
    setFg(id);
  }, []);

  const close = useCallback((id: string) => {
    setWins((list) => list.filter((w) => w.id !== id));
    setFg((cur) => (cur === id ? null : cur));
  }, []);

  const minimized = wins.filter((w) => w.id !== fg);

  return (
    <Ctx.Provider value={{ open, close, foregroundId: fg }}>
      {children}

      {/* Every window stays mounted (state preserved); only the foreground is shown. */}
      {wins.map((w) => (
        <div key={w.id} className={`draft-overlay draft-overlay-${w.size}`} style={{ display: w.id === fg ? 'flex' : 'none' }}>
          <div className="draft-overlay-inner">
            <div className="win-chrome">
              <span className="win-title">{w.title}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" title="تصغير — يفضل مفتوح وتقدر ترجعله" onClick={() => setFg(null)}>🗕 تصغير</button>
                <button className="btn btn-ghost btn-sm" title="إغلاق النافذة" onClick={() => close(w.id)}>✕</button>
              </span>
            </div>
            <div className="win-body">
              <WindowedContext.Provider value={true}>
                {w.render(() => close(w.id))}
              </WindowedContext.Provider>
            </div>
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
