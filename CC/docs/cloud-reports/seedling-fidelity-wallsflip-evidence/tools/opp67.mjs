// hammerOpportunisticStrike step 67's values, dumped (the test's own solveChest, FIRST_AIM as argv[2]).
import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { SolverRefusal, solveSegment } = await import(M + 'solverBot.js');
const { OPPORTUNISTIC_STRIKE_COUNTS, OPPORTUNISTIC_STRIKE_TRACE, REFUGE_ETA_CUT_COUNTS, resetOpportunisticStrikeCounts, resetRefugeEtaCutCounts, withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { CONTACT_FIDELITY } = await import(M + 'contactFidelity.js');
const BOOT = M + 'fixtures/l40bk2-witness/step67-boot.json';
const BOB = 'bob@736,752';
const FIRST_AIM = Number(process.argv[2] ?? 651);
function solveChest(on, cap) {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(BOOT, 'utf8'))));
    const run = createRunForStaging(staging, atlasLevelSource());
    const keys = []; const chaserHits = []; const dashes = []; let countsBefore = null; const bobTrack = [];
    const advance = run.advance.bind(run);
    run.advance = (k) => {
        if (run.ticksCompleted === FIRST_AIM - 1) countsBefore = { ...OPPORTUNISTIC_STRIKE_COUNTS };
        if (run.ticksCompleted >= cap) throw Object.assign(new Error(`OPP sentinel: t${cap}`), { sentinel: true });
        keys.push([...k].sort().join('+'));
        const before = new Map((run.entities('chasers') ?? []).map((c) => [c.id, c.hits]));
        const dashed = run.progress('slashInfo').state.slashDashed === true;
        const out = advance(k);
        for (const c of run.entities('chasers') ?? []) if (before.has(c.id) && c.hits !== before.get(c.id)) chaserHits.push(`${run.ticksCompleted - 1}:${c.id}:${c.hits}`);
        if (!dashed && run.progress('slashInfo').state.slashDashed === true) dashes.push(run.ticksCompleted - 1);
        const b = (run.entities('chasers') ?? []).find((c) => c.id === BOB);
        bobTrack.push(b ? [run.ticksCompleted, +run.state.x.toFixed(2), +run.state.y.toFixed(2), +b.x.toFixed(2), +b.y.toFixed(2)] : null);
        return out;
    };
    const events = []; OPPORTUNISTIC_STRIKE_TRACE.sink = (e) => events.push(e);
    resetOpportunisticStrikeCounts(); resetRefugeEtaCutCounts();
    let error = null;
    try { withOpportunisticStrike(on, () => solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }], name: 'opp', boot: staging.boot, dashMode: 'all' })); }
    catch (e) { error = e; } finally { OPPORTUNISTIC_STRIKE_TRACE.sink = null; }
    return { run, keys, error, chaserHits, dashes, events, countsBefore, bobTrack, counts: { ...OPPORTUNISTIC_STRIKE_COUNTS }, refugePreviews: REFUGE_ETA_CUT_COUNTS.previews,
        hits: run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`) };
}
console.log('walls', CONTACT_FIDELITY.chaserSpinnerWalls, 'FIRST_AIM', FIRST_AIM);
const off = solveChest(false, 800);
console.log('OFF refusal:', off.error instanceof SolverRefusal, String(off.error?.message).slice(0, 140));
console.log('OFF hits', JSON.stringify(off.hits), 'chaserHits', JSON.stringify(off.chaserHits), 'counts', JSON.stringify(off.counts), 'events', off.events.length);
const on = solveChest(true, 760);
console.log('ON sentinel', on.error?.sentinel, on.error?.sentinel ? '' : String(on.error?.message).slice(0, 300));
console.log('ON hits', JSON.stringify(on.hits));
console.log('ON chaserHits', JSON.stringify(on.chaserHits));
console.log('ON bob gone', !(on.run.entities('chasers') ?? []).some((c) => c.id === BOB && !c.removed));
console.log('ON counts', JSON.stringify(on.counts), 'refugePreviews', on.refugePreviews, 'dashes', JSON.stringify(on.dashes));
console.log('ON countsBefore', JSON.stringify(on.countsBefore));
let fd = null; for (let i = 0; i < Math.min(on.keys.length, off.keys.length); i += 1) if (on.keys[i] !== off.keys[i]) { fd = i; break; }
console.log('first key index ON != OFF:', fd, 'ON', JSON.stringify(on.keys.slice(fd - 3, fd + 3)), 'OFF', JSON.stringify(off.keys.slice(fd - 3, fd + 3)));
const drives = on.events.filter((e) => e.kind === 'drive').map(({ t, decision, target }) => ({ tick: t, decision, target }));
const certified = on.events.filter((e) => e.kind === 'strike' && e.previewStrikes.length > 0);
console.log('certified ticks', JSON.stringify(certified.map((e) => e.t)));
console.log('drives', JSON.stringify(drives.map((s) => `${s.tick}:${s.decision}:${s.target}`)));
certified.forEach((c, i) => console.log(`certified[${i}] t${c.t} previewStrikes`, JSON.stringify(c.previewStrikes.map((s) => `${s.tick}:${s.decision}:${s.target}`))));
const firstIn = on.bobTrack.find((r) => r && Math.hypot(r[1] - r[3], r[2] - r[4]) < 40);
console.log('bob track around first aim (t, px,py, bx,by):', JSON.stringify(on.bobTrack.slice(fd - 4, fd + 2)));
const kinds = {}; for (const e of on.events) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
console.log('event kinds', JSON.stringify(kinds));
for (const e of on.events.filter((e) => e.kind !== 'drive' && e.t >= 600)) console.log('  ev', JSON.stringify({ ...e, previewStrikes: e.previewStrikes?.map((s) => `${s.tick}:${s.decision}:${s.target}`) }).slice(0, 400));
