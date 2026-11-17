'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fetchPaged } from '@/lib/paged';
import { countBySource, summariseSources, type SourceSummary } from '@/lib/visit-source';

type Row = { event_type: string; referrer: string | null; metadata: unknown; visitor_hash: string | null; created_at: string };

const n = (v: number) => v.toLocaleString('en-AU');

/** Mission Control, Public site traffic: named sources, tagged links (campaigns) and the source that
 *  first brought each new club. Read straight from platform_analytics (platform admins only). */
export default function TrafficSources({ days }: { days: number }) {
  const [data, setData] = useState<{ sum: SourceSummary; clubs: [string, number][]; capped: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let stale = false;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const MAX = 20000;
    fetchPaged<Row>((from, to) => client.from('platform_analytics')
      .select('event_type, referrer, metadata, visitor_hash, created_at')
      .in('event_type', ['page_view', 'club_created'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to), MAX)
      .then(({ data: rows, error: err }) => {
        if (stale) return;
        if (err) { setError(err); return; }
        setData({
          sum: summariseSources(rows.filter(r => r.event_type === 'page_view')),
          clubs: countBySource(rows.filter(r => r.event_type === 'club_created')),
          capped: rows.length >= MAX,
        });
      });
    return () => { stale = true; };
  }, [days]);

  if (error) return <div className="mc-card wide"><p className="mc-muted">Could not load sources: {error}</p></div>;
  if (!data) return <div className="mc-card wide"><p className="mc-muted">Loading sources…</p></div>;
  const { sum, clubs } = data;
  const top = sum.sources[0]?.[1] || 1;
  const clubTotal = clubs.reduce((a, [, v]) => a + v, 0);

  return (
    <>
      <div className="mc-card">
        <div className="mc-card-h"><h3>Sources in detail</h3><span className="mc-eyebrow">{n(sum.visits)} visits</span></div>
        <p className="mc-muted" style={{ marginTop: 0 }}>One visit = one browser on one day{data.capped ? ', newest 20,000 page views' : ''}.</p>
        <div className="mc-funnel">
          {sum.sources.length ? sum.sources.slice(0, 10).map(([k, v]) => (
            <div key={k} className="mc-funnel-row">
              <div className="top"><span title={k}>{k}</span><span className="num">{n(v)}</span></div>
              <div className="mc-track"><span style={{ width: `${Math.max(3, (v / top) * 100)}%`, background: 'var(--mc-indigo)' }} /></div>
            </div>
          )) : <p className="mc-muted">No visits counted yet.</p>}
        </div>
      </div>

      <div className="mc-card">
        <div className="mc-card-h"><h3>Tagged links</h3></div>
        <p className="mc-muted" style={{ marginTop: 0 }}>Links with utm_campaign, e.g. ?utm_source=facebook&amp;utm_campaign=nov-group-post</p>
        <div className="mc-ov-legend" style={{ gridTemplateColumns: '1fr' }}>
          {sum.campaigns.length ? sum.campaigns.slice(0, 10).map(c => (
            <span key={`${c.campaign}|${c.how}`} title={c.from}>{c.campaign}<small className="mc-muted"> · {c.from || c.how}</small><b className="num">{n(c.visits)}</b></span>
          )) : <p className="mc-muted">No tagged links visited yet.</p>}
        </div>
      </div>

      <div className="mc-card">
        <div className="mc-card-h"><h3>Clubs created, by first source</h3><span className="mc-eyebrow">{n(clubTotal)}</span></div>
        <div className="mc-ov-legend" style={{ gridTemplateColumns: '1fr' }}>
          {clubs.length ? clubs.map(([k, v]) => <span key={k}>{k}<b className="num">{n(v)}</b></span>) : <p className="mc-muted">No clubs created from the site in this period.</p>}
        </div>
      </div>
    </>
  );
}
