import type { CSSProperties } from 'react';
import type { PieSlice } from '@/lib/budget';
import { chartColours } from '@/components/CupReportPaper';

// Charts for the AGM report's white paper (AGM-1 to AGM-4). Every bar carries its own number, so the
// report still reads printed in black and white, and the tables below them stay the full record.

export const AGM_CHART_CSS = `
.agm-chart { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px 12px; margin: 0 0 1rem; break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.agm-chart h4 { font-size: .86rem; font-weight: 800; color: #0f172a; margin: 0 0 .4rem; }
.agm-key { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .75rem; color: #64748b; margin: 0 0 10px; }
.agm-key i, .agm-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.agm-rows { display: grid; gap: 12px; margin: 0; }
.agm-row { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr); gap: 4px 12px; align-items: center; }
.agm-row dt { font-weight: 700; font-size: .84rem; grid-row: span 2; }
.agm-row dt small { display: block; font-weight: 600; font-size: .72rem; color: #64748b; }
.agm-row dt small.is-good { color: #15803d; } .agm-row dt small.is-bad { color: #b91c1c; }
.agm-row.is-one dt { grid-row: auto; }
.agm-row dd { margin: 0; }
.agm-bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.agm-bar span { height: 16px; border-radius: 0 4px 4px 0; flex: none; min-width: 2px; }
.agm-bar b { font-size: .78rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
.agm-bar.is-last b { font-weight: 600; color: #64748b; }
.agm-share + .agm-share { margin-top: 16px; }
.agm-stack { display: flex; height: 30px; border-radius: 6px; overflow: hidden; gap: 2px; }
.agm-stack span { display: grid; place-items: center; color: #fff; font-size: .72rem; font-weight: 800; min-width: 3px; overflow: hidden; white-space: nowrap; }
.agm-stack span.is-pale { color: #0f172a; }
.agm-legend { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; font-size: .8rem; }
.agm-legend li { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto 2.6rem; gap: 8px; align-items: center; border-bottom: 1px dotted #e2e8f0; padding: 2px 0; }
.agm-legend i { width: 12px; height: 12px; border-radius: 3px; margin: 0; }
.agm-legend b { font-variant-numeric: tabular-nums; font-weight: 700; }
.agm-legend em { font-style: normal; color: #64748b; text-align: right; font-variant-numeric: tabular-nums; }
.agm-months { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: 6px; align-items: end; height: 190px; border-bottom: 1px solid #94a3b8; padding-top: 8px; }
.agm-month { display: grid; grid-template-rows: 1fr auto; height: 100%; min-width: 0; }
.agm-cols { display: flex; align-items: flex-end; justify-content: center; gap: 3px; height: 100%; }
.agm-col { width: min(22px, 42%); position: relative; height: calc(var(--v) * 100%); border-radius: 3px 3px 0 0; min-height: 2px; }
.agm-col b, .agm-mname { display: none; }
.agm-mlabels { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: 6px; font-size: .72rem; color: #64748b; text-align: center; margin-top: 4px; }
.agm-mlabels span { display: grid; gap: 1px; min-width: 0; }
.agm-mlabels i { font-style: normal; font-size: .64rem; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; }
.agm-mlabels .is-hi, .agm-mname.is-hi { color: #0f172a; font-weight: 800; }
.agm-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin: 10px 0 0; font-size: .8rem; }
.agm-facts dt { font-size: .72rem; color: #64748b; font-weight: 700; }
.agm-facts dd { margin: 0; }
.agm-wdl { display: flex; height: 30px; border-radius: 6px; overflow: hidden; gap: 2px; }
.agm-wdl span { display: grid; place-items: center; font-size: .76rem; font-weight: 800; white-space: nowrap; overflow: hidden; }
@media (max-width: 560px) {
  .agm-row { grid-template-columns: minmax(0, 1fr); }
  .agm-row dt { grid-row: auto; display: flex; justify-content: space-between; gap: 8px; }
  .agm-legend, .agm-facts { grid-template-columns: minmax(0, 1fr); }
  .agm-stack span.is-narrow { font-size: 0; }
  .agm-wdl span { font-size: .68rem; }
  /* Months become rows: the month, then a bar for in and a bar for out */
  .agm-months { grid-template-columns: minmax(0, 1fr); height: auto; border-bottom: 0; padding-top: 0; gap: 8px; }
  .agm-month { grid-template-columns: 2.4rem minmax(0, 1fr); grid-template-rows: auto; align-items: center; height: auto; }
  .agm-mname { display: block; font-size: .76rem; font-weight: 700; color: #64748b; }
  .agm-cols { display: grid; gap: 3px; height: auto; justify-content: stretch; }
  .agm-col { height: 12px; width: auto; max-width: calc(var(--v) * (100% - 3.8rem)); border-radius: 0 3px 3px 0; }
  .agm-col b { display: block; position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); font-size: .7rem; white-space: nowrap; }
  .agm-mlabels { display: none; }
}
`;

/** Money in (the club's colour) and money out (a dark slate, or the cup report's second colour when the club's is already dark) */
export function agmColours(club?: string | null): { inn: string; out: string } {
  const { us, them } = chartColours(club);
  return { inn: us, out: us === '#0f172a' ? them : '#334155' };
}

const LAST = '#cbd5e1';
const shade = (base: string, i: number) => `color-mix(in srgb, ${base} ${[100, 78, 58, 40, 26][i] ?? 26}%, #fff)`;
const width = (part: number, top: number, room: string) => `calc(${top > 0 ? Math.max(0, part) / top : 0} * (100% - ${room}))`;

/** AGM-1: this season against the one before */
export function AgmVersus({ season, previous, rows, money }: {
  season: string; previous: string;
  rows: { label: string; now: number; last: number; colour: string; spend?: boolean }[];
  money: (cents: number) => string;
}) {
  const top = Math.max(1, ...rows.flatMap(r => [r.now, r.last]));
  const change = (r: (typeof rows)[number]) => {
    if (r.label === 'Surplus') return { text: `${money(Math.abs(r.now - r.last))} ${r.now >= r.last ? 'more' : 'less'} than ${previous}`, good: r.now >= r.last };
    if (!r.last) return null;
    const p = Math.round(((r.now - r.last) / Math.abs(r.last)) * 100);
    return { text: p === 0 ? `Same as ${previous}` : `${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} than ${previous}`, good: r.spend ? p <= 0 : p >= 0 };
  };
  return (
    <figure className="agm-chart" style={{ margin: '0 0 1rem' }}>
      <h4>{season} against {previous}</h4>
      <div className="agm-key" aria-hidden="true"><span><i style={{ background: rows[0]?.colour }} />{season}</span><span><i style={{ background: LAST }} />{previous}</span></div>
      <dl className="agm-rows">
        {rows.map(r => {
          const c = change(r);
          return (
            <div key={r.label} className="agm-row" aria-label={`${r.label}: ${money(r.now)} in ${season}, ${money(r.last)} in ${previous}`}>
              <dt>{r.label}{c && <small className={c.good ? 'is-good' : 'is-bad'}>{c.text}</small>}</dt>
              <dd className="agm-bar"><span style={{ width: width(r.now, top, '6.5rem'), background: r.now < 0 ? '#b91c1c' : r.colour }} /><b>{money(r.now)}</b></dd>
              <dd className="agm-bar is-last"><span style={{ width: width(r.last, top, '6.5rem'), background: LAST }} /><b>{money(r.last)}</b></dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}

/** AGM-2: one stacked bar of where money came from or went, biggest five then everything else */
export function AgmShare({ title, slices, base, money }: { title: string; slices: PieSlice[]; base: string; money: (cents: number) => string }) {
  const colour = (s: PieSlice, i: number) => (s.key === '__other' ? '#e2e8f0' : shade(base, i));
  const pale = (s: PieSlice, i: number) => s.key === '__other' || i >= 3;
  const pct = (s: PieSlice) => Math.round(s.percent);
  return (
    <div className="agm-share">
      <h4>{title}</h4>
      <div className="agm-stack" role="img" aria-label={`${title}: ${slices.map(s => `${s.label} ${pct(s)}%`).join(', ')}`}>
        {slices.map((s, i) => (
          <span key={s.key} className={`${pale(s, i) ? 'is-pale' : ''} ${pct(s) < 9 ? 'is-narrow' : ''}`} style={{ flex: s.cents, background: colour(s, i) }}>{pct(s) >= 6 ? `${pct(s)}%` : ''}</span>
        ))}
      </div>
      <ul className="agm-legend">
        {slices.map((s, i) => (
          <li key={s.key}><i style={{ background: colour(s, i), boxShadow: pale(s, i) ? 'inset 0 0 0 1px #cbd5e1' : undefined }} /><span>{s.label}</span><b>{money(s.cents)}</b><em>{pct(s)}%</em></li>
        ))}
      </ul>
    </div>
  );
}

/** AGM-3: money in and out each month. Columns on paper and wide screens, rows on a phone. */
export function AgmMonths({ months, colours, money, short }: {
  months: { month: string; label: string; inCents: number; outCents: number }[];
  colours: { inn: string; out: string };
  money: (cents: number) => string;
  /** Rounded, for the small labels */
  short: (cents: number) => string;
}) {
  const top = Math.max(1, ...months.flatMap(m => [m.inCents, m.outCents]));
  const most = (key: 'inCents' | 'outCents') => months.reduce((a, b) => (b[key] > a[key] ? b : a));
  const bestIn = most('inCents');
  const bestOut = most('outCents');
  const longName = (m: string) => new Date(`${m}T00:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const monthName = (m: string) => new Date(`${m}T00:00:00`).toLocaleDateString('en-AU', { month: 'long' });
  const over = months.filter(m => m.outCents > m.inCents);
  const totalIn = months.reduce((n, m) => n + m.inCents, 0);
  const totalOut = months.reduce((n, m) => n + m.outCents, 0);
  const hi = (m: string) => (m === bestIn.month && bestIn.inCents > 0) || (m === bestOut.month && bestOut.outCents > 0);
  const count = { '--count': months.length } as CSSProperties;
  return (
    <figure className="agm-chart" style={{ margin: '0 0 1rem' }}>
      <div className="agm-key" aria-hidden="true"><span><i style={{ background: colours.inn }} />Money in</span><span><i style={{ background: colours.out }} />Money out</span></div>
      <div className="agm-months" style={count}>
        {months.map(m => (
          <div key={m.month} className="agm-month" role="img" aria-label={`${longName(m.month)}: ${money(m.inCents)} in, ${money(m.outCents)} out`}>
            <span className={`agm-mname${hi(m.month) ? ' is-hi' : ''}`} aria-hidden="true">{m.label}</span>
            <div className="agm-cols" aria-hidden="true">
              <span className="agm-col" style={{ '--v': m.inCents / top, background: colours.inn } as CSSProperties}><b>{short(m.inCents)}</b></span>
              <span className="agm-col" style={{ '--v': m.outCents / top, background: colours.out, color: '#64748b' } as CSSProperties}><b>{short(m.outCents)}</b></span>
            </div>
          </div>
        ))}
      </div>
      <div className="agm-mlabels" style={count} aria-hidden="true">
        {months.map(m => (
          <span key={m.month} className={hi(m.month) ? 'is-hi' : undefined}>{m.label}<i style={{ color: colours.inn }}>{short(m.inCents)}</i><i style={{ color: colours.out }}>{short(m.outCents)}</i></span>
        ))}
      </div>
      <dl className="agm-facts">
        {bestIn.inCents > 0 && <div><dt>Most money in</dt><dd>{monthName(bestIn.month)}, {money(bestIn.inCents)}</dd></div>}
        {bestOut.outCents > 0 && <div><dt>Most money out</dt><dd>{monthName(bestOut.month)}, {money(bestOut.outCents)}</dd></div>}
        <div><dt>Months that spent more than came in</dt><dd>{over.length} of {months.length}{over.length ? `: ${over.map(m => m.label).join(', ')}` : ''}</dd></div>
        <div><dt>Average month</dt><dd>{money(Math.round(totalIn / months.length))} in, {money(Math.round(totalOut / months.length))} out</dd></div>
      </dl>
    </figure>
  );
}

/** AGM-4: won, drawn and lost as one bar, then goals for and against */
export function AgmRecord({ record, colours }: {
  record: { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number };
  colours: { inn: string; out: string };
}) {
  const parts = [['won', record.won, colours.inn, '#fff'], ['drawn', record.drawn, LAST, '#0f172a'], ['lost', record.lost, colours.out, '#fff']] as const;
  const top = Math.max(1, record.goalsFor, record.goalsAgainst);
  return (
    <figure className="agm-chart" style={{ margin: '0 0 1rem' }}>
      <h4>{record.played} club {record.played === 1 ? 'game' : 'games'}</h4>
      <div className="agm-wdl" role="img" aria-label={`${record.won} won, ${record.drawn} drawn, ${record.lost} lost`}>
        {parts.filter(([, n]) => n > 0).map(([word, n, bg, fg]) => <span key={word} style={{ flex: n, background: bg, color: fg }}>{n} {word}</span>)}
      </div>
      <dl className="agm-rows" style={{ gap: 6, marginTop: 14 }}>
        {([['Goals for', record.goalsFor, colours.inn], ['Goals against', record.goalsAgainst, colours.out]] as const).map(([label, n, colour]) => (
          <div key={label} className="agm-row is-one">
            <dt>{label}</dt>
            <dd className="agm-bar"><span style={{ width: width(n, top, '3rem'), background: colour }} /><b>{n}</b></dd>
          </div>
        ))}
      </dl>
      <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
        Won {Math.round((record.won / record.played) * 100)}% of games. {(record.goalsFor / record.played).toFixed(1)} goals scored and {(record.goalsAgainst / record.played).toFixed(1)} let in per game.
      </p>
    </figure>
  );
}
