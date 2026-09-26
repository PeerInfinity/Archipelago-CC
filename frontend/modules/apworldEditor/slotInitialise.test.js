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
import { layoutTopDown } from '../procgenPipeline/procgenPipelineEngine.js';
import { createRng } from '../shared/rng.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { sidecarIssues } from './sidecarIssues.js';
import { validateRules } from './rulesUtils.js';
import { regionRealiserKind } from './regionRegenerate.js';
import {
    INITIALISE_BARE_ONLY, INITIALISE_RETURN_EXITS_ADDED, INITIALISE_RETURN_EXITS_OFF,
    INITIALISE_RULES_UNCHANGED, INITIALISE_UNPLACED, REGENERATE_SEED_REQUIRED, RULES_OP_KINDS,
    applyRulesDocOp, canonicalPlacementIssues, describeInitialise, initialiseOpRefusal,
} from './rulesDocOps.js';
import {
    BACK_EXITS, DEFAULT_SUBSTRATE_ID, INITIALISE_BLOCKERS, INITIALISE_DRIVER, INITIALISE_GRID_GROWTH_LIMIT,
    INITIALISE_OP, UNPLACED_WHY, autoGridSide, initialiseFacts, initialiseGridSide, initialiseOpFor,
    initialiseSlot, initialiseTargets, planInitialise, unplacedRegions,
} from './slotInitialise.js';

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
    copy.procgen_metadata = res.procgen_metadata;
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

    it('⛓ no regions / no usable start / a document-level metadata block — each its own blocker', () => {
        const doc = JSON.parse(JSON.stringify(DOCS.adventure));
        expect(initialiseFacts(doc, '7').blocker).toBe(INITIALISE_BLOCKERS.NO_REGIONS);
        const noStart = JSON.parse(JSON.stringify(doc));
        noStart.start_regions[P] = ['Nowhere'];
        expect(initialiseFacts(noStart, P).blocker).toBe(INITIALISE_BLOCKERS.NO_START);
        const meta = JSON.parse(JSON.stringify(doc));
        meta.procgen_metadata = { driver: 'top-down' };
        expect(initialiseFacts(meta, P).blocker).toBe(INITIALISE_BLOCKERS.HAS_METADATA);
    });

    it('⛓ the resolved start and Menu are the LAYOUT\'s own (the engine\'s rule is not exported)', () => {
        for (const game of Object.keys(DOCS)) {
            const f = initialiseFacts(DOCS[game], P);
            const layout = layoutTopDown(DOCS[game], { playerId: P, gridDims: { width: 30, height: 30 } }, createRng(1));
            expect(f.start, game).toBe(layout.actualStartName);
            expect(f.menu, game).toBe(layout.menuName);
        }
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

    it('⛓ pokemon_rb (layout only): the unplaced are reachable ONLY from the stripped Menu', () => {
        const doc = DOCS.pokemon_rb;
        const plan = planInitialise(doc, P);
        const { menu } = initialiseFacts(doc, P);
        expect(menu).toBeTruthy();
        const incoming = incomingOf(doc);
        expect(plan.unplaced.length).toBeGreaterThan(0);
        for (const u of plan.unplaced) {
            expect(u.why, u.region).toBe(UNPLACED_WHY.ONLY_FROM_MENU);
            expect([...incoming.get(u.region)], u.region).toEqual([menu]);
        }
        expect(plan.placed + plan.unplaced.length).toBe(plan.total);
    });

    it('⛓ a 1×1 grid: the region with a placed parent has NO FREE CELL, its child ONLY FROM UNPLACED', () => {
        const doc = {
            start_regions: { [P]: ['A'] },
            regions: {
                [P]: {
                    A: { name: 'A', exits: [{ name: 'A→B', connected_region: 'B' }], locations: [] },
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
            for (const u of plan.unplaced) {
                const from = Object.entries(regions).filter(([n, r]) => n !== u.region
                    && (r.exits ?? []).some((e) => e.connected_region === u.region)).map(([n]) => n);
                if (u.why === UNPLACED_WHY.NO_INCOMING) expect(from, `${f} ${u.region}`).toEqual([]);
                if (u.why === UNPLACED_WHY.ONLY_FROM_MENU) expect(from, `${f} ${u.region}`).toEqual([facts.menu]);
            }
        }
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

    it('⛓ procgen_metadata: the driver, the slot, the counts, the cells\' extent; no configs for a maze slot', () => {
        const res = initialised('apcalc', DEFAULT_SUBSTRATE_ID);
        const m = res.procgen_metadata;
        expect(m.driver).toBe(INITIALISE_DRIVER);
        expect(m.player).toBe(P);
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

/** ⛓ Every changed path, two levels deep under `regions.<p>.<R>`, one level elsewhere. */
function changedPaths(a, b) {
    const out = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (bytes(a[k]) === bytes(b[k])) continue;
        if (k === 'regions' || k === 'preset_sidecars') {
            for (const p of new Set([...Object.keys(a[k] ?? {}), ...Object.keys(b[k] ?? {})])) {
                if (bytes(a[k]?.[p]) === bytes(b[k]?.[p])) continue;
                if (k === 'preset_sidecars') { out.push(`${k}.${p}`); continue; }
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
            'preset_sidecars.1', 'procgen_metadata', ...gained.map((r) => `regions.1.${r}.exits`),
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
        expect(changedPaths(doc, res.doc)).toEqual(['preset_sidecars.1', 'procgen_metadata']);
        expect(res.description).toContain(INITIALISE_RETURN_EXITS_OFF);
    });

    it('⛓ the description interpolates every number, and names the unplaced by name and why', () => {
        const apc = landedOp('apcalc');
        const r1 = applyRulesDocOp(DOCS.apcalc, apc);
        const s = apc.result.stats;
        const g = apc.provenance.gridDims;
        expect(r1.description.startsWith(`slot ${P} initialised as \`${DEFAULT_SUBSTRATE_ID}\`: ${s.placed} regions on a `
            + `${g.width}×${g.height} grid (${s.teleporters} teleporters), ${s.returnExits} ${INITIALISE_RETURN_EXITS_ADDED}, `
            + `0 regions ${INITIALISE_UNPLACED} — ${INITIALISE_RULES_UNCHANGED}`)).toBe(true);
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
        const meta = { ...doc, procgen_metadata: { driver: 'top-down' } };
        expect(initialiseOpRefusal(meta, good)).toContain('`procgen_metadata`');
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
