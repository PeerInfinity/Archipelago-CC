// MEASUREMENT-ONLY preload for survey children (STACK4's reach-preload, extended to CHASER-STAND's two switches): on exit,
// append the step's reach of PKSW / PKRB / DSS / LHM / OAC / PSB to $COUNTS_FILE.
//   NODE_OPTIONS="--import=<this>" COUNTS_FILE=… survey …   (PSB's reach = PRESS_KILL_BOMBS_COUNTS.strike*, PKB being OFF)
import { appendFileSync } from 'node:fs';
import * as sb from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
import * as pk from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/pressKillCost.js';
import * as js from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/jsRuntimeSolver.js';
const step = (process.argv.find((a) => a.startsWith('--step=')) ?? '').slice(7);
if (step && process.env.COUNTS_FILE) {
  process.on('exit', () => {
    const l = sb.LATCHED_HOLD_MOVE_COUNTS;
    appendFileSync(process.env.COUNTS_FILE, `${JSON.stringify({ step: Number(step),
      on: [sb.PRESS_KILL_START_WAIT.enabled, sb.PRESS_KILL_REFUGE_BOMBS.enabled, sb.DASH_STAND_SIGHT.enabled, sb.LATCHED_HOLD_MOVE.enabled,
        sb.OPP_AIM_CHASERS.enabled, sb.PRESS_KILL_STRIKE_BOMBS.enabled],
      pksw: sb.PRESS_KILL_START_WAIT_COUNTS.rows.length, pkrb: { ...sb.PRESS_KILL_REFUGE_BOMBS_COUNTS }, dss: { ...sb.DASH_STAND_SIGHT.counts },
      lhm: { asked: l.asked, moves: l.moves.length, declined: l.declined.length },
      oac: { ...sb.OPP_AIM_CHASERS_COUNTS }, psb: { asked: pk.PRESS_KILL_BOMBS_COUNTS.strikeAsked, refused: pk.PRESS_KILL_BOMBS_COUNTS.strikeRefused },
      opp: { ...pk.OPPORTUNISTIC_STRIKE_COUNTS }, hsb: js.HIT_AVOID_STAND_BOMBS_COUNTS ? { ...js.HIT_AVOID_STAND_BOMBS_COUNTS } : null })}\n`);
  });
}
