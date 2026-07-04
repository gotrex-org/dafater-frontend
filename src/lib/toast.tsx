'use client';

// Global toast notifications. `toast.error/success/info(message)` can be called
// from anywhere — including outside React (e.g. the axios interceptor in api.ts) —
// via a small module-level pub/sub. <ToastProvider> (mounted once in the root
// layout) subscribes and renders the actual toasts.
import { useCallback, useEffect, useState, ReactNode } from 'react';

type ToastType = 'error' | 'success' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (item: ToastItem) => void;
let listeners: Listener[] = [];
let counter = 0;

function emit(type: ToastType, message: string) {
  listeners.forEach((listener) => listener({ id: ++counter, type, message }));
}

export const toast = {
  error: (message: string) => emit('error', message),
  success: (message: string) => emit('success', message),
  info: (message: string) => emit('info', message),
};

const DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  useEffect(() => {
    const listener: Listener = (item) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => dismiss(item.id), DURATION_MS);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, [dismiss]);

  return (
    <>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast toast-${item.type}`}
            role="alert"
            onClick={() => dismiss(item.id)}
          >
            {item.message}
          </div>
        ))}
      </div>
    </>
  );
}
