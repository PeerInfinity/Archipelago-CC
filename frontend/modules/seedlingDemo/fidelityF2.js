/**
 * seedlingDemo/fidelityF2 — **ONE DERIVATION OF THE F2 APITEM CASES**, shared
 * by the game probe (`scripts/procgen/probe-seedling-f2-apitem.mjs`) and the
 * node rows (`fidelityF2.test.js`), so the tape the game played and the tape
 * the rows replay are one tape.
 *
 * A case is a committed generated preset's start room: the set as the game
 * mounts it (`wasmWalkTape.mountedRecordsOf`, the JS page's own derivation),
 * a fresh staging at the set's start with the JS runtime's flags and pins,
 * and the solver's `collect-placement` at the room's apitem, which resolves
 * as strategy `apitem` (seedling fidelity F2, D1a).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { bootStaging } from './procgenOracle.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { JS_RUNTIME_PINS } from './jsRuntimeCore.js';
import { createRunForStaging } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';

/** Every item flag at its base: the JS runtime's fresh boot (`wasmWalkTape.test.js`'s FLAGS). */
const BASE_FLAGS = Object.freeze(Object.fromEntries(Object.values(ITEM_PROPERTIES)
    .map((s) => [s.property, s.kind === 'add' ? s.base : false])));

/** The staging a fresh JS-runtime boot at `{level, x, y}` carries. */
export const f2StagingAt = ({ level, x, y }) => bootStaging({
    boot: { level, x, y }, items: { ...BASE_FLAGS }, pins: [...JS_RUNTIME_PINS],
});

/** The preset's assembled set, its mounted records and their level source. */
export function f2Preset(repoRoot, preset) {
    const rules = JSON.parse(readFileSync(join(repoRoot, `frontend/presets/${preset}/AP_1/AP_1_rules.json`), 'utf8'));
    const assembled = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
    const records = mountedRecordsOf(assembled.set);
    return { assembled, set: assembled.set, records, levelSource: levelSourceFromAtlas(records) };
}

/**
 * The start room's apitem, solved. `expected[i]` is the model's row BEFORE
 * tape tick `i` (`{level, x, y}`), the shape the game's drained stream has.
 */
export function f2ApItemCase(repoRoot, preset) {
    const p = f2Preset(repoRoot, preset);
    const staging = f2StagingAt(p.set.start);
    const run = createRunForStaging(staging, p.levelSource, { scratchPersistence: true });
    const apItems = run.world.apItems;
    if (apItems.length !== 1) {
        throw new Error(`fidelityF2: ${preset}'s start room holds ${apItems.length} apitem(s); a case is one`);
    }
    const a = apItems[0];
    const out = solveSegment({
        run, goals: [{ kind: 'collect-placement', placement: { x: a.x, y: a.y } }],
        name: `f2-${preset}`, boot: staging.boot,
    });
    const rec = out.records.find((r) => r.strategy === 'apitem');
    const replay = createRunForStaging(staging, p.levelSource, { scratchPersistence: true });
    const expected = [{ level: replay.level, x: replay.state.x, y: replay.state.y }];
    for (const h of out.perTick) {
        replay.advance(h);
        expected.push({ level: replay.level, x: replay.state.x, y: replay.state.y });
    }
    return {
        ...p, preset, staging, out, perTick: out.perTick, takenAt: rec.takenAt, expected,
        apItem: { id: a.id, level: rec.level, tag: a.tag, x: a.x, y: a.y, rect: a.rect },
    };
}
