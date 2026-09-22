'use client';

import React, { useState } from 'react';
import { Club, InquiryType } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { Mail, CheckCircle2, Send, X, Shield, Phone } from 'lucide-react';

interface ContactModalProps {
  club: Club;
  isOpen: boolean;
  onClose: () => void;
  defaultType?: InquiryType;
}

export default function ContactModal({ club, isOpen, onClose, defaultType = 'General Inquiry' }: ContactModalProps) {
  const { submitInquiry } = useClub();
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [inquiryType, setInquiryType] = useState<InquiryType>(defaultType);
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Honeypot: hidden from real visitors via CSS + aria-hidden; bots that fill
  // every field they find trip it, and the submission is silently dropped.
  const [website, setWebsite] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderEmail || !message) return;

    setSending(true);
    setSendError(null);
    const result = await submitInquiry({
      club_id: club.id,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_phone: senderPhone,
      inquiry_type: inquiryType,
      message,
    }, website);
    setSending(false);

    if (!result.success) {
      setSendError(result.error || 'Your message could not be sent.');
      return;
    }
    setIsSubmitted(true);
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setSenderName('');
    setSenderEmail('');
    setSenderPhone('');
    setMessage('');
    setWebsite('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '1rem',
    }}>
      <div className="glass-panel" style={{
        margin: 'auto',
        width: '100%',
        maxWidth: '540px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: club.primary_color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Mail size={18} color="#FFFFFF" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                Contact {club.name}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Official inquiries, trials, sponsorships & club office
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid #10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
            }}>
              <CheckCircle2 size={36} color="#10B981" />
            </div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem' }}>
              Message Received!
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
              Thank you for reaching out to <strong>{club.name}</strong>. Our administrative secretariat will review your inquiry and reply to <strong>{senderEmail}</strong> promptly.
            </p>
            <button onClick={handleResetAndClose} className="btn btn-primary">
              Return to Club Page
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Honeypot field: real visitors never see this (off-screen + aria-hidden) */}
            <div style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Your Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Leo Hernandez"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="leo@example.com"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+1 (555) 000-0000"
                  value={senderPhone}
                  onChange={e => setSenderPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Inquiry Purpose</label>
                <select
                  className="form-select"
                  value={inquiryType}
                  onChange={e => setInquiryType(e.target.value as InquiryType)}
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Player Trial">Player Trial / Assessment</option>
                  <option value="Sponsorship">Sponsorship & Partnership</option>
                  <option value="Youth Academy">Youth Academy Enrollment</option>
                  <option value="Media Request">Press & Media Accreditation</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Message *</label>
              <textarea
                required
                rows={4}
                className="form-textarea"
                placeholder="Share background, trial history, or details regarding your inquiry..."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            {sendError && (
              <div role="alert" style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #EF4444', background: 'rgba(239, 68, 68, 0.12)', color: '#FCA5A5', fontSize: '0.8rem' }}>
                {sendError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Club Office: {club.contact_email}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={handleResetAndClose} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={sending} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Send size={14} /> {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
