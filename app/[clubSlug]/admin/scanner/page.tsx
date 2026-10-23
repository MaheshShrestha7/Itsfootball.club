'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { defaultFixture } from '@/lib/fixtures';
import { ClubMember, ClubEvent, Match } from '@/lib/supabase/types';
import CameraQRScanner from '@/components/CameraQRScanner';
import PlayerAvatar from '@/components/PlayerAvatar';
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
import { DATE_LOCALE } from '@/lib/dates';

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
  const { clubs, selectClubBySlug, events, matches, tournamentParticipants, gateScans, verifyMemberPass, verifyMemberPassPublic, publicEventCheckin, publicMatchCheckin, recordGateScan } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  // View level: verify passes only (check-ins and the scan log are changes)
  const { can } = useAuth();
  const canCheckIn = can(club.id, 'scanner', 'edit');

  const clubEvents = events.filter(e => e.club_id === club.id);
  const clubMatches = matches.filter(m => m.club_id === club.id);

  const [mode, setMode] = useState<'verify' | 'checkin' | 'match_checkin'>('verify');
  // Until a steward picks one: the live match or the club's next fixture, and the event on now or
  // next (else the latest). Worked out on each render, so it's right once the club's data has loaded.
  const defaultMatch = defaultFixture(clubMatches, tournamentParticipants, club.name);
  const eventEnd = (e: ClubEvent) => Date.parse(e.end_time || e.start_time) || 0;
  const defaultEvent = clubEvents
    .filter(e => eventEnd(e) >= Date.now() - 3 * 3600000)
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))[0]
    || [...clubEvents].sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))[0];
  const [pickedEventId, setSelectedEventId] = useState('');
  const [pickedMatchId, setSelectedMatchId] = useState('');
  const selectedEventId = clubEvents.some(e => e.id === pickedEventId) ? pickedEventId : defaultEvent?.id || '';
  const selectedMatchId = clubMatches.some(m => m.id === pickedMatchId) ? pickedMatchId : defaultMatch?.id || '';
  const [manualCode, setManualCode] = useState('');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [currentResult, setCurrentResult] = useState<any>(null);

  const processToken = async (token: string) => {
    if (!token.trim()) return;

    const timeStr = new Date().toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (mode === 'match_checkin') {
      const selectedMatch = clubMatches.find(m => m.id === selectedMatchId);
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
      const selectedEvent = clubEvents.find(e => e.id === selectedEventId);
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

      // A pass already let through today may be a shared screenshot: still valid, but the steward should check the photo
      const today = new Date().toDateString();
      const earlier = res.valid && res.member
        ? gateScans.find(s => s.club_id === club.id && s.scan_type === 'pass_verification' && s.valid
            && s.member_id === res.member!.id && new Date(s.scanned_at).toDateString() === today)
        : undefined;
      const repeatAt = earlier
        ? new Date(earlier.scanned_at).toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' })
        : undefined;
      const result = repeatAt
        ? { ...res, repeatAt, message: `Already scanned today at ${repeatAt}. Check the photo matches the person before letting them in.` }
        : res;

      const newLog: ScanLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        token,
        status: res.valid && !repeatAt ? 'valid' : res.member ? 'warning' : 'invalid',
        memberName: res.member?.full_name,
        tier: res.member?.membership_tier,
        detail: result.message,
      };

      setCurrentResult(result);
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
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>MATCHDAY</span>
        <h1 className="stat-value">
          Pass Scanner & Check-In
        </h1>
        <p className="text-body">
          Scan members&apos; digital passes to check they&apos;re valid and check people in to events.
        </p>
      </div>

      {/* Mode Selector: Member Verification vs Event Check-In */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button data-view-ok
              onClick={() => { setMode('verify'); setCurrentResult(null); }}
              className="btn btn-sm"
              style={{
                background: mode === 'verify' ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
                color: mode === 'verify' ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-secondary)',
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
                color: activeTab === 'camera' ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
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
                color: activeTab === 'manual' ? 'var(--club-primary-contrast, #090D16)' : 'var(--text-muted)',
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
              background: currentResult.valid && !currentResult.repeatAt
                ? 'rgba(16, 185, 129, 0.15)'
                : currentResult.member
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              border: `2px solid ${currentResult.valid && !currentResult.repeatAt ? '#10B981' : currentResult.member ? '#F59E0B' : '#EF4444'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {currentResult.valid && !currentResult.repeatAt ? <CheckCircle2 size={24} color="var(--c-green)" /> : <AlertTriangle size={24} color="var(--c-amber)" />}
                <div>
                  <div style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: currentResult.valid && !currentResult.repeatAt ? 'var(--c-green)' : 'var(--c-amber)',
                    marginBottom: '0.2rem',
                  }}>
                    {currentResult.repeatAt ? 'ALREADY SCANNED TODAY' : currentResult.valid ? 'VALIDATION APPROVED' : 'ACCESS WARNING'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {currentResult.message}
                  </div>
                </div>
              </div>

              {/* Photo so the steward can check the pass belongs to the person holding it */}
              {currentResult.member && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <PlayerAvatar photoUrl={currentResult.member.photo_url} name={currentResult.member.full_name} size={96} eager style={{ borderRadius: '14px' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{currentResult.member.full_name}</div>
                    <div className="text-meta">
                      {currentResult.member.is_executive ? currentResult.member.executive_title : currentResult.member.membership_tier}
                      {currentResult.member.jersey_number ? ` • Jersey No. ${currentResult.member.jersey_number}` : ''}
                    </div>
                    {!currentResult.member.photo_url && (
                      <div className="text-meta">No photo on file: ask for ID if unsure.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Realtime Scan Log Stream */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div className="section-head">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="var(--club-primary)" />
              <span>Scans This Session</span>
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
