'use client';

import { createContext, useContext } from 'react';

// True while a component is being rendered inside a minimizable window (see
// WindowsProvider). Editors read this to suppress their "unsaved data — leave?"
// navigation guard: a windowed editor is *meant* to survive navigation (it stays
// mounted at the app root and can be minimized), so blocking navigation would defeat
// the whole point — nothing is lost by leaving.
export const WindowedContext = createContext(false);
export const useWindowed = () => useContext(WindowedContext);

// True only for the window the user is actually looking at. Every open section stays
// mounted (that's what keeps its state alive while it sits in the tab strip), so effects
// that touch shared/global state — a class on <body>, a keyboard shortcut, a title —
// must stay quiet in the background windows, and must not step on each other when the
// same section is open in two tabs.
export const SectionActiveContext = createContext(true);
export const useSectionActive = () => useContext(SectionActiveContext);
