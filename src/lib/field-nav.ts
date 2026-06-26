import type { KeyboardEvent } from 'react';

/**
 * Move focus between form fields with the keyboard:
 *   Enter / ArrowDown → next field, ArrowUp → previous field.
 *
 * Attach to a form container: `<div onKeyDown={fieldNavKeyDown}>…</div>`.
 * Native behaviour is preserved where it matters: a <select> keeps Up/Down for
 * changing its option (only Enter advances it), a date input keeps Enter for its
 * picker, and a <textarea> keeps Enter for newlines.
 */
export function fieldNavKeyDown(e: KeyboardEvent<HTMLElement>) {
  const key = e.key;
  const forward = key === 'Enter' || key === 'ArrowDown';
  const back = key === 'ArrowUp';
  if (!forward && !back) return;

  const el = e.target as HTMLElement;
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'SELECT') return;

  // don't hijack a dropdown's option arrows, or a date input's Enter
  if (tag === 'SELECT' && key !== 'Enter') return;
  if ((el as HTMLInputElement).type === 'date' && key === 'Enter') return;

  const fields = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('input, select, textarea'),
  ).filter((f) => !(f as HTMLInputElement).disabled && f.offsetParent !== null);

  const i = fields.indexOf(el);
  if (i === -1) return;
  const target = fields[forward ? i + 1 : i - 1];
  if (!target) return;

  e.preventDefault();
  target.focus();
  if (target.tagName === 'INPUT') (target as HTMLInputElement).select?.();
}
