/**
 * apworldEditor/regionRegenerate — **ONE REGION'S PAYLOAD REBUILT FOR A
 * SUBSTRATE: THE ROWS** (APWORLD SUBSTRATE CHANGE R0). The
 * `regenerate-region-sidecar` op of `rulesDocOps.js`, asked of the OP through
 * `applyRulesDocOp`, and the module behind it, on the committed documents the
 * plan probed (§1.4): the four-player fixture and `procgen_topdown/AP_10`.
 *
 * ⛓ These rows live beside the sibling rather than in `rulesDocOps.test.js`
 * because they need committed payloads and a registry with every substrate in
 * it (the `regionLayout.test.js` recipe).
 *
 * ⛓⛓ Every count is DERIVED from the documents or the registry at run time;
 * a row that asserts a guard has a driven mutant recorded in the plan's §7.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { OPPOSITE_SIDE } from '../shared/procgen/spatialPrimitives.js';
import { createRng } from '../shared/rng.js';
import {
    DEFAULT_REGION_SIZE, generateRegion, getRegionExits, linkIsAdjacentOnSide,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { REGENERATE_RULES_UNCHANGED, applyRulesDocOp } from './rulesDocOps.js';
import { sidecarIssues } from './sidecarIssues.js';
import { slotLayout } from './regionLayout.js';
import {
    REGION_SIZE_SOURCES, bfsParents, buildDocumentRegionSpec, defaultRegionParamsFor, exitShortName,
    freeItemsFor, regionRealiserKind, regionSizeFor,
} from './regionRegenerate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const read = (rel) => JSON.parse(readFileSync(join(PRESETS, rel), 'utf8'));
const bytes = (o) => JSON.stringify(o);
const FOUR_PATH = 'multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json';
const AP10_PATH = 'procgen_topdown/AP_10/AP_10_rules.json';
const DOCS = { four: read(FOUR_PATH), ap10: read(AP10_PATH) };

/** ⛓ The plan's eight probed region × target pairs (§1.4), as rows. */
const PAIRS = [
    ['four', '3', 'region_1_0', 'maze'],
    ['four', '1', 'region_1_0', 'bounce'],
    ['four', '1', 'region_1_0', 'text_adventure'],
    ['four', '3', 'region_2_0', 'runner'],
    ['ap10', '1', 'Overworld', 'text_adventure'],
    ['ap10', '1', 'YellowCastle', 'maze'],
    ['ap10', '1', 'WhiteCastle', 'maze'],
    ['ap10', '1', 'BlackCastle', 'text_adventure'],
];
const regenOp = (p, region, substrate, extra = {}) => ({
    op: 'regenerate-region-sidecar', player: p, region, substrate, seed: 1, ...extra,
});

/** The payload exit of `entry` a document exit name speaks of (id, with or without the prefix). */
const payloadExit = (entry, region, docName) => (entry?.playable_payload?.exits ?? [])
    .find((x) => x.exit_id === exitShortName(region, docName));

const errorMessages = (doc, p) => new Set(sidecarIssues(doc, p)
    .filter((i) => i.severity === 'error').map((i) => `${i.kind}|${i.region}|${i.message ?? ''}`));

describe('which registered entries can rebuild a region (regionRealiserKind)', () => {
    it('⛓ agrees with the ENGINE\'s own dispatch over every registered entry', () => {
        const all = substrateRegistry.getAll();
        const realisers = all.filter((e) => regionRealiserKind(e) !== null);
        for (const e of all) {
            let msg = '';
            try {
                generateRegion({
                    substrate: e.id, region_id: 'probe', size: { ...DEFAULT_REGION_SIZE }, rng: createRng(1),
                    entrances: [], exits: [], locations: [], params: {}, useSourceLocationName: true,
                });
            } catch (err) { msg = String(err?.message ?? err); }
            const engineRefuses = /has neither generateRegionCore nor generateZoneForSpecs/.test(msg);
            expect(engineRefuses, `${e.id}: kind ${regionRealiserKind(e)}, engine said "${msg}"`)
                .toBe(regionRealiserKind(e) === null);
        }
        // ⛓ both classes are populated, or the row proves nothing
        expect(realisers.length, `${realisers.length} of ${all.length} realise`).toBeGreaterThan(0);
        expect(realisers.length, `${realisers.length} of ${all.length} realise`).toBeLessThan(all.length);
    });

    it('⛔ the op refuses EVERY registered target without a realiser, by its registry facts', () => {
        const doc = DOCS.four;
        const none = substrateRegistry.getAll().filter((e) => regionRealiserKind(e) === null
            && typeof e.deserializeWorld === 'function');
        expect(none.length).toBeGreaterThan(0);
        for (const e of none) {
            const res = applyRulesDocOp(doc, regenOp('1', 'region_1_0', e.id));
            expect(res.ok, e.id).toBe(false);
            expect(res.error, e.id).toContain(`\`${e.id}\` has no per-region realiser`);
            if (Number.isInteger(e.zoneCount) && typeof e.extractZoneRules === 'function') {
                expect(res.error, e.id).toContain(`\`zoneCount\` ${e.zoneCount}`);
                expect(res.error, e.id).toContain('selecting a zone is a later rung');
            }
        }
    });
});

describe('the spec, from the document (buildDocumentRegionSpec)', () => {
    it.each(PAIRS)('%s slot %s %s: exits, sides, the parent pin and the location ids', (key, p, region) => {
        const doc = DOCS[key];
        const source = doc.regions[p][region];
        const old = doc.preset_sidecars[p][region];
        const spec = buildDocumentRegionSpec(doc, p, region);
        expect(spec.locationSpecs.map((l) => l.id)).toEqual(source.locations.map((l) => l.name));
        expect(spec.locationSpecs.map((l) => l.item))
            .toEqual(source.locations.map((l) => l.item?.name ?? null));
        expect(spec.exitSpecs.map((e) => e.exit_id)).toEqual(source.exits.map((e) => exitShortName(region, e.name)));
        expect(spec.exitSpecs.map((e) => e.target_region)).toEqual(source.exits.map((e) => e.connected_region));
        const parent = bfsParents(doc, p).get(region);
        expect(spec.parent).toEqual(parent ?? null);
        if (spec.entrances.length) {
            // the entrance faces the parent's exit, read off the parent's OWN payload
            const px = payloadExit(doc.preset_sidecars[p][parent.name], parent.name, parent.exit);
            expect(spec.entrances[0].side).toBe(OPPOSITE_SIDE[px.side]);
        }
        for (const [i, e] of spec.exitSpecs.entries()) {
            const pinned = spec.entrances.length && e.target_region === parent?.name;
            if (pinned) {
                expect({ side: e.side, tile: e.tile }).toEqual(spec.entrances[0]);
            } else {
                expect(e.side ?? null, e.exit_id)
                    .toBe(payloadExit(old, region, source.exits[i].name)?.side ?? null);
            }
        }
    });

    it('⛓⛓ the entrance tile REPRODUCES every maze entrance the pipeline stored (both documents)', () => {
        let checked = 0;
        for (const doc of Object.values(DOCS)) {
            for (const [p, slot] of Object.entries(doc.preset_sidecars)) {
                for (const [r, e] of Object.entries(slot)) {
                    if (e.substrate !== 'maze' || !doc.regions[p]?.[r]) continue;
                    const spec = buildDocumentRegionSpec(doc, p, r);
                    if (!spec.entrances.length) continue;
                    expect(spec.entrances[0].tile, `${p}/${r}`).toEqual({
                        x: e.playable_payload.entrance.x, y: e.playable_payload.entrance.y,
                    });
                    checked += 1;
                }
            }
        }
        expect(checked, `${checked} maze entrances compared`).toBeGreaterThan(0);
    });
});

describe('the op on the probed pairs — through applyRulesDocOp', () => {
    it.each(PAIRS)('%s slot %s %s → %s: ONLY the entry moves, names kept, no new sidecarIssues error', (key, p, region, target) => {
        const doc = DOCS[key];
        const before = bytes(doc);
        const res = applyRulesDocOp(doc, regenOp(p, region, target));
        expect(res.ok, res.error).toBe(true);
        expect(bytes(doc), 'the op mutated its input').toBe(before);
        expect(res.description.endsWith(REGENERATE_RULES_UNCHANGED)).toBe(true);
        // the document AFTER: everything but the entry is byte-identical
        const want = JSON.parse(before);
        want.preset_sidecars[p][region] = res.doc.preset_sidecars[p][region];
        expect(bytes(res.doc)).toBe(bytes(want));
        const entry = res.doc.preset_sidecars[p][region];
        expect(entry.substrate).toBe(target);
        expect(entry.grid_cell).toEqual(doc.preset_sidecars[p][region].grid_cell);
        // the names ride into the payload verbatim
        const carried = new Set(substrateRegistry.get(target).apLocationNamesOf(entry.playable_payload));
        for (const loc of doc.regions[p][region].locations) {
            expect(carried.has(loc.name), `${loc.name} not carried`).toBe(true);
        }
        // 0 NEW errors in the validity report
        const baseline = errorMessages(doc, p);
        const added = [...errorMessages(res.doc, p)].filter((m) => !baseline.has(m));
        expect(added).toEqual([]);
    });

    it('⛓ determinism: the same op is the same bytes; another seed is not (a procedural and a zone target)', () => {
        for (const [key, p, region, target] of [PAIRS[0], PAIRS[3]]) {
            const doc = DOCS[key];
            const a = applyRulesDocOp(doc, regenOp(p, region, target)).doc.preset_sidecars[p][region];
            const b = applyRulesDocOp(doc, regenOp(p, region, target)).doc.preset_sidecars[p][region];
            const c = applyRulesDocOp(doc, regenOp(p, region, target, { seed: 2 })).doc.preset_sidecars[p][region];
            expect(bytes(a), target).toBe(bytes(b));
            expect(bytes(c), target).not.toBe(bytes(a));
        }
    });

    it('⛓ substrate absent is the RE-ROLL — the entry\'s own substrate, a new payload', () => {
        const doc = DOCS.ap10;
        const res = applyRulesDocOp(doc, { op: 'regenerate-region-sidecar', player: '1', region: 'Overworld', seed: 99 });
        expect(res.ok, res.error).toBe(true);
        expect(res.doc.preset_sidecars['1'].Overworld.substrate).toBe(doc.preset_sidecars['1'].Overworld.substrate);
        expect(bytes(res.doc.preset_sidecars['1'].Overworld.playable_payload))
            .not.toBe(bytes(doc.preset_sidecars['1'].Overworld.playable_payload));
    });
});

describe('the re-link — ③ for one region', () => {
    it('⛓ a FRESH descriptor carries no targetExitId (the premise the re-link answers)', () => {
        const doc = DOCS.ap10;
        const spec = buildDocumentRegionSpec(doc, '1', 'YellowCastle');
        const d = generateRegion({
            substrate: 'maze', region_id: 'YellowCastle', size: spec.size, entrances: spec.entrances,
            exits: spec.exitSpecs, locations: spec.locationSpecs, rng: createRng(1), params: { maxIterations: 0 },
            useSourceLocationName: true, stampEntrance: true,
        });
        for (const x of getRegionExits(d).values()) expect(x.targetExitId ?? null).toBeNull();
    });

    it('⛓⛓ AP_10 YellowCastle → maze: its exit names the counterpart the TARGET\'s payload holds', () => {
        const doc = DOCS.ap10;
        const res = applyRulesDocOp(doc, regenOp('1', 'YellowCastle', 'maze'));
        const exits = res.doc.preset_sidecars['1'].YellowCastle.playable_payload.exits;
        expect(exits.length).toBeGreaterThan(0);
        for (const x of exits) {
            const back = doc.preset_sidecars['1'][x.targetRegion].playable_payload.exits
                .filter((b) => b.targetRegion === 'YellowCastle');
            const want = (back.find((b) => b.targetExitId === x.exit_id) ?? back[0])?.exit_id;
            expect(want, `${x.exit_id}: the target holds no exit back`).toBeTruthy();
            expect(x.targetExitId, x.exit_id).toBe(want);
        }
        expect(exits.find((x) => x.exit_id === 'YellowCastleExit').targetExitId).toBe('YellowCastlePort');
    });

    it('⛓ every pair: targetExitId re-linked, isTeleporter by the side law, isBackExit from the old exit', () => {
        for (const [key, p, region, target] of PAIRS) {
            const doc = DOCS[key];
            const res = applyRulesDocOp(doc, regenOp(p, region, target));
            const layout = slotLayout(doc, p);
            const oldExits = doc.preset_sidecars[p][region].playable_payload.exits;
            for (const x of res.doc.preset_sidecars[p][region].playable_payload.exits) {
                const at = `${key}/${p}/${region}/${x.exit_id}`;
                const back = (doc.preset_sidecars[p][x.targetRegion]?.playable_payload?.exits ?? [])
                    .filter((b) => b.targetRegion === region);
                expect(x.targetExitId ?? null, at)
                    .toBe((back.find((b) => b.targetExitId === x.exit_id) ?? back[0])?.exit_id ?? null);
                expect(x.isBackExit, at).toBe(oldExits.find((o) => o.exit_id === x.exit_id)?.isBackExit === true);
                expect(x.isTeleporter, at).toBe(!linkIsAdjacentOnSide(layout.grid,
                    layout.cells.get(region), x.side, layout.cells.get(x.targetRegion)));
            }
        }
    });
});

describe('isTeleporter is the SIDE LAW\'s, not the old flag', () => {
    it('⛓ a region whose cell no longer neighbours its target: the fresh exit IS a teleporter', () => {
        const doc = JSON.parse(bytes(DOCS.ap10));
        const { grid, cells } = slotLayout(doc, '1');
        const region = 'YellowCastle';
        const x0 = doc.preset_sidecars['1'][region].playable_payload.exits[0];
        expect(x0.isTeleporter, 'the premise: the stored link is adjacent').toBe(false);
        // the first empty cell that is NOT the target's neighbour on the exit's side
        const there = cells.get(x0.targetRegion);
        let away = null;
        for (let gy = 0; gy < grid.height && !away; gy += 1) {
            for (let gx = 0; gx < grid.width && !away; gx += 1) {
                const c = { gx, gy };
                if (!grid.hasRegion(c) && !linkIsAdjacentOnSide(grid, c, x0.side, there)) away = c;
            }
        }
        expect(away, 'the map has no empty non-adjacent cell').toBeTruthy();
        doc.preset_sidecars['1'][region].grid_cell = away;
        const res = applyRulesDocOp(doc, regenOp('1', region, 'maze'));
        expect(res.ok, res.error).toBe(true);
        const x = res.doc.preset_sidecars['1'][region].playable_payload.exits.find((e) => e.exit_id === x0.exit_id);
        expect(x.isTeleporter).toBe(true);
    });
});

describe('the items that ride free (freeItemsFor) — top-down\'s rule', () => {
    const bounce = () => substrateRegistry.get('bounce');
    const columnParams = () => ({ ...defaultRegionParamsFor(bounce()), bounceMode: 'column' });

    it('⛓ starting items first, then the target\'s library items the document does not define, no victory', () => {
        const lib = bounce().libraryItems;
        for (const doc of Object.values(DOCS)) {
            for (const p of Object.keys(doc.preset_sidecars)) {
                const got = freeItemsFor(doc, p, bounce());
                const starting = doc.starting_items?.[p] ?? [];
                expect(got.slice(0, starting.length)).toEqual(starting);
                for (const [name, def] of Object.entries(lib)) {
                    const want = !def?.is_victory && doc.items?.[p]?.[name] == null;
                    expect(got.includes(name), `${p}/${name}`).toBe(want || starting.includes(name));
                }
            }
        }
    });

    it('⛓⛓ BOTH WAYS: a column-mode bounce region with two plain exits builds WITH the rule and is refused WITHOUT it', () => {
        const doc = DOCS.ap10;
        const region = 'BlackCastle';
        expect(doc.regions['1'][region].exits.length).toBeGreaterThan(1);
        const withRule = applyRulesDocOp(doc, regenOp('1', region, 'bounce', { regionParams: columnParams() }));
        expect(withRule.ok, withRule.error).toBe(true);
        const n = freeItemsFor(doc, '1', bounce()).length;
        expect(withRule.description).toContain(`${n} item${n === 1 ? '' : 's'} rode free`);
        const without = applyRulesDocOp(doc, regenOp('1', region, 'bounce', {
            regionParams: columnParams(), freeItems: [],
        }));
        expect(without.ok).toBe(false);
        expect(without.error).toContain('at most one arrowless-gated exit per level');
        expect(without.error).toContain('0 items riding free');
    });

    it('⛓ the DEFAULT params (the target\'s buildRegionParams) host surplus exits natively — free items or not', () => {
        const doc = DOCS.ap10;
        const res = applyRulesDocOp(doc, regenOp('1', 'BlackCastle', 'bounce', { freeItems: [] }));
        expect(res.ok, res.error).toBe(true);
    });
});

describe('the region size (⚖ Q4 B-then-A) — regionSizeFor', () => {
    it('⛓ the three steps, in order: the declared size, the slot\'s modal tile size, the default', () => {
        const four = DOCS.four;
        const modal = regionSizeFor(four, '1');
        expect(modal.source).toBe(REGION_SIZE_SOURCES[1]);
        const sizes = Object.values(four.preset_sidecars['1']).map((e) => e.playable_payload)
            .filter((pl) => Number.isInteger(pl?.width)).map((pl) => `${pl.width}x${pl.height}`);
        const count = (k) => sizes.filter((s) => s === k).length;
        for (const k of sizes) expect(count(`${modal.width}x${modal.height}`)).toBeGreaterThanOrEqual(count(k));

        const declared = JSON.parse(bytes(four));
        declared.procgen_metadata.region_size = { width: modal.width + 3, height: modal.height + 5 };
        expect(regionSizeFor(declared, '1')).toEqual({
            width: modal.width + 3, height: modal.height + 5, source: REGION_SIZE_SOURCES[0],
        });

        // a slot holding no tile payload (the fixture's bounce slot) falls to the default
        const sidesOnly = Object.keys(four.preset_sidecars).find((p) => Object.values(four.preset_sidecars[p])
            .every((e) => !Number.isInteger(e.playable_payload?.width)));
        expect(sidesOnly).toBeTruthy();
        expect(regionSizeFor(four, sidesOnly)).toEqual({ ...DEFAULT_REGION_SIZE, source: REGION_SIZE_SOURCES[2] });
    });

    it('⛓ the op\'s size reaches a tile target; a declared size moves the payload', () => {
        const doc = DOCS.four;
        const res = applyRulesDocOp(doc, regenOp('3', 'region_1_0', 'maze', { size: { width: 11, height: 9 } }));
        expect(res.ok, res.error).toBe(true);
        const pl = res.doc.preset_sidecars['3'].region_1_0.playable_payload;
        expect(pl.width).toBeGreaterThanOrEqual(11);
        expect(pl.height).toBeGreaterThanOrEqual(9);
    });
});
