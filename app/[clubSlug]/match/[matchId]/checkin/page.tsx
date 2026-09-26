'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { useClub } from '@/lib/club-context';
import CameraQRScanner from '@/components/CameraQRScanner';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  MapPin,
  Calendar,
  Clock,
  ArrowLeft,
  UserCheck,
  Ticket,
  Sparkles,
  ExternalLink,
  Camera
} from 'lucide-react';

export default function MatchDoorCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const resolvedParams = use(params);
  // Secret door code carried by the QR code printed at the entrance
  const doorCode = use(searchParams).code;
  const { clubs, selectClubBySlug, matches, publicMatchCheckin } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const match = matches.find(m => m.id === resolvedParams.matchId);

  const [mode, setMode] = useState<'camera' | 'member' | 'guest'>('camera');
  const [memberToken, setMemberToken] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    attendeeName?: string;
    checkedInAt?: string;
  } | null>(null);

  if (!match) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel text-center" style={{ maxWidth: '480px', padding: '2.5rem' }}>
          <AlertTriangle size={48} color="#EF4444" style={{ margin: '0 auto 1rem auto' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem' }}>
            Match Not Found
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            The requested match fixture does not exist or has been removed from the schedule.
          </p>
          <Link href={`/${club.slug}`} className="btn btn-primary">
            Return to {club.name}
          </Link>
        </div>
      </div>
    );
  }

  const executeCheckinWithToken = async (token: string) => {
    if (!token.trim()) return;
    setSubmitting(true);

    const res = await publicMatchCheckin(match.id, { token: token.trim(), doorCode });

    if (res.success) {
      // Trigger festive stadium confetti
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: [club.primary_color || '#10B981', '#F59E0B', '#3B82F6', '#FFFFFF']
        });
      } catch (err) {
        console.error('Confetti error:', err);
      }

      setResult({
        success: true,
        message: res.message,
        attendeeName: res.attendeeName,
        checkedInAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } else {
      setResult({
        success: false,
        message: res.message,
      });
    }

    setSubmitting(false);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = mode === 'member'
      ? { token: memberToken.trim() }
      : { name: guestName.trim(), email: guestEmail.trim() };

    const res = await publicMatchCheckin(match.id, { ...payload, doorCode });

    if (res.success) {
      // Trigger festive stadium confetti
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: [club.primary_color || '#10B981', '#F59E0B', '#3B82F6', '#FFFFFF']
        });
      } catch (err) {
        console.error('Confetti error:', err);
      }

      setResult({
        success: true,
        message: res.message,
        attendeeName: res.attendeeName,
        checkedInAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } else {
      setResult({
        success: false,
        message: res.message,
      });
    }

    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2.5rem 1rem 5rem 1rem', background: 'radial-gradient(circle at top, rgba(16, 185, 129, 0.08), transparent 70%)' }}>
      <div className="container" style={{ maxWidth: '580px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <Link
            href={`/${club.slug}/match/${match.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Match Center</span>
          </Link>

          <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid #10B981' }}>
            <QrCode size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
            TURNSTILE GATE CHECK-IN
          </span>
        </div>

        {/* Fixture Identity Banner */}
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem',
            marginBottom: '1.5rem',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-medium)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {match.match_flyer_url && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${match.match_flyer_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.12,
                pointerEvents: 'none'
              }}
            />
          )}

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: club.primary_color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  fontSize: '0.85rem'
                }}
              >
                {club.short_name || 'AFC'}
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--club-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {match.competition} {match.match_type ? `• ${match.match_type.toUpperCase()}` : ''}
                </span>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2 }}>
                  {match.title || `${match.home_team_name} vs ${match.away_team_name}`}
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={13} color="var(--club-primary)" />
                {new Date(match.match_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={13} color="var(--club-primary)" />
                {match.match_time || new Date(match.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <MapPin size={13} color="var(--club-primary)" />
                {match.venue}
              </span>
            </div>
          </div>
        </div>

        {/* Check if Door Check-in is enabled */}
        {!match.door_qr_checkin_enabled ? (
          <div
            className="glass-panel text-center"
            style={{
              padding: '3rem 2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.05)'
            }}
          >
            <AlertTriangle size={48} color="#EF4444" style={{ margin: '0 auto 1.25rem auto' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem' }}>
              Door Self Check-In Closed
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.75rem auto' }}>
              Door QR code self-check-in has not been activated by match stewards for this fixture. Please present your pass or ticket directly at the turnstiles.
            </p>
            <Link href={`/${club.slug}/match/${match.id}`} className="btn btn-secondary">
              Go to Match Center
            </Link>
          </div>
        ) : result?.success ? (
          /* Checked-in Confirmation Pass */
          <div
            className="glass-panel"
            style={{
              padding: '2.5rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid #10B981',
              background: 'rgba(16, 185, 129, 0.08)',
              textAlign: 'center',
              animation: 'scaleIn 0.3s ease-out'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '2px solid #10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto'
              }}
            >
              <CheckCircle2 size={36} color="#10B981" />
            </div>

            <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>
              ENTRY VALIDATED
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.4rem' }}>
              Welcome, {result.attendeeName}!
            </h2>
            <p style={{ color: '#10B981', fontWeight: 600, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              {result.message}
            </p>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                marginBottom: '1.75rem',
                border: '1px solid var(--border-subtle)',
                textAlign: 'left',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Turnstile Gate:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>Main Entrance / Turnstile 2</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{result.checkedInAt}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Venue:</span>
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{match.venue}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setMemberToken('');
                  setGuestName('');
                  setGuestEmail('');
                }}
                className="btn btn-secondary btn-sm"
              >
                Check In Another Attendee
              </button>
              <Link href={`/${club.slug}/match/${match.id}`} className="btn btn-primary btn-sm">
                Enter Match Center
              </Link>
            </div>
          </div>
        ) : (
          /* Check-in Form Card */
          <div
            className="glass-panel"
            style={{
              padding: '2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface-elevated)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.3rem' }}>
                Gate Self-Check-In Station
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Scan or enter your credentials to validate your matchday entrance.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.4rem',
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '0.3rem',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <button
                type="button"
                onClick={() => { setMode('camera'); setResult(null); }}
                style={{
                  padding: '0.65rem 0.4rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: mode === 'camera' ? club.primary_color : 'transparent',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  transition: 'background 0.2s'
                }}
              >
                <Camera size={14} />
                <span>Camera Scan</span>
              </button>

              <button
                type="button"
                onClick={() => { setMode('member'); setResult(null); }}
                style={{
                  padding: '0.65rem 0.4rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: mode === 'member' ? club.primary_color : 'transparent',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  transition: 'background 0.2s'
                }}
              >
                <Shield size={14} />
                <span>Pass Token</span>
              </button>

              <button
                type="button"
                onClick={() => { setMode('guest'); setResult(null); }}
                style={{
                  padding: '0.65rem 0.4rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: mode === 'guest' ? club.primary_color : 'transparent',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  transition: 'background 0.2s'
                }}
              >
                <Ticket size={14} />
                <span>Guest</span>
              </button>
            </div>

            {/* Error Message if invalid */}
            {result && !result.success && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #EF4444',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  color: '#EF4444',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{result.message}</span>
              </div>
            )}

            {mode === 'camera' ? (
              <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <CameraQRScanner
                  onScanSuccess={executeCheckinWithToken}
                  isActive={mode === 'camera' && !result?.success}
                  scannerId="door-camera-station"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
                  Point your camera at your digital membership QR code or printed matchday pass.
                </span>
              </div>
            ) : (
              <form onSubmit={handleCheckIn}>
              {mode === 'member' ? (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" htmlFor="member-token-input">
                    Membership Pass QR Code / Token *
                  </label>
                  <input
                    id="member-token-input"
                    type="text"
                    className="form-input"
                    placeholder="Pass token or player ID"
                    value={memberToken}
                    onChange={e => setMemberToken(e.target.value)}
                    required
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                    Tip: Enter your pass token from your Digital Member Card to earn +15 ClubScore points!
                  </span>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label" htmlFor="guest-name-input">
                      Supporter Full Name *
                    </label>
                    <input
                      id="guest-name-input"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Alex Morgan"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label" htmlFor="guest-email-input">
                      Email Address (Optional for confirmation receipt)
                    </label>
                    <input
                      id="guest-email-input"
                      type="email"
                      className="form-input"
                      placeholder="e.g. alex@example.com"
                      value={guestEmail}
                      onChange={e => setGuestEmail(e.target.value)}
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-block"
                style={{
                  padding: '0.85rem',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: 800
                }}
              >
                <UserCheck size={18} />
                <span>{submitting ? 'Validating Entry...' : 'Complete Door Check-In'}</span>
              </button>
            </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
