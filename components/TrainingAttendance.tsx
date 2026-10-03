'use client';

import React from 'react';
import { Check, ClipboardCheck } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import LocalTime from '@/components/LocalTime';
import { isPlayerMember, type Club, type ClubEvent } from '@/lib/supabase/types';

const SESSIONS_SHOWN = 8;

// Who came to the last few training sessions, from the door / scanner check-ins (gate_scans).
// Rows: the active squad plus anyone else who checked in, best attendance first.
export default function TrainingAttendance({ club, events }: { club: Club; events: ClubEvent[] }) {
  const { members, gateScans } = useClub();
  const now = Date.now();
  const sessions = events
    .filter(e => e.category === 'training' && new Date(e.start_time).getTime() <= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(-SESSIONS_SHOWN);
  if (!sessions.length) return null;

  // member id -> ids of the sessions they checked in to
  const attended = new Map<string, Set<string>>();
  const sessionIds = new Set(sessions.map(s => s.id));
  for (const scan of gateScans) {
    if (scan.club_id !== club.id || scan.scan_type !== 'event_checkin' || !scan.valid || !scan.member_id || !scan.event_id || !sessionIds.has(scan.event_id)) continue;
    if (!attended.has(scan.member_id)) attended.set(scan.member_id, new Set());
    attended.get(scan.member_id)!.add(scan.event_id);
  }

  const rows = members
    .filter(m => m.club_id === club.id && (attended.has(m.id) || (isPlayerMember(m) && m.status !== 'alumni' && (m.membership_status ?? 'approved') === 'approved')))
    .map(m => ({ member: m, count: attended.get(m.id)?.size ?? 0 }))
    .sort((a, b) => b.count - a.count || a.member.full_name.localeCompare(b.member.full_name));

  const cell: React.CSSProperties = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center', whiteSpace: 'nowrap' };

  return (
    <section className="glass-panel" style={{ padding: '1.5rem', marginTop: '2rem' }} aria-labelledby="training-attendance-heading">
      <h2 id="training-attendance-heading" style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <ClipboardCheck size={18} color="var(--c-green)" aria-hidden="true" /> Training attendance
      </h2>
      <p className="text-note" style={{ marginBottom: '1rem' }}>
        The last {sessions.length} training session{sessions.length === 1 ? '' : 's'}, from QR check-ins at the door or the scanner.
      </p>
      {/* Scrolls sideways on phones; the name column stays put */}
      <div style={{ overflowX: 'auto' }}>
        <table aria-labelledby="training-attendance-heading" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...cell, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--bg-surface-elevated)' }}>Player</th>
              {sessions.map(s => (
                <th key={s.id} scope="col" style={{ ...cell, fontWeight: 700, color: 'var(--text-muted)' }} title={s.title}>
                  <LocalTime value={s.start_time} options={{ day: 'numeric', month: 'short' }} />
                </th>
              ))}
              <th scope="col" style={cell}>Attended</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, count }) => (
              <tr key={member.id}>
                <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-surface-elevated)' }}>{member.full_name}</th>
                {sessions.map(s => {
                  const here = attended.get(member.id)?.has(s.id);
                  return (
                    <td key={s.id} style={cell}>
                      {here
                        ? <span role="img" aria-label="Attended"><Check size={15} color="var(--c-green)" aria-hidden="true" /></span>
                        : <span role="img" aria-label="Absent" style={{ color: 'var(--text-muted)' }}>–</span>}
                    </td>
                  );
                })}
                <td style={{ ...cell, fontWeight: 800 }}>{count}/{sessions.length} ({Math.round((count / sessions.length) * 100)}%)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
