'use client';

import React, { use } from 'react';
import { Award } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import PlayerAvatar from '@/components/PlayerAvatar';
import ClubSubPage, { EmptyState, ListSkeleton } from '@/components/ClubSubPage';

/** The club's executive committee: who runs it, in the order the admin set on the Committee page */
export default function LeadershipPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members, isHydrated, getActiveSeason } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const season = getActiveSeason?.(club.id)?.name;

  const committee = members
    .filter(m => m.club_id === club.id && m.is_executive)
    .sort((a, b) => (a.executive_order || 99) - (b.executive_order || 99));

  return (
    <ClubSubPage
      club={club}
      title="Leadership"
      width={1080}
      icon={<Award size={30} color="var(--club-primary)" aria-hidden="true" />}
      intro={`The executive committee running ${club.name}${season ? ` for the ${season} season` : ''}.`}
    >
      {!isHydrated ? (
        <ListSkeleton rows={3} height={120} label="Loading the committee" />
      ) : committee.length === 0 ? (
        <EmptyState title="No committee listed yet">The club hasn&rsquo;t added its committee members yet.</EmptyState>
      ) : (
        <ul className="club-leaders">
          {committee.map(m => (
            <li key={m.id} className="glass-panel club-leader">
              <PlayerAvatar photoUrl={m.photo_url} name={m.full_name} size={88} style={{ marginBottom: '0.6rem' }} />
              <h2 className="club-leader-name">{m.full_name}</h2>
              {m.executive_title && <p className="club-leader-title">{m.executive_title}</p>}
              {m.executive_season && m.executive_season !== season && <p className="text-meta">{m.executive_season}</p>}
              {m.executive_bio && <p className="club-leader-bio">{m.executive_bio}</p>}
            </li>
          ))}
        </ul>
      )}
      <style jsx>{`
        .club-leaders {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
          gap: 1rem;
        }
        .club-leader {
          padding: 1.5rem 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.3rem;
          min-width: 0;
        }
        .club-leader-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          overflow-wrap: break-word;
          min-width: 0;
        }
        .club-leader-title {
          margin: 0;
          color: var(--club-ink);
          font-weight: 700;
          font-size: 0.85rem;
        }
        .club-leader-bio {
          margin: 0.4rem 0 0;
          color: var(--text-secondary);
          font-size: 0.875rem;
          line-height: 1.55;
        }
      `}</style>
    </ClubSubPage>
  );
}
