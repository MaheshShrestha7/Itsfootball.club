// Reference tables for the playing time pages: the fair share of minutes for each squad size, and a
// worked example schedule. Server-rendered from lib/playing-time.ts so the numbers always match the tool.
import { PERIOD_NAMES, clock, fairMinutes, minutes, planRotation, type KeeperMode } from '@/lib/playing-time';

export interface TableColumn { onField: number; matchMinutes: number; label: string }

/** Minutes per player: one row per squad size, one column per format and match length */
export function MinutesTable({ columns, squads, caption }: { columns: TableColumn[]; squads: number[]; caption: string }) {
  return (
    <div className="pt-table-wrap">
      <table className="pt-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Squad</th>
            {columns.map(c => <th key={c.label} scope="col">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {squads.map(squad => (
            <tr key={squad}>
              <th scope="row">{squad} players</th>
              {columns.map(c => (
                <td key={c.label}>{squad < c.onField ? '–' : squad === c.onField ? `${c.matchMinutes} (no subs)` : fairMinutes(c.onField, squad, c.matchMinutes)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A worked example: the substitution schedule for one match, with placeholder names */
export function WorkedExample({ onField, periods, periodMinutes, squad, keeper }: { onField: number; periods: number; periodMinutes: number; squad: number; keeper: KeeperMode }) {
  const plan = planRotation({ onField, periods, periodMinutes, squad, keeper });
  const name = (i: number) => `Player ${i + 1}`;
  const periodNames = PERIOD_NAMES[periods] || PERIOD_NAMES[2];
  return (
    <div className="pt-table-wrap">
      <table className="pt-table pt-example">
        <caption>{onField}-a-side, {periods} × {periodMinutes} minutes, {squad} players</caption>
        <thead>
          <tr><th scope="col">Time</th><th scope="col">Change</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Kick-off</th>
            <td>{plan.starters.map(name).join(', ')} start{plan.keeperByPeriod[0] != null ? ` (${name(plan.keeperByPeriod[0]!)} in goal)` : ''}</td>
          </tr>
          {plan.changes.map(c => (
            <tr key={c.time}>
              <th scope="row">{c.atBreak ? `${periodNames[c.period - 1] ? (periods === 2 ? 'Half time' : `After the ${periodNames[c.period - 1].toLowerCase()}`) : 'Break'}` : clock(c.time)}</th>
              <td>
                {c.swaps.map(s => `${name(s.on)} on for ${name(s.off)}`).join('; ')}
                {c.atBreak && keeper === 'per-period' && plan.keeperByPeriod[c.period] != null ? `. ${name(plan.keeperByPeriod[c.period]!)} goes in goal.` : ''}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row">Total</th>
            <td>{summary(plan.seconds, keeper)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function summary(seconds: number[], keeper: KeeperMode): string {
  const field = keeper === 'fixed' ? seconds.slice(1) : seconds;
  const lo = Math.min(...field);
  const hi = Math.max(...field);
  const each = lo === hi ? `${minutes(lo)} minutes each` : `${minutes(lo)} or ${minutes(hi)} minutes each`;
  return keeper === 'fixed' ? `Player 1 plays all ${minutes(seconds[0])} minutes in goal; everyone else ${each}.` : `Everyone ${each}.`;
}
