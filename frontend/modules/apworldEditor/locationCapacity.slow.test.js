/**
 * THE DECLARED CAPACITY AGREES WITH THE REALISER, OVER THE COMMITTED SLOTS
 * (APWORLD SUBSTRATE CHANGE C2).
 *
 * ⛓ The population is DERIVED: every tracked `frontend/presets/**_rules.json`
 * that is a classic document (no `preset_sidecars` entry — nothing realised yet),
 * every player slot of it, Initialised as maze at the form's defaults. No game,
 * preset or room is named.
 *
 * ⛓ The two sides of the relation come from two different places:
 *   · DECLARED — `planInitialise`'s `grown` (the Initialise form's own numbers,
 *     `topDownRoomSizes` over the maze entry's `locationCapacity`): the grow
 *     steps above the region size each room will be built at;
 *   · REALISED — the SAME Initialise with the declaration taken off the maze
 *     entry (so the realiser starts every room at the region size, as before
 *     C2, and re-rolls/grows until the locations fit): the grow steps each room
 *     actually took, read off the realiser's own `generateRegionCore` calls
 *     (first call's size → last call's size; a room whose first call was
 *     already bigger grew for its EXITS inside the core — the perimeter, not the
 *     floor — and is counted apart).
 *
 * ⛓ THE RELATION, WITH ITS MEASURED SLACK (C2 §45.0): the realiser's layout is
 * a random draw and the declaration is its percolation threshold, so they
 * agree exactly on almost every room and differ by a step on a few. Measured at
 * C2 over this population (180 slots, 1 refused for its exits; 11,442 rooms, 17
 * of which the realiser grew, 2 exit-grown apart): 11,422 exact (99.83 %),
 * +1 on 17, +2 on 1, −1 on 2. `SLACK` is that range and `EXACT_SHARE` a floor
 * under that share. ≈25 s, hence the slow tier. Mutants (restored from a copy,
 * C2): `sizeForLocations` one step too large → +3 on one room (red on SLACK);
 * one step too small → −2 on two rooms (red on SLACK).
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGION_GROW_STEP } from '../shared/procgen/spatialPrimitives.js';
import { initialiseSlot, planInitialise, INITIALISE_SIZE_KEYS } from './slotInitialise.js';

const SLACK = Object.freeze({ below: -1, above: 2 });
const EXACT_SHARE = 0.99;
const SUBSTRATE = 'maze';
const BAG = Object.freeze({ [INITIALISE_SIZE_KEYS.width]: 8, [INITIALISE_SIZE_KEYS.height]: 6 });

function population() {
    const files = execFileSync('git', ['ls-files', 'frontend/presets/*_rules.json'], { encoding: 'utf-8' })
        .split('\n').filter(Boolean);
    const out = [];
    for (const f of files) {
        const doc = JSON.parse(readFileSync(f, 'utf-8'));
        // ⛔ `{}` / `{"1": {}}` is a classic document too: realised means an ENTRY.
        if (Object.values(doc.preset_sidecars ?? {}).some((m) => m && Object.keys(m).length)) continue;
        for (const [player, regions] of Object.entries(doc.regions ?? {})) {
            if (regions && typeof regions === 'object' && Object.keys(regions).length) out.push({ f, player });
        }
    }
    return out;
}

/** The realiser's own grow steps per room, the declaration taken off the entry. */
function realisedSteps(doc, player) {
    const entry = substrateRegistry.get(SUBSTRATE);
    const calls = new Map();
    const legacy = {
        ...entry,
        locationCapacity: undefined,
        generateRegionCore: (input) => {
            const out = entry.generateRegionCore(input);
            if (!calls.has(input.region_id)) calls.set(input.region_id, []);
            calls.get(input.region_id).push({ req: { ...input.size }, used: { width: out.world.width, height: out.world.height } });
            return out;
        },
    };
    substrateRegistry.entries.set(SUBSTRATE, legacy);
    let res;
    try {
        res = initialiseSlot({ doc: structuredClone(doc), player, substrate: SUBSTRATE, bag: { ...BAG } });
    } finally {
        substrateRegistry.entries.set(SUBSTRATE, entry);
    }
    return { ok: res.ok, why: res.ok ? null : String(res.why), calls };
}

describe('the maze location capacity agrees with the realiser over the committed slots', () => {
    it('⛓ declared grow steps − realised grow steps ∈ SLACK on every room; exact on ≥ EXACT_SHARE', () => {
        const slots = population();
        expect(slots.length).toBeGreaterThan(0);
        let rooms = 0; let exact = 0; let exitGrown = 0; let grownRooms = 0;
        const outside = [];
        const refused = [];
        const histogram = {};
        for (const { f, player } of slots) {
            const doc = JSON.parse(readFileSync(f, 'utf-8'));
            const plan = planInitialise(doc, player, { substrate: SUBSTRATE, bag: { ...BAG } });
            const declared = new Map(plan.grown.map((g) => [g.region, g.steps]));
            const { ok, why, calls } = realisedSteps(doc, player);
            // ⛓ a slot the realiser REFUSES (e.g. more exits than the core's
            // perimeter budget) is outside the relation — counted, and a
            // location-fit refusal is named (that is the capacity's business).
            if (!ok) {
                refused.push(`${f} p${player}: ${why}`);
                continue;
            }
            for (const [region, list] of calls) {
                const first = list[0].used;
                const last = list.at(-1).used;
                if (first.width !== plan.regionSize.width || first.height !== plan.regionSize.height) {
                    exitGrown++;
                    continue;
                }
                const actual = (last.width - first.width) / REGION_GROW_STEP;
                const d = (declared.get(region) ?? 0) - actual;
                rooms++;
                if (actual > 0) grownRooms++;
                histogram[d] = (histogram[d] ?? 0) + 1;
                if (d === 0) exact++;
                if (d < SLACK.below || d > SLACK.above) outside.push(`${f} p${player} ${region}: declared ${declared.get(region) ?? 0}, realised ${actual}`);
            }
        }
        expect(refused.filter((r) => /could not place all/.test(r))).toEqual([]);
        // ⛓ coverage: the population must hold rooms that GREW, or the relation is vacuous.
        expect(grownRooms, JSON.stringify(histogram)).toBeGreaterThan(0);
        expect(outside, JSON.stringify(histogram)).toEqual([]);
        const summary = `slots ${slots.length} (refused ${refused.length}), rooms ${rooms} (grew ${grownRooms}), `
            + `exact ${exact}, exit-grown ${exitGrown}, ${JSON.stringify(histogram)}`;
        console.info(`locationCapacity agreement: ${summary}`);
        expect(exact / rooms, summary)
            .toBeGreaterThanOrEqual(EXACT_SHARE);
    }, 600_000);
});
