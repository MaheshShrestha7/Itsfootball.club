'use client';

// The free season budget & subs fee calculator at /tools/season-fee-calculator: enter the season's costs,
// the squad and the sponsor money, and get the break-even fee per player, the fee that covers card
// processing, and what the club keeps by card versus chasing cash. No login and nothing is uploaded; the
// maths is in lib/season-fees.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, CreditCard, Minus, Plus, Printer, RotateCcw, Trash2, Wallet } from 'lucide-react';
import {
  CARD_PRESETS, EXAMPLE_COSTS, EXAMPLE_INCOME, EXAMPLE_PLAYERS, MAX_PLAYERS, STRIPE_AU_SOURCE,
  money, seasonBudget, type Collection, type CostLine,
} from '@/lib/season-fees';
import { parseMoneyToCents } from '@/lib/finance';

const STORAGE_KEY = 'ifc-season-fees';
const MAX_LINES = 20;

interface State {
  costs: CostLine[];
  players: number;
  incomeCents: number;
  bufferPercent: number;
  preset: string;
  cardPercent: number;
  cardFixedCents: number;
  unpaidPercent: number;
  /** null = follow the suggested fee */
  feeCents: number | null;
}

const fresh = (): State => ({
  costs: EXAMPLE_COSTS.map(c => ({ ...c })),
  players: EXAMPLE_PLAYERS,
  incomeCents: EXAMPLE_INCOME,
  bufferPercent: 5,
  preset: CARD_PRESETS[0].id,
  cardPercent: CARD_PRESETS[0].percent,
  cardFixedCents: CARD_PRESETS[0].fixedCents,
  unpaidPercent: 10,
  feeCents: null,
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const plain = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, '');

export default function SeasonFeeTool() {
  const [state, setState] = useState<State>(fresh);
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  // Remember the budget in this browser (a convenience only: the tool works the same without it)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<State> | null;
      if (saved && typeof saved === 'object' && Array.isArray(saved.costs)) {
        const costs = saved.costs
          .filter(c => c && typeof c.label === 'string' && Number.isFinite(c.cents))
          .slice(0, MAX_LINES)
          .map(c => ({ label: c.label.slice(0, 48), cents: Math.max(0, Math.round(c.cents)), perPlayer: !!c.perPlayer }));
        setState({ ...fresh(), ...saved, costs });
      }
    } catch { /* storage blocked or corrupt */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  }, [state]);

  const update = (patch: Partial<State>) => { setState(s => ({ ...s, ...patch })); setCopied(false); };
  const setCost = (i: number, patch: Partial<CostLine>) => update({ costs: state.costs.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  const b = useMemo(() => seasonBudget({
    costs: state.costs,
    players: state.players,
    incomeCents: state.incomeCents,
    bufferPercent: state.bufferPercent,
    card: { percent: state.cardPercent, fixedCents: state.cardFixedCents },
    unpaidPercent: state.unpaidPercent,
    feeCents: state.feeCents,
  }), [state]);

  const choosePreset = (id: string) => {
    const p = CARD_PRESETS.find(x => x.id === id) || CARD_PRESETS[0];
    update(id === 'custom' ? { preset: id } : { preset: id, cardPercent: p.percent, cardFixedCents: p.fixedCents });
  };
  const feeLabel = `${state.cardPercent}% + ${money(state.cardFixedCents)}`;
  const advantage = b.card.keptCents - b.cash.keptCents;

  const text = () => [
    `Season budget: ${state.players} players`,
    ...state.costs.filter(c => c.cents > 0).map(c => `- ${c.label || 'Other cost'}: ${money(c.cents)}${c.perPlayer ? ' per player' : ''}`),
    `Costs ${money(b.costsCents)}${b.bufferCents ? ` + ${state.bufferPercent}% buffer ${money(b.bufferCents)}` : ''}${state.incomeCents ? ` − sponsors & income ${money(state.incomeCents)}` : ''} = ${money(b.toRaiseCents)} to raise`,
    '',
    `Break-even fee: ${money(b.breakEvenCents)} per player`,
    `Paid by card (${feeLabel}): set the fee at ${money(b.cardPriceCents)} to break even`,
    `Paid in cash, if ${b.unpaidPlayers} ${b.unpaidPlayers === 1 ? 'player never pays' : 'players never pay'}: set the fee at ${money(b.cashPriceCents)}`,
    '',
    `At ${money(b.feeCents)} per player the club keeps ${money(b.card.keptCents)} by card or ${money(b.cash.keptCents)} in cash.`,
    '',
    'Made with the free season fee calculator at itsfootball.club/tools/season-fee-calculator',
  ].join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(text()); setCopied(true); } catch { setCopied(false); }
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const costRows = state.costs.filter(c => c.cents > 0).map(c =>
      `<tr><td>${esc(c.label || 'Other cost')}</td><td class="n">${money(c.cents)}${c.perPlayer ? ` × ${state.players}` : ''}</td><td class="n">${money(c.perPlayer ? c.cents * state.players : c.cents)}</td></tr>`).join('');
    const col = (c: Collection) => `<td class="n">${money(c.keptCents)}</td>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Season budget</title><style>
      body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:28px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
      table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}.n{text-align:right;white-space:nowrap}
      .big{font-size:28px;font-weight:800}footer{margin-top:24px;color:#666;font-size:12px}</style></head><body>
      <h1>Season budget · ${state.players} players</h1>
      <p>Break-even fee: <span class="big">${money(b.breakEvenCents)}</span> per player</p>
      <h2>Costs</h2><table>${costRows}
      ${b.bufferCents ? `<tr><td>Buffer (${state.bufferPercent}%)</td><td></td><td class="n">${money(b.bufferCents)}</td></tr>` : ''}
      ${state.incomeCents ? `<tr><td>Sponsors and other income</td><td></td><td class="n">−${money(state.incomeCents)}</td></tr>` : ''}
      <tr><th>To raise from players</th><th></th><th class="n">${money(b.toRaiseCents)}</th></tr></table>
      <h2>What to charge</h2><table>
      <tr><td>Everyone pays, no fees</td><td class="n">${money(b.breakEvenCents)}</td></tr>
      <tr><td>By card (${feeLabel})</td><td class="n">${money(b.cardPriceCents)}</td></tr>
      <tr><td>In cash, ${b.unpaidPlayers} never pay</td><td class="n">${money(b.cashPriceCents)}</td></tr></table>
      <h2>At ${money(b.feeCents)} per player, the club keeps</h2><table>
      <tr><th>By card</th><th>In cash</th></tr><tr>${col(b.card)}${col(b.cash)}</tr></table>
      <footer>Made with the free season fee calculator at itsfootball.club</footer>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="lineup-tool sf-tool">
      {/* The season */}
      <div className="lineup-tool-controls lineup-tool-glass">
        <div className="lineup-tool-players-head">
          <h2 className="lineup-tool-section" style={{ margin: 0 }}>Season costs</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setState(fresh()); setCopied(false); }}>
            <RotateCcw size={14} /> Example
          </button>
        </div>
        <p className="pt-hint">Example figures for one senior amateur team. Replace them with your own quotes and invoices.</p>
        <ul className="sf-costs">
          {state.costs.map((c, i) => (
            <li key={i}>
              <input className="form-input sf-cost-label" maxLength={48} placeholder="What is it for?" aria-label={`Cost ${i + 1}`}
                value={c.label} onChange={e => setCost(i, { label: e.target.value })} />
              <MoneyInput cents={c.cents} label={`${c.label || `Cost ${i + 1}`} amount`} onChange={cents => setCost(i, { cents })} />
              <select className="form-select sf-cost-unit" aria-label={`${c.label || `Cost ${i + 1}`}: per season or per player`}
                value={c.perPlayer ? 'player' : 'season'} onChange={e => setCost(i, { perPlayer: e.target.value === 'player' })}>
                <option value="season">per season</option>
                <option value="player">per player</option>
              </select>
              <button type="button" className="sf-remove" aria-label={`Remove ${c.label || `cost ${i + 1}`}`}
                onClick={() => update({ costs: state.costs.filter((_, k) => k !== i) })}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        {state.costs.length < MAX_LINES && (
          <button type="button" className="btn btn-secondary btn-sm sf-add" onClick={() => update({ costs: [...state.costs, { label: '', cents: 0, perPlayer: false }] })}>
            <Plus size={14} /> Add a cost
          </button>
        )}

        <h2 className="lineup-tool-section" style={{ marginTop: '1.4rem' }}>Squad and income</h2>
        <div className="lineup-tool-row">
          <div className="form-group">
            <span className="form-label" id="sf-players">Paying players</span>
            <Stepper labelledBy="sf-players" value={state.players} suffix="players" min={1} max={MAX_PLAYERS} onChange={v => update({ players: v })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sf-income">Sponsors, grants &amp; fundraising</label>
            <MoneyInput id="sf-income" cents={state.incomeCents} onChange={incomeCents => update({ incomeCents })} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <span className="form-label" id="sf-buffer">Buffer for the unexpected</span>
          <div className="lineup-tool-segment" role="radiogroup" aria-labelledby="sf-buffer">
            {[0, 5, 10, 15].map(p => (
              <button key={p} type="button" role="radio" aria-checked={state.bufferPercent === p}
                className={state.bufferPercent === p ? 'is-active' : ''} onClick={() => update({ bufferPercent: p })}>
                {p ? `${p}%` : 'None'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The fee */}
      <div className="lineup-tool-controls lineup-tool-glass sf-result" aria-live="polite">
        {!b.ok ? (
          <p role="alert" style={{ color: 'var(--c-red)' }}>{b.error}</p>
        ) : (
          <>
            <div className="pt-summary">
              <div className="pt-big sf-big">
                <strong>{money(b.breakEvenCents)}</strong>
                <span>per player</span>
              </div>
              <div className="pt-facts">
                <p className="pt-headline">Break-even fee for {state.players} {state.players === 1 ? 'player' : 'players'}</p>
                <ul>
                  <li>Costs <strong>{money(b.costsCents, true)}</strong></li>
                  {b.bufferCents > 0 && <li>Buffer <strong>{money(b.bufferCents, true)}</strong></li>}
                  {state.incomeCents > 0 && <li>Income <strong>−{money(state.incomeCents, true)}</strong></li>}
                  <li>To raise <strong>{money(b.toRaiseCents, true)}</strong></li>
                </ul>
              </div>
            </div>

            <div className="sf-prices">
              <div className="sf-price">
                <span className="sf-price-icon"><CreditCard size={16} /></span>
                <span className="sf-price-label">Paid by card</span>
                <strong>{money(b.cardPriceCents)}</strong>
                <span className="sf-price-note">fee that covers {feeLabel} card fees</span>
              </div>
              <div className="sf-price">
                <span className="sf-price-icon is-cash"><Wallet size={16} /></span>
                <span className="sf-price-label">Paid in cash</span>
                <strong>{money(b.cashPriceCents)}</strong>
                <span className="sf-price-note">fee that covers it if {b.unpaidPlayers} {b.unpaidPlayers === 1 ? 'player never pays' : 'players never pay'}</span>
              </div>
            </div>

            <h2 className="lineup-tool-section">Card vs cash</h2>
            <div className="lineup-tool-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sf-fee">Fee you charge</label>
                <MoneyInput id="sf-fee" cents={b.feeCents} onChange={feeCents => update({ feeCents })} />
                {state.feeCents != null && state.feeCents !== b.suggestedCents && (
                  <button type="button" className="sf-link" onClick={() => update({ feeCents: null })}>Use {money(b.suggestedCents, true)} (suggested)</button>
                )}
              </div>
              <div className="form-group">
                <span className="form-label" id="sf-unpaid">Never pay in cash</span>
                <Stepper labelledBy="sf-unpaid" value={state.unpaidPercent} suffix="%" min={0} max={50} onChange={v => update({ unpaidPercent: v })} />
              </div>
            </div>
            <div className="lineup-tool-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sf-preset">Card fee</label>
                <select id="sf-preset" className="form-select" value={state.preset} onChange={e => choosePreset(e.target.value)}>
                  {CARD_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group sf-rate">
                <label className="form-label" htmlFor="sf-pct">Rate</label>
                <div className="sf-rate-inputs">
                  <PercentInput id="sf-pct" value={state.cardPercent} onChange={cardPercent => update({ cardPercent, preset: 'custom' })} />
                  <span aria-hidden="true">+</span>
                  <MoneyInput cents={state.cardFixedCents} label="Card fee fixed amount" onChange={cents => update({ cardFixedCents: Math.min(cents, 500), preset: 'custom' })} />
                </div>
              </div>
            </div>

            <div className="pt-table-wrap">
              <table className="pt-table sf-compare">
                <caption>At {money(b.feeCents)} per player</caption>
                <thead>
                  <tr><th scope="col"><span className="sr-only">Item</span></th><th scope="col">By card</th><th scope="col">In cash</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Players who pay</th><td>{b.card.paying}</td><td>{b.cash.paying} of {state.players}</td></tr>
                  <tr><th scope="row">Lost</th><td>{money(b.card.lostCents)} <small>card fees</small></td><td>{money(b.cash.lostCents)} <small>unpaid</small></td></tr>
                  <tr className="sf-kept"><th scope="row">Club keeps</th><td>{money(b.card.keptCents)}</td><td>{money(b.cash.keptCents)}</td></tr>
                  <tr><th scope="row">Against the budget</th><Balance c={b.card} /><Balance c={b.cash} /></tr>
                </tbody>
              </table>
            </div>
            <p className="pt-hint" style={{ marginTop: '0.6rem' }}>
              {advantage > 0
                ? <>Collecting by card keeps <strong>{money(advantage)}</strong> more this season, even after card fees.</>
                : advantage < 0
                  ? <>With nobody missing a payment, cash keeps {money(-advantage)} more than card, if every player really pays.</>
                  : <>Card and cash come out the same.</>}
              {' '}Australian clubs can’t add a card surcharge on Visa, Mastercard or eftpos from 1 October 2026, so build card fees into the one fee.
              Card rates: Stripe Australia, GST included, from <a href={STRIPE_AU_SOURCE.url} target="_blank" rel="noopener noreferrer" className="sf-source">stripe.com/au/pricing</a> ({STRIPE_AU_SOURCE.checked}).
            </p>

            <div className="lineup-tool-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={print}>
                <Printer size={18} /> Print budget
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={copy}>
                {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Copied' : 'Copy for the committee'}
              </button>
            </div>

            <div className="lineup-tool-prompt" role="note">
              <span>Stop chasing cash in spreadsheets. Collect this fee on itsfootball.club by card, Apple Pay or Google Pay, or by bank
                transfer with the receipt attached, and every payment lands in your club’s finance page. </span>
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

function Balance({ c }: { c: Collection }) {
  const short = c.balanceCents < 0;
  return <td className={short ? 'sf-short' : 'sf-over'}>{short ? `${money(-c.balanceCents)} short` : `${money(c.balanceCents)} over`}</td>;
}

/** A dollar amount: typed freely, applied whenever it reads as an amount */
function MoneyInput({ cents, onChange, id, label }: { cents: number; onChange: (cents: number) => void; id?: string; label?: string }) {
  const [draft, setDraft] = useState(plain(cents));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(plain(cents)); }, [cents]);
  return (
    <label className="sf-money">
      <span aria-hidden="true">$</span>
      <input id={id} className="form-input" inputMode="decimal" aria-label={label} value={draft}
        onFocus={() => { focused.current = true; }}
        onChange={e => {
          const v = e.target.value.replace(/[^\d.,]/g, '').slice(0, 10);
          setDraft(v);
          const n = v === '' ? 0 : parseMoneyToCents(v);
          if (n != null) onChange(n);
        }}
        onBlur={() => { focused.current = false; setDraft(plain(cents)); }} />
    </label>
  );
}

/** The card fee percentage, e.g. 1.65 */
function PercentInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id: string }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return (
    <label className="sf-money sf-percent">
      <input id={id} className="form-input" inputMode="decimal" aria-label="Card fee percentage" value={draft}
        onFocus={() => { focused.current = true; }}
        onChange={e => {
          const v = e.target.value.replace(/[^\d.]/g, '').slice(0, 5);
          setDraft(v);
          const n = v === '' ? 0 : Number(v);
          if (Number.isFinite(n) && n < 50) onChange(Math.round(n * 100) / 100);
        }}
        onBlur={() => { focused.current = false; setDraft(String(value)); }} />
      <span aria-hidden="true">%</span>
    </label>
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
          onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={e => commit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }} />
        <span>{suffix}</span>
      </label>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))}><Plus size={16} /></button>
    </div>
  );
}
