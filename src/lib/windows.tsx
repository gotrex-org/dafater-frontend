'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { WindowedContext } from './windowed';

// Window manager mounted once at the app root. Two kinds of windows:
//  • Sections (الإدخال اليومي … تقرير اليوم): render INLINE as normal full pages. Each has a
//    "🗕 تصغير" button; minimizing sends it to the bottom dock while keeping it mounted, so
//    its state (what you typed, the row you opened, the filter) is preserved. All visited
//    sections stay mounted, so navigating between them and back also keeps their state.
//  • Editors (فاتورة، بيع خارجي، مرتجع…): open as an overlay window on top, with تصغير/إغلاق.
// Both land in the same bottom dock when minimized.

interface EditorWin { id: string; title: string; render: (close: () => void) => ReactNode; }
interface SectionWin { id: string; title: string; href: string; node: ReactNode; }

interface WindowsCtx {
  // editors (overlay)
  open: (opts: { id?: string; title: string; render: (close: () => void) => ReactNode }) => void;
  close: (id: string) => void;
  // sections (inline)
  activateSection: (s: { id: string; title: string; href: string; node: ReactNode }) => void;
  minimizeSection: (id: string) => void;
  restoreSection: (id: string) => void;
  closeSection: (id: string) => void;
  sections: SectionWin[];
  activeSectionId: string | null;
  minimizedSectionIds: string[];
}

const Ctx = createContext<WindowsCtx | null>(null);

export function useWindows() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWindows must be used within WindowsProvider');
  return c;
}

let _seq = 0;

export function WindowsProvider({ children }: { children: ReactNode }) {
  const [editors, setEditors] = useState<EditorWin[]>([]);
  const [editorFg, setEditorFg] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionWin[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [minimizedSectionIds, setMinimizedSectionIds] = useState<string[]>([]);

  // ── editors ──
  const open = useCallback((opts: { id?: string; title: string; render: (close: () => void) => ReactNode }) => {
    const id = opts.id ?? `win_${++_seq}_${Date.now()}`;
    setEditors((list) =>
      list.some((w) => w.id === id)
        ? list.map((w) => (w.id === id ? { ...w, title: opts.title, render: opts.render } : w))
        : [...list, { id, title: opts.title, render: opts.render }],
    );
    setEditorFg(id);
  }, []);
  const close = useCallback((id: string) => {
    setEditors((list) => list.filter((w) => w.id !== id));
    setEditorFg((cur) => (cur === id ? null : cur));
  }, []);

  // ── sections ──
  const activateSection = useCallback((s: { id: string; title: string; href: string; node: ReactNode }) => {
    // Mount the section once; on later activations just show it (keep the existing node so
    // its state is preserved).
    setSections((list) => (list.some((x) => x.id === s.id) ? list : [...list, s]));
    setMinimizedSectionIds((ids) => ids.filter((x) => x !== s.id));
    setActiveSectionId(s.id);
  }, []);
  const minimizeSection = useCallback((id: string) => {
    setMinimizedSectionIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setActiveSectionId((cur) => (cur === id ? null : cur));
  }, []);
  const restoreSection = useCallback((id: string) => {
    setMinimizedSectionIds((ids) => ids.filter((x) => x !== id));
    setActiveSectionId(id);
  }, []);
  const closeSection = useCallback((id: string) => {
    setSections((list) => list.filter((x) => x.id !== id));
    setMinimizedSectionIds((ids) => ids.filter((x) => x !== id));
    setActiveSectionId((cur) => (cur === id ? null : cur));
  }, []);

  const minimizedSecs = sections.filter((s) => minimizedSectionIds.includes(s.id));
  const minimizedEds = editors.filter((e) => e.id !== editorFg);
  const hasDock = minimizedSecs.length + minimizedEds.length > 0;

  return (
    <Ctx.Provider value={{ open, close, activateSection, minimizeSection, restoreSection, closeSection, sections, activeSectionId, minimizedSectionIds }}>
      {children}

      {/* Editor overlays — foreground visible, others mounted but hidden */}
      {editors.map((w) => (
        <div key={w.id} className="draft-overlay" style={{ display: w.id === editorFg ? 'flex' : 'none' }}>
          <div className="draft-overlay-inner">
            <div className="win-chrome">
              <span className="win-title">{w.title}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" title="تصغير" onClick={() => setEditorFg(null)}>🗕 تصغير</button>
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

      {/* Dock of minimized windows (sections + editors) */}
      {hasDock && (
        <div className="draft-dock">
          {minimizedSecs.map((s) => (
            <div key={s.id} className="draft-chip" title={s.title}>
              <button className="draft-chip-open" onClick={() => restoreSection(s.id)}>
                <span className="draft-chip-icon">🗔</span>
                <span className="draft-chip-label">{s.title}</span>
              </button>
              <button className="draft-chip-x" title="إغلاق" onClick={() => closeSection(s.id)}>×</button>
            </div>
          ))}
          {minimizedEds.map((e) => (
            <div key={e.id} className="draft-chip" title={e.title}>
              <button className="draft-chip-open" onClick={() => setEditorFg(e.id)}>
                <span className="draft-chip-icon">🧾</span>
                <span className="draft-chip-label">{e.title}</span>
              </button>
              <button className="draft-chip-x" title="إغلاق" onClick={() => close(e.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

// Renders the section windows inline in the page flow — the active one is shown as a
// normal full page with a "🗕 تصغير" button; the rest stay mounted but hidden.
export function SectionOutlet() {
  const { sections, activeSectionId, minimizeSection } = useWindows();
  return (
    <>
      {sections.map((s) => (
        <div key={s.id} style={{ display: s.id === activeSectionId ? 'block' : 'none' }}>
          <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
            <button className="btn btn-ghost btn-sm" title="تصغير القسم — يفضل مفتوح في الشريط السفلي" onClick={() => minimizeSection(s.id)}>🗕 تصغير</button>
          </div>
          <WindowedContext.Provider value={true}>{s.node}</WindowedContext.Provider>
        </div>
      ))}
    </>
  );
}
