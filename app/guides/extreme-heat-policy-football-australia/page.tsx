import Link from 'next/link';
import GuidePage, { GuideJoin, GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/extreme-heat-policy-football-australia';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Extreme Heat Policy for Junior Football in Australia (and Lightning)',
  description: 'When junior soccer is cancelled for heat in Australia: the Sports Medicine Australia heat tool, Football West’s temperature cut-offs, drinks breaks, and the 30-second lightning rule.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'There’s no single national temperature at which junior football stops. Each state federation sets its own hot weather policy, and many clubs use Sports Medicine Australia’s heat tool, which rates the risk for your postcode from low to extreme. In WA, for example, games for under-12s are cancelled when it’s forecast at 32°C or more.';

export default function HeatPolicyGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="MATCH DAY · PLAYER SAFETY"
      h1="Too hot to play? Heat and lightning rules for junior football"
      answer={ANSWER}
      answerMore={
        <p>
          Summer football, pre-season training and early-season games in March all run into hot days. The short version for coaches: check the forecast a couple of
          days out, know what your federation&apos;s policy says, and don&apos;t wait for the referee to make the call on a 38-degree afternoon.
        </p>
      }
      sections={[
        {
          id: 'sma',
          heading: 'The Sports Medicine Australia heat tool',
          body: (
            <div className="guide-body">
              <p>
                Sports Medicine Australia&apos;s 2025 guidelines, built with the University of Sydney, don&apos;t use a single temperature. The free web tool takes your
                sport (soccer is on the list) and your postcode, pulls in the Bureau of Meteorology&apos;s readings from the nearest station, and allows for humidity,
                sun and wind. It then gives a risk level:
              </p>
              <GuideTable
                caption="Sports Medicine Australia heat risk levels and what to do (2025 guidelines)"
                head={['Risk', 'What to do']}
                rows={[
                  ['Low', 'Drink regularly, and wear light, breathable kit'],
                  ['Moderate', 'More and longer rest breaks in the shade, for example at least 15 minutes’ rest for every 45 minutes of training'],
                  ['High', 'Active cooling during breaks: wet towels, ice packs, water dousing, misting fans'],
                  ['Extreme', 'Consider suspending play. If it’s already started, stop, get everyone into shade or air-conditioning and cool them down'],
                ]}
              />
              <p>
                Keep the tool bookmarked on your phone: <a href="https://sma-heat-policy.sydney.edu.au/" target="_blank" rel="noopener noreferrer" style={linkStyle}>sma-heat-policy.sydney.edu.au</a>.
              </p>
            </div>
          ),
        },
        {
          id: 'example',
          heading: 'What a federation policy looks like: Football West',
          body: (
            <div className="guide-body">
              <p>
                Football West publishes hard temperature cut-offs, using the Bureau of Meteorology forecast for the area nearest the ground. Its policy (version 7.1,
                from November 2025) is a good example of how these work in practice:
              </p>
              <GuideTable
                caption="Football West competition matches, by forecast temperature"
                head={['Forecast', 'Juniors up to 12', 'Juniors 13 to 17', 'Seniors']}
                rows={[
                  ['Up to 31°C', 'Played', 'Played', 'Played'],
                  ['32 to 35°C', 'Cancelled', 'Rescheduled', 'Played'],
                  ['36°C and over', 'Rescheduled', 'Rescheduled', 'Rescheduled'],
                ]}
              />
              <p>
                It also calls for a drinks break in each half when kick-off is forecast at 30°C or more for juniors (34°C for seniors), roughly two-thirds of the way
                through the half. Football West announces its decision by 10am Friday for weekend games.
              </p>
              <p>
                Other states do it differently. Football NSW, for instance, has told clubs that the decision sits with them under their duty of care, using Sports
                Medicine Australia&apos;s guidance. Your association&apos;s handbook is the one that applies, so look it up before summer.
              </p>
            </div>
          ),
        },
        {
          id: 'coaches',
          heading: 'A hot-day checklist for coaches',
          body: (
            <div className="guide-body">
              <ul>
                <li>Check the heat tool or your federation&apos;s update two or three days out, and again on the morning.</li>
                <li>Move training to early morning or evening. Football West, for example, asks junior training on 32 to 35°C days to finish by 11am or start after 5pm.</li>
                <li>Bring shade if the ground hasn&apos;t got any, and more water than you think.</li>
                <li>Use every break properly. On high-risk days Sports Medicine Australia recommends active cooling: wet towels, ice packs, water over the head and neck.</li>
                <li>Rotate more often so nobody is out there for long stretches. Equal minutes still apply, just in shorter bursts.</li>
                <li>Tell parents early. A Thursday message beats a car park full of families at 8am.</li>
              </ul>
              <GuideJoin title="Tell every family when a game is off">
                Mark a match as postponed on your free club website and it updates on the fixtures straight away, so parents check one page instead of a group chat.
              </GuideJoin>
            </div>
          ),
        },
        {
          id: 'lightning',
          heading: 'Lightning: the 30-second rule',
          body: (
            <div className="guide-body">
              <p>
                Storms often follow hot days. Football West&apos;s policy uses the same rule many sports do: count the seconds between the flash and the thunder.
              </p>
              <ul>
                <li><strong>Under 30 seconds</strong> means the lightning is within about 10 km. Stop play and get everyone into a large, solid building.</li>
                <li><strong>Wait 30 minutes</strong> after the last thunder before you go back out. Every new rumble restarts the clock.</li>
              </ul>
              <p>
                Wet grounds after the storm are a council call, not a club one. Our <Link href="/guides/is-the-ground-closed-after-rain-sydney-councils" style={linkStyle}>ground closures guide</Link> has
                the Sydney council status lines.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: guide.tool,
        text: 'Shorter shifts on a hot day? Plan a rotation that still gives every player fair minutes, with the free equal playing time calculator.',
      }}
      questions={[
        {
          q: 'At what temperature is junior soccer cancelled in Australia?',
          a: 'It depends on your state. Football West cancels games for under-12s at a forecast of 32°C or more. Other federations, such as Football NSW, leave it to clubs using Sports Medicine Australia’s heat guidance.',
        },
        {
          q: 'Who decides if a game is called off for heat?',
          a: 'Your federation or association if its policy sets the rule; otherwise the club, under its duty of care. Check your association’s handbook before the season.',
        },
        {
          q: 'Are drinks breaks compulsory?',
          a: 'Under Football West’s policy, yes, when kick-off is forecast at 30°C or more for juniors or 34°C for seniors. Elsewhere, it depends on your competition’s rules.',
        },
        {
          q: 'How long do we wait after lightning?',
          a: 'Thirty minutes after the last thunder, under Football West’s policy, and the count restarts if there’s more thunder.',
        },
      ]}
      sources={[SOURCES.smaHeat, SOURCES.smaHeatTool, SOURCES.fwWeather, SOURCES.fnswHeat]}
    />
  );
}
