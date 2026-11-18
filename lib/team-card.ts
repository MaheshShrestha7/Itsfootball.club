'use client';

// "How we did" graphic for one team at a hosted tournament (TX-10): a 4:5 post drawn in the browser,
// same dark base and helpers as the matchday cards.
import { crest, fit, ellipsize, drawContain, hex } from '@/lib/share-card';
import { SITE_URL } from '@/lib/slugs';
import type { TeamSummary } from '@/lib/hosted-tournaments';

export interface TeamCardInput {
  team: { name: string; logo_url?: string | null; color?: string | null };
  tournament: string;
  host: { name: string; logo_url?: string | null };
  summary: TeamSummary;
  /** Names as the public page shows them (junior names already shortened) */
  showName?: (n: string) => string;
}

export async function drawTeamCard(canvas: HTMLCanvasElement, { team, tournament, host, summary: s, showName = n => n }: TeamCardInput) {
  const W = 1080, H = 1350, F = 'Inter, system-ui, sans-serif';
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const c = hex(team.color || undefined, '#22c55e');
  ctx.fillStyle = '#070B12'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 760);
  g.addColorStop(0, `${c}55`); g.addColorStop(1, '#070B1200');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c; ctx.fillRect(0, 0, W, 14);

  const [teamImg, hostImg] = await Promise.all([crest(team.logo_url || undefined), crest(host.logo_url || undefined)]);
  drawContain(ctx, teamImg, W / 2, 270, 300);
  ctx.textAlign = 'center'; ctx.fillStyle = '#F8FAFC';
  fit(ctx, team.name.toUpperCase(), 900, 84, W - 140, F);
  ctx.fillText(team.name.toUpperCase(), W / 2, 520);
  ctx.fillStyle = 'rgba(248,250,252,0.68)';
  fit(ctx, tournament, 600, 40, W - 160, F);
  ctx.fillText(tournament, W / 2, 578);

  if (s.finish) {
    ctx.font = `800 52px ${F}`; ctx.fillStyle = c;
    ctx.fillText(s.finish, W / 2, 668);
  }

  // Played / won / drawn / lost / goals
  const stats: [string, string][] = [['P', `${s.played}`], ['W', `${s.won}`], ['D', `${s.drawn}`], ['L', `${s.lost}`], ['GF', `${s.goalsFor}`], ['GA', `${s.goalsAgainst}`]];
  const cell = (W - 120) / stats.length;
  stats.forEach(([k, v], i) => {
    const x = 60 + cell * i + cell / 2;
    ctx.fillStyle = 'rgba(248,250,252,0.06)';
    ctx.beginPath(); ctx.roundRect(x - cell / 2 + 8, 720, cell - 16, 170, 22); ctx.fill();
    ctx.fillStyle = '#F8FAFC'; ctx.font = `900 72px ${F}`; ctx.fillText(v, x, 815);
    ctx.fillStyle = 'rgba(248,250,252,0.42)'; ctx.font = `700 30px ${F}`; ctx.fillText(k, x, 862);
  });

  const top = s.scorers.slice(0, 3);
  if (top.length) {
    ctx.fillStyle = 'rgba(248,250,252,0.42)'; ctx.font = `800 28px ${F}`;
    ctx.fillText('GOALS', W / 2, 960);
    ctx.fillStyle = '#F8FAFC'; ctx.font = `700 40px ${F}`;
    top.forEach((p, i) => ctx.fillText(ellipsize(ctx, `${showName(p.name)}  ${p.goals}`, W - 200), W / 2, 1020 + i * 54));
  }

  // Host club along the bottom
  drawContain(ctx, hostImg, 120, H - 110, 90);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(248,250,252,0.68)'; ctx.font = `700 30px ${F}`;
  ctx.fillText(ellipsize(ctx, `Hosted by ${host.name}`, W - 420), 190, H - 100);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(248,250,252,0.42)'; ctx.font = `600 26px ${F}`;
  ctx.fillText(new URL(SITE_URL).host, W - 60, H - 100);
}
