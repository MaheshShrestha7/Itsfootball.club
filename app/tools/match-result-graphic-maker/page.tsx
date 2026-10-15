import Link from 'next/link';
import ResultGraphicTool from '@/components/ResultGraphicTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';

const PATH = '/tools/match-result-graphic-maker';
const TITLE = 'Free Football Result Graphic Maker | Soccer Full-Time Score & MOTM';
const DESCRIPTION = 'Make a full-time score graphic for your football or soccer club: badges, score, goalscorers and Player of the Match on your own photo. Download for Instagram stories, Facebook or WhatsApp. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const SIZES = [
  { name: 'Story 9:16', pixels: '1080 × 1920', use: 'Instagram and Facebook stories, WhatsApp status. Text stays clear of the app’s own bars at the top and bottom.' },
  { name: 'Post 4:5', pixels: '1080 × 1350', use: 'The Instagram feed, where 4:5 fills more of the screen than a square, plus Facebook groups and WhatsApp chats.' },
  { name: 'Square 1:1', pixels: '1080 × 1080', use: 'Facebook pages, X, club websites and anywhere that crops to a square.' },
];

const TIPS = [
  'Post at full time while the result is fresh: it takes about a minute once your teams are saved.',
  'Add both badges. A team without one gets a shield with its initials in its colour.',
  'Pick a photo with space at the top and a dark area behind the score, or turn up Darkness so the text reads.',
  'Junior teams: use first names or initials for scorers, and only post photos of players you have permission to share.',
  'Use the same size every week so your feed looks like one set.',
];

const QUESTIONS = [
  { q: 'What is the best free app to make football result graphics?', a: 'itsfootball.club’s result graphic maker is free with no account, no ads and no app to install. Add both badges, the final score, goalscorers and a Player of the Match, choose a photo and download a story, post or square image in about a minute.' },
  { q: 'How do I make a full-time score graphic for Instagram?', a: 'Type both team names and add their badges, set the score with the + and − buttons, add the goalscorers and minutes, choose Story 9:16 for stories or Post 4:5 for the feed, then press Download image (or Share on a phone to go straight to Instagram).' },
  { q: 'What size should a match result graphic be?', a: 'Use 1080 × 1920 (9:16) for Instagram and Facebook stories and WhatsApp status, 1080 × 1350 (4:5) for the Instagram feed, and 1080 × 1080 (1:1) for Facebook pages and websites. The tool makes all three.' },
  { q: 'Can I add a Player of the Match?', a: 'Yes. Type their name (and a photo if you like) and they appear as a row on the result graphic. Choose Player of the Match at the top for a card of their own with their photo, name and the score.' },
  { q: 'How do I show penalties and own goals?', a: 'Tap P beside a goal for a penalty, or OG for an own goal (type the name of the player who scored it, under the team that got the goal). Tick Decided on penalties to add the shootout score.' },
  { q: 'Is it a free Canva alternative for sports clubs?', a: 'For match results, yes: there is no template to edit and nothing to line up on a small screen. Fill in the score and it lays out the graphic for you, in your team colours.' },
  { q: 'Are my photos uploaded?', a: 'No. Badges and photos stay on your phone or computer and the image is drawn there. Your team names, colours and badges are remembered in your browser for next week.' },
  { q: 'Can I remove the watermark?', a: 'The free tool adds a small “Made at itsfootball.club” line. A free itsfootball.club club site makes the same graphics with your club’s own web address instead, straight from the live score.' },
  { q: 'Does it work for soccer, futsal and junior football?', a: 'Yes. It works for any football (soccer) match: senior, junior, women’s, futsal and small-sided games.' },
];

const STEPS = [
  { name: 'Add the teams', text: 'Type both team names, add their badges and pick each team’s colour. Mark which one is your team.' },
  { name: 'Enter the final score', text: 'Use the + and − buttons, and tick Decided on penalties for a shootout.' },
  { name: 'List the goalscorers', text: 'Add each goal with its minute, and mark penalties (P) and own goals (OG). This is optional.' },
  { name: 'Add a Player of the Match and a photo', text: 'Type their name, then choose a stock photo, your own photo or your team colour as the background.' },
  { name: 'Download or share', text: 'Pick Story, Post or Square and download the PNG, or share it straight to Instagram, Facebook or WhatsApp from your phone.' },
];

export default function MatchResultGraphicMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      badge="FREE TOOL · NO SIGN-UP"
      h1="Free match result & Player of the Match graphic maker"
      intro="Make a full-time score graphic for your football or soccer club in a minute: add both badges, the final score and goalscorers, pick a photo, and download a story (9:16), post (4:5) or square (1:1) image for Instagram, Facebook or WhatsApp. Free, with no login."
      description={DESCRIPTION}
      appName="Free Match Result Graphic Maker"
      alternateNames={['Football result graphic maker', 'Soccer score graphic maker', 'Full time score template', 'Man of the Match graphic maker', 'MOTM graphic maker']}
      features={[
        'Full time result and Player of the Match cards',
        'Story (9:16), post (4:5) and square (1:1) PNG',
        'Both team badges and colours',
        'Goalscorers with minutes, penalties and own goals',
        'Penalty shootout score',
        'Stock or uploaded background photo',
        'No sign-up, nothing uploaded',
      ]}
      tool={<ResultGraphicTool />}
      sections={[
        {
          id: 'sizes',
          heading: 'Image sizes',
          body: (
            <div className="lineup-formations">
              {SIZES.map(s => (
                <div key={s.name} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{s.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.15rem 0 0.5rem', fontFamily: 'var(--font-mono)' }}>{s.pixels} px</p>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{s.use}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'tips',
          heading: 'Tips for a better result graphic',
          body: (
            <ul style={{ ...bodyStyle, paddingLeft: '1.2rem' }}>
              {TIPS.map(t => <li key={t} style={{ marginBottom: '0.3rem' }}>{t}</li>)}
            </ul>
          ),
        },
        {
          id: 'motm',
          heading: 'Player of the Match graphics',
          body: (
            <p style={bodyStyle}>
              Choose Player of the Match at the top of the tool for a card of its own: their photo fills the top, with their
              name, a line about their game and the score underneath. There is a page just for it too: the{' '}
              <Link href="/tools/player-of-the-match-graphic-maker" style={linkStyle}>Player of the Match graphic maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a match result graphic"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
