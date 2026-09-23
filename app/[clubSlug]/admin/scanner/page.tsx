'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { ClubMember, ClubEvent, Match } from '@/lib/supabase/types';
import CameraQRScanner from '@/components/CameraQRScanner';
import {
  QrCode,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Search,
  Calendar,
  History,
  Shield,
  Ticket
} from 'lucide-react';

interface ScanLogEntry {
  id: string;
  timestamp: string;
  token: string;
  status: 'valid' | 'warning' | 'invalid';
  memberName?: string;
  tier?: string;
  detail: string;
}

export default function AdminScannerPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, members, events, matches, verifyMemberPass, publicEventCheckin, publicMatchCheckin, recordGateScan } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubMembers = members.filter(m => m.club_id === club.id);
  const clubEvents = events.filter(e => e.club_id === club.id);
  const clubMatches = matches.filter(m => m.club_id === club.id);

  const [mode, setMode] = useState<'verify' | 'checkin' | 'match_checkin'>('verify');
  const [selectedEventId, setSelectedEventId] = useState(clubEvents[0]?.id || '');
  const [selectedMatchId, setSelectedMatchId] = useState(clubMatches[0]?.id || '');
  const [manualCode, setManualCode] = useState('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [currentResult, setCurrentResult] = useState<any>(null);

  const processToken = async (token: string) => {
    if (!token.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (mode === 'match_checkin') {
      const selectedMatch = clubMatches.find(m => m.id === selectedMatchId) || clubMatches[0];
      if (!selectedMatch) return;
      const res = await publicMatchCheckin(selectedMatch.id, { token });

      const newLog: ScanLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        token,
        status: res.success ? 'valid' : 'invalid',
        memberName: res.attendeeName || 'Match Attendee',
        detail: res.message,
      };

      setCurrentResult({
        valid: res.success,
        message: res.message,
        memberName: res.attendeeName,
      });

      setScanLogs(prev => [newLog, ...prev]);
      // publicMatchCheckin already persists the scan server-side; no separate recordGateScan needed.
    } else if (mode === 'checkin') {
      const selectedEvent = clubEvents.find(e => e.id === selectedEventId) || clubEvents[0];
      if (!selectedEvent) return;
      const res = await publicEventCheckin(selectedEvent.id, { token });

      const newLog: ScanLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        token,
        status: res.success ? 'valid' : 'invalid',
        memberName: res.attendeeName || 'Unknown Pass',
        detail: res.message,
      };

      setCurrentResult({
        valid: res.success,
        message: res.message,
        memberName: res.attendeeName,
      });

      setScanLogs(prev => [newLog, ...prev]);
      // publicEventCheckin already persists the scan server-side; no separate recordGateScan needed.
    } else {
      const res = verifyMemberPass(token, club.id);
      const newLog: ScanLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        token,
        status: res.valid ? 'valid' : res.member ? 'warning' : 'invalid',
        memberName: res.member?.full_name,
        tier: res.member?.membership_tier,
        detail: res.message,
      };

      setCurrentResult(res);
      setScanLogs(prev => [newLog, ...prev]);

      // Record to live club analytics engine
      recordGateScan({
        club_id: club.id,
        scan_type: 'pass_verification',
        token,
        member_id: res.member?.id,
        member_name: res.member?.full_name || 'Member',
        valid: res.valid,
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processToken(manualCode);
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>MATCHDAY ACCREDITATION</span>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
          QR Scanner Reticle & Gate Check-In
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Scan digital QR passes for member verification and turnstile event check-in operations.
        </p>
      </div>

      {/* Mode Selector: Member Verification vs Event Check-In */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setMode('verify'); setCurrentResult(null); }}
              className="btn btn-sm"
              style={{
                background: mode === 'verify' ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
                color: mode === 'verify' ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              <span>Member Pass Verification</span>
            </button>

            <button
              onClick={() => { setMode('match_checkin'); setCurrentResult(null); }}
              className="btn btn-sm"
              style={{
                background: mode === 'match_checkin' ? '#10B981' : 'rgba(255,255,255,0.06)',
                color: mode === 'match_checkin' ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              <span>Matchday Gate Check-In</span>
            </button>

            <button
              onClick={() => { setMode('checkin'); setCurrentResult(null); }}
              className="btn btn-sm"
              style={{
                background: mode === 'checkin' ? '#3B82F6' : 'rgba(255,255,255,0.06)',
                color: mode === 'checkin' ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              <span>Event Attendance Check-In</span>
            </button>
          </div>

          {mode === 'match_checkin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Match:</span>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '240px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                value={selectedMatchId}
                onChange={e => setSelectedMatchId(e.target.value)}
              >
                {clubMatches.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.home_team_name} vs {m.away_team_name} ({m.checkin_count || 0} checked in)
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'checkin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Event:</span>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '240px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
              >
                {clubEvents.map(evt => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.rsvp_count} checked in)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Scanner Canvas Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: '2rem',
        alignItems: 'flex-start',
      }}>
        {/* Left: Camera Scanner Reticle / Manual Input */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          {/* Scanner Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
          }}>
            <button
              onClick={() => setActiveTab('camera')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === 'camera' ? 'var(--club-primary)' : 'transparent',
                color: activeTab === 'camera' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <Camera size={16} /> Live Scanner
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === 'manual' ? 'var(--club-primary)' : 'transparent',
                color: activeTab === 'manual' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <Search size={16} /> Token Manual Lookup
            </button>
          </div>

          {activeTab === 'camera' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              <CameraQRScanner
                onScanSuccess={processToken}
                isActive={activeTab === 'camera'}
                scannerId="admin-scanner-main"
              />
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Enter or Paste QR Code Token</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. apex-player-pass-10"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button type="submit" className="btn btn-primary">
                    Scan
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Quick Demo Pre-filled Test Passes */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem', fontWeight: 700 }}>
              1-Click Demo Pass Scanner Simulation:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {clubMembers.slice(0, 5).map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setManualCode(m.qr_code_token);
                    processToken(m.qr_code_token);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {m.full_name} (#{m.jersey_number || 'Staff'})
                </button>
              ))}
            </div>
          </div>

          {/* Instant Result Inspection Card */}
          {currentResult && (
            <div style={{
              marginTop: '1.5rem',
              background: currentResult.valid
                ? 'rgba(16, 185, 129, 0.15)'
                : currentResult.member
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              border: `2px solid ${currentResult.valid ? '#10B981' : currentResult.member ? '#F59E0B' : '#EF4444'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {currentResult.valid ? <CheckCircle2 size={24} color="#10B981" /> : <AlertTriangle size={24} color="#F59E0B" />}
                <div>
                  <div style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: currentResult.valid ? '#10B981' : '#F59E0B',
                    marginBottom: '0.2rem',
                  }}>
                    {currentResult.valid ? 'VALIDATION APPROVED' : 'ACCESS WARNING'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#FFFFFF' }}>
                    {currentResult.message}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Realtime Scan Log Stream */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--club-primary)" />
              <span>Turnstile Scan Stream</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {scanLogs.length} scans this session
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {scanLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Awaiting scans. Click any test member chip or position camera over a member pass.
              </div>
            ) : (
              scanLogs.map(log => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem' }}>
                        {log.memberName || log.token}
                      </span>
                      {log.tier && (
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)' }}>
                          {log.tier}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {log.detail}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="badge" style={{
                      backgroundColor: log.status === 'valid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: log.status === 'valid' ? '#10B981' : '#EF4444',
                    }}>
                      {log.status.toUpperCase()}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {log.timestamp}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
