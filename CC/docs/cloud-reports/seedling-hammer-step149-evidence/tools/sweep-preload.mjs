// MEASUREMENT-ONLY preload for survey children: append the step's PRESS_KILL_START_WAIT rows to $COUNTS_FILE on exit.
import { appendFileSync } from 'node:fs';
import * as sb from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
const step = (process.argv.find((a) => a.startsWith('--step=')) ?? '').slice(7);
if (step && process.env.COUNTS_FILE) {
  process.on('exit', () => {
    const rows = sb.PRESS_KILL_START_WAIT_COUNTS?.rows ?? [];
    appendFileSync(process.env.COUNTS_FILE, `${JSON.stringify({ step: Number(step), on: sb.PRESS_KILL_START_WAIT.enabled,
      rows: rows.map((r) => ({ t: r.t, refused: r.refused, verdict: r.verdict, tries: r.tries.map((x) => `${x.wait}:${x.verdict}`) })) })}\n`);
  });
}
