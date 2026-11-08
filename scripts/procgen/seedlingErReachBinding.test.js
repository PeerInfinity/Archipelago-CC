/**
 * ⛓ ER E4a — THE `reach` BINDING, PROVED ON VANILLA AP_1: E3's `randomizeEntrances` (the GER port) shuffles the
 * Seedling playthrough's shufflable STAIRS (⚖ Q1 stairs only, Q2 coupled only) through
 * `procgenPipeline/entranceRandomizationReach.makeRulesDocReach` over the committed
 * `frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json`, over a handful of seeds, and every result has E3's
 * properties. A TEST, not a preset: nothing is written (the mode, the classifier and the preset are E4b).
 *
 * THE BINDING (stated here because E4b's classifier will own it):
 *   - the doorways: the E1 census's stairs doorways (`seedlingErDoorCensus`), less its PINS (PIN-CHAIN: L0's
 *     stairsdown fired by the L110 pit chain, and its coupled reverse) → 25 pairs, 50 exits (26 − 1; the brief's
 *     "24 shufflable pairs" was 26 − 2 counted in doorways, not pairs);
 *   - an exit's NAME is the AP exit that carries it (`<from AP region> -> <to AP region>`, the compiler's name), when
 *     that AP exit carries nothing else; a stair that SHARES its AP exit with other links (L40's, merged with twelve
 *     screen-edge teleporters to L43) is named `<AP exit> [<doorway id>]` and the shared AP exit stays (E4b's compiler
 *     must split it before the mode can place it by an AP name — a FINDING);
 *   - its TARGET is named like the exit, in the exit's own AP region (GER's coupled contract): "placed at target E" =
 *     land where E's reverse lands, beside E (`placements[].target`, E4a's settled semantics). Every stair's arrival
 *     beside it is in its own departure AP region (asserted), so the GER contract holds;
 *   - groups: the census class; a `stairsdown` lands beside a `stairsup` and back (target_group_lookup);
 *   - the inventory: GER's single-player all-state (`allStateInventory`, events swept);
 *   - an exit's rule: its AP exit's compiled `access_rule`, kept as is. ⚠ That rule still holds the VANILLA landing's
 *     conjuncts (a rope lane, a pocket's event, a lethal landing): moving them with the landing is the producer's
 *     re-derivation over the shuffled doc (E4a's decoupling; the mode's regeneration is E4b).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const imp = (p) => import(pathToFileURL(path.join(REPO, p)));

const { randomizeEntrances, EntranceRandomizationError } = await imp('frontend/modules/procgenCore/entranceRandomizer.js');
const { rngFor } = await imp('frontend/modules/mazeRoom/procgenRng.js');
const { makeRulesDocReach } = await imp('frontend/modules/procgenPipeline/entranceRandomizationReach.js');
const C = await import('./census-seedling-er-doorways.mjs');
const K = await import('./seedlingErDoorCensus.js');

const SEEDS = [1, 2, 3, 4, 5, 6];
const LOOKUP = new Map([['stairsdown', ['stairsup']], ['stairsup', ['stairsdown']]]);

let rules;
let binding;
let reach;
let vanilla;
const timings = [];

function bind(inp, census) {
    const atlas = inp.atlas;
    const regionById = new Map(atlas.regions.map((r) => [r.region_id, r]));
    const exitOf = (rid, eid) => (regionById.get(rid)?.exits ?? []).find((e) => e.exit_id === eid);
    const apOf = (end) => inp.apRegionName(end[0], exitOf(end[0], end[1])?.sub_region ?? null);
    const connOf = (id) => {
        const [l, e] = id.split(':');
        return atlas.vanilla_layout.connections.find((x) => x.from[0] === `level_${l.slice(1)}` && x.from[1] === e);
    };
    const carriedBy = new Map();
    for (const c of atlas.vanilla_layout.connections) {
        const k = `${apOf(c.from)} -> ${apOf(c.to)}`;
        carriedBy.set(k, (carriedBy.get(k) ?? 0) + 1);
    }
    const pinned = new Set(census.pins.map((p) => p.doorway));
    const R1 = rules.regions['1'];
    const stairs = census.doorwayList.filter((d) => K.IN_SCOPE_CLASSES.includes(d.cls) && !pinned.has(d.id));
    const rows = stairs.map((d) => {
        const c = connOf(d.id);
        const region = apOf(c.from);
        const apName = `${region} -> ${apOf(c.to)}`;
        const ap = R1[region]?.exits.find((e) => e.name === apName);
        if (!ap) throw new Error(`${d.id}: no AP exit ${apName}`);
        const alone = carriedBy.get(apName) === 1;
        return {
            doorway: d, region, apName, alone, arrivalRegion: apOf(connOf(d.reverse).to), vanillaTo: ap.connected_region,
            name: alone ? apName : `${apName} [${d.id}]`, access_rule: ap.access_rule ?? { rule: 'True_' },
        };
    });
    const byDoorway = new Map(rows.map((r) => [r.doorway.id, r]));
    for (const r of rows) r.reverse = byDoorway.get(r.doorway.reverse)?.name ?? null;
    return { rows, pinned: [...pinned].sort() };
}

function inputsFor(seed) {
    const exits = binding.rows.map((r) => ({ name: r.name, region: r.region, type: 'two_way', group: r.doorway.cls }));
    const targets = binding.rows.map((r) => ({ name: r.name, region: r.region, type: 'two_way', group: r.doorway.cls }));
    const removed = new Set(binding.rows.filter((r) => r.alone).map((r) => `${r.region}|${r.apName}`));
    const fixedEdges = [];
    const progressionRegions = new Set();
    for (const [name, region] of Object.entries(rules.regions['1'])) {
        for (const e of region.exits ?? []) if (!removed.has(`${name}|${e.name}`)) fixedEdges.push({ from: name, to: e.connected_region });
        if ((region.locations ?? []).some((l) => l.item?.advancement === true)) progressionRegions.add(name);
    }
    return { exits, targets, fixedEdges, progressionRegions, reach, rng: rngFor(seed), coupled: true, targetGroupLookup: LOOKUP };
}

beforeAll(async () => {
    rules = JSON.parse(readFileSync(path.join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
    const inp = await C.loadCensusInputs();
    binding = bind(inp, K.censusErDoorways(inp));
    reach = makeRulesDocReach(rules, { shuffled: binding.rows.map((r) => ({ name: r.name, region: r.region, access_rule: r.access_rule, carrier: r.alone ? r.apName : null })) });
    // VANILLA through the binding: every stair placed at its own target (it lands where it always did).
    const byName = new Map(binding.rows.map((r) => [r.name, r]));
    vanilla = reach(binding.rows.map((r) => ({ exit: r.name, from: r.region, to: byName.get(r.reverse).region })));
}, 300_000);

describe('the binding over AP_1', () => {
    it('25 shufflable pairs: the 26 stairs pairs less the PIN-CHAIN pair; every stair\'s beside-arrival is in its own AP region', () => {
        expect(binding.pinned).toEqual(['L0:out_stairsdown_256_272', 'L2:out_stairsup_48_16']);
        expect(binding.rows).toHaveLength(50);
        expect(binding.rows.every((r) => r.reverse !== null)).toBe(true);
        expect(binding.rows.filter((r) => r.arrivalRegion !== r.region).map((r) => r.doorway.id)).toEqual([]);
        // a vanilla placement lands each stair where its AP exit always led
        const byName = new Map(binding.rows.map((r) => [r.name, r]));
        expect(binding.rows.filter((r) => byName.get(r.reverse).region !== r.vanillaTo).map((r) => r.doorway.id)).toEqual([]);
    });
    it('FINDING: one stair shares its AP exit with other links (E4b\'s compiler must split it)', () => {
        expect(binding.rows.filter((r) => !r.alone).map((r) => `${r.doorway.id} in ${r.apName}`))
            .toEqual(['L40:out_stairsdown_320_576 in level_40__r23c29 -> level_43__r13c7']);
    });
    it('vanilla through the binding reaches what the undisconnected document reaches', () => {
        const plain = makeRulesDocReach(rules, { shuffled: [] })([]);
        expect([...vanilla.regions].sort()).toEqual([...plain.regions].sort());
        expect([...vanilla.locations].sort()).toEqual([...plain.locations].sort());
    });
});

describe('randomizeEntrances over the binding: E3\'s properties', () => {
    for (const seed of SEEDS) {
        it(`seed ${seed}`, () => {
            const input = inputsFor(seed);
            const t0 = performance.now();
            let result;
            try {
                result = randomizeEntrances(input);
            } catch (err) {
                if (err instanceof EntranceRandomizationError) throw new Error(`seed ${seed} refused: ${err.message} ${JSON.stringify({ ...err.details, placements: err.details.placements?.length })}`);
                throw err;
            }
            const ms = performance.now() - t0;
            timings.push({ seed, ms });
            const exitBy = new Map(input.exits.map((e) => [e.name, e]));
            const targetBy = new Map(input.targets.map((t) => [t.name, t]));
            // a bijection
            const exitN = new Map();
            const targetN = new Map();
            for (const p of result.placements) {
                exitN.set(p.exit, (exitN.get(p.exit) ?? 0) + 1);
                targetN.set(p.target, (targetN.get(p.target) ?? 0) + 1);
            }
            expect(input.exits.filter((e) => exitN.get(e.name) !== 1).map((e) => e.name)).toEqual([]);
            expect(input.targets.filter((t) => targetN.get(t.name) !== 1).map((t) => t.name)).toEqual([]);
            // group-legal (a stairsdown lands beside a stairsup) and coupled (A→B ⇒ B→A)
            const pairs = new Set(result.placements.map((p) => `${p.exit}\u0001${p.target}`));
            for (const p of result.placements) {
                expect(LOOKUP.get(exitBy.get(p.exit).group)).toContain(targetBy.get(p.target).group);
                expect(pairs.has(`${p.target}\u0001${p.exit}`)).toBe(true);
            }
            // fully reachable: everything vanilla reaches under the all-state, the shuffled layout reaches too
            const after = reach(result.placements.map((p) => ({ exit: p.exit, from: exitBy.get(p.exit).region, to: targetBy.get(p.target).region })));
            expect([...vanilla.regions].filter((r) => !after.regions.has(r))).toEqual([]);
            expect([...vanilla.locations].filter((l) => !after.locations.has(l))).toEqual([]);
            // not the identity (vanilla = every stair placed at its own reverse)
            expect(result.placements.some((p) => binding.rows.find((r) => r.name === p.exit).reverse !== p.target)).toBe(true);
        }, 300_000);
    }
    it('deterministic per seed, and seed-sensitive', () => {
        const a = randomizeEntrances(inputsFor(1)).placements;
        const b = randomizeEntrances(inputsFor(1)).placements;
        const c = randomizeEntrances(inputsFor(2)).placements;
        expect(b).toEqual(a);
        expect(c).not.toEqual(a);
        // the time per run, for the report
        console.log(`[E4a] randomizeEntrances over AP_1 (50 stairs exits): ${timings.map((t) => `seed ${t.seed} ${t.ms.toFixed(0)} ms`).join(', ')}`);
    }, 300_000);
});
