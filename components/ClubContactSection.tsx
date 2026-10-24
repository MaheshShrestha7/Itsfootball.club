'use client';

import React, { useState } from 'react';
import { Mail, Phone, MessageSquare } from 'lucide-react';
import type { Club, InquiryType } from '@/lib/supabase/types';
import ContactModal from '@/components/ContactModal';

/** "Get in touch": the club's email and phone, and a button that opens the contact form (it lands
 *  in the club's Inbox). On the club home, About and Sponsor pages; #contact links here. */
export default function ClubContactSection({ club, defaultType, heading = 'Get in touch' }: { club: Club; defaultType?: InquiryType; heading?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section id="contact" aria-labelledby="club-contact-heading" style={{ scrollMarginTop: '90px' }}>
      <h2 id="club-contact-heading" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>{heading}</h2>
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.9rem 2rem' }}>
        <p style={{ flex: '1 1 260px', margin: 0, color: 'var(--text-secondary)' }}>
          Questions about joining, sponsorship or matchdays? Send {club.name} a message and the committee will reply by email.
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
      <ContactModal club={club} isOpen={open} onClose={() => setOpen(false)} defaultType={defaultType} />
    </section>
  );
}
