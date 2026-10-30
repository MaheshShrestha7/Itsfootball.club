'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Club, ClubMember, ClubTeam, Match, isPlayerMember } from '@/lib/supabase/types';
import PlayerAvatar from './PlayerAvatar';
import { renderPassImage, savePassImage } from '@/lib/pass-image';
import { useOneSponsor } from './GroundSponsors';
import SponsorTrackedLink from './SponsorTrackedLink';
import SponsorLogo from './SponsorLogo';
import { hexToRgb, getRelativeLuminance } from '@/lib/theme-utils';
import {
  Shield,
  CheckCircle2,
  RotateCw,
  Download
} from 'lucide-react';
import { DATE_LOCALE } from '@/lib/dates';

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
  return d.toLocaleDateString(DATE_LOCALE, withWeekday
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

// Glass styling: the faces are always dark tinted glass, whatever the site theme
const GLASS_TEXT = '#FFFFFF';
const GLASS_MUTED = 'rgba(255, 255, 255, 0.72)';
const glassPanel: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.26)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 8px 20px rgba(0, 0, 0, 0.18)',
  borderRadius: '18px',
};
const glassChip: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255, 255, 255, 0.14)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  padding: '0.2rem 0.6rem',
  borderRadius: '8px',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: GLASS_TEXT,
};
const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: GLASS_TEXT,
  fontWeight: 800,
  fontSize: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(255, 255, 255, 0.5)',
  cursor: 'pointer',
};

function BackRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: GLASS_MUTED, fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ color: GLASS_TEXT, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

/** A glass panel inside the card, raised off it by `depth` px */
function BackPanel({ depth, style, children }: { depth: number; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ ...glassPanel, padding: '0.65rem 0.9rem', position: 'relative', zIndex: 3, transform: `translateZ(${depth}px)`, fontSize: '0.8rem', ...style }}>
      {children}
    </div>
  );
}

export default function VirtualPassCard({ club, member, teams = [], nextMatch, onRenew }: VirtualPassCardProps) {
  // Hidden by default so a screenshot of the pass doesn't carry it
  const [showEmergency, setShowEmergency] = useState(false);
  // One sponsor on the pass (Admin, Sponsors: a package with the "Member pass" tick)
  const passSponsor = useOneSponsor(club, 'member_pass');
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
    if (!cardRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
      const blob = await renderPassImage(club, member, qrCanvasRef.current, status, passSponsor ? { name: passSponsor.name, logoUrl: passSponsor.logo_url } : null);
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

  // Glass tint from the club's colours. Light colours are toned down so white text stays readable.
  const primary = hexToRgb(club.primary_color || '#10B981');
  const accent = hexToRgb(club.accent_color || '#F59E0B');
  const tintAlpha = (c: { r: number; g: number; b: number }) => (getRelativeLuminance(c.r, c.g, c.b) > 0.35 ? 0.4 : 0.9);
  const jerseyInk = getRelativeLuminance(primary.r, primary.g, primary.b) > 0.45 ? '#0E1420' : '#FFFFFF';

  const faceStyle = (back: boolean): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    borderRadius: '20px',
    background: '#0B1120',
    border: `1px solid rgba(255, 255, 255, ${tilt.isHovered ? 0.45 : 0.32})`,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 0 rgba(255, 255, 255, 0.08)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    transform: back ? 'rotateY(180deg)' : 'rotateY(0deg)',
    transformStyle: 'preserve-3d',
    padding: back ? '1.2rem 1.25rem 0.9rem' : '1.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: back ? '0.55rem' : '0.75rem',
    zIndex: isFlipped === back ? 2 : 0,
    pointerEvents: isFlipped === back ? 'auto' : 'none',
    color: GLASS_TEXT,
    // Fits a 375px phone; on narrower screens the back scrolls rather than cutting text off
    overflowX: 'hidden',
    overflowY: back ? 'auto' : 'hidden',
  });

  // Colour blobs under frosted glass. Drawn inside the card (not with backdrop-filter, which
  // 3D-flipped faces don't render reliably), so the glass looks the same on any page.
  const glassLayers = (mirrored = false) => (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: [
            `radial-gradient(circle at ${mirrored ? '85% 12%' : '10% 8%'}, rgba(${primary.rgbString}, ${tintAlpha(primary)}) 0%, rgba(${primary.rgbString}, ${tintAlpha(primary) * 0.35}) 45%, transparent 75%)`,
            `radial-gradient(circle at ${mirrored ? '15% 95%' : '92% 96%'}, rgba(${accent.rgbString}, ${tintAlpha(accent) * 0.75}) 0%, transparent 55%)`,
            `radial-gradient(circle at ${mirrored ? '70% 60%' : '35% 62%'}, rgba(${primary.rgbString}, 0.18) 0%, transparent 45%)`,
            `radial-gradient(circle at ${mirrored ? '20% 35%' : '80% 30%'}, rgba(${accent.rgbString}, 0.14) 0%, transparent 45%)`,
          ].join(', '),
        }}
      />
      {/* The club crest, large and faded, behind everything else */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '78%',
          aspectRatio: '1 / 1',
          top: mirrored ? '30%' : '24%',
          [mirrored ? 'left' : 'right']: '-14%',
          pointerEvents: 'none',
          zIndex: 1,
          opacity: club.logo_url ? 0.16 : 0.07,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(${mirrored ? 10 : -10}deg)`,
          // Soft edges, so a logo on a square background never shows a hard box
          WebkitMaskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)',
          maskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)',
        }}
      >
        {club.logo_url ? (
          <img src={club.logo_url} alt="" loading="eager" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(1) brightness(1.6)' }} />
        ) : (
          <Shield style={{ width: '80%', height: '80%' }} color="#FFFFFF" strokeWidth={1.2} />
        )}
      </div>
      {/* Frosted sheet with a diagonal sheen */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          background: `linear-gradient(${mirrored ? 220 : 140}deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(255, 255, 255, 0.02) 100%),
            linear-gradient(${115 + tilt.rotY * 2}deg, transparent 30%, rgba(255, 255, 255, ${tilt.isHovered ? 0.22 : 0.14}) 45%, transparent 60%)`,
        }}
      />
      {/* A sweep of light in the club colour when the pass appears and each time it flips, like a real card
          catching the light at the gate. Keyed by the flip, so it replays. */}
      <div
        key={`shine-${isFlipped}`}
        aria-hidden="true"
        className="pass-shine"
        style={{ '--shine': `rgba(${primary.rgbString}, 0.35)` } as React.CSSProperties}
      />
      {/* Light that follows the pointer */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
          background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, ${tilt.isHovered ? 0.22 : 0}) 0%, transparent 60%)`,
          mixBlendMode: 'screen',
          transition: tilt.isHovered ? 'none' : 'background 0.6s ease',
        }}
      />
    </>
  );

  const statusLabel = isSuspended ? 'SUSPENDED' : isExpired ? 'EXPIRED' : 'ACTIVE';
  const statusColor = isSuspended ? { bg: 'rgba(239, 68, 68, 0.25)', border: 'rgba(252, 165, 165, 0.65)', text: '#FECACA', dot: '#F87171' }
    : isExpired ? { bg: 'rgba(245, 158, 11, 0.25)', border: 'rgba(252, 211, 77, 0.65)', text: '#FDE68A', dot: '#FBBF24' }
    : { bg: 'rgba(16, 185, 129, 0.22)', border: 'rgba(110, 231, 183, 0.6)', text: '#A7F3D0', dot: '#34D399' };

  const passHeader = (subtitle: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', position: 'relative', zIndex: 3, transform: 'translateZ(20px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            flexShrink: 0, // a long club name must not squeeze the crest narrow
            borderRadius: '13px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.16)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
          }}
        >
          {club.logo_url ? (
            // Crests are rarely square: show the whole badge rather than cropping it
            <img loading="eager" decoding="async" src={club.logo_url} alt={`${club.name} crest`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
          ) : (
            <Shield size={22} color={GLASS_TEXT} />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          {/* Full name, up to two lines; longer names get a smaller size instead of being cut off */}
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: club.name.length > 32 ? '0.88rem' : club.name.length > 20 ? '0.98rem' : '1.1rem',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: GLASS_TEXT,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {club.name}
          </div>
          <div style={{ fontSize: '0.64rem', color: GLASS_MUTED, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{subtitle}</div>
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.3rem 0.7rem',
          borderRadius: '999px',
          background: statusColor.bg,
          border: `1px solid ${statusColor.border}`,
          color: statusColor.text,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}
      >
        <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor.dot, boxShadow: `0 0 8px ${statusColor.dot}` }} />
        {statusLabel}
      </div>
    </div>
  );

  // Base card 3D transform combining tilt, scale and 180deg flip
  const cardTransform = isFlipped
    ? `perspective(1200px) rotateY(180deg) rotateX(${tilt.rotX}deg) rotateY(${-tilt.rotY}deg) ${tilt.isHovered ? 'scale3d(1.025, 1.025, 1.025)' : 'scale3d(1, 1, 1)'}`
    : `perspective(1200px) rotateX(${tilt.rotX}deg) rotateY(${tilt.rotY}deg) ${tilt.isHovered ? 'scale3d(1.025, 1.025, 1.025)' : 'scale3d(1, 1, 1)'}`;

  // Dynamic realistic drop shadow that shifts opposite to the tilt direction
  const dynamicShadow = tilt.isHovered
    ? `${-tilt.rotY * 2.2}px ${tilt.rotX * 2.2 + 26}px 50px rgba(0, 0, 0, 0.45), 0 0 40px rgba(${primary.rgbString}, 0.35)`
    : `0 24px 50px rgba(0, 0, 0, 0.4), 0 0 30px rgba(${primary.rgbString}, 0.22)`;

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
          <div style={faceStyle(false)}>
            {glassLayers()}

            {/* Header: crest, club, status */}
            {passHeader('Member Pass')}

            {/* Middle: photo, name, tier */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.1rem', position: 'relative', zIndex: 3, transform: 'translateZ(30px)' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <PlayerAvatar
                  photoUrl={member.photo_url}
                  name={member.full_name}
                  size={92}
                  eager
                  style={{
                    borderRadius: '22px',
                    border: '1px solid rgba(255, 255, 255, 0.45)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 12px 24px rgba(0, 0, 0, 0.25)',
                    background: 'rgba(255, 255, 255, 0.14)',
                    color: GLASS_TEXT,
                    fontSize: 32,
                  }}
                />
                {member.jersey_number && (
                  <div
                    aria-label={`Jersey No. ${member.jersey_number}`}
                    style={{
                      position: 'absolute',
                      bottom: '-8px',
                      right: '-8px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: club.primary_color,
                      color: jerseyInk,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {member.jersey_number}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.55rem', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.02em', color: GLASS_TEXT, marginBottom: '0.5rem', overflowWrap: 'anywhere' }}>
                  {member.full_name}
                </h3>
                <div style={{ ...glassChip, marginBottom: '0.4rem' }}>
                  {member.is_executive && member.executive_title ? member.executive_title : member.membership_tier}
                </div>
                {/* A position only means something on a player's pass; supporters' passes say so instead */}
                <div style={{ fontSize: '0.8rem', color: GLASS_MUTED }}>
                  {isPlayerMember(member)
                    ? <>Position: <strong style={{ color: GLASS_TEXT }}>{member.player_position || 'Squad Member'}</strong></>
                    : <strong style={{ color: GLASS_TEXT }}>{member.is_executive ? 'Committee' : 'Supporter'}</strong>}
                </div>
              </div>
            </div>

            {/* Bottom: validity and the gate QR (tap for full screen) */}
            <div style={{ ...glassPanel, padding: '0.8rem 0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', position: 'relative', zIndex: 3, transform: 'translateZ(25px)' }}>
              <div>
                <div style={{ fontSize: '0.64rem', color: GLASS_MUTED, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Valid until</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: GLASS_TEXT, marginTop: '0.1rem' }}>{formatDay(member.membership_expires_at) || '—'}</div>
                <div style={{ fontSize: '0.72rem', color: GLASS_MUTED, marginTop: '0.4rem', lineHeight: 1.35 }}>Tap the code to enlarge it at the gate</div>
              </div>
              <button
                type="button"
                aria-label="Show QR code full screen"
                onClick={e => { e.stopPropagation(); setShowQr(true); }}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  cursor: 'zoom-in',
                  background: '#FFFFFF',
                  padding: '7px',
                  borderRadius: '14px',
                  display: 'flex',
                  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
                }}
              >
                <QRCodeSVG value={member.qr_code_token} size={84} level="H" marginSize={0} />
              </button>
            </div>
          </div>

          {/* ================= BACK OF CARD ================= */}
          <div style={faceStyle(true)}>
            {glassLayers(true)}

            {passHeader('Member Details')}

            {/* Membership */}
            <BackPanel depth={30}>
              <div style={glassChip}>
                {member.is_executive && member.executive_title ? member.executive_title : member.membership_tier}
              </div>
              {(teams.length > 0 || roleLabel) && (
                <div style={{ color: GLASS_MUTED, marginTop: '0.35rem' }}>
                  {[...teams.map(t => t.name), roleLabel].filter(Boolean).join(' · ')}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                <BackRow label="Member since">{formatDay(member.membership_starts_at || member.created_at) || '—'}</BackRow>
                <BackRow label="Valid until">
                  {formatDay(member.membership_expires_at) || '—'}
                  {daysLeft !== null && (
                    <div style={{ color: GLASS_MUTED }}>
                      <span style={{ color: daysLeft < 0 ? '#FCA5A5' : daysLeft <= 30 ? '#FCD34D' : GLASS_MUTED, fontWeight: daysLeft <= 30 ? 700 : 500 }}>
                        {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                      </span>
                      {onRenew && daysLeft <= 30 && (
                        <>
                          {' · '}
                          <button type="button" onClick={e => { e.stopPropagation(); onRenew(); }} style={linkButton}>Renew</button>
                        </>
                      )}
                    </div>
                  )}
                </BackRow>
              </div>
            </BackPanel>

            {/* Matchday */}
            <BackPanel depth={25}>
              <BackRow label={isPlayerMember(member) ? 'Next fixture' : 'Next home match'}>
                {nextMatch ? (
                  <>
                    {nextMatch.match_type === 'internal' ? (
                      <>
                        <strong>{nextMatch.home_team_name} v {nextMatch.away_team_name}</strong>
                        <span style={{ color: GLASS_MUTED }}> (In-house)</span>
                      </>
                    ) : (
                      <>
                        <strong>{nextMatch.is_club_home ? 'vs' : '@'} {nextMatch.opponent_name || (nextMatch.is_club_home ? nextMatch.away_team_name : nextMatch.home_team_name)}</strong>
                        <span style={{ color: GLASS_MUTED }}> ({nextMatch.is_club_home ? 'Home' : 'Away'})</span>
                      </>
                    )}
                    <div style={{ color: GLASS_MUTED }}>
                      {formatDay(nextMatch.match_date, true)}{nextMatch.match_time ? ` · ${nextMatch.match_time.slice(0, 5)}` : ''}
                    </div>
                  </>
                ) : (
                  <span style={{ color: GLASS_MUTED }}>No fixture scheduled yet</span>
                )}
              </BackRow>
              {(club.stadium_name || club.stadium_address) && (
                <div style={{ marginTop: '0.5rem' }}>
                  <BackRow label="Home ground">
                    <strong>{club.stadium_name || club.stadium_address}</strong>
                    {club.stadium_name && club.stadium_address && (
                      <div style={{ color: GLASS_MUTED }}>{club.stadium_address}</div>
                    )}
                    {(directionsUrl || club.stadium_parking_info) && (
                      <div style={{ color: GLASS_MUTED }}>
                        {directionsUrl && (
                          <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkButton}>
                            Directions
                          </a>
                        )}
                        {directionsUrl && club.stadium_parking_info ? ' · ' : ''}
                        {club.stadium_parking_info}
                      </div>
                    )}
                  </BackRow>
                </div>
              )}
            </BackPanel>

            {member.emergency_contact && (
              <BackPanel depth={20} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <BackRow label="Emergency contact">
                  {showEmergency ? member.emergency_contact : '••••••••'}
                </BackRow>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setShowEmergency(v => !v); }}
                  aria-pressed={showEmergency}
                  style={{ ...linkButton, flexShrink: 0, fontSize: '0.75rem' }}
                >
                  {showEmergency ? 'Hide' : 'Show'}
                </button>
              </BackPanel>
            )}

            <div style={{ marginTop: 'auto', textAlign: 'center', position: 'relative', zIndex: 3 }}>
              {passSponsor && (
                <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.16em', color: GLASS_MUTED }}>SUPPORTED BY</span>
                  <SponsorTrackedLink clubId={club.id} sponsorId={passSponsor.id} placement="member_pass" href={passSponsor.website_url || ''}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 30, minWidth: 64, maxWidth: 120, padding: '0.2rem 0.5rem', borderRadius: 7, background: '#fff' }}>
                    <SponsorLogo src={passSponsor.logo_url} name={passSponsor.name} height={22} style={{ maxWidth: '100%' }} />
                    <span className="sr-only">{passSponsor.name}</span>
                  </SponsorTrackedLink>
                </span>
              )}
              {(club.motto || club.founded_year) && (
                <div style={{ fontSize: '0.78rem', color: GLASS_TEXT, fontStyle: club.motto ? 'italic' : 'normal' }}>
                  {[club.motto ? `“${club.motto}”` : '', club.founded_year ? `Est. ${club.founded_year}` : ''].filter(Boolean).join(' · ')}
                </div>
              )}
              <div style={{ fontSize: '0.68rem', color: GLASS_MUTED, marginTop: '0.15rem' }}>
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

    </div>
  );
}
