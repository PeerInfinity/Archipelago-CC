#!/usr/bin/env node
/**
 * Synthesize the R1 walk tapes from the committed route.
 *
 * Region-atlas Phase 8, rung R1 slice 4. This writes TAPES (inputs), never
 * expectations: an expectation is an oracle recording and only
 * `verify-seedling-bot-differential.mjs --record` may write one.
 *
 *   node frontend/modules/seedlingDemo/fixtures/regenerate-r1-tapes.mjs
 *   node .../regenerate-r1-tapes.mjs --only=r1-walk-4-torch      # one of them
 *   node .../regenerate-r1-tapes.mjs --check                     # write nothing
 *
 * ⚠ The tapes are DERIVED, so re-running this after a geometry, pricing or
 * physics change is how you find out that the route no longer walks — the
 * driver throws by name (a planner bug, an unasked crossing, an undeclared
 * contact) rather than emitting a tape that quietly goes somewhere else.
 * A tape that CHANGES here needs its oracle recording re-recorded; that is
 * the whole cost of a re-route and the reason the route is committed.
 *
 * `--check` is what CI-shaped callers want: it re-emits every tape and
 * compares against what is on disk without writing, so "the driver still
 * emits the committed tapes" is answerable without a dirty tree. The vitest
 * suite asserts the same thing.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { synthesizeLegs } from '../botDriverV2.js';
import { atlasLevelSource } from '../levelSource.js';
import { serializeTape } from '../tapeFormat.js';
import { r1TapeSpecs } from '../r1Walk.js';
import { TAPES_DIR } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = JSON.parse(readFileSync(join(HERE, 'r1-route.json'), 'utf8'));

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

for (const spec of r1TapeSpecs(ROUTE)) {
    if (ONLY.size > 0 && !ONLY.has(spec.name)) continue;
    const t0 = Date.now();
    let result;
    try {
        result = synthesizeLegs(spec.legs, {
            levelSource,
            boot: spec.boot,
            name: spec.name,
            relax: spec.relax,
            extraVolumes: spec.extraVolumes,
            maxTicksPerTarget: spec.maxTicksPerTarget,
        });
    } catch (e) {
        console.log(`FAIL ${spec.name}: ${e.message}`);
        failed++;
        continue;
    }
    const json = serializeTape({
        ...result.tape,
        description: describe(spec, result),
    });
    const path = join(TAPES_DIR, `${spec.name}.json`);
    let before = null;
    try { before = readFileSync(path, 'utf8'); } catch { /* new tape */ }
    const same = before === json;
    if (!same) changed++;
    if (!CHECK && !same) writeFileSync(path, json);
    console.log(`${same ? 'same' : (CHECK ? 'DIFFERS' : 'wrote')} ${spec.name}: `
        + `${result.tape.tick_count} ticks, ${spec.legs.length} legs, `
        + `${result.transitions.length} transitions, ${result.grants.length} grants, `
        + `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function describe(spec, result) {
    const items = Object.entries(result.inventory ?? {})
        .filter(([, v]) => v === true).map(([k]) => k);
    return (spec.segment === null
        ? 'THE HEADLINE R1 WALK, synthesized by botDriverV2 from the committed route '
        + '(fixtures/r1-route.json). '
        : `R1 walk SEGMENT ${spec.segment} of 6, synthesized by botDriverV2 from legs `
        + `${spec.firstLeg}-${spec.lastLeg} of the committed route `
        + '(fixtures/r1-route.json). '
        + (spec.inherited.length > 0
            ? `It boots where segment ${spec.segment - 1} ended and inherits `
            + `${spec.inherited.join(', ')} in a single grant entry at the boot level, `
            + 'which fires on tick 0. '
            : ''))
        + `${spec.legs.length} legs across `
        + `${new Set(spec.legs.map((l) => l.level)).size} level(s), `
        + `${result.transitions.length} crossings of which `
        + `${spec.legs.filter((l) => l.exit?.pit).length} are pit falls. `
        + `Ends holding ${items.join(', ') || 'nothing'}`
        + `${result.inventory ? `, hitsMax ${result.inventory.hitsMax}` : ''}. `
        + 'Regenerate with fixtures/regenerate-r1-tapes.mjs; the route is the artifact '
        + 'and this tape is derived from it.';
}

console.log(`\n${changed} tape(s) ${CHECK ? 'differ from disk' : 'written'}`
    + `${failed > 0 ? `, ${failed} FAILED` : ''}`);
process.exit(failed > 0 || (CHECK && changed > 0) ? 1 : 0);
