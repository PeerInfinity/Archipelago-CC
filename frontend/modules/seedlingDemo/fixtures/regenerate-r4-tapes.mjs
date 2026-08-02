#!/usr/bin/env node
/**
 * Synthesize the R4 walk tapes from the committed route.
 *
 * Region-atlas Phase 8, rung R4 slice 5. This writes TAPES (inputs), never
 * expectations: an expectation is an oracle recording and only
 * `verify-seedling-bot-differential.mjs --record` may write one.
 *
 *   node frontend/modules/seedlingDemo/fixtures/regenerate-r4-tapes.mjs
 *   node .../regenerate-r4-tapes.mjs --only=r4-walk-6-health   # one of them
 *   node .../regenerate-r4-tapes.mjs --check                   # write nothing
 *
 * ⚠ The tapes are DERIVED, so re-running this after a geometry, pricing or
 * physics change is how you find out that the route no longer walks — the
 * driver throws by name (a planner bug, an unasked crossing, an undeclared
 * contact, a press that reaches an unmodelled responder, a stance facing the
 * wrong way) rather than emitting a tape that quietly goes somewhere else.
 *
 * ⛔ AND IT IS ALSO WHERE THE BYTE BUDGET IS MEASURED. `synthesizeLegs` calls
 * `assertTapeWithinRuntimeBudget` at the end, so a tape past the recompiled
 * runtime's ceiling FAILS HERE — loudly, in seconds — rather than at load
 * time forty minutes into a recording. R4 was projected at ~95 KB against a
 * 90 KB limit before the route existed; the measurement below is the answer,
 * and it is printed for every tape whether or not it is over.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { synthesizeLegs } from '../botDriverV2.js';
import { atlasLevelSource } from '../levelSource.js';
import { TAPE_BUDGET, assertTapeWithinRuntimeBudget, serializeTape } from '../tapeFormat.js';
import { R4_HITS_MAX, R4_NO_HAZARDS, r4TapeSpecs } from '../r4Walk.js';
import { TAPES_DIR } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = JSON.parse(readFileSync(join(HERE, 'r4-route.json'), 'utf8'));

const CHECK = process.argv.includes('--check');
const ONLY = new Set(
    process.argv.filter((a) => a.startsWith('--only='))
        .flatMap((a) => a.slice('--only='.length).split(','))
        .map((s) => s.trim())
        .filter(Boolean),
);

const levelSource = atlasLevelSource();
let changed = 0;
let failed = 0;

for (const spec of r4TapeSpecs(ROUTE)) {
    if (ONLY.size > 0 && !ONLY.has(spec.name)) continue;
    const t0 = Date.now();
    let result;
    try {
        result = synthesizeLegs(spec.legs, {
            levelSource,
            boot: spec.boot,
            name: spec.name,
            relax: spec.relax,
            lattice: spec.lattice,
            nodeMargin: spec.nodeMargin,
            triggerMargin: spec.triggerMargin,
            allowGrazes: spec.allowGrazes,
            maxTicksPerTarget: spec.maxTicksPerTarget,
        });
    } catch (e) {
        console.log(`FAIL ${spec.name}: ${e.message}`);
        failed++;
        continue;
    }
    const json = serializeTape({ ...result.tape, description: describe(spec, result) });
    const path = join(TAPES_DIR, `${spec.name}.json`);
    let before = null;
    try { before = readFileSync(path, 'utf8'); } catch { /* new tape */ }
    const same = before === json;
    if (!same) changed++;
    if (!CHECK && !same) writeFileSync(path, json);
    // ⛔ THE BUDGET, MEASURED. `synthesizeLegs` already refused anything over
    // it; this prints the number for the ones that passed, because "how much
    // headroom is left" is the fact the next rung needs and a silent pass
    // does not carry it.
    const { spans, bytes } = assertTapeWithinRuntimeBudget(result.tape, spec.name);
    console.log(`${same ? 'same' : (CHECK ? 'DIFFERS' : 'wrote')} ${spec.name}: `
        + `${result.tape.tick_count} ticks, ${spec.legs.length} legs, `
        + `${result.transitions.length} transitions, ${result.grants.length} grants, `
        + `${result.collects.length} collect(s), ${result.spears.length} spear(s), `
        + `${result.keylocks.length} keylock(s), ${result.equips.length} equip(s), `
        + `${result.grazes.length} graze(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`     BUDGET ${spans}/${TAPE_BUDGET.spans} spans, `
        + `${(bytes / 1024).toFixed(1)}/${(TAPE_BUDGET.bytes / 1024).toFixed(0)} KB `
        + `(${Math.round((bytes / TAPE_BUDGET.bytes) * 100)}% of the byte ceiling, `
        + `${Math.round((spans / TAPE_BUDGET.spans) * 100)}% of the span one)`);
    result.collects.forEach((c) => console.log(`    collect ${c.item ?? 'bosskey'} at `
        + `tick ${c.to} (${c.releases} release(s), ${c.ceremony} ceremony ticks)`));
    result.spears.forEach((s) => console.log(`    spear ${s.facing} at (${s.at.x},`
        + `${s.at.y}) tick ${s.pressTick} -> ${s.kind === 'block'
            ? `block ${s.id} ${s.destroys ? 'DESTROYED on its pit'
                : `to (${s.to.tx},${s.to.ty})`}` : `bridge ${s.id}`}`));
    result.keylocks.forEach((k) => console.log(`    keylock ${k.lock.id} at tick ${k.to} `
        + `(${k.window}-tick window, keyType ${k.keyType}, wrote persistence tag `
        + `${k.persistTag})`));
    result.equips.forEach((e) => console.log(`    equip slot ${e.slot} at tick ${e.t}`));
}

function describe(spec, result) {
    const items = Object.entries(result.inventory ?? {})
        .filter(([, v]) => v === true).map(([k]) => k);
    const collects = result.collects.length > 0
        ? `COLLECTS ${result.collects.map((c) => `${c.item ?? 'a boss key'} (${c.pickup.tag}@`
            + `${c.pickup.x},${c.pickup.y}, ${c.releases} release(s) over ${c.ceremony} `
            + 'ticks)').join('; ')}. `
        : '';
    const spears = result.spears.length > 0
        ? `PRESSES ${result.spears.map((s) => `${s.facing} at (${s.at.x},${s.at.y}) in `
            + `L${s.level}`).join('; ')}. `
        : '';
    const keylocks = result.keylocks.length > 0
        ? `OPENS ${result.keylocks.map((k) => `${k.lock.tag}@${k.lock.x},${k.lock.y} with `
            + `BossKey ${k.keyType} over ${k.window} ticks, which writes `
            + `setPersistence(${k.persistTag}, false)`).join('; ')}. `
        : '';
    return (spec.segment === null
        ? 'THE HEADLINE R4 WALK, synthesized by botDriverV2 from the committed route '
        + `(fixtures/r4-route.json), with LAVA AND ICE ARMED: noHazards is `
        + `[${R4_NO_HAZARDS.map((h) => `"${h}"`).join(', ')}], so a lava tile is a wall `
        + 'and R3\'s whole Dungeon 7 tail is gone. grants EMPTY, every item walked onto '
        + `and talked through, and hitsMax ends at ${R4_HITS_MAX} — the first POSITIVE `
        + 'health claim on the ladder. '
        : `R4 walk SEGMENT ${spec.segment} of 6, synthesized by botDriverV2 from legs `
        + `${spec.firstLeg}-${spec.lastLeg} of the committed route `
        + '(fixtures/r4-route.json). '
        + (spec.inherited.length > 0
            ? `It boots where segment ${spec.segment - 1} ended and inherits `
            + `${spec.inherited.join(', ')} in a single grant entry at the boot level, `
            + 'which fires on tick 0'
            + (spec.inheritsEquip ? ', with slot 1 selected on the same tick. ' : '. ')
            : ''))
        + `${spec.legs.length} legs across `
        + `${new Set(spec.legs.map((l) => l.level)).size} level(s), `
        + `${result.transitions.length} crossings. `
        + `${collects}${spears}${keylocks}`
        + `Ends holding [${items.join(', ') || 'nothing'}] with hitsMax `
        + `${result.inventory?.hitsMax}.`;
}

if (failed > 0) process.exitCode = 1;
if (CHECK && changed > 0) process.exitCode = 1;
