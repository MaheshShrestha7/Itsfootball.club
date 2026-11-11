import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server-auth';
import { durableRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/send';
import { welcomePack } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/slugs';
import { isUuid } from '@/lib/ids';
import { factsFrom, isStepDone, packFor } from '@/lib/welcome-pack';
import type { AccessLevel } from '@/lib/permissions';

// Emails the signed-in admin their welcome pack: the setup steps their access lets them do, ticked
// where the club already has them (lib/welcome-pack.ts). Only ever to their own confirmed address.
//   POST { clubId | clubSlug, why?: 'new' | 'asked', ticked?: string[] }
// 'new' after an invite is accepted or a club is made; 'asked' from "Email me this guide".
// Reads run as the admin, so they only count what their roles can see.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let clubId = typeof body?.clubId === 'string' && isUuid(body.clubId) ? body.clubId : '';
  // The invite page knows the club by its slug
  if (!clubId && typeof body?.clubSlug === 'string' && /^[a-z0-9-]{1,80}$/.test(body.clubSlug)) {
    const { data } = await auth.supabase.from('clubs').select('id').eq('slug', body.clubSlug).maybeSingle();
    clubId = data?.id || '';
  }
  if (!clubId) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });
  const why = body?.why === 'new' ? 'new' : 'asked';
  const ticked = new Set<string>(Array.isArray(body?.ticked) ? body.ticked.filter((k: unknown) => typeof k === 'string').slice(0, 20) : []);

  // Anyone with admin access at the club (same check as requireClubPerm with no areas)
  const { data: allowed } = await auth.supabase.rpc('has_club_perm', { p_club_id: clubId, p_areas: null, p_level: 'view' });
  if (allowed !== true) return NextResponse.json({ error: 'Your role at this club does not allow this.' }, { status: 403 });
  const to = auth.confirmedEmail;
  if (!to) return NextResponse.json({ error: 'Confirm your email address first, then try again.' }, { status: 400 });

  // ponytail: per-isolate throttle, like /api/support
  if (!(await durableRateLimit(`welcome-pack:${auth.userId}:${clubId}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'We’ve sent this a few times already. Please check your inbox, or try again in an hour.' }, { status: 429 });
  }

  const db = auth.supabase;
  const [{ data: club }, { data: perms }, { data: userData }] = await Promise.all([
    db.from('clubs').select('name, slug, owner_id, logo_url').eq('id', clubId).maybeSingle(),
    db.rpc('my_club_permissions'),
    db.auth.getUser(auth.token),
  ]);
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });

  const mine = ((perms || []) as { club_id: string; is_admin: boolean; role_names: string[] | null; permissions: Record<string, AccessLevel> | null }[])
    .find(r => r.club_id === clubId);
  const isOwner = club.owner_id === auth.userId;
  const isSuper = isOwner || !!mine?.is_admin;
  const groups = packFor({ isSuper, areas: mine?.permissions || {} });
  const steps = groups.flatMap(g => g.steps);
  if (!steps.length) return NextResponse.json({ error: 'There are no setup steps for your role.' }, { status: 400 });
  const need = new Set(steps.map(s => s.key));

  const count = (r: { count: number | null }) => r.count ?? 0;
  const [seasons, teams, plans, payments, fixtures, members, roles] = await Promise.all([
    db.from('club_seasons').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
    db.from('club_teams').select('id').eq('club_id', clubId),
    need.has('plans') ? db.from('membership_plans').select('id', { count: 'exact', head: true }).eq('club_id', clubId) : null,
    need.has('stripe') ? db.from('club_payment_settings').select('stripe_charges_enabled').eq('club_id', clubId).maybeSingle() : null,
    db.from('matches').select('id', { count: 'exact', head: true }).eq('club_id', clubId),
    db.from('club_members').select('role, roles, applied_at').eq('club_id', clubId),
    need.has('helper') ? db.from('club_access_roles').select('name').eq('club_id', clubId).eq('is_super', false) : null,
  ]);
  const teamIds = ((teams.data || []) as { id: string }[]).map(t => t.id);
  const teamMembers = teamIds.length
    ? count(await db.from('club_team_members').select('id', { count: 'exact', head: true }).in('team_id', teamIds))
    : 0;

  const facts = factsFrom({
    logoUrl: club.logo_url,
    seasons: count(seasons),
    teams: teamIds.length,
    teamMembers,
    plans: plans ? count(plans) : 0,
    stripe: !!(payments?.data as { stripe_charges_enabled?: boolean } | null)?.stripe_charges_enabled,
    fixtures: count(fixtures),
    members: (members.data || []) as { role?: string | null; roles?: unknown; applied_at?: string | null }[],
    helperRoles: ((roles?.data || []) as { name: string }[]).map(r => r.name),
  });

  const fullName = String(userData.user?.user_metadata?.full_name || '').trim();
  const support = process.env.SUPPORT_EMAIL;
  const message = welcomePack({
    firstName: fullName.split(/\s+/)[0] || null,
    clubName: club.name,
    roleName: isOwner ? 'Owner' : isSuper ? 'Club Admin' : (mine?.role_names || []).join(', ') || 'club staff',
    why,
    steps: steps.map(s => ({
      title: s.title,
      where: s.key === 'share' ? `${SITE_URL.replace(/^https?:\/\//, '')}/${club.slug}` : s.where,
      done: isStepDone(s, facts, ticked),
    })),
    link: `${SITE_URL}/${club.slug}/admin/start`,
    canReply: !!support,
  });

  const sent = await sendEmail({ to, ...message, ...(support ? { replyTo: support } : {}) });
  if (!sent.ok) {
    console.error('[admin/welcome-pack] send failed:', sent.error);
    return NextResponse.json({ error: 'The email could not be sent. Please try again in a moment.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to });
}
