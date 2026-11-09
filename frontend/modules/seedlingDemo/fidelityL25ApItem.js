/**
 * seedlingDemo/fidelityL25ApItem — **ONE DERIVATION OF THE L25 AP-CHEST WITNESS** (seedling fidelity L25APITEM),
 * shared by the game probe (`scripts/procgen/probe-seedling-l25-apitem.mjs`) and the node rows
 * (`fidelityL25ApItem.test.js`), so the tape and the rooms the game played are the ones the rows replay.
 *
 *   · the DELIVERED set: the randomizer's own pipeline (`seedlingRandomizerWiring`): `vanillaRecordSet` →
 *     `buildPlacementTable` (the playthrough's seed-1 placement, read off its `_rules.json`) → `rewriteRecordSet`.
 *     L25's one location is its chest, so its room holds `apitem@96,96` (tag 0) where the vanilla set has
 *     `chest@96,96`. The VANILLA set is the control.
 *   · the TAPE: the route survey's own step-34 solve with `apChestItem` ON (`fixtures/l25apitem-witness/
 *     step34-on.tape.json`, copied from `.cache/seedling-survey/through-end/views/step-34-walk.json`): boot
 *     L25 (128,32) from the staged `r8-solve-11` block, the chest taken, out by `teleporter@144,32` → L22.
 *   · the REPLAY: the model's row BEFORE each tape tick (`{level, x, y}`, the game's drained shape), and the tick
 *     the game's contact rule takes the apitem (`solverBot.apItemTakenOnTick`, the solver's own call shape).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vanillaRecordSet } from './levelSetExporter.js';
import { buildPlacementTable, rewriteRecordSet } from './apPlacementRewriter.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { parseTape, heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { apItemTakenOnTick } from './solverBot.js';

export const L25_TAPE = 'frontend/modules/seedlingDemo/fixtures/l25apitem-witness/step34-on.tape.json';
export const L25_ORACLE = 'frontend/modules/seedlingDemo/fixtures/l25apitem-witness/oracle.json';
/** The chest's persistence slot: `chest@96,96 tag 0` in vanilla, the same tag on the delivered apitem. */
export const L25_SLOT = Object.freeze({ level: 25, tag: 0 });

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

/** Seed 1's placement, location name → `{name, player}` (`apPlacementRewriter.test.js`' reading of the rules). */
export function playthroughPlacement(rules) {
    const [slot] = Object.keys(rules.regions);
    const placed = new Map();
    for (const region of Object.values(rules.regions[slot])) {
        for (const loc of region.locations ?? []) {
            if (loc.event === true) continue;
            placed.set(loc.name, { name: loc.item.name, player: loc.item.player });
        }
    }
    return placed;
}

/** The vanilla and the delivered playthrough sets, and the level source each mounts as. */
export function l25Sets(root) {
    const MAP = readJson(root, 'frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson(root, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const rules = readJson(root, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
    const placed = playthroughPlacement(rules);
    const vanilla = vanillaRecordSet(EMBED, MAP).set;
    const { table } = buildPlacementTable({
        locationItemOf: (n) => placed.get(n) ?? null, ledger: R7_GOAL_LEDGER, rooms: MAP.levels,
        selfPlayer: 1, bossReport: true,
    });
    const delivered = rewriteRecordSet(vanillaRecordSet(EMBED, MAP).set, table).set;
    return {
        vanilla, delivered,
        vanillaSource: levelSourceFromAtlas(mountedRecordsOf(vanilla)),
        deliveredSource: levelSourceFromAtlas(mountedRecordsOf(delivered)),
    };
}

/** The committed survey tape, parsed. */
export const l25Tape = (root) => parseTape(readJson(root, L25_TAPE));

/** The tape cut to its first `n` ticks (inputs clipped), `hold` as asked. */
export function cutTape(tape, n, { hold = false } = {}) {
    const inputs = tape.inputs.filter((r) => r.from < n).map((r) => ({ ...r, to: Math.min(r.to, n) }));
    return parseTape({ ...tape, tick_count: n, inputs, ...(hold ? { tape_version: Math.max(tape.tape_version, 12), hold: true } : {}) });
}

/**
 * The model's replay of `tape` on `levelSource`: `rows[i]` = the row before tape tick `i` (`tick_count + 1` rows),
 * `takenAt` = the tick the apitem's contact fires (null if never), `apItems` = the boot room's list.
 */
export function l25Replay(tape, levelSource) {
    const run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true });
    const apItems = run.world.apItems ?? [];
    const rows = [{ level: run.level, x: run.state.x, y: run.state.y }];
    let taken = null;
    for (let t = 0; t < tape.tick_count; t++) {
        const pre = {
            level: run.level, x: run.state.x, y: run.state.y, inCeremony: Boolean(run.progress('inCeremony')),
            deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length,
        };
        run.advance(heldKeysAt(tape, t));
        if (taken === null && pre.level === L25_SLOT.level) {
            const a = apItemTakenOnTick(apItems, pre, {
                level: run.level, deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length,
            });
            if (a) taken = { t, id: a.id, tag: a.tag, at: { x: pre.x, y: pre.y } };
        }
        rows.push({ level: run.level, x: run.state.x, y: run.state.y });
    }
    return { rows, takenAt: taken?.t ?? null, taken, apItems, chestOpens: run.chestOpens ?? [] };
}
