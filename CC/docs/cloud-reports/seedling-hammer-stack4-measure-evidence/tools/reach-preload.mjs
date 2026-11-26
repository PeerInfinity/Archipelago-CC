// MEASUREMENT-ONLY preload for survey children (LATCHED-HOLD's lhm-preload pattern, four switches): on exit, append
// the step's reach of PKSW / PKRB / DSS / LHM to $COUNTS_FILE.  NODE_OPTIONS="--import <this>" COUNTS_FILE=… survey …
import { appendFileSync } from 'node:fs';
import * as sb from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
const step = (process.argv.find((a) => a.startsWith('--step=')) ?? '').slice(7);
if (step && process.env.COUNTS_FILE) {
  process.on('exit', () => {
    const l = sb.LATCHED_HOLD_MOVE_COUNTS;
    appendFileSync(process.env.COUNTS_FILE, `${JSON.stringify({ step: Number(step),
      on: [sb.PRESS_KILL_START_WAIT.enabled, sb.PRESS_KILL_REFUGE_BOMBS.enabled, sb.DASH_STAND_SIGHT.enabled, sb.LATCHED_HOLD_MOVE.enabled],
      pksw: sb.PRESS_KILL_START_WAIT_COUNTS.rows.length, pkrb: { ...sb.PRESS_KILL_REFUGE_BOMBS_COUNTS }, dss: { ...sb.DASH_STAND_SIGHT.counts },
      lhm: { asked: l.asked, moves: l.moves.length, declined: l.declined.length } })}\n`);
  });
}
