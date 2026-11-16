import type { CSSProperties } from 'react';
import type { EventReport } from '@/lib/event-report';
import { PAPER_PRINT_CSS } from '@/lib/report-paper';
import { chartColours, crestInitials, REPORT_CSS } from '@/components/CupReportPaper';

// An event's summary on white paper, the same on the admin page and behind a share link.
// The full version (names, notes for next time, who missed training) is only on the admin page.
export default function EventReportPaper({ report, colour, logoUrl, footer }: {
  report: EventReport;
  colour?: string | null;
  logoUrl?: string | null;
  footer: string;
}) {
  const committee = !!report.names;
  return (
    <article className="agm-paper cr-paper" style={{ '--club': chartColours(colour).us } as CSSProperties}>
      <style>{REPORT_CSS + PAPER_PRINT_CSS}</style>
      <header className="cr-head">
        {logoUrl
          ? <img className="cr-crest" src={logoUrl} alt="" width={54} height={54} />
          : <div className="cr-crest" aria-hidden="true">{crestInitials(report.club)}</div>}
        <div>
          <h1>{report.title}</h1>
          <p>{report.meta}</p>
        </div>
        <span className="cr-tag">{report.completed ? 'Completed' : committee ? 'Committee' : 'Summary'}</span>
      </header>

      <p className="cr-open">{report.opening}</p>
      <dl className="cr-figs">
        {report.figures.map(f => <div key={f.label}><dd>{f.value}</dd><dt>{f.label}</dt></div>)}
      </dl>

      {report.games.length > 0 && (
        <>
          <h2>Games</h2>
          <ul className="cr-games">
            {report.games.map(g => (
              <li key={g.id}>
                {g.outcome && <span className={`cr-res is-${g.outcome}`}>{g.outcome}</span>}
                <b>{g.score}</b>
                <span>{g.opponent}<small>{g.when}</small></span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(report.wentWell.length > 0 || !!report.nextTime?.length) && (
        <div className="cr-cols">
          {report.wentWell.length > 0 && (
            <section>
              <h2>What went well</h2>
              <ul className="cr-pts is-good">{report.wentWell.map((t, i) => <li key={i}><span>{t}</span></li>)}</ul>
            </section>
          )}
          {!!report.nextTime?.length && (
            <section>
              <h2>What to change next time</h2>
              <ul className="cr-pts is-fix">{report.nextTime.map((t, i) => <li key={i}><span>{t}</span></li>)}</ul>
            </section>
          )}
        </div>
      )}

      {!!report.names?.length && (
        <section>
          <h2>Checked in ({report.names.length})</h2>
          <ul className="cr-names">{report.names.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </section>
      )}

      {!!report.missed?.length && (
        <section>
          <h2>From the squad, didn&apos;t check in ({report.missed.length})</h2>
          <ul className="cr-names">{report.missed.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </section>
      )}

      <footer className="cr-foot">
        <span>{footer}</span>
        <span>itsfootball.club</span>
      </footer>
    </article>
  );
}
