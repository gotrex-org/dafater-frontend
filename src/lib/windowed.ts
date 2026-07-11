'use client';

import { createContext, useContext } from 'react';

// True while a component is being rendered inside a minimizable window (see
// WindowsProvider). Editors read this to suppress their "unsaved data — leave?"
// navigation guard: a windowed editor is *meant* to survive navigation (it stays
// mounted at the app root and can be minimized), so blocking navigation would defeat
// the whole point — nothing is lost by leaving.
export const WindowedContext = createContext(false);
export const useWindowed = () => useContext(WindowedContext);
