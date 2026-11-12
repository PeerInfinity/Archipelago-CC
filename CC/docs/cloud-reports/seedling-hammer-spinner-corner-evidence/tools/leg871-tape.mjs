// SPINNER-CORNER — leg 871's ON plan (`HAMMER_BODY_GATE` ON, the hammerClearTagChain train row's set, dashless) written as
// a damage-ON staged tape for the game probe (wallsflip's `leg871-tape.mjs` recipe), then replayed on the request's records
// and the DELIVERED record set (the probe's model source). Usage: node leg871-tape.mjs <out.tape.json> [name]
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = R + 'frontend/modules/seedlingDemo/';
const SB = await import(M + 'solverBot.js');
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
const [out, name = 'zz-spinnercorner-leg871-on'] = process.argv.slice(2);
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz')).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const ans = withL40Flip(false, () => SB.withClearTagChain(true, () => SB.withStanceBurn(true, () => withOpportunisticStrike(true,
    () => SB.withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true }, () => SB.withHammerBodyGate(true,
            () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null }))))))))));
if (!ans.ok) { console.log('REFUSED', ans.message.slice(0, 200)); process.exit(1); }
const plan = ans.plan;
const perTick = [...tape.perTick.map((k) => new Set(k)), ...plan.solution.map((k) => new Set(k))];
const equips = [...(tape.equips ?? []).map((e) => (Array.isArray(e) ? { t: e[0], slot: e[1] } : e)),
    ...[...plan.equipsAt].map(([k, slot]) => ({ t: tape.perTick.length + k, slot }))];
console.log('plan', plan.solution.length, 't; equips', JSON.stringify(equips));
const built = buildStagedTape({ staging: { ...tape.staging, equips }, perTick, name });
const t = { ...built, noDamage: false, description: 'SPINNER-CORNER scratch — leg 871\'s HAMMER_BODY_GATE ON plan, as a tape for the game' };
writeFileSync(out, JSON.stringify(t, null, 1) + '\n');
const parsed = parseTape(readFileSync(out, 'utf8'));
const SETS = l25Sets(R.replace(/\/$/, ''));
for (const [label, src] of [['request records', levelSource], ['delivered set', SETS.deliveredSource]]) {
    const run = createRunForStaging(stagingFromTape(parsed), src);
    for (let i = 0; i < parsed.tick_count; i += 1) run.advance(new Set(heldKeysAt(parsed, i)));
    console.log(`${label}: end (${run.state.x.toFixed(3)},${run.state.y.toFixed(3)}) L${run.level} hits `
        + `${JSON.stringify(run.playerHits.map((h) => [h.t, h.id]))} deaths ${run.playerDeaths.length} clears `
        + `${JSON.stringify((run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`))}`);
}
