'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AvailabilityStatus, ClubMember, MatchFormat, PitchPosition } from '@/lib/supabase/types';
import TacticalPitch, { isEmptySlot, placeOnSlot } from './TacticalPitch';
import PlayerAvatar from './PlayerAvatar';
import { ArrowLeftRight, CheckCircle2, XCircle, HelpCircle, AlertCircle, Users, GripVertical, X, Search } from 'lucide-react';

const STATUS: Record<AvailabilityStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  available: { icon: CheckCircle2, color: 'var(--c-green)', label: 'Available' },
  maybe: { icon: AlertCircle, color: 'var(--c-amber)', label: 'Doubtful' },
  unavailable: { icon: XCircle, color: 'var(--c-red)', label: 'Out' },
  pending: { icon: HelpCircle, color: 'var(--text-muted)', label: 'Pending' },
};

interface LineupWorkbenchProps {
  /** Players eligible for this lineup (bench = these minus whoever is on the pitch) */
  players: ClubMember[];
  positions: PitchPosition[];
  onPositionsChange: React.Dispatch<React.SetStateAction<PitchPosition[]>>;
  formation: string;
  onFormationChange: (key: string) => void;
  matchFormat: MatchFormat;
  onFormatChange: (fmt: MatchFormat) => void;
  primaryColor: string;
  teamName?: string;
  getAvailability: (memberId: string) => AvailabilityStatus;
  onSave: (formation: string, positions: PitchPosition[]) => void;
  onNotify?: (text: string, type?: 'success' | 'info' | 'error') => void;
  /** Rendered under the pitch on desktop and after the bench on mobile */
  footer?: React.ReactNode;
}

/** Pitch + bench for building a lineup. Substitutions work by dragging (mouse, or the grip handle on
 *  touch), by tapping a bench player then a pitch slot, or from a selected pitch player's menu. */
export default function LineupWorkbench({
  players,
  positions,
  onPositionsChange,
  formation,
  onFormationChange,
  matchFormat,
  onFormatChange,
  primaryColor,
  teamName,
  getAvailability,
  onSave,
  onNotify,
  footer,
}: LineupWorkbenchProps) {
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [pendingSubState, setPendingSub] = useState<ClubMember | null>(null);
  const [ghost, setGhost] = useState<{ member: ClubMember; x: number; y: number } | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);
  const pitchColRef = useRef<HTMLDivElement>(null);
  const benchDragRef = useRef<{ member: ClubMember; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);

  const notify = (text: string, type: 'success' | 'info' | 'error' = 'success') => onNotify?.(text, type);

  const onPitchIds = new Set(positions.map(p => p.member_id).filter(Boolean));
  const benchPlayers = players.filter(p => !onPitchIds.has(p.id));
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const shownBench = q
    ? benchPlayers.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        String(p.jersey_number ?? '') === q ||
        (p.player_position || '').toLowerCase() === q
      )
    : benchPlayers;
  // A pending player who has since been placed (e.g. by drag) is no longer pending
  const pendingSub = pendingSubState && !onPitchIds.has(pendingSubState.id) ? pendingSubState : null;

  const substitute = (slotId: string, member: ClubMember) => {
    const slot = positions.find(p => p.id === slotId);
    if (!slot) return;
    onPositionsChange(prev => placeOnSlot(prev, slotId, member));
    notify(isEmptySlot(slot) ? `${member.full_name} added to the lineup` : `${member.full_name} on for ${slot.name}`);
  };

  const sendToBench = (slotId: string, benchMemberId: string | null) => {
    const slot = positions.find(p => p.id === slotId);
    if (!slot || isEmptySlot(slot)) return;
    const incoming = benchMemberId ? players.find(p => p.id === benchMemberId) : undefined;
    if (incoming) {
      substitute(slotId, incoming);
      return;
    }
    onPositionsChange(prev =>
      prev.map(p => (p.id === slotId ? { ...p, member_id: undefined, name: '', number: 0, is_captain: false } : p))
    );
    notify(`${slot.name} moved to the bench`, 'info');
  };

  // Tap-to-substitute: a pending bench player goes into whichever slot is tapped next
  const handleSlotTap = (slotId: string) => {
    if (!pendingSub) return false;
    substitute(slotId, pendingSub);
    setPendingSub(null);
    return true;
  };

  const togglePending = (member: ClubMember) => {
    if (pendingSub?.id === member.id) {
      setPendingSub(null);
      return;
    }
    setPendingSub(member);
    // On a phone the pitch sits above the bench: bring it into view for the second tap
    const rect = pitchColRef.current?.getBoundingClientRect();
    if (rect && (rect.top < 0 || rect.top > window.innerHeight * 0.5)) {
      pitchColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!pendingSub) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPendingSub(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingSub]);

  // --- Dragging a bench card onto the pitch (pointer events, so it works for mouse and touch) ---
  const slotAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-posid]') as HTMLElement | null;
    return el?.dataset.posid || null;
  };

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, member: ClubMember) => {
    if (e.pointerType === 'mouse' ? e.button !== 0 : !(e.target as Element).closest('[data-drag-handle]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    benchDragRef.current = { member, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false };
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const drag = benchDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < (e.pointerType === 'mouse' ? 4 : 6)) return;
      drag.active = true;
      setPendingSub(null);
    }
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setGhost({ member: drag.member, x: e.clientX, y: e.clientY });
    setOverSlotId(slotAt(e.clientX, e.clientY));
  };

  const finishCardDrag = (e: React.PointerEvent, commit: boolean) => {
    const drag = benchDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    benchDragRef.current = null;
    lastPointerRef.current = null;
    setGhost(null);
    setOverSlotId(null);
    if (!drag.active) return; // a plain tap: the click handler takes it
    suppressClickUntilRef.current = performance.now() + 400;
    const target = commit ? slotAt(e.clientX, e.clientY) : null;
    if (target) substitute(target, drag.member);
  };

  // Auto-scroll while dragging near the top/bottom edge, so the pitch is reachable from the bench on a phone
  const isCardDragging = !!ghost;
  useEffect(() => {
    if (!isCardDragging) return;
    let raf = 0;
    const tick = () => {
      const p = lastPointerRef.current;
      if (p) {
        const edge = 80;
        const dy = p.y < edge ? -(edge - p.y) / 3 : p.y > window.innerHeight - edge ? (p.y - (window.innerHeight - edge)) / 3 : 0;
        if (dy) {
          window.scrollBy(0, dy);
          setOverSlotId(slotAt(p.x, p.y));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isCardDragging]);

  const swapSlot = positions.find(p => p.id === swapSlotId);

  const searchBox = (
    <label style={{ position: 'relative', display: 'block' }}>
      <Search size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search name, number or position"
        aria-label="Search bench players"
        className="form-input"
        style={{ width: '100%', paddingLeft: '2.1rem', fontSize: '16px' }}
      />
    </label>
  );
  const noMatch = (
    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem 0' }}>
      No bench player matches &ldquo;{search.trim()}&rdquo;.
    </p>
  );

  return (
    <>
      <div className="lineup-workbench-layout">
        {/* Pitch */}
        <div ref={pitchColRef} className="lineup-workbench-pitch" style={{ scrollMarginTop: '1rem' }}>
          {pendingSub && (
            <div
              role="status"
              style={{
                position: 'sticky',
                top: '0.5rem',
                zIndex: 45,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.6rem 0.75rem',
                marginBottom: '0.75rem',
                borderRadius: '10px',
                background: 'var(--color-paper-2)',
                border: '1px solid var(--color-accent)',
                boxShadow: 'var(--shadow-pop)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <PlayerAvatar photoUrl={pendingSub.photo_url} name={pendingSub.full_name} size={28} />
              <span style={{ flex: 1, minWidth: 0 }}>
                Tap a player or empty slot on the pitch to bring on <strong>{pendingSub.full_name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPendingSub(null)}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: '40px', minHeight: '40px', padding: 0 }}
                aria-label="Cancel substitution"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="admin-panel" style={{ padding: 'clamp(0.75rem, 3vw, 1.5rem)', maxWidth: '100%', boxSizing: 'border-box' }}>
            <TacticalPitch
              players={players}
              positions={positions}
              onPositionsChange={onPositionsChange}
              formation={formation}
              onFormationChange={onFormationChange}
              matchFormat={matchFormat}
              onFormatChange={onFormatChange}
              primaryColor={primaryColor}
              isEditable={true}
              teamName={teamName}
              orientation="vertical"
              allowOrientationToggle={true}
              onSaveFormation={onSave}
              saveLabel="Save draft"
              onSwapWithBench={slotId => setSwapSlotId(slotId)}
              onSendToBench={sendToBench}
              onSlotTap={handleSlotTap}
              externalDropTargetId={overSlotId}
              pickMode={!!pendingSub}
            />
          </div>
        </div>

        {/* Bench */}
        <div className="lineup-workbench-bench admin-panel" style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', fontWeight: 600, letterSpacing: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <Users size={16} aria-hidden="true" style={{ color: 'var(--color-muted)' }} /> Bench
              <span className="text-meta" style={{ fontWeight: 500 }}>{benchPlayers.length}</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', margin: 'var(--space-2xs) 0 0' }}>
              Tap a player, then tap a pitch position to substitute, or drag them onto the pitch using the grip handle.
            </p>
          </div>

          <div
            data-bench-dropzone
            className="bench-dropzone"
            style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.65rem 0.75rem',
              textAlign: 'center',
              background: 'none',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeftRight size={14} />
            <span>Drop a pitch player here to send them to the bench</span>
          </div>

          {benchPlayers.length > 0 && searchBox}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '580px', overflowY: 'auto' }}>
            {benchPlayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                All squad players are currently placed in the starting lineup.
              </div>
            ) : shownBench.length === 0 ? (
              noMatch
            ) : (
              shownBench.map(player => {
                const st = STATUS[getAvailability(player.id)];
                const Icon = st.icon;
                const isPending = pendingSub?.id === player.id;
                const isGhostSource = ghost?.member.id === player.id;
                return (
                  <div
                    key={player.id}
                    data-bench-member-id={player.id}
                    data-bench-name={player.full_name}
                    className="bench-card"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isPending}
                    aria-label={`${player.full_name}, bench. Tap then choose a pitch position to substitute.`}
                    onPointerDown={e => handleCardPointerDown(e, player)}
                    onPointerMove={handleCardPointerMove}
                    onPointerUp={e => finishCardDrag(e, true)}
                    onPointerCancel={e => finishCardDrag(e, false)}
                    onDragStart={e => e.preventDefault()}
                    onClick={() => {
                      if (performance.now() < suppressClickUntilRef.current) return;
                      togglePending(player);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePending(player);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.65rem 0.5rem 0.35rem',
                      borderRadius: '8px',
                      background: isPending ? 'var(--color-accent-wash)' : 'var(--color-paper)',
                      border: `1px solid ${isPending ? 'var(--color-accent)' : 'var(--border-subtle)'}`,
                      gap: '0.5rem',
                      cursor: 'grab',
                      userSelect: 'none',
                      opacity: isGhostSource ? 0.45 : 1,
                      transition: 'background 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span
                        data-drag-handle
                        title="Drag onto the pitch"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '40px',
                          flexShrink: 0,
                          touchAction: 'none',
                          cursor: 'grab',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <GripVertical size={18} />
                      </span>
                      <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} size={32} />
                      <div className="min-w-0">
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {player.full_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {player.jersey_number ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>#{player.jersey_number}</span> : null}
                          <span>{player.player_position || 'Squad'}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      title={`Availability: ${st.label}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0 var(--space-xs)',
                        lineHeight: '20px',
                        borderRadius: 'var(--radius-pill)',
                        background: `color-mix(in oklab, ${st.color} 14%, transparent)`,
                        color: st.color,
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={12} />
                      <span>{st.label}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {footer && <div className="lineup-workbench-notes">{footer}</div>}
      </div>

      {/* Drag ghost follows the pointer; pointer-events:none so hit-testing sees the pitch underneath */}
      {ghost && (
        <div
          style={{
            position: 'fixed',
            left: ghost.x,
            top: ghost.y,
            transform: 'translate(-50%, -130%)',
            zIndex: 10000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.6rem 0.3rem 0.3rem',
            borderRadius: '999px',
            background: overSlotId ? 'var(--color-accent)' : 'var(--color-paper-2)',
            border: `1px solid ${overSlotId ? 'var(--color-accent)' : primaryColor}`,
            boxShadow: 'var(--shadow-pop)',
            color: overSlotId ? 'var(--color-on-accent)' : 'var(--color-ink)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <PlayerAvatar photoUrl={ghost.member.photo_url} name={ghost.member.full_name} size={24} />
          <span>{ghost.member.full_name}</span>
        </div>
      )}

      {/* Swap modal, opened from a selected pitch player */}
      {swapSlot && (
        <div
          onClick={() => setSwapSlotId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-scrim)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            className="admin-panel"
            role="dialog"
            aria-modal="true"
            aria-label={isEmptySlot(swapSlot) ? `Fill ${swapSlot.position} slot` : `Replace ${swapSlot.name}`}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '440px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 'var(--space-lg)', boxShadow: 'var(--shadow-pop)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowLeftRight size={18} aria-hidden="true" style={{ color: 'var(--color-muted)' }} />
                {isEmptySlot(swapSlot) ? `Fill ${swapSlot.position} slot` : `Replace ${swapSlot.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setSwapSlotId(null)}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: '40px', minHeight: '40px', padding: 0 }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {benchPlayers.length > 0 && <div style={{ marginBottom: '0.75rem' }}>{searchBox}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
              {benchPlayers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  Nobody on the bench: every eligible player is already in the lineup.
                </p>
              ) : shownBench.length === 0 ? (
                noMatch
              ) : (
                shownBench.map(benchP => {
                  const st = STATUS[getAvailability(benchP.id)];
                  const Icon = st.icon;
                  return (
                    <button
                      key={benchP.id}
                      type="button"
                      onClick={() => {
                        substitute(swapSlot.id, benchP);
                        setSwapSlotId(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'var(--color-paper)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div className="row row-loose">
                        <PlayerAvatar photoUrl={benchP.photo_url} name={benchP.full_name} size={32} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{benchP.full_name}</div>
                          <div className="text-meta">
                            #{benchP.jersey_number || '-'} • {benchP.player_position || 'Squad'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-xs)', color: st.color, fontWeight: 600 }}>
                        <Icon size={12} />
                        <span>{st.label}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
