'use client';

import React, { useState, use } from 'react';
import LocalTime from '@/components/LocalTime';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import ContactModal from '@/components/ContactModal';
import { DATE_LOCALE, clubTimeZone } from '@/lib/dates';
import EventTickets from '@/components/EventTickets';
import SponsorTrackedLink from '@/components/SponsorTrackedLink';
import SponsorLogo from '@/components/SponsorLogo';
import { isSponsorOnSite, sortSponsorsByTier, sponsorLabel } from '@/lib/sponsors';
import { useAuth } from '@/lib/auth-context';
import { downloadEventIcs, directionsUrl } from '@/lib/match-ics';
import EventCountdown from '@/components/EventCountdown';
import FixtureRow from '@/components/FixtureRow';
import { groupAlbums } from '@/components/PhotoGallery';
import { useRouter } from 'next/navigation';
import { clubResult, soonestFirst } from '@/lib/fixtures';
import { clubTeamsOf, publicScoreHidden, teamLabel, teamOfMatch } from '@/lib/teams';
import MatchReport from '@/components/MatchReport';
import ShareLinkButton from '@/components/ShareLinkButton';
import CountUp from '@/components/CountUp';
import { cupWriteupsFor } from '@/lib/cup-writeup';
import { Shield, MapPin, Users, ArrowLeft, CalendarPlus, MessageCircle, Ticket } from 'lucide-react';
import { salesOpen } from '@/lib/tickets';

// How long an event with no end time is treated as running
const DEFAULT_LENGTH = 3 * 3600000;

export default function EventDetailsPage({
  params,
}: {
  params: Promise<{ clubSlug: string; eventId: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, events, sponsors, matches, matchEvents, clubTeams, gallery } = useClub();
  const router = useRouter();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const event = events.find(e => e.id === resolvedParams.eventId && e.club_id === club?.id);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const { hasClubAdminAccess } = useAuth();
  // Read once: whether the event is still ahead decides the countdown and calendar buttons
  const [now] = useState(() => Date.now());

  if (!club) return null;

  if (!event) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Shield size={48} style={{ opacity: 0.3, marginBottom: '1.25rem' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Event Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          This event does not exist or may have been removed from the calendar.
        </p>
        <Link href={`/${club.slug}/events`} className="btn btn-primary">
          See all events
        </Link>
      </div>
    );
  }

  // Sponsors scoped to this specific event - separate from the club's general
  // sponsor showcase, which only shows club-wide (non-event) sponsors.
  const eventSponsors = sortSponsorsByTier(sponsors.filter(s => s.event_id === event.id && isSponsorOnSite(s)));


  // The club's games in this event (an outside cup), soonest first, and how the played ones went
  const games = matches.filter(m => m.club_id === club.id && m.event_id === event.id).sort(soonestFirst);
  const teams = clubTeamsOf(clubTeams, club.id);
  const record = games
    .filter(m => m.status === 'completed' && !publicScoreHidden(m, clubTeams))
    .reduce((r, m) => {
      const outcome = clubResult(m).outcome;
      if (outcome) r[outcome]++;
      return r;
    }, { W: 0, D: 0, L: 0 });
  const played = record.W + record.D + record.L;
  // Photo albums linked to this event; each opens in the club gallery
  const eventPhotos = gallery.filter(g => g.club_id === club.id && g.event_id === event.id);
  const albums = groupAlbums(eventPhotos);
  // Once Completed: the write-up of the cup, one per team that played
  const writeups = cupWriteupsFor({ club, event, matches, matchEvents, clubTeams });
  const writeupCover = eventPhotos.find(g => g.media_type === 'image' && g.is_album_cover)?.media_url
    || eventPhotos.find(g => g.media_type === 'image')?.media_url || event.flyer_url || club.banner_url || undefined;
  const recordLine = played > 0
    ? `${played} played, ${[record.W && `won ${record.W}`, record.D && `drew ${record.D}`, record.L && `lost ${record.L}`].filter(Boolean).join(', ')}`
    : `${games.length} game${games.length === 1 ? '' : 's'}`;
  const rsvpPct = event.max_capacity > 0 ? Math.min(100, Math.round((event.rsvp_count / event.max_capacity) * 100)) : 0;
  const start = new Date(event.start_time).getTime();
  const end = event.end_time ? new Date(event.end_time).getTime() : start + DEFAULT_LENGTH;
  // Marked Completed by the committee: treated as over, even if its end time hasn't come
  const completed = !!event.completed_at;
  const over = end < now || completed;
  const place = event.location || club.stadium_name;
  // "0 / 150 checked in" days out reads as nobody coming: the count shows once people arrive (admins always)
  const showCheckins = event.max_capacity > 0 && (event.rsvp_count > 0 || hasClubAdminAccess(club.id));

  const cover = event.flyer_url;
  // Tickets on sale: the hero's first button jumps to them (EventTickets still says sold out or closed)
  const selling = (event.ticket_price_cents ?? 0) > 0 && salesOpen(event, now);
  // Every game on one day (a cup day): the list shows kick-off times instead of four identical dates
  const oneDay = games.length > 1 && new Set(games.map(m => m.match_date?.slice(0, 10))).size === 1;
  const goals = games
    .filter(m => m.status === 'completed' && !publicScoreHidden(m, clubTeams) && clubResult(m).outcome)
    .reduce((g, m) => { const r = clubResult(m); return { for: g.for + r.us, against: g.against + r.them }; }, { for: 0, against: 0 });
  const side = games.length > 0 || albums.length > 0 || eventSponsors.length > 0;
  const photosShown = eventPhotos.filter(g => g.media_type === 'image').slice(0, 3);

  return (
    <div className="evp">
      <div className="container evp-wrap">
        <Link href={`/${club.slug}/events`} className="evp-back">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>All events</span>
        </Link>

        <header className={`glass-panel evp-hero${cover ? ' has-flyer' : ''}`}>
          {cover && (
            <a href={cover} target="_blank" rel="noopener noreferrer" className="evp-flyer" aria-label={`Open the ${event.title} flyer full size`}>
              <img src={cover} alt={`${event.title} flyer`} decoding="async" />
            </a>
          )}
          <div className="evp-head">
            <p className="evp-kind">
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
            </p>
            <h1>{event.title}</h1>
            {event.description && <p className="evp-desc">{event.description}</p>}

            {!over && (
              /* Before the day: the date is what people come for, set big, with the countdown beside it */
              <div className="evp-when">
                <EventCountdown startTime={event.start_time} endTime={event.end_time} />
              </div>
            )}

            {over && (
              /* After the day: one block in the club's colour with the day, the venue and how it went */
              <div className="evp-when">
                <div className={`ecd-club ecd-result${played > 0 ? '' : ' is-plain'}`}>
                  <span className="ecd-status">{completed ? 'Finished' : 'Over'}</span>
                  <div className="ecd-club-day">
                    {club.logo_url && <img className="ecd-crest" src={club.logo_url} alt="" />}
                    <b><LocalTime value={event.start_time} format="ordinal" /></b>
                    {place && <span>{place}</span>}
                    {event.cup_winner?.trim() && <span>Cup winner: <strong>{event.cup_winner.trim()}</strong></span>}
                  </div>
                  {played > 0 && (
                    <div className="ecd-club-count" aria-label={`Our record: ${recordLine}`}>
                      <span className="ecd-club-label">Our record</span>
                      <div className="ecd-club-tiles is-four">
                        {([[record.W, 'won'], [record.D, 'drawn'], [record.L, 'lost']] as const).map(([n, u], i) => (
                          <div key={u} className={`ecd-club-tile is-${u}`} style={{ '--i': i } as React.CSSProperties} aria-hidden="true"><b><CountUp value={n} delay={250 + i * 120} /></b><span>{u}</span></div>
                        ))}
                        <div className="ecd-club-tile" style={{ '--i': 3 } as React.CSSProperties} aria-hidden="true"><b><span className="ecd-for"><CountUp value={goals.for} delay={610} /></span>-<span className="ecd-against"><CountUp value={goals.against} delay={610} /></span></b><span>goals</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!over && place && (
              <dl className="evp-facts">
                <div><dt>Where</dt><dd>{place}</dd></div>
              </dl>
            )}

            {showCheckins && (
              <p className="evp-checkins">
                <Users size={14} aria-hidden="true" /> {event.rsvp_count} of {event.max_capacity} checked in
                <span className="evp-bar" aria-hidden="true"><span style={{ transform: `scaleX(${rsvpPct / 100})` }} /></span>
              </p>
            )}

            <div className="matchday-actions">
              {selling && (
                <a href="#tickets-heading" className="btn btn-primary btn-sm">
                  <Ticket size={14} aria-hidden="true" /> Get tickets
                </a>
              )}
              {!over && (
                <button type="button" className={`btn ${selling ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={() => downloadEventIcs(club.name, club.slug, event)}>
                  <CalendarPlus size={14} aria-hidden="true" /> Add to calendar
                </button>
              )}
              {!over && place && (
                <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <MapPin size={14} aria-hidden="true" /> Directions
                </a>
              )}
              {over && writeups.length === 0 && <ShareLinkButton url={`/${club.slug}/events/${event.id}`} title={event.title} campaign={`event/${event.title}`} />}
              <button type="button" onClick={() => setContactModalOpen(true)} className="btn btn-secondary btn-sm">
                <MessageCircle size={14} aria-hidden="true" /> Ask about this event
              </button>
            </div>
          </div>
        </header>

        <div className={`evp-body${writeups.length > 0 && side ? ' has-side' : ''}`}>
          {writeups.length > 0 && (
            <div className="glass-panel evp-main">
              {writeups.map(({ key, team, writeup }) => (
                <MatchReport
                  key={key}
                  bare
                  label="Cup report"
                  article={writeup}
                  clubName={club.name}
                  coverUrl={writeupCover}
                  crestUrl={club.logo_url || undefined}
                  tags={['Cup Report', ...(team ? [team] : [])]}
                  publishedAt={event.completed_at || undefined}
                  shareUrl={`/${club.slug}/events/${event.id}`}
                  note={event.writeup_note?.trim() || undefined}
                  factsTitle="Cup facts"
                  facts={[]}
                  source={[`Written from the games ${club.name} logged at this event.`, event.cup_finish?.[key] && 'How the team finished comes from the club.', event.writeup_note?.trim() && 'The last paragraph is the club\'s own.'].filter(Boolean).join(' ')}
                />
              ))}
            </div>
          )}

          {side && (
            <aside className="evp-side">
              {games.length > 0 && (
                <section className="glass-panel evp-box evp-games-box" aria-labelledby="event-games">
                  <h2 id="event-games">Our games</h2>
                  <div className="evp-games">
                    {games.map(m => {
                      const t = teams.length > 1 ? teamOfMatch(m, clubTeams) : undefined;
                      return <FixtureRow key={m.id} flat timeTile={oneDay} match={m} clubSlug={club.slug} hideScore={publicScoreHidden(m, clubTeams)} teamLabel={t ? teamLabel(t) : undefined} />;
                    })}
                  </div>
                </section>
              )}

              <EventTickets event={event} onContact={() => setContactModalOpen(true)} />

              {albums.length > 0 && (
                <section className="glass-panel evp-box" aria-labelledby="event-photos">
                  <h2 id="event-photos">Photos</h2>
                  <div className="evp-thumbs">
                    {photosShown.map(ph => (
                      <button key={ph.id} type="button" className="evp-thumb" onClick={() => router.push(`/${club.slug}/gallery?album=${encodeURIComponent(ph.album_name)}`)} aria-label={`Open the ${ph.album_name} album`}>
                        <img src={ph.thumbnail_url || ph.media_url} alt="" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                  {albums.map(a => (
                    <Link key={a.name} className="evp-link" href={`/${club.slug}/gallery?album=${encodeURIComponent(a.name)}`}>
                      See all {a.photos.length} photo{a.photos.length === 1 ? '' : 's'} in {a.name}
                    </Link>
                  ))}
                </section>
              )}

              {eventSponsors.length > 0 && (
                <section className="glass-panel evp-box" aria-labelledby="event-sponsors">
                  <h2 id="event-sponsors">Supported by</h2>
                  <div className="evp-sponsors">
                    {eventSponsors.map(sponsor => {
                      const big = sponsor.tier === 'platinum' || sponsor.size_scale === 'xl';
                      return (
                        <SponsorTrackedLink
                          key={sponsor.id}
                          clubId={sponsor.club_id}
                          sponsorId={sponsor.id}
                          placement="event_page"
                          href={sponsor.website_url || '#'}
                          className={`evp-sponsor${big ? ' is-big' : ''}`}
                        >
                          <SponsorLogo src={sponsor.logo_url} name={sponsor.name} height={big ? 72 : 52} style={{ maxWidth: '100%' }} />
                          <span>
                            <b>{sponsor.name}</b>
                            <span className="text-meta">{sponsorLabel(sponsor)}</span>
                          </span>
                        </SponsorTrackedLink>
                      );
                    })}
                  </div>
                </section>
              )}
            </aside>
          )}
        </div>
      </div>

      <ContactModal
        club={club}
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        defaultType="General Inquiry"
        about={`${event.title}, ${new Date(event.start_time).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: clubTimeZone(club) })}`}
      />
    </div>
  );
}
