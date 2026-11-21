import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { durableRateLimit } from '@/lib/rate-limit';
import { telegramConfigured } from '@/lib/telegram';
import { refreshBoards } from '@/lib/chat-board';

// Rewrites the live scoreboards in scorers' chats after a change made in Match Centre (or any admin screen).
//   POST { clubId, matchId } -> { edited }
// Admins who may edit the match only. The board is rebuilt from the database, so the call carries no score.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId) || !isUuid(body?.matchId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const auth = await requireClubPerm(req, body.clubId, ['match-center', 'matches', 'tournaments'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db || !telegramConfigured()) return NextResponse.json({ edited: 0 });
  const { data: match } = await db.from('matches').select('id').eq('id', body.matchId).eq('club_id', body.clubId).maybeSingle();
  if (!match) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  // Several admin screens can report the same change; Telegram allows about one edit a second per chat
  if (!(await durableRateLimit(`chat-board:${body.matchId}`, 30, 60_000))) return NextResponse.json({ edited: 0, skipped: 'busy' });
  return NextResponse.json({ edited: await refreshBoards(db, body.matchId) });
}
