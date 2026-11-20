import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { EMAIL_KIND_GROUPS } from '@/lib/email/kinds';

// Mission Control -> Email log: every email the site sent (email_log), newest first.
//   GET ?clubId=&group=&q=&offset=
// Any platform admin can read it. email_log has no RLS policies, so it's read with the service role.

const PAGE = 50;

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'The database is not configured on the server.' }, { status: 503 });

  const p = req.nextUrl.searchParams;
  const clubId = p.get('clubId') || '';
  const group = EMAIL_KIND_GROUPS.find(g => g.id === p.get('group'));
  // Commas, brackets and wildcards would break or widen the PostgREST filter
  const q = (p.get('q') || '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 100);
  const offset = Math.max(0, Math.min(100000, Number(p.get('offset')) || 0));

  let query = db.from('email_log').select('key, club_id, recipient, kind, subject, sent_at')
    .order('sent_at', { ascending: false }).range(offset, offset + PAGE);
  if (clubId === 'none') query = query.is('club_id', null);
  else if (isUuid(clubId)) query = query.eq('club_id', clubId);
  if (group) query = query.in('kind', group.kinds);
  if (q) query = query.or(`recipient.ilike.%${q}%,subject.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: /email_log/.test(error.message) ? 'Run the email migration (20261014_email.sql) first.' : error.message }, { status: 500 });
  const rows = data || [];
  return NextResponse.json({ rows: rows.slice(0, PAGE), more: rows.length > PAGE });
}
