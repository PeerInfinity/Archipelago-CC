#!/usr/bin/env node
/**
 * seedling-fidelity-spearrect W0 — every committed tape that thrusts the spear, replayed with `spearGameTest` OFF and
 * ON: its spear presses (first tests), what each hit OFF vs ON, the repeat rows ON, and whether the observation stream
 * moves. Prints one row per tape with a spear press, and a summary.
 *   node CC/docs/cloud-reports/seedling-fidelity-spearrect-evidence/w0-tape-census.mjs [--all]
 */
const M = '../../../../frontend/modules/seedlingDemo/';
const { fixtureNames, loadTape } = await import(`${M}fixtures/index.js`);
const { createTapeStepper } = await import(`${M}tapeRunner.js`);
const { atlasLevelSource } = await import(`${M}levelSource.js`);
const { withContactFidelity } = await import(`${M}contactFidelity.js`);

const ALL = process.argv.includes('--all');
const replay = (tape, on) => withContactFidelity({ spearGameTest: on }, () => {
    let run = null;
    const obs = [];
    let error = null;
    try {
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) { obs.push(r.value.observation); r = st.next(); }
    } catch (e) { error = e.message.slice(0, 200); }
    return { obs, error, presses: run ? run.presses.filter((p) => p.weapon === 'spear') : [] };
});
const hitKey = (p) => p.hits.map((h) => `${h.as3}:${h.id ?? ''}${h.landed === false || h.moved === false || h.pulled === false ? '(no)' : ''}`).join(',');
let spearTapes = 0;
let moved = 0;
for (const name of fixtureNames()) {
    let tape;
    try { tape = loadTape(name); } catch { continue; }
    const off = replay(tape, false);
    if (off.presses.length === 0 && !ALL) continue;
    spearTapes += 1;
    const on = replay(tape, true);
    const firstOn = on.presses.filter((p) => p.repeat == null);
    const diffs = [];
    off.presses.forEach((p, i) => {
        const q = firstOn[i];
        if (!q || hitKey(p) !== hitKey(q)) diffs.push(`#${i} t${p.t} OFF[${hitKey(p)}] ON[${q ? hitKey(q) : '—'}]`);
    });
    const reps = on.presses.filter((p) => p.repeat != null && p.hits.length > 0).map((p) => `t${p.t}+${p.repeat}[${hitKey(p)}]`);
    let streamMoved = off.error !== on.error || off.obs.length !== on.obs.length;
    let firstDiff = null;
    for (let i = 0; i < Math.min(off.obs.length, on.obs.length) && !firstDiff; i += 1) {
        if (JSON.stringify(off.obs[i]) !== JSON.stringify(on.obs[i])) { streamMoved = true; firstDiff = i; }
    }
    if (streamMoved) moved += 1;
    console.log(`${name}: spear presses ${off.presses.length} (ON first ${firstOn.length}, repeats with hits ${reps.length}); `
        + `stream ${streamMoved ? `MOVES${firstDiff !== null ? ` at obs ${firstDiff}` : ''}` : 'same'}`
        + `${off.error || on.error ? ` errors OFF[${off.error}] ON[${on.error}]` : ''}`
        + `${diffs.length ? `\n    first-test diffs: ${diffs.join('; ')}` : ''}${reps.length ? `\n    repeat hits: ${reps.join('; ')}` : ''}`);
}
console.log(`\n${spearTapes} tape(s) thrust the spear; ${moved} move their stream ON`);
