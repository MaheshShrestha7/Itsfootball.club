'use client';

// The organiser's screen for a public tournament: page details plus the same tournament admin
// (scores, schedule, teams, bracket) a club uses, for the tournament-only club behind the page.

import React, { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, EyeOff, ExternalLink } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AdminGuard from '@/components/AdminGuard';
import { confirmAction } from '@/components/ConfirmDialog';
import TournamentAdminScreen from '@/components/tournament/TournamentAdminScreen';
import { useClub } from '@/lib/club-context';
import { MAKER_PATH, TEAM_SIZES, isCleanName, isEventClub, tournamentPagePath } from '@/lib/public-tournaments';
import type { Club, ClubConfig } from '@/lib/supabase/types';

/** "Name | https://site" per line <-> sponsors */
const sponsorsToText = (s: ClubConfig['sponsors']) => (s || []).map(x => (x.url ? `${x.name} | ${x.url}` : x.name)).join('\n');
function textToSponsors(text: string): NonNullable<ClubConfig['sponsors']> {
  return text.split(/\r?\n/).map(line => {
    const [name, url] = line.split('|').map(p => p.trim());
    const link = url && /^https?:\/\//i.test(url) ? url : url ? `https://${url}` : undefined;
    return { name: (name || '').slice(0, 60), ...(link ? { url: link.slice(0, 200) } : {}) };
  }).filter(s => s.name).slice(0, 12);
}

function PageDetails({ club }: { club: Club }) {
  const { updateClubBranding } = useClub();
  const router = useRouter();
  const config = (club.config || {}) as ClubConfig;
  const [organiser, setOrganiser] = useState(config.organiser || '');
  const [teamSize, setTeamSize] = useState(config.team_size || '');
  const [sponsors, setSponsors] = useState(sponsorsToText(config.sponsors));
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const list = textToSponsors(sponsors);
    if (![organiser, ...list.map(s => s.name)].every(isCleanName)) {
      setMessage({ tone: 'error', text: 'Please remove offensive words before saving.' });
      return;
    }
    updateClubBranding(club.id, { config: { ...config, organiser: organiser.trim().slice(0, 80) || undefined, team_size: teamSize || undefined, sponsors: list } });
    setMessage({ tone: 'ok', text: 'Saved. The public page updates straight away.' });
    setTimeout(() => setMessage(null), 3500);
  };

  const takeDown = async () => {
    const ok = await confirmAction({
      title: 'Take this tournament page down?',
      message: 'The link stops working for everyone and the page leaves search results. Contact us if you want it back.',
      confirmLabel: 'Take it down',
      danger: true,
    });
    if (!ok) return;
    updateClubBranding(club.id, { is_active: false });
    router.push(MAKER_PATH);
  };

  return (
    <form onSubmit={save} className="glass-panel" style={{ padding: '1.25rem 1.4rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <h2 className="lineup-tool-section" style={{ margin: 0 }}>Page details</h2>
        <Link href={tournamentPagePath(club.slug)} target="_blank" style={{ color: 'var(--c-green)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          itsfootball.club{tournamentPagePath(club.slug)} <ExternalLink size={13} />
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="pd-organiser">Organised by <span className="lineup-tool-optional">(optional)</span></label>
          <input id="pd-organiser" className="form-input" value={organiser} maxLength={80} onChange={e => setOrganiser(e.target.value)} placeholder="e.g. Nepalese Community Sydney" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pd-size">Team size <span className="lineup-tool-optional">(optional)</span></label>
          <select id="pd-size" className="form-select" value={teamSize} onChange={e => setTeamSize(e.target.value)}>
            <option value="">Not shown</option>
            {TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="pd-sponsors">Sponsors <span className="lineup-tool-optional">(one per line, add &quot;| website&quot; to link it)</span></label>
        <textarea id="pd-sponsors" className="form-input" rows={3} value={sponsors} onChange={e => setSponsors(e.target.value)} placeholder={'Everest Momo House | everestmomo.com.au\nHarris Park Pharmacy'} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary btn-sm"><Save size={14} /> Save details</button>
          {message && <span role="status" style={{ fontSize: '0.85rem', fontWeight: 700, color: message.tone === 'ok' ? 'var(--c-green)' : 'var(--c-red)' }}>{message.text}</span>}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={takeDown}><EyeOff size={14} /> Take the page down</button>
      </div>
    </form>
  );
}

export default function ManagePublicTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { selectClubBySlug, tournaments } = useClub();
  const found = selectClubBySlug(slug);
  const club = found && isEventClub(found) ? found : null;
  const tournament = club ? tournaments.find(t => t.club_id === club.id) : undefined;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />
      {/* Not .container: its stacking context would put the footer over the score popups */}
      <main style={{ padding: '2rem 1rem 3rem', flex: 1, width: '100%', maxWidth: '1300px', margin: '0 auto' }}>
        {!club || !tournament ? (
          <p className="text-secondary" style={{ padding: '4rem 0', textAlign: 'center' }}>Loading your tournament...</p>
        ) : (
          <AdminGuard club={club}>
            <PageDetails club={club} />
            <TournamentAdminScreen clubSlug={club.slug} tournamentId={tournament.id} />
          </AdminGuard>
        )}
      </main>
      <Footer />
    </div>
  );
}
