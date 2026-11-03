import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { toCsv } from '@/lib/finance';
import { zipFiles } from '@/lib/zip';

// Mission Control -> club console -> "Download everything" (and the first step of closing a club).
//   GET ?clubId=   a ZIP with one CSV per table that holds the club's data, plus README.txt
// Operators and Super admins (it holds members' personal details). Logged in admin_audit_log.

// Visit logs (huge, not the club's records) and Mission Control's own notes stay out
const SKIP = new Set(['club_analytics', 'sponsor_analytics', 'email_log', 'platform_club_notes']);
const PAGE = 1000;
const MAX_ROWS = 50000;

type Row = Record<string, unknown>;

function csvOf(rows: Row[]): string {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = (v: unknown) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as string | number));
  return toCsv([cols, ...rows.map(r => cols.map(c => cell(r[c])))]);
}

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Exports are not configured on the server.' }, { status: 503 });
  const clubId = req.nextUrl.searchParams.get('clubId') || '';
  if (!isUuid(clubId)) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });

  const [{ data: club }, { data: tables, error }] = await Promise.all([
    db.from('clubs').select('*').eq('id', clubId).maybeSingle(),
    auth.supabase.rpc('platform_club_tables'),
  ]);
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
  if (error) return NextResponse.json({ error: 'Could not list the tables. Has migration 20261148 been run?' }, { status: 500 });

  const files: { name: string; text: string }[] = [{ name: 'club.csv', text: csvOf([club as Row]) }];
  const summary: string[] = [];
  for (const table of ((tables || []) as string[]).filter(t => !SKIP.has(t))) {
    const rows: Row[] = [];
    let failed = '';
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error: e } = await db.from(table).select('*').eq('club_id', clubId).range(from, from + PAGE - 1);
      if (e) { failed = e.message; break; }
      rows.push(...((data || []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    if (failed) { summary.push(`${table}: not exported (${failed})`); continue; }
    if (!rows.length) continue;
    files.push({ name: `${table}.csv`, text: csvOf(rows) });
    summary.push(`${table}.csv: ${rows.length} rows${rows.length >= MAX_ROWS ? ` (first ${MAX_ROWS} only)` : ''}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  files.unshift({
    name: 'README.txt',
    text: [
      `${club.name} (itsfootball.club/${club.slug}): everything the club holds on itsfootball.club, exported ${today}.`,
      '',
      'One CSV file per kind of record. Open them in Excel, Numbers or Google Sheets.',
      'Values in braces or brackets are lists or settings, written as JSON.',
      'Photos and uploaded files are not included: their links are in the CSVs.',
      'Not included: website visit logs and the record of emails sent.',
      '',
      'club.csv: 1 row',
      ...summary,
      '',
    ].join('\r\n'),
  });

  await db.from('admin_audit_log').insert({
    club_id: clubId, actor_id: auth.userId, actor_email: auth.confirmedEmail || null,
    action: 'club_exported', target_table: 'clubs', target_id: clubId,
    summary: 'Downloaded all of the club\'s data (Mission Control)', details: { files: files.length },
  });

  const zip = zipFiles(files);
  return new Response(new Blob([zip as BlobPart], { type: 'application/zip' }), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${club.slug}-export-${today}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
