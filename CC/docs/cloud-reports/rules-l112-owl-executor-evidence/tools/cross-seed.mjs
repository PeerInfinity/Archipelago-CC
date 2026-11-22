#!/usr/bin/env node
// rules-l112-owl-executor Q4: IS A TAPE SEED-INDEPENDENT? Replays each given tape's inputs, unchanged, under every
// rng seed in --seeds on the MODEL (`levelRun`; exact against the game up to the exit on every judged tape), and
// reports per (tape, seed): the kill, both flags, L113, the player's hits (with their sources). The planning
// staging `{112,1}` is used so the model can leave the room (see owl-executor.mjs `PLAN_PERSIST`), and the
// player-touches-an-opened-pod guard is applied (Pod.as:80-83 is not stepped by the model).
//   node cross-seed.mjs --seeds=1-16,101 --out=<json> <tape.json> ...
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const R = process.cwd();
const M = (f) => import(join(R, 'frontend/modules/seedlingDemo', f));
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const seeds = opt('seeds', '1-16,101').split(',').flatMap((p) => {
    const [a, b] = p.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
});
const { createLevelRun } = await M('levelRun.js');
const { atlasLevelSource } = await M('levelSource.js');
const { ROLES } = await M('levelWorld.js');
const { parseTape, heldKeysAt } = await M('tapeFormat.js');

function play(tape, seed) {
    const run = createLevelRun({
        levelSource: atlasLevelSource(), boot: tape.boot, noclip: false, noHazards: [], noDamage: false,
        grants: tape.grants, persistence: [{ level: 112, tag: 1 }], equips: tape.equips, pins: tape.pins,
        save: tape.save, rng: { seed, split: true }, roles: ROLES,
    });
    let error = null;
    // ⚠ APPROXIMATE `Pod.update:80-83` (the model does not step it): a touch while "opened" starts "close", and the
    // pin fires if the player is still in the cell 22 ticks later (`POD_OPEN_UPDATES`); the model's own anim change
    // ("open"/"close" from the Owl) clears the pending close. Touches are counted either way.
    const closingAt = new Map();
    let touches = 0;
    for (let t = 0; t < tape.tick_count; t += 1) {
        try { run.advance(heldKeysAt(tape, t)); } catch (e) { error = `t${t}: ${e.message.split('\n')[0].slice(0, 120)}`; break; }
        if (run.level !== 112) continue;
        const b = { x: run.state.x - 2, y: run.state.y - 2, right: run.state.x + 2, bottom: run.state.y + 3 };
        for (const p of run.owlPods ?? []) {
            const inside = b.right > p.x - 8 && b.bottom > p.y - 8 && b.x < p.x + 8 && b.y < p.y + 8;
            if (p.anim !== 'opened') closingAt.delete(p.id);
            if (inside && p.anim === 'opened' && !closingAt.has(p.id)) { closingAt.set(p.id, t); touches += 1; }
            if (inside && closingAt.has(p.id) && t - closingAt.get(p.id) >= 22) {
                error = `t${t}: pinned by pod (${p.x},${p.y}) — touched at t${closingAt.get(p.id)} (Pod.as:80-83, approx)`;
            }
        }
        if (error) break;
    }
    const flags = run.finalBossFlags.map((f) => `${f.level}:${f.tag}`);
    const win = !error && flags.includes('112:0') && flags.includes('112:1') && run.level === 113;
    return { seed, win, podTouches: touches, hits: run.playerHits.length, sources: run.playerHits.map((h) => `t${h.t} ${h.source}`), level: run.level, error };
}

const out = [];
for (const p of args.filter((a) => !a.startsWith('--'))) {
    const tape = parseTape(readFileSync(p, 'utf8'));
    const rows = seeds.map((s) => play(tape, s));
    const zero = rows.filter((r) => r.win && r.hits === 0).map((r) => r.seed);
    const hitOnly = rows.filter((r) => r.win && r.hits > 0).map((r) => `${r.seed}(${r.hits})`);
    out.push({ tape: basename(p), plannedSeed: tape.rng.seed, zeroHitSeeds: zero, hitOnlySeeds: hitOnly, rows });
    console.log(`${basename(p).padEnd(24)} planned s${tape.rng.seed}: 0-hit win on ${zero.length}/${seeds.length} [${zero.join(',')}]`
        + `; hit-only ${hitOnly.join(',') || '-'}`);
}
writeFileSync(opt('out', 'cross-seed.json'), `${JSON.stringify({ seeds, tapes: out }, null, 1)}\n`);
