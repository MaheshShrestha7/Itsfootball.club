'use client';

import React, { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { useUrlTab } from '@/lib/use-url-tab';
import SquadWorkspace from '@/components/admin/SquadWorkspace';
import MembersWorkspace, { type MemberTab } from '@/components/admin/MembersWorkspace';
import PeopleDirectory from '@/components/admin/PeopleDirectory';
import { Users, Clock, UserCheck, XCircle } from 'lucide-react';

// Everyone (the squad) first; the other tabs are applications and passes (the Members area)
const PEOPLE_TABS = ['everyone', 'applications', 'passes', 'rejected'] as const;
type PeopleTab = typeof PEOPLE_TABS[number];
const MEMBER_TAB: Record<Exclude<PeopleTab, 'everyone'>, MemberTab> = { applications: 'pending', passes: 'active', rejected: 'rejected' };
const PEOPLE_TAB: Record<MemberTab, PeopleTab> = { pending: 'applications', active: 'passes', rejected: 'rejected' };

/** Sets query values in the URL without a reload (null removes one), as lib/use-url-tab does */
function setQuery(values: Record<string, string | null>) {
  const query = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(values)) {
    if (value === null) query.delete(key);
    else query.set(key, value);
  }
  const search = query.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}

/** Everyone at the club in one place: the directory, applications, member passes and rejected applications */
export default function PeoplePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members } = useClub();
  const { can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const searchParams = useSearchParams();
  const [urlTab, setTab] = useUrlTab(PEOPLE_TABS);

  const canSquad = can(club.id, 'squad');
  const canMembers = can(club.id, 'members');
  // Someone who only looks after applications starts there
  const tab: PeopleTab = urlTab === 'everyone' && !canSquad && canMembers ? 'applications' : urlTab;

  const clubMembers = members.filter(m => m.club_id === club.id);
  const pendingCount = clubMembers.filter(m => m.membership_status === 'pending').length;
  const peopleCount = clubMembers.filter(m => m.membership_status !== 'pending' && m.membership_status !== 'rejected').length;

  const openMemberTab = (next: PeopleTab, memberId?: string) => setQuery({ tab: next, member: memberId ?? null, person: null });

  const tabs: { id: PeopleTab; label: string; icon: typeof Users; count?: number; show: boolean }[] = [
    { id: 'everyone', label: 'Everyone', icon: Users, count: peopleCount, show: canSquad },
    { id: 'applications', label: 'Applications', icon: Clock, count: pendingCount, show: canMembers },
    { id: 'passes', label: 'Member Passes', icon: UserCheck, show: canMembers },
    { id: 'rejected', label: 'Rejected', icon: XCircle, show: canMembers },
  ];

  const tabBar = (
    <div role="tablist" aria-label="People" className="row row-wrap" style={{ gap: '0.4rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
      {tabs.filter(t => t.show).map(t => {
        const on = tab === t.id;
        const amber = t.id === 'applications' && !!t.count;
        return (
          <button key={t.id} type="button" role="tab" data-view-ok aria-selected={on}
            onClick={() => { setTab(t.id); setQuery({ member: null, person: null }); }}
            className="row"
            style={{
              gap: '0.4rem', minHeight: 40, padding: '0 0.95rem', borderRadius: 8, cursor: 'pointer', font: 'inherit', fontSize: '0.85rem', fontWeight: 800,
              border: on ? '1px solid var(--club-primary)' : '1px solid transparent',
              background: on ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
            <t.icon size={15} color={amber ? 'var(--c-amber)' : undefined} />
            <span>{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span style={{ borderRadius: 10, padding: '0.05rem 0.45rem', fontSize: '0.7rem', fontWeight: 900, background: amber ? '#F59E0B' : 'rgba(var(--tint-rgb), 0.1)', color: amber ? '#000' : 'var(--text-secondary)' }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      {tab !== 'everyone' && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 className="stat-value" style={{ margin: 0 }}>People</h1>
          <p className="text-body" style={{ margin: '0.25rem 0 0' }}>Applications to review, member passes and rejected applications.</p>
        </div>
      )}
      {tab === 'everyone' ? (
        <SquadWorkspace clubSlug={clubSlug}>
          {actions => (
            <PeopleDirectory
              clubSlug={clubSlug}
              actions={actions}
              initialPersonId={searchParams.get('person')}
              onPersonChange={id => setQuery({ person: id })}
              tabBar={tabBar}
              onReviewApplication={id => openMemberTab('applications', id)}
              onOpenPass={id => openMemberTab('passes', id)}
            />
          )}
        </SquadWorkspace>
      ) : (
        <>
          {tabBar}
          <MembersWorkspace clubSlug={clubSlug} tab={MEMBER_TAB[tab]} onTabChange={next => setTab(PEOPLE_TAB[next])} />
        </>
      )}
    </div>
  );
}
