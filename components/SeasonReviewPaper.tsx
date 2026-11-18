import type { CSSProperties } from 'react';
import { CLUB, type PitchView, type SeasonReview } from '@/lib/season-review';
import { PAPER_PRINT_CSS } from '@/lib/report-paper';
import { chartColours, crestInitials, REPORT_CSS } from '@/components/CupReportPaper';
import { AGM_CHART_CSS, AgmMonths, AgmShare, AgmVersus, agmColours } from '@/components/admin/AgmCharts';
import { DATE_LOCALE } from '@/lib/dates';

// The Season review on white paper, the same on the admin page and behind a share link. Each part
// starts a new printed page, like chapters of a yearbook. Charts carry their own numbers, so it
// reads printed in black and white.

const SEASON_CSS = `
.sr-part { margin: 2.2rem 0 .3rem; padding: 4px 0 4px 12px; border-left: 5px solid var(--club); font: 900 1.3rem var(--font-heading); color: var(--ink); break-after: avoid; }
.sr-part small { display: block; font: 500 .8rem var(--font-body); color: var(--mut); }
.sr-paper h3 { font: 800 1.05rem var(--font-heading); color: var(--ink); margin: 1.5rem 0 .5rem; break-after: avoid; }
.sr-paper h4 { font: 800 .86rem var(--font-heading); color: var(--ink); margin: 0 0 .45rem; }
.sr-paper section { break-inside: avoid; }
.sr-paper .cr-figs { overflow: visible; }
.sr-photo { margin: .6rem 0 1rem; border-radius: 10px; overflow: hidden; position: relative; aspect-ratio: 16 / 5; background: #e2e8f0; }
.sr-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sr-photo figcaption { position: absolute; inset: auto 0 0 0; padding: 18px 12px 8px; font-size: .78rem; font-weight: 600; color: #fff; background: linear-gradient(transparent, rgba(0,0,0,.6)); }
.sr-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sr-box { border: 1px solid var(--rule); border-radius: 10px; padding: 10px 12px; min-width: 0; }
.sr-box .k { display: block; font-size: .7rem; color: var(--mut); font-weight: 700; }
.sr-award { position: relative; overflow: hidden; display: grid; gap: 2px; }
.sr-award::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: #D4A017; }
.sr-award b { font: 800 1.02rem var(--font-heading); overflow-wrap: anywhere; }
.sr-award .t { font-size: .74rem; color: var(--mut); }
.sr-award.is-club { grid-column: 1 / -1; background: #fffbeb; }
.sr-moment b { display: block; font: 800 1.6rem var(--font-heading); line-height: 1.1; font-variant-numeric: tabular-nums; }
.sr-moment p { margin: 2px 0 0; font-size: .8rem; }
.sr-ld ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
.sr-ld li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; font-size: .8rem; }
.sr-ld li span { min-width: 0; overflow-wrap: anywhere; }
.sr-ld li small { color: var(--mut); font-size: .7rem; }
.sr-ld li b { font-variant-numeric: tabular-nums; }
.sr-ld li:first-child span { font-weight: 800; }
.sr-ld li i { grid-column: 1 / -1; height: 5px; border-radius: 3px; background: #eef2f7; overflow: hidden; display: block; }
.sr-ld li i em { display: block; height: 100%; background: #94a3b8; }
.sr-ld li:first-child i em { background: var(--club); }
.sr-teams { display: grid; gap: 12px; }
.sr-team { display: grid; grid-template-columns: 9.5rem minmax(0, 1fr) auto; gap: 4px 14px; align-items: center; }
.sr-team h4 { margin: 0; overflow-wrap: anywhere; }
.sr-team h4 small { display: block; font: 500 .72rem var(--font-body); color: var(--mut); }
.sr-gf { font-size: .76rem; color: var(--mut); white-space: nowrap; font-variant-numeric: tabular-nums; text-align: right; }
.sr-gf b { color: var(--ink); }
.sr-private { font-size: .8rem; color: var(--mut); border: 1px dashed var(--rule); border-radius: 6px; padding: 6px 10px; }
.sr-hb { display: grid; gap: 6px; }
.sr-hb > div { display: grid; grid-template-columns: minmax(6rem, 11rem) minmax(0, 1fr); gap: 10px; align-items: center; font-size: .84rem; }
.sr-hb > div > span { min-width: 0; overflow-wrap: anywhere; }
.sr-hb small { color: var(--mut); font-size: .72rem; display: block; }
.sr-hb .agm-bar span { height: 14px; }
.sr-cups { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.sr-cups li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; padding: 9px 11px; border: 1px solid var(--rule); border-radius: 10px; font-size: .82rem; }
.sr-cups .pos { grid-row: span 3; width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; font: 800 .8rem var(--font-heading); background: #f1f5f9; }
.sr-cups .is-won .pos { background: #D4A017; color: #fff; }
.sr-cups b { font-family: var(--font-heading); font-size: .95rem; overflow-wrap: anywhere; }
.sr-cups small { color: var(--mut); }
.sr-cups a { color: inherit; }
.sr-thanks { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 24px; font-size: .84rem; }
.sr-thanks ul { margin: 0; padding: 0; list-style: none; }
.sr-thanks li { break-inside: avoid; padding: 3px 0; border-bottom: 1px dotted var(--rule); overflow-wrap: anywhere; }
.sr-thanks li small { color: var(--mut); font-size: .72rem; }
.sr-thanks h5 { margin: .6rem 0 .2rem; font: 800 .74rem var(--font-body); color: var(--mut); }
.sr-wall { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.sr-sp { border: 1px solid var(--rule); border-radius: 10px; padding: 10px; display: grid; gap: 4px; text-align: center; min-width: 0; }
.sr-sp .logo { height: 48px; display: grid; place-items: center; font: 800 .85rem var(--font-heading); overflow-wrap: anywhere; }
.sr-sp .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
.sr-sp .tier { font-size: .66rem; color: var(--mut); font-weight: 700; }
.sr-sp .st { font-size: .7rem; color: var(--mut); font-variant-numeric: tabular-nums; }
.sr-sp .st b { color: var(--ink); }
.sr-sp.is-top { grid-column: span 2; }
.sr-sp.is-top .logo { height: 64px; font-size: 1.05rem; }
.sr-gallery { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.sr-gallery img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; display: block; background: #e2e8f0; }
.sr-next { list-style: none; margin: 0; padding: 0; }
.sr-next li { display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: 10px; font-size: .86rem; padding: 6px 0; border-bottom: 1px solid var(--rule); }
.sr-next b { font-family: var(--font-heading); }
.sr-line svg { display: block; width: 100%; height: auto; }
.sr-cv { font: 700 11px var(--font-heading); fill: var(--ink); } .sr-cx { font: 500 10px var(--font-body); fill: var(--mut); }
@media (max-width: 40rem) {
  .sr-grid3, .sr-cups { grid-template-columns: minmax(0, 1fr); }
  .sr-grid3.is-awards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .sr-wall { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sr-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sr-photo { aspect-ratio: 16 / 8; }
  .sr-team { grid-template-columns: minmax(0, 1fr) auto; }
  .sr-team .agm-wdl, .sr-team .sr-private { grid-column: 1 / -1; grid-row: 2; }
  .sr-hb > div { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .sr-paper .cr-figs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media print {
  .sr-part { break-before: page; }
  .sr-paper > .cr-figs + .sr-part, .sr-paper > .cr-open + .sr-part { break-before: auto; }
}
`;

const n = (v: number) => v.toLocaleString(DATE_LOCALE);
const width = (part: number, top: number, room: string) => `calc(${top > 0 ? Math.max(0, part) / top : 0} * (100% - ${room}))`;

/** Sideways bars: a label (and a line under it), a bar and its number */
function Bars({ rows, colour, fmt = n, room = '5.5rem' }: { rows: { label: string; sub?: string; v: number; colour?: string }[]; colour: string; fmt?: (v: number) => string; room?: string }) {
  const top = Math.max(1, ...rows.map(r => r.v));
  return (
    <div className="sr-hb">
      {rows.map(r => (
        <div key={r.label + (r.sub || '')} role="img" aria-label={`${r.label}: ${fmt(r.v)}`}>
          <span>{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <div className="agm-bar"><span style={{ width: width(r.v, top, room), background: r.colour || colour }} /><b>{fmt(r.v)}</b></div>
        </div>
      ))}
    </div>
  );
}

/** Parts of a whole in one bar: big parts carry their word, small ones just their number */
function Stack({ parts }: { parts: { word: string; v: number; bg: string; fg: string }[] }) {
  const total = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div className="agm-wdl" role="img" aria-label={parts.map(p => `${p.v} ${p.word}`).join(', ')}>
      {parts.filter(p => p.v > 0).map(p => (
        <span key={p.word} style={{ flex: p.v, background: p.bg, color: p.fg }}>{p.v / total > 0.18 ? `${p.v} ${p.word}` : p.v / total > 0.05 ? p.v : ''}</span>
      ))}
    </div>
  );
}

function Photo({ photo }: { photo?: { url: string; caption: string } }) {
  if (!photo) return null;
  return (
    <figure className="sr-photo">
      <img src={photo.url} alt="" loading="lazy" />
      {photo.caption && <figcaption>{photo.caption}</figcaption>}
    </figure>
  );
}

function Pitch({ v, colour }: { v: PitchView; colour: { us: string; them: string } }) {
  const lossColour = colour.us === '#0f172a' ? colour.them : '#334155';
  return (
    <>
      {v.records.length > 0 && (
        <section>
          <h3>How {v.records.length > 1 ? 'every team' : 'the team'} went</h3>
          <div className="agm-chart">
            <div className="agm-key" aria-hidden="true"><span><i style={{ background: '#15803d' }} />Won</span><span><i style={{ background: '#cbd5e1' }} />Drawn</span><span><i style={{ background: lossColour }} />Lost</span></div>
            <div className="sr-teams">
              {v.records.map(r => (
                <div key={r.team} className="sr-team">
                  <h4>{r.name}<small>{r.sub}</small></h4>
                  {r.hidden
                    ? <div className="sr-private">This team doesn&apos;t keep scores.</div>
                    : <Stack parts={[{ word: 'won', v: r.won, bg: '#15803d', fg: '#fff' }, { word: 'drawn', v: r.drawn, bg: '#cbd5e1', fg: '#0f172a' }, { word: 'lost', v: r.lost, bg: lossColour, fg: '#fff' }]} />}
                  {r.hidden ? <span /> : <span className="sr-gf">Goals <b>{r.goalsFor}</b> for, <b>{r.goalsAgainst}</b> against</span>}
                </div>
              ))}
            </div>
          </div>
          <p className="cr-small">Club games only, not cups or in-house games. Teams that keep scores private stay private, the same as on the club site.</p>
        </section>
      )}

      {v.moments.length > 0 && (
        <section>
          <h3>Best moments</h3>
          <div className="sr-grid3">
            {v.moments.map(m => <div key={m.label} className="sr-box sr-moment"><span className="k">{m.label}</span><b>{m.value}</b><p>{m.line}</p></div>)}
          </div>
        </section>
      )}

      {v.leaders.length > 0 && (
        <section>
          <h3>Season leaders</h3>
          <div className="sr-grid3">
            {v.leaders.map(b => (
              <div key={b.title} className="sr-box sr-ld">
                <h4>{b.title}</h4>
                <ol>
                  {b.rows.map((r, k) => (
                    <li key={k}><span>{r.name}{r.team && <small> {r.team}</small>}</span><b>{r.n}</b><i><em style={{ width: `${(r.n / b.rows[0].n) * 100}%` }} /></i></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {(v.everPresent.length > 0 || v.milestones.length > 0) && (
        <div className="cr-cols">
          {v.everPresent.length > 0 && (
            <section>
              <h3>Played every game</h3>
              <ul className="cr-pts is-good">{v.everPresent.map((e, k) => <li key={k}><span>{e.name}</span><span className="cr-from">{e.line}</span></li>)}</ul>
            </section>
          )}
          {v.milestones.length > 0 && (
            <section>
              <h3>Milestones</h3>
              <ul className="cr-pts is-good">{v.milestones.map((m, k) => <li key={k}><span>{m.text}</span>{m.team && <span className="cr-from">{m.team}</span>}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

export default function SeasonReviewPaper({ review: r, team = CLUB, colour, logoUrl, footer, hideMoney, hideReplies }: {
  review: SeasonReview;
  /** '' for the whole club, or a team id */
  team?: string;
  colour?: string | null;
  logoUrl?: string | null;
  footer: string;
  hideMoney?: boolean;
  hideReplies?: boolean;
}) {
  const v = r.views[team] || r.views[CLUB];
  const one = team !== CLUB && !!r.views[team];
  const teamInfo = r.teams.find(t => t.id === team);
  const c = chartColours(colour);
  const money = hideMoney ? null : r.money;
  const fmtMoney = (cents: number) => {
    try { return new Intl.NumberFormat(DATE_LOCALE, { style: 'currency', currency: r.currency || 'AUD', maximumFractionDigits: 0 }).format(cents / 100); } catch { return `$${Math.round(cents / 100)}`; }
  };
  const shortMoney = (cents: number) => {
    if (Math.abs(cents) < 100000) return fmtMoney(cents);
    try { return new Intl.NumberFormat(DATE_LOCALE, { style: 'currency', currency: r.currency || 'AUD', notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100); } catch { return fmtMoney(cents); }
  };
  const awards = r.awards.filter(a => (one ? a.team === team : true));
  const cardTotal = v.cards.reduce((a, x) => Math.max(a, x.yellow + x.red), 0);
  const photo = (k: number) => r.photos[k];
  const replies = hideReplies ? [] : v.replies;

  return (
    <article className="agm-paper cr-paper sr-paper" style={{ '--club': c.us } as CSSProperties}>
      <style>{REPORT_CSS + AGM_CHART_CSS + SEASON_CSS + PAPER_PRINT_CSS}</style>
      <header className="cr-head">
        {logoUrl
          ? <img className="cr-crest" src={logoUrl} alt="" width={54} height={54} />
          : <div className="cr-crest" aria-hidden="true">{crestInitials(r.club)}</div>}
        <div>
          <h1>{one && teamInfo ? `${teamInfo.name}: season ${r.season}` : `Season review ${r.season}`}</h1>
          <p>{[r.club, one ? teamInfo?.sub : '', r.dates].filter(Boolean).join(' · ')}</p>
        </div>
        <span className="cr-tag">{r.committee ? 'Committee' : 'For members and sponsors'}</span>
      </header>

      <p className="cr-open">{v.opening}</p>
      {v.figures.length > 0 && <dl className="cr-figs">{v.figures.map(f => <div key={f.label}><dd>{f.value}</dd><dt>{f.label}</dt></div>)}</dl>}

      {awards.length > 0 && (
        <>
          <h2 className="sr-part">Season awards<small>Chosen by the club and its coaches</small></h2>
          <section className="sr-grid3 is-awards">
            {awards.map((a, k) => (
              <div key={k} className={`sr-box sr-award${a.team === CLUB ? ' is-club' : ''}`}>
                <span className="k">{a.award}</span><b>{a.winner}</b><span className="t">{a.note || a.teamName}</span>
              </div>
            ))}
          </section>
        </>
      )}

      {(v.records.length > 0 || v.leaders.length > 0 || v.moments.length > 0) && (
        <>
          <h2 className="sr-part">On the pitch<small>{one ? 'The season, the leaders and the best moments' : 'Every team\'s season, the leaders and the best moments'}</small></h2>
          <Photo photo={photo(0)} />
          <Pitch v={v} colour={c} />
        </>
      )}

      {!one && r.clubScore.length > 0 && (
        <section>
          <h3>ClubScore leaders</h3>
          <div className="agm-chart">
            <Bars rows={r.clubScore.map(s => ({ label: s.name, sub: s.sub, v: s.points }))} colour={c.us} fmt={x => `${n(x)} pts`} room="6.5rem" />
            <p className="cr-small">ClubScore counts playing, training, volunteering and helping out across the season.</p>
          </div>
        </section>
      )}

      {v.cards.length > 0 && cardTotal > 0 && (
        <section>
          <h3>Fair play</h3>
          <div className="agm-chart">
            <div className="agm-key" aria-hidden="true"><span><i style={{ background: '#EAB308' }} />Yellow cards</span><span><i style={{ background: '#B91C1C' }} />Red cards</span></div>
            <div className="sr-hb">
              {v.cards.map(x => (
                <div key={x.team} role="img" aria-label={`${x.team}: ${x.yellow} yellow, ${x.red} red`}>
                  <span>{x.team}</span>
                  <div className="agm-bar">
                    <span style={{ width: width(x.yellow, cardTotal, '7rem'), background: '#EAB308' }} />
                    {x.red > 0 && <span style={{ width: width(x.red, cardTotal, '7rem'), background: '#B91C1C', marginLeft: -6 }} />}
                    <b>{x.yellow} yellow{x.red ? `, ${x.red} red` : ''}</b>
                  </div>
                </div>
              ))}
            </div>
            {v.cardsNote && <p className="cr-small">{v.cardsNote}</p>}
          </div>
        </section>
      )}

      {(v.cups.length > 0 || (!one && r.events) || v.training.length > 0) && (
        <>
          <h2 className="sr-part">Cups and events<small>Tournaments, socials, trials and training</small></h2>
          <Photo photo={photo(1)} />
        </>
      )}

      {v.cups.length > 0 && (
        <section>
          <h3>Cups and tournaments</h3>
          <ul className="sr-cups">
            {v.cups.map((cup, k) => (
              <li key={k} className={cup.won ? 'is-won' : undefined}>
                <span className="pos">{cup.place}</span><b>{cup.href ? <a href={cup.href}>{cup.name}</a> : cup.name}</b><small>{cup.who}</small><span>{cup.result}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!one && r.events && (
        <>
          <div className="cr-cols">
            <section>
              <h3>Events we held</h3>
              <div className="agm-chart"><Bars rows={r.events.types.map(t => ({ label: t.label, v: t.n }))} colour={c.us} room="3rem" /></div>
            </section>
            {r.events.tickets.length > 0 && (
              <section>
                <h3>Ticket money</h3>
                <div className="agm-chart">
                  <Bars rows={r.events.tickets.slice(0, 5).map(t => ({ label: t.title, v: t.cents }))} colour={c.us} fmt={fmtMoney} />
                  <p className="cr-small">{fmtMoney(r.events.ticketCents)} in total from tickets sold online.</p>
                </div>
              </section>
            )}
          </div>
          {r.events.turnout.length > 0 && (
            <section>
              <h3>Best turnouts</h3>
              <figure className="agm-chart" style={{ margin: '0 0 1rem' }}>
                <div className="agm-key" aria-hidden="true"><span><i style={{ background: '#cbd5e1' }} />Signed up</span><span><i style={{ background: c.us }} />Checked in at the door</span></div>
                <dl className="agm-rows">
                  {r.events.turnout.map(t => {
                    const top = Math.max(1, ...r.events!.turnout.map(x => x.said));
                    return (
                      <div key={t.title + t.date} className="agm-row" aria-label={`${t.title}: ${t.said} signed up, ${t.came} checked in`}>
                        <dt>{t.title}<small>{t.date}</small></dt>
                        <dd className="agm-bar is-last"><span style={{ width: width(t.said, top, '7rem'), background: '#cbd5e1' }} /><b>{t.said} signed up</b></dd>
                        <dd className="agm-bar"><span style={{ width: width(t.came, top, '7rem'), background: c.us }} /><b>{t.came} came</b></dd>
                      </div>
                    );
                  })}
                </dl>
              </figure>
              <p className="cr-small">Check-ins count people scanned in at the door. Events that didn&apos;t use door check-in show signed up only.</p>
            </section>
          )}
        </>
      )}

      {v.training.length > 0 && (
        <section>
          <h3>Training</h3>
          <div className="agm-chart">
            <Bars rows={v.training.map(t => ({ label: t.team, sub: `squad of ${t.squad}`, v: t.avgIn }))} colour="#334155" fmt={x => `${x} said In`} room="6.5rem" />
            <p className="cr-small">{n(v.trainingSessions)} training sessions. This is the average number who said they were coming, from availability replies, not a register taken at training.</p>
          </div>
        </section>
      )}

      {!one && r.committee && !!r.events?.notes.length && (
        <section>
          <h3>From the event reviews</h3>
          <div className="cr-cols">
            <ul className="cr-pts is-good">{r.events.notes.flatMap(x => x.went.map((t, k) => <li key={`${x.from}w${k}`}><span>{t}</span><span className="cr-from">{x.from}</span></li>))}</ul>
            <ul className="cr-pts is-fix">{r.events.notes.flatMap(x => x.next.map((t, k) => <li key={`${x.from}n${k}`}><span>{t}</span><span className="cr-from">{x.from}</span></li>))}</ul>
          </div>
          <p className="cr-small">Committee only. Never in a shared copy.</p>
        </section>
      )}

      {!one && (r.members || r.thanks.length > 0) && (
        <>
          <h2 className="sr-part">Our members<small>Who joined, who came back, and who ran the club</small></h2>
          <Photo photo={photo(2)} />
          {r.members && (
            <>
              <dl className="cr-figs">
                <div><dd>{n(r.members.counted)}</dd><dt>Members</dt></div>
                <div><dd>{n(r.members.players)}</dd><dt>Players</dt></div>
                <div><dd>{n(r.members.others)}</dd><dt>Coaches, volunteers and social</dt></div>
                {r.members.joined !== null && <div><dd>{n(r.members.joined)}</dd><dt>New this season</dt></div>}
              </dl>
              <div className="cr-cols">
                {r.members.tiers.length > 1 && (
                  <section>
                    <h3>Members by type</h3>
                    <div className="agm-chart"><Bars rows={r.members.tiers.slice(0, 8).map(t => ({ label: t.label, v: t.n }))} colour={c.us} room="3rem" /></div>
                  </section>
                )}
                {r.members.renewed + r.members.lapsed > 0 && (
                  <section>
                    <h3>Came back for another season</h3>
                    <div className="agm-chart">
                      <Stack parts={[{ word: 'renewed', v: r.members.renewed, bg: '#15803d', fg: '#fff' }, { word: 'lapsed', v: r.members.lapsed, bg: '#cbd5e1', fg: '#0f172a' }]} />
                      <p className="cr-small">{n(r.members.renewed)} renewed and {n(r.members.lapsed)} {r.members.lapsed === 1 ? 'membership' : 'memberships'} ran out this season without renewing.</p>
                    </div>
                  </section>
                )}
              </div>
              {r.members.joins.length > 1 && (
                <section>
                  <h3>New members, month by month</h3>
                  <figure className="agm-chart" style={{ margin: '0 0 1rem' }}>
                    <div className="agm-months" style={{ '--count': r.members.joins.length, height: 150 } as CSSProperties}>
                      {r.members.joins.map(j => {
                        const top = Math.max(1, ...r.members!.joins.map(x => x.n));
                        return (
                          <div key={j.label} className="agm-month" role="img" aria-label={`${j.label}: ${j.n} joined`}>
                            <span className="agm-mname" aria-hidden="true">{j.label}</span>
                            <div className="agm-cols" aria-hidden="true"><span className="agm-col" style={{ '--v': j.n / top, background: c.us } as CSSProperties}><b>{j.n}</b></span></div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="agm-mlabels" style={{ '--count': r.members.joins.length } as CSSProperties} aria-hidden="true">
                      {r.members.joins.map(j => <span key={j.label}>{j.label}<i style={{ color: '#0f172a' }}>{j.n}</i></span>)}
                    </div>
                  </figure>
                  <p className="cr-small">Counted from when each membership started, not when the account was made, so clubs that moved over from a spreadsheet don&apos;t show a false spike.</p>
                </section>
              )}
            </>
          )}
          {(r.members?.committee.length || r.thanks.length > 0) && (
            <section style={{ breakInside: 'auto' }}>
              <h3>Thank you</h3>
              {!!r.members?.committee.length && (
                <dl className="cr-people" style={{ marginBottom: '.8rem' }}>
                  {r.members.committee.map((m, k) => <div key={k}><dt>{m.title}</dt><dd>{m.name}</dd></div>)}
                </dl>
              )}
              {r.thanks.length > 0 && (
                <div className="sr-thanks">
                  {r.thanks.map(g => (
                    <div key={g.group}>
                      <h5>{g.group}</h5>
                      <ul>{g.people.map((p, k) => <li key={k}>{p.name} {p.role && <small>{p.role}</small>}</li>)}</ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {!one && r.sponsors && (
        <>
          <h2 className="sr-part">Our sponsors<small>Thank you. Here&apos;s what your support did this season.</small></h2>
          <dl className="cr-figs">
            {r.sponsors.cents !== null && r.sponsors.cents > 0 && <div><dd>{fmtMoney(r.sponsors.cents)}</dd><dt>From sponsors</dt></div>}
            <div><dd>{n(r.sponsors.count)}</dd><dt>{r.sponsors.count === 1 ? 'Sponsor' : 'Sponsors'}</dt></div>
            {r.sponsors.views > 0 && <div><dd>{n(r.sponsors.views)}</dd><dt>Logo views</dt></div>}
            {r.sponsors.scans > 0 && <div><dd>{n(r.sponsors.scans)}</dd><dt>Poster QR scans</dt></div>}
          </dl>
          <section style={{ marginTop: 12, breakInside: 'auto' }}>
            <div className="sr-wall">
              {r.sponsors.wall.map((s, k) => (
                <div key={k} className={`sr-sp${s.top ? ' is-top' : ''}`}>
                  <div className="logo">{s.logo ? <img src={s.logo} alt={s.name} loading="lazy" /> : s.name}</div>
                  <span className="tier">{s.logo ? `${s.name} · ` : ''}{s.label}</span>
                  {(s.views > 0 || s.clicks > 0 || s.scans > 0) && (
                    <span className="st"><b>{n(s.views)}</b> views · <b>{n(s.clicks)}</b> clicks{s.scans ? <> · <b>{n(s.scans)}</b> scans</> : null}</span>
                  )}
                </div>
              ))}
            </div>
            {r.sponsors.views > 0 && <p className="cr-small">Views and clicks are from the club website and matchday pages. QR scans are from printed posters.</p>}
          </section>
        </>
      )}

      {!one && money && (
        <>
          <h2 className="sr-part">Money<small>A short summary. The full figures are in the AGM report.</small></h2>
          {money.previous && (
            <AgmVersus season={r.season} previous={money.previous} money={fmtMoney} rows={[
              { label: 'Income', now: money.income, last: money.previousIncome, colour: agmColours(colour).inn },
              { label: 'Expenses', now: money.expenses, last: money.previousExpenses, colour: agmColours(colour).out, spend: true },
              { label: 'Surplus', now: money.surplus, last: money.previousSurplus, colour: '#15803d' },
            ]} />
          )}
          {!money.previous && (
            <dl className="cr-figs" style={{ marginBottom: '1rem' }}>
              <div><dd>{fmtMoney(money.income)}</dd><dt>Income</dt></div>
              <div><dd>{fmtMoney(money.expenses)}</dd><dt>Expenses</dt></div>
              <div><dd>{fmtMoney(money.surplus)}</dd><dt>{money.surplus < 0 ? 'Shortfall' : 'Surplus'}</dt></div>
            </dl>
          )}
          {(money.incomeSlices.length > 0 || money.expenseSlices.length > 0) && (
            <figure className="agm-chart" style={{ margin: '0 0 1rem' }}>
              {money.incomeSlices.length > 0 && <AgmShare title="Where the money came from" slices={money.incomeSlices} base={agmColours(colour).inn} money={fmtMoney} />}
              {money.expenseSlices.length > 0 && <AgmShare title="Where the money went" slices={money.expenseSlices} base={agmColours(colour).out} money={fmtMoney} />}
            </figure>
          )}
          {money.months.length > 0 && (
            <section>
              <h3>Money in and out, month by month</h3>
              <AgmMonths months={money.months} colours={agmColours(colour)} money={fmtMoney} short={shortMoney} />
            </section>
          )}
          {(money.balance || money.fees) && (
            <div className="cr-cols">
              {money.balance && (
                <section>
                  <h3>Bank balance through the season</h3>
                  <div className="agm-chart sr-line"><BalanceLine points={money.balance} colour={c.us} fmt={shortMoney} />
                    <p className="cr-small">Worked out from the opening balance saved in Finance plus the club&apos;s records. Check it against the bank statement.</p></div>
                </section>
              )}
              {money.fees && (
                <section>
                  <h3>Fees collected</h3>
                  <div className="agm-chart">
                    <Stack parts={[{ word: 'paid', v: Math.round((money.fees.collected / money.fees.asked) * 100), bg: '#15803d', fg: '#fff' }, { word: 'owing', v: 100 - Math.round((money.fees.collected / money.fees.asked) * 100), bg: '#B45309', fg: '#fff' }]} />
                    <ul className="agm-legend" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                      <li><i style={{ background: '#15803d' }} /><span>Collected</span><b>{fmtMoney(money.fees.collected)}</b><em>{Math.round((money.fees.collected / money.fees.asked) * 100)}%</em></li>
                      {money.fees.unpaidCount > 0 && <li><i style={{ background: '#B45309' }} /><span>Not paid yet ({money.fees.unpaidCount})</span><b>{fmtMoney(money.fees.unpaid)}</b><em>{100 - Math.round((money.fees.collected / money.fees.asked) * 100)}%</em></li>}
                    </ul>
                    <p className="cr-small">Shown as percent of the {fmtMoney(money.fees.asked)} the club asked for.</p>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}

      {(r.posts || replies.length > 0 || r.next.length > 0) && <h2 className="sr-part">{r.posts ? 'The season in posts and photos' : 'Looking ahead'}<small>{r.posts ? 'Everything the club shared, and what\'s next' : 'What\'s next'}</small></h2>}
      {r.posts && (
        <section>
          <dl className="cr-figs" style={{ marginTop: 0 }}>
            <div><dd>{n(r.posts.articles)}</dd><dt>News articles</dt></div>
            <div><dd>{n(r.posts.photos)}</dd><dt>Photos added</dt></div>
          </dl>
          {r.posts.gallery.length > 0 && <div className="sr-gallery">{r.posts.gallery.map((g, k) => <img key={k} src={g.url} alt={g.title} loading="lazy" />)}</div>}
        </section>
      )}

      {replies.length > 0 && (
        <section>
          <h3>Answering the call</h3>
          <div className="agm-chart">
            <Bars rows={replies.map(x => ({ label: x.team, sub: x.usual ? `most within ${x.usual}` : undefined, v: x.percent }))} colour="#15803d" fmt={x => `${x}%`} room="3.5rem" />
            <p className="cr-small">Share of availability requests for games that got an answer, and how soon half of them came in.</p>
          </div>
        </section>
      )}

      {r.next.length > 0 && (
        <section>
          <h3>Next season</h3>
          <ul className="sr-next">{r.next.map((x, k) => <li key={k}><b>{x.when}</b><span>{x.what}</span></li>)}</ul>
        </section>
      )}

      <footer className="cr-foot"><span>{footer}</span><span>itsfootball.club</span></footer>
    </article>
  );
}

function BalanceLine({ points, colour, fmt }: { points: { label: string; cents: number }[]; colour: string; fmt: (c: number) => string }) {
  const W = 360, H = 150, L = 8, R = 8, T = 22, B = 22;
  const vals = points.map(p => p.cents);
  const max = Math.max(...vals), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = (k: number) => L + (k * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v: number) => T + (1 - (v - min) / span) * (H - T - B);
  const path = points.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(p.cents).toFixed(1)}`).join(' ');
  const peak = vals.indexOf(max);
  const marks = [...new Set([0, peak, points.length - 1])];
  const anchor = (k: number) => (k === 0 ? 'start' : k === points.length - 1 ? 'end' : 'middle');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bank balance from ${fmt(points[0].cents)} to ${fmt(points[points.length - 1].cents)}`}>
      {min < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" />}
      <path d={`${path} L${x(points.length - 1)},${H - B} L${L},${H - B} Z`} fill={colour} fillOpacity={0.08} />
      <path d={path} fill="none" stroke={colour} strokeWidth={2.5} strokeLinejoin="round" />
      {marks.map(k => (
        <g key={k}>
          <circle cx={x(k)} cy={y(points[k].cents)} r={3.5} fill={colour} />
          <text x={x(k)} y={y(points[k].cents) - 8} textAnchor={anchor(k)} className="sr-cv">{fmt(points[k].cents)}</text>
        </g>
      ))}
      {points.map((p, k) => (k % 2 === 0 || k === points.length - 1 ? <text key={`l${k}`} x={x(k)} y={H - 6} textAnchor={anchor(k)} className="sr-cx">{p.label}</text> : null))}
    </svg>
  );
}
