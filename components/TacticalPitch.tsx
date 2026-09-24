'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClubMember, MatchEvent, PitchPosition, MatchFormat, isPlayerMember } from '@/lib/supabase/types';
import PlayerAvatar from './PlayerAvatar';
import {
  Move,
  RotateCcw,
  Save,
  Check,
  Info,
  ArrowLeftRight,
  Crosshair,
  User,
  Flame,
  Smartphone,
  Monitor
} from 'lucide-react';

export interface TacticalPitchProps {
  players: ClubMember[];
  formation?: string;
  matchFormat?: MatchFormat;
  onFormatChange?: (format: MatchFormat) => void;
  savedPositions?: PitchPosition[];
  /** Controlled mode: when both are passed the parent owns the lineup, and every edit
   *  (drag, swap, shape/format change, role change) is reported through onPositionsChange. */
  positions?: PitchPosition[];
  onPositionsChange?: (positions: PitchPosition[]) => void;
  onFormationChange?: (formationKey: string) => void;
  primaryColor?: string;
  isEditable?: boolean;
  matchEvents?: MatchEvent[];
  onSaveFormation?: (formationName: string, positions: PitchPosition[]) => void;
  saveLabel?: string;
  teamName?: string;
  onSwapWithBench?: (slotId: string) => void;
  /** A pitch player was sent to the bench: dragged onto [data-bench-dropzone] / a
   *  [data-bench-member-id] card (that bench player swaps in), or via the "Bench" button. */
  onSendToBench?: (slotId: string, benchMemberId: string | null) => void;
  /** Return true to consume a tap on a slot (e.g. finishing a tap-to-substitute) instead of selecting it. */
  onSlotTap?: (slotId: string) => boolean;
  /** Slot to highlight as the drop target of a drag that started outside the pitch (the bench). */
  externalDropTargetId?: string | null;
  /** Pulse every slot, e.g. while a bench player is waiting to be tapped onto the pitch. */
  pickMode?: boolean;
  orientation?: 'vertical' | 'horizontal';
  allowOrientationToggle?: boolean;
  /** Set false to hide the format/shape preset switcher and free-form/reset controls (read-only published lineup views) */
  showFormationControls?: boolean;
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

// Flattened presets, keyed by shape name regardless of format (e.g. "4-3-3" -> its 11v11 coords)
const FORMATION_PRESETS: Record<string, { name: string; description: string; coords: Omit<PitchPosition, 'name' | 'number' | 'id'>[] }> = {
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

export const defaultPresetFor = (fmt: MatchFormat): string =>
  fmt === '7v7' ? '2-3-1' : fmt === '9v9' ? '3-2-3' : '4-3-3';

/** A slot with nobody in it (a starter was sent to the bench). Legacy benched slots were saved as "Position X". */
export function isEmptySlot(p: PitchPosition): boolean {
  return !p.member_id && (!p.name || /^Position /.test(p.name));
}

function uniqueSlotId(taken: Set<string>, idx: number): string {
  let n = idx;
  while (taken.has(`slot-${n}`)) n++;
  const id = `slot-${n}`;
  taken.add(id);
  return id;
}

function occupantOf(member: ClubMember) {
  return {
    member_id: member.id,
    name: member.full_name,
    number: member.jersey_number || 0,
    position: member.player_position,
    is_captain: !!member.is_executive && isPlayerMember(member),
  };
}

/** Lays a preset's coordinates over the current lineup. Each slot keeps its player (preset slot order
 *  is GK → defence → midfield → attack), new slots are filled from players not yet on the pitch, and
 *  surplus starters drop to the bench. With an empty lineup this builds a fresh default XI. */
export function buildLineupForPreset(players: ClubMember[], presetKey: string, current: PitchPosition[] = []): PitchPosition[] {
  const preset = FORMATION_PRESETS[presetKey] || FORMATION_PRESETS['4-3-3'];
  const kept = current.slice(0, preset.coords.length);
  const taken = new Set(kept.map(p => p.id));
  const onPitch = new Set(kept.map(p => p.member_id).filter(Boolean));
  const reserves = players.filter(p => !onPitch.has(p.id));

  return preset.coords.map((coord, idx) => {
    const slot = kept[idx];
    if (slot) {
      return isEmptySlot(slot)
        ? { ...slot, x: coord.x, y: coord.y, role: coord.role, position: coord.position }
        : { ...slot, x: coord.x, y: coord.y, role: coord.role };
    }
    const reserve = reserves.shift();
    const base = { id: uniqueSlotId(taken, idx), x: coord.x, y: coord.y, role: coord.role };
    return reserve
      ? { ...base, ...occupantOf(reserve), position: reserve.player_position || coord.position }
      : { ...base, member_id: undefined, name: '', number: 0, position: coord.position, is_captain: false };
  });
}

/** Repairs lineups saved by older builds: guarantees unique slot ids and never the same player in two slots. */
export function normalizeLineup(list: PitchPosition[]): PitchPosition[] {
  const ids = new Set<string>();
  const members = new Set<string>();
  return list.map((p, idx) => {
    const id = p.id && !ids.has(p.id) ? p.id : uniqueSlotId(ids, idx);
    ids.add(id);
    if (p.member_id && members.has(p.member_id)) {
      return { ...p, id, member_id: undefined, name: '', number: 0, is_captain: false };
    }
    if (p.member_id) members.add(p.member_id);
    return { ...p, id };
  });
}

/** Puts `member` into `slotId`; whoever was there drops to the bench (bench = squad minus pitch). */
export function placeOnSlot(list: PitchPosition[], slotId: string, member: ClubMember): PitchPosition[] {
  return list.map(p => {
    if (p.id === slotId) return { ...p, ...occupantOf(member), position: member.player_position || p.position };
    // The same player can't hold two slots: if they were already on the pitch, their old slot empties.
    if (p.member_id === member.id) return { ...p, member_id: undefined, name: '', number: 0, is_captain: false };
    return p;
  });
}

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
  saveLabel = 'Save Shape',
  onSwapWithBench,
  onSendToBench,
  onSlotTap,
  externalDropTargetId = null,
  pickMode = false,
  positions: controlledPositions,
  onPositionsChange,
  onFormationChange,
  orientation,
  allowOrientationToggle = true,
  showFormationControls = true,
}: TacticalPitchProps) {
  // Orientation state (portrait/vertical optimized for mobile devices)
  const [isVertical, setIsVertical] = useState<boolean>(() => {
    if (orientation !== undefined) return orientation === 'vertical';
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
    return false;
  });

  useEffect(() => {
    if (orientation !== undefined) {
      setIsVertical(orientation === 'vertical');
    } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsVertical(true);
    }
  }, [orientation]);

  // Helper to determine active format
  const detectFormat = (fName: string, propFormat?: MatchFormat): MatchFormat => {
    if (propFormat) return propFormat;
    if (['3-2-3', '3-3-2', '4-3-1'].includes(fName)) return '9v9';
    if (['2-3-1', '3-2-1', '2-2-2'].includes(fName)) return '7v7';
    return '11v11';
  };

  const [activeFormat, setActiveFormat] = useState<MatchFormat>(() => detectFormat(formation, matchFormat));
  const [hoveredDropTargetId, setHoveredDropTargetId] = useState<string | null>(null);

  // Sync format if prop changes
  useEffect(() => {
    if (matchFormat) {
      setActiveFormat(matchFormat);
    }
  }, [matchFormat]);

  const isControlled = controlledPositions !== undefined && !!onPositionsChange;

  // Normalize incoming formation name to matching preset key or 'Custom'
  const initialPresetKey = Object.keys(FORMATION_PRESETS).find(k => formation.includes(k)) || defaultPresetFor(activeFormat);
  const startsCustom = isControlled
    ? !FORMATION_PRESETS[formation]
    : formation.toLowerCase().includes('custom') || !!savedPositions?.length;
  const [selectedFormationKey, setSelectedFormationKeyState] = useState<string>(startsCustom ? 'Custom' : initialPresetKey);
  const [isFreeFormMode, setIsFreeFormMode] = useState<boolean>(startsCustom);
  const lastPresetRef = useRef<string>(initialPresetKey);
  const [nameDisplay, setNameDisplay] = useState<'first' | 'last'>('first');

  const changeFormationKey = (key: string) => {
    setSelectedFormationKeyState(key);
    setIsFreeFormMode(key === 'Custom');
    if (key !== 'Custom') lastPresetRef.current = key;
    onFormationChange?.(key);
  };

  // In controlled mode the parent's formation is the source of truth (e.g. after switching fixture)
  useEffect(() => {
    if (!isControlled) return;
    const key = FORMATION_PRESETS[formation] ? formation : 'Custom';
    setSelectedFormationKeyState(key);
    setIsFreeFormMode(key === 'Custom');
    if (key !== 'Custom') lastPresetRef.current = key;
  }, [formation, isControlled]);

  const [internalPositions, setInternalPositions] = useState<PitchPosition[]>(() =>
    savedPositions?.length ? savedPositions : buildLineupForPreset(players, initialPresetKey)
  );
  const positions = isControlled ? controlledPositions : internalPositions;

  // Always-current lineup, so several edits within one event compose instead of clobbering each other
  const positionsRef = useRef<PitchPosition[]>(positions);
  positionsRef.current = positions;

  const setPositions = useCallback((update: React.SetStateAction<PitchPosition[]>) => {
    const next = typeof update === 'function' ? update(positionsRef.current) : update;
    positionsRef.current = next;
    if (isControlled) onPositionsChange!(next);
    else setInternalPositions(next);
  }, [isControlled, onPositionsChange]);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [dragCoordinateFeedback, setDragCoordinateFeedback] = useState<{ x: number; y: number; zone: string } | null>(null);

  const pitchRef = useRef<HTMLDivElement | null>(null);

  // Uncontrolled: follow savedPositions when their *content* changes. Comparing by reference reset the
  // board mid-edit whenever a realtime match update handed over a fresh-but-identical array.
  const savedKey = savedPositions?.length ? JSON.stringify(savedPositions) : '';
  useEffect(() => {
    if (isControlled || !savedKey) return;
    setInternalPositions(JSON.parse(savedKey));
    setSelectedFormationKeyState('Custom');
    setIsFreeFormMode(true);
  }, [savedKey, isControlled]);

  // Sector Zone Calculator for real-time tactical intelligence
  const getSectorZone = (x: number, y: number): string => {
    const flank = y < 30 ? 'Left Flank' : y > 70 ? 'Right Flank' : 'Central Channel';
    if (x <= 18) return `Defensive Box (${flank})`;
    if (x <= 36) return `Defensive Third (${flank})`;
    if (x <= 64) return `Middle Third / Engine Room (${flank})`;
    if (x <= 84) return `Attacking Half-Space (${flank})`;
    return `Opponent 18-Yard Danger Zone (${flank})`;
  };

  // Change preset formation: keeps the current players, only their coordinates/roles change
  const handleSelectPreset = (presetKey: string) => {
    changeFormationKey(presetKey);
    setPositions(prev => buildLineupForPreset(players, presetKey, prev));
  };

  // Change Match Format (11v11, 9v9, 7v7)
  const handleFormatChange = (fmt: MatchFormat) => {
    setActiveFormat(fmt);
    if (onFormatChange) onFormatChange(fmt);
    handleSelectPreset(defaultPresetFor(fmt));
  };

  // Toggle Free-Form Tactical Mode
  const handleToggleFreeForm = () => {
    if (!isFreeFormMode) {
      changeFormationKey('Custom');
    } else {
      handleSelectPreset(lastPresetRef.current in (FORMAT_PRESETS[activeFormat] || {}) ? lastPresetRef.current : defaultPresetFor(activeFormat));
    }
  };

  // Reset coordinates back to the last preset shape (players stay where they are in the lineup)
  const handleResetToPreset = () => {
    const key = selectedFormationKey !== 'Custom'
      ? selectedFormationKey
      : lastPresetRef.current in (FORMAT_PRESETS[activeFormat] || {}) ? lastPresetRef.current : defaultPresetFor(activeFormat);
    handleSelectPreset(key);
  };

  // --- Pointer drag (mouse, touch and pen share one code path) ---------------------------------
  // The drag lives in a ref so every pointer event sees the latest state; React state only drives rendering.
  const dragRef = useRef<{
    slotId: string;
    pointerId: number;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
    active: boolean;
  } | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const benchHoverElRef = useRef<Element | null>(null);

  const setBenchHover = (el: Element | null) => {
    if (benchHoverElRef.current === el) return;
    benchHoverElRef.current?.classList.remove('is-drop-hover');
    el?.classList.add('is-drop-hover');
    benchHoverElRef.current = el;
  };

  const benchTargetAt = (x: number, y: number): Element | null => {
    if (!onSendToBench || typeof document === 'undefined') return null;
    const el = document.elementFromPoint(x, y);
    return el?.closest('[data-bench-member-id]') || el?.closest('[data-bench-dropzone]') || null;
  };

  const isOutsidePitch = (x: number, y: number) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    return !rect || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  };

  const endDrag = () => {
    dragRef.current = null;
    hoveredRef.current = null;
    setBenchHover(null);
    setHoveredDropTargetId(null);
    setDraggingPlayerId(null);
    setDragCoordinateFeedback(null);
  };

  const tapSlot = (slotId: string) => {
    if (onSlotTap?.(slotId)) return;
    setSelectedPlayerId(slotId);
  };

  // 1. Pointer Down on a Player Pin: only arms the drag; it starts once the pointer actually moves
  const handlePointerDown = (e: React.PointerEvent, slotId: string) => {
    if (!isEditable) {
      setSelectedPlayerId(slotId);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); // no text selection / native image drag
    e.stopPropagation();

    const pos = positionsRef.current.find(p => p.id === slotId);
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      slotId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: pos.x, y: pos.y },
      active: false,
    };
  };

  // 2. Pointer Move (events from the captured node bubble up to the pitch)
  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId || !pitchRef.current) return;

    if (!drag.active) {
      const threshold = e.pointerType === 'mouse' ? 4 : 8;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < threshold) return;
      drag.active = true;
      setDraggingPlayerId(drag.slotId);
      setSelectedPlayerId(drag.slotId);
    }

    const rect = pitchRef.current.getBoundingClientRect();
    let rawX: number;
    let rawY: number;

    if (isVertical) {
      // In vertical orientation:
      // Screen X relates to lateral pitch position Y (0% left touchline -> 100% right touchline)
      // Screen Y relates to longitudinal pitch position X (0% bottom defending goal -> 100% top attacking goal)
      rawY = ((e.clientX - rect.left) / rect.width) * 100;
      rawX = 100 - (((e.clientY - rect.top) / rect.height) * 100);
    } else {
      rawX = ((e.clientX - rect.left) / rect.width) * 100;
      rawY = ((e.clientY - rect.top) / rect.height) * 100;
    }

    // Pitch constraints: 5% <= X <= 95%, 8% <= Y <= 92%
    const clampedX = Math.round(Math.max(5, Math.min(95, rawX)) * 10) / 10;
    const clampedY = Math.round(Math.max(8, Math.min(92, rawY)) * 10) / 10;

    const outside = isOutsidePitch(e.clientX, e.clientY);
    const benchEl = outside ? benchTargetAt(e.clientX, e.clientY) : null;
    setBenchHover(benchEl);

    // Proximity to another slot = swap target
    const nearbyPlayer = outside ? undefined : positionsRef.current.find(p => {
      if (p.id === drag.slotId) return false;
      const dx = p.x - clampedX;
      const dy = p.y - clampedY;
      return Math.sqrt(dx * dx + dy * dy) < 6.5;
    });
    hoveredRef.current = nearbyPlayer?.id || null;
    setHoveredDropTargetId(hoveredRef.current);

    setPositions(prev =>
      prev.map(p => (p.id === drag.slotId ? { ...p, x: clampedX, y: clampedY } : p))
    );

    let zone: string;
    if (benchEl) {
      const benchName = benchEl.getAttribute('data-bench-name');
      zone = benchName ? `Release to swap with ${benchName} (bench)` : 'Release to send to the bench';
    } else if (outside) {
      zone = onSendToBench ? 'Off the pitch: release on the bench to substitute, anywhere else to cancel' : 'Off the pitch: release to cancel';
    } else if (nearbyPlayer) {
      zone = isEmptySlot(nearbyPlayer)
        ? `Release to move into the empty ${nearbyPlayer.position} slot`
        : `SWAP TARGET: ${nearbyPlayer.name} (#${nearbyPlayer.number})`;
    } else {
      zone = getSectorZone(clampedX, clampedY);
    }
    setDragCoordinateFeedback({ x: clampedX, y: clampedY, zone });
  };

  // 3. Pointer Up: tap, swap, send to bench, cancel, or free move
  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const benchEl = benchHoverElRef.current;
    const targetId = hoveredRef.current;
    endDrag();

    if (!drag.active) {
      tapSlot(drag.slotId);
      return;
    }

    const restoreOrigin = (list: PitchPosition[]) =>
      list.map(p => (p.id === drag.slotId ? { ...p, x: drag.origin.x, y: drag.origin.y } : p));

    if (benchEl && onSendToBench) {
      setPositions(restoreOrigin);
      onSendToBench(drag.slotId, benchEl.getAttribute('data-bench-member-id'));
      return;
    }

    if (targetId) {
      // Swap the two players between slots; the dragged slot keeps its original coordinates
      setPositions(prev => {
        const src = prev.find(p => p.id === drag.slotId);
        const tgt = prev.find(p => p.id === targetId);
        if (!src || !tgt) return restoreOrigin(prev);
        const identity = (p: PitchPosition) => ({
          member_id: p.member_id, name: p.name, number: p.number, position: p.position, is_captain: p.is_captain,
        });
        return prev.map(p => {
          if (p.id === tgt.id) return { ...p, ...identity(src) };
          if (p.id === src.id) return { ...p, x: drag.origin.x, y: drag.origin.y, ...identity(tgt) };
          return p;
        });
      });
      return;
    }

    if (isOutsidePitch(e.clientX, e.clientY)) {
      setPositions(restoreOrigin);
      return;
    }

    // A free move breaks the preset shape
    if (selectedFormationKey !== 'Custom') changeFormationKey('Custom');
  };

  // The browser took the pointer (scroll gesture, OS interruption): put the player back
  const handlePointerCancel = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag();
    if (drag.active) {
      setPositions(prev => prev.map(p => (p.id === drag.slotId ? { ...p, x: drag.origin.x, y: drag.origin.y } : p)));
    }
  };

  // 4. Keyboard: Enter/Space = tap, arrows = nudge
  const handleKeyDown = (e: React.KeyboardEvent, playerId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isEditable) tapSlot(playerId);
      else setSelectedPlayerId(playerId);
      return;
    }
    if (!isEditable) return;
    const step = e.shiftKey ? 5 : 2;

    let deltaX = 0;
    let deltaY = 0;

    if (isVertical) {
      if (e.key === 'ArrowUp') deltaX = step;
      else if (e.key === 'ArrowDown') deltaX = -step;
      else if (e.key === 'ArrowLeft') deltaY = -step;
      else if (e.key === 'ArrowRight') deltaY = step;
      else return;
    } else {
      if (e.key === 'ArrowLeft') deltaX = -step;
      else if (e.key === 'ArrowRight') deltaX = step;
      else if (e.key === 'ArrowUp') deltaY = -step;
      else if (e.key === 'ArrowDown') deltaY = step;
      else return;
    }

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

    if (selectedFormationKey !== 'Custom') changeFormationKey('Custom');
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

  // Check card/substitution status from live match events
  const getPlayerMatchBadges = (playerName: string) => {
    if (!playerName) return { hasYellow: false, hasRed: false, hasGoal: false, isSubbedOff: false };
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
        flexDirection: 'column',
        gap: '0.65rem',
        padding: 'clamp(0.6rem, 2vw, 0.85rem)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(14, 20, 30, 0.7)',
        border: '1px solid var(--border-subtle)',
        width: '100%',
      }}>
        {/* Row 1: Format Switcher (11v11, 9v9, 7v7) & Shape Presets */}
        {showFormationControls && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
          {/* Format Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}>
            {(['11v11', '9v9', '7v7'] as MatchFormat[]).map(fmt => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleFormatChange(fmt)}
                style={{
                  padding: '0.28rem 0.55rem',
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
                {fmt === '11v11' ? '11v11' : fmt === '9v9' ? '9v9' : '7v7'}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

          {/* Presets Button Group for Active Format */}
          <div className="scroll-pill-strip" style={{ flex: 1, minWidth: '140px', paddingBottom: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginRight: '0.15rem', flexShrink: 0 }}>
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
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: selectedFormationKey === key && !isFreeFormMode ? primaryColor : 'var(--border-subtle)',
                  minHeight: '32px',
                  flexShrink: 0,
                }}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Row 2: Mode & Action Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          width: '100%',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {/* Custom / Free-Form Mode Pill */}
            {showFormationControls && (
              <button
                onClick={handleToggleFreeForm}
                className="btn btn-sm touch-target"
                style={{
                  background: isFreeFormMode ? '#F59E0B' : 'rgba(245, 158, 11, 0.12)',
                  color: isFreeFormMode ? '#000000' : '#F59E0B',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid #F59E0B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="Freely drag and drop players into custom tactical positions"
              >
                <Move size={13} />
                <span>{isFreeFormMode ? 'Free-Form Active' : 'Free-Form'}</span>
              </button>
            )}

            {allowOrientationToggle && (
              <button
                type="button"
                onClick={() => setIsVertical(v => !v)}
                className="btn btn-secondary btn-sm touch-target"
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title={isVertical ? "Switch to Horizontal view" : "Switch to Vertical (Mobile) view"}
              >
                {isVertical ? <Monitor size={13} /> : <Smartphone size={13} />}
                <span>{isVertical ? 'Horizontal' : 'Vertical'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setNameDisplay(d => (d === 'first' ? 'last' : 'first'))}
              className="btn btn-secondary btn-sm touch-target"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Toggle between showing player first or last name on the pitch"
            >
              <User size={13} />
              <span>{nameDisplay === 'first' ? 'First Name' : 'Last Name'}</span>
            </button>

            {showFormationControls && isFreeFormMode && (
              <button
                onClick={handleResetToPreset}
                className="btn btn-secondary btn-sm touch-target"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                title="Reset player positions back to formation standard"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {onSaveFormation && (
            <button
              onClick={handleSave}
              className="btn btn-primary btn-sm touch-target"
              style={{
                padding: '0.35rem 0.85rem',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: saveSuccess ? '#10B981' : primaryColor,
              }}
            >
              {saveSuccess ? <Check size={14} /> : <Save size={14} />}
              <span>{saveSuccess ? 'Saved!' : saveLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* THE FOOTBALL PITCH CANVAS */}
      <div
        ref={pitchRef}
        className={`tactical-pitch ${isVertical ? 'tactical-pitch-vertical' : ''} ${pickMode ? 'is-picking' : ''}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Real-time drag feedback: overlaid on the pitch so it never shifts the pitch mid-drag */}
        {dragCoordinateFeedback && (
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
            maxWidth: 'calc(100% - 16px)',
            zIndex: 40,
            pointerEvents: 'none',
            padding: '0.35rem 0.7rem',
            borderRadius: '8px',
            background: 'rgba(12, 16, 22, 0.92)',
            border: '1px solid #F59E0B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.74rem',
            color: '#F59E0B',
            fontWeight: 700,
          }}>
            <Crosshair size={13} style={{ flexShrink: 0 }} />
            <span>{dragCoordinateFeedback.zone}</span>
          </div>
        )}

        {/* Pitch surface: background, markings, and goal/corner overhangs are clipped to the
            rounded pitch edge here, kept separate from the player nodes below so an edge-of-pitch
            player's circle/name-label is never cropped by that clipping (a mobile-width bug). */}
        <div className="tactical-pitch-surface">
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
            <span>{isVertical ? 'Attack ↑' : 'Attacking Direction →'}</span>
          </div>
        </div>

        {/* 5. Interactive Draggable Player Nodes (outside the clipped surface, so edge positions never get cropped) */}
        {positions.map(pos => {
          const empty = isEmptySlot(pos);
          const badges = getPlayerMatchBadges(empty ? '' : pos.name);
          const isDragging = draggingPlayerId === pos.id;
          const isSelected = selectedPlayerId === pos.id;
          const isDropTarget = (hoveredDropTargetId === pos.id || externalDropTargetId === pos.id) && !isDragging;
          const photoUrl = empty ? undefined : players.find(p => p.id === pos.member_id)?.photo_url;

          return (
            <div
              key={pos.id}
              data-posid={pos.id}
              className={`pitch-player-node ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''} ${empty ? 'is-empty' : ''}`}
              style={{
                left: isVertical ? `${pos.y}%` : `${pos.x}%`,
                top: isVertical ? `${100 - pos.x}%` : `${pos.y}%`,
                cursor: isEditable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
              }}
              onPointerDown={e => handlePointerDown(e, pos.id)}
              onDragStart={e => e.preventDefault()}
              onKeyDown={e => handleKeyDown(e, pos.id)}
              tabIndex={0}
              role="button"
              aria-label={empty
                ? `Empty ${pos.position} slot`
                : `${pos.name}, number ${pos.number}, ${pos.position}. Use arrow keys to reposition.`}
            >
              {/* Drop Target Swap Indicator Badge */}
              {isDropTarget && (
                <div style={{
                  position: 'absolute',
                  top: '-24px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#10B981',
                  color: '#070A0F',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  whiteSpace: 'nowrap',
                  zIndex: 25,
                  pointerEvents: 'none',
                  animation: 'pulse 1s infinite',
                }}>
                  <ArrowLeftRight size={10} />
                  <span>{empty ? 'IN' : 'SWAP'}</span>
                </div>
              )}

              {/* Jersey Node Pin */}
              <div
                className="player-node-circle"
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: empty
                    ? 'rgba(255, 255, 255, 0.08)'
                    : photoUrl
                    ? '#0B0F14'
                    : pos.position === 'GK'
                    ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                    : `linear-gradient(135deg, ${primaryColor} 0%, rgba(0,0,0,0.3) 100%), ${primaryColor}`,
                  border: isDropTarget
                    ? '2.5px solid #10B981'
                    : isSelected
                    ? '2.5px solid #FFFFFF'
                    : empty
                    ? '2px dashed rgba(255, 255, 255, 0.65)'
                    : '2px solid rgba(255, 255, 255, 0.85)',
                  boxShadow: isDropTarget
                    ? '0 0 25px #10B981, 0 0 10px #10B981'
                    : isDragging
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
                {empty ? (
                  '+'
                ) : photoUrl ? (
                  <>
                    <img loading="lazy" decoding="async"
                      src={photoUrl}
                      alt={`${pos.name} photo`}
                      draggable={false}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span style={{
                      position: 'absolute',
                      bottom: '-3px',
                      right: '-3px',
                      background: pos.position === 'GK' ? '#F59E0B' : primaryColor,
                      color: '#FFFFFF',
                      fontSize: '0.55rem',
                      fontWeight: 900,
                      minWidth: '14px',
                      height: '14px',
                      padding: '0 2px',
                      borderRadius: '7px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid rgba(0,0,0,0.6)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    }}>
                      {pos.number}
                    </span>
                  </>
                ) : (
                  pos.number
                )}

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
                <span style={{ maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', color: empty ? 'var(--text-muted)' : undefined }}>
                  {empty ? 'Empty' : nameDisplay === 'first' ? pos.name.split(' ')[0] : pos.name.split(' ').pop()}
                </span>
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
              ? onSendToBench
                ? 'Drag a player to reposition, onto a teammate to swap, or off onto the bench. Tap a player for more options.'
                : 'Drag a player to reposition or onto a teammate to swap. Focus + Arrow keys to nudge.'
              : 'Interactive Matchday Tactical Board.'}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)' }}>
          Active: <span style={{ color: primaryColor, fontWeight: 700 }}>{selectedFormationKey}</span>
        </div>
      </div>

      {/* Selected Player Detail & Tactical Role Card (editors only; not shown on read-only public views) */}
      {activePlayer && isEditable && (
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
            <PlayerAvatar
              photoUrl={players.find(p => p.id === activePlayer.member_id)?.photo_url}
              name={activePlayer.name}
              size={46}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {isEmptySlot(activePlayer) ? `Empty ${activePlayer.position} slot` : `#${activePlayer.number} ${activePlayer.name}`}
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
                <span>{isEmptySlot(activePlayer) ? 'Fill from Bench' : 'Swap with Bench'}</span>
              </button>
            )}

            {onSendToBench && !isEmptySlot(activePlayer) && (
              <button
                type="button"
                onClick={() => {
                  onSendToBench(activePlayer.id, null);
                  setSelectedPlayerId(null);
                }}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderColor: '#EF4444', color: '#F87171' }}
              >
                Move to Bench
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
