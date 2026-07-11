'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { WindowedContext } from './windowed';

interface UnsavedCtx {
  isDirty: boolean;
  setDirty: (v: boolean) => void;
}

const Ctx = createContext<UnsavedCtx>({ isDirty: false, setDirty: () => {} });

export function UnsavedProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return <Ctx.Provider value={{ isDirty, setDirty }}>{children}</Ctx.Provider>;
}

export function useUnsaved() {
  return useContext(Ctx);
}

export function useWarnOnLeave(isDirty: boolean) {
  const { setDirty } = useUnsaved();
  // A windowed editor survives navigation on purpose — don't flag the app as dirty.
  const windowed = useContext(WindowedContext);
  useEffect(() => {
    setDirty(isDirty && !windowed);
    return () => setDirty(false);
  }, [isDirty, windowed, setDirty]);
}
