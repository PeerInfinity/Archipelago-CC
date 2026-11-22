#!/usr/bin/env node
// rules-predictable-rng Q2 (JS runtime): what does the JS model (`levelRun`, the engine under `jsRuntimeCore`) do in the
// two rooms with GAMEPLAY draws when no tape declares `rng {seed, split}` (normal play), on a walk-in, and twice in a
// row with the same inputs? Node only, no browser.   node js-runtime-rng.mjs [--out=<json>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.cwd();
const EV = join(R, 'CC/docs/cloud-reports/rules-predictable-rng-evidence');
const M = (f) => import(join(R, 'frontend/modules/seedlingDemo', f));
const { createLevelRun } = await M('levelRun.js');
const { atlasLevelSource } = await M('levelSource.js');
const { ROLES } = await M('levelWorld.js');
const { heldKeysAt } = await M('tapeFormat.js');
const out = (process.argv.find((a) => a.startsWith('--out=')) ?? `--out=${join(EV, 'logs/js-runtime-rng.json')}`).slice(6);
const OWL = JSON.parse(readFileSync(join(EV, 'tapes/owl-sword-s101.json'), 'utf8'));
const TB = JSON.parse(readFileSync(join(R, 'frontend/modules/seedlingDemo/fixtures/tentaclebeast-witness/tb-hitless-s2.json'), 'utf8')).tape;
const src = atlasLevelSource();
function play(name, tape, rng) {
    const row = { arm: name, boot: tape.boot, rng };
    try {
        const run = createLevelRun({ levelSource: src, boot: tape.boot, noclip: tape.noclip, noHazards: tape.noHazards,
            noDamage: tape.noDamage, grants: tape.grants, persistence: tape.persistence, equips: tape.equips, pins: tape.pins,
            save: tape.save, rng, roles: ROLES, ...(tape.inventory_slots ? { inventorySlots: tape.inventory_slots } : {}) });
        let t = 0;
        try { for (; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t)); }
        catch (e) { row.refusedAt = t; row.refusal = e.message.slice(0, 400); }
        row.ticks = t; row.end = { level: run.level, x: run.state.x, y: run.state.y };
        row.hits = run.playerHits.length;
        row.flags = (run.finalBossFlags ?? []).map((f) => `${f.level}:${f.tag}`);
        if (run.level === 57 || tape.boot.level === 57) {
            // The fight verb's gate (`levelRun.js` `tentacleBeastFightNow`): why the run's draw stream is not the game's.
            const f = run.entities('tentacleBeastFight');
            row.tentacleStreamRefusal = f ? (f.streamRefusal ?? null) : 'no fight view';
        }
    } catch (e) { row.constructError = e.message.slice(0, 400); }
    return row;
}
const walkTape = JSON.parse(readFileSync(join(EV, 'tapes/owl-sword-s101-walkin.json'), 'utf8'));
const rows = [
    play('owl-seeded', OWL, OWL.rng),
    play('owl-seeded-again', OWL, OWL.rng),
    play('owl-normal-play(no rng block)', OWL, null),
    play('owl-seed0(inherit)', OWL, { seed: 0, split: true }),
    play('owl-walkin-from-L111', walkTape, walkTape.rng),
    play('tb-seeded', TB, TB.rng),
    play('tb-normal-play(no rng block)', TB, null),
    play('tb-normal-play(no rng block, 20 ticks)', { ...TB, tick_count: 20 }, null),
    play('tb-seeded(20 ticks)', { ...TB, tick_count: 20 }, TB.rng),
];
for (const r of rows) console.log(JSON.stringify(r));
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);
