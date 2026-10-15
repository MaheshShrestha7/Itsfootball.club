'use client';

// The free equal playing time calculator at /tools/equal-playing-time-calculator: pick the format, match
// length and squad, type the names, and get a substitution schedule that gives everyone the same minutes.
// No login and nothing is saved on the server; the plan is worked out in the browser (lib/playing-time.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, Minus, Plus, Printer, Shuffle } from 'lucide-react';
import { PERIOD_NAMES, clock, minutes, planRotation, type KeeperMode, type Plan } from '@/lib/playing-time';

const FORMATS = [4, 5, 6, 7, 8, 9, 10, 11];
const PERIODS: { value: number; label: string }[] = [
  { value: 2, label: 'Halves' },
  { value: 4, label: 'Quarters' },
  { value: 3, label: 'Thirds' },
  { value: 1, label: 'One period' },
];
const MAX_SQUAD = 30;
const STORAGE_KEY = 'ifc-playing-time';

interface State {
  onField: number;
  periods: number;
  periodMinutes: number;
  squad: number;
  keeper: KeeperMode;
  /** The player (index) in goal each period, for 'per-period' */
  keepers: number[];
  exact: boolean;
  names: string[];
}

export interface PlayingTimeDefaults {
  defaultOnField?: number;
  defaultPeriods?: number;
  defaultMinutes?: number;
  defaultSquad?: number;
  defaultKeeper?: KeeperMode;
}

const fresh = (d: PlayingTimeDefaults): State => ({
  onField: d.defaultOnField ?? 9,
  periods: d.defaultPeriods ?? 2,
  periodMinutes: d.defaultMinutes ?? 30,
  squad: d.defaultSquad ?? 13,
  keeper: d.defaultKeeper ?? 'per-period',
  keepers: [0, 1, 2, 3],
  exact: false,
  names: [],
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function PlayingTimeTool(defaults: PlayingTimeDefaults) {
  const [state, setState] = useState<State>(() => fresh(defaults));
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  // Remember the squad and settings in this browser (a convenience only: it works the same without it).
  // A format page keeps the saved settings only when they are for its format; the names always carry over.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<State> | null;
      if (saved && typeof saved === 'object') {
        const base = fresh(defaults);
        const sameFormat = !defaults.defaultOnField || saved.onField === defaults.defaultOnField;
        const names = Array.isArray(saved.names) ? saved.names.filter(n => typeof n === 'string').slice(0, MAX_SQUAD) : [];
        setState(sameFormat ? { ...base, ...saved, names } : { ...base, names });
      }
    } catch { /* storage blocked or corrupt */ }
    loaded.current = true;
    // Once on mount: the defaults are fixed for each page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  }, [state]);

  const update = (patch: Partial<State>) => { setState(s => ({ ...s, ...patch })); setCopied(false); };
  const name = (i: number) => state.names[i]?.trim() || `Player ${i + 1}`;
  const setName = (i: number, value: string) => {
    const names = [...state.names];
    while (names.length <= i) names.push('');
    names[i] = value;
    update({ names });
  };
  const setOnField = (onField: number) => update({ onField, squad: Math.max(state.squad, onField) });
  const setSquad = (squad: number) => update({ squad: clamp(squad, state.onField, MAX_SQUAD) });

  const plan = useMemo<Plan>(() => planRotation({
    onField: state.onField,
    periods: state.periods,
    periodMinutes: state.periodMinutes,
    squad: state.squad,
    keeper: state.keeper,
    keepers: state.keepers.map(k => (k < state.squad ? k : 0)),
    unit: state.exact ? 1 : 60,
  }), [state.onField, state.periods, state.periodMinutes, state.squad, state.keeper, state.keepers, state.exact]);

  const periodNames = PERIOD_NAMES[state.periods] || PERIOD_NAMES[2];
  const breakName = state.periods === 2 ? 'Half time' : 'Break';
  const keeperMode: KeeperMode = state.keeper === 'per-period' && state.periods < 2 ? 'fixed' : state.keeper;
  const fieldPlayers = plan.seconds.map((_, i) => i).filter(i => !(keeperMode === 'fixed' && i === 0));
  const fieldSeconds = fieldPlayers.map(i => plan.seconds[i]);
  const low = fieldSeconds.length ? Math.min(...fieldSeconds) : 0;
  const high = fieldSeconds.length ? Math.max(...fieldSeconds) : 0;
  const stops = plan.changes.filter(c => !c.atBreak).length;
  const matchMinutes = state.periods * state.periodMinutes;
  const share = minutes(Math.round(plan.target), state.exact);

  const headline = !plan.ok ? '' : low === high
    ? `Every player gets ${minutes(low, state.exact)} minutes`
    : `Every player gets ${minutes(low, state.exact)}–${minutes(high, state.exact)} minutes`;

  const shuffle = () => {
    const order = Array.from({ length: state.squad }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // Keep the keepers where they are: shuffle who starts and who comes on
    const fixedSlots = new Set(keeperMode === 'fixed' ? [0] : keeperMode === 'per-period' ? state.keepers.slice(0, state.periods) : []);
    const movable = order.filter(i => !fixedSlots.has(i));
    const slots = Array.from({ length: state.squad }, (_, i) => i).filter(i => !fixedSlots.has(i));
    const names = Array.from({ length: state.squad }, (_, i) => state.names[i] || '');
    const next = [...names];
    slots.forEach((slot, k) => { next[slot] = names[movable[k]]; });
    update({ names: next });
  };

  const text = () => {
    const lines = [
      `Sub plan: ${state.onField}-a-side, ${state.periods > 1 ? `${state.periods} × ${state.periodMinutes}` : matchMinutes} min, ${state.squad} players`,
      headline + (keeperMode === 'fixed' ? ` (${name(0)} in goal all game)` : '') + '.',
    ];
    periodNames.forEach((p, q) => {
      lines.push('', `${p.toUpperCase()}${plan.keeperByPeriod[q] != null && keeperMode === 'per-period' ? ` · In goal: ${name(plan.keeperByPeriod[q]!)}` : ''}`);
      if (q === 0) lines.push(`Kick-off: ${plan.starters.map(name).join(', ')}`);
      for (const c of plan.changes.filter(c => c.period === q)) {
        lines.push(`${c.atBreak ? breakName : clock(c.time)}: ${c.swaps.map(s => `${name(s.on)} on for ${name(s.off)}`).join('; ')}`);
      }
    });
    lines.push('', 'Minutes: ' + plan.seconds.map((s, i) => `${name(i)} ${minutes(s, state.exact)}`).join(', '));
    lines.push('', 'Made at itsfootball.club/tools/equal-playing-time-calculator');
    return lines.join('\n');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text()); setCopied(true); } catch { setCopied(false); }
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const rows = periodNames.map((p, q) => {
      const keeper = plan.keeperByPeriod[q];
      const items = plan.changes.filter(c => c.period === q).map(c =>
        `<tr><td class="t">${c.atBreak ? breakName : clock(c.time)}</td><td>${c.swaps.map(s => `<b>${esc(name(s.on))}</b> on for ${esc(name(s.off))}`).join('<br>')}</td><td class="tick"></td></tr>`).join('');
      return `<h2>${p}${keeper != null && keeperMode === 'per-period' ? ` <small>In goal: ${esc(name(keeper))}</small>` : ''}</h2>
        ${q === 0 ? `<p><b>Kick-off:</b> ${plan.starters.map(i => esc(name(i))).join(', ')}</p>` : ''}
        ${items ? `<table>${items}</table>` : '<p class="muted">No changes</p>'}`;
    }).join('');
    const mins = plan.seconds.map((s, i) => `<tr><td>${esc(name(i))}</td><td class="t">${minutes(s, state.exact)} min</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Sub plan</title><style>
      body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:28px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
      h2 small{font-weight:400;color:#444}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:5px 6px;vertical-align:top}
      .t{font-weight:700;white-space:nowrap;width:70px}.tick{width:26px;border:1px solid #999}.muted{color:#666}.cols{display:grid;grid-template-columns:2fr 1fr;gap:28px}
      footer{margin-top:24px;color:#666;font-size:12px}</style></head><body>
      <h1>Sub plan · ${state.onField}-a-side · ${state.periods > 1 ? `${state.periods} × ${state.periodMinutes}` : matchMinutes} min · ${state.squad} players</h1>
      <p>${esc(headline)}${keeperMode === 'fixed' ? ` (${esc(name(0))} in goal all game)` : ''}.</p>
      <div class="cols"><div>${rows}</div><div><h2>Minutes</h2><table>${mins}</table></div></div>
      <footer>Made with the free equal playing time calculator at itsfootball.club</footer>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  // Axis marks: every period break, plus every 5 or 10 minutes
  const tickEvery = matchMinutes > 90 ? 30 : matchMinutes > 40 ? 15 : matchMinutes > 20 ? 10 : 5;
  const ticks = Array.from({ length: Math.floor(matchMinutes / tickEvery) + 1 }, (_, i) => i * tickEvery);
  const pct = (seconds: number) => `${(seconds / plan.total) * 100}%`;
  const keeperPeriodsLabel = state.periods === 4 ? 'each quarter' : state.periods === 3 ? 'each third' : 'at half time';

  return (
    <div className="lineup-tool pt-tool">
      {/* Setup */}
      <div className="lineup-tool-controls lineup-tool-glass">
        <h2 className="lineup-tool-section">Match</h2>
        <div className="lineup-tool-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pt-format">Format</label>
            <select id="pt-format" className="form-select" value={state.onField} onChange={e => setOnField(Number(e.target.value))}>
              {FORMATS.map(f => <option key={f} value={f}>{f}-a-side</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pt-periods">Played in</label>
            <select id="pt-periods" className="form-select" value={state.periods} onChange={e => update({ periods: Number(e.target.value) })}>
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="lineup-tool-row">
          <div className="form-group">
            <span className="form-label" id="pt-len">{state.periods === 1 ? 'Match length' : `Each ${state.periods === 2 ? 'half' : state.periods === 4 ? 'quarter' : 'third'}`}</span>
            <Stepper labelledBy="pt-len" value={state.periodMinutes} suffix="min" min={2} max={60} onChange={v => update({ periodMinutes: v })} />
          </div>
          <div className="form-group">
            <span className="form-label" id="pt-squad">Squad size</span>
            <Stepper labelledBy="pt-squad" value={state.squad} suffix="players" min={state.onField} max={MAX_SQUAD} onChange={setSquad} />
          </div>
        </div>

        <div className="form-group">
          <span className="form-label" id="pt-keeper">Goalkeeper</span>
          <div className="lineup-tool-segment pt-segment-3" role="radiogroup" aria-labelledby="pt-keeper">
            {([
              ['per-period', state.periods > 1 ? `Swap ${keeperPeriodsLabel}` : 'Swap at breaks'],
              ['fixed', 'Same all game'],
              ['rolling', 'Rotate with all'],
            ] as const).filter(([k]) => k !== 'per-period' || state.periods > 1).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={keeperMode === key}
                className={keeperMode === key ? 'is-active' : ''} onClick={() => update({ keeper: key })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {keeperMode === 'per-period' && (
          <div className="pt-keepers">
            {periodNames.map((p, q) => (
              <div key={p} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor={`pt-gk-${q}`}>In goal, {p.toLowerCase()}</label>
                <select id={`pt-gk-${q}`} className="form-select" value={Math.min(state.keepers[q] ?? q, state.squad - 1)}
                  onChange={e => { const keepers = [...state.keepers]; keepers[q] = Number(e.target.value); update({ keepers }); }}>
                  {Array.from({ length: state.squad }, (_, i) => <option key={i} value={i}>{name(i)}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="form-group">
          <span className="form-label" id="pt-unit">Sub times</span>
          <div className="lineup-tool-segment" role="radiogroup" aria-labelledby="pt-unit">
            {([[false, 'Whole minutes'], [true, 'To the second']] as const).map(([key, label]) => (
              <button key={label} type="button" role="radio" aria-checked={state.exact === key}
                className={state.exact === key ? 'is-active' : ''} onClick={() => update({ exact: key })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="lineup-tool-players-head">
          <h2 className="lineup-tool-section" style={{ margin: 0 }}>Squad</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={shuffle}>
            <Shuffle size={14} /> Shuffle
          </button>
        </div>
        <p className="pt-hint">
          {keeperMode === 'fixed' ? 'Player 1 keeps goal all game. ' : ''}Players marked Starts begin the game and the rest come on in
          list order. Use Shuffle to change who starts.
        </p>
        <ol className="pt-names">
          {Array.from({ length: state.squad }, (_, i) => {
            const starts = plan.starters.includes(i);
            const keeps = keeperMode === 'fixed' ? i === 0 : keeperMode === 'per-period' && plan.keeperByPeriod.includes(i);
            return (
              <li key={i}>
                <span className="pt-num">{i + 1}</span>
                <input className="form-input" maxLength={24} placeholder={`Player ${i + 1}`} aria-label={`Player ${i + 1} name`}
                  autoComplete="off" value={state.names[i] || ''} onChange={e => setName(i, e.target.value)} />
                <span className={`pt-tag ${keeps ? 'is-gk' : starts ? 'is-start' : ''}`}>{keeps ? 'GK' : starts ? 'Starts' : 'Bench'}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* The plan */}
      <div className="lineup-tool-controls lineup-tool-glass pt-plan" aria-live="polite">
        {!plan.ok ? (
          <p role="alert" style={{ color: 'var(--c-red)' }}>{plan.error}</p>
        ) : (
          <>
            <div className="pt-summary">
              <div className="pt-big">
                <strong>{low === high ? minutes(low, state.exact) : `${minutes(low, state.exact)}–${minutes(high, state.exact)}`}</strong>
                <span>minutes each</span>
              </div>
              <div className="pt-facts">
                <p className="pt-headline">{headline}{keeperMode === 'fixed' ? `, with ${name(0)} in goal all game` : ''}.</p>
                <ul>
                  <li><strong>{stops}</strong> {stops === 1 ? 'sub stop' : 'sub stops'}{plan.subs ? `, ${plan.subs} ${plan.subs === 1 ? 'change' : 'changes'}` : ''}</li>
                  <li>Fair share: <strong>{share}</strong> of {matchMinutes} min</li>
                  {state.squad > state.onField && <li>Bench: <strong>{state.squad - state.onField}</strong> at a time</li>}
                </ul>
              </div>
            </div>
            {keeperMode === 'per-period' && plan.target < plan.periodLength && (
              <p className="pt-note">Each keeper is in goal for a whole {state.periods === 2 ? 'half' : 'period'}, so they play {minutes(plan.periodLength)} minutes; everyone else shares the rest equally.</p>
            )}

            <h2 className="lineup-tool-section">Rotation chart</h2>
            <div className="pt-chart" role="img" aria-label={`Rotation chart: when each player is on the pitch over ${matchMinutes} minutes`}>
              <div className="pt-row pt-axis" aria-hidden="true">
                <span />
                <div className="pt-track">
                  {ticks.map(t => <span key={t} className="pt-tick" style={{ left: pct(t * 60) }}>{t}&apos;</span>)}
                </div>
                <span />
              </div>
              {plan.seconds.map((s, i) => (
                <div key={i} className="pt-row">
                  <span className="pt-name" title={name(i)}>{name(i)}</span>
                  <div className="pt-track">
                    {Array.from({ length: state.periods - 1 }, (_, b) => <span key={b} className="pt-break" style={{ left: pct((b + 1) * plan.periodLength) }} />)}
                    {plan.stints.filter(st => st.player === i).map((st, k) => (
                      <span key={k} className={`pt-bar ${st.keeper ? 'is-gk' : ''}`} style={{ left: pct(st.start), width: pct(st.end - st.start) }} />
                    ))}
                  </div>
                  <span className="pt-mins">{minutes(s, state.exact)}</span>
                </div>
              ))}
              <p className="pt-legend"><span className="pt-key" /> On the pitch <span className="pt-key is-gk" /> In goal <span className="pt-key is-break" /> Break</p>
            </div>

            <h2 className="lineup-tool-section">Substitution schedule</h2>
            <div className="pt-schedule">
              {periodNames.map((p, q) => {
                const items = plan.changes.filter(c => c.period === q);
                const keeper = plan.keeperByPeriod[q];
                return (
                  <section key={p} className="pt-period">
                    <h3>
                      {p} <span className="pt-period-time">{clock(q * plan.periodLength)}–{clock((q + 1) * plan.periodLength)}</span>
                      {keeper != null && keeperMode === 'per-period' && <span className="pt-gk-chip">In goal: {name(keeper)}</span>}
                    </h3>
                    {q === 0 && (
                      <div className="pt-change">
                        <span className="pt-time">KO</span>
                        <div className="pt-starters">{plan.starters.map(i => <span key={i} className={plan.stints.some(s => s.player === i && s.start === 0 && s.keeper) ? 'is-gk' : ''}>{name(i)}</span>)}</div>
                      </div>
                    )}
                    {items.map(c => (
                      <div key={c.time} className={`pt-change ${c.atBreak ? 'is-break' : ''}`}>
                        <span className="pt-time">{c.atBreak ? (state.periods === 2 ? 'HT' : 'Break') : clock(c.time)}</span>
                        <ul>
                          {c.swaps.map(sw => (
                            <li key={`${sw.off}-${sw.on}`}>
                              <span className="pt-on"><ArrowUp size={14} aria-label="On" /> {name(sw.on)}</span>
                              <span className="pt-off"><ArrowDown size={14} aria-label="Off" /> {name(sw.off)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {q > 0 && !items.length && <p className="pt-hint" style={{ margin: '0.3rem 0 0' }}>Same players carry on.</p>}
                  </section>
                );
              })}
            </div>

            <div className="lineup-tool-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={print}>
                <Printer size={18} /> Print sheet
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={copy}>
                {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy for WhatsApp'}
              </button>
            </div>

            <div className="lineup-tool-prompt" role="note">
              <span>Running these subs on Saturday? Track them live from the touchline with a free itsfootball.club </span>
              <Link href="/live-scores" className="lineup-tool-prompt-link" style={{ display: 'inline' }}>Match Centre</Link>
              <span>. </span>
              <Link href="/create-club" className="lineup-tool-prompt-link">
                Launch your free club site <ArrowRight size={15} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({ value, min, max, suffix, labelledBy, onChange }: { value: number; min: number; max: number; suffix: string; labelledBy: string; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) onChange(clamp(n, min, max)); else setDraft(String(value));
  };
  return (
    <div className="pt-stepper" role="group" aria-labelledby={labelledBy}>
      <button type="button" aria-label="Less" disabled={value <= min} onClick={() => onChange(clamp(value - 1, min, max))}><Minus size={16} /></button>
      <label>
        <input className="form-input" inputMode="numeric" aria-labelledby={labelledBy} value={draft}
          onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={e => commit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }} />
        <span>{suffix}</span>
      </label>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))}><Plus size={16} /></button>
    </div>
  );
}
