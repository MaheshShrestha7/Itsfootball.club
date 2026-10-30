'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGroundSponsors } from '@/components/GroundSponsors';
import { SITE_URL } from '@/lib/seo';
import { shareLink } from '@/lib/share-card';
import type { Club } from '@/lib/supabase/types';
import type { GroundSponsor } from '@/lib/sponsor-ground-server';
import PrintablePoster, { PrintSponsorTile } from './PrintablePoster';

const ZOOM = { A5: 0.82, A4: 1.18, A3: 1.7 };
// Logo tiles get smaller down the tiers, so the biggest sponsors stand out
const TILE: Record<string, { height: number; width: number }> = {
  platinum: { height: 104, width: 210 },
  gold: { height: 80, width: 160 },
  silver: { height: 64, width: 128 },
  bronze: { height: 52, width: 104 },
  grassroots: { height: 46, width: 92 },
};

/** "Thank you to our sponsors": a printable poster for the clubhouse, canteen or noticeboard with
 *  every sponsor whose package includes the thank-you poster, and a QR to Become a Sponsor */
export default function SponsorThanksPoster({ club, onClose }: {
  club: Pick<Club, 'id' | 'name' | 'slug' | 'logo_url' | 'primary_color' | 'custom_domain'>;
  onClose: () => void;
}) {
  const sponsors = useGroundSponsors(club.id, 'thanks_poster');
  const accent = club.primary_color || '#10B981';
  const signupUrl = club.custom_domain ? `https://${club.custom_domain}/sponsor` : `${SITE_URL}/${club.slug}/sponsor`;
  // One row per tier, in the order the list comes in (biggest tier first)
  const rows: { tier: string; list: GroundSponsor[] }[] = [];
  for (const s of sponsors || []) {
    const last = rows[rows.length - 1];
    if (last?.tier === s.tier) last.list.push(s);
    else rows.push({ tier: s.tier, list: [s] });
  }

  return (
    <PrintablePoster accent={accent} zoom={ZOOM} onClose={onClose} controls={sponsors !== null && !sponsors.length && (
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748B' }}>
        No sponsors on this poster yet. Tick &quot;Sponsor thank-you poster&quot; on a package in Sponsors, Packages.
      </p>
    )}>
      {club.logo_url && (
        <img src={club.logo_url} alt="" style={{ height: 72, maxWidth: 160, objectFit: 'contain', marginBottom: '0.75rem' }} />
      )}
      <div style={{ textTransform: 'uppercase', fontWeight: 900, color: accent, letterSpacing: '0.12em', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
        {club.name}
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.15, marginBottom: '0.5rem' }}>Thank you to our sponsors</h1>
      <p style={{ color: '#475569', fontSize: '0.95rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        Please support the local businesses who support our club.
      </p>

      {sponsors === null ? (
        <p style={{ color: '#64748B', marginBottom: '1.5rem' }}>Loading sponsors…</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.9rem', marginBottom: '1.75rem' }}>
          {rows.map(row => (
            <div key={row.tier} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.7rem' }}>
              {row.list.map(sp => (
                <PrintSponsorTile key={sp.id} name={sp.name} logoUrl={sp.logo_url} {...(TILE[sp.tier] || TILE.grassroots)} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left', background: '#F1F5F9', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '1.75rem' }}>
        <div style={{ background: '#fff', padding: 6, borderRadius: 8, lineHeight: 0, flexShrink: 0 }}>
          <QRCodeSVG value={signupUrl} size={88} level="M" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>Want your business here?</div>
          <div style={{ fontSize: '0.82rem', color: '#475569' }}>Scan to become a sponsor, or visit {shareLink(club)}/sponsor</div>
        </div>
      </div>
    </PrintablePoster>
  );
}
