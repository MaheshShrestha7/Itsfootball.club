'use client';

import React, { useState } from 'react';
import { Mail, Phone, MessageSquare } from 'lucide-react';
import type { Club, InquiryType } from '@/lib/supabase/types';
import ContactModal from '@/components/ContactModal';
import { clubSocials } from '@/lib/club-socials';

/** "Get in touch": the club's email and phone, and a button that opens the contact form (it lands
 *  in the club's Inbox). On the club home, About and Sponsor pages; #contact links here. */
export default function ClubContactSection({ club, defaultType, heading = 'Get in touch' }: { club: Club; defaultType?: InquiryType; heading?: string }) {
  const [open, setOpen] = useState(false);
  const socials = clubSocials(club.config);
  return (
    <section id="contact" aria-labelledby="club-contact-heading" style={{ scrollMarginTop: '90px' }}>
      <h2 id="club-contact-heading" style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{heading}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.9rem 2rem' }}>
        <p style={{ flex: '1 1 260px', margin: 0, color: 'var(--text-secondary)' }}>
          Questions about joining, sponsorship or matchdays? The committee will reply by email.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
          <MessageSquare size={17} aria-hidden="true" /> Message the club
        </button>
        {club.contact_email && (
          <a href={`mailto:${club.contact_email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600, overflowWrap: 'anywhere', minHeight: '44px' }}>
            <Mail size={18} color="var(--club-primary)" className="shrink-0" aria-hidden="true" /> {club.contact_email}
          </a>
        )}
        {club.contact_phone && (
          <a href={`tel:${club.contact_phone.replace(/[^\d+]/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600, minHeight: '44px' }}>
            <Phone size={18} color="var(--club-primary)" className="shrink-0" aria-hidden="true" /> {club.contact_phone}
          </a>
        )}
      </div>
      {socials.length > 0 && (
        <div className="glass-panel" style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1.25rem' }}>
          <div style={{ marginRight: 'auto' }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>Follow {club.short_name || club.name}</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Match photos, results and club news.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {socials.map(s => (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer me" className="social-chip"
                aria-label={`${club.name} on ${s.name} (opens in a new tab)`} style={{ '--brand': s.color } as React.CSSProperties}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
                {s.name}
              </a>
            ))}
          </div>
        </div>
      )}
      <ContactModal club={club} isOpen={open} onClose={() => setOpen(false)} defaultType={defaultType} />
    </section>
  );
}
