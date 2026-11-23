// SIBLING-EXIT — MEASUREMENT ONLY: builds the wasm GAME witness's lab and driver from the divergence sweep's own
// (`scripts/procgen/seedlingDivergenceLab.js`, `probe-seedling-divergence-sweep.mjs`), changed in four asserted places:
//   (a) an EXIT leg's goal is resolved by the CONTROLLER (`resolveSeedlingAtlasGoal(name, the panel's atlas map, {region})`),
//       as the Playback Bot's walkTo is, so the page's switch (`?seedlingSolverEnv=SEEDLING_SIBLING_EXIT_CHOICE=1`, read on
//       the main thread) puts the siblings on the goal; the row says whether it equals the leg's own goal (`goalSame`);
//   (b) the game's hits are sampled in EVERY level (the sweep's `roomHits` drops samples outside the leg's level — the
//       FEWER-HITS hand-over), each tagged with its level;
//   (c) a crossed exit leg is stopped only once its tape has drained (or 6 s after leaving), so the fall and the landing
//       — where the bob is — are on the game;
//   (e) an exit leg that ended (done/crossed: the engine HOLDS the first frame of the landing level) is then RELEASED
//       (`engine.stop()`) and the game runs IDLE for IDLE_MS (default 4000; env SIBLING_WITNESS_IDLE_MS), sampled every
//       50 ms (`idle`: game clock, level, position, hits) — the fall plays out on the game with no key held;
//   (d) every `user:regionMove` the region glue publishes during the leg is recorded (`regionMoves`: the door the binding
//       credited), and each plan carries its `siblingExit` stamp.
// The lab goes to .cache/sibling-witness/ (served by the dev server; gitignored), the driver beside the sweep's (its
// relative imports), named *.sibling-witness.tmp.mjs — the caller removes it after the run.
//   node make-witness-lab.mjs   → prints the driver's path
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || process.cwd();
const sub = (src, a, b, what) => {
    if (src.split(a).length !== 2) throw new Error(`patch ${what}: expected exactly one match`);
    return src.replace(a, b);
};
let lab = readFileSync(join(REPO, 'scripts/procgen/seedlingDivergenceLab.js'), 'utf8');
lab = sub(lab, "        if (leg.goal.kind === 'exit') return { goal: { kind: 'exit', level: leg.goal.level, tiles: leg.goal.tiles, name: leg.goal.name } };",
    `        if (leg.goal.kind === 'exit') {
            const own = { kind: 'exit', level: leg.goal.level, tiles: leg.goal.tiles, name: leg.goal.name };
            const r = resolveSeedlingAtlasGoal({ kind: 'exit', name: leg.goal.name }, surface().atlas, { region: leg.region });
            if (!r.goal) return { goal: own, viaMap: r.refused ?? 'link' };
            const { siblings, ...plain } = r.goal;
            __sib.goalSame = JSON.stringify(plain) === JSON.stringify(own);
            __sib.siblings = (siblings ?? []).map((s) => s.name);
            return r;
        }`, 'a');
lab = sub(lab, `            if (s?.level !== goal.level || typeof s.hits !== 'number') return;`,
    `            if (typeof s?.hits !== 'number') return;`, 'b');
lab = sub(lab, `            hitRec.observe(s, { tape: tapeOf() });`, `            hitRec.observe(s, { tape: tapeOf(), level: s.level });`, 'b2');
lab = sub(lab, `                if ((es.drained ?? 0) >= (es.ticks ?? Infinity) || performance.now() - leftAt > 500) { eng.stop(); end = 'crossed'; break; }`,
    `                if ((es.drained ?? 0) >= (es.ticks ?? Infinity) || performance.now() - leftAt > 6000) { await sleep(300); eng.stop(); end = 'crossed'; break; }`, 'c');
lab = lab.replace('export async function createLab() {', `const IDLE_MS = ${Number(process.env.SIBLING_WITNESS_IDLE_MS || 4000)};\nexport async function createLab() {`);
lab = sub(lab, `        if (end !== 'crossed') eng.stop();
        clearInterval(hitSampler);`, `        if (end !== 'crossed') eng.stop();
        if (goal.kind === 'exit' && (end === 'done' || end === 'crossed')) {
            eng.stop();
            const tEnd = performance.now();
            __sib.idle = [];
            while (performance.now() - tEnd < IDLE_MS) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(50);
                const s = status();
                const rs = readState();
                if (s) __sib.idle.push({ gt: s.game_time ?? null, level: s.level, x: s.x, y: s.y, hits: s.hits, frozen: s.frozen ?? null,
                    report: { level: rs.level ?? null, playerPositionX: rs.playerPositionX ?? null, playerPositionY: rs.playerPositionY ?? null } });
            }
        }
        clearInterval(hitSampler);`, 'e');
lab = sub(lab, `    const glue = fp.getSeedlingRegionGlue();`, `    const glue = fp.getSeedlingRegionGlue();
    const __sib = { moves: [] };
    {
        const d0 = glue.getDispatcher.bind(glue);
        glue.getDispatcher = () => {
            const d = d0();
            if (!d || d.__sibTap) return d;
            const pub = d.publish.bind(d);
            d.publish = (n, p, o) => { if (n === 'user:regionMove') __sib.moves.push({ ...p, t: Math.round(performance.now()) }); return pub(n, p, o); };
            d.__sibTap = true;
            return d;
        };
    }`, 'd');
lab = sub(lab, `            ...(s.res?.ok === false && s.res?.obstacle ? { obstacle: plain(s.res.obstacle) } : {}) }));`,
    `            ...(s.res?.ok === false && s.res?.obstacle ? { obstacle: plain(s.res.obstacle) } : {}),
            ...(s.res?.plan?.siblingExit ? { siblingExit: plain(s.res.plan.siblingExit) } : {}) }));`, 'd2');
lab = sub(lab, `        return { answer, end, failed: st.failed,`, `        const sib = { idle: __sib.idle ?? null, goalSame: __sib.goalSame ?? null, siblings: __sib.siblings ?? [], regionMoves: __sib.moves.splice(0),
            bindingRegion: glue?.binding?.region ?? null, glueRegionMoves: glue?.stats?.regionMoves ?? null, glueWarnings: glue?.stats?.warnings ?? null };
        __sib.goalSame = undefined; __sib.siblings = undefined; __sib.idle = undefined;
        return { sibling: sib, answer, end, failed: st.failed,`, 'd3');
mkdirSync(join(REPO, '.cache/sibling-witness'), { recursive: true });
writeFileSync(join(REPO, '.cache/sibling-witness/seedlingDivergenceLab.sibling.js'), lab);
let probe = readFileSync(join(REPO, 'scripts/procgen/probe-seedling-divergence-sweep.mjs'), 'utf8');
probe = sub(probe, `await import('/scripts/procgen/seedlingDivergenceLab.js')`, `await import('/.cache/sibling-witness/seedlingDivergenceLab.sibling.js')`, 'probe');
const out = join(REPO, 'scripts/procgen/probe-seedling-divergence-sweep.sibling-witness.tmp.mjs');
writeFileSync(out, probe);
console.log(out);
