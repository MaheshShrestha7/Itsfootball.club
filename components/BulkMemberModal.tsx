'use client';

import React, { useState, useRef } from 'react';
import { secureToken } from '@/lib/ids';
import { Club, ClubMember, PlayerPosition, PlayerStatus, ClubRole, MembershipStatus } from '@/lib/supabase/types';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Shield,
  HelpCircle
} from 'lucide-react';

interface BulkMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: Club;
  allMembers: ClubMember[];
  onImportMembers: (
    members: Partial<Omit<ClubMember, 'id' | 'created_at'>>[],
    options?: { updateDuplicates?: boolean }
  ) => { added: number; updated: number };
  onSuccessToast?: (msg: string) => void;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  memberData?: Partial<Omit<ClubMember, 'id' | 'created_at'>>;
}

// Fields with a sensible default only get that default on a brand-new member. On an update
// (matched by email) a column left blank in the source data must not reset what's already saved,
// so the field is left undefined and dropped by pruneUndefined() instead.
function withDefault<T>(raw: T | undefined | null | '', isDuplicate: boolean, fallback: T): T | undefined {
  if (raw !== undefined && raw !== null && raw !== ('' as any)) return raw as T;
  return isDuplicate ? undefined : fallback;
}

// Object spread copies a key even when its value is undefined, which would still blank out an
// existing field during a duplicate merge. Strip those keys so only real values survive.
function pruneUndefined<T extends Record<string, any>>(obj: T): T {
  const out = {} as T;
  (Object.keys(obj) as (keyof T)[]).forEach(k => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// Sanitizes CSV cell output against CSV formula injection attacks (=, +, -, @)
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Full CSV parser: tokenizes the whole text (not line-by-line) so a quoted cell
// containing an embedded newline (e.g. a multi-line pasted address) stays one field
// instead of splitting into two malformed rows.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
      i++;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      field = '';
      rows.push(row);
      row = [];
      i++;
    } else {
      field += char;
      i++;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  // Drop blank trailing/interior lines produced by the tokenizer
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

// Parses a raw cell into a number, flagging non-numeric values instead of
// silently discarding them (an empty cell stays optional and produces no error).
function parseOptionalNumber(raw: string | undefined, label: string, errors: string[]): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const num = Number(raw.trim());
  if (Number.isNaN(num)) {
    errors.push(`${label} "${raw.trim()}" is not a valid number.`);
    return undefined;
  }
  return num;
}

// Normalize position values
function normalizePosition(val: string): PlayerPosition {
  const upper = val.trim().toUpperCase();
  const valid: PlayerPosition[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'SUB'];
  if (valid.includes(upper as PlayerPosition)) {
    return upper as PlayerPosition;
  }
  return 'SUB';
}

// Normalize player status
function normalizeStatus(val: string): PlayerStatus {
  const lower = val.trim().toLowerCase();
  if (lower === 'injured') return 'injured';
  if (lower === 'suspended') return 'suspended';
  if (lower === 'alumni') return 'alumni';
  if (lower === 'inactive') return 'inactive';
  return 'active';
}

// Normalize club role
function normalizeRole(val: string): ClubRole {
  const lower = val.trim().toLowerCase();
  if (lower.includes('exec') || lower.includes('committee') || lower.includes('board')) return 'Executive Committee';
  if (lower.includes('manager') || lower.includes('coach')) return 'Manager';
  if (lower.includes('admin') || lower.includes('owner')) return 'admin';
  return 'Player';
}

export default function BulkMemberModal({
  isOpen,
  onClose,
  club,
  allMembers,
  onImportMembers,
  onSuccessToast
}: BulkMemberModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportStatusFilter, setExportStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [exportRoleFilter, setExportRoleFilter] = useState<'all' | 'player' | 'executive' | 'manager'>('all');

  // Import State
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'update' | 'skip'>('update');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Filter members for export
  const clubMembers = allMembers.filter(m => m.club_id === club.id);
  const filteredExportMembers = clubMembers.filter(m => {
    if (exportStatusFilter === 'approved') {
      if (m.membership_status && m.membership_status !== 'approved') return false;
    } else if (exportStatusFilter === 'pending') {
      if (m.membership_status !== 'pending') return false;
    } else if (exportStatusFilter === 'rejected') {
      if (m.membership_status !== 'rejected') return false;
    }

    if (exportRoleFilter === 'player' && m.role !== 'Player') return false;
    if (exportRoleFilter === 'executive' && !m.is_executive && m.role !== 'Executive Committee') return false;
    if (exportRoleFilter === 'manager' && m.role !== 'Manager') return false;

    return true;
  });

  // Handle Export Download
  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];

    if (exportFormat === 'json') {
      const dataStr = JSON.stringify(filteredExportMembers, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${club.slug}-members-${exportStatusFilter}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccessToast?.(`Exported ${filteredExportMembers.length} members as JSON.`);
      return;
    }

    // CSV Format
    const headers = [
      'Full Name',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Role',
      'Position',
      'Jersey Number',
      'Membership Status',
      'Membership Tier',
      'Player Status',
      'Date of Birth',
      'Nationality',
      'Preferred Foot',
      'Height (cm)',
      'Weight (kg)',
      'Emergency Contact',
      'Executive Title',
      'Executive Order',
      'Application Notes'
    ];

    const rows = filteredExportMembers.map(m => [
      sanitizeCsvCell(m.full_name),
      sanitizeCsvCell(m.first_name || ''),
      sanitizeCsvCell(m.last_name || ''),
      sanitizeCsvCell(m.email),
      sanitizeCsvCell(m.phone || ''),
      sanitizeCsvCell(m.role || 'Player'),
      sanitizeCsvCell(m.player_position || 'ST'),
      sanitizeCsvCell(m.jersey_number || ''),
      sanitizeCsvCell(m.membership_status || 'approved'),
      sanitizeCsvCell(m.membership_tier || 'Full Senior Member'),
      sanitizeCsvCell(m.status || 'active'),
      sanitizeCsvCell(m.date_of_birth || ''),
      sanitizeCsvCell(m.nationality || ''),
      sanitizeCsvCell(m.preferred_foot || 'Right'),
      sanitizeCsvCell(m.height_cm || ''),
      sanitizeCsvCell(m.weight_kg || ''),
      sanitizeCsvCell(m.emergency_contact || ''),
      sanitizeCsvCell(m.executive_title || ''),
      sanitizeCsvCell(m.executive_order || ''),
      sanitizeCsvCell(m.application_notes || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club.slug}-members-${exportStatusFilter}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onSuccessToast?.(`Exported ${filteredExportMembers.length} members as CSV.`);
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const sampleHeaders = [
      'Full Name',
      'Email',
      'Phone',
      'Role',
      'Position',
      'Jersey Number',
      'Membership Status',
      'Membership Tier',
      'Date of Birth',
      'Nationality',
      'Preferred Foot',
      'Emergency Contact'
    ];

    const sampleRows = [
      ['Marcus Vance', 'marcus.vance@example.com', '+61 400 123 456', 'Player', 'ST', '9', 'approved', 'Full Senior Member', '1998-05-14', 'Australia', 'Right', 'Sarah Vance (+61 400 999 888)'],
      ['Elena Rossi', 'elena.rossi@example.com', '+61 411 234 567', 'Player', 'CM', '8', 'approved', 'Full Senior Member', '2001-08-22', 'Italy', 'Both', 'Marco Rossi (+61 411 777 666)'],
      ['David Chen', 'david.chen@example.com', '+61 422 345 678', 'Executive Committee', 'SUB', '', 'approved', 'Executive Committee Pass', '1985-11-30', 'Australia', 'Right', 'Linda Chen (+61 422 555 444)'],
      ['Liam Gallagher', 'liam.g@example.com', '+61 433 456 789', 'Player', 'GK', '1', 'pending', 'Full Senior Member', '2003-02-17', 'Scotland', 'Left', 'Paul Gallagher (+61 433 111 222)']
    ];

    const csvContent = [
      sampleHeaders.join(','),
      ...sampleRows.map(r => r.map(cell => sanitizeCsvCell(cell)).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itsfootball_members_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Parse Raw Content (CSV or JSON string)
  const processRawData = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setParsedRows([]);
      return;
    }

    const existingEmails = new Set(
      clubMembers.map(m => m.email.trim().toLowerCase())
    );

    // 1. Try parsing JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        const list = Array.isArray(json) ? json : [json];
        const rows: ParsedRow[] = list.map((item: any, idx) => {
          const errors: string[] = [];
          const email = String(item.email || '').trim().toLowerCase();
          const fullName = String(item.full_name || item.name || `${item.first_name || ''} ${item.last_name || ''}`).trim();

          if (!fullName) errors.push('Full Name is required.');
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email address is required.');

          const isDuplicate = existingEmails.has(email);
          const isValid = errors.length === 0;

          const memberData: Partial<Omit<ClubMember, 'id' | 'created_at'>> = pruneUndefined({
            club_id: club.id,
            full_name: fullName,
            first_name: item.first_name || fullName.split(' ')[0] || '',
            last_name: item.last_name || fullName.split(' ').slice(1).join(' ') || '',
            email: email,
            phone: item.phone ? String(item.phone) : undefined,
            role: item.role ? normalizeRole(item.role) : (isDuplicate ? undefined : 'Player'),
            roles: Array.isArray(item.roles)
              ? item.roles
              : item.role
              ? [normalizeRole(item.role)]
              : (isDuplicate ? undefined : ['Player']),
            player_position: (item.player_position || item.position)
              ? normalizePosition(item.player_position || item.position)
              : (isDuplicate ? undefined : 'SUB'),
            jersey_number: item.jersey_number ? Number(item.jersey_number) : undefined,
            photo_url: item.photo_url || undefined,
            date_of_birth: item.date_of_birth ? String(item.date_of_birth) : undefined,
            nationality: withDefault(item.nationality ? String(item.nationality) : undefined, isDuplicate, 'Australia'),
            preferred_foot: item.preferred_foot === 'Left' || item.preferred_foot === 'Both' || item.preferred_foot === 'Right'
              ? item.preferred_foot
              : (isDuplicate ? undefined : 'Right'),
            height_cm: item.height_cm ? Number(item.height_cm) : undefined,
            weight_kg: item.weight_kg ? Number(item.weight_kg) : undefined,
            status: item.status ? normalizeStatus(item.status) : (isDuplicate ? undefined : 'active'),
            membership_status: withDefault(item.membership_status as MembershipStatus | undefined, isDuplicate, 'approved' as MembershipStatus),
            membership_tier: withDefault(item.membership_tier, isDuplicate, 'Full Senior Member'),
            membership_expires_at: withDefault(
              item.membership_expires_at,
              isDuplicate,
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            ),
            qr_code_token: withDefault(item.qr_code_token, isDuplicate, secureToken('pass')),
            is_executive:
              item.is_executive !== undefined
                ? Boolean(item.is_executive)
                : item.role
                ? item.role === 'Executive Committee'
                : (isDuplicate ? undefined : false),
            executive_title: item.executive_title || undefined,
            emergency_contact: item.emergency_contact || undefined,
            application_notes: item.application_notes || undefined,
          });

          return {
            index: idx + 1,
            raw: item,
            isValid,
            errors,
            isDuplicate,
            memberData: isValid ? memberData : undefined,
          };
        });

        setParsedRows(rows);
        return;
      } catch (err) {
        // Fall through to CSV parsing if JSON fails
      }
    }

    // 2. Parse CSV
    const csvRows = parseCsvRows(trimmed);
    if (csvRows.length < 2) {
      setParsedRows([]);
      return;
    }

    const rawHeaders = csvRows[0];
    const cleanHeaders = rawHeaders.map(h =>
      h.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    const rows: ParsedRow[] = [];

    for (let i = 1; i < csvRows.length; i++) {
      const cells = csvRows[i];
      const rawObj: Record<string, string> = {};

      cleanHeaders.forEach((header, idx) => {
        rawObj[header] = cells[idx] || '';
      });

      const errors: string[] = [];
      const fullName = (
        rawObj['fullname'] ||
        rawObj['name'] ||
        `${rawObj['firstname'] || ''} ${rawObj['lastname'] || ''}`.trim()
      );
      const email = (rawObj['email'] || rawObj['emailaddress'] || '').trim().toLowerCase();

      if (!fullName) errors.push('Full name is required.');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email address is required.');

      const isDuplicate = existingEmails.has(email);
      const roleCol = rawObj['role'];
      const positionCol = rawObj['position'] || rawObj['playerposition'];
      const statusCol = rawObj['status'] || rawObj['playerstatus'];
      const preferredFootCol = rawObj['preferredfoot'];

      const memberData: Partial<Omit<ClubMember, 'id' | 'created_at'>> = pruneUndefined({
        club_id: club.id,
        full_name: fullName,
        first_name: rawObj['firstname'] || fullName.split(' ')[0] || '',
        last_name: rawObj['lastname'] || fullName.split(' ').slice(1).join(' ') || '',
        email: email,
        phone: rawObj['phone'] || rawObj['phonenumber'] || rawObj['mobile'] || undefined,
        role: roleCol ? normalizeRole(roleCol) : (isDuplicate ? undefined : 'Player'),
        roles: roleCol ? [normalizeRole(roleCol)] : (isDuplicate ? undefined : ['Player']),
        player_position: positionCol ? normalizePosition(positionCol) : (isDuplicate ? undefined : 'SUB'),
        jersey_number: parseOptionalNumber(rawObj['jerseynumber'] || rawObj['number'], 'Jersey number', errors),
        photo_url: rawObj['photourl'] || undefined,
        date_of_birth: rawObj['dateofbirth'] || rawObj['dob'] || undefined,
        nationality: withDefault(rawObj['nationality'], isDuplicate, 'Australia'),
        preferred_foot: preferredFootCol
          ? (preferredFootCol === 'Left' ? 'Left' : preferredFootCol === 'Both' ? 'Both' : 'Right')
          : (isDuplicate ? undefined : 'Right'),
        height_cm: parseOptionalNumber(rawObj['heightcm'] || rawObj['height'], 'Height', errors),
        weight_kg: parseOptionalNumber(rawObj['weightkg'] || rawObj['weight'], 'Weight', errors),
        status: statusCol ? normalizeStatus(statusCol) : (isDuplicate ? undefined : 'active'),
        membership_status: withDefault(rawObj['membershipstatus'] as MembershipStatus | undefined, isDuplicate, 'approved' as MembershipStatus),
        membership_tier: withDefault(rawObj['membershiptier'] || rawObj['tier'], isDuplicate, 'Full Senior Member'),
        membership_expires_at: isDuplicate ? undefined : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        qr_code_token: isDuplicate ? undefined : secureToken('pass'),
        is_executive: (roleCol || rawObj['isexecutive'])
          ? (roleCol || '').toLowerCase().includes('exec') || Boolean(rawObj['isexecutive'])
          : (isDuplicate ? undefined : false),
        executive_title: rawObj['executivetitle'] || undefined,
        emergency_contact: rawObj['emergencycontact'] || undefined,
        application_notes: rawObj['applicationnotes'] || rawObj['notes'] || undefined,
      });

      // Computed after memberData so numeric-field validation (jersey/height/weight)
      // pushed into `errors` during construction is reflected in isValid.
      const isValid = errors.length === 0;

      rows.push({
        index: i,
        raw: rawObj,
        isValid,
        errors,
        isDuplicate,
        memberData: isValid ? memberData : undefined,
      });
    }

    setParsedRows(rows);
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      processRawData(content);
    };
    reader.readAsText(file);
  };

  // Perform Commit
  const handleCommitImport = () => {
    const validMembersToImport = parsedRows
      .filter(r => r.isValid && r.memberData)
      .map(r => r.memberData!);

    if (validMembersToImport.length === 0) return;

    setImporting(true);
    try {
      const res = onImportMembers(validMembersToImport, {
        updateDuplicates: duplicatePolicy === 'update',
      });

      onSuccessToast?.(
        `✓ Bulk Import Successful: ${res.added} members added, ${res.updated} updated.`
      );
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '840px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface-elevated, #0B1120)',
        border: '1px solid var(--border-medium, rgba(255,255,255,0.12))',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem' }}>
                <Shield size={12} /> ROSTER GOVERNANCE
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {club.name}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
              Bulk Import &amp; Export Members
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.4rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 2rem',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: activeTab === 'export' ? '1px solid #10B981' : '1px solid transparent',
              background: activeTab === 'export' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: activeTab === 'export' ? '#10B981' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Download size={16} />
            <span>Export Roster ({clubMembers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: activeTab === 'import' ? '1px solid #3B82F6' : '1px solid transparent',
              background: activeTab === 'import' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'import' ? '#60A5FA' : 'var(--text-secondary)',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Upload size={16} />
            <span>Bulk Import Members</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.75rem 2rem', overflowY: 'auto', flex: 1 }}>
          {/* ======================================================== */}
          {/* TAB 1: EXPORT MEMBERS                                     */}
          {/* ======================================================== */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                padding: '1.25rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
              }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                  Filter Member Export Dataset
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Choose which members to export. The resulting file includes membership status, role, player positions, contact information, and registration metadata.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
                  <div className="form-group">
                    <label htmlFor="bulkmembermodal-membership-status" className="form-label">Membership Status</label>
                    <select id="bulkmembermodal-membership-status"
                      className="form-select"
                      value={exportStatusFilter}
                      onChange={e => setExportStatusFilter(e.target.value as any)}
                    >
                      <option value="all">All Members ({clubMembers.length})</option>
                      <option value="approved">Approved &amp; Active ({clubMembers.filter(m => !m.membership_status || m.membership_status === 'approved').length})</option>
                      <option value="pending">Pending Review ({clubMembers.filter(m => m.membership_status === 'pending').length})</option>
                      <option value="rejected">Rejected ({clubMembers.filter(m => m.membership_status === 'rejected').length})</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="bulkmembermodal-role-filter" className="form-label">Role Filter</label>
                    <select id="bulkmembermodal-role-filter"
                      className="form-select"
                      value={exportRoleFilter}
                      onChange={e => setExportRoleFilter(e.target.value as any)}
                    >
                      <option value="all">All Roles</option>
                      <option value="player">Players Only</option>
                      <option value="executive">Executive Committee Only</option>
                      <option value="manager">Coaching Staff &amp; Managers</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="form-label">Select File Format</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div
                    onClick={() => setExportFormat('csv')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      border: exportFormat === 'csv' ? '2px solid #10B981' : '1px solid var(--border-subtle)',
                      background: exportFormat === 'csv' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <FileSpreadsheet size={32} color="#10B981" />
                    <div>
                      <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>
                        CSV Spreadsheet (.csv)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Optimized for Excel, Google Sheets, Apple Numbers
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setExportFormat('json')}
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      border: exportFormat === 'json' ? '2px solid #3B82F6' : '1px solid var(--border-subtle)',
                      background: exportFormat === 'json' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      transition: 'all 0.2s',
                    }}
                  >
                    <FileCode size={32} color="#60A5FA" />
                    <div>
                      <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.95rem' }}>
                        JSON Dataset (.json)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        System backup, developer API &amp; data migration
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Ready to export <strong style={{ color: '#FFFFFF' }}>{filteredExportMembers.length}</strong> matching members.
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={filteredExportMembers.length === 0}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem' }}
                >
                  <Download size={18} />
                  <span>Download {exportFormat.toUpperCase()}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: IMPORT MEMBERS                                     */}
          {/* ======================================================== */}
          {activeTab === 'import' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Template Download & Instructions */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileSpreadsheet size={22} color="#60A5FA" />
                  <div>
                    <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.9rem' }}>
                      Need the standard CSV format?
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Download our pre-formatted template with valid column headers and sample players.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                >
                  <Download size={14} />
                  <span>Download CSV Template</span>
                </button>
              </div>

              {/* Upload Method Switch */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setImportMethod('file')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: importMethod === 'file' ? '1px solid #3B82F6' : '1px solid var(--border-subtle)',
                    background: importMethod === 'file' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: importMethod === 'file' ? '#60A5FA' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Upload File (.csv / .json)
                </button>
                <button
                  type="button"
                  onClick={() => setImportMethod('paste')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: importMethod === 'paste' ? '1px solid #3B82F6' : '1px solid var(--border-subtle)',
                    background: importMethod === 'paste' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: importMethod === 'paste' ? '#60A5FA' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Paste CSV / JSON Text
                </button>
              </div>

              {/* Input Area */}
              {importMethod === 'file' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-medium, rgba(255,255,255,0.2))',
                    borderRadius: '14px',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.015)',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#3B82F6';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-medium, rgba(255,255,255,0.2))';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv, .json, text/csv, application/json"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Upload size={36} color="#3B82F6" style={{ margin: '0 auto 0.75rem auto' }} />
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem', marginBottom: '0.25rem' }}>
                    {fileName ? fileName : 'Click or Drag & Drop member file here'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Supports UTF-8 formatted .csv and .json roster records
                  </div>
                </div>
              ) : (
                <div>
                  <textarea aria-label="Paste CSV or JSON roster"
                    className="form-input"
                    rows={6}
                    placeholder="Paste CSV text with headers (e.g. Full Name, Email, Role, Position, Jersey Number)..."
                    value={pastedText}
                    onChange={e => {
                      setPastedText(e.target.value);
                      processRawData(e.target.value);
                    }}
                    style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                  />
                </div>
              )}

              {/* Duplicate Handling Policy */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HelpCircle size={15} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>Duplicate Resolution (matched by email):</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dup"
                      checked={duplicatePolicy === 'update'}
                      onChange={() => setDuplicatePolicy('update')}
                    />
                    <span>Update Existing</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dup"
                      checked={duplicatePolicy === 'skip'}
                      onChange={() => setDuplicatePolicy('skip')}
                    />
                    <span>Skip Duplicates</span>
                  </label>
                </div>
              </div>

              {/* Parsing Validation Summary & Preview Table */}
              {parsedRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Stats Bar */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Parsed: </span>
                      <strong style={{ color: '#FFFFFF' }}>{parsedRows.length}</strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <span style={{ fontSize: '0.75rem', color: '#10B981' }}>Valid Entries: </span>
                      <strong style={{ color: '#FFFFFF' }}>{validCount}</strong>
                    </div>
                    {duplicateCount > 0 && (
                      <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>Existing Matches: </span>
                        <strong style={{ color: '#FFFFFF' }}>{duplicateCount}</strong>
                      </div>
                    )}
                    {errorCount > 0 && (
                      <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Errors: </span>
                        <strong style={{ color: '#FFFFFF' }}>{errorCount}</strong>
                      </div>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.3)',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>Status</th>
                          <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>Full Name</th>
                          <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>Email</th>
                          <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>Role</th>
                          <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>Position</th>
                          <th style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>Jersey #</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map(row => (
                          <tr
                            key={`row-${row.index}`}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              background: !row.isValid
                                ? 'rgba(239, 68, 68, 0.05)'
                                : row.isDuplicate
                                ? 'rgba(245, 158, 11, 0.03)'
                                : 'transparent',
                            }}
                          >
                            <td style={{ padding: '0.55rem 0.8rem' }}>
                              {!row.isValid ? (
                                <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', fontSize: '0.7rem' }}>
                                  Invalid ({row.errors.join(', ')})
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', fontSize: '0.7rem' }}>
                                  {duplicatePolicy === 'update' ? 'Will Update' : 'Will Skip'}
                                </span>
                              ) : (
                                <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10B981', fontSize: '0.7rem' }}>
                                  Ready
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', color: '#FFFFFF', fontWeight: 600 }}>
                              {row.memberData?.full_name || row.raw['fullname'] || '—'}
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', color: 'var(--text-secondary)' }}>
                              {row.memberData?.email || row.raw['email'] || '—'}
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)' }}>
                              {row.memberData?.role || '—'}
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)' }}>
                              {row.memberData?.player_position || '—'}
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)' }}>
                              {row.memberData?.jersey_number ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Import Button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Ready to import <strong style={{ color: '#10B981' }}>{validCount}</strong> valid entries into {club.name}.
                    </div>
                    <button
                      type="button"
                      onClick={handleCommitImport}
                      disabled={validCount === 0 || importing}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem' }}
                    >
                      {importing ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span>Import {validCount} Members</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
