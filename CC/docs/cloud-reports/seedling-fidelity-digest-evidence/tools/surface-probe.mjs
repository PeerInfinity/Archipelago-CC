// SCRATCH (seedling-fidelity-digest D3.1, the clocked-hazard workloads): no committed workload calls pressEscape in a
// room with an axe, a beam tower or a lava chain, so the ANSWER here is the escape's whole run surface — the eight
// members it reads (D1), probed every tick: previews of every key set 8 ticks deep, a press forecast from three press
// ticks, the game clock, the weapon, and the world's canonical text. Each tape runs in VARIANTS that share history
// (a PENDING_AT row and a far-future `at` row on an unused tag of the boot level: the two-pass loop's shape) and one
// that does not (seam.time + 1). FALSE EQUAL = two (variant, tick) points with one digest and two surfaces.
//   REPO=<tree> node surface-probe.mjs <tape>... > out.json
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const R = process.env.REPO; const M = join(R, 'frontend/modules/seedlingDemo');
const { loadTape } = await import(join(M, 'fixtures', 'index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { heldKeysAt } = await import(join(M, 'tapeFormat.js'));
const { canonicalDigestText } = await import(join(M, 'levelRun.js'));
const { PENDING_AT } = await import(join(M, 'solverBot.js'));
const { SPACE_TIME_KEY_SETS } = await import(join(M, 'spaceTimeReach.js'));
const md5 = (s) => createHash('md5').update(s).digest('hex').slice(0, 16);
const worldText = new WeakMap();
const wtext = (w) => { if (!worldText.has(w)) worldText.set(w, md5(canonicalDigestText(w))); return worldText.get(w); };
function surface(run) {
    const n = run.ticksCompleted;
    const at = { ...run.state };
    let step = null; try { step = run.previewStepper(); } catch (e) { step = null; }
    const previews = step === null ? 'noclip' : SPACE_TIME_KEY_SETS.map((ks) => {
        let q = { ...at }; const out = [];
        for (let k = 0; k < 8 && q; k += 1) { try { q = step({ ...q }, ks); out.push([q.x, q.y, q.vx, q.vy]); } catch (e) { out.push(String(e.name)); q = null; } }
        return out;
    });
    const presses = [1, 2, 4].map((d) => {
        try { return run.spinnerForecastWithPress(30, { pressAt: n + d, direction: at.direction, positions: () => at }); } catch (e) { return String(e.message).slice(0, 80); }
    });
    let gt; try { gt = [0, 5, 40].map((h) => run.gameTimeAt(h)); } catch (e) { gt = String(e.message).slice(0, 60); }
    return md5(canonicalDigestText({ n, level: run.level, at, world: wtext(run.world), previews, presses, gt,
        weapon: run.progress('primaryWeapon') }));
}
const out = { tapes: [], points: 0, falseEqual: 0, examples: [], sharedDigestPairs: 0, digestDifferSurfaceSame: 0 };
for (const name of process.argv.slice(2)) {
    const tape = loadTape(name); const st = stagingFromTape(tape);
    const lvl = tape.boot.level;
    const variants = {
        base: st,
        pending: { ...st, persistence: [...st.persistence, { level: lvl, tag: 27, at: PENDING_AT }] },
        future: { ...st, persistence: [...st.persistence, { level: lvl, tag: 27, at: 1e6 }] },
        timeShift: { ...st, seam: st.seam ? { ...st.seam, time: (st.seam.time ?? 0) + 1 } : st.seam },
    };
    const byDigest = new Map(); const row = { name, level: lvl, ticks: tape.tick_count, variants: {} };
    for (const [v, staging] of Object.entries(variants)) {
        let run; const pts = [];
        try {
            run = createRunForStaging(staging, atlasLevelSource());
            for (let t = 0; t < tape.tick_count; t += 1) {
                pts.push([run.stateDigest(), surface(run), t]);
                run.advance(heldKeysAt(tape, t));
            }
            row.variants[v] = { points: pts.length };
        } catch (e) { row.variants[v] = { points: pts.length, stopped: String(e.message).split('\n')[0].slice(0, 120) }; }
        for (const [d, s, t] of pts) {
            out.points += 1;
            if (!byDigest.has(d)) { byDigest.set(d, { s, v, t }); continue; }
            const f = byDigest.get(d); out.sharedDigestPairs += 1;
            if (f.s !== s) { out.falseEqual += 1; if (out.examples.length < 5) out.examples.push({ name, a: [f.v, f.t], b: [v, t] }); }
        }
    }
    // digest differs but the surface agrees (a missed match): base vs timeShift, tick by tick
    out.tapes.push(row);
    console.error(JSON.stringify(row));
}
console.log(JSON.stringify(out, null, 1));
