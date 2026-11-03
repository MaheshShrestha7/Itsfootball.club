// Diagrams for the rules guides (/guides/offside-rule-soccer, /guides/soccer-rules). Inline SVG, server-rendered,
// on a fixed grass pitch so they read the same in light and dark themes; captions use the theme text colours.
import type { ReactNode } from 'react';

const GRASS = '#1d6b3f';
const GRASS_DARK = '#195d37';
const LINE = 'rgba(255,255,255,0.88)';
const ATT = '#60A5FA'; // attacking team
const DEF = '#F87171'; // defending team
const MARK = '#FDE047'; // offside line, highlights
const OK = '#4ADE80';
const BAD = '#F87171';
const INK = '#0B1220';

/** White label with a dark halo so it reads on grass */
function Label({ x, y, children, size = 17, anchor = 'middle', weight = 700, fill = '#fff' }: { x: number; y: number; children: ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; fill?: string }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={fill} stroke="rgba(0,0,0,0.6)" strokeWidth={3.5} paintOrder="stroke" style={{ fontFamily: 'inherit' }}>
      {children}
    </text>
  );
}

function Player({ x, y, team, letter }: { x: number; y: number; team: 'att' | 'def'; letter?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={13} fill={team === 'att' ? ATT : DEF} stroke={INK} strokeWidth={2.5} />
      {letter && <text x={x} y={y + 5} fontSize={14} fontWeight={800} textAnchor="middle" fill={INK}>{letter}</text>}
    </g>
  );
}

const Ball = ({ x, y, r = 7 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth={2} />;

function Pill({ x, y, text, ok }: { x: number; y: number; text: string; ok: boolean }) {
  const w = text.length * 9.4 + 22;
  return (
    <g>
      <rect x={x - w / 2} y={y - 15} width={w} height={28} rx={14} fill={ok ? OK : BAD} />
      <text x={x} y={y + 5} fontSize={15} fontWeight={800} textAnchor="middle" fill={INK}>{text}</text>
    </g>
  );
}

function Arrowhead({ id, color = '#fff' }: { id: string; color?: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );
}

/** Mown stripes for a pitch area */
function Grass({ x, y, w, h, stripes = 8 }: { x: number; y: number; w: number; h: number; stripes?: number }) {
  const sw = w / stripes;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={GRASS} />
      {Array.from({ length: stripes }, (_, i) => i % 2 === 1 && <rect key={i} x={x + i * sw} y={y} width={sw} height={h} fill={GRASS_DARK} />)}
    </g>
  );
}

function Figure({ id, title, caption, viewBox, children }: { id: string; title: string; caption: ReactNode; viewBox: string; children: ReactNode }) {
  return (
    <figure className="glass-panel guide-figure">
      <svg viewBox={viewBox} role="img" aria-labelledby={`${id}-t`} xmlns="http://www.w3.org/2000/svg">
        <title id={`${id}-t`}>{title}</title>
        {children}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/* ---------------- Offside guide ---------------- */

/** Half a pitch: the offside line at the second-last opponent, one attacker level, one beyond it */
export function OffsideLineDiagram() {
  return (
    <Figure
      id="offside-line"
      viewBox="0 0 640 400"
      title="Diagram: the offside line is drawn at the second-last opponent. An attacker level with it is onside; one beyond it is in an offside position."
      caption={<>The line is set by the <strong>second-last opponent</strong> (here the deepest defender, because the keeper is last), at the moment the ball is played. A is level, so onside. B is beyond the line and in front of the ball, so in an offside position. Offside only counts if B then gets involved.</>}
    >
      <defs><Arrowhead id="ol-arrow" /></defs>
      <Grass x={20} y={20} w={600} h={320} />
      <rect x={20} y={20} width={600} height={320} fill="none" stroke={LINE} strokeWidth={3} />
      <rect x={470} y={80} width={150} height={200} fill="none" stroke={LINE} strokeWidth={3} />
      <rect x={570} y={140} width={50} height={80} fill="none" stroke={LINE} strokeWidth={3} />
      <rect x={620} y={158} width={12} height={44} fill="none" stroke={LINE} strokeWidth={3} />
      <Label x={28} y={44} size={14} anchor="start" weight={600}>Halfway line</Label>

      {/* the offside zone and line */}
      <rect x={505} y={20} width={115} height={320} fill={MARK} opacity={0.14} />
      <line x1={505} y1={20} x2={505} y2={340} stroke={MARK} strokeWidth={3} strokeDasharray="10 7" />

      {/* defenders and keeper */}
      <Player x={415} y={190} team="def" />
      <Player x={505} y={300} team="def" />
      <Player x={598} y={180} team="def" />
      <Label x={505} y={333} size={14}>2nd-last opponent</Label>
      <Label x={590} y={154} size={14}>Keeper</Label>

      {/* passer and the two runs */}
      <Player x={270} y={200} team="att" />
      <Ball x={290} y={206} />
      <line x1={298} y1={200} x2={487} y2={112} stroke="#fff" strokeWidth={2.5} strokeDasharray="6 6" markerEnd="url(#ol-arrow)" />
      <line x1={298} y1={212} x2={537} y2={237} stroke="#fff" strokeWidth={2.5} strokeDasharray="6 6" markerEnd="url(#ol-arrow)" />
      <Player x={505} y={105} team="att" letter="A" />
      <Player x={555} y={240} team="att" letter="B" />
      <Label x={505} y={72} size={15}>A: level, onside</Label>
      <Label x={548} y={274} size={15}>B: offside position</Label>
      <Label x={270} y={240} size={14}>Pass played</Label>

      {/* legend */}
      <circle cx={40} cy={372} r={9} fill={ATT} stroke={INK} strokeWidth={2} />
      <text x={56} y={378} fontSize={15} fill="currentColor" className="guide-figure-legend">Attacking team</text>
      <circle cx={200} cy={372} r={9} fill={DEF} stroke={INK} strokeWidth={2} />
      <text x={216} y={378} fontSize={15} fill="currentColor" className="guide-figure-legend">Defending team</text>
      <line x1={360} y1={372} x2={392} y2={372} stroke={MARK} strokeWidth={3} strokeDasharray="8 5" />
      <text x={402} y={378} fontSize={15} fill="currentColor" className="guide-figure-legend">Offside line</text>
    </Figure>
  );
}

/** Two frames: onside when the pass is played, past the defender when it arrives, and still onside */
function TimingFrame({ x0, title, attX, ballX, showRun }: { x0: number; title: string; attX: number; ballX: number; showRun: boolean }) {
  return (
    <g>
      <text x={x0 + 145} y={34} fontSize={17} fontWeight={800} textAnchor="middle" fill="currentColor" className="guide-figure-strong">{title}</text>
      <Grass x={x0} y={50} w={290} h={150} stripes={6} />
      <rect x={x0} y={50} width={290} height={150} fill="none" stroke={LINE} strokeWidth={3} />
      <line x1={x0 + 200} y1={50} x2={x0 + 200} y2={200} stroke={MARK} strokeWidth={3} strokeDasharray="9 6" />
      <Player x={x0 + 200} y={160} team="def" />
      <Player x={x0 + 40} y={115} team="att" />
      {showRun && <line x1={x0 + 196} y1={98} x2={x0 + 252} y2={98} stroke="#fff" strokeWidth={2.5} strokeDasharray="5 5" markerEnd="url(#ot-arrow)" />}
      {!showRun && <line x1={x0 + 54} y1={112} x2={ballX - 10} y2={104} stroke="#fff" strokeWidth={2} strokeDasharray="5 6" />}
      <Player x={attX} y={98} team="att" letter="A" />
      <Ball x={ballX} y={showRun ? 121 : 104} />
    </g>
  );
}

export function OffsideTimingDiagram() {
  return (
    <Figure
      id="offside-timing"
      viewBox="0 0 640 250"
      title="Diagram: offside position is judged when the pass is played, not when the ball arrives."
      caption={<>Offside is judged at the <strong>moment the ball is played</strong>. A is level when the pass leaves the passer’s boot, so A is onside, even though A is well past the defender by the time the ball arrives.</>}
    >
      <defs><Arrowhead id="ot-arrow" /></defs>
      <TimingFrame x0={20} title="1. Pass is played" attX={220} ballX={78} showRun />
      <TimingFrame x0={330} title="2. Ball arrives" attX={600} ballX={579} showRun={false} />
      <Pill x={165} y={228} text="JUDGED HERE: ONSIDE" ok />
      <Pill x={475} y={228} text="STILL ONSIDE" ok />
    </Figure>
  );
}

/** Side view: an arm over the line doesn’t count, a toe does */
function BodyFigure({ x, reach }: { x: number; reach: boolean }) {
  return (
    <g stroke={ATT} strokeLinecap="round" fill="none">
      <circle cx={x} cy={62} r={15} fill={ATT} stroke={INK} strokeWidth={2} />
      <rect x={x - 13} y={82} width={26} height={74} rx={11} fill={ATT} stroke={INK} strokeWidth={2} />
      {/* legs: in the second scene the front leg stretches forward */}
      <path d={`M${x - 5},152 L${x - 16},222`} strokeWidth={10} />
      <path d={reach ? `M${x + 5},152 L${x + 14},222 L${x + 30},222` : `M${x + 5},152 L${x + 30},218 L${x + 50},220`} strokeWidth={10} />
      {/* arm: reaching forward in the first scene, down by the side in the second */}
      <path d={reach ? `M${x + 6},96 L${x + 70},104` : `M${x + 6},96 L${x + 14},146`} strokeWidth={9} stroke={reach ? 'rgba(96,165,250,0.55)' : ATT} />
    </g>
  );
}

export function OffsideBodyDiagram() {
  return (
    <Figure
      id="offside-body"
      viewBox="0 0 640 300"
      title="Diagram: hands and arms do not count for offside; head, body and feet do."
      caption={<>Only the <strong>head, body and feet</strong> count. Hands and arms are ignored for everyone, keepers included, and the arm starts at the bottom of the armpit. A reaching arm over the line is onside. A toe over the line is offside.</>}
    >
      <Grass x={0} y={0} w={640} h={260} stripes={8} />
      {/* scene 1 */}
      <line x1={190} y1={20} x2={190} y2={240} stroke={MARK} strokeWidth={3} strokeDasharray="9 6" />
      <Label x={190} y={252} size={13} weight={600}>defender’s line</Label>
      <BodyFigure x={130} reach />
      <Label x={244} y={92} size={14}>arm: ignored</Label>
      {/* scene 2 */}
      <line x1={500} y1={20} x2={500} y2={240} stroke={MARK} strokeWidth={3} strokeDasharray="9 6" />
      <Label x={500} y={252} size={13} weight={600}>defender’s line</Label>
      <BodyFigure x={455} reach={false} />
      <circle cx={505} cy={220} r={14} fill="none" stroke={BAD} strokeWidth={3} />
      <Label x={560} y={196} size={14}>toe: counts</Label>
      <Pill x={160} y={282} text="ONSIDE" ok />
      <Pill x={480} y={282} text="OFFSIDE" ok={false} />
    </Figure>
  );
}

/** Three tiles: a deliberate play resets offside, a deflection and a save don’t */
function RuleTile({ x0, title, children, ok, verdict }: { x0: number; title: string; children: ReactNode; ok: boolean; verdict: string }) {
  return (
    <g>
      <Grass x={x0} y={40} w={196} h={170} stripes={4} />
      <rect x={x0} y={40} width={196} height={170} fill="none" stroke={LINE} strokeWidth={2} />
      <text x={x0 + 98} y={28} fontSize={17} fontWeight={800} textAnchor="middle" fill="currentColor" className="guide-figure-strong">{title}</text>
      {children}
      <Pill x={x0 + 98} y={236} text={verdict} ok={ok} />
    </g>
  );
}

export function DeliberatePlayDiagram() {
  return (
    <Figure
      id="offside-deliberate"
      viewBox="0 0 640 260"
      title="Diagram: a defender’s deliberate play resets offside; a deflection or a save does not."
      caption={<>It isn’t <em>whether</em> the defender touched the ball, it’s <em>how</em>. A ball the defender chose to play, even badly, resets offside. A ball that hits them, or that they stop going into the goal, leaves the attacker offside.</>}
    >
      <defs><Arrowhead id="dp-arrow" /></defs>
      {/* deliberate: slow ball from distance, defender miscues it */}
      <RuleTile x0={10} title="Deliberate play" ok verdict="NO OFFSIDE">
        <path d="M30,190 Q70,70 98,120" fill="none" stroke="#fff" strokeWidth={2.5} strokeDasharray="5 6" markerEnd="url(#dp-arrow)" />
        <Player x={110} y={130} team="def" />
        <path d="M118,120 Q150,80 166,82" fill="none" stroke="#fff" strokeWidth={2.5} markerEnd="url(#dp-arrow)" />
        <Player x={176} y={80} team="att" letter="A" />
        <Label x={66} y={70} size={13} weight={600}>controlled, sliced</Label>
      </RuleTile>
      {/* deflection: hard shot off a shin */}
      <RuleTile x0={222} title="Deflection" ok={false} verdict="STILL OFFSIDE">
        <line x1={240} y1={190} x2={306} y2={140} stroke="#fff" strokeWidth={3.5} markerEnd="url(#dp-arrow)" />
        <Player x={320} y={130} team="def" />
        <line x1={332} y1={124} x2={380} y2={86} stroke="#fff" strokeWidth={2.5} strokeDasharray="5 6" markerEnd="url(#dp-arrow)" />
        <Player x={392} y={78} team="att" letter="A" />
        <Label x={232} y={110} size={13} weight={600} anchor="start">hit, no time</Label>
      </RuleTile>
      {/* save: block on the line */}
      <RuleTile x0={434} title="Save" ok={false} verdict="STILL OFFSIDE">
        <line x1={600} y1={70} x2={600} y2={150} stroke={LINE} strokeWidth={3} />
        <rect x={600} y={86} width={20} height={48} fill="none" stroke={LINE} strokeWidth={3} />
        <line x1={452} y1={110} x2={572} y2={110} stroke="#fff" strokeWidth={3.5} markerEnd="url(#dp-arrow)" />
        <Player x={588} y={110} team="def" />
        <path d="M580,122 Q560,170 532,180" fill="none" stroke="#fff" strokeWidth={2.5} strokeDasharray="5 6" markerEnd="url(#dp-arrow)" />
        <Player x={518} y={184} team="att" letter="A" />
        <Label x={500} y={90} size={13} weight={600}>goal-bound</Label>
      </RuleTile>
    </Figure>
  );
}

/* ---------------- Soccer rules guide ---------------- */

/** A full-size pitch to scale (105 × 68 m), with the markings that decide matches */
export function PitchMarkingsDiagram() {
  const S = 6;
  const X = (m: number) => 35 + m * S;
  const Y = (m: number) => 25 + m * S;
  const cy = Y(34);
  const area = (fromLeft: boolean, depth: number, width: number) => (
    <rect x={fromLeft ? X(0) : X(105 - depth)} y={cy - (width / 2) * S} width={depth * S} height={width * S} fill="none" stroke={LINE} strokeWidth={2.5} />
  );
  // penalty arc: the part of the 9.15 m circle around the penalty mark that sits outside the area
  const dy = Math.sqrt(9.15 ** 2 - 5.5 ** 2) * S;
  return (
    <Figure
      id="pitch-markings"
      viewBox="0 0 700 490"
      title="Diagram: a full-size football pitch with the penalty area, goal area, penalty mark, centre circle and goal dimensions."
      caption={<>A 105 × 68 m pitch drawn to scale. Lines are part of the area they mark, so a foul on the penalty area line is a penalty. Every “9.15 m” on the pitch (centre circle, penalty arc, corner kicks and free kicks) is the same 10 yards.</>}
    >
      <defs><Arrowhead id="pm-arrow" /></defs>
      <Grass x={X(0)} y={Y(0)} w={105 * S} h={68 * S} stripes={14} />
      <rect x={X(0)} y={Y(0)} width={105 * S} height={68 * S} fill="none" stroke={LINE} strokeWidth={2.5} />
      <line x1={X(52.5)} y1={Y(0)} x2={X(52.5)} y2={Y(68)} stroke={LINE} strokeWidth={2.5} />
      <circle cx={X(52.5)} cy={cy} r={9.15 * S} fill="none" stroke={LINE} strokeWidth={2.5} />
      <circle cx={X(52.5)} cy={cy} r={3} fill={LINE} />
      {area(true, 16.5, 40.32)}
      {area(false, 16.5, 40.32)}
      {area(true, 5.5, 18.32)}
      {area(false, 5.5, 18.32)}
      <circle cx={X(11)} cy={cy} r={3} fill={LINE} />
      <circle cx={X(94)} cy={cy} r={3} fill={LINE} />
      <path d={`M${X(16.5)},${cy - dy} A${9.15 * S},${9.15 * S} 0 0 1 ${X(16.5)},${cy + dy}`} fill="none" stroke={LINE} strokeWidth={2.5} />
      <path d={`M${X(88.5)},${cy - dy} A${9.15 * S},${9.15 * S} 0 0 0 ${X(88.5)},${cy + dy}`} fill="none" stroke={LINE} strokeWidth={2.5} />
      {[[0, 0], [105, 0], [0, 68], [105, 68]].map(([mx, my]) => {
        const r = S;
        const sx = X(mx) + (mx === 0 ? r : -r);
        const ey = Y(my) + (my === 0 ? r : -r);
        const sweep = (mx === 0) === (my === 0) ? 1 : 0;
        return <path key={`${mx}-${my}`} d={`M${sx},${Y(my)} A${r},${r} 0 0 ${sweep} ${X(mx)},${ey}`} fill="none" stroke={LINE} strokeWidth={2.5} />;
      })}
      <rect x={X(0) - 12} y={cy - 3.66 * S} width={12} height={7.32 * S} fill="none" stroke={LINE} strokeWidth={2.5} />
      <rect x={X(105)} y={cy - 3.66 * S} width={12} height={7.32 * S} fill="none" stroke={LINE} strokeWidth={2.5} />

      {/* measurements, right half */}
      <line x1={X(88.5)} y1={Y(10)} x2={X(105)} y2={Y(10)} stroke={MARK} strokeWidth={2} markerStart="url(#pm-arrow)" markerEnd="url(#pm-arrow)" />
      <Label x={X(96.75)} y={Y(10) - 8} size={15} fill={MARK}>16.5 m</Label>
      <line x1={X(94)} y1={cy + 18} x2={X(105)} y2={cy + 18} stroke={MARK} strokeWidth={2} markerStart="url(#pm-arrow)" markerEnd="url(#pm-arrow)" />
      <Label x={X(99.5)} y={cy + 40} size={15} fill={MARK}>11 m</Label>
      <Label x={X(94)} y={cy - 10} size={13} weight={600}>penalty mark</Label>
      <line x1={X(99.5)} y1={Y(25.5)} x2={X(105)} y2={Y(25.5)} stroke={MARK} strokeWidth={2} />
      <Label x={X(99.5) - 6} y={Y(25.5) + 5} size={14} anchor="end" fill={MARK}>5.5 m</Label>
      <Label x={X(105) - 8} y={Y(66) - 4} size={13} anchor="end" weight={600}>corner arc 1 m</Label>
      {/* centre circle radius */}
      <line x1={X(52.5)} y1={cy} x2={X(52.5) + 9.15 * S} y2={cy} stroke={MARK} strokeWidth={2} markerEnd="url(#pm-arrow)" />
      <Label x={X(52.5) + 4.6 * S} y={cy - 8} size={15} fill={MARK}>9.15 m</Label>
      {/* left half labels */}
      <Label x={X(8.25)} y={Y(18)} size={14}>penalty area</Label>
      <Label x={X(0) + 6} y={Y(23.8)} size={13} anchor="start" weight={600}>goal area</Label>
      <Label x={X(0) + 6} y={Y(43.16) + 20} size={13} anchor="start" weight={600}>goal 7.32 × 2.44 m</Label>

      <text x={350} y={472} fontSize={15} textAnchor="middle" fill="currentColor" className="guide-figure-legend">
        Length 90–120 m, width 45–90 m (international matches: 100–110 m × 64–75 m)
      </text>
    </Figure>
  );
}

/** In or out: the whole ball has to cross the whole line */
export function BallInOutDiagram() {
  const balls: { x: number; y: number; ok: boolean; verdict: string; note: string }[] = [
    { x: 95, y: 150, ok: true, verdict: 'IN', note: 'on the field' },
    { x: 255, y: 100, ok: true, verdict: 'IN', note: 'on the line' },
    { x: 415, y: 80, ok: true, verdict: 'IN', note: 'mostly over' },
    { x: 565, y: 52, ok: false, verdict: 'OUT', note: 'all of it over' },
  ];
  return (
    <Figure
      id="ball-in-out"
      viewBox="0 0 640 260"
      title="Diagram: the ball stays in play until all of it has crossed all of the line."
      caption={<>The ball is out only when <strong>all of it</strong> has crossed <strong>all of the line</strong>, on the ground or in the air. Goals work the same way: a ball resting on the goal line, or even mostly over it, is not a goal.</>}
    >
      <rect x={0} y={0} width={640} height={94} fill="#2a3442" />
      <Grass x={0} y={94} w={640} h={110} stripes={8} />
      <rect x={0} y={94} width={640} height={12} fill={LINE} />
      <Label x={14} y={26} size={14} anchor="start" weight={600}>out of play</Label>
      <Label x={14} y={194} size={14} anchor="start" weight={600}>field of play</Label>
      {balls.map(b => (
        <g key={b.x}>
          <circle cx={b.x} cy={b.y} r={22} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <path d={`M${b.x - 8},${b.y - 6} l8,-6 l8,6 l-3,9 h-10 z`} fill={INK} />
        </g>
      ))}
      {balls.map(b => (
        <g key={`v${b.x}`}>
          <Pill x={b.x} y={228} text={b.verdict} ok={b.ok} />
          <text x={b.x} y={254} fontSize={14} textAnchor="middle" fill="currentColor" className="guide-figure-legend">{b.note}</text>
        </g>
      ))}
    </Figure>
  );
}

/** Careless, reckless, excessive force: what each earns */
export function FoulScaleDiagram() {
  const cols = [
    { x: 110, word: 'Careless', meaning: 'not enough care', outcome: 'Free kick' },
    { x: 320, word: 'Reckless', meaning: 'ignored the danger', outcome: 'Free kick + yellow' },
    { x: 530, word: 'Excessive force', meaning: 'endangered the opponent', outcome: 'Free kick + red' },
  ];
  return (
    <Figure
      id="foul-scale"
      viewBox="0 0 640 230"
      title="Diagram: a careless challenge is a free kick, a reckless one adds a yellow card, excessive force adds a red card."
      caption={<>Referees grade a challenge on how much danger it caused, not on whether it looked bad. Inside the defender’s own penalty area, the free kick becomes a penalty.</>}
    >
      <defs>
        <linearGradient id="fs-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#4ADE80" />
          <stop offset="0.5" stopColor="#FACC15" />
          <stop offset="1" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <rect x={20} y={20} width={600} height={14} rx={7} fill="url(#fs-grad)" />
      {cols.map((c, i) => (
        <g key={c.word}>
          <circle cx={c.x} cy={27} r={9} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <text x={c.x} y={70} fontSize={20} fontWeight={800} textAnchor="middle" fill="currentColor" className="guide-figure-strong">{c.word}</text>
          <text x={c.x} y={94} fontSize={15} textAnchor="middle" fill="currentColor" className="guide-figure-legend">{c.meaning}</text>
          {i === 0 && (
            <g>
              <line x1={c.x} y1={118} x2={c.x} y2={172} stroke="currentColor" strokeWidth={3} className="guide-figure-strong" />
              <path d={`M${c.x},118 l34,10 l-34,10 z`} fill="#FACC15" stroke={INK} strokeWidth={1.5} />
            </g>
          )}
          {i === 1 && <rect x={c.x - 18} y={116} width={36} height={52} rx={4} fill="#FACC15" stroke={INK} strokeWidth={2} transform={`rotate(-8 ${c.x} 142)`} />}
          {i === 2 && <rect x={c.x - 18} y={116} width={36} height={52} rx={4} fill="#EF4444" stroke={INK} strokeWidth={2} transform={`rotate(-8 ${c.x} 142)`} />}
          <text x={c.x} y={204} fontSize={16} fontWeight={700} textAnchor="middle" fill="currentColor" className="guide-figure-strong">{c.outcome}</text>
        </g>
      ))}
    </Figure>
  );
}

/** MiniRoos to 11-a-side: the format grows with age (illustrative, not to scale) */
export function JuniorPathwayDiagram() {
  const steps = [
    { w: 92, h: 62, n: 4, keeper: false, age: 'U6–U7', fmt: '4 v 4', note: 'no keepers' },
    { w: 118, h: 80, n: 7, keeper: true, age: 'U8–U9', fmt: '7 v 7', note: 'no offside' },
    { w: 136, h: 92, n: 9, keeper: true, age: 'U10–U11', fmt: '9 v 9', note: 'no offside' },
    { w: 156, h: 104, n: 11, keeper: true, age: 'U12 up', fmt: '11 v 11', note: 'full Laws' },
  ];
  let x = 48; // 4 pitches + gaps = 572 wide, centred in 640
  const placed = steps.map(s => {
    const at = x;
    x += s.w + 14;
    return { ...s, at };
  });
  const base = 128;
  /** One team in its own half: keeper on the goal line, outfield players in a grid; the other team mirrors it */
  const team = (at: number, w: number, top: number, h: number, n: number, keeper: boolean) => {
    const pts: [number, number][] = [];
    if (keeper) pts.push([at + 8, top + h / 2]);
    const k = keeper ? n - 1 : n;
    const c = k <= 3 ? 1 : k <= 6 ? 2 : 3;
    const r = Math.ceil(k / c);
    const span = w / 2 - 34;
    for (let i = 0; i < k; i++) {
      const col = Math.floor(i / r);
      const row = i % r;
      pts.push([at + 22 + (c === 1 ? span / 2 : (col * span) / (c - 1)), top + ((row + 1) * h) / (r + 1)]);
    }
    return pts;
  };
  return (
    <Figure
      id="junior-pathway"
      viewBox="0 0 640 206"
      title="Diagram: junior football in Australia moves from 4 v 4 at under 6 to 11 v 11 from under 12."
      caption={<>Football Australia’s MiniRoos formats add players and space as children grow, and leave out offside until 11-a-side. Pitches here are illustrative, not to scale. The exact sizes are in our MiniRoos rules guide.</>}
    >
      {placed.map(s => {
        const top = base - s.h;
        const dots = team(s.at, s.w, top, s.h, s.n, s.keeper).flatMap(([px, py], i) => [
          <circle key={`a${i}`} cx={px} cy={py} r={4.5} fill={ATT} stroke={INK} strokeWidth={1.2} />,
          <circle key={`d${i}`} cx={2 * s.at + s.w - px} cy={py} r={4.5} fill={DEF} stroke={INK} strokeWidth={1.2} />,
        ]);
        return (
          <g key={s.fmt}>
            <Grass x={s.at} y={top} w={s.w} h={s.h} stripes={4} />
            <rect x={s.at} y={top} width={s.w} height={s.h} fill="none" stroke={LINE} strokeWidth={2} />
            <line x1={s.at + s.w / 2} y1={top} x2={s.at + s.w / 2} y2={base} stroke={LINE} strokeWidth={1.5} />
            {dots}
            <text x={s.at + s.w / 2} y={base + 26} fontSize={18} fontWeight={800} textAnchor="middle" fill="currentColor" className="guide-figure-strong">{s.fmt}</text>
            <text x={s.at + s.w / 2} y={base + 46} fontSize={14} textAnchor="middle" fill="currentColor" className="guide-figure-legend">{s.age}</text>
            <text x={s.at + s.w / 2} y={base + 66} fontSize={14} textAnchor="middle" fill="currentColor" className="guide-figure-legend">{s.note}</text>
          </g>
        );
      })}
    </Figure>
  );
}
