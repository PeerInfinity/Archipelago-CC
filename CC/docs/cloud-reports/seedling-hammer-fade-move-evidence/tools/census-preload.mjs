// FADE-MOVE scratch preload (measure only): `NODE_OPTIONS=--import=<this>` in every survey step process; on exit it
// appends one jsonl row `{argv step, FADE_MOVE_COUNTS}` to $FADE_CENSUS_OUT when any covered wait was reached.
import { appendFileSync } from 'node:fs';
const SB = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js');
process.on('exit', () => {
    const out = process.env.FADE_CENSUS_OUT;
    const c = SB.FADE_MOVE_COUNTS;
    if (!out || (c.rows.length === 0 && c.declined.length === 0 && c.moves.length === 0)) return;
    const step = process.argv.find((a) => a.startsWith('--step='))?.slice(7) ?? null;
    appendFileSync(out, `${JSON.stringify({ step, ...c })}\n`);
});
