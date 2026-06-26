'use client';

import { useRef } from 'react';

export function parsePlate(plate?: string | null): { letters: string[]; numbers: string } {
  if (!plate) return { letters: ['', '', ''], numbers: '' };
  const parts = plate.split(' ');
  const letters = parts.slice(0, 3).map((p) => (p.length === 1 ? p : ''));
  const hasLetters = letters.some(Boolean);
  const numbers = hasLetters ? (parts[3] ?? '') : (parts[0] ?? '');
  return { letters: [letters[0] ?? '', letters[1] ?? '', letters[2] ?? ''], numbers };
}

export function buildPlate(letters: string[], numbers: string): string | undefined {
  return [...letters.map((s) => s.trim()).filter(Boolean), numbers.trim()].filter(Boolean).join(' ') || undefined;
}

interface LetterBoxesProps {
  value: string[];
  onChange: (v: string[]) => void;
  onLastFilled?: () => void;
}

function LetterBoxes({ value, onChange, onLastFilled }: LetterBoxesProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          maxLength={1}
          value={value[i]}
          onChange={(e) => {
            const ch = e.target.value.replace(/[^a-zA-Zأ-ي]/g, '');
            onChange(value.map((x, j) => (j === i ? ch : x)));
            if (ch) {
              if (i < 2) refs.current[i + 1]?.focus();
              else onLastFilled?.();
            }
          }}
          style={{ width: 38, textAlign: 'center', padding: '11px 4px' }}
        />
      ))}
    </div>
  );
}

interface PlateInputProps {
  letters: string[];
  numbers: string;
  onLettersChange: (v: string[]) => void;
  onNumbersChange: (v: string) => void;
  numRef?: React.RefObject<HTMLInputElement>;
}

export function PlateInput({ letters, numbers, onLettersChange, onNumbersChange, numRef }: PlateInputProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = numRef ?? localRef;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <LetterBoxes value={letters} onChange={onLettersChange} onLastFilled={() => ref.current?.focus()} />
      <input
        ref={ref}
        placeholder="أرقام"
        inputMode="numeric"
        maxLength={4}
        value={numbers}
        onChange={(e) => onNumbersChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        style={{ width: 100 }}
      />
    </div>
  );
}
