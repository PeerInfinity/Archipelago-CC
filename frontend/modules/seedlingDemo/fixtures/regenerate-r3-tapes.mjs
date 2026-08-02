#!/usr/bin/env node
/**
 * Synthesize the R3 walk tapes from the committed route.
 *
 * Region-atlas Phase 8, rung R3 slice 6. This writes TAPES (inputs), never
 * expectations: an expectation is an oracle recording and only
 * `verify-seedling-bot-differential.mjs --record` may write one.
 *
 *   node frontend/modules/seedlingDemo/fixtures/regenerate-r3-tapes.mjs
 *   node .../regenerate-r3-tapes.mjs --only=r3-walk-4-spear      # one of them
 *   node .../regenerate-r3-tapes.mjs --check                     # write nothing
 *
 * ⚠ The tapes are DERIVED, so re-running this after a geometry, pricing or
 * physics change is how you find out that the route no longer walks — the
 * driver throws by name (a planner bug, an unasked crossing, an undeclared
 * contact, a hold that opened nothing) rather than emitting a tape that
 * quietly goes somewhere else. A tape that CHANGES here needs its oracle
 * recording re-recorded; that is the whole cost of a re-route and the
 * reason the route is committed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { synthesizeLegs } from '../botDriverV2.js';
import { atlasLevelSource } from '../levelSource.js';
import { serializeTape } from '../tapeFormat.js';
import { r3TapeSpecs } from '../r3Walk.js';
import { TAPES_DIR } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = JSON.parse(readFileSync(join(HERE, 'r3-route.json'), 'utf8'));

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

for (const spec of r3TapeSpecs(ROUTE)) {
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
    console.log(`${same ? 'same' : (CHECK ? 'DIFFERS' : 'wrote')} ${spec.name}: `
        + `${result.tape.tick_count} ticks, ${spec.legs.length} legs, `
        + `${result.transitions.length} transitions, ${result.grants.length} grants, `
        + `${result.collects.length} collect(s), ${result.touches.length} touch(es), `
        + `${result.holds.length} hold(s), ${result.grazes.length} graze(s), `
        + `${((Date.now() - t0) / 1000).toFixed(1)}s`);
    result.collects.forEach((c) => console.log(`    collect ${c.item} at tick ${c.to} `
        + `(${c.releases} release(s), ${c.ceremony} ceremony ticks)`));
    result.touches.forEach((t) => console.log(`    touch ${t.lock.id} at tick ${t.to} `
        + `(${t.window}-tick window, snapped to y ${t.snappedTo})`));
    result.holds.forEach((h) => console.log(`    hold ticks ${h.from}-${h.to} on `
        + `${h.presser.tag}@${h.presser.x},${h.presser.y} — opened ${h.opened.join(' ')}`));
}

function describe(spec, result) {
    const items = Object.entries(result.inventory ?? {})
        .filter(([, v]) => v === true).map(([k]) => k);
    const holds = result.holds.length > 0
        ? `Holds ${result.holds.map((h) => `${h.presser.tag}@${h.presser.x},${h.presser.y} `
            + `for ${h.ticks} ticks to open ${h.opened.join('+')}`).join('; ')}. `
        : '';
    const collects = result.collects.length > 0
        ? `COLLECTS ${result.collects.map((c) => `${c.item} (${c.pickup.tag}@`
            + `${c.pickup.x},${c.pickup.y}, ${c.releases} release(s) over ${c.ceremony} `
            + 'ticks)').join('; ')}. `
        : '';
    const touches = result.touches.length > 0
        ? `TOUCHES ${result.touches.map((t) => `${t.lock.tag}@${t.lock.x},${t.lock.y} `
            + `with Player.${t.shield}, snapping to y ${t.snappedTo} and refusing input `
            + `for ${t.window} ticks, which writes setPersistence(${t.persistTag}, `
            + 'false)').join('; ')}. `
        : '';
    return (spec.segment === null
        ? 'THE HEADLINE R3 WALK, synthesized by botDriverV2 from the committed route '
        + '(fixtures/r3-route.json), with the CRUTCHES OFF: grants EMPTY, every item walked onto and talked through, one blocker opened by hand. '
        : `R3 walk SEGMENT ${spec.segment} of 6, synthesized by botDriverV2 from legs `
        + `${spec.firstLeg}-${spec.lastLeg} of the committed route `
        + '(fixtures/r3-route.json). '
        + (spec.inherited.length > 0
            ? `It boots where segment ${spec.segment - 1} ended and inherits `
            + `${spec.inherited.join(', ')} in a single grant entry at the boot level, `
            + 'which fires on tick 0. '
            : ''))
        + `${spec.legs.length} legs across `
        + `${new Set(spec.legs.map((l) => l.level)).size} level(s), `
        + `${result.transitions.length} crossings of which `
        + `${spec.legs.filter((l) => l.exit?.pit).length} are pit falls. `
        + `${collects}`
        + `${touches}`
        + `${holds}`
        + `${spec.relax.persistence.length} persistence clear(s) applied before the `
        + 'first live tick. '
        + `Ends holding ${items.join(', ') || 'nothing'}`
        + `${result.inventory ? `, hitsMax ${result.inventory.hitsMax}` : ''}. `
        + 'Regenerate with fixtures/regenerate-r3-tapes.mjs; the route is the artifact '
        + 'and this tape is derived from it.';
}

console.log(`\n${changed} tape(s) ${CHECK ? 'differ from disk' : 'written'}`
    + `${failed > 0 ? `, ${failed} FAILED` : ''}`);
process.exit(failed > 0 || (CHECK && changed > 0) ? 1 : 0);
