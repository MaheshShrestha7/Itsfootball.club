'use client';

import React from 'react';
import { COVER_PRESETS, sameCover } from '@/lib/cover-presets';

/** Thumbnail grid of stock football covers; picking one calls onPick with the full-size URL */
export default function CoverPresetPicker({ value, onPick }: { value?: string; onPick: (url: string) => void }) {
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Or pick a preset:</span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
          gap: '0.35rem',
          marginTop: '0.3rem',
          maxHeight: '170px',
          overflowY: 'auto',
        }}
      >
        {COVER_PRESETS.map(p => {
          const selected = sameCover(value, p.url);
          return (
            <button
              key={p.url}
              type="button"
              onClick={() => onPick(p.url)}
              title={p.label}
              aria-label={`Use ${p.label} cover`}
              aria-pressed={selected}
              style={{
                padding: 0,
                aspectRatio: '16 / 10',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: selected ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.12)',
                background: `url(${p.thumb}) center/cover no-repeat, #1F2937`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
