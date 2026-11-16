import type { CSSProperties } from 'react';
import type { CupReport, ReportGoals, ReportPoint } from '@/lib/cup-report';
import { PAPER_PRINT_CSS } from '@/lib/report-paper';

// The tournament report on white paper, the same on the admin page and behind a share link.
// Its styles travel with it (one <style> tag), so it looks the same wherever it is shown.

const THEIRS = '#2F5FB3';

/** Our colour and theirs for the goals graph: the club's own colour unless it would not read on white or next to the blue */
export function chartColours(club?: string | null): { us: string; them: string } {
  const hex = /^#[0-9a-f]{6}$/i.test(club || '') ? club! : '#0f172a';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Too pale for white paper: fall back to ink
  if (light > 0.6) return { us: '#0f172a', them: THEIRS };
  const d = max - min;
  const hue = d < 0.08 ? -1 : 60 * (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
  return { us: hex, them: hue >= 180 && hue <= 280 ? '#C2410C' : THEIRS };
}

/** "ANCC" stays whole; "Moore Park FC" becomes "MPF" */
export function crestInitials(club: string): string {
  const words = club.split(/\s+/).filter(Boolean);
  return (words.length === 1 ? words[0].slice(0, 4) : words.slice(0, 3).map(w => w[0]).join('')).toUpperCase() || 'FC';
}

/** The paper's look, shared with the event summary (components/EventReportPaper.tsx) */
export const REPORT_CSS = `
.cr-paper { --ink: #0f172a; --mut: #64748b; --rule: #e2e8f0; background: #fff; color: var(--ink); border-radius: 14px; padding: clamp(1.25rem, 5vw, 3rem); box-shadow: 0 20px 50px rgba(0,0,0,.35); font-size: .92rem; line-height: 1.45; max-width: 860px; margin: 0 auto; font-family: var(--font-body); text-align: left; }
.cr-paper h1, .cr-paper h2, .cr-paper h3 { font-family: var(--font-heading); color: var(--ink); margin: 0; letter-spacing: 0; }
.cr-paper h2 { font-size: 1.05rem; font-weight: 800; margin: 1.6rem 0 .5rem; break-after: avoid; }
.cr-head { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 2px solid var(--ink); }
.cr-crest { width: 54px; height: 54px; border-radius: 12px; background: var(--club); color: #fff; display: grid; place-items: center; font: 800 15px var(--font-heading); flex: none; object-fit: contain; }
img.cr-crest { background: none; }
.cr-head h1 { font-size: 1.55rem; font-weight: 800; line-height: 1.1; overflow-wrap: anywhere; }
.cr-head p { margin: 3px 0 0; color: var(--mut); font-size: .82rem; }
.cr-tag { margin-left: auto; align-self: flex-start; font-size: .7rem; font-weight: 700; color: var(--mut); border: 1px solid var(--rule); border-radius: 99px; padding: 2px 10px; white-space: nowrap; }
.cr-open { margin: 18px 0 0; font-size: 1.05rem; line-height: 1.55; }
.cr-games { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.cr-games li { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--rule); border-radius: 10px; min-width: 0; }
.cr-games b { font: 700 .95rem var(--font-heading); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cr-games span { min-width: 0; overflow-wrap: anywhere; font-size: .82rem; }
.cr-games small { display: block; color: var(--mut); font-size: .7rem; }
.cr-res { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font: 700 11px var(--font-body); color: #fff; flex: none; background: #64748b; }
.cr-res.is-W { background: #15803D; } .cr-res.is-L { background: #B91C1C; }
.cr-lead { margin: 0; padding: 2px 0 2px 14px; border-left: 4px solid var(--club); font-size: 1.02rem; line-height: 1.55; white-space: pre-line; }
.cr-lead cite { display: block; margin-top: 6px; font-style: normal; font-size: .8rem; color: var(--mut); }
.cr-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; }
.cr-pts { list-style: none; margin: 0; padding: 0; }
.cr-pts li { padding: .45rem 0; border-bottom: 1px solid var(--rule); display: flex; gap: 10px; align-items: baseline; }
.cr-pts li:last-child { border-bottom: 0; }
.cr-pts li > span:first-of-type { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cr-from { margin-left: auto; flex: none; color: var(--mut); font-size: .72rem; max-width: 40%; text-align: right; }
.cr-pts li::before { content: ''; width: 8px; height: 8px; flex: none; transform: translateY(-1px); }
.cr-pts.is-good li::before { border-radius: 50%; background: #15803D; }
.cr-pts.is-fix li::before { border-radius: 2px; background: #B45309; }
.cr-pts.is-todo li::before { width: 13px; height: 13px; border: 1.5px solid var(--ink); border-radius: 3px; box-sizing: border-box; transform: translateY(2px); }
.cr-chart { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 12px 28px; align-items: center; margin-top: 4px; }
.cr-bars { margin: 0; }
.cr-bars svg { display: block; width: 100%; height: auto; }
.cr-key { display: flex; gap: 16px; font-size: .78rem; margin-bottom: 4px; }
.cr-key span, .cr-pie span { display: inline-flex; align-items: center; gap: 6px; }
.cr-key i, .cr-pie i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.cr-cv { font: 700 12px var(--font-heading); fill: var(--ink); }
.cr-cx { font: 500 10px var(--font-body); fill: var(--mut); }
.cr-pies { display: grid; gap: 12px; }
.cr-pie { display: flex; align-items: center; gap: 12px; }
.cr-pie svg { width: 76px; height: 76px; flex: none; }
.cr-pie div { display: grid; gap: 2px; font-size: .8rem; }
.cr-pie b { font-size: .86rem; }
.cr-pn { font: 700 20px var(--font-heading); fill: var(--ink); }
.cr-small { color: var(--mut); font-size: .8rem; margin: .5rem 0 0; }
.cr-g { padding: .8rem 0; border-top: 1px solid var(--rule); break-inside: avoid; }
.cr-g-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.cr-g-head h3 { font-size: 1rem; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.cr-g-meta { color: var(--mut); font-size: .76rem; }
.cr-g-fact { margin: .4rem 0 0; }
.cr-g-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; margin-top: .5rem; }
.cr-g-notes p { margin: 0; padding: 8px 10px; border-radius: 8px; background: #f8fafc; font-size: .86rem; white-space: pre-line; overflow-wrap: anywhere; }
.cr-g-notes b { display: block; font-size: .7rem; color: var(--mut); font-weight: 700; margin-bottom: 2px; }
.cr-people { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 28px; margin: 0; }
.cr-people div { display: flex; justify-content: space-between; gap: 12px; padding: .4rem 0; border-bottom: 1px solid var(--rule); }
.cr-people dt { color: var(--mut); } .cr-people dd { margin: 0; font-weight: 700; text-align: right; max-width: 70%; }
.cr-mins { width: 100%; border-collapse: collapse; }
.cr-mins th { text-align: left; font-size: .72rem; color: var(--mut); font-weight: 700; padding: .4rem .5rem .4rem 0; border-bottom: 1px solid var(--rule); }
.cr-mins td { padding: .4rem .5rem .4rem 0; border-bottom: 1px solid var(--rule); }
.cr-mins .is-n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; width: 14%; }
.cr-mins td:last-child { width: 34%; padding-right: 0; }
.cr-mbar { height: 6px; border-radius: 3px; background: #eef2f7; overflow: hidden; }
.cr-mbar i { display: block; height: 100%; background: var(--club); border-radius: 3px; }
.cr-mbar.is-low i { background: #B45309; }
.cr-flag { font-size: .7rem; font-weight: 700; color: #B45309; background: #FEF3C7; border-radius: 99px; padding: 1px 8px; margin-left: 6px; white-space: nowrap; }
.cr-foot { margin-top: 1.8rem; padding-top: 10px; border-top: 1px solid var(--rule); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; color: var(--mut); font-size: .74rem; }
/* Event summary: figures in a row, names in columns */
.cr-figs { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); margin: 16px 0 0; border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; }
.cr-figs div { padding: 10px 8px; text-align: center; box-shadow: -1px 0 0 var(--rule); }
.cr-figs dd { margin: 0; font: 700 1.5rem var(--font-heading); font-variant-numeric: tabular-nums; }
.cr-figs dt { font-size: .7rem; color: var(--mut); }
.cr-names { columns: 3; column-gap: 24px; margin: 0; padding: 0; list-style: none; font-size: .86rem; }
.cr-names li { padding: .2rem 0; break-inside: avoid; }
@media (max-width: 40rem) {
  .cr-names { columns: 2; }
  .cr-games, .cr-cols, .cr-people, .cr-g-notes, .cr-chart { grid-template-columns: minmax(0, 1fr); }
  .cr-tag { display: none; }
  .cr-pies { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cr-pie { flex-direction: column; align-items: flex-start; }
}
@media print { .cr-paper * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

function Points({ items, kind }: { items: ReportPoint[]; kind: 'good' | 'fix' | 'todo' }) {
  return (
    <ul className={`cr-pts is-${kind}`}>
      {items.map((p, i) => <li key={i}><span>{p.text}</span><span className="cr-from">{p.from}</span></li>)}
    </ul>
  );
}

/** Goals for and against in each quarter of the game, side by side, with the count on each bar */
function GoalBars({ goals, us, them }: { goals: ReportGoals; us: string; them: string }) {
  const top = Math.max(1, ...goals.blocks.flatMap(b => [b.us, b.them]));
  const [base, height] = [128, 102];
  const y = (n: number) => base - (n / top) * height;
  // At most five grid lines, on whole goals
  const step = Math.ceil(top / 5);
  const ticks = Array.from({ length: Math.floor(top / step) }, (_, i) => (i + 1) * step);
  const bar = (x: number, n: number, fill: string) => (n > 0
    ? <><path d={`M${x},${base} V${y(n) + 4} q0,-4 4,-4 h28 q4,0 4,4 V${base} z`} fill={fill} /><text x={x + 18} y={y(n) - 6} textAnchor="middle" className="cr-cv">{n}</text></>
    : <text x={x + 18} y={base - 6} textAnchor="middle" className="cr-cv">0</text>);
  return (
    <figure className="cr-bars">
      <div className="cr-key"><span><i style={{ background: us }} />We scored</span><span><i style={{ background: them }} />They scored</span></div>
      <svg viewBox="0 0 520 150" role="img" aria-label={`Goals in each quarter of the game. ${goals.blocks.map(b => `${b.label}: we scored ${b.us}, they scored ${b.them}`).join('. ')}.`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1="34" x2="514" y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x="26" y={y(t) + 4} textAnchor="end" className="cr-cx">{t}</text>
          </g>
        ))}
        <line x1="34" x2="514" y1={base} y2={base} stroke="#94a3b8" />
        {goals.blocks.map((b, i) => {
          const x = 57 + i * 120;
          return (
            <g key={i}>
              {bar(x, b.us, us)}
              {bar(x + 38, b.them, them)}
              <text x={x + 37} y="144" textAnchor="middle" className="cr-cx">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** One side's goals split by half */
function HalfDonut({ title, halves, colour }: { title: string; halves: [number, number]; colour: string }) {
  const total = halves[0] + halves[1];
  if (!total) return null;
  const round = 2 * Math.PI * 34;
  const first = (halves[0] / total) * round;
  // A small gap between the two halves when both have goals
  const gap = halves[0] && halves[1] ? 3 : 0;
  const ring = (length: number, offset: number, opacity: number) => length > 0 && (
    <circle cx="48" cy="48" r="34" fill="none" stroke={colour} strokeOpacity={opacity} strokeWidth="14"
      strokeDasharray={`${Math.max(0, length - gap)} ${round}`} strokeDashoffset={-offset} transform="rotate(-90 48 48)" />
  );
  return (
    <div className="cr-pie">
      <svg viewBox="0 0 96 96" role="img" aria-label={`${title}: ${halves[0]} in the first half, ${halves[1]} in the second half`}>
        {ring(first, 0, 0.35)}
        {ring(round - first, first, 1)}
        <text x="48" y="54" textAnchor="middle" className="cr-pn">{total}</text>
      </svg>
      <div>
        <b>{title}</b>
        <span><i style={{ background: colour, opacity: 0.35 }} />First half {halves[0]}</span>
        <span><i style={{ background: colour }} />Second half {halves[1]}</span>
      </div>
    </div>
  );
}

export default function CupReportPaper({ report, colour, logoUrl, footer }: {
  report: CupReport;
  /** The club's main colour */
  colour?: string | null;
  logoUrl?: string | null;
  /** "Made on 30 November 2026" */
  footer: string;
}) {
  const colours = chartColours(colour);
  const initials = crestInitials(report.club);
  const coach = !!report.minutes || !!report.next;
  const goalCount = (halves: [number, number]) => halves[0] + halves[1];
  return (
    <article className="agm-paper cr-paper" style={{ '--club': colours.us } as CSSProperties}>
      <style>{REPORT_CSS + PAPER_PRINT_CSS}</style>
      <header className="cr-head">
        {logoUrl
          ? <img className="cr-crest" src={logoUrl} alt="" width={54} height={54} />
          : <div className="cr-crest" aria-hidden="true">{initials}</div>}
        <div>
          <h1>{report.cup}</h1>
          <p>{[report.team || report.club, report.dates, report.venue].filter(Boolean).join(' · ')}</p>
        </div>
        <span className="cr-tag">{coach ? 'Coaches and committee' : 'For the squad'}</span>
      </header>

      <p className="cr-open">{report.opening}</p>
      {report.games.length > 0 && (
        <ul className="cr-games">
          {report.games.map(g => (
            <li key={g.id}>
              {g.outcome && <span className={`cr-res is-${g.outcome}`}>{g.outcome}</span>}
              <b>{g.score}</b>
              <span>{g.outcome ? g.opponent : g.title.replace(` ${g.score} `, ' v ')}<small>{g.when}</small></span>
            </li>
          ))}
        </ul>
      )}

      {report.summary && (
        <>
          <h2>From the coach</h2>
          <blockquote className="cr-lead">
            {report.summary}
            {report.by && <cite>{report.by}</cite>}
          </blockquote>
        </>
      )}

      {(report.wentWell.length > 0 || report.workOn.length > 0) && (
        <div className="cr-cols">
          {report.wentWell.length > 0 && <section><h2>What we did well</h2><Points items={report.wentWell} kind="good" /></section>}
          {report.workOn.length > 0 && <section><h2>What we need to work on</h2><Points items={report.workOn} kind="fix" /></section>}
        </div>
      )}

      {report.goals && (
        <section>
          <h2>When the goals came</h2>
          <div className="cr-chart">
            <GoalBars goals={report.goals} us={colours.us} them={colours.them} />
            <div className="cr-pies">
              <HalfDonut title={`Our ${goalCount(report.goals.us)} ${goalCount(report.goals.us) === 1 ? 'goal' : 'goals'}`} halves={report.goals.us} colour={colours.us} />
              <HalfDonut title={`Their ${goalCount(report.goals.them)} ${goalCount(report.goals.them) === 1 ? 'goal' : 'goals'}`} halves={report.goals.them} colour={colours.them} />
            </div>
          </div>
          {report.goals.line && <p className="cr-small">{report.goals.line}</p>}
        </section>
      )}

      {report.games.length > 0 && (
        <>
          <h2>Game by game</h2>
          {report.games.map(g => (
            <section key={g.id} className="cr-g">
              <div className="cr-g-head">
                {g.outcome && <span className={`cr-res is-${g.outcome}`}>{g.outcome}</span>}
                <h3>{g.title}</h3>
                <span className="cr-g-meta">{g.when}</span>
              </div>
              {g.fact && <p className="cr-g-fact">{g.fact}</p>}
              {(g.wentWell || g.workOn) && (
                <div className="cr-g-notes">
                  {g.wentWell && <p><b>Went well</b>{g.wentWell}</p>}
                  {g.workOn && <p><b>To work on</b>{g.workOn}</p>}
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {report.players.length > 0 && (
        <>
          <h2>Players</h2>
          <dl className="cr-people">
            {report.players.map(p => <div key={p.label}><dt>{p.label}</dt><dd>{p.value}</dd></div>)}
          </dl>
        </>
      )}

      {report.minutes && (
        <section>
          <h2>Who played, and for how long</h2>
          {report.minutes.line && <p className="cr-small" style={{ margin: '0 0 .5rem' }}>{report.minutes.line}</p>}
          <table className="cr-mins">
            <thead><tr><th>Player</th><th className="is-n">Games</th><th className="is-n">Minutes</th><th aria-hidden="true" /></tr></thead>
            <tbody>
              {report.minutes.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}{r.underHalf && <span className="cr-flag">Under half</span>}</td>
                  <td className="is-n">{r.games}</td>
                  <td className="is-n">{r.minutes}&apos;</td>
                  <td aria-hidden="true"><div className={`cr-mbar${r.underHalf ? ' is-low' : ''}`}><i style={{ width: `${Math.min(100, (r.minutes / (report.minutes!.total || 1)) * 100)}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!!report.next?.length && (
        <section>
          <h2>What we&apos;ll do next</h2>
          <Points items={report.next} kind="todo" />
        </section>
      )}

      <footer className="cr-foot">
        <span>{footer}</span>
        <span>itsfootball.club</span>
      </footer>
    </article>
  );
}
