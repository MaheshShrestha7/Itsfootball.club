'use client';

import React, { useState } from 'react';
import type { PacePoint, PieSlice } from '@/lib/budget';

// Plain SVG, so there's no chart library to load. Hues and their order come from the validated palette
// in the dataviz method (checked for colour blindness in both themes). Every value is also written out
// beside or under the chart, so nothing relies on hovering or on telling colours apart.

export const CHART_STYLES = `
  .budget-viz {
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500; --series-5: #d55181; --series-6: #008300;
    --viz-grid: color-mix(in oklab, var(--text-muted) 25%, transparent);
    --viz-pace: var(--text-muted);
  }
  [data-theme='light'] .budget-viz {
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100; --series-5: #e87ba4; --series-6: #008300;
  }
  .budget-viz text { fill: var(--text-muted); font-size: 11px; }
  .budget-viz .is-axis { stroke: var(--viz-grid); }
  .budget-viz-tip { position: absolute; pointer-events: none; z-index: 2; background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: 8px; padding: 0.4rem 0.6rem; font-size: 0.78rem; white-space: nowrap; color: var(--text-secondary); }
  .budget-viz-tip b { color: var(--text-primary); }
  .budget-viz-key { display: inline-block; width: 14px; height: 0; border-top: 2px solid; vertical-align: middle; margin-right: 0.35rem; }
  .budget-viz path.is-slice:focus-visible, .budget-viz:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 1px; }
  @media (max-width: 480px) {
    .budget-figures .admin-dash-figures { grid-template-columns: 1fr; }
  }
  /* On a phone each row is a small card, so the position isn't scrolled out of sight */
  @media (max-width: 640px) {
    .budget-table, .budget-table tbody { display: block; }
    .budget-table thead { display: none; }
    .budget-table tr { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-medium); }
    .budget-table td { display: block; padding: 0; border: 0; min-width: 0 !important; text-align: left; }
    .budget-table td:first-child, .budget-table td:last-child, .budget-table td[colspan] { grid-column: 1 / -1; }
    .budget-table td[data-label]::before { content: attr(data-label); display: block; font-size: 0.75rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.2rem; }
    .budget-table input { margin-left: 0 !important; width: 100% !important; }
  }
`;

const W = 560;
const H = 220;
const PAD = { left: 56, right: 12, top: 12, bottom: 24 };

/** Round numbers for the axis, in dollars */
function ticks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= rough) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001 || out.length < 2; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/** "So far" against an even spread of the budget. One axis, two lines, crosshair and a readout for each month. */
export function PaceChart({ title, points, money, actualName = 'Actual so far' }: { title: string; points: PacePoint[]; money: (cents: number) => string; actualName?: string }) {
  const [at, setAt] = useState<number | null>(null);
  const top = Math.max(1, ...points.map(p => Math.max(p.pace, p.actual ?? 0)));
  const grid = ticks(top);
  const yMax = grid[grid.length - 1] || 1;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * (W - PAD.left - PAD.right) : 0);
  const y = (v: number) => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom);
  const line = (vals: (number | null)[]) => vals.map((v, i) => (v === null ? '' : `${i === 0 || vals[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(' ');
  const lastActual = points.reduce((n, p, i) => (p.actual !== null ? i : n), -1);
  const shown = at ?? (lastActual >= 0 ? lastActual : null);
  const everyOther = points.length > 8;
  const summary = lastActual >= 0
    ? `${title}. ${actualName}: ${money(points[lastActual].actual ?? 0)} by ${points[lastActual].label}, against ${money(points[lastActual].pace)} on an even budget.`
    : `${title}. Nothing yet.`;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
    setAt(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <figure className="budget-viz" style={{ margin: 0, position: 'relative' }}>
      <figcaption style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{title}</figcaption>
      <div className="text-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem', marginBottom: '0.25rem' }}>
        <span><span className="budget-viz-key" style={{ borderColor: 'var(--series-1)' }} />{actualName}</span>
        <span><span className="budget-viz-key" style={{ borderColor: 'var(--viz-pace)', borderTopStyle: 'dashed' }} />Budget, spread evenly</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }}
        onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') setAt(Math.max(0, (shown ?? 0) - 1));
          else if (e.key === 'ArrowRight') setAt(Math.min(points.length - 1, (shown ?? -1) + 1));
        }}>
        {grid.map(v => (
          <g key={v}>
            <line className="is-axis" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end">{money(v).replace(/\.00$/, '')}</text>
          </g>
        ))}
        {points.map((p, i) => (!everyOther || i % 2 === 0 ? <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle">{p.label}</text> : null))}
        <path d={line(points.map(p => p.pace))} fill="none" stroke="var(--viz-pace)" strokeWidth={2} strokeDasharray="5 4" />
        <path d={line(points.map(p => p.actual))} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {shown !== null && (
          <g>
            <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--viz-pace)" strokeWidth={1} />
            {points[shown].actual !== null && <circle cx={x(shown)} cy={y(points[shown].actual!)} r={4} fill="var(--series-1)" stroke="var(--bg-surface-elevated)" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {shown !== null && (
        <div className="text-meta" role="status" style={{ marginTop: '0.25rem' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{points[shown].label}</strong>
          {': '}
          {points[shown].actual !== null ? <>{money(points[shown].actual!)} so far, </> : 'still to come, '}
          {money(points[shown].pace)} on an even budget
        </div>
      )}
      <details style={{ marginTop: '0.35rem' }}>
        <summary className="text-meta" style={{ cursor: 'pointer' }}>See the figures</summary>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Month</th><th scope="col" className="is-num">{actualName}</th><th scope="col" className="is-num">Budget, spread evenly</th></tr></thead>
            <tbody>{points.map(p => <tr key={p.month}><td>{p.label}</td><td className="is-num">{p.actual === null ? '-' : money(p.actual)}</td><td className="is-num">{money(p.pace)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** A pie with a hole, and a legend that has every slice's name, amount and share */
export function BudgetPie({ title, slices, money }: { title: string; slices: PieSlice[]; money: (cents: number) => string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((n, s) => n + s.cents, 0);
  const R = 90;
  const r = 56;
  const C = 100;
  const gap = slices.length > 1 ? 0.012 : 0;
  const arc = (from: number, to: number) => {
    if (slices.length === 1) {
      return `M${C},${C - R} A${R},${R} 0 1 1 ${C - 0.01},${C - R} L${C - 0.01},${C - r} A${r},${r} 0 1 0 ${C},${C - r} Z`;
    }
    const p = (t: number, rad: number) => `${(C + rad * Math.sin(t * 2 * Math.PI)).toFixed(2)},${(C - rad * Math.cos(t * 2 * Math.PI)).toFixed(2)}`;
    const big = to - from > 0.5 ? 1 : 0;
    return `M${p(from, R)} A${R},${R} 0 ${big} 1 ${p(to, R)} L${p(to, r)} A${r},${r} 0 ${big} 0 ${p(from, r)} Z`;
  };
  const parts = slices.map((s, i) => {
    const from = slices.slice(0, i).reduce((n, x) => n + x.cents, 0) / (total || 1);
    const end = from + s.cents / (total || 1);
    return { ...s, from: from + gap / 2, to: Math.max(from + gap / 2 + 0.001, end - gap / 2), color: `var(--series-${(i % 6) + 1})` };
  });
  const focus = parts.find(p => p.key === active);
  return (
    <figure className="budget-viz" style={{ margin: 0 }}>
      <figcaption style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{title}</figcaption>
      {slices.length === 0 ? <p className="text-meta" style={{ margin: 0 }}>Nothing recorded yet.</p> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <svg viewBox="0 0 200 200" role="img" aria-label={`${title}: ${slices.map(s => `${s.label} ${s.percent}%`).join(', ')}`} style={{ width: 170, height: 170, flexShrink: 0 }}>
            {parts.map(p => (
              <path key={p.key} className="is-slice" d={arc(p.from, p.to)} fill={p.color} tabIndex={0} aria-label={`${p.label}: ${money(p.cents)}, ${p.percent}%`}
                opacity={active && active !== p.key ? 0.45 : 1}
                onPointerEnter={() => setActive(p.key)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(p.key)} onBlur={() => setActive(null)} />
            ))}
            <text x={C} y={C - 4} textAnchor="middle" style={{ fontSize: 11 }}>{focus ? focus.label.slice(0, 18) : 'Total'}</text>
            <text x={C} y={C + 14} textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: 'var(--text-primary)' }}>{money(focus ? focus.cents : total).replace(/\.00$/, '')}</text>
          </svg>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 180px', display: 'grid', gap: '0.3rem', fontSize: '0.84rem', minWidth: 0 }}>
            {parts.map(p => (
              <li key={p.key} style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', color: 'var(--text-secondary)' }}
                onPointerEnter={() => setActive(p.key)} onPointerLeave={() => setActive(null)}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0, alignSelf: 'center' }} />
                <span style={{ flex: 1, minWidth: 0 }}>{p.label}</span>
                <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: 'var(--text-primary)' }}>{money(p.cents)}</b> {p.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}

/** Budget vs actual in a table row: the track is the budget, the fill what's happened. Words carry the meaning. */
export function BudgetMeter({ percent, over, label }: { percent: number | null; over: boolean; label: string }) {
  if (percent === null) return null;
  return (
    <div role="img" aria-label={label} style={{ height: 8, borderRadius: 4, background: 'color-mix(in oklab, var(--text-muted) 22%, transparent)', overflow: 'hidden', marginTop: '0.3rem', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, percent))}%`, borderRadius: 4, background: over ? 'var(--c-red)' : 'var(--series-1)' }} />
    </div>
  );
}
