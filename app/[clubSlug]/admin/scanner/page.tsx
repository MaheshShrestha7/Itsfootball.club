'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
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
  const { clubs, selectClubBySlug, events, matches, verifyMemberPass, verifyMemberPassPublic, publicEventCheckin, publicMatchCheckin, recordGateScan } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  // View level: verify passes only (check-ins and the scan log are changes)
  const { can } = useAuth();
  const canCheckIn = can(club.id, 'scanner', 'edit');

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
      let res = verifyMemberPass(token, club.id);
      // Pass tokens are only loaded for roles that can see member records; ask the database otherwise
      if (!res.member) {
        const remote = await verifyMemberPassPublic(token);
        if (remote.member?.club_id === club.id) res = remote;
      }
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
      if (canCheckIn) recordGateScan({
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
        <h1 className="stat-value">
          QR Scanner Reticle & Gate Check-In
        </h1>
        <p className="text-body">
          Scan digital QR passes for member verification and turnstile event check-in operations.
        </p>
      </div>

      {/* Mode Selector: Member Verification vs Event Check-In */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button data-view-ok
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
              <span>Event &amp; Ticket Check-In</span>
            </button>
          </div>

          {mode === 'match_checkin' && (
            <div className="row row-loose row-wrap">
              <span className="text-note">Target Match:</span>
              <select aria-label="Target match"
                className="form-select"
                style={{ width: 'auto', minWidth: 'min(240px, 100%)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
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
            <div className="row row-loose row-wrap">
              <span className="text-note">Target Event:</span>
              <select aria-label="Target event"
                className="form-select"
                style={{ width: 'auto', minWidth: 'min(240px, 100%)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
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
            background: 'rgba(var(--shade-rgb), 0.3)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
          }}>
            <button data-view-ok
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

            <button data-view-ok
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
            <div data-view-ok style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
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
                  <input data-view-ok aria-label="Pass token"
                    type="text"
                    className="form-input"
                    placeholder="e.g. apex-player-pass-10"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button data-view-ok type="submit" className="btn btn-primary">
                    Scan
                  </button>
                </div>
              </div>
            </form>
          )}

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
                {currentResult.valid ? <CheckCircle2 size={24} color="var(--c-green)" /> : <AlertTriangle size={24} color="var(--c-amber)" />}
                <div>
                  <div style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: currentResult.valid ? 'var(--c-green)' : 'var(--c-amber)',
                    marginBottom: '0.2rem',
                  }}>
                    {currentResult.valid ? 'VALIDATION APPROVED' : 'ACCESS WARNING'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {currentResult.message}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Realtime Scan Log Stream */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div className="section-head">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--club-primary)" />
              <span>Turnstile Scan Stream</span>
            </h3>
            <span className="text-meta">
              {scanLogs.length} scans this session
            </span>
          </div>

          <div className="stack stack-sm">
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
                    background: 'rgba(var(--shade-rgb), 0.3)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div className="row">
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {log.memberName || log.token}
                      </span>
                      {log.tier && (
                        <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(var(--tint-rgb), 0.06)' }}>
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
                      color: log.status === 'valid' ? 'var(--c-green)' : 'var(--c-red)',
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
