import React from 'react';
import Link from 'next/link';
import CoverImage from '@/components/CoverImage';
import LocalTime from '@/components/LocalTime';
import ShareLinkButton from '@/components/ShareLinkButton';
import { plainText, type MatchArticle } from '@/lib/match-report';

/** A sentence from the report with its [text](href) links turned into real ones */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        return m ? <Link key={i} href={m[2]}>{m[1]}</Link> : <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export interface MatchFact { label: string; value: React.ReactNode }

/** The full-time report under the scoreboard, laid out like the club's news articles */
export default function MatchReport({ article, clubName, coverUrl, crestUrl, tags, publishedAt, shareUrl, facts, source, moreHref, label = 'Match report', factsTitle = 'Match facts', note, bare }: {
  article: Pick<MatchArticle, 'headline' | 'lead' | 'paragraphs'>;
  clubName: string;
  coverUrl?: string;
  crestUrl?: string;
  tags: string[];
  publishedAt?: string;
  shareUrl: string;
  facts: MatchFact[];
  source: string;
  /** Where the timeline, line-ups and stats sit on the page */
  moreHref?: string;
  label?: string;
  factsTitle?: string;
  /** The club's own words, printed as typed after the story */
  note?: string;
  /** Set inside a page that already shows the cover and the facts (the event page): text only, no panel */
  bare?: boolean;
}) {
  return (
    <article aria-label={label} className={bare ? 'match-article match-article-bare' : 'glass-panel match-article'}>
      {/* The match flyer, else the club banner. No picture, no cover: an empty club-colour block above the story says nothing */}
      {!bare && coverUrl && (
        <CoverImage loading="eager" src={coverUrl} alt={plainText(article.headline)} crestUrl={crestUrl} style={{ width: '100%', aspectRatio: '16 / 9', maxHeight: 380, objectFit: 'cover' }} />
      )}
      <div className="match-article-in">
        {!bare && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {tags.map(tag => <span key={tag} className="badge badge-primary">{tag}</span>)}
          </div>
        )}
        <h2>{article.headline}</h2>
        <div className="match-article-byline">
          <p className="text-meta" style={{ margin: 0 }}>{bare && tags.length > 1 ? `${tags.slice(1).join(", ")}. ` : ""}By {clubName}{publishedAt && <>{bare ? ", " : " · "}<LocalTime value={publishedAt} /></>}</p>
          <ShareLinkButton url={shareUrl} title={article.headline} text={plainText(article.lead)} />
        </div>
        <p className="match-article-lead"><Linked text={article.lead} /></p>
        {article.paragraphs.map((p, i) => <p key={i} className="match-article-p"><Linked text={p} /></p>)}
        {note && <p className="match-article-p match-article-note">{note}</p>}
        {!bare && facts.length > 0 && (
          <div className="match-article-facts">
            <h3>{factsTitle}</h3>
            <dl>
              {facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
            </dl>
          </div>
        )}
        {moreHref && <p className="match-article-more"><a href={moreHref}>See the timeline, line-ups and match stats</a></p>}
        <p className="text-meta" style={{ margin: '0.85rem 0 0' }}>{source}</p>
      </div>
    </article>
  );
}
