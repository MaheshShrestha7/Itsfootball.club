'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Club, ClubMember, ClubTeam, Match } from '@/lib/supabase/types';
import PlayerAvatar from './PlayerAvatar';
import { renderPassImage, savePassImage } from '@/lib/pass-image';
import {
  Shield,
  CheckCircle2,
  RotateCw,
  Download,
  Sparkles
} from 'lucide-react';

interface VirtualPassCardProps {
  club: Club;
  member: ClubMember;
  /** The member's teams, shown on the back */
  teams?: ClubTeam[];
  /** The member's next fixture, shown on the back */
  nextMatch?: Match;
  /** Opens the renewal form; the back offers it from 30 days before expiry */
  onRenew?: () => void;
}

const ROLE_LABELS: Record<string, string> = { player: 'Player', supporter: 'Supporter', staff: 'Staff', manager: 'Manager' };

/** "30 Jun 2027", or "Sat 18 Oct" with the weekday; '' when the date can't be read */
function formatDay(value: string | undefined | null, withWeekday = false): string {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, withWeekday
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

function BackRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

export default function VirtualPassCard({ club, member, teams = [], nextMatch, onRenew }: VirtualPassCardProps) {
  // Hidden by default so a screenshot of the pass doesn't carry it
  const [showEmergency, setShowEmergency] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  // The QR on the card is small for a gate camera: tapping it shows it full screen
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!showQr) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowQr(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQr]);
  const [tilt, setTilt] = useState({
    rotX: 0,
    rotY: 0,
    glareX: 50,
    glareY: 50,
    isHovered: false,
  });

  const cardRef = useRef<HTMLDivElement>(null);

  const isExpired = new Date(member.membership_expires_at) < new Date();
  const isSuspended = member.status === 'suspended';
  // Whole days from today to the expiry date: 0 on the last day, negative once expired
  const daysLeft = (() => {
    const expiry = member.membership_expires_at ? new Date(`${member.membership_expires_at.slice(0, 10)}T00:00:00`) : null;
    if (!expiry || Number.isNaN(expiry.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((expiry.getTime() - today.getTime()) / 86400000);
  })();
  const roleLabel = member.is_executive ? '' : ROLE_LABELS[(member.role || '').toLowerCase()] || '';
  const directionsUrl = club.stadium_lat != null && club.stadium_lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${club.stadium_lat},${club.stadium_lng}`
    : club.stadium_address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(club.stadium_address)}`
    : '';

  // Handle cursor / touch pointer move for 3D tilt and specular glare
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Normalized from -1 to 1
    const normX = (x - centerX) / centerX;
    const normY = (y - centerY) / centerY;

    // Max rotation ±11 degrees for realistic physical rigidity
    const rotX = -normY * 11;
    const rotY = normX * 11;

    // Glare position in percentages (0% to 100%)
    const glareX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const glareY = Math.max(0, Math.min(100, (y / rect.height) * 100));

    setTilt({
      rotX,
      rotY,
      glareX,
      glareY,
      isHovered: true,
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    setTilt({
      rotX: 0,
      rotY: 0,
      glareX: 50,
      glareY: 50,
      isHovered: false,
    });
  }, []);

  const handleFlipToggle = () => {
    setIsFlipped(prev => !prev);
  };

  const handleSavePass = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving || !qrCanvasRef.current) return;
    setSaving(true);
    setSaveError('');

    try {
      const status = isSuspended ? 'SUSPENDED' : isExpired ? 'EXPIRED' : 'ACTIVE';
      const blob = await renderPassImage(club, member, qrCanvasRef.current, status);
      const namePart = member.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'member';
      const saved = await savePassImage(blob, `${club.slug}-pass-${namePart}.png`);
      if (!saved) return; // share sheet cancelled

      setDownloadSuccess(true);
      try {
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.6 },
          colors: [club.primary_color || '#10B981', '#F59E0B', '#FFFFFF'],
        });
      } catch {
        // Fallback if confetti fails
      }
      setTimeout(() => setDownloadSuccess(false), 2600);
    } catch {
      setSaveError('Could not save the pass on this device. Take a screenshot of the card instead.');
    } finally {
      setSaving(false);
    }
  };

  // Base card 3D transform combining tilt, scale and 180deg flip
  const cardTransform = isFlipped
    ? `perspective(1200px) rotateY(180deg) rotateX(${tilt.rotX}deg) rotateY(${-tilt.rotY}deg) ${tilt.isHovered ? 'scale3d(1.025, 1.025, 1.025)' : 'scale3d(1, 1, 1)'}`
    : `perspective(1200px) rotateX(${tilt.rotX}deg) rotateY(${tilt.rotY}deg) ${tilt.isHovered ? 'scale3d(1.025, 1.025, 1.025)' : 'scale3d(1, 1, 1)'}`;

  // Dynamic realistic drop shadow that shifts opposite to the tilt direction
  const dynamicShadow = tilt.isHovered
    ? `${-tilt.rotY * 2.2}px ${tilt.rotX * 2.2 + 22}px 45px rgba(0, 0, 0, 0.8), 0 0 35px rgba(var(--club-primary-rgb), 0.35)`
    : '0 20px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(var(--club-primary-rgb), 0.2)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
      {/* 3D Perspective Card Container */}
      <div className="pass-card-container">
        <div
          ref={cardRef}
          className="pass-card"
          onClick={handleFlipToggle}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          title="Click to flip pass details"
          style={{
            transform: cardTransform,
            boxShadow: dynamicShadow,
            transition: tilt.isHovered
              ? 'transform 0.08s ease-out, box-shadow 0.15s ease-out'
              : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.65s ease',
            cursor: 'pointer',
          }}
        >
          {/* ================= FRONT OF CARD ================= */}
          <div
            data-theme="dark" style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '20px',
              background: `radial-gradient(circle at 15% 15%, rgba(var(--club-primary-rgb), 0.3) 0%, #0E1420 65%, #05080E 100%)`,
              border: `1.5px solid ${tilt.isHovered ? 'rgba(var(--tint-rgb), 0.32)' : 'rgba(var(--tint-rgb), 0.15)'}`,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)',
              transformStyle: 'preserve-3d',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: isFlipped ? 0 : 2,
              pointerEvents: isFlipped ? 'none' : 'auto',
              overflow: 'hidden',
            }}
          >
            {/* 1. Specular Light Glare Hotspot */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, ${tilt.isHovered ? 0.32 : 0.06}) 0%, rgba(var(--club-primary-rgb), ${tilt.isHovered ? 0.16 : 0}) 40%, transparent 70%)`,
                mixBlendMode: 'screen',
                zIndex: 10,
                transition: tilt.isHovered ? 'none' : 'background 0.6s ease',
              }}
            />

            {/* 2. Iridescent Rainbow Foil Sheen */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `linear-gradient(${115 + tilt.rotY * 2}deg, transparent 20%, rgba(255, 255, 255, 0.05) 35%, rgba(16, 185, 129, 0.18) 48%, rgba(245, 158, 11, 0.18) 54%, rgba(59, 130, 246, 0.18) 60%, transparent 80%)`,
                opacity: tilt.isHovered ? 0.95 : 0.45,
                mixBlendMode: 'color-dodge',
                zIndex: 9,
                transition: 'opacity 0.3s ease',
              }}
            />

            {/* 3. Subtle Stadium Watermark Pattern */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(var(--tint-rgb), 0.035) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />

            {/* Header: Club Crest & Name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 3,
                transform: 'translateZ(20px)',
              }}
            >
              <div className="row row-loose">
                <div
                  data-theme="dark" style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    border: `2px solid ${club.primary_color}`,
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 14px rgba(0,0,0,0.5), 0 0 12px rgba(var(--club-primary-rgb), 0.4)`,
                  }}
                >
                  {club.logo_url ? (
                    <img loading="eager" decoding="async" src={club.logo_url} alt={`${club.name} crest`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Shield size={24} color={club.primary_color} />
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    {club.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Official Matchday Pass</span>
                    {club.founded_year && <span>• Est. {club.founded_year}</span>}
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div
                className="badge"
                style={{
                  backgroundColor: isSuspended ? 'rgba(239, 68, 68, 0.2)' : isExpired ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: isSuspended ? 'var(--c-red)' : isExpired ? 'var(--c-amber)' : 'var(--c-green)',
                  border: `1px solid ${isSuspended ? '#EF4444' : isExpired ? '#F59E0B' : '#10B981'}`,
                }}
              >
                <CheckCircle2 size={12} />
                {isSuspended ? 'SUSPENDED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
              </div>
            </div>

            {/* Middle: Member Avatar, Name & Role */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                margin: '1.25rem 0',
                position: 'relative',
                zIndex: 3,
                transform: 'translateZ(30px)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <PlayerAvatar
                  photoUrl={member.photo_url}
                  name={member.full_name}
                  size={86}
                  style={{
                    borderRadius: '16px',
                    border: `2.5px solid rgba(var(--tint-rgb), 0.35)`,
                    boxShadow: '0 12px 24px rgba(0,0,0,0.6)',
                    fontSize: 30,
                    color: 'var(--text-primary)',
                    background: 'rgba(var(--tint-rgb), 0.12)',
                  }}
                />
                {member.jersey_number && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-6px',
                      right: '-6px',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: club.primary_color,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.7)',
                      border: '2px solid #FFFFFF',
                    }}
                  >
                    {member.jersey_number}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                  {member.full_name}
                </h3>
                <div
                  style={{
                    display: 'inline-block',
                    background: 'rgba(var(--tint-rgb), 0.1)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.4rem',
                    border: '1px solid rgba(var(--tint-rgb), 0.1)',
                  }}
                >
                  {member.is_executive ? member.executive_title : member.membership_tier}
                </div>
                <div className="text-meta">
                  Position: <strong className="text-primary">{member.player_position || 'Squad Member'}</strong>
                </div>
              </div>
            </div>

            {/* Bottom: Turnstile QR Code & Validity */}
            <div
              data-theme="dark" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(5, 8, 14, 0.75)',
                backdropFilter: 'blur(10px)',
                padding: '0.9rem 1rem',
                borderRadius: '14px',
                border: '1px solid rgba(var(--tint-rgb), 0.1)',
                position: 'relative',
                zIndex: 3,
                transform: 'translateZ(25px)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Turnstile QR Token
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: 700, marginTop: '0.1rem' }}>
                  {member.qr_code_token.substring(0, 16)}...
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Valid Thru: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{member.membership_expires_at}</span>
                </div>
              </div>

              {/* Scannable High-Contrast QR (tap for full screen) */}
              <button
                type="button"
                aria-label="Show QR code full screen"
                onClick={e => { e.stopPropagation(); setShowQr(true); }}
                style={{
                  border: 'none',
                  cursor: 'zoom-in',
                  background: '#FFFFFF',
                  padding: '7px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
                }}
              >
                <QRCodeSVG
                  value={member.qr_code_token}
                  size={64}
                  level="H"
                  includeMargin={false}
                />
              </button>
            </div>

            {/* Interactive Flip Hint */}
            <div
              style={{
                position: 'absolute',
                top: '0.55rem',
                right: '1.25rem',
                opacity: tilt.isHovered ? 0.9 : 0,
                transition: 'opacity 0.25s ease',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <span
                data-theme="dark" style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Click to Flip ↷
              </span>
            </div>
          </div>

          {/* ================= BACK OF CARD ================= */}
          <div
            data-theme="dark" style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #070a11 0%, rgb(var(--dk-17-24-39)) 100%)',
              border: `1.5px solid ${tilt.isHovered ? 'rgba(var(--tint-rgb), 0.32)' : 'rgba(var(--tint-rgb), 0.15)'}`,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              transformStyle: 'preserve-3d',
              padding: '1.4rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: isFlipped ? 2 : 0,
              pointerEvents: isFlipped ? 'auto' : 'none',
              // Fits a 375px phone; on narrower screens the back scrolls rather than cutting text off
              overflowX: 'hidden',
              overflowY: 'auto',
            }}
          >
            {/* Specular Light Glare for Back */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, ${tilt.isHovered ? 0.25 : 0.05}) 0%, transparent 60%)`,
                mixBlendMode: 'screen',
                zIndex: 10,
              }}
            />

            <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.8rem' }}>
              <div className="row" style={{ justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Member Details
                </span>
                <Sparkles size={16} color={club.accent_color || undefined} aria-hidden="true" />
              </div>

              <BackRow label="Membership">
                <div style={{ fontWeight: 700 }}>{member.is_executive && member.executive_title ? member.executive_title : member.membership_tier}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {[...teams.map(t => t.name), roleLabel].filter(Boolean).join(' · ')}
                </div>
              </BackRow>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <BackRow label="Member since">{formatDay(member.membership_starts_at || member.created_at) || '—'}</BackRow>
                <BackRow label="Valid until">
                  {formatDay(member.membership_expires_at) || '—'}
                  {daysLeft !== null && (
                    <div style={{ color: daysLeft < 0 ? 'var(--c-red)' : daysLeft <= 30 ? 'var(--c-amber)' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                    </div>
                  )}
                  {onRenew && daysLeft !== null && daysLeft <= 30 && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onRenew(); }}
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--club-ink)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Renew now
                    </button>
                  )}
                </BackRow>
              </div>
              <BackRow label="Next fixture">
                {nextMatch ? (
                  <>
                    <div style={{ fontWeight: 700 }}>
                      {nextMatch.is_club_home ? 'vs' : '@'} {nextMatch.opponent_name || (nextMatch.is_club_home ? nextMatch.away_team_name : nextMatch.home_team_name)}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}> ({nextMatch.is_club_home ? 'Home' : 'Away'})</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {formatDay(nextMatch.match_date, true)}{nextMatch.match_time ? ` · ${nextMatch.match_time.slice(0, 5)}` : ''}
                    </div>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>No fixture scheduled yet</span>
                )}
              </BackRow>

              {(club.stadium_name || club.stadium_address) && (
                <BackRow label="Home ground">
                  <div style={{ fontWeight: 700 }}>{club.stadium_name || club.stadium_address}</div>
                  {club.stadium_name && club.stadium_address && (
                    <div style={{ color: 'var(--text-secondary)' }}>{club.stadium_address}</div>
                  )}
                  {club.stadium_parking_info && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Parking: {club.stadium_parking_info}</div>
                  )}
                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--club-ink)', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      Directions
                    </a>
                  )}
                </BackRow>
              )}

              {member.emergency_contact && (
                <BackRow label="Emergency contact">
                  <div className="row" style={{ gap: '0.5rem', justifyContent: 'space-between' }}>
                    <span>{showEmergency ? member.emergency_contact : '••••••••'}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setShowEmergency(v => !v); }}
                      aria-pressed={showEmergency}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      {showEmergency ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </BackRow>
              )}
            </div>

            <div style={{ textAlign: 'center', position: 'relative', zIndex: 3, borderTop: '1px solid rgba(var(--tint-rgb), 0.12)', paddingTop: '0.75rem' }}>
              {(club.motto || club.founded_year) && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontStyle: club.motto ? 'italic' : 'normal' }}>
                  {[club.motto ? `“${club.motto}”` : '', club.founded_year ? `Est. ${club.founded_year}` : ''].filter(Boolean).join(' · ')}
                </div>
              )}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Scan the front at the gate · Not transferable
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Interactive Controls */}
      <div className="row row-loose">
        <button
          onClick={handleFlipToggle}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', transition: 'all 0.2s ease' }}
        >
          <RotateCw
            size={14}
            style={{
              transform: isFlipped ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
          <span>{isFlipped ? 'Show Front' : 'Flip Card Details'}</span>
        </button>

        <button
          onClick={handleSavePass}
          disabled={saving || !member.qr_code_token}
          className="btn btn-primary btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            transform: downloadSuccess ? 'scale(0.97)' : 'scale(1)',
            transition: 'all 0.2s ease',
          }}
        >
          {downloadSuccess ? <CheckCircle2 size={14} color="var(--text-primary)" /> : <Download size={14} />}
          <span>{downloadSuccess ? 'Pass Saved!' : saving ? 'Saving…' : 'Save Digital Pass'}</span>
        </button>
      </div>

      {saveError && (
        <div role="alert" style={{ fontSize: '0.8rem', color: 'var(--c-red)', textAlign: 'center' }}>
          {saveError}
        </div>
      )}

      {/* Portalled so a transformed ancestor can't stop it covering the screen */}
      {showQr && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Member pass QR code"
          onClick={() => setShowQr(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            padding: '1.5rem',
            color: '#0E1420',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{club.name}</div>
          <QRCodeSVG
            value={member.qr_code_token}
            size={320}
            level="H"
            marginSize={2}
            style={{ width: 'min(80vw, 60vh)', height: 'min(80vw, 60vh)' }}
          />
          <div style={{ fontWeight: 900, fontSize: '1.4rem' }}>{member.full_name}</div>
          <div style={{ fontSize: '0.9rem', color: '#475569' }}>
            {isSuspended ? 'SUSPENDED' : isExpired ? 'EXPIRED' : 'ACTIVE'} • Turn your screen brightness up for the gate scanner
          </div>
          <button
            type="button"
            onClick={() => setShowQr(false)}
            autoFocus
            style={{ background: '#0E1420', color: '#FFFFFF', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>,
        document.body
      )}

      {/* Full-size copy of the QR used to draw the saved image (never shown) */}
      {member.qr_code_token && (
        <QRCodeCanvas ref={qrCanvasRef} value={member.qr_code_token} size={640} level="H" marginSize={0} style={{ display: 'none' }} aria-hidden="true" />
      )}

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Verified Pass Token: <code style={{ fontFamily: 'var(--font-mono)', color: club.primary_color }}>{member.qr_code_token}</code>
      </div>
    </div>
  );
}
