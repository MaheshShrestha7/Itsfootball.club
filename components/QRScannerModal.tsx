'use client';

import React, { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useClub } from '@/lib/club-context';
import { ClubMember, ClubEvent, Match } from '@/lib/supabase/types';
import CameraQRScanner from './CameraQRScanner';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Search,
  X,
  Volume2,
  VolumeX,
  Ticket
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEvent?: ClubEvent | null;
  targetMatch?: Match | null;
  mode?: 'verify_pass' | 'event_checkin' | 'match_checkin';
  // Scopes plain pass verification to one club; falls back to the target event/match's
  // own club when set. Without either, an admin of multiple clubs could verify a pass
  // belonging to any club on the platform.
  clubId?: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  targetEvent,
  targetMatch,
  mode = 'verify_pass',
  clubId,
}: QRScannerModalProps) {
  const { verifyMemberPass, publicEventCheckin, publicMatchCheckin, members } = useClub();
  const verifyClubId = targetEvent?.club_id ?? targetMatch?.club_id ?? clubId;
  const [manualCode, setManualCode] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error';
    message: string;
    member?: ClubMember;
    attendeeName?: string;
    timestamp?: string;
    gate?: string;
    turnstile?: string;
  }>({ status: 'idle', message: '' });

  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  // Turnstile RFID audio synthesizer using Web Audio API
  const playTurnstileAudio = useCallback((type: 'grant' | 'deny') => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'grant') {
        // Stadium RFID Double-Beep (880Hz -> 1320Hz)
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.frequency.setValueAtTime(1318.51, now + 0.09); // E6
        gain2.gain.setValueAtTime(0.22, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.32);
      } else {
        // Denied Low Sawtooth Buzz (180Hz)
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.linearRampToValueAtTime(130, now + 0.28);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      }
    } catch {
      // Graceful silence
    }
  }, [audioEnabled]);

  if (!isOpen) return null;

  const handleProcessToken = async (token: string) => {
    if (!token.trim()) return;

    setIsProcessing(true);
    setScanResult({ status: 'idle', message: '' });

    const currentTimeStr = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (mode === 'match_checkin' && targetMatch) {
      const res = await publicMatchCheckin(targetMatch.id, { token });
      setIsProcessing(false);
      if (res.success) {
        playTurnstileAudio('grant');
        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#F59E0B', '#FFFFFF'] });
        } catch {}
      } else {
        playTurnstileAudio('deny');
      }
      setScanResult({
        status: res.success ? 'success' : 'error',
        message: res.message,
        attendeeName: res.attendeeName,
        timestamp: currentTimeStr,
        gate: 'Stadium Main Entrance',
        turnstile: 'Gate Turnstile 01',
      });
    } else if (mode === 'event_checkin' && targetEvent) {
      const res = await publicEventCheckin(targetEvent.id, { token });
      setIsProcessing(false);
      if (res.success) {
        playTurnstileAudio('grant');
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, colors: ['#10B981', '#F59E0B', '#FFFFFF'] });
        } catch {}
      } else {
        playTurnstileAudio('deny');
      }
      setScanResult({
        status: res.success ? 'success' : 'error',
        message: res.message,
        attendeeName: res.attendeeName,
        timestamp: currentTimeStr,
        gate: 'Gate B',
        turnstile: 'Turnstile 04',
      });
    } else {
      const res = verifyMemberPass(token, verifyClubId);
      setIsProcessing(false);
      if (res.valid && res.member) {
        playTurnstileAudio('grant');
        try {
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#10B981', '#F59E0B', '#FFFFFF'] });
        } catch {}
        setScanResult({
          status: 'success',
          message: res.message,
          member: res.member,
          timestamp: currentTimeStr,
          gate: 'North Gate A',
          turnstile: 'Turnstile 12',
        });
      } else {
        playTurnstileAudio('deny');
        setScanResult({
          status: res.member ? 'warning' : 'error',
          message: res.message || 'Unknown barcode token. Pass rejected by turnstile controller.',
          member: res.member,
          timestamp: currentTimeStr,
          gate: 'North Gate A',
          turnstile: 'Turnstile 12',
        });
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessToken(manualCode);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '540px',
        maxHeight: '92vh',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, rgba(18, 26, 38, 0.98) 0%, rgba(8, 12, 18, 0.99) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.75rem',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.12)',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Shield size={20} color="#10B981" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                {mode === 'match_checkin'
                  ? 'Matchday Gate Check-In'
                  : mode === 'event_checkin'
                  ? 'Turnstile Gate Check-In'
                  : 'Matchday Turnstile Scanner'}
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {mode === 'match_checkin' && targetMatch
                ? `Scanning gate passes & tickets for: ${targetMatch.home_team_name} vs ${targetMatch.away_team_name}`
                : mode === 'event_checkin' && targetEvent
                ? `Scanning gate tickets for: ${targetEvent.title}`
                : 'Present digital season pass or member QR code at stadium gates'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: audioEnabled ? '#10B981' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
              title={audioEnabled ? 'Mute turnstile chime' : 'Enable turnstile chime'}
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="Close scanner"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab switchers: Live Holographic Scanner vs Manual Entry */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.4)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            onClick={() => { setActiveTab('camera'); setScanResult({ status: 'idle', message: '' }); }}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'camera' ? 'var(--club-primary, #10B981)' : 'transparent',
              color: activeTab === 'camera' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <Camera size={16} /> Camera Scanner
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setScanResult({ status: 'idle', message: '' }); }}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'manual' ? 'var(--club-primary, #10B981)' : 'transparent',
              color: activeTab === 'manual' ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <Search size={16} /> Token Lookup
          </button>
        </div>

        {/* 1. Live Camera QR Optical Scanner */}
        {activeTab === 'camera' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <CameraQRScanner
              onScanSuccess={handleProcessToken}
              isActive={isOpen && activeTab === 'camera'}
              scannerId="modal-gate-qr-scanner"
            />
          </div>
        )}

        {/* 2. Manual Token Lookup / Test Form */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Enter Digital Pass Token / Barcode</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Paste or type the pass token"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <button type="submit" className="btn btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>

            {/* Quick Demo Pre-filled Chips */}
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 700 }}>
                Registered Squad Passes:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {members.slice(0, 4).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setManualCode(m.qr_code_token);
                      handleProcessToken(m.qr_code_token);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {m.full_name} ({m.player_position || 'Staff'})
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* 3. Turnstile Rubber Stamp & Matchday Clearance Receipt */}
        {scanResult.status !== 'idle' && (
          <div
            className={`turnstile-gate-card ${scanResult.status === 'success' ? 'gate-approved' : ''}`}
            style={{
              background:
                scanResult.status === 'success'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : scanResult.status === 'warning'
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
              border: `1.5px solid ${
                scanResult.status === 'success'
                  ? '#10B981'
                  : scanResult.status === 'warning'
                  ? '#F59E0B'
                  : '#EF4444'
              }`,
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              marginTop: '1rem',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            {/* THE RUBBER STAMP OF AUTHORIZATION */}
            <div className="turnstile-stamp-container">
              {scanResult.status === 'success' && (
                <div className="authorization-stamp stamp-granted">
                  <CheckCircle2 size={20} color="#10B981" strokeWidth={3} />
                  <span>★ ACCESS GRANTED • GATE UNLOCKED ★</span>
                </div>
              )}
              {scanResult.status === 'warning' && (
                <div className="authorization-stamp stamp-warning">
                  <AlertTriangle size={20} color="#F59E0B" strokeWidth={3} />
                  <span>⚠ ACCESS RESTRICTED • MANUAL CHECK ⚠</span>
                </div>
              )}
              {scanResult.status === 'error' && (
                <div className="authorization-stamp stamp-denied">
                  <XCircle size={20} color="#EF4444" strokeWidth={3} />
                  <span>✖ ACCESS DENIED • TURNSTILE LOCKED ✖</span>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#FFFFFF', margin: 0, fontWeight: 600 }}>
                {scanResult.message}
              </p>
            </div>

            {/* Matchday Turnstile Gate Clearance Receipt */}
            <div style={{
              background: '#040609',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '1rem',
            }}>
              {/* Member Profile Snapshot if verified */}
              {scanResult.member ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
                  <img loading="eager" decoding="async" width={54} height={54}
                    src={scanResult.member.photo_url}
                    alt={`${scanResult.member.full_name} photo`}
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '2px solid #10B981',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1.05rem' }}>
                      {scanResult.member.full_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 700 }}>
                      {scanResult.member.is_executive
                        ? scanResult.member.executive_title
                        : `${scanResult.member.membership_tier} Accreditation`} • #{scanResult.member.jersey_number || '10'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Pass Expiry: {scanResult.member.membership_expires_at}
                    </div>
                  </div>
                </div>
              ) : scanResult.attendeeName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#040609',
                    fontWeight: 900,
                  }}>
                    <Ticket size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{scanResult.attendeeName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#10B981' }}>Event Attendee Confirmed</div>
                  </div>
                </div>
              ) : null}

              {/* Stadium Turnstile Gate Telemetry */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '0.75rem',
                fontSize: '0.72rem',
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Turnstile Gate</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{scanResult.gate || 'Gate A'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Turnstile Unit</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{scanResult.turnstile || 'Unit 04'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Timestamp</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{scanResult.timestamp || 'Just now'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Turnstile Controller • itsfootball.club Gate Protocol
          </span>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
