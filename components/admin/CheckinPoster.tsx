'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGroundSponsors } from '@/components/GroundSponsors';
import PrintablePoster, { PrintSponsorTile } from './PrintablePoster';

const ZOOM = { A5: 0.82, A4: 1.18, A3: 1.7 };

/** The printable door check-in poster for a match or an event: the door QR and, under it, the
 *  sponsors whose package includes check-in posters (an event's own sponsors first) */
export default function CheckinPoster({ club, title, details, checkinUrl, eventId, disabledNotice, onClose }: {
  club: { id: string; name: string; primary_color?: string | null };
  title: string;
  details: string;
  /** null while the door code is being fetched */
  checkinUrl: string | null;
  eventId?: string;
  /** Shown on screen only, e.g. when door check-in is turned off */
  disabledNotice?: string;
  onClose: () => void;
}) {
  const sponsors = useGroundSponsors(club.id, 'checkin_posters', eventId);
  const [showSponsors, setShowSponsors] = useState(true);
  const accent = club.primary_color || '#10B981';

  return (
    <PrintablePoster accent={accent} zoom={ZOOM} onClose={onClose} controls={sponsors !== null && (
      sponsors.length ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={showSponsors} onChange={e => setShowSponsors(e.target.checked)} style={{ width: 17, height: 17 }} />
          Show sponsors ({sponsors.length})
        </label>
      ) : (
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748B' }}>
          No sponsors on this poster yet. Tick &quot;Check-in posters&quot; on a package in Sponsors, Packages.
        </p>
      )
    )}>
      {disabledNotice && (
        <p className="no-print" role="status" style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {disabledNotice}
        </p>
      )}
      <div style={{ textTransform: 'uppercase', fontWeight: 900, color: club.primary_color || 'var(--c-green)', letterSpacing: '0.1em', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
        {club.name} • Check In Here
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2, marginBottom: '0.5rem' }}>{title}</h1>
      <p style={{ color: '#475569', fontSize: '1rem', fontWeight: 600, marginBottom: '2rem' }}>{details}</p>

      <div style={{ display: 'inline-block', padding: '1rem', border: '3px solid #0F172A', borderRadius: '16px', marginBottom: '1.75rem' }}>
        {checkinUrl ? (
          <QRCodeSVG value={checkinUrl} size={260} level="H" includeMargin={false} />
        ) : (
          <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            Generating check-in code...
          </div>
        )}
      </div>

      <div style={{ background: '#F1F5F9', borderRadius: '12px', padding: '1rem', marginBottom: '2rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A', marginBottom: '0.2rem' }}>SCAN WITH MOBILE CAMERA</div>
        <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
          {eventId ? 'Check in with your Member Pass or as a guest at the door.' : 'Validate your Member Pass or check in as a Guest Supporter at the gate.'}
        </div>
      </div>

      {showSponsors && !!sponsors?.length && (
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', color: '#64748B', marginBottom: '0.6rem' }}>
            {eventId ? 'THIS EVENT IS SUPPORTED BY' : 'OUR SPONSORS'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.6rem' }}>
            {sponsors.map(sp => <PrintSponsorTile key={sp.id} name={sp.name} logoUrl={sp.logo_url} />)}
          </div>
        </div>
      )}
    </PrintablePoster>
  );
}
