// SCRATCH (seedling-hammer-digest-audit D1): THE MEASURED PAIRS. In a SCRATCH tree whose levelRun.js carries
// `audit-hook.py`'s `__eval`, walk a workload; at each sampled tick, for each named closure map, PERTURB the current
// level's entry in place (every number +1, every boolean flipped, three levels deep; an undo list), probe, UNDO.
// The pair is (the run before the perturbation, the run during it): one tick, one body, one world, one everything —
// only that map differs. Probed on both: `stateDigest({parts:true})` and the ESCAPE'S RUN SURFACE (the eight members
// `escape-reach.mjs` lists): `previewStepper` over every SPACE_TIME key set 8 ticks deep from the run's state AND from
// four synthetic states beside every special solid (the escape's `state` is its argument, not `run.state`),
// `spinnerForecastWithPress` from three press ticks, `gameTimeAt`, `progress('primaryWeapon')`, the world's text.
// After the undo the digest must equal the base again (the undo is exact).
//   REPO=<tree> node audit-pairs.mjs <workload.json> > out.json
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.env.REPO; const M = join(R, 'frontend/modules/seedlingDemo');
const { loadTape, fixtureNames } = await import(join(M, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { heldKeysAt, parseTape } = await import(join(M, 'tapeFormat.js'));
const { canonicalDigestText } = await import(join(M, 'levelRun.js'));
const { withContactFidelity } = await import(join(M, 'contactFidelity.js'));
const { SPACE_TIME_KEY_SETS } = await import(join(M, 'spaceTimeReach.js'));
const md5 = (s) => createHash('md5').update(s).digest('hex').slice(0, 16);
const SPECIAL = ['lightTotemId', 'beamTowerId', 'pushableId', 'crusherId', 'turretId', 'bossId', 'finalDoorId'];
function surface(run) {
    const n = run.ticksCompleted;
    const at = { ...run.state };
    let step = null; try { step = run.previewStepper(); } catch (e) { step = null; }
    const starts = [at];
    for (const s of run.world.solids ?? []) {
        if (!SPECIAL.some((k) => s[k])) continue;
        const r = s.rect;
        for (const [dx, dy] of [[-12, 0], [r.w + 4, 0], [0, -12], [0, r.h + 4]]) starts.push({ ...at, x: r.x + dx, y: r.y + dy, vx: 0, vy: 0 });
    }
    const previews = step === null ? 'noclip' : starts.map((s0) => SPACE_TIME_KEY_SETS.map((ks) => {
        let q = { ...s0 }; const out = [];
        for (let k = 0; k < 8 && q; k += 1) { try { q = step({ ...q }, ks); out.push([q.x, q.y, q.vx, q.vy]); } catch (e) { out.push(String(e.name)); q = null; } }
        return out;
    }));
    const presses = [1, 2, 4].map((d) => {
        try { return run.spinnerForecastWithPress(30, { pressAt: n + d, direction: at.direction, positions: () => at }); } catch (e) { return String(e.message).slice(0, 80); }
    });
    let gt; try { gt = [0, 5, 40].map((h) => run.gameTimeAt(h)); } catch (e) { gt = String(e.message).slice(0, 60); }
    return { all: md5(canonicalDigestText({ n, level: run.level, at, world: md5(canonicalDigestText(run.world)), previews, presses, gt,
        weapon: run.progress('primaryWeapon') })), starts: starts.length,
        previews: md5(canonicalDigestText(previews)) };
}
const PERTURB = (name) => `(() => {
    const m = ${name};
    const v = m.get(level);
    if (v === undefined || v === null) return null;
    const undo = []; let leaves = 0; const seen = new Set();
    // ⚠ never edit an object the WORLD holds (a lava chain's entry carries its hazard row \`h\`): that would be a
    // world edited in place, which the digest's world memo deliberately cannot see — not a difference in this map
    const held = new Set();
    const hold = (o, d) => {
        if (o === null || typeof o !== 'object' || held.has(o) || d > 8) return;
        held.add(o);
        if (o instanceof Map) { for (const [k, x] of o) { hold(k, d + 1); hold(x, d + 1); } return; }
        if (o instanceof Set) { for (const x of o) hold(x, d + 1); return; }
        for (const k of Reflect.ownKeys(o)) { const dsc = Object.getOwnPropertyDescriptor(o, k); if (dsc && 'value' in dsc) hold(dsc.value, d + 1); }
        const pr = Object.getPrototypeOf(o); if (pr && pr !== Object.prototype && pr !== Array.prototype) hold(pr, d + 1);
    };
    hold(world, 0); for (const w of worlds.values()) hold(w, 0);
    const go = (o, d) => {
        if (o === null || typeof o !== 'object' || seen.has(o) || held.has(o) || d > 3 || Object.isFrozen(o)) return;
        seen.add(o);
        if (o instanceof Map) { for (const x of o.values()) go(x, d + 1); return; }
        if (o instanceof Set) return;
        for (const k of Object.keys(o)) {
            const dsc = Object.getOwnPropertyDescriptor(o, k);
            if (!dsc || !('value' in dsc) || !dsc.writable) continue;
            const x = o[k];
            if (typeof x === 'number' && Number.isFinite(x)) { undo.push([o, k, x]); o[k] = x + 1; leaves += 1; }
            else if (typeof x === 'boolean') { undo.push([o, k, x]); o[k] = !x; leaves += 1; }
            else go(x, d + 1);
        }
    };
    go(v, 0);
    globalThis.__UNDO = undo;
    return leaves;
})()`;
const UNDO = `(() => { for (const [o, k, x] of globalThis.__UNDO.reverse()) o[k] = x; globalThis.__UNDO = null; })()`;
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = { spec: spec.name, rows: [], summary: {}, stops: [] };
const one = (tapeName) => withContactFidelity(spec.switches ?? {}, () => {
    const tape = tapeName ? loadTape(tapeName) : spec.tape ? loadTape(spec.tape) : parseTape(spec.tapeFile.endsWith('.tape.json')
        ? readFileSync(join(M, spec.tapeFile), 'utf8')
        : JSON.stringify(JSON.parse(readFileSync(join(M, spec.tapeFile), 'utf8')).tape));
    const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
    const ticks = Math.min(tape.tick_count, spec.ticks ?? tape.tick_count);
    for (let t = 0; t <= ticks; t += 1) {
        if (t % (spec.every ?? 10) === 0 || t === ticks) {
            const base = run.stateDigest({ parts: true });
            const sBase = surface(run);
            const again = run.stateDigest({ parts: true });
            for (const name of spec.maps) {
                const leaves = run.__eval(PERTURB(name));
                const s = out.summary[name] ??= { samples: 0, perturbed: 0, leaves: 0, partsMoved: {}, surfaceMoved: 0, undoExact: 0 };
                s.samples += 1;
                if (leaves === null || leaves === 0) continue;
                s.perturbed += 1; s.leaves += leaves;
                const p = run.stateDigest({ parts: true });
                const sP = surface(run);
                run.__eval(UNDO);
                const back = run.stateDigest({ parts: true });
                if (back.digest === again.digest) s.undoExact += 1;
                const moved = Object.keys(p.parts).filter((k) => p.parts[k] !== again.parts[k]);
                for (const k of moved) s.partsMoved[k] = (s.partsMoved[k] ?? 0) + 1;
                const sm = sP.all !== sBase.all;
                if (sm) s.surfaceMoved += 1;
                if (sm || moved.length) out.rows.push({ tape: tapeName ?? null, t, level: run.level, map: name, leaves, moved, surfaceMoved: sm,
                    previewsMoved: sP.previews !== sBase.previews });
            }
            void base;
        }
        if (t < tape.tick_count) {
            try { run.advance(heldKeysAt(tape, t)); } catch (e) { out.stops.push({ tape: tapeName ?? spec.tape ?? spec.tapeFile, t, why: String(e.message).split('\n')[0].slice(0, 140) }); break; }
        }
    }
});
if (spec.tapes === 'all') {
    for (const nm of fixtureNames()) { try { one(nm); } catch (e) { out.stops.push({ tape: nm, t: null, why: String(e.message).split('\n')[0].slice(0, 140) }); } }
} else one(null);
out.rows = out.rows.slice(0, 400);
console.log(JSON.stringify(out, null, 1));
