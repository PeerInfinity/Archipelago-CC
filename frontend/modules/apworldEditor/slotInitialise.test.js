/**
 * apworldEditor/slotInitialise — **A BARE SLOT'S PROCGEN DATA, BUILT IN PLACE:
 * THE ROWS** (APWORLD SUBSTRATE CHANGE R7; plan §19). The module
 * (`slotInitialise.js`) and its op (`initialise-procgen-layout`, asked of the OP
 * through `applyRulesDocOp`), on the committed classic documents the plan probed
 * — read-only: no fixture is written.
 *
 * ⛓⛓ Every count is DERIVED from the documents, the layout or the registry at
 * run time. `alttp_worldgen` (239 regions, ≈2 s) is initialised ONCE and shared;
 * `pokemon_rb` (445 regions, ≈41 s of realise) is asked for its LAYOUT only —
 * its whole-slot timing is a measurement quoted in the plan (§20), not a row.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createEditSession, foldEdits } from '../procgenCore/editCore.js';
import {
    TOPDOWN_START_REFUSALS, computeSourceCounts, layoutTopDown, resolveTopDownStart,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { createRng } from '../shared/rng.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { sidecarIssues } from './sidecarIssues.js';
import { validateRules } from './rulesUtils.js';
import { freeItemsFor, regionRealiserKind, regionSizeFor } from './regionRegenerate.js';
import { GRANTED_ITEM_FIRST_ID, buildTopDownEnvelope, runTopDownToStep } from '../procgenPipeline/topDownSteps.js';
import { regionsOf, startRegionsOf } from '../procgenCore/rulesGraph.js';
import {
    INITIALISE_BARE_ONLY, INITIALISE_RETURN_EXITS_ADDED, INITIALISE_RETURN_EXITS_OFF,
    INITIALISE_RULES_UNCHANGED, INITIALISE_UNPLACED, REGENERATE_SEED_REQUIRED, RULES_OP_KINDS,
    GRANTED_AS_STARTING, applyRulesDocOp, canonicalPlacementIssues, describeInitialise, grantsClause,
    initialiseOpRefusal, INITIALISE_LOOP_MODE_ON, INITIALISE_MANA_ON_EVERY_PAYLOAD, initialiseFailureSentence,
    initialiseSphereLogRefusal, loopModeClause,
} from './rulesDocOps.js';
import { VALID_REGION_XP_EFFECTS, generateLoopCosts } from '../shared/procgen/loopCostGenerator.js';
import { startingNeedRows } from './startingInventoryBlock.js';
import {
    BACK_EXITS, DEFAULT_SUBSTRATE_ID, INITIALISE_BLOCKERS, INITIALISE_DRIVER, INITIALISE_GRID_GROWTH_LIMIT,
    INITIALISE_OP, UNPLACED_WHY, autoGridSide, initialiseFacts, initialiseGridSide, initialiseKnobs, initialiseOpFor,
    initialiseSlot, initialiseTargets, planInitialise, unplacedRegions,
    INITIALISE_SIZE_KEYS, initialiseRegionSize,
    DEFAULT_REGION_XP_EFFECT, INITIALISE_STAGES, INITIALISE_XP_EFFECTS, SPHERE_LOG_SOURCE, initialiseLoopCosts,
    initialiseSphereLog,
} from './slotInitialise.js';
import { assembleRegionParams } from '../procgenPipeline/sphereConfigHooks.js';
import { effectiveHazardOpts } from '../procgenPipeline/presetRun.js';
import { REGION_GEOMETRY, geometryOf } from '../procgenCore/regionGeometry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const read = (rel) => JSON.parse(readFileSync(join(PRESETS, rel), 'utf8'));
const bytes = (o) => JSON.stringify(o);
const seed1 = (game) => `${game}/AP_14089154938208861744/AP_14089154938208861744_rules.json`;
const P = '1';

/** ⛓ The plan's probed documents (§19), with the substrate each was probed as. */
const PROBED = [
    ['adventure', DEFAULT_SUBSTRATE_ID],
    ['bakingadventure', 'text_adventure'],
    ['apcalc', DEFAULT_SUBSTRATE_ID],
];
const DOCS = Object.fromEntries([...PROBED.map(([g]) => g), 'alttp_worldgen', 'pokemon_rb']
    .map((g) => [g, read(seed1(g))]));
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');

/** ⛓ `doc` with an initialise's result written the way the op writes it — for
 *  the report rows that must not depend on the op (a COPY; the input is kept). */
function withResult(doc, res, { addExits = true } = {}) {
    const copy = JSON.parse(JSON.stringify(doc));
    copy.preset_sidecars = { ...(copy.preset_sidecars ?? {}), [P]: res.entries };
    copy.procgen_metadata = { ...(copy.procgen_metadata ?? {}), [P]: res.procgen_metadata };
    if (addExits) for (const { region, exit } of res.returnExits) copy.regions[P][region].exits.push(exit);
    return copy;
}
const errorsOf = (doc) => sidecarIssues(doc, P).filter((i) => i.severity === 'error');

/** ⛓ The incoming exits of every region, from the DOCUMENT (the rows' own derivation). */
function incomingOf(doc) {
    const out = new Map();
    for (const [from, r] of Object.entries(doc.regions[P])) {
        for (const e of r.exits ?? []) {
            if (e.connected_region === from) continue;
            if (!out.has(e.connected_region)) out.set(e.connected_region, new Set());
            out.get(e.connected_region).add(from);
        }
    }
    return out;
}

const cache = new Map();
/** ⛓ One initialise per (document, substrate, backExits) — shared by the rows. */
function initialised(game, substrate, backExits = BACK_EXITS.ADD) {
    const key = `${game}|${substrate}|${backExits}`;
    if (!cache.has(key)) cache.set(key, initialiseSlot({ doc: DOCS[game], player: P, substrate, backExits }));
    return cache.get(key);
}

describe('which slots can be initialised (initialiseFacts)', () => {
    it('⛓ a classic document\'s slot is BARE and has no blocker; a slot with entries is blocked', () => {
        for (const [game] of PROBED) {
            const f = initialiseFacts(DOCS[game], P);
            expect(f.bare, game).toBe(true);
            expect(f.blocker, game).toBeNull();
            expect(f.regions, game).toBe(Object.keys(DOCS[game].regions[P]).length);
        }
        for (const p of Object.keys(FOUR.regions)) {
            const f = initialiseFacts(FOUR, p);
            expect(f.bare).toBe(false);
            expect(f.entries).toBe(Object.keys(FOUR.preset_sidecars[p]).length);
            expect(f.blocker).toBe(INITIALISE_BLOCKERS.HAS_ENTRIES);
        }
    });

    it('⛓ no regions / no usable start / the SLOT\'s metadata block — each its own blocker (P1a: another slot\'s is not)', () => {
        const doc = JSON.parse(JSON.stringify(DOCS.adventure));
        expect(initialiseFacts(doc, '7').blocker).toBe(INITIALISE_BLOCKERS.NO_REGIONS);
        const noStart = JSON.parse(JSON.stringify(doc));
        noStart.start_regions[P] = ['Nowhere'];
        expect(initialiseFacts(noStart, P).blocker).toBe(INITIALISE_BLOCKERS.NO_START);
        const meta = JSON.parse(JSON.stringify(doc));
        meta.procgen_metadata = { [P]: { driver: 'top-down' } };
        expect(initialiseFacts(meta, P).blocker).toBe(INITIALISE_BLOCKERS.HAS_METADATA);
        const other = JSON.parse(JSON.stringify(doc));
        other.procgen_metadata = { 2: { driver: 'top-down' } };
        expect(initialiseFacts(other, P).blocker).toBeNull();
    });

    it('⛔ M3 — two declared starts: MULTI_START (before NO_START); the op refuses by name, the engine throws by name', () => {
        const twoStarts = (starts) => {
            const doc = JSON.parse(JSON.stringify(DOCS.apcalc));
            doc.start_regions[P] = { default: starts, available: [] };
            return doc;
        };
        const doc = twoStarts(['C', 'A']);
        const f = initialiseFacts(doc, P);
        expect(f.blocker).toBe(INITIALISE_BLOCKERS.MULTI_START);
        expect(f.declaredStarts).toEqual(['C', 'A']);
        expect(f.bare).toBe(true);
        // ⛓ precedence: a list of two is the refusal even when the second is not a region.
        expect(initialiseFacts(twoStarts(['C', 'Nowhere']), P).blocker).toBe(INITIALISE_BLOCKERS.MULTI_START);
        const args = { player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: { width: 12, height: 12 }, seed: 1, backExits: 'add' };
        const refusal = initialiseOpRefusal(doc, args);
        expect(refusal).toContain('declares 2 start regions');
        expect(refusal).toContain('"C", "A"');
        const res = applyRulesDocOp(doc, { op: INITIALISE_OP, ...args });
        expect(res.ok).toBe(false);
        expect(res.error).toBe(refusal);
        // ⛓ the engine's own refusal, read by the plan (the op never reaches it).
        const plan = planInitialise(doc, P, args);
        expect(plan.ok).toBe(false);
        expect(plan.threw).toBe(TOPDOWN_START_REFUSALS.multiStart(2));
        // ⛓ one declared start is not refused (the probed apcalc itself).
        expect(initialiseFacts(DOCS.apcalc, P).declaredStarts).toEqual(['C']);
        expect(initialiseOpRefusal(DOCS.apcalc, args)).toBeNull();
    });

    it('⛓ the resolved start and Menu are the LAYOUT\'s own', () => {
        for (const game of Object.keys(DOCS)) {
            const f = initialiseFacts(DOCS[game], P);
            const layout = layoutTopDown(DOCS[game], { playerId: P, gridDims: { width: 30, height: 30 } }, createRng(1));
            expect(f.start, game).toBe(layout.actualStartName);
            expect(f.menu, game).toBe(layout.menuName);
        }
    });
});

describe('R9 — the hub asks the PIPELINE\'s rules, never a copy', () => {
    /** ⛓ The adventure document with one of bounce's library items DEFINED and
     *  another already HELD — both must stay out of the grants. */
    const heldAndDefined = () => {
        const doc = JSON.parse(JSON.stringify(DOCS.adventure));
        const [defined, held] = Object.entries(substrateRegistry.get('bounce').libraryItems)
            .filter(([, d]) => !d?.is_victory).map(([n]) => n);
        doc.items[P][defined] = { name: defined, id: 4242, classification: 'progression', groups: [] };
        doc.starting_items = { [P]: [held] };
        return doc;
    };

    it('⛓ initialiseFacts\' start and Menu ARE resolveTopDownStart\'s answer (every probed document)', () => {
        for (const game of Object.keys(DOCS)) {
            const [declared = null] = startRegionsOf(DOCS[game], P).default;
            const r = resolveTopDownStart(regionsOf(DOCS[game], P), declared);
            const f = initialiseFacts(DOCS[game], P);
            expect(r, game).not.toBeNull();
            expect(f.start, game).toBe(r.actualStart);
            expect(f.menu, game).toBe(r.menuName);
        }
    });

    it('⛓ freeItemsFor ≡ the top-down envelope\'s startingItems, every probed document × every realiser target', () => {
        const docs = { ...DOCS, heldAndDefined: heldAndDefined() };
        let granting = 0;
        for (const [game, doc] of Object.entries(docs)) {
            for (const t of initialiseTargets()) {
                const env = buildTopDownEnvelope({
                    source: doc, seed: 1, gridDims: { width: 4, height: 4 },
                    regionSizeBase: { width: 8, height: 6 }, substrateMix: { [t]: 1 },
                });
                const got = freeItemsFor(doc, P, substrateRegistry.get(t));
                expect(got, `${game} × ${t}`).toEqual(env.compileIn.startingItems);
                if (env.compileIn.grantedItems.length) granting += 1;
            }
        }
        expect(granting, 'no pair granted anything — the row would compare empty lists').toBeGreaterThan(0);
    });
});

describe('the form\'s choices (targets, grid)', () => {
    it('⛓ the substrate list is every registered REALISER, and it holds the engine\'s default', () => {
        const derived = substrateRegistry.getAll().filter((e) => regionRealiserKind(e)).map((e) => e.id);
        expect(initialiseTargets()).toEqual(derived);
        expect(initialiseTargets()).toContain(DEFAULT_SUBSTRATE_ID);
    });

    it('⛓ the auto side GROWS past the hand-off\'s start only while a region lacks a CELL', () => {
        const doc = DOCS.alttp_worldgen;
        const auto = autoGridSide(doc, P, { seed: 1 });
        expect(auto.start).toBe(initialiseGridSide(Object.keys(doc.regions[P]).length));
        expect(auto.side).toBeLessThan(auto.start * INITIALISE_GRID_GROWTH_LIMIT);
        const at = (side) => planInitialise(doc, P, { gridDims: { width: side, height: side } });
        const noCell = (plan) => plan.unplaced.filter((u) => u.why === UNPLACED_WHY.NO_FREE_CELL).length;
        // ⛓ why it grows at all: the hand-off's side leaves regions without a cell here.
        expect(noCell(at(auto.start))).toBeGreaterThan(0);
        expect(noCell(at(auto.side))).toBe(0);
        if (auto.grown > 0) expect(noCell(at(auto.side - 1))).toBeGreaterThan(0);
        for (const [game] of PROBED) {
            const a = autoGridSide(DOCS[game], P, { seed: 1 });
            expect(noCell(planInitialise(DOCS[game], P, { gridDims: { width: a.side, height: a.side } })), game).toBe(0);
        }
    });
});

describe('the regions the layout cannot place — NAMED, each with a derived why', () => {
    it('⛓ alttp_worldgen: every unplaced region has NO incoming exit (the plan\'s three)', () => {
        const res = initialised('alttp_worldgen', DEFAULT_SUBSTRATE_ID);
        const incoming = incomingOf(DOCS.alttp_worldgen);
        expect(res.unplaced.length).toBeGreaterThan(0);
        for (const u of res.unplaced) {
            expect(u.why, u.region).toBe(UNPLACED_WHY.NO_INCOMING);
            expect(incoming.has(u.region), u.region).toBe(false);
        }
        expect(res.stats.placed + res.unplaced.length).toBe(res.stats.total);
    });

    /**
     * ⛓ Re-derived by APWORLD SUBSTRATE CHANGE M1 under M2's authority (plan §26.2):
     * the layout now roots every Menu exit's target (R8, shape A), so the regions this
     * row once named ONLY_FROM_MENU are placed. M2 owns the whys (and retired that one,
     * plan §27.0); this row holds what the layout now says.
     */
    it('⛓ pokemon_rb (layout only): every region is placed — the Menu\'s exits are roots, nothing is ONLY FROM MENU', () => {
        const doc = DOCS.pokemon_rb;
        const plan = planInitialise(doc, P);
        const { menu } = initialiseFacts(doc, P);
        expect(menu).toBeTruthy();
        expect(plan.unplaced).toEqual([]);
        expect(plan.placed).toBe(plan.total);
        // ⛓ M2 — the plan names the hub: every root a Menu exit fed, each placed.
        expect(plan.menuRoots.length).toBeGreaterThan(1);
        expect(plan.menuRoots.length).toBeLessThanOrEqual(plan.menuExits);
    });

    it('⛓ a 1×1 grid: the region with a placed parent has NO FREE CELL, its child ONLY FROM UNPLACED', () => {
        // ⛓ M3 — A carries a location, so it is a ROOM the layout places (a start with
        // exits and none would be a pure hub, stripped — topDownStartShape.test.js).
        const doc = {
            start_regions: { [P]: ['A'] },
            regions: {
                [P]: {
                    A: { name: 'A', exits: [{ name: 'A→B', connected_region: 'B' }], locations: [{ name: 'A1' }] },
                    B: { name: 'B', exits: [{ name: 'B→C', connected_region: 'C' }], locations: [] },
                    C: { name: 'C', exits: [], locations: [] },
                },
            },
        };
        const plan = planInitialise(doc, P, { gridDims: { width: 1, height: 1 } });
        expect(plan.unplaced).toEqual([
            { region: 'B', why: UNPLACED_WHY.NO_FREE_CELL },
            { region: 'C', why: UNPLACED_WHY.ONLY_FROM_UNPLACED },
        ]);
        const layout = layoutTopDown(doc, { playerId: P, gridDims: { width: 1, height: 1 } }, createRng(1));
        expect(unplacedRegions(doc, P, layout)).toEqual(plan.unplaced);
    });
});

/**
 * ⛓⛓ M2 — **THE MENU IS THE HUB: A CELL-LESS MENU ROOT IS A CELL SHORTAGE.**
 * The subjects are DERIVED: the first committed bare slot (≤ the population's
 * size) whose auto START side leaves a Menu exit's target without a cell.
 */
const menuFedTargets = (doc, menu) => new Set((doc.regions[P][menu]?.exits ?? [])
    .map((e) => e.connected_region).filter((t) => t !== menu && doc.regions[P][t]));

describe('M2 — the stripped Menu\'s roots: the why, the growth, the plan', () => {
    const MM3 = read(seed1('mm3'));

    it('⛓ mm3: the start side leaves a Menu root without a cell — NO FREE CELL, and the engine counted the skip', () => {
        const { menu } = initialiseFacts(MM3, P);
        const start = initialiseGridSide(Object.keys(MM3.regions[P]).length);
        const opts = { playerId: P, gridDims: { width: start, height: start } };
        const layout = layoutTopDown(MM3, opts, createRng(1));
        const fed = menuFedTargets(MM3, menu);
        const cellLessRoots = [...fed].filter((t) => !layout.cellsByName.has(t));
        expect(cellLessRoots.length).toBeGreaterThan(0);
        expect(layout.stats.regionsSkipped).toBeGreaterThanOrEqual(cellLessRoots.length);
        const whys = new Map(unplacedRegions(MM3, P, layout).map((u) => [u.region, u.why]));
        for (const t of cellLessRoots) expect(whys.get(t), t).toBe(UNPLACED_WHY.NO_FREE_CELL);
        // ⛓ its descendants, which only it reaches, are ONLY FROM UNPLACED.
        for (const [r, why] of whys) if (!fed.has(r)) expect(why, r).toBe(UNPLACED_WHY.ONLY_FROM_UNPLACED);
    });

    it('⛓ mm3: the auto side GROWS for the Menu roots and places every region (side = the first that does)', () => {
        const auto = autoGridSide(MM3, P, { seed: 1 });
        const plan = planInitialise(MM3, P);
        expect(auto.grown).toBeGreaterThan(0);
        expect(plan.gridDims.width).toBe(auto.side);
        expect(plan.placed).toBe(plan.total);
        expect(plan.unplaced).toEqual([]);
        const below = planInitialise(MM3, P, { gridDims: { width: auto.side - 1, height: auto.side - 1 } });
        expect(below.placed).toBeLessThan(below.total);
        // ⛓ the plan's hub: every Menu exit's target a root, each with a cell, in Menu-exit order.
        const { menu } = initialiseFacts(MM3, P);
        const fed = [...menuFedTargets(MM3, menu)];
        expect(plan.menuExits).toBe(fed.length);
        expect(plan.menuRoots.map((r) => r.name)).toEqual(fed);
        expect(plan.menuRoots.map((r) => r.exit_id)).toEqual(MM3.regions[P][menu].exits.map((e) => e.name));
    });

    it('⛓ mm3 on a 1×1 grid: one region placed, the rest NAMED — every Menu root NO FREE CELL, the others only from unplaced', () => {
        const plan = planInitialise(MM3, P, { gridDims: { width: 1, height: 1 } });
        const { menu } = initialiseFacts(MM3, P);
        const fed = menuFedTargets(MM3, menu);
        expect(plan.placed).toBe(1);
        expect(plan.placed + plan.unplaced.length).toBe(plan.total);
        expect(plan.menuRoots.map((r) => r.name)).toEqual([plan.start]);
        for (const u of plan.unplaced) {
            expect(u.why, u.region).toBe(fed.has(u.region) ? UNPLACED_WHY.NO_FREE_CELL : UNPLACED_WHY.ONLY_FROM_UNPLACED);
        }
    });

    it('⛓ a slot with no stripped Menu: menuExits 0, menuRoots [] (apcalc — its declared start is a cell)', () => {
        const plan = planInitialise(DOCS.apcalc, P);
        expect(plan.menu).toBeNull();
        expect(plan.menuExits).toBe(0);
        expect(plan.menuRoots).toEqual([]);
    });
});

/**
 * ⛓⛓ THE POPULATION (trap 1391): every COMMITTED slot with no sidecar entry and
 * at most `POPULATION_MAX_REGIONS` regions, read off `git ls-files`. Asked at
 * the LAYOUT (① — the preview), because the full build of some of them is the
 * realiser's minutes, not this file's: a region with dozens of locations makes
 * a maze room retry-then-grow (measured in the plan's §20; the budget and
 * Cancel exist for exactly that). The four probed documents are built in full
 * below.
 */
const POPULATION_MAX_REGIONS = 100;

describe('the population — every committed bare slot, at the layout', () => {
    const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const slots = [];
    for (const f of files) {
        const doc = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
        for (const p of Object.keys(doc.regions ?? {})) {
            const facts = initialiseFacts(doc, p);
            if (facts.bare && facts.regions <= POPULATION_MAX_REGIONS) slots.push({ f, p, doc, facts });
        }
    }

    it('⛓ every one can be initialised, and its preview accounts for every region with a derived why', () => {
        expect(slots.length).toBeGreaterThan(PROBED.length);
        const blocked = slots.filter((s) => s.facts.blocker).map((s) => `${s.f} ${s.p}: ${s.facts.blocker}`);
        expect(blocked).toEqual([]);
        for (const { f, p, doc, facts } of slots) {
            const plan = planInitialise(doc, p);
            expect(plan.ok, `${f} ${p}: ${plan.threw}`).toBe(true);
            expect(plan.placed + plan.unplaced.length, `${f} ${p}`).toBe(plan.total);
            expect(plan.total + (facts.menu ? 1 : 0), `${f} ${p}`).toBe(facts.regions);
            expect(plan.unplaced.filter((u) => u.why === UNPLACED_WHY.NO_FREE_CELL), `${f} ${p}`).toEqual([]);
            const regions = doc.regions[p];
            const unplacedSet = new Set(plan.unplaced.map((u) => u.region));
            for (const u of plan.unplaced) {
                const from = Object.entries(regions).filter(([n, r]) => n !== u.region
                    && (r.exits ?? []).some((e) => e.connected_region === u.region)).map(([n]) => n);
                if (u.why === UNPLACED_WHY.NO_INCOMING) expect(from, `${f} ${u.region}`).toEqual([]);
                // ⛓ M2 — every remaining why confirmed by the independent incoming-exit derivation:
                // ONLY FROM UNPLACED = every incoming is an unplaced region, never the hub.
                if (u.why === UNPLACED_WHY.ONLY_FROM_UNPLACED) {
                    expect(from.length, `${f} ${u.region}`).toBeGreaterThan(0);
                    for (const x of from) expect(unplacedSet.has(x) && x !== facts.menu, `${f} ${u.region} ← ${x}`).toBe(true);
                }
                expect(Object.values(UNPLACED_WHY), `${f} ${u.region}`).toContain(u.why);
            }
        }
    });

    it('⛓ M2 — at the auto START side a Menu root without a cell is NO FREE CELL, and the auto side places it', () => {
        let rootsShort = 0;
        let slotsShort = 0;
        for (const { f, p, doc, facts } of slots) {
            if (!facts.menu) continue;
            const start = initialiseGridSide(facts.regions);
            const layout = layoutTopDown(doc, { playerId: p, gridDims: { width: start, height: start } }, createRng(1));
            const fed = new Set((doc.regions[p][facts.menu].exits ?? []).map((e) => e.connected_region)
                .filter((t) => t !== facts.menu && doc.regions[p][t]));
            const short = [...fed].filter((t) => !layout.cellsByName.has(t));
            if (short.length === 0) continue;
            slotsShort += 1;
            rootsShort += short.length;
            expect(layout.stats.regionsSkipped, `${f} ${p}`).toBeGreaterThanOrEqual(short.length);
            const whys = new Map(unplacedRegions(doc, p, layout).map((u) => [u.region, u.why]));
            for (const t of short) expect(whys.get(t), `${f} ${t}`).toBe(UNPLACED_WHY.NO_FREE_CELL);
            const plan = planInitialise(doc, p);
            for (const t of short) expect(plan.unplaced.some((u) => u.region === t), `${f} ${t} at the auto side`).toBe(false);
        }
        // ⛓ the measured population has such slots (plan §27.0) — a row over none proves nothing.
        expect(slotsShort).toBeGreaterThan(0);
        expect(rootsShort).toBeGreaterThanOrEqual(slotsShort);
    });
});

describe('initialiseSlot over the probed documents', () => {
    it.each([...PROBED, ['alttp_worldgen', DEFAULT_SUBSTRATE_ID]])(
        '⛓ %s as %s: names and rules kept, 0 report errors WITH the return exits added, 0 new placement issues',
        (game, substrate) => {
            const doc = DOCS[game];
            const res = initialised(game, substrate);
            expect(res.ok, res.why).toBe(true);
            const regions = Object.keys(doc.regions[P]);
            for (const [name, entry] of Object.entries(res.entries)) {
                expect(regions, name).toContain(name);
                expect(entry.substrate).toBe(substrate);
            }
            const copy = withResult(doc, res);
            // ⛓ The report reads every baked exit and location name against the
            //   document (EXIT_UNKNOWN / LOCATION_UNKNOWN …) — 0 errors.
            expect(errorsOf(copy).map((i) => `${i.kind} ${i.region}: ${i.message}`)).toEqual([]);
            expect(canonicalPlacementIssues(copy, P)).toEqual(canonicalPlacementIssues(doc, P));
            expect(validateRules(copy, P).filter((i) => i.severity === 'error').length)
                .toBe(validateRules(doc, P).filter((i) => i.severity === 'error').length);
            expect(bytes(doc), 'the input document moved').toBe(bytes(read(seed1(game))));
        },
    );

    it('⛓ the return exits ARE what the report needs: left out, each is an EXIT_UNKNOWN (apcalc)', () => {
        const res = initialised('apcalc', DEFAULT_SUBSTRATE_ID);
        expect(res.returnExits.length).toBeGreaterThan(0);
        const without = errorsOf(withResult(DOCS.apcalc, res, { addExits: false }));
        expect(without.filter((i) => i.kind === 'EXIT_UNKNOWN').length).toBe(res.returnExits.length);
    });

    it('⛓ backExits none: no return exit, and still 0 report errors (every probed document)', () => {
        for (const [game, substrate] of PROBED) {
            const res = initialised(game, substrate, BACK_EXITS.NONE);
            expect(res.returnExits, game).toEqual([]);
            expect(res.stats.returnExits).toBe(0);
            expect(errorsOf(withResult(DOCS[game], res)).length, game).toBe(0);
        }
    });

    it('⛓ each return exit leads to the region\'s BFS parent with the FORWARD exit\'s rule (the pipeline\'s post-pass)', () => {
        for (const game of ['apcalc', 'alttp_worldgen']) {
            const doc = DOCS[game];
            const res = initialised(game, DEFAULT_SUBSTRATE_ID);
            for (const { region, exit } of res.returnExits) {
                const parent = doc.regions[P][exit.connected_region];
                const fwd = parent.exits.filter((e) => e.connected_region === region);
                expect(fwd.length, `${game} ${region}`).toBeGreaterThan(0);
                expect(fwd.map((e) => bytes(e.access_rule ?? { rule: 'True_' })), region)
                    .toContain(bytes(exit.access_rule));
                expect(doc.regions[P][region].exits.some((e) => e.connected_region === exit.connected_region), region)
                    .toBe(false);
            }
        }
    });

    it('⛓ the PREVIEW agrees with the build: placed, return exits, teleporters, unplaced', () => {
        for (const [game, substrate] of [...PROBED, ['alttp_worldgen', DEFAULT_SUBSTRATE_ID]]) {
            const plan = planInitialise(DOCS[game], P, { substrate });
            const res = initialised(game, substrate);
            expect(plan.placed, game).toBe(res.stats.placed);
            expect(plan.returnExits, game).toBe(res.stats.returnExits);
            expect(plan.teleporters, game).toBe(res.stats.teleporters);
            expect(plan.unplaced, game).toEqual(res.unplaced);
            expect(plan.gridDims, game).toEqual(res.gridDims);
        }
    });

    it('⛓ procgen_metadata: the driver, the counts, the cells\' extent; no configs for a maze slot', () => {
        const res = initialised('apcalc', DEFAULT_SUBSTRATE_ID);
        const m = res.procgen_metadata;
        expect(m.driver).toBe(INITIALISE_DRIVER);
        // ⛓ P1a — the KEY names the slot (`procgen_metadata[p]`); the block no longer repeats it.
        expect(Object.hasOwn(m, 'player')).toBe(false);
        expect(m.region_count).toBe(Object.keys(res.entries).length);
        const cells = Object.values(res.entries).map((e) => e.grid_cell);
        expect(m.grid_dims).toEqual({
            width: Math.max(...cells.map((c) => c.gx)) + 1, height: Math.max(...cells.map((c) => c.gy)) + 1,
        });
        expect(m.grid_dims.width).toBeLessThanOrEqual(res.gridDims.width);
        expect(m.substrate_configs).toBeUndefined();
    });

    it('⛓ deterministic: the same arguments build the same bytes', () => {
        const again = initialiseSlot({ doc: DOCS.apcalc, player: P, substrate: DEFAULT_SUBSTRATE_ID });
        const first = initialised('apcalc', DEFAULT_SUBSTRATE_ID);
        const strip = ({ ms, ...rest }) => rest;
        expect(bytes(strip(again))).toBe(bytes(strip(first)));
    });

    it('⛓ one progress event per placed region, in order, with the total', () => {
        const events = [];
        const res = initialiseSlot({ doc: DOCS.apcalc, player: P, onProgress: (e) => events.push(e) });
        const regionEvents = events.filter((e) => e.type === 'region');
        expect(regionEvents.length).toBe(res.stats.placed);
        expect(regionEvents.map((e) => e.index)).toEqual(regionEvents.map((_, i) => i));
        expect(new Set(regionEvents.map((e) => e.total))).toEqual(new Set([res.stats.total]));
    });
});

/* ── the op ─────────────────────────────────────────────────────────────── */

/** ⛓ The slot maps whose change is reported per SLOT (P1a: `procgen_metadata` and `loop_costs` joined `preset_sidecars`). */
const SLOT_MAPS = ['preset_sidecars', 'procgen_metadata', 'loop_costs'];

/** ⛓ Every changed path, two levels deep under `regions.<p>.<R>`, one per slot under a slot map, one level elsewhere. */
function changedPaths(a, b) {
    const out = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (bytes(a[k]) === bytes(b[k])) continue;
        if (k === 'regions' || SLOT_MAPS.includes(k)) {
            for (const p of new Set([...Object.keys(a[k] ?? {}), ...Object.keys(b[k] ?? {})])) {
                if (bytes(a[k]?.[p]) === bytes(b[k]?.[p])) continue;
                if (SLOT_MAPS.includes(k)) { out.push(`${k}.${p}`); continue; }
                for (const r of new Set([...Object.keys(a[k][p]), ...Object.keys(b[k][p])])) {
                    const ra = a[k][p][r];
                    const rb = b[k][p][r];
                    if (bytes(ra) === bytes(rb)) continue;
                    for (const f of new Set([...Object.keys(ra ?? {}), ...Object.keys(rb ?? {})])) {
                        if (bytes(ra?.[f]) !== bytes(rb?.[f])) out.push(`${k}.${p}.${r}.${f}`);
                    }
                }
            }
        } else out.push(k);
    }
    return out.sort();
}

/** ⛓ The op a landed Generate records, for a probed document. */
function landedOp(game, substrate = DEFAULT_SUBSTRATE_ID, backExits = BACK_EXITS.ADD) {
    const res = initialised(game, substrate, backExits);
    return initialiseOpFor({ player: P, substrate, gridDims: res.gridDims, seed: 1, backExits }, res);
}

describe('the op initialise-procgen-layout', () => {
    it('⛓ is in the vocabulary', () => {
        expect(RULES_OP_KINDS).toContain(INITIALISE_OP);
    });

    it('⛓ writes EXACTLY the slot\'s entries, procgen_metadata and the return exits — nothing else (apcalc, add)', () => {
        const doc = DOCS.apcalc;
        const op = landedOp('apcalc');
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, res.error).toBe(true);
        const gained = [...new Set(op.result.returnExits.map((r) => r.region))].sort();
        expect(changedPaths(doc, res.doc)).toEqual([
            'preset_sidecars.1', 'procgen_metadata.1', ...gained.map((r) => `regions.1.${r}.exits`),
        ].sort());
        for (const r of gained) {
            const before = doc.regions[P][r].exits;
            const after = res.doc.regions[P][r].exits;
            expect(after.slice(0, before.length), r).toEqual(before);
            expect(after.slice(before.length), r)
                .toEqual(op.result.returnExits.filter((x) => x.region === r).map((x) => x.exit));
        }
        expect(res.doc.preset_sidecars[P]).toEqual(op.result.entries);
    });

    it('⛓ with return exits OFF the regions block does not move at all', () => {
        const doc = DOCS.apcalc;
        const res = applyRulesDocOp(doc, landedOp('apcalc', DEFAULT_SUBSTRATE_ID, BACK_EXITS.NONE));
        expect(res.ok, res.error).toBe(true);
        expect(changedPaths(doc, res.doc)).toEqual(['preset_sidecars.1', 'procgen_metadata.1']);
        expect(res.description).toContain(INITIALISE_RETURN_EXITS_OFF);
    });

    it('⛓ the description interpolates every number, and names the unplaced by name and why', () => {
        const apc = landedOp('apcalc');
        const r1 = applyRulesDocOp(DOCS.apcalc, apc);
        const s = apc.result.stats;
        const g = apc.provenance.gridDims;
        expect(r1.description.startsWith(`slot ${P} initialised as \`${DEFAULT_SUBSTRATE_ID}\`: ${s.placed} regions on a `
            + `${g.width}×${g.height} grid (${s.teleporters} teleporters), ${s.returnExits} ${INITIALISE_RETURN_EXITS_ADDED}, `
            + `no library items ${GRANTED_AS_STARTING}, 0 regions ${INITIALISE_UNPLACED} — ${INITIALISE_RULES_UNCHANGED}`))
            .toBe(true);
        const alt = landedOp('alttp_worldgen');
        const r2 = applyRulesDocOp(DOCS.alttp_worldgen, alt);
        expect(r2.ok, r2.error).toBe(true);
        expect(r2.description).toContain(`${alt.provenance.unplaced.length} regions ${INITIALISE_UNPLACED} `
            + `(${UNPLACED_WHY.NO_INCOMING}: `);
        for (const u of alt.provenance.unplaced) expect(r2.description).toContain(u.region);
        expect(r2.description).toBe(describeInitialise({
            player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: alt.provenance.gridDims,
            backExits: BACK_EXITS.ADD, result: alt.result, unplaced: alt.provenance.unplaced, ms: alt.provenance.ms,
        }));
    });

    it('⛓ ONE undo restores the document byte for byte', () => {
        const doc = DOCS.apcalc;
        const session = createEditSession(rulesEditAdapter, doc);
        const before = bytes(session.record());
        session.apply(landedOp('apcalc'));
        expect(bytes(session.record())).not.toBe(before);
        expect(session.ops()).toHaveLength(1);
        expect(session.undo()).toBe(true);
        expect(bytes(session.record())).toBe(before);
    });

    it('⛓ the refold of a LANDED op is a write, not a realise — alttp_worldgen\'s result folds in well under its build', () => {
        const op = landedOp('alttp_worldgen');
        const t0 = performance.now();
        const out = foldEdits(rulesEditAdapter, DOCS.alttp_worldgen, [op]).record;
        const ms = performance.now() - t0;
        expect(Object.keys(out.preset_sidecars[P]).length).toBe(op.result.stats.placed);
        // ⛓ The build is a realise per region; the refold is a copy-on-write.
        expect(ms).toBeLessThan(initialised('alttp_worldgen', DEFAULT_SUBSTRATE_ID).ms);
    });

    it('⛓ the SCRIPT shape computes, and its RESOLVED op replays to the same bytes', () => {
        const doc = DOCS.adventure;
        const gridDims = { width: 5, height: 5 };
        const res = applyRulesDocOp(doc, {
            op: INITIALISE_OP, player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims, seed: 3, backExits: BACK_EXITS.ADD,
        });
        expect(res.ok, res.error).toBe(true);
        expect(res.op.result.entries).toEqual(res.doc.preset_sidecars[P]);
        expect(res.op.provenance).toMatchObject({ substrate: DEFAULT_SUBSTRATE_ID, gridDims, seed: 3 });
        const replay = applyRulesDocOp(doc, res.op);
        expect(bytes(replay.doc)).toBe(bytes(res.doc));
    });

    it('⛔ a slot that already carries an entry is refused with the bare-only law', () => {
        const res = applyRulesDocOp(FOUR, {
            op: INITIALISE_OP, player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: { width: 4, height: 4 }, seed: 1,
            backExits: BACK_EXITS.ADD,
        });
        expect(res.ok).toBe(false);
        expect(res.error).toContain(INITIALISE_BARE_ONLY);
        expect(res.error).toContain(`${Object.keys(FOUR.preset_sidecars[P]).length} sidecar entries`);
    });

    it('⛔ the other refusals, by name, before the engine runs', () => {
        const doc = DOCS.adventure;
        const good = { player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: { width: 4, height: 4 }, seed: 1, backExits: 'add' };
        expect(initialiseOpRefusal(doc, good)).toBeNull();
        expect(initialiseOpRefusal(doc, { ...good, seed: 1.5 })).toContain(REGENERATE_SEED_REQUIRED);
        expect(initialiseOpRefusal(doc, { ...good, gridDims: { width: 0, height: 4 } })).toContain('`gridDims`');
        expect(initialiseOpRefusal(doc, { ...good, gridDims: { width: 2.5, height: 4 } })).toContain('`gridDims`');
        expect(initialiseOpRefusal(doc, { ...good, backExits: 'maybe' })).toContain('`backExits`');
        expect(initialiseOpRefusal(doc, { ...good, substrate: 'no-such' })).toContain('no module registers substrate');
        const noRealiser = substrateRegistry.getAll().find((e) => !regionRealiserKind(e)
            && typeof e.deserializeWorld === 'function' && typeof e.serializeWorld === 'function');
        expect(noRealiser, 'the registry has a playable entry without a realiser').toBeTruthy();
        expect(initialiseOpRefusal(doc, { ...good, substrate: noRealiser.id })).toContain('has no per-region realiser');
        const meta = { ...doc, procgen_metadata: { [P]: { driver: 'top-down' } } };
        expect(initialiseOpRefusal(meta, good)).toContain(`player ${P} already carries a \`procgen_metadata\` block`);
        expect(initialiseOpRefusal({ ...doc, procgen_metadata: { 2: { driver: 'top-down' } } }, good)).toBeNull();
        expect(initialiseOpRefusal(doc, { ...good, player: '9' })).toContain('has no regions');
    });

    it('⛔ an inlined result is checked: stray entries, a taken exit name, a held top-level block', () => {
        const doc = DOCS.apcalc;
        const op = landedOp('apcalc');
        const stray = JSON.parse(JSON.stringify(op));
        stray.result.entries['Not A Region'] = { substrate: DEFAULT_SUBSTRATE_ID };
        expect(applyRulesDocOp(doc, stray).error).toContain('Not A Region');
        const taken = JSON.parse(JSON.stringify(op));
        const { region } = taken.result.returnExits[0];
        taken.result.returnExits[0].exit.name = doc.regions[P][region].exits[0].name;
        expect(applyRulesDocOp(doc, taken).error).toContain('already has an exit named');
        const block = JSON.parse(JSON.stringify(op));
        block.result.blocks = { game_name: 'x' };
        expect(applyRulesDocOp(doc, block).error).toContain('`game_name`');
        const noProv = { ...op, provenance: undefined };
        expect(applyRulesDocOp(doc, noProv).error).toContain('`provenance`');
    });
});

/* ── S1: the op DECLARES what it built with ─────────────────────────────── */

const GRID4 = { width: 4, height: 4 };
const s1cache = new Map();
/** ⛓ adventure initialised as `t` on 4×4, seed 1 — the hub's op, landed. */
function hubInitialised(t, doc = DOCS.adventure) {
    const key = `${t}|${bytes(doc).length}`;
    if (!s1cache.has(key)) {
        const res = initialiseSlot({ doc, player: P, substrate: t, gridDims: GRID4, seed: 1, backExits: BACK_EXITS.ADD });
        const op = initialiseOpFor({ player: P, substrate: t, gridDims: GRID4, seed: 1, backExits: BACK_EXITS.ADD }, res);
        s1cache.set(key, { res, op, out: applyRulesDocOp(doc, op) });
    }
    return s1cache.get(key);
}

/** ⛓ The first realiser target whose registry entry declares a starting-inventory
 *  NEED (derived, never typed), and the first that grants nothing AND initialises
 *  adventure (4×4, seed 1) — by those facts, not by a position: a target that picks
 *  rooms from a fixed atlas may refuse adventure's regions (REGISTRATION ORDER RO1:
 *  `getAll()` sorts by id, and `flash_seedling` now comes before `maze`). */
const NEEDER = initialiseTargets().find((t) => substrateRegistry.get(t)?.startingInventory);
const NON_GRANTING = initialiseTargets().find((t) => !Object.values(substrateRegistry.get(t)?.libraryItems ?? {})
    .some((d) => !d?.is_victory) && (() => { try { return hubInitialised(t).out.ok === true; } catch { return false; } })());

/**
 * ⛓⛓ The keys the pipeline's compile writes and the hub must NOT (plan §22.1:
 * the document's own identity, the exporter's placements, the compile's
 * bidirectional flag — ⚖ Q2 — and the embedded log — ⚖ Q3). A NEW differing
 * key is a new gap, and turns this list's row red.
 */
const MUST_NOT = ['archipelago_version', 'assume_bidirectional_exits', 'canonical_placements', 'game_directory',
    'game_info', 'game_name', 'seed_name', 'sphere_log', 'world'];
/** ⛓ The keys both write, compared by what they MEAN (the compile re-spells ids, order, the item shape). */
const BOTH_WRITE = ['itempool_counts', 'items', 'procgen_metadata', 'regions'];

describe('S1 — the initialise op DECLARES the library items it built with', () => {
    it('⛓ the targets are derived: one declares a need, one grants nothing', () => {
        expect(NEEDER, 'no realiser declares startingInventory').toBeTruthy();
        expect(NON_GRANTING, 'every realiser grants something').toBeTruthy();
    });

    it('⛓ the result carries the grants — the pipeline envelope\'s, defs by its id rule', () => {
        const { res } = hubInitialised(NEEDER);
        const env = buildTopDownEnvelope({ source: DOCS.adventure, seed: 1, gridDims: GRID4,
            regionSizeBase: { width: 8, height: 6 }, substrateMix: { [NEEDER]: 1 } });
        expect(res.grantedItems.length).toBeGreaterThan(0);
        expect(res.grantedItems).toEqual(env.compileIn.grantedItems);
        expect(res.freeItems).toEqual(env.compileIn.startingItems);
        res.grantedItems.forEach((n, i) => expect(res.grantedDefs[n]).toEqual({
            name: n, id: GRANTED_ITEM_FIRST_ID - i, classification: 'progression', groups: ['Everything'],
        }));
    });

    it('⛓ the deep diff: sidecars, metadata, return exits, items.<p>.<granted> (absent names only), starting_items — nothing else', () => {
        const doc = DOCS.adventure;
        const { op, out } = hubInitialised(NEEDER);
        expect(out.ok, out.error).toBe(true);
        const gained = [...new Set(op.result.returnExits.map((r) => r.region))].sort();
        expect(changedPaths(doc, out.doc)).toEqual(['items', 'preset_sidecars.1', 'procgen_metadata.1', 'starting_items',
            ...gained.map((r) => `regions.1.${r}.exits`)].sort());
        const granted = op.result.grantedItems;
        const added = Object.keys(out.doc.items[P]).filter((n) => !Object.hasOwn(doc.items[P], n));
        expect(added).toEqual(granted);
        for (const n of Object.keys(doc.items[P])) expect(bytes(out.doc.items[P][n]), n).toBe(bytes(doc.items[P][n]));
        for (const n of granted) expect(out.doc.items[P][n]).toEqual(op.result.grantedDefs[n]);
        expect(out.doc.starting_items[P]).toEqual([...(doc.starting_items?.[P] ?? []), ...granted]);
        expect(out.description).toContain(grantsClause(granted));
        for (const n of granted) expect(out.description).toContain(n);
    });

    it('⛓ after it, every need row of the target is MET and no grant is refused (the bounce buttons)', () => {
        const before = startingNeedRows(DOCS.adventure, P, [NEEDER]);
        expect(before.length).toBeGreaterThan(0);
        expect(before.some((r) => r.grants.some((g) => g.refusal)), 'the gap: refused before').toBe(true);
        const rows = startingNeedRows(hubInitialised(NEEDER).out.doc, P, [NEEDER]);
        expect(rows.length).toBe(before.length);
        for (const r of rows) {
            expect(r.met, r.substrate).toBe(true);
            for (const g of r.grants) expect(g.refusal, g.item).toBeNull();
        }
    });

    it('⛓ a target that grants nothing: items and starting_items untouched, the none clause', () => {
        const doc = DOCS.adventure;
        const { op, out } = hubInitialised(NON_GRANTING);
        expect(out.ok, out.error).toBe(true);
        expect(op.result.grantedItems).toEqual([]);
        expect(bytes(out.doc.items)).toBe(bytes(doc.items));
        expect(bytes(out.doc.starting_items)).toBe(bytes(doc.starting_items));
        expect(out.description).toContain(`no library items ${GRANTED_AS_STARTING}`);
    });

    it('⛓ ONE undo returns items and starting_items byte for byte', () => {
        const doc = DOCS.adventure;
        const session = createEditSession(rulesEditAdapter, doc);
        const before = bytes(session.record());
        session.apply(hubInitialised(NEEDER).op);
        expect(bytes(session.record().starting_items)).not.toBe(bytes(doc.starting_items));
        expect(session.undo()).toBe(true);
        expect(bytes(session.record())).toBe(before);
    });

    it('⛓ metadata: source_game and source_counts, the pipeline\'s', () => {
        const m = hubInitialised(NEEDER).out.doc.procgen_metadata[P];
        expect(m.source_game).toBe(DOCS.adventure.game_name);
        expect(m.source_counts).toEqual(computeSourceCounts(DOCS.adventure, P));
    });

    it('⛓⛓ THE AUDIT AS A ROW — pipeline top-down vs the hub on adventure: only the must-NOT keys differ', async () => {
        for (const t of [NON_GRANTING, NEEDER]) {
            const k = initialiseKnobs(t);
            const env = buildTopDownEnvelope({ source: DOCS.adventure, seed: 1, gridDims: GRID4,
                regionSizeBase: { width: 8, height: 6 }, substrateMix: { [t]: 1 }, regionParams: k.regionParams,
                hazardOpts: k.hazardOpts });
            // eslint-disable-next-line no-await-in-loop
            const pipe = (await runTopDownToStep(env, 'compile', {})).compile.rulesJson;
            const hub = hubInitialised(t).out.doc;
            const differ = [...new Set([...Object.keys(pipe), ...Object.keys(hub)])]
                .filter((x) => bytes(pipe[x]) !== bytes(hub[x])).sort();
            expect(differ, t).toEqual([...MUST_NOT, ...BOTH_WRITE].sort());
            expect(bytes(hub.preset_sidecars[P]), t).toBe(bytes(pipe.preset_sidecars[P]));
            expect(hub.starting_items[P], t).toEqual(pipe.starting_items[P]);
            const grantedOf = (d) => Object.keys(d.items[P]).filter((n) => DOCS.adventure.items[P][n] == null);
            expect(grantedOf(hub), t).toEqual(grantedOf(pipe));
            for (const n of grantedOf(hub)) expect(hub.items[P][n], n).toEqual(pipe.items[P][n]);
            expect(hub.itempool_counts[P], t).toEqual(pipe.itempool_counts[P]);
            const shape = (d) => Object.fromEntries(Object.entries(d.regions[P]).map(([n, r]) => [n, {
                exits: (r.exits ?? []).map((e) => [e.name, e.connected_region, bytes(e.access_rule)]),
                locations: (r.locations ?? []).map((l) => l.name),
            }]));
            expect(shape(hub), t).toEqual(shape(pipe));
            const pm = pipe.procgen_metadata[P];
            const hm = hub.procgen_metadata[P];
            expect([...new Set([...Object.keys(pm), ...Object.keys(hm)])].filter((x) => bytes(pm[x]) !== bytes(hm[x]))
                .sort(), t).toEqual(['driver']);
        }
    });

    it('⛔ an inlined grant is checked: a defined name, a held name, a taken id, a missing def', () => {
        const doc = DOCS.adventure;
        const { op } = hubInitialised(NEEDER);
        const [first] = op.result.grantedItems;
        const defined = JSON.parse(JSON.stringify(doc));
        defined.items[P][first] = { name: first, id: 1, classification: 'progression', groups: [] };
        expect(applyRulesDocOp(defined, op).error).toContain('a grant never overwrites');
        const held = JSON.parse(JSON.stringify(doc));
        held.starting_items = { [P]: [first] };
        expect(applyRulesDocOp(held, op).error).toContain(`already starts with ${first}`);
        const taken = JSON.parse(JSON.stringify(doc));
        taken.items[P].Other = { name: 'Other', id: op.result.grantedDefs[first].id, classification: 'filler', groups: [] };
        expect(applyRulesDocOp(taken, op).error).toContain('take an item id');
        const missing = JSON.parse(JSON.stringify(op));
        delete missing.result.grantedDefs[first];
        expect(applyRulesDocOp(doc, missing).error).toContain('exactly one definition');
    });

    it('⛓ a def never takes an id the slot uses (avoidIds); a record made before S1 replays unchanged', () => {
        const doc = JSON.parse(JSON.stringify(DOCS.adventure));
        doc.items[P].Taken = { name: 'Taken', id: GRANTED_ITEM_FIRST_ID, classification: 'filler', groups: [] };
        const res = initialiseSlot({ doc, player: P, substrate: NEEDER, gridDims: GRID4, seed: 1 });
        const ids = Object.values(res.grantedDefs).map((d) => d.id);
        expect(ids).not.toContain(GRANTED_ITEM_FIRST_ID);
        expect(ids[0]).toBe(GRANTED_ITEM_FIRST_ID - 1);
        const old = JSON.parse(JSON.stringify(hubInitialised(NEEDER).op));
        delete old.result.grantedItems;
        delete old.result.grantedDefs;
        const out = applyRulesDocOp(DOCS.adventure, old);
        expect(out.ok, out.error).toBe(true);
        expect(bytes(out.doc.items)).toBe(bytes(DOCS.adventure.items));
    });
});

describe('S2 — the generation settings bag in the build and the op', () => {
    /** ⛓ The first key of a target's defaults whose value is a number or a boolean — derived, never typed. */
    const firstKnob = (id) => {
        const d = substrateRegistry.get(id)?.defaultProcgenParams ?? {};
        return Object.keys(d).find((k) => typeof d[k] === 'number' || typeof d[k] === 'boolean') ?? null;
    };
    const moved = (v) => (typeof v === 'boolean' ? !v : v + 1);
    const defaultsOf = (id) => ({ ...(substrateRegistry.get(id)?.defaultProcgenParams ?? {}) });
    const oracle = (id, bag) => bytes([
        assembleRegionParams({ activeIds: [id], mode: 'topDown', params: bag }), effectiveHazardOpts(bag),
    ]);
    const { width: W, height: H } = INITIALISE_SIZE_KEYS;
    const sizeBag = (doc, id, dw = 0) => {
        const s = regionSizeFor(doc, P);
        return { ...defaultsOf(id), [W]: s.width + dw, [H]: s.height };
    };

    it('⛓ initialiseKnobs(sub) ≡ initialiseKnobs(sub, its defaults) ≡ with the slot\'s size added — every realiser target', () => {
        for (const id of initialiseTargets()) {
            expect(bytes(initialiseKnobs(id, defaultsOf(id))), id).toBe(bytes(initialiseKnobs(id)));
            expect(bytes(initialiseKnobs(id, sizeBag(DOCS.adventure, id))), id).toBe(bytes(initialiseKnobs(id)));
        }
    });

    it('⛓⛓ a bag that moves a target\'s first knob moves its knobs exactly when assembleRegionParams / effectiveHazardOpts say so', () => {
        const knobbed = initialiseTargets().filter((id) => firstKnob(id));
        expect(knobbed.length).toBeGreaterThan(0);
        let movedAny = 0;
        for (const id of knobbed) {
            const k = firstKnob(id);
            const bag = { ...defaultsOf(id), [k]: moved(defaultsOf(id)[k]) };
            const expectMove = oracle(id, bag) !== oracle(id, defaultsOf(id));
            if (expectMove) movedAny += 1;
            expect(bytes(initialiseKnobs(id, bag)) !== bytes(initialiseKnobs(id)), `${id}.${k}`).toBe(expectMove);
        }
        expect(movedAny, 'no target\'s first knob reaches the realiser').toBeGreaterThan(0);
    });

    it('⛓⛓ the bag\'s SIZE is the layout\'s and every payload\'s (adventure, a tiles target) — absent, the slot\'s (mutant: the size not read)', () => {
        const doc = DOCS.adventure;
        const tiles = initialiseTargets().find((id) => geometryOf(substrateRegistry.get(id)) === REGION_GEOMETRY.TILES);
        expect(tiles, 'no tiles realiser').toBeTruthy();
        const bag = sizeBag(doc, tiles, 3);
        const layout = (b) => layoutTopDown(doc, {
            playerId: P, gridDims: GRID4, regionSizeBase: initialiseRegionSize(doc, P, b), seed: 1,
            assumeBidirectional: true, substrateByRegion: {},
        }, createRng(1));
        expect(initialiseRegionSize(doc, P, bag)).toEqual({ width: bag[W], height: bag[H] });
        expect(initialiseRegionSize(doc, P, undefined)).toEqual(
            (({ width, height }) => ({ width, height }))(regionSizeFor(doc, P)));
        expect(layout(bag).placementOrder.length).toBe(layout(undefined).placementOrder.length);
        const res = initialiseSlot({ doc, player: P, substrate: tiles, gridDims: GRID4, seed: 1, bag });
        expect(res.ok, res.why).toBe(true);
        const sizes = Object.values(res.entries).map((e) => `${e.playable_payload.width}x${e.playable_payload.height}`);
        expect(new Set(sizes)).toEqual(new Set([`${bag[W]}x${bag[H]}`]));
    });

    it('⛓⛓ the build runs under the bag: a moved knob that reaches the realiser moves the payloads (mutant: the bag not threaded)', () => {
        const doc = DOCS.adventure;
        const id = initialiseTargets().find((t) => firstKnob(t)
            && oracle(t, { ...defaultsOf(t), [firstKnob(t)]: moved(defaultsOf(t)[firstKnob(t)]) }) !== oracle(t, defaultsOf(t)));
        expect(id, 'no target\'s first knob reaches the realiser').toBeTruthy();
        const k = firstKnob(id);
        const base = sizeBag(doc, id);
        const build = (bag) => initialiseSlot({ doc, player: P, substrate: id, gridDims: GRID4, seed: 1, bag });
        const a = build(base);
        const b = build({ ...base, [k]: moved(base[k]) });
        expect(a.ok, a.why).toBe(true);
        expect(b.ok, b.why).toBe(true);
        expect(bytes(b.entries), `${id}.${k}`).not.toBe(bytes(a.entries));
    });

    it('⛓ the form\'s default bag builds the same bytes as no bag (byte-inert for every pre-S2 caller)', () => {
        const doc = DOCS.adventure;
        const args = { doc, player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: GRID4, seed: 1 };
        const strip = (r) => bytes({ ...r, ms: 0 });
        expect(strip(initialiseSlot({ ...args, bag: sizeBag(doc, DEFAULT_SUBSTRATE_ID) })))
            .toBe(strip(initialiseSlot(args)));
    });

    it('⛓⛓ the record: provenance.bag when given (a copy), absent otherwise — and a pre-S2 record replays byte for byte', () => {
        const doc = DOCS.adventure;
        const bag = sizeBag(doc, DEFAULT_SUBSTRATE_ID, 2);
        const args = { player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: GRID4, seed: 1, backExits: BACK_EXITS.ADD };
        const res = initialiseSlot({ doc, ...args, bag });
        const withBag = initialiseOpFor({ ...args, bag }, res);
        expect(withBag.provenance.bag).toEqual(bag);
        expect(withBag.provenance.bag).not.toBe(bag);
        const without = initialiseOpFor(args, res);
        expect(Object.hasOwn(without.provenance, 'bag')).toBe(false);
        expect(Object.keys(without.provenance)).toEqual(['substrate', 'gridDims', 'seed', 'backExits', 'ms', 'unplaced']);
        // ⛓ the bag is PROVENANCE: the landed document is the result's, with or without it
        const a = applyRulesDocOp(doc, withBag);
        const b = applyRulesDocOp(doc, without);
        expect(a.ok, a.error).toBe(true);
        expect(b.ok, b.error).toBe(true);
        expect(bytes(a.doc)).toBe(bytes(b.doc));
        expect(a.description).toBe(b.description);
        // ⛓ a pre-S2 record (R7 / S1 shape — no bag) replays to the document the
        //   form's DEFAULT bag builds today
        const old = hubInitialised(DEFAULT_SUBSTRATE_ID).op;
        expect(Object.hasOwn(old.provenance, 'bag')).toBe(false);
        const dflt = sizeBag(doc, DEFAULT_SUBSTRATE_ID);
        const now = initialiseOpFor({ ...args, bag: dflt }, initialiseSlot({ doc, ...args, bag: dflt }));
        expect(bytes(applyRulesDocOp(doc, old).doc)).toBe(bytes(applyRulesDocOp(doc, now).doc));
    });

    it('⛓ the SCRIPT shape takes a bag, builds under it, and its RESOLVED op records it', () => {
        const doc = DOCS.adventure;
        const bag = sizeBag(doc, DEFAULT_SUBSTRATE_ID, 1);
        const res = applyRulesDocOp(doc, {
            op: INITIALISE_OP, player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: GRID4, seed: 2,
            backExits: BACK_EXITS.ADD, bag,
        });
        expect(res.ok, res.error).toBe(true);
        expect(res.op.provenance.bag).toEqual(bag);
        for (const e of Object.values(res.doc.preset_sidecars[P])) expect(e.playable_payload.width).toBe(bag[W]);
        expect(bytes(applyRulesDocOp(doc, res.op).doc)).toBe(bytes(res.doc));
    });

    it('⛔ a bag that is not an object, or a size below one tile, is refused by name — record and script alike', () => {
        const doc = DOCS.adventure;
        const { op } = hubInitialised(DEFAULT_SUBSTRATE_ID);
        for (const bad of ['x', 3, [], null]) {
            const rec = { ...op, provenance: { ...op.provenance, bag: bad } };
            expect(applyRulesDocOp(doc, rec).error, String(bad)).toContain('`bag`');
        }
        for (const key of [W, H]) {
            for (const v of [0, 1.5, '8']) {
                const rec = { ...op, provenance: { ...op.provenance, bag: { [key]: v } } };
                expect(applyRulesDocOp(doc, rec).error, `${key}=${v}`).toContain(`\`${key}\``);
            }
        }
        expect(applyRulesDocOp(doc, {
            op: INITIALISE_OP, player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: GRID4, seed: 1,
            backExits: BACK_EXITS.ADD, bag: 'x',
        }).error).toContain('`bag`');
    });
});

/* ── S3: loop mode on an initialise ─────────────────────────────────────── */

/** ⛓ adventure's own sphere log — the `_sphere_log.jsonl` BESIDE the preset (what the page's `sphereState` holds). */
const ADV_LOG = readFileSync(join(PRESETS, 'adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl'),
    'utf8').trim().split('\n').map((l) => JSON.parse(l));
const S3_ARGS = { player: P, substrate: DEFAULT_SUBSTRATE_ID, gridDims: GRID4, seed: 1, backExits: BACK_EXITS.ADD };
const LOOP_ON = { enabled: true, regionXpEffect: DEFAULT_REGION_XP_EFFECT };
const noMs = (res) => ({ ...res, ms: 0 });
const s3cache = new Map();
/** ⛓ adventure initialised under `loopMode` (with the page's log), the op landed; `null` = no loopMode at all (pre-S3). */
function loopInitialised(loopMode = LOOP_ON, sphereLog = ADV_LOG) {
    const key = JSON.stringify(loopMode) + (sphereLog ? sphereLog.length : 0);
    if (!s3cache.has(key)) {
        const doc = DOCS.adventure;
        const extra = loopMode === null ? {} : { loopMode, sphereLog };
        const res = initialiseSlot({ doc, ...S3_ARGS, ...extra });
        const op = initialiseOpFor({ ...S3_ARGS, ...(loopMode ? { loopMode } : {}) }, res);
        s3cache.set(key, { res, op, out: applyRulesDocOp(doc, op) });
    }
    return s3cache.get(key);
}
/** ⛓ `doc` with the block and every payload's mana flag taken back out (a copy). */
function withoutLoopMode(doc) {
    const c = JSON.parse(JSON.stringify(doc));
    delete c.loop_costs[P];
    if (Object.keys(c.loop_costs).length === 0) delete c.loop_costs;
    for (const e of Object.values(c.preset_sidecars[P])) delete e.playable_payload.manaEnabled;
    return c;
}

describe('S3 — loop mode on an initialise: the build and the op', () => {
    it('⛓ the premises: adventure embeds no log, its jsonl has player 1\'s slice; the effects are the generator\'s', () => {
        expect(DOCS.adventure.sphere_log).toBeUndefined();
        expect(Object.hasOwn(DOCS.adventure, 'loop_costs')).toBe(false);
        expect(ADV_LOG.some((e) => e?.player_data?.[P])).toBe(true);
        expect([...INITIALISE_XP_EFFECTS].sort()).toEqual([...VALID_REGION_XP_EFFECTS].sort());
        expect(INITIALISE_XP_EFFECTS[0]).toBe(DEFAULT_REGION_XP_EFFECT);
    });

    it('⛓⛓ OFF is byte-inert: absent ≡ {enabled: false} — the result, the op, the document; no block, no flag', () => {
        const pre = loopInitialised(null);
        const off = initialiseSlot({ doc: DOCS.adventure, ...S3_ARGS, loopMode: { enabled: false } });
        expect(bytes(noMs(off))).toBe(bytes(noMs(pre.res)));
        const opOff = initialiseOpFor({ ...S3_ARGS, loopMode: { enabled: false } }, off);
        expect(bytes({ ...opOff, provenance: { ...opOff.provenance, ms: 0 } }))
            .toBe(bytes({ ...pre.op, provenance: { ...pre.op.provenance, ms: 0 } }));
        expect(Object.hasOwn(pre.op.provenance, 'loopMode')).toBe(false);
        expect(Object.hasOwn(pre.op.result, 'loop_costs')).toBe(false);
        expect(Object.hasOwn(pre.out.doc, 'loop_costs')).toBe(false);
        for (const e of Object.values(pre.out.doc.preset_sidecars[P])) {
            expect(Object.hasOwn(e.playable_payload, 'manaEnabled')).toBe(false);
        }
        expect(pre.out.description).not.toContain(INITIALISE_LOOP_MODE_ON);
    });

    it('⛓⛓ ON: every payload manaEnabled, loop_costs with no generatedAt, the generator\'s block over the built copy', () => {
        const { res, op, out } = loopInitialised();
        expect(out.ok, out.error).toBe(true);
        const entries = out.doc.preset_sidecars[P];
        expect(Object.keys(entries).length).toBeGreaterThan(0);
        for (const [n, e] of Object.entries(entries)) expect(e.playable_payload.manaEnabled, n).toBe(true);
        const lc = out.doc.loop_costs[P];
        expect(lc).toEqual(op.result.loop_costs);
        expect(Object.hasOwn(lc, 'generatedAt')).toBe(false);
        // ⛓ the oracle: the pipeline's producer over the document AS BUILT (entries + return exits), stamp deleted
        const built = JSON.parse(JSON.stringify(DOCS.adventure));
        built.preset_sidecars = { [P]: res.entries };
        for (const { region, exit } of res.returnExits) built.regions[P][region].exits.push(exit);
        const want = generateLoopCosts({ rulesJson: built, sphereLog: ADV_LOG, playerId: P,
            regionXpEffect: DEFAULT_REGION_XP_EFFECT, sourceFileName: DOCS.adventure.seed_name });
        delete want.generatedAt;
        expect(lc).toEqual(want);
        // ⛓ every placed region is priced; locations too
        for (const n of Object.keys(entries)) expect(Object.hasOwn(lc.regions, n), n).toBe(true);
        expect(Object.keys(lc.locations).length).toBeGreaterThan(0);
        expect(lc.defaultRegionXpEffect).toBe(DEFAULT_REGION_XP_EFFECT);
        expect(out.description).toContain(loopModeClause(lc));
        expect(out.description).toContain(`${INITIALISE_LOOP_MODE_ON}: loop_costs written (`
            + `${Object.keys(lc.regions).length} regions, ${Object.keys(lc.locations).length} locations), `
            + INITIALISE_MANA_ON_EVERY_PAYLOAD);
    });

    it('⛓⛓ the deep diff: ON − OFF = the `loop_costs` key + the payloads\' flag; ON vs the source = the R7 set + `loop_costs`', () => {
        const on = loopInitialised().out.doc;
        const off = loopInitialised(null).out.doc;
        expect(changedPaths(off, on)).toEqual(['loop_costs.1', 'preset_sidecars.1']);
        expect(bytes(withoutLoopMode(on))).toBe(bytes(off));
        const gained = [...new Set(loopInitialised().op.result.returnExits.map((r) => r.region))].sort();
        expect(changedPaths(DOCS.adventure, on)).toEqual(['loop_costs.1', 'preset_sidecars.1', 'procgen_metadata.1',
            ...gained.map((r) => `regions.1.${r}.exits`)].sort());
    });

    it('⛓ every XP effect the form offers reaches the block; a stranger is refused by name, never normalised', () => {
        for (const fx of INITIALISE_XP_EFFECTS) {
            const r = initialiseSlot({ doc: DOCS.adventure, ...S3_ARGS, loopMode: { enabled: true, regionXpEffect: fx },
                sphereLog: ADV_LOG });
            expect(r.loop_costs.defaultRegionXpEffect, fx).toBe(fx);
        }
        const bad = { ...S3_ARGS, loopMode: { enabled: true, regionXpEffect: 'bogus' } };
        expect(initialiseOpRefusal(DOCS.adventure, bad)).toContain('`regionXpEffect` is one of');
        expect(applyRulesDocOp(DOCS.adventure, { op: INITIALISE_OP, ...bad, sphereLog: ADV_LOG }).error)
            .toContain('"bogus"');
        for (const shape of ['on', true, { enabled: 'yes' }, null]) {
            expect(initialiseOpRefusal(DOCS.adventure, { ...S3_ARGS, loopMode: shape }), String(shape))
                .toContain('`loopMode` is {enabled, regionXpEffect}');
        }
    });

    it('⛔ a SLOT that already HOLDS `loop_costs` is refused by name — pre-engine and on a record; off, it is kept', () => {
        const held = { ...JSON.parse(JSON.stringify(DOCS.adventure)),
            loop_costs: { [P]: { version: '1.0', regions: {}, locations: {} } } };
        const on = { ...S3_ARGS, loopMode: LOOP_ON };
        expect(initialiseOpRefusal(held, on)).toContain(`player ${P} already carries a \`loop_costs\` block`);
        expect(applyRulesDocOp(held, loopInitialised().op).error).toContain('already carries a `loop_costs` block');
        // ⛓ P1a — another slot's block is not this slot's: no refusal.
        const elsewhere = { ...JSON.parse(JSON.stringify(DOCS.adventure)),
            loop_costs: { 2: { version: '1.0', regions: {}, locations: {} } } };
        expect(initialiseOpRefusal(elsewhere, on)).toBeNull();
        // ⛓ the RESULT's own guard, apart from the args' (a record whose provenance lost its loopMode)
        const rec = loopInitialised().op;
        const noProv = { ...rec, provenance: { ...rec.provenance, loopMode: undefined } };
        expect(applyRulesDocOp(held, noProv).error).toContain('already carries a `loop_costs` block');
        const offOut = applyRulesDocOp(held, loopInitialised(null).op);
        expect(offOut.ok, offOut.error).toBe(true);
        expect(offOut.doc.loop_costs).toEqual(held.loop_costs);
    });

    it('⛔ NO LOG — neither the page\'s nor an embedded one — is refused by name; a log for another player too', () => {
        const on = { ...S3_ARGS, loopMode: LOOP_ON };
        const sentence = initialiseSphereLogRefusal(DOCS.adventure, on);
        expect(sentence).toBe('apworld: loop mode needs the slot\'s sphere log to price its regions; none is loaded '
            + 'and the document embeds none (`sphere_log`).');
        expect(applyRulesDocOp(DOCS.adventure, { op: INITIALISE_OP, ...on }).error).toBe(sentence);
        expect(applyRulesDocOp(DOCS.adventure, { op: INITIALISE_OP, ...on, sphereLog: [] }).error).toBe(sentence);
        const other = ADV_LOG.map((e) => (e?.player_data ? { ...e, player_data: { 9: e.player_data[P] } } : e));
        expect(initialiseSphereLogRefusal(DOCS.adventure, { ...on, sphereLog: other })).toContain('no entry for player 1');
        expect(initialiseSphereLogRefusal(DOCS.adventure, { ...S3_ARGS })).toBeNull();
        // ⛓ the record replays WITHOUT a log: its result carries the block
        const replay = applyRulesDocOp(DOCS.adventure, loopInitialised().op);
        expect(replay.ok, replay.error).toBe(true);
        expect(bytes(replay.doc)).toBe(bytes(loopInitialised().out.doc));
    });

    it('⛓ the precedence: the page\'s log, else the embedded one — and the embedded one prices the same block', () => {
        const embedded = { ...JSON.parse(JSON.stringify(DOCS.adventure)), sphere_log: ADV_LOG };
        expect(initialiseSphereLog(embedded, P, ADV_LOG).source).toBe(SPHERE_LOG_SOURCE.PAGE);
        expect(initialiseSphereLog(embedded, P, null).source).toBe(SPHERE_LOG_SOURCE.EMBEDDED);
        expect(initialiseSphereLog(DOCS.adventure, P, null)).toEqual({ entries: null, source: null, forPlayer: false });
        const script = applyRulesDocOp(embedded, { op: INITIALISE_OP, ...S3_ARGS, loopMode: LOOP_ON });
        expect(script.ok, script.error).toBe(true);
        expect(script.doc.loop_costs[P]).toEqual(loopInitialised().out.doc.loop_costs[P]);
        expect(script.op.provenance.loopMode).toEqual(LOOP_ON);
        expect(Object.hasOwn(script.op, 'sphereLog')).toBe(false);
        expect(Object.hasOwn(script.op.provenance, 'sphereLog')).toBe(false);
    });

    it('⛔ a generator THROW refuses the op by name — nothing written (no marker block: the hub edits, it does not compile)', () => {
        const broken = [...ADV_LOG, null];
        const res = initialiseSlot({ doc: DOCS.adventure, ...S3_ARGS, loopMode: LOOP_ON, sphereLog: broken });
        expect(res.ok).toBe(false);
        expect(res.stage).toBe(INITIALISE_STAGES.LOOP_COSTS);
        const out = applyRulesDocOp(DOCS.adventure, { op: INITIALISE_OP, ...S3_ARGS, loopMode: LOOP_ON, sphereLog: broken });
        expect(out.ok).toBe(false);
        expect(out.error).toBe(`${initialiseFailureSentence(DEFAULT_SUBSTRATE_ID, res)} Nothing was written.`);
        expect(out.error).toContain('`generateLoopCosts`) threw');
    });

    it('⛔ a record whose block and payload flags DISAGREE is refused — loop mode is one setting', () => {
        const { op } = loopInitialised();
        const unflagged = JSON.parse(JSON.stringify(op));
        const [first] = Object.keys(unflagged.result.entries);
        delete unflagged.result.entries[first].playable_payload.manaEnabled;
        expect(applyRulesDocOp(DOCS.adventure, unflagged).error).toContain('built without mana');
        const noBlock = JSON.parse(JSON.stringify(op));
        delete noBlock.result.loop_costs;
        expect(applyRulesDocOp(DOCS.adventure, noBlock).error).toContain('carries no `loop_costs`');
        const badBlock = JSON.parse(JSON.stringify(op));
        badBlock.result.loop_costs = { regions: [] };
        expect(applyRulesDocOp(DOCS.adventure, badBlock).error).toContain('`loop_costs` is the cost block');
    });

    it('⛓ ONE undo takes the block back with everything else', () => {
        const session = createEditSession(rulesEditAdapter, DOCS.adventure);
        const before = bytes(session.record());
        session.apply(loopInitialised().op);
        expect(Object.hasOwn(session.record().loop_costs ?? {}, P)).toBe(true);
        expect(session.undo()).toBe(true);
        expect(bytes(session.record())).toBe(before);
    });

    it('⛓ the block is written by the helper the build calls, deterministically (two builds, one byte string)', () => {
        const { res } = loopInitialised();
        const a = initialiseLoopCosts(DOCS.adventure, P, { entries: res.entries, returnExits: res.returnExits,
            sphereLog: ADV_LOG, regionXpEffect: DEFAULT_REGION_XP_EFFECT });
        const b = initialiseSlot({ doc: DOCS.adventure, ...S3_ARGS, loopMode: LOOP_ON, sphereLog: ADV_LOG }).loop_costs;
        expect(bytes(a)).toBe(bytes(res.loop_costs));
        expect(bytes(b)).toBe(bytes(res.loop_costs));
    });
});

/* ── P1a: the blocks are per slot ───────────────────────────────────────── */

/**
 * ⛓ `doc` with a SECOND slot `q` whose every per-player value is `source`'s slot
 * `P`, bare (a copy; the slot maps an initialise writes are left alone). Derived
 * from the document's own keys — any top-level object keyed by the slot id.
 */
function withSecondSlot(doc, source, q) {
    const out = JSON.parse(JSON.stringify(doc));
    for (const [k, v] of Object.entries(source)) {
        if (SLOT_MAPS.includes(k) || !v || typeof v !== 'object' || Array.isArray(v) || !Object.hasOwn(v, P)) continue;
        out[k] = { ...(out[k] ?? {}), [q]: JSON.parse(JSON.stringify(v[P])) };
    }
    return out;
}

describe('P1a — `procgen_metadata` and `loop_costs` are per slot: a second slot initialises beside the first', () => {
    it('⛓⛓ slot 2 is not refused by slot 1\'s blocks, writes procgen_metadata["2"] + loop_costs["2"], and slot 1\'s stay byte-identical', () => {
        const Q = '2';
        const one = loopInitialised().out.doc;
        expect(Object.keys(one.procgen_metadata)).toEqual([P]);
        expect(Object.keys(one.loop_costs)).toEqual([P]);
        const two = withSecondSlot(one, DOCS.adventure, Q);
        const logQ = ADV_LOG.map((e) => (e?.player_data ? { ...e, player_data: { ...e.player_data, [Q]: e.player_data[P] } } : e));
        const args = { ...S3_ARGS, player: Q, loopMode: LOOP_ON };
        expect(initialiseFacts(two, Q).blocker).toBeNull();
        expect(initialiseOpRefusal(two, args)).toBeNull();
        const out = applyRulesDocOp(two, { op: INITIALISE_OP, ...args, sphereLog: logQ });
        expect(out.ok, out.error).toBe(true);
        expect(Object.keys(out.doc.procgen_metadata).sort()).toEqual([P, Q]);
        expect(Object.keys(out.doc.loop_costs).sort()).toEqual([P, Q]);
        expect(bytes(out.doc.procgen_metadata[P])).toBe(bytes(one.procgen_metadata[P]));
        expect(bytes(out.doc.loop_costs[P])).toBe(bytes(one.loop_costs[P]));
        expect(out.doc.procgen_metadata[Q].driver).toBe(INITIALISE_DRIVER);
        expect(out.doc.procgen_metadata[Q].region_count).toBe(Object.keys(out.doc.preset_sidecars[Q]).length);
        for (const n of Object.keys(out.doc.preset_sidecars[Q])) expect(Object.hasOwn(out.doc.loop_costs[Q].regions, n), n).toBe(true);
        expect(changedPaths(two, out.doc).filter((x) => !x.startsWith(`regions.${Q}.`)))
            .toEqual([`loop_costs.${Q}`, `preset_sidecars.${Q}`, `procgen_metadata.${Q}`]);
        // ⛔ and a second initialise of slot 2 is now refused by SLOT 2's block, by name
        expect(initialiseOpRefusal({ ...out.doc, preset_sidecars: { ...out.doc.preset_sidecars, [Q]: {} } }, args))
            .toContain(`player ${Q} already carries a \`procgen_metadata\` block`);
    });
});
