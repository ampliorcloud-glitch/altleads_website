/**
 * DensityToggle — a small 2-segment control (Comfortable / Compact) for list rows.
 *
 * Styled to match ViewSwitcher's segmented control so it sits cleanly beside it in
 * the toolbar. Compact packs ~40% more rows on screen (the "feels built for pros"
 * win). Accessible: each segment is a real button with aria-pressed + title.
 *
 * Props:
 *   value    the active density ('comfortable' | 'compact')
 *   onChange called with the next density when a segment is clicked
 */

import { Rows3, Rows4 } from 'lucide-react';
import type { Density } from './useDensity';

interface Props {
  value: Density;
  onChange: (next: Density) => void;
}

const OPTIONS: { key: Density; label: string; icon: React.ReactNode }[] = [
  { key: 'comfortable', label: 'Comfortable', icon: <Rows3 size={15} /> },
  { key: 'compact', label: 'Compact', icon: <Rows4 size={15} /> },
];

export function DensityToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Row density"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 32,
        padding: 2,
        gap: 2,
        background: '#F3F4F6',
        border: '1px solid #d4d4d8',
        borderRadius: 7,
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            aria-label={`${opt.label} density`}
            title={`${opt.label} density`}
            onClick={() => { if (!active) onChange(opt.key); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 26,
              width: 28,
              padding: 0,
              border: 'none',
              borderRadius: 5,
              background: active ? '#fff' : 'transparent',
              color: active ? '#1A7EE8' : '#6b7280',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              cursor: active ? 'default' : 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

export default DensityToggle;
