import { FileText } from 'lucide-react';

/** The full-time report under the scoreboard: plain sentences in a glass panel */
export default function MatchReport({ paragraphs, source }: { paragraphs: string[]; source: string }) {
  if (!paragraphs.length) return null;
  return (
    <section
      aria-label="Match report"
      className="glass-panel"
      style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: 'var(--radius-xl)', borderLeft: '4px solid var(--club-primary)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <FileText size={16} color="var(--club-ink)" />
        <h2 style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--club-ink)', margin: 0 }}>
          Match report
        </h2>
      </div>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: i === 0 ? '1.05rem' : '0.95rem', fontWeight: i === 0 ? 600 : 400, lineHeight: 1.65, margin: i ? '0.5rem 0 0' : 0 }}>
          {p}
        </p>
      ))}
      <p className="text-meta" style={{ marginTop: '0.85rem', fontSize: '0.75rem' }}>{source}</p>
    </section>
  );
}
