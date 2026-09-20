'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { WindowedContext, SectionActiveContext } from './windowed';

// Window manager mounted once at the app root. Two kinds of windows:
//  • Sections (كشف الحساب، الإدخال اليومي …): render INLINE as normal full pages.
//  • Editors (فاتورة، بيع خارجي، مرتجع…): open as an overlay window on top.
//
// Both behave like browser tabs: they stay mounted — with everything you typed, the row
// you opened, the filter you set — until you actually close them (×). تصغير just sends a
// window to the background; it never throws it away.
//
// A section can be open more than once. Clicking its tab in the top nav:
//   • القسم ظاهر قدامك دلوقتي     → مفيش حاجة تحصل
//   • مفتوح في الخلفية (مش مصغّر) → بيرجع لقدام
//   • كله مصغّر (أو مش مفتوح)      → بيفتح نسخة جديدة
// يعني تقدر تفتح كشف حساب، تصغّره، وتفتح كشف حساب تاني جنبه — والاتنين يفضلوا في
// شريط التابات تحت لحد ما تقفلهم.

interface EditorWin { id: string; title: string; render: (close: () => void) => ReactNode; }
interface SectionWin { id: string; view: string; title: string; href: string; node: ReactNode; }
interface SectionSpec { view: string; title: string; href: string; node: ReactNode }

interface WindowsCtx {
  // editors (overlay)
  open: (opts: { id?: string; title: string; render: (close: () => void) => ReactNode }) => void;
  close: (id: string) => void;
  // sections (inline)
  /** فتح/الرجوع لقسم حسب قاعدة التابات فوق — ده اللي بيتنادى من النافبار والراوتر. */
  navigateSection: (s: SectionSpec) => void;
  /** نسخة جديدة من القسم دايمًا، حتى لو فيه واحدة مفتوحة. */
  newSection: (s: SectionSpec) => void;
  minimizeSection: (id: string) => void;
  restoreSection: (id: string) => void;
  closeSection: (id: string) => void;
  sections: SectionWin[];
  activeSectionId: string | null;
  /** القسم الظاهر دلوقتي (المفتاح مش الـ id) — عشان النافبار يعلّم عليه. */
  activeSectionView: string | null;
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

  // Mirrors of the committed state, so the callbacks below can decide what to do
  // (focus vs. open a new tab) without going stale inside an event handler.
  const sectionsRef = useRef(sections); sectionsRef.current = sections;
  const activeRef = useRef(activeSectionId); activeRef.current = activeSectionId;
  const minRef = useRef(minimizedSectionIds); minRef.current = minimizedSectionIds;
  const editorFgRef = useRef(editorFg); editorFgRef.current = editorFg;

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
  const mount = useCallback((s: SectionSpec) => {
    const id = `${s.view}#${++_seq}`;
    setSections((list) => [...list, { id, ...s }]);
    setMinimizedSectionIds((ids) => ids.filter((x) => x !== id));
    setActiveSectionId(id);
    setEditorFg(null); // a section coming to the front closes any editor overlay over it
  }, []);

  const focus = useCallback((id: string) => {
    setMinimizedSectionIds((ids) => ids.filter((x) => x !== id));
    setActiveSectionId(id);
    setEditorFg(null);
  }, []);

  const newSection = useCallback((s: SectionSpec) => mount(s), [mount]);

  const navigateSection = useCallback((s: SectionSpec) => {
    const mine = sectionsRef.current.filter((x) => x.view === s.view);
    // ظاهر قدامك بالفعل — سيبه زي ما هو (ومتفتحش نسخة كل ما تدوس على نفس التاب)
    if (!editorFgRef.current && mine.some((x) => x.id === activeRef.current)) return;
    // مفتوح في الخلفية ومش مصغّر → رجّعه لقدام (آخر واحد استعملته)
    const inBackground = [...mine].reverse().find((x) => !minRef.current.includes(x.id));
    if (inBackground) return focus(inBackground.id);
    // مفيش غير نسخ مصغّرة (أو ولا نسخة) → نسخة جديدة، والمصغّرة تفضل في مكانها
    mount(s);
  }, [focus, mount]);

  const minimizeSection = useCallback((id: string) => {
    setMinimizedSectionIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setActiveSectionId((cur) => (cur === id ? null : cur));
  }, []);
  const restoreSection = useCallback((id: string) => focus(id), [focus]);
  const closeSection = useCallback((id: string) => {
    setSections((list) => list.filter((x) => x.id !== id));
    setMinimizedSectionIds((ids) => ids.filter((x) => x !== id));
    setActiveSectionId((cur) => (cur === id ? null : cur));
  }, []);

  const activeSectionView = sections.find((s) => s.id === activeSectionId)?.view ?? null;

  // ── the tab strip ──
  // Numbered only where it's needed: a second كشف حساب reads «كشف الحساب (2)».
  const countByView = new Map<string, number>();
  for (const s of sections) countByView.set(s.view, (countByView.get(s.view) ?? 0) + 1);
  const seenByView = new Map<string, number>();
  const tabs = [
    ...sections.map((s) => {
      const n = (seenByView.get(s.view) ?? 0) + 1;
      seenByView.set(s.view, n);
      return {
        id: s.id,
        icon: '🗔',
        label: (countByView.get(s.view) ?? 1) > 1 ? `${s.title} (${n})` : s.title,
        active: !editorFg && s.id === activeSectionId,
        onOpen: () => focus(s.id),
        onClose: () => closeSection(s.id),
      };
    }),
    ...editors.map((e) => ({
      id: e.id,
      icon: '🧾',
      label: e.title,
      active: e.id === editorFg,
      onOpen: () => setEditorFg(e.id),
      onClose: () => close(e.id),
    })),
  ];
  // تاب واحد ظاهر قدامك مش محتاج شريط — الشريط بيبان أول ما يبقى فيه أكتر من نافذة
  // أو نافذة واحدة مصغّرة مستنياك.
  const showTabs = tabs.length > 1 || tabs.some((t) => !t.active);

  return (
    <Ctx.Provider value={{
      open, close, navigateSection, newSection, minimizeSection, restoreSection, closeSection,
      sections, activeSectionId, activeSectionView, minimizedSectionIds,
    }}>
      {children}

      {/* Editor overlays — foreground visible, others mounted but hidden */}
      {editors.map((w) => (
        <div key={w.id} className="draft-overlay" style={{ display: w.id === editorFg ? 'flex' : 'none' }}>
          <div className="draft-overlay-inner">
            <div className="win-chrome">
              <span className="win-title">{w.title}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" title="تصغير — النافذة تفضل مفتوحة في الشريط تحت" onClick={() => setEditorFg(null)}>−</button>
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

      {/* Tab strip — every open window, foreground or not, until you close it */}
      {showTabs && (
        <div className="draft-dock">
          {tabs.map((t) => (
            <div key={t.id} className={t.active ? 'draft-chip is-active' : 'draft-chip'} title={t.label}>
              <button className="draft-chip-open" onClick={t.onOpen}>
                <span className="draft-chip-icon">{t.icon}</span>
                <span className="draft-chip-label">{t.label}</span>
              </button>
              <button className="draft-chip-x" title="إغلاق" onClick={t.onClose}>×</button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

// Renders the section windows inline in the page flow — the active one is shown as a
// normal full page; the rest stay mounted but hidden, so switching back is instant and
// nothing you typed is lost.
export function SectionOutlet() {
  const { sections, activeSectionId, minimizeSection, closeSection } = useWindows();
  return (
    <>
      {sections.map((s) => (
        <div key={s.id} style={{ display: s.id === activeSectionId ? 'block' : 'none' }}>
          <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 4, gap: 4 }}>
            <button className="btn btn-ghost btn-sm" title="تصغير — القسم يفضل مفتوح في شريط التابات تحت" onClick={() => minimizeSection(s.id)}>−</button>
            <button className="btn btn-ghost btn-sm" title="إغلاق القسم" onClick={() => closeSection(s.id)}>✕</button>
          </div>
          <WindowedContext.Provider value={true}>
            <SectionActiveContext.Provider value={s.id === activeSectionId}>{s.node}</SectionActiveContext.Provider>
          </WindowedContext.Provider>
        </div>
      ))}
    </>
  );
}
