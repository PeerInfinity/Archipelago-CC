// L26 (8,2) arrival, per arm: NEW-LOCKS leg 286's own request (L25 -> L26, boot (128,32), seam items Sword only), with
// the seam items replaced by ONE arm and the goal swapped for the L28 door behind the rocklock (the walk's crossing,
// reach-exit (144,208) = r13c8's teleporter). Solved as the worker does (solveAnytime) under the switches named, the
// plan re-driven on a fresh levelRun run; prints ticks, hits, deaths, end level, the kill/clear writes, the plan sha.
// Usage: node arms.mjs [--arms=sword,spear,wand,shield2,none] [--sight=0|1|default] [--switches=all|none|rock+rewind]
//        [--goal=door|clear] [--out=<dir>]  (writes <dir>/<arm>.json = the request + the plan, for the page witness)
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
const R = new URL('../../../../../', import.meta.url).pathname;
const L = await import(R + 'frontend/modules/seedlingDemo/hammerNewLocksLegs.js');
const S = await import(R + 'frontend/modules/seedlingDemo/solverBot.js');
const { inventorySlotsFor } = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const { solveAnytime, replayTape } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const ARMS = {
    none: {}, sword: { hasSword: true }, spear: { hasSpear: true }, wand: { hasWand: true },
    shield2: { hasShield: true, hasDarkShield: true }, shield1: { hasShield: true },
    route: { hasSword: true, hasShield: true }, // the route's holdings at step 35 (Sword from L10, Shield x1 from L20)
};
const arms = arg('arms', 'sword,spear,wand,shield2').split(',');
const sight = arg('sight', 'default');
const sw = arg('switches', 'all');
const goalKind = arg('goal', 'door');
const out = arg('out', '');
// leg 286's source carries L26 alone; the door leads to L28, so its room is added from the committed atlas.
import { readFileSync } from 'node:fs';
const ATLAS = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const DOOR = { kind: 'reach-exit', exit: { x: 144, y: 208 } };
const swi = sw === 'all' ? L.ALL : sw === 'none' ? L.NONE : { ...L.NONE, rock: true, rewind: true };
const under = (fn) => {
    const inner = () => S.withKillLockClearWrite(swi.write, () => S.withRockLockKill(swi.rock,
        () => S.withKillLockChaserRewind(swi.rewind, () => S.withKillLockLineStance(swi.line, fn))));
    return sight === 'default' ? inner() : S.withKillStanceSight(sight === '1', inner);
};
for (const arm of arms) {
    const { passes, source: src0, tape: cap } = L.staged(L.LEG_286);
    const records = new Map(src0.records); for (const l of ATLAS.levels) if (!records.has(l.level)) records.set(l.level, l);
    const source = { ...src0, records }; const levelSource = levelSourceFromAtlas(records);
    const base = Object.fromEntries(Object.keys(cap.staging.seam.items).map((k) => [k, false]));
    const items = { ...base, ...ARMS[arm] };
    const staging = { ...cap.staging, seam: { ...cap.staging.seam, items }, inventory_slots: inventorySlotsFor(items) };
    const tape = { ...cap, staging, solverGoal: goalKind === 'door' ? DOOR : cap.solverGoal };
    const t0 = Date.now();
    let answer;
    try { answer = under(() => solveAnytime({ ...tape, source, levelSource }, { passes })); }
    catch (e) { answer = { ok: false, message: 'THREW ' + e.message }; }
    const ms = Date.now() - t0;
    if (!answer.ok) { console.log(JSON.stringify({ arm, sight, sw, goal: goalKind, ok: false, ms, slots: staging.inventory_slots, message: String(answer.message ?? '').slice(0, 900) })); continue; }
    const fresh = replayTape({ staging, perTick: [...tape.perTick, ...answer.plan.solution], levelSource, scratchPersistence: tape.scratchPersistence });
    const plan = answer.plan.solution.map((k) => [...k]);
    const sha = createHash('sha1').update(JSON.stringify(plan)).digest('hex').slice(0, 12);
    const row = { arm, sight, sw, goal: goalKind, ok: true, ms, ticks: plan.length, sha, verbs: answer.plan.verbs, slots: staging.inventory_slots,
        endLevel: fresh.level, hits: fresh.ledger('playerHits').length, deaths: fresh.ledger('playerDeaths').length,
        writes: fresh.scratchClears.map(({ level, tag, at, lock }) => ({ level, tag, at, lock })) };
    console.log(JSON.stringify(row));
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${arm}.json`, JSON.stringify({ row, staging, perTick: tape.perTick, plan, scratchPersistence: tape.scratchPersistence })); }
}
