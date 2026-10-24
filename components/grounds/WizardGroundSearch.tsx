'use client';

// The new-club wizard's "Find your ground" search: picks a ground from the public grounds directory
// (published grounds are readable by anyone, migration 20261109) to fill in the home ground name and
// address. Once the club is saved, the wizard makes it the club's home ground (Admin -> Branding ->
// Home ground guide). Shows nothing when the directory isn't available.
import { useEffect, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { slugify, type GroundRow } from '@/lib/grounds';

export type WizardGround = Pick<GroundRow, 'id' | 'name' | 'suburb' | 'state' | 'postcode' | 'address' | 'pitches' | 'parking'>;

interface Props {
  picked: WizardGround | null;
  onPick: (ground: WizardGround | null) => void;
}

const COLUMNS = 'id,name,suburb,state,postcode,address,pitches,parking';

export default function WizardGroundSearch({ picked, onPick }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<WizardGround[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const s = slugify(q);
    if (s.length < 2) return;
    const client = getSupabaseClient();
    if (!client) return;
    const t = setTimeout(async () => {
      const { data } = await client
        .from('grounds')
        .select(COLUMNS)
        .eq('is_published', true)
        .or(`slug.ilike.%${s}%,suburb_slug.ilike.%${s}%,postcode.eq.${/^\d{4}$/.test(q.trim()) ? q.trim() : '0000'}`)
        .order('name')
        .limit(6);
      setResults((data || []) as WizardGround[]);
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Results only for a search long enough to run (shorter text hides the last results)
  const typed = slugify(q).length >= 2;

  if (picked) {
    return (
      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <MapPin size={18} color="var(--club-primary)" aria-hidden="true" />
        <span style={{ flex: 1, fontSize: '0.85rem' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{picked.name}</strong>, {picked.suburb} {picked.state}
          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Linked to its public ground guide: directions, parking and wet-weather info show on your match pages.
          </span>
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPick(null)} aria-label="Unlink this ground">
          <X size={14} /> Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label htmlFor="create-club-find-ground" className="form-label">Find your ground (optional)</label>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} aria-hidden="true" />
        <input id="create-club-find-ground" className="form-input" style={{ paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Ground name, suburb or postcode" autoComplete="off" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
      </div>
      {typed && (results.length > 0 || searched) && (
        <div className="glass-panel" style={{ marginTop: '0.4rem', padding: '0.35rem', display: 'flex', flexDirection: 'column' }}>
          {results.map(r => (
            <button key={r.id} type="button" onClick={() => { onPick(r); setQ(''); }}
              style={{ textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 10, display: 'flex', gap: '0.7rem', alignItems: 'center', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <MapPin size={16} color="var(--club-primary)" aria-hidden="true" />
              <span><strong style={{ color: 'var(--text-primary)' }}>{r.name}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.suburb} {r.state}</span></span>
            </button>
          ))}
          {results.length === 0 && (
            <p style={{ margin: 0, padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Not in the grounds directory yet. Type the name below: you can add its guide later under Branding.
            </p>
          )}
        </div>
      )}
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
        Pick it from the grounds directory to fill in the name and address and link its guide.
      </p>
    </div>
  );
}
