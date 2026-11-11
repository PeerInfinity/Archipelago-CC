// leg 871: the pre-wall (chaserSpinnerWalls OFF) solver plan, written as a damage-ON staged tape for the game probe;
// then replayed on the DELIVERED record set (the probe's model source) under both arms.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = '/home/user/Archipelago-CC/'; const M = R + 'frontend/modules/seedlingDemo/';
const { withChaserStagedHunt, withClearTagChain, withStanceBurn } = await import(M + 'solverBot.js');
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { parseTape, heldKeysAt } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { l25Sets } = await import(M + 'fidelityL25ApItem.js');
const [fix, name, out, wallsArg = '0'] = process.argv.slice(2);
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/' + fix)).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
console.log('prefix', tape.perTick.length, 'staging keys', Object.keys(tape.staging).join(','), 'equips', JSON.stringify(tape.equips ?? null), 'scratch', tape.scratchPersistence);
const ans = withL40Flip(false, () => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: wallsArg === '1' },
            () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null })))))))));
if (!ans.ok) { console.log('REFUSED', ans.message.slice(0, 200)); process.exit(1); }
const plan = ans.plan;
const perTick = [...tape.perTick.map((k) => new Set(k)), ...plan.solution.map((k) => new Set(k))];
const equips = [...(tape.equips ?? []).map((e) => (Array.isArray(e) ? { t: e[0], slot: e[1] } : e)), ...[...plan.equipsAt].map(([k, slot]) => ({ t: tape.perTick.length + k, slot }))];
console.log('plan', plan.solution.length, 't; equips', JSON.stringify(equips), 'items', JSON.stringify([...plan.equipItems ?? []]));
const built = buildStagedTape({ staging: { ...tape.staging, equips }, perTick, name });
const t = { ...built, noDamage: false, description: `WALLSFLIP D1 scratch — hammerClearTagChain leg 871's pre-wall plan (chaserSpinnerWalls ${wallsArg === '1' ? 'ON' : 'OFF'} solve), as a tape for the game` };
writeFileSync(out, JSON.stringify(t, null, 1) + '\n');
const parsed = parseTape(readFileSync(out, 'utf8'));
const SETS = l25Sets(R.slice(0, -1));
for (const [label, src] of [['request records', levelSource], ['delivered set', SETS.deliveredSource]]) for (const walls of [false, true]) withContactFidelity({ chaserSpinnerWalls: walls }, () => {
  const run = createRunForStaging(stagingFromTape(parsed), src);
  for (let i = 0; i < parsed.tick_count; i += 1) run.advance(new Set(heldKeysAt(parsed, i)));
  console.log(`${label} walls=${walls}: end (${run.state.x.toFixed(3)},${run.state.y.toFixed(3)}) L${run.level} hits ${JSON.stringify(run.playerHits.map((h) => [h.t, h.id]))} deaths ${run.playerDeaths.length} burned ${JSON.stringify([...(run.entities('burnedTrees') ?? [])])} clears ${JSON.stringify((run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`))} chasers left ${(run.entities('chasers') ?? []).filter((c) => /736|880,832/.test(c.id) && !c.removed).map((c) => c.id)}`);
});
