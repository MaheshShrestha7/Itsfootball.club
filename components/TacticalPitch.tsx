'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClubMember, MatchEvent, PitchPosition, MatchFormat } from '@/lib/supabase/types';
import {
  Move,
  RotateCcw,
  Save,
  Check,
  Sparkles,
  Info,
  Shield,
  Layers,
  ArrowLeftRight,
  Crosshair,
  User,
  Flame,
  AlertTriangle
} from 'lucide-react';

export interface TacticalPitchProps {
  players: ClubMember[];
  formation?: string;
  matchFormat?: MatchFormat;
  onFormatChange?: (format: MatchFormat) => void;
  savedPositions?: PitchPosition[];
  primaryColor?: string;
  isEditable?: boolean;
  matchEvents?: MatchEvent[];
  onSaveFormation?: (formationName: string, positions: PitchPosition[]) => void;
  teamName?: string;
  onSwapWithBench?: (pitchPlayerId: string) => void;
}

// Standard preset formation configurations grouped by match format
export const FORMAT_PRESETS: Record<MatchFormat, Record<string, { name: string; description: string; coords: Omit<PitchPosition, 'name' | 'number' | 'id'>[] }>> = {
  '11v11': {
    '4-3-3': {
      name: '4-3-3 Attack',
      description: 'High pressing with inverted wingers and a single holding pivot.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'LB', x: 28, y: 15, role: 'Inverted Wing-Back' },
        { position: 'CB', x: 24, y: 38, role: 'Ball-Playing CB' },
        { position: 'CB', x: 24, y: 62, role: 'Stopper CB' },
        { position: 'RB', x: 28, y: 85, role: 'Overlapping Full-Back' },
        { position: 'CDM', x: 45, y: 50, role: 'Deep-Lying Playmaker' },
        { position: 'CM', x: 60, y: 30, role: 'Box-to-Box Midfielder' },
        { position: 'CAM', x: 62, y: 70, role: 'Advanced Playmaker' },
        { position: 'LW', x: 80, y: 18, role: 'Inside Forward' },
        { position: 'ST', x: 87, y: 50, role: 'Complete Forward' },
        { position: 'RW', x: 80, y: 82, role: 'Winger' },
      ],
    },
    '4-2-3-1': {
      name: '4-2-3-1 Double Pivot',
      description: 'Defensive solidity through twin pivots with dynamic attacking midfield trio.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'LB', x: 27, y: 15, role: 'Overlapping Full-Back' },
        { position: 'CB', x: 23, y: 37, role: 'Covering CB' },
        { position: 'CB', x: 23, y: 63, role: 'Ball-Playing CB' },
        { position: 'RB', x: 27, y: 85, role: 'Inverted Wing-Back' },
        { position: 'CDM', x: 42, y: 36, role: 'Ball-Winning Pivot' },
        { position: 'CDM', x: 42, y: 64, role: 'Deep Playmaker' },
        { position: 'LAM', x: 68, y: 20, role: 'Inverted Playmaker' },
        { position: 'CAM', x: 68, y: 50, role: 'Shadow Striker' },
        { position: 'RAM', x: 68, y: 80, role: 'Wide Playmaker' },
        { position: 'ST', x: 88, y: 50, role: 'Target Forward' },
      ],
    },
    '4-4-2': {
      name: '4-4-2 Classic Flat',
      description: 'Disciplined zonal banks of four with paired center-forward partnership.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Traditional Shot-Stopper' },
        { position: 'LB', x: 26, y: 15, role: 'Defensive Full-Back' },
        { position: 'CB', x: 23, y: 38, role: 'No-Nonsense CB' },
        { position: 'CB', x: 23, y: 62, role: 'Covering CB' },
        { position: 'RB', x: 26, y: 85, role: 'Defensive Full-Back' },
        { position: 'LM', x: 53, y: 15, role: 'Wide Midfielder' },
        { position: 'CM', x: 49, y: 38, role: 'Ball-Winning Midfielder' },
        { position: 'CM', x: 49, y: 62, role: 'Box-to-Box Midfielder' },
        { position: 'RM', x: 53, y: 85, role: 'Wide Midfielder' },
        { position: 'ST', x: 84, y: 36, role: 'Target Forward' },
        { position: 'ST', x: 84, y: 64, role: 'Poacher / Fox-in-the-Box' },
      ],
    },
    '3-5-2': {
      name: '3-5-2 Wing-Back Overload',
      description: 'Three central defenders anchoring tireless wing-backs across the flanks.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'CB', x: 23, y: 25, role: 'Wide Center-Back' },
        { position: 'CB', x: 20, y: 50, role: 'Libero / Sweeper' },
        { position: 'CB', x: 23, y: 75, role: 'Wide Center-Back' },
        { position: 'LWB', x: 52, y: 12, role: 'Attacking Wing-Back' },
        { position: 'CDM', x: 44, y: 50, role: 'Holding Anchor' },
        { position: 'RWB', x: 52, y: 88, role: 'Attacking Wing-Back' },
        { position: 'CM', x: 62, y: 34, role: 'Mezzala' },
        { position: 'CM', x: 62, y: 66, role: 'Advanced Playmaker' },
        { position: 'ST', x: 84, y: 38, role: 'Pressing Forward' },
        { position: 'ST', x: 84, y: 62, role: 'Poacher' },
      ],
    },
    '3-2-4-1': {
      name: '3-2-4-1 Inverted Box Midfield',
      description: 'Arteta / Guardiola box midfield providing 5v5 overload in the build-up phase.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'CB', x: 24, y: 24, role: 'Wide Center-Back' },
        { position: 'CB', x: 20, y: 50, role: 'Ball-Playing CB' },
        { position: 'CB', x: 24, y: 76, role: 'Wide Center-Back' },
        { position: 'CDM', x: 44, y: 38, role: 'Inverted Full-Back / DM' },
        { position: 'CDM', x: 44, y: 62, role: 'Deep Anchor' },
        { position: 'LW', x: 74, y: 13, role: 'Touchline Winger' },
        { position: 'AM', x: 66, y: 38, role: 'Half-Space Attacking Mid' },
        { position: 'AM', x: 66, y: 62, role: 'Half-Space Attacking Mid' },
        { position: 'RW', x: 74, y: 87, role: 'Touchline Winger' },
        { position: 'ST', x: 89, y: 50, role: 'Apex Predator / No. 9' },
      ],
    },
  },
  '9v9': {
    '3-2-3': {
      name: '3-2-3 Attacking Youth',
      description: 'Dynamic academy shape with twin wingers and central midfield balance.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'LB', x: 28, y: 18, role: 'Attacking Full-Back' },
        { position: 'CB', x: 24, y: 50, role: 'Ball-Playing CB' },
        { position: 'RB', x: 28, y: 82, role: 'Attacking Full-Back' },
        { position: 'CM', x: 48, y: 36, role: 'Box-to-Box Midfielder' },
        { position: 'CM', x: 48, y: 64, role: 'Advanced Playmaker' },
        { position: 'LW', x: 74, y: 18, role: 'Inside Forward' },
        { position: 'ST', x: 86, y: 50, role: 'Complete Forward' },
        { position: 'RW', x: 74, y: 82, role: 'Winger' },
      ],
    },
    '3-3-2': {
      name: '3-3-2 Balanced Academy',
      description: 'Disciplined 3-line shape with twin central strikers.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Traditional Shot-Stopper' },
        { position: 'LB', x: 28, y: 20, role: 'Defensive Full-Back' },
        { position: 'CB', x: 24, y: 50, role: 'Covering CB' },
        { position: 'RB', x: 28, y: 80, role: 'Defensive Full-Back' },
        { position: 'LM', x: 52, y: 20, role: 'Wide Midfielder' },
        { position: 'CM', x: 50, y: 50, role: 'Central Engine' },
        { position: 'RM', x: 52, y: 80, role: 'Wide Midfielder' },
        { position: 'ST', x: 84, y: 38, role: 'Pressing Forward' },
        { position: 'ST', x: 84, y: 62, role: 'Poacher' },
      ],
    },
    '4-3-1': {
      name: '4-3-1 Solid Transition',
      description: 'Solid 4-chain defense with No. 10 operating behind lone striker.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'LB', x: 27, y: 16, role: 'Overlapping Full-Back' },
        { position: 'CB', x: 23, y: 38, role: 'Stopper CB' },
        { position: 'CB', x: 23, y: 62, role: 'Covering CB' },
        { position: 'RB', x: 27, y: 84, role: 'Overlapping Full-Back' },
        { position: 'CM', x: 50, y: 32, role: 'Ball-Winning Mid' },
        { position: 'CAM', x: 65, y: 50, role: 'No. 10 Playmaker' },
        { position: 'CM', x: 50, y: 68, role: 'Deep Pivot' },
        { position: 'ST', x: 87, y: 50, role: 'Apex Predator' },
      ],
    },
  },
  '7v7': {
    '2-3-1': {
      name: '2-3-1 Grassroots Standard',
      description: 'The global standard formation for mini-soccer and junior player development.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'CB', x: 26, y: 35, role: 'Left Central Defender' },
        { position: 'CB', x: 26, y: 65, role: 'Right Central Defender' },
        { position: 'LM', x: 55, y: 18, role: 'Left Winger' },
        { position: 'CM', x: 52, y: 50, role: 'Central Playmaker' },
        { position: 'RM', x: 55, y: 82, role: 'Right Winger' },
        { position: 'ST', x: 86, y: 50, role: 'Target Forward' },
      ],
    },
    '3-2-1': {
      name: '3-2-1 Junior Fortress',
      description: 'Defensive stability with three backline anchors and twin midfielders.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Traditional Shot-Stopper' },
        { position: 'LB', x: 28, y: 20, role: 'Defensive Full-Back' },
        { position: 'CB', x: 24, y: 50, role: 'Commanding CB' },
        { position: 'RB', x: 28, y: 80, role: 'Defensive Full-Back' },
        { position: 'CM', x: 56, y: 38, role: 'Ball-Winning Mid' },
        { position: 'CM', x: 56, y: 62, role: 'Box-to-Box Mid' },
        { position: 'ST', x: 86, y: 50, role: 'Pressing Striker' },
      ],
    },
    '2-2-2': {
      name: '2-2-2 Twin Attack',
      description: 'Balanced 3-pair mini formation promoting fast combination play.',
      coords: [
        { position: 'GK', x: 8, y: 50, role: 'Sweeper Keeper' },
        { position: 'CB', x: 26, y: 35, role: 'Ball-Playing CB' },
        { position: 'CB', x: 26, y: 65, role: 'Ball-Playing CB' },
        { position: 'CM', x: 52, y: 38, role: 'Central Playmaker' },
        { position: 'CM', x: 52, y: 62, role: 'Central Playmaker' },
        { position: 'ST', x: 84, y: 35, role: 'Left Striker' },
        { position: 'ST', x: 84, y: 65, role: 'Right Striker' },
      ],
    },
  },
};

// Flattened presets for direct backwards compatibility
export const FORMATION_PRESETS: Record<string, { name: string; description: string; coords: Omit<PitchPosition, 'name' | 'number' | 'id'>[] }> = {
  ...FORMAT_PRESETS['11v11'],
  ...FORMAT_PRESETS['9v9'],
  ...FORMAT_PRESETS['7v7'],
};

const TACTICAL_ROLES = [
  'Sweeper Keeper',
  'Traditional Shot-Stopper',
  'Inverted Wing-Back',
  'Overlapping Full-Back',
  'Ball-Playing CB',
  'Stopper CB',
  'Wide Center-Back',
  'Deep-Lying Playmaker',
  'Box-to-Box Midfielder',
  'Ball-Winning Midfielder',
  'Advanced Playmaker',
  'Mezzala',
  'Shadow Striker',
  'Inside Forward',
  'Touchline Winger',
  'False 9',
  'Complete Forward',
  'Target Forward',
  'Poacher / Fox-in-the-Box',
  'Pressing Forward',
];

export default function TacticalPitch({
  players,
  formation = '4-3-3',
  matchFormat,
  onFormatChange,
  savedPositions,
  primaryColor = '#10B981',
  isEditable = true,
  matchEvents = [],
  onSaveFormation,
  teamName,
  onSwapWithBench,
}: TacticalPitchProps) {
  // Helper to determine active format
  const detectFormat = (fName: string, propFormat?: MatchFormat): MatchFormat => {
    if (propFormat) return propFormat;
    if (['3-2-3', '3-3-2', '4-3-1'].includes(fName)) return '9v9';
    if (['2-3-1', '3-2-1', '2-2-2'].includes(fName)) return '7v7';
    return '11v11';
  };

  const [activeFormat, setActiveFormat] = useState<MatchFormat>(() => detectFormat(formation, matchFormat));

  // Sync format if prop changes
  useEffect(() => {
    if (matchFormat) {
      setActiveFormat(matchFormat);
    }
  }, [matchFormat]);

  // Normalize incoming formation name to matching preset key or 'Custom'
  const initialPresetKey = Object.keys(FORMATION_PRESETS).find(k => formation.includes(k)) || (activeFormat === '7v7' ? '2-3-1' : activeFormat === '9v9' ? '3-2-3' : '4-3-3');
  const [selectedFormationKey, setSelectedFormationKey] = useState<string>(
    formation.toLowerCase().includes('custom') || savedPositions?.length ? 'Custom' : initialPresetKey
  );
  const [isFreeFormMode, setIsFreeFormMode] = useState<boolean>(
    formation.toLowerCase().includes('custom') || !!savedPositions?.length
  );

  // Initialize Pitch Positions from saved coordinates, or preset mapped with squad players
  const generatePositions = useCallback((presetKey: string): PitchPosition[] => {
    const preset = FORMATION_PRESETS[presetKey] || FORMATION_PRESETS['4-3-3'];
    return preset.coords.map((coord, idx) => {
      const squadPlayer = players[idx];
      return {
        id: squadPlayer?.id || `pos-${idx}`,
        member_id: squadPlayer?.id,
        name: squadPlayer?.full_name || `Player ${idx + 1}`,
        number: squadPlayer?.jersey_number || (idx === 0 ? 1 : idx + 1),
        position: squadPlayer?.player_position || coord.position,
        x: coord.x,
        y: coord.y,
        role: coord.role,
        is_captain: squadPlayer?.is_executive && squadPlayer?.role === 'player',
      };
    });
  }, [players]);

  const [positions, setPositions] = useState<PitchPosition[]>(() => {
    if (savedPositions && savedPositions.length > 0) {
      return savedPositions;
    }
    return generatePositions(initialPresetKey);
  });

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [dragCoordinateFeedback, setDragCoordinateFeedback] = useState<{ x: number; y: number; zone: string } | null>(null);

  const pitchRef = useRef<HTMLDivElement | null>(null);

  // Synchronize when squad players or savedPositions change
  useEffect(() => {
    if (savedPositions && savedPositions.length > 0) {
      setPositions(savedPositions);
      setSelectedFormationKey('Custom');
      setIsFreeFormMode(true);
    }
  }, [savedPositions]);

  // Sector Zone Calculator for real-time tactical intelligence
  const getSectorZone = (x: number, y: number): string => {
    const flank = y < 30 ? 'Left Flank' : y > 70 ? 'Right Flank' : 'Central Channel';
    if (x <= 18) return `Defensive Box (${flank})`;
    if (x <= 36) return `Defensive Third (${flank})`;
    if (x <= 64) return `Middle Third / Engine Room (${flank})`;
    if (x <= 84) return `Attacking Half-Space (${flank})`;
    return `Opponent 18-Yard Danger Zone (${flank})`;
  };

  // Change preset formation
  const handleSelectPreset = (presetKey: string) => {
    setSelectedFormationKey(presetKey);
    setIsFreeFormMode(false);
    setPositions(generatePositions(presetKey));
  };

  // Change Match Format (11v11, 9v9, 7v7)
  const handleFormatChange = (fmt: MatchFormat) => {
    setActiveFormat(fmt);
    if (onFormatChange) onFormatChange(fmt);
    const defaultPreset = fmt === '7v7' ? '2-3-1' : fmt === '9v9' ? '3-2-3' : '4-3-3';
    handleSelectPreset(defaultPreset);
  };

  // Toggle Free-Form Tactical Mode
  const handleToggleFreeForm = () => {
    if (!isFreeFormMode) {
      setIsFreeFormMode(true);
      setSelectedFormationKey('Custom');
    } else {
      const defaultPreset = activeFormat === '7v7' ? '2-3-1' : activeFormat === '9v9' ? '3-2-3' : '4-3-3';
      handleSelectPreset(defaultPreset);
    }
  };

  // Reset to current preset
  const handleResetToPreset = () => {
    const defaultPreset = activeFormat === '7v7' ? '2-3-1' : activeFormat === '9v9' ? '3-2-3' : '4-3-3';
    const key = selectedFormationKey === 'Custom' ? defaultPreset : selectedFormationKey;
    handleSelectPreset(key);
  };

  // 1. Pointer Down on a Player Pin
  const handlePointerDown = (e: React.PointerEvent, playerId: string) => {

    if (!isEditable) return;
    e.preventDefault();
    e.stopPropagation();

    setSelectedPlayerId(playerId);
    setDraggingPlayerId(playerId);

    const targetNode = e.currentTarget as HTMLElement;
    targetNode.setPointerCapture(e.pointerId);

    const player = positions.find(p => p.id === playerId);
    if (player) {
      setDragCoordinateFeedback({
        x: player.x,
        y: player.y,
        zone: getSectorZone(player.x, player.y),
      });
    }
  };

  // 2. Pointer Move (Window/Pitch scope)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPlayerId || !pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Pitch constraints: 5% <= X <= 95%, 8% <= Y <= 92%
    const clampedX = Math.round(Math.max(5, Math.min(95, rawX)) * 10) / 10;
    const clampedY = Math.round(Math.max(8, Math.min(92, rawY)) * 10) / 10;

    setPositions(prev =>
      prev.map(p => (p.id === draggingPlayerId ? { ...p, x: clampedX, y: clampedY } : p))
    );

    setDragCoordinateFeedback({
      x: clampedX,
      y: clampedY,
      zone: getSectorZone(clampedX, clampedY),
    });

    if (selectedFormationKey !== 'Custom') {
      setSelectedFormationKey('Custom');
      setIsFreeFormMode(true);
    }
  };

  // 3. Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingPlayerId) {
      try {
        const targetNode = e.currentTarget as HTMLElement;
        targetNode.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
      setDraggingPlayerId(null);
      setDragCoordinateFeedback(null);
    }
  };

  // 4. Keyboard Nudge Accessibility
  const handleKeyDown = (e: React.KeyboardEvent, playerId: string) => {
    if (!isEditable) return;
    const step = e.shiftKey ? 5 : 2;

    let deltaX = 0;
    let deltaY = 0;

    if (e.key === 'ArrowLeft') deltaX = -step;
    else if (e.key === 'ArrowRight') deltaX = step;
    else if (e.key === 'ArrowUp') deltaY = -step;
    else if (e.key === 'ArrowDown') deltaY = step;
    else return;

    e.preventDefault();

    setPositions(prev =>
      prev.map(p => {
        if (p.id === playerId) {
          const newX = Math.max(5, Math.min(95, p.x + deltaX));
          const newY = Math.max(8, Math.min(92, p.y + deltaY));
          return { ...p, x: newX, y: newY };
        }
        return p;
      })
    );

    if (selectedFormationKey !== 'Custom') {
      setSelectedFormationKey('Custom');
      setIsFreeFormMode(true);
    }
  };

  // Save Formation
  const handleSave = () => {
    if (onSaveFormation) {
      onSaveFormation(selectedFormationKey, positions);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2400);
    }
  };

  // Selected player details
  const activePlayer = positions.find(p => p.id === selectedPlayerId);
  const activeSquadMember = players.find(p => p.id === activePlayer?.member_id);

  // Check card/substitution status from live match events
  const getPlayerMatchBadges = (playerName: string) => {
    const playerEvents = matchEvents.filter(
      e => e.player_name.toLowerCase().includes(playerName.toLowerCase())
    );
    const hasYellow = playerEvents.some(e => e.event_type === 'yellow_card');
    const hasRed = playerEvents.some(e => e.event_type === 'red_card');
    const hasGoal = playerEvents.some(e => e.event_type === 'goal' || e.event_type === 'penalty');
    const isSubbedOff = playerEvents.some(
      e => e.event_type === 'sub' && e.detail_text?.toLowerCase().includes('off')
    );
    return { hasYellow, hasRed, hasGoal, isSubbedOff };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Bar: Formation Switcher & Mode Badges */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.6rem 0.85rem',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(14, 20, 30, 0.7)',
        border: '1px solid var(--border-subtle)',
      }}>
        {/* Left: Format Switcher (11v11, 9v9, 7v7) + System Shapes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>
          {/* Format Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}>
            {(['11v11', '9v9', '7v7'] as MatchFormat[]).map(fmt => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleFormatChange(fmt)}
                style={{
                  padding: '0.28rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: activeFormat === fmt ? 800 : 600,
                  borderRadius: '6px',
                  background: activeFormat === fmt ? primaryColor : 'transparent',
                  color: activeFormat === fmt ? '#FFFFFF' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {fmt === '11v11' ? '11v11 Senior' : fmt === '9v9' ? '9v9 Academy' : '7v7 Junior'}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '22px', background: 'var(--border-subtle)' }} />

          {/* Presets Button Group for Active Format: Horizontal Scroll Pill Strip */}
          <div className="scroll-pill-strip" style={{ flex: 1, minWidth: 0, paddingBottom: '2px' }}>
            <span className="scroll-pill-item" style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginRight: '0.15rem' }}>
              Shape:
            </span>
            {Object.keys(FORMAT_PRESETS[activeFormat] || {}).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key)}
                className="scroll-pill-item btn btn-sm touch-target"
                style={{
                  background: selectedFormationKey === key && !isFreeFormMode ? primaryColor : 'rgba(255, 255, 255, 0.05)',
                  color: selectedFormationKey === key && !isFreeFormMode ? 'var(--club-primary-contrast, #FFFFFF)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: selectedFormationKey === key && !isFreeFormMode ? primaryColor : 'var(--border-subtle)',
                  minHeight: '36px',
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Custom / Free-Form Mode Pill */}
          <button
            onClick={handleToggleFreeForm}
            className="btn btn-sm"
            style={{
              background: isFreeFormMode ? '#F59E0B' : 'rgba(245, 158, 11, 0.12)',
              color: isFreeFormMode ? '#000000' : '#F59E0B',
              fontWeight: 800,
              fontSize: '0.8rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #F59E0B',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Freely drag and drop players into custom tactical positions"
          >
            <Move size={13} />
            <span>Free-Form</span>
          </button>
        </div>

        {/* Action Controls: Reset & Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isFreeFormMode && (
            <button
              onClick={handleResetToPreset}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              title="Reset player positions back to formation standard"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          {onSaveFormation && (
            <button
              onClick={handleSave}
              className="btn btn-primary btn-sm"
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: saveSuccess ? '#10B981' : primaryColor,
              }}
            >
              {saveSuccess ? <Check size={14} /> : <Save size={14} />}
              <span>{saveSuccess ? 'Saved!' : 'Save Shape'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Drag Tooltip Feedback Banner */}
      {dragCoordinateFeedback && (
        <div style={{
          padding: '0.45rem 0.85rem',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid #F59E0B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: '#F59E0B',
          fontWeight: 700,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Crosshair size={14} />
            <span>Repositioning: <strong>{dragCoordinateFeedback.zone}</strong></span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            X: {dragCoordinateFeedback.x}% • Y: {dragCoordinateFeedback.y}%
          </span>
        </div>
      )}

      {/* THE FOOTBALL PITCH CANVAS */}
      <div
        ref={pitchRef}
        className="tactical-pitch"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* 1. Pitch Markings */}
        <div className="pitch-halfway-line" />
        <div className="pitch-center-circle" />
        <div className="pitch-center-spot" />

        {/* 2. Penalty & Goal Areas */}
        <div className="pitch-penalty-box-left" />
        <div className="pitch-six-yard-left" />
        <div className="pitch-penalty-spot-left" />
        <div className="pitch-penalty-arc-left" />
        <div className="pitch-goal-left" />

        <div className="pitch-penalty-box-right" />
        <div className="pitch-six-yard-right" />
        <div className="pitch-penalty-spot-right" />
        <div className="pitch-penalty-arc-right" />
        <div className="pitch-goal-right" />

        {/* 3. Corner Arcs */}
        <div className="pitch-corner-arc pitch-corner-tl" />
        <div className="pitch-corner-arc pitch-corner-tr" />
        <div className="pitch-corner-arc pitch-corner-bl" />
        <div className="pitch-corner-arc pitch-corner-br" />

        {/* 4. Format & Orientation Watermarks */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '18px',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.68rem',
          fontWeight: 800,
          color: activeFormat === '7v7' ? '#F59E0B' : activeFormat === '9v9' ? '#60A5FA' : '#10B981',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}>
          <span>{activeFormat === '7v7' ? '⚡ 7v7 Mini-Soccer' : activeFormat === '9v9' ? '🏆 9v9 Academy' : '⭐ 11v11 Senior'}</span>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          color: 'rgba(255, 255, 255, 0.22)',
          fontSize: '0.72rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}>
          <span>Attacking Direction &rarr;</span>
        </div>

        {/* 5. Interactive Draggable Player Nodes */}
        {positions.map(pos => {
          const badges = getPlayerMatchBadges(pos.name);
          const isDragging = draggingPlayerId === pos.id;
          const isSelected = selectedPlayerId === pos.id;

          return (
            <div
              key={pos.id}
              className={`pitch-player-node ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
              onPointerDown={e => handlePointerDown(e, pos.id)}
              onClick={() => setSelectedPlayerId(pos.id)}
              onKeyDown={e => handleKeyDown(e, pos.id)}
              tabIndex={0}
              role="button"
              aria-label={`${pos.name}, number ${pos.number}, ${pos.position}. Use arrow keys to reposition.`}
            >
              {/* Jersey Node Pin */}
              <div
                className="player-node-circle"
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: pos.position === 'GK'
                    ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                    : `linear-gradient(135deg, ${primaryColor} 0%, rgba(0,0,0,0.3) 100%), ${primaryColor}`,
                  border: isSelected
                    ? '2.5px solid #FFFFFF'
                    : '2px solid rgba(255, 255, 255, 0.85)',
                  boxShadow: isDragging
                    ? '0 0 20px #F59E0B, 0 8px 20px rgba(0,0,0,0.7)'
                    : isSelected
                    ? '0 0 16px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(0,0,0,0.6)'
                    : '0 4px 12px rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                {pos.number}

                {/* Captain's Armband */}
                {pos.is_captain && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '-6px',
                    background: '#F59E0B',
                    color: '#000',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #000',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  }}>
                    C
                  </span>
                )}

                {/* Yellow / Red Card Status Overlays */}
                {badges.hasRed ? (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#EF4444',
                    width: '10px',
                    height: '14px',
                    borderRadius: '2px',
                    border: '1px solid #FFFFFF',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
                  }} title="Red Card" />
                ) : badges.hasYellow ? (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#F59E0B',
                    width: '10px',
                    height: '14px',
                    borderRadius: '2px',
                    border: '1px solid #000000',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.6)',
                  }} title="Yellow Card" />
                ) : null}

                {/* Goal Scored Indicator Flame */}
                {badges.hasGoal && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-6px',
                    right: '-6px',
                    background: '#10B981',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #FFFFFF',
                  }}>
                    <Flame size={10} color="#FFFFFF" />
                  </span>
                )}
              </div>

              {/* Player Name & Role Label Badge */}
              <div
                className="player-node-name"
                style={{
                  marginTop: '4px',
                  background: 'rgba(8, 12, 18, 0.88)',
                  backdropFilter: 'blur(6px)',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: isSelected ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
              }}>
                <span>{pos.name.split(' ').pop()}</span>
                <span style={{
                  fontSize: '0.6rem',
                  color: primaryColor,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                }}>
                  {pos.position}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tactical Assistant Footer & Mode Hint */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        padding: '0 0.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={14} />
          <span>
            {isEditable
              ? 'Click & drag any player pin to position freely. Focus + Arrow keys to nudge.'
              : 'Interactive Matchday Tactical Board.'}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          Active: <span style={{ color: primaryColor, fontWeight: 700 }}>{selectedFormationKey}</span>
        </div>
      </div>

      {/* Selected Player Detail & Tactical Role Card */}
      {activePlayer && (
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem',
            background: 'linear-gradient(135deg, rgba(20, 28, 41, 0.95) 0%, rgba(10, 15, 23, 0.98) 100%)',
            border: `1.5px solid ${primaryColor}`,
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.25rem',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          {/* Player Info Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: activePlayer.position === 'GK' ? '#F59E0B' : primaryColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 900,
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              #{activePlayer.number}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {activePlayer.name}
                </h4>
                {activePlayer.is_captain && (
                  <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                    Captain
                  </span>
                )}
                <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                  {activePlayer.position}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Tactical Zone: <strong style={{ color: '#FFFFFF' }}>{getSectorZone(activePlayer.x, activePlayer.y)}</strong>
                {' '}(X: {activePlayer.x}%, Y: {activePlayer.y}%)
              </p>
            </div>
          </div>

          {/* Tactical Role Selector & Actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Assigned Role:
              </span>
              <select
                className="form-select"
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.8rem', width: 'auto', minWidth: '180px' }}
                value={activePlayer.role || ''}
                onChange={e => {
                  const newRole = e.target.value;
                  setPositions(prev =>
                    prev.map(p => (p.id === activePlayer.id ? { ...p, role: newRole } : p))
                  );
                }}
              >
                {TACTICAL_ROLES.map(role => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {onSwapWithBench && (
              <button
                type="button"
                onClick={() => onSwapWithBench(activePlayer.id)}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderColor: '#3B82F6',
                  color: '#60A5FA',
                }}
              >
                <ArrowLeftRight size={14} />
                <span>Swap with Bench</span>
              </button>
            )}

            <button
              onClick={() => setSelectedPlayerId(null)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
