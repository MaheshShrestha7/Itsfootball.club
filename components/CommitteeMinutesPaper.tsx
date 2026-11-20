import type { CSSProperties } from 'react';
import type { MinutesReport } from '@/lib/committee-meetings';
import { cell, heading, heavy, ink, muted, paper, PAPER_PRINT_CSS, rule, small, th } from '@/lib/report-paper';
import { crestInitials } from '@/components/CupReportPaper';

// A committee meeting's minutes on white paper, the same in admin and behind a share link
const pill = (bg: string, fg: string): CSSProperties => ({ fontSize: '0.72rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: bg, color: fg, whiteSpace: 'nowrap' });

export default function CommitteeMinutesPaper({ report, colour, logoUrl, footer }: {
  report: MinutesReport;
  colour?: string | null;
  logoUrl?: string | null;
  footer?: string;
}) {
  const r = report;
  return (
    <article className="agm-paper" style={paper}>
      <style>{PAPER_PRINT_CSS}</style>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: heavy }}>
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', minWidth: 0 }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
            : <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 12, background: colour || ink, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>{crestInitials(r.club)}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>{r.club}</div>
            <div style={{ color: muted, fontSize: '0.82rem' }}>{r.title} minutes</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: ink }}>{r.day}</h2>
          <div style={{ fontWeight: 700 }}>{r.time}</div>
          {r.location && <div style={{ color: muted, fontSize: '0.85rem' }}>{r.location}</div>}
        </div>
      </header>

      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, max-content) minmax(0, 1fr)', gap: '0.3rem 1rem', margin: '1rem 0 0', fontSize: '0.86rem' }}>
        {r.topic && <><dt style={{ color: muted, fontWeight: 700 }}>Topic</dt><dd style={{ margin: 0 }}>{r.topic}</dd></>}
        <dt style={{ color: muted, fontWeight: 700 }}>Present</dt><dd style={{ margin: 0 }}>{r.present.join(', ') || '—'}</dd>
        {r.apologies.length > 0 && <><dt style={{ color: muted, fontWeight: 700 }}>Apologies</dt><dd style={{ margin: 0 }}>{r.apologies.join(', ')}</dd></>}
      </dl>

      <section>
        <h3 style={heading}>Decisions</h3>
        {r.decisions.length
          ? <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>{r.decisions.map((d, i) => <li key={i} style={{ margin: '0.3rem 0' }}>{d.text} <span style={{ color: muted }}>({d.no})</span></li>)}</ol>
          : <p style={{ ...small, marginTop: 0 }}>No decisions were recorded.</p>}
      </section>

      <section>
        <h3 style={heading}>Actions</h3>
        {r.actions.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>What</th><th style={th}>Who</th><th style={th}>By</th><th style={th}><span className="sr-only">Carried over</span></th></tr></thead>
            <tbody>
              {r.actions.map((a, i) => (
                <tr key={i}>
                  <td style={cell}>{a.text}</td>
                  <td style={cell}>{a.who || '—'}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{a.due || '—'}</td>
                  <td style={cell}>{a.from ? <span style={pill('#fef3c7', '#92400e')}>{a.from}</span> : <span style={pill('#f1f5f9', '#334155')}>New</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ ...small, marginTop: 0 }}>No open actions.</p>}
        {r.closed.length > 0 && <p style={small}>Closed at this meeting: {r.closed.join(', ')}.</p>}
      </section>

      {r.figures && r.figures.groups.length > 0 && (
        <section>
          <h3 style={heading}>{r.topic ? `${r.topic} figures on the day` : 'Club figures on the day'}</h3>
          {r.figures.groups.map(g => (
            <div key={g.title} style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.72rem', letterSpacing: '0.04em', color: muted, fontWeight: 700, textTransform: 'uppercase' }}>{g.title}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>{g.rows.map((row, i) => <tr key={i}><td style={cell}>{row.label}</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{row.value}</td></tr>)}</tbody>
              </table>
            </div>
          ))}
          {r.figures.note && <p style={small}>{r.figures.note}</p>}
        </section>
      )}

      {r.notes.length > 0 && (
        <section>
          <h3 style={heading}>Notes by item</h3>
          {r.notes.map(n => (
            <div key={n.no} style={{ marginTop: n.heading ? '0.9rem' : '0.5rem' }}>
              <div style={{ fontWeight: n.heading ? 800 : 700 }}>{n.no}. {n.title}{n.lead ? ` (${n.lead})` : ''}</div>
              {n.text && <p style={{ margin: '0.15rem 0 0', color: '#334155', fontSize: '0.86rem', whiteSpace: 'pre-line' }}>{n.text}</p>}
            </div>
          ))}
        </section>
      )}

      {r.next && (
        <section>
          <h3 style={heading}>Next meeting</h3>
          <p style={{ margin: 0 }}>{r.next}. Open actions carry over to that agenda.</p>
        </section>
      )}

      <section style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
        <div style={{ borderTop: `1px solid ${ink}`, paddingTop: '0.35rem', marginTop: '1.5rem', fontSize: '0.84rem' }}>Secretary: name, signature and date</div>
        <div style={{ borderTop: `1px solid ${ink}`, paddingTop: '0.35rem', marginTop: '1.5rem', fontSize: '0.84rem' }}>President: name, signature and date</div>
      </section>
      {footer && <p style={{ ...small, marginTop: '1.5rem', borderTop: rule, paddingTop: '0.5rem' }}>{footer}</p>}
    </article>
  );
}
