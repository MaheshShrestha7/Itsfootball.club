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

    const timeStr = new Date().toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

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
        ? new Date(earlier.scanned_at).toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' })
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
      <div className="admin-head">
        <div>
          <h1>Pass scanner</h1>
          <p>Scan members&apos; digital passes to check they&apos;re valid, and check people in at the gate or an event.</p>
        </div>
      </div>

      {/* Mode Selector: Member Verification vs Event Check-In */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div className="admin-chips" role="group" aria-label="What you're scanning for" style={{ flexWrap: 'wrap' }}>
            {([['verify', 'Check a pass'], ['match_checkin', 'Matchday gate'], ['checkin', 'Event or ticket']] as const).map(([id, label]) => (
              <button data-view-ok key={id} type="button" className="admin-chip" aria-pressed={mode === id}
                onClick={() => { setMode(id); setCurrentResult(null); }}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'match_checkin' && (
            <div className="row row-loose row-wrap">
              <span className="text-note">Match</span>
              <select aria-label="Match"
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
              <span className="text-note">Event</span>
              <select aria-label="Event"
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
          <div className="admin-tabs" role="tablist" aria-label="Scan with">
            <button data-view-ok type="button" role="tab" className="admin-tab" aria-selected={activeTab === 'camera'}
              onClick={() => setActiveTab('camera')}
            >
              <Camera size={16} aria-hidden="true" /> Camera
            </button>

            <button data-view-ok type="button" role="tab" className="admin-tab" aria-selected={activeTab === 'manual'}
              onClick={() => setActiveTab('manual')}
            >
              <Search size={16} aria-hidden="true" /> Type the code
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
                <label className="form-label" htmlFor="scanner-token">The code under the QR</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input data-view-ok id="scanner-token"
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
                ? 'var(--color-ok-wash)'
                : currentResult.member
                ? 'var(--color-warn-wash)'
                : 'var(--color-danger-wash)',
              border: `2px solid ${currentResult.valid && !currentResult.repeatAt ? 'var(--color-ok)' : currentResult.member ? 'var(--color-warn)' : 'var(--color-danger)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {currentResult.valid && !currentResult.repeatAt ? <CheckCircle2 size={24} aria-hidden="true" color="var(--color-ok)" /> : <AlertTriangle size={24} aria-hidden="true" color={currentResult.member ? 'var(--color-warn)' : 'var(--color-danger)'} />}
                <div>
                  <div style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: currentResult.valid && !currentResult.repeatAt ? 'var(--color-ok)' : currentResult.member ? 'var(--color-warn)' : 'var(--color-danger)',
                    marginBottom: '0.2rem',
                  }}>
                    {currentResult.repeatAt ? 'Already scanned today' : currentResult.valid ? 'Valid pass' : 'Not valid'}
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
                      {currentResult.member.jersey_number ? `, shirt ${currentResult.member.jersey_number}` : ''}
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
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} aria-hidden="true" />
              <span>Scans this session</span>
            </h3>
            <span className="text-meta">
              {scanLogs.length} {scanLogs.length === 1 ? 'scan' : 'scans'}
            </span>
          </div>

          <div className="stack stack-sm">
            {scanLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No scans yet. Point the camera at a member’s pass, or type the code under it.
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
                    background: 'var(--color-paper)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div className="row">
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        {log.memberName || log.token}
                      </span>
                      {log.tier && (
                        <span className="admin-pill">
                          {log.tier}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {log.detail}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="admin-pill" style={log.status === 'valid' ? { background: 'var(--color-ok-wash)', color: 'var(--color-ok)' } : { background: 'var(--color-danger-wash)', color: 'var(--color-danger)' }}>
                      {log.status === 'valid' ? 'Valid' : 'Not valid'}
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
