// MEASUREMENT-ONLY preload: print the slice's instruments when the process exits.
import * as sb from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js';
import { FORCED_HIT_TRACE } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/forcedHit.js';
const fh = [];
FORCED_HIT_TRACE.sink = (row) => fh.push({ what: String(row.what ?? '').slice(-120), at: row.at, outcome: row.outcome, billed: row.billed, why: String(row.why ?? '').slice(0, 200) });
process.on('exit', () => {
  const c = (o) => JSON.stringify(o ?? null).slice(0, Number(process.env.COUNTS_MAX ?? 4000));
  process.stderr.write(`\n##COUNTS## PKSW=${c(sb.PRESS_KILL_START_WAIT_COUNTS?.rows)}\n`);
  process.stderr.write(`##COUNTS## FORCED=${c(fh)}\n`);
  if (sb.BOMB_PHASE_WAIT_COUNTS) process.stderr.write(`##COUNTS## BPW=${c(sb.BOMB_PHASE_WAIT_COUNTS)}\n`);
  if (sb.FADE_MOVE_COUNTS) process.stderr.write(`##COUNTS## FADE_MOVE moves=${c(sb.FADE_MOVE_COUNTS.moves)} declined=${c(sb.FADE_MOVE_COUNTS.declined)}\n`);
  if (sb.OPP_PRESS_FALLBACK_COUNTS) process.stderr.write(`##COUNTS## OPF=${c(sb.OPP_PRESS_FALLBACK_COUNTS)}\n`);
});
