// OPP step 67 ON (walls default): run to a large cap, log the tick each counter first moves, hits, chaser hits, the end.
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { solveSegment } = await import(M + 'solverBot.js');
const { OPPORTUNISTIC_STRIKE_COUNTS, OPPORTUNISTIC_STRIKE_TRACE, resetOpportunisticStrikeCounts, resetRefugeEtaCutCounts, withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const cap = Number(process.argv[2] ?? 1500);
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(M + 'fixtures/l40bk2-witness/step67-boot.json', 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
const advance = run.advance.bind(run); let prev = { ...OPPORTUNISTIC_STRIKE_COUNTS }; const moves = []; const chaserHits = []; const dashes = [];
run.advance = (k) => {
  if (run.ticksCompleted >= cap) throw Object.assign(new Error('sentinel'), { sentinel: true });
  const now = { ...OPPORTUNISTIC_STRIKE_COUNTS };
  for (const key of ['aimed', 'pressed', 'withheld', 'deferred']) if (now[key] !== prev[key]) moves.push(`t${run.ticksCompleted}:${key}=${now[key]}`);
  prev = now;
  const before = new Map((run.entities('chasers') ?? []).map((c) => [c.id, c.hits]));
  const dashed = run.progress('slashInfo').state.slashDashed === true;
  const out = advance(k);
  for (const c of run.entities('chasers') ?? []) if (before.has(c.id) && c.hits !== before.get(c.id)) chaserHits.push(`${run.ticksCompleted - 1}:${c.id}:${c.hits}`);
  if (!dashed && run.progress('slashInfo').state.slashDashed === true) dashes.push(run.ticksCompleted - 1);
  return out;
};
const events = []; OPPORTUNISTIC_STRIKE_TRACE.sink = (e) => events.push(e);
resetOpportunisticStrikeCounts(); resetRefugeEtaCutCounts(); let error = null;
try { withOpportunisticStrike(true, () => solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }], name: 'opp', boot: staging.boot, dashMode: 'all' })); } catch (e) { error = e; }
console.log('end t', run.ticksCompleted, 'sentinel', error?.sentinel === true, error && !error.sentinel ? String(error.message).slice(0, 500) : '');
console.log('moves', moves.join(' '));
console.log('hits', JSON.stringify(run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`)), 'chaserHits', JSON.stringify(chaserHits), 'dashes', JSON.stringify(dashes));
console.log('strike events', JSON.stringify(events.filter((e) => e.kind === 'strike').map((e) => [e.t, e.previewStrikes.map((s) => `${s.tick}:${s.decision}:${s.target}`)])));
console.log('drives', JSON.stringify(events.filter((e) => e.kind === 'drive').map((s) => `${s.t}:${s.decision}:${s.target}`)));
