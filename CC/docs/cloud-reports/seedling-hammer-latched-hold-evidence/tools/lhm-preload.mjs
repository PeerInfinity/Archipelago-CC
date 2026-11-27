// MEASUREMENT-ONLY preload for survey children: append the step's LATCHED_HOLD_MOVE instrument to $COUNTS_FILE on exit.
import { appendFileSync } from 'node:fs';
import * as sb from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
const step = (process.argv.find((a) => a.startsWith('--step=')) ?? '').slice(7);
if (step && process.env.COUNTS_FILE) {
  process.on('exit', () => {
    const c = sb.LATCHED_HOLD_MOVE_COUNTS;
    appendFileSync(process.env.COUNTS_FILE, `${JSON.stringify({ step: Number(step), on: sb.LATCHED_HOLD_MOVE.enabled, asked: c.asked,
      moves: c.moves.map((m) => ({ t: m.t, presser: m.presser, target: m.target, ticks: m.ticks, forks: m.forks })),
      declined: c.declined.map((d) => ({ t: d.t, presser: d.presser, why: d.why.slice(0, 300) })) })}\n`);
  });
}
