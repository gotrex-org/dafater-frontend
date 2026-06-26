'use client';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** Pill toggle group, e.g. sale/purchase or client/supplier. */
export function SegmentedControl<V extends string>({ options, value, onChange }: Props<V>) {
  return (
    <div className="card" style={{ display: 'flex', overflow: 'hidden' }}>
      {options.map((o) => (
        <button
          key={o.value}
          className={`btn btn-sm ${value === o.value ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
