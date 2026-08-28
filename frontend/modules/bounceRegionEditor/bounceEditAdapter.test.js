/**
 * ⛓⛓⛓ **THE BOUNCE ADAPTER, THE CELL-LESS SESSION, AND THE SAVE MERGE'S
 * IMPORT** (EDITOR INTEGRATION slice B-b).
 *
 * Three subjects, and each is a claim the slice makes:
 *
 *  1. the adapter is `{name, apply, equal}` and NOTHING else — the first
 *     cell-less adapter, and `assertAdapterBehaviour` says which three laws it
 *     therefore skipped rather than returning a green about seven;
 *  2. a BARE `createEditSession` is the whole session — undo, the payload and
 *     `value` all work with no bounce-side session module, which is what the
 *     `value` forwarding (trap 857) bought;
 *  3. `buildEditedRegion` is byte-identical to the panel body it replaced, so
 *     the verifier's copy could be deleted rather than kept in sync.
 */

import { describe, expect, it } from 'vitest';

import {
    CELL_SPACE_LAWS, assertAdapter, assertAdapterBehaviour, createEditSession,
    descriptorFieldsOf, floodOps, group, hasCellSpace, rectCopy, rectPasteOps,
} from '../procgenCore/editCore.js';
import { assembleBounceRegionFromLevel } from '../bounceDemo/bounceDemoLibrary.js';
import { easyTower } from '../bounceDemo/fixtures/easyTower.js';
import { bounceEditAdapter, levelsEqual } from './bounceEditAdapter.js';
import { deletePlatformOps } from './bounceLevelOps.js';
import { buildEditedRegion } from './buildEditedRegion.js';

const base = () => structuredClone(easyTower);
const openSession = (level = base()) => createEditSession(bounceEditAdapter, level, {
    base: { kind: 'bounce-level', region_id: 'r1' },
});

describe('⛓⛓⛓ the adapter declares NO CELL SPACE', () => {
    /** ⛓ MUTANT: add a `bounds: () => ({w: level.size.width, h: …})` "for
     *  completeness" — the trio is then partial and `assertAdapter` refuses it,
     *  or (with all three stubbed) `editorView` would happily mount an editor
     *  whose every tool discards a float cell. */
    it('is exactly {name, apply, equal}', () => {
        expect(Object.keys(bounceEditAdapter).sort()).toEqual(['apply', 'equal', 'name']);
        expect(bounceEditAdapter.name).toBe('bounce');
        expect(hasCellSpace(bounceEditAdapter)).toBe(false);
        expect(assertAdapter(bounceEditAdapter)).toBe(bounceEditAdapter);
    });

    /** ⛓ The four cell-space callers refuse it by name — the widening's point. */
    it.each([
        ['rectCopy', (r) => rectCopy(bounceEditAdapter, r, { x: 0, y: 0, w: 1, h: 1 })],
        ['rectPasteOps', (r) => rectPasteOps(bounceEditAdapter, r,
            { w: 1, h: 1, cells: [[{}]] }, 0, 0)],
        ['floodOps', (r) => floodOps(bounceEditAdapter, r, 0, 0, {})],
        ['descriptorFieldsOf', (r) => descriptorFieldsOf(bounceEditAdapter, r)],
    ])('`%s` refuses it BY NAME', (name, call) => {
        expect(() => call(base())).toThrow(
            new RegExp(`bounce declares no cell space — ${name} needs bounds/readCell/writeOps`));
    });

    /**
     * ⛓⛓⛓ **THE SKIPPED LAWS ARE SAID, NOT ASSUMED** (trap 806's family). The
     * brief said "laws 1–6, skip 7"; three of the seven are cell-space laws.
     * ⛓ MUTANT: call this without `say` — it REFUSES, which is the point.
     */
    it('`assertAdapterBehaviour` passes laws 2–5 and NAMES the three it skipped', () => {
        const said = [];
        expect(assertAdapterBehaviour(bounceEditAdapter, {
            record: base(),
            op: { op: 'set-platform', id: 'p0', patch: { y: 890 } },
            refused: { op: 'set-platform', id: 'ghost', patch: { y: 1 } },
            say: (line) => said.push(line),
        })).toBe(true);
        expect(said).toHaveLength(3);
        for (const { n, member } of CELL_SPACE_LAWS) {
            expect(said.some((l) => l.includes(`contract law ${n} (\`${member}\``)),
                said.join(' | ')).toBe(true);
        }
        expect(said[0]).toMatch(/^editCore: the bounce adapter declares no cell space/);
    });

    it('⛔ and without `say` it REFUSES rather than answering a bare `true`', () => {
        expect(() => assertAdapterBehaviour(bounceEditAdapter, {
            record: base(),
            op: { op: 'resize', dim: 'width', value: 420 },
            refused: { op: 'resize', dim: 'depth', value: 1 },
        })).toThrow(/laws 1, 6, 7 CANNOT be asked/);
    });
});

describe('⛓⛓⛓ `equal` — a deep equality in which KEY ORDER IS CONTENT', () => {
    /**
     * ⛓⛓⛓ MUTANT — **the `canonicalJson` row.** Swap `levelsEqual` for
     * `canonicalJson(a) === canonicalJson(b)` (or for the atlas hash) and this
     * row goes RED: a key-order-only difference reads EQUAL, so `foldEdits`
     * drops the op from the identity while `_exportLevel`'s
     * `JSON.stringify(level, null, 2)` writes different bytes to a file a
     * person diffs.
     */
    it('two levels differing ONLY in key order are NOT equal', () => {
        const a = { id: 'x', size: { width: 1, height: 2 }, platforms: [] };
        const b = { size: { width: 1, height: 2 }, id: 'x', platforms: [] };
        expect(levelsEqual(a, b)).toBe(false);
        expect(JSON.stringify(Object.keys(a).sort())).toBe(JSON.stringify(Object.keys(b).sort()));
        const nested = { id: 'x', size: { height: 2, width: 1 }, platforms: [] };
        expect(levelsEqual(a, nested)).toBe(false);

        /**
         * ⛔⛔ AND A PAIR THE VALUE COMPARISON CANNOT ANSWER — because the three
         * assertions above CANNOT SEE THE KEY-NAME CHECK, measured (EDITOR
         * INTEGRATION B-c, trap 951). Delete `if (ka[i] !== kb[i]) return
         * false;` from the predicate and every one of them still reads `false`:
         * each swaps keys whose VALUES DIFFER, so the walk compares two
         * different values and answers for a reason unrelated to key order.
         *
         * ⇒ Two keys holding THE SAME VALUE, swapped, at the top and at depth.
         */
        const same = { id: 'x', label: 'x', platforms: [] };
        const sameSwapped = { label: 'x', id: 'x', platforms: [] };
        expect(levelsEqual(same, sameSwapped)).toBe(false);
        expect(levelsEqual(
            { size: { width: 3, height: 3 } },
            { size: { height: 3, width: 3 } },
        )).toBe(false);
    });

    it('is a real equality otherwise — reflexive, deep, array-order-sensitive', () => {
        expect(levelsEqual(easyTower, structuredClone(easyTower))).toBe(true);
        expect(levelsEqual(easyTower, easyTower)).toBe(true);
        const swapped = structuredClone(easyTower);
        [swapped.platforms[0], swapped.platforms[1]] = [swapped.platforms[1], swapped.platforms[0]];
        expect(levelsEqual(easyTower, swapped)).toBe(false);
        expect(levelsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(levelsEqual([1], { 0: 1 })).toBe(false);
    });
});

describe('⛓⛓⛓ a BARE `createEditSession` is the whole bounce session', () => {
    /**
     * ⛓⛓⛓ MUTANT — **the forwarding row, from the substrate side.** Drop the
     * `value` spread from `createEditSession.apply` and this goes RED, and the
     * bounce editor would need B-a's side-slot mechanism to learn the id of
     * the platform it just added.
     */
    it('`apply(add-platform).value` IS the new platform — no slot, no subclass', () => {
        const sess = openSession();
        const res = sess.apply({ op: 'add-platform' });
        expect(res.applied).toBe(true);
        expect(res.value).toEqual({ id: 'p7', type: 'green', x: 200, y: 500 });
        expect(sess.record().platforms.at(-1)).toEqual(res.value);
    });

    it('a refused op moves nothing and carries no `value`', () => {
        const sess = openSession();
        const before = sess.record();
        const res = sess.apply({ op: 'set-platform', id: 'ghost', patch: { x: 1 } });
        expect(res.ok).toBe(false);
        expect('value' in res).toBe(false);
        expect(sess.record()).toBe(before);
        expect(sess.ops()).toHaveLength(0);
    });

    /** ⛓ "A no-op is not an edit" is the SESSION's rule through `equal` — the
     *  ops never refuse an identical patch. ⛓ MUTANT: make `set-platform`
     *  refuse a no-op patch itself; the panel would then print a refusal for a
     *  field the person re-typed unchanged. */
    it('an identical patch is APPLIED-FALSE, not refused — the core\'s rule, not the op\'s', () => {
        const sess = openSession();
        const res = sess.apply({ op: 'set-platform', id: 'p0', patch: { x: 200 } });
        expect(res.ok).toBe(true);
        expect(res.applied).toBe(false);
        expect(sess.ops()).toHaveLength(0);
    });

    /**
     * ⛓⛓⛓ **N ops → undo ×N → the base, byte for byte** — the gate row, on
     * the substrate. ⛓ MUTANT: any op that mutates in place; undo re-folds
     * from the base and the in-place write survives.
     */
    it('N ops → undo ×N → the base, byte for byte', () => {
        const start = base();
        const sess = openSession(structuredClone(start));
        sess.apply({ op: 'resize', dim: 'width', value: 420 });
        sess.apply({ op: 'add-platform' });
        sess.apply({ op: 'add-entity', kind: 'springs', on: 'p7' });
        sess.apply(group('delete platform p6', deletePlatformOps(sess.record(), 'p6')));
        sess.apply({ op: 'set-pickup-item', id: 'loc_easy', item: 'Victory' });
        expect(sess.ops()).toHaveLength(5);
        expect(JSON.stringify(sess.record())).not.toBe(JSON.stringify(start));
        let undone = 0;
        while (sess.undo()) undone += 1;
        expect(undone).toBe(5);
        expect(JSON.stringify(sess.record())).toBe(JSON.stringify(start));
    });

    /**
     * ⛓⛓ **THE CASCADE UNDOES AS ONE, AND IT RESTORES THE ENTITY.** ⛓ MUTANT:
     * record the delete WITHOUT its `remove-entity` members — the group refuses
     * (the atomic op will not orphan), so there is no way to reach the state
     * this row guards against.
     */
    it('one undo of the delete group restores the platform AND its portal', () => {
        const sess = openSession();
        const ops = deletePlatformOps(sess.record(), 'p6');
        expect(ops).toHaveLength(2);
        sess.apply(group('delete platform p6', ops));
        expect(sess.record().portals).toEqual([]);
        expect(sess.ops()).toHaveLength(1);
        sess.undo();
        expect(sess.record().portals.map((e) => e.id)).toEqual(['exit_up']);
        expect(sess.record().platforms.map((p) => p.id)).toContain('p6');
    });

    /** ⛓ The payload is `{base, edits, certified}` and the tag is carried
     *  verbatim — the core interprets nothing, and `bases` is absent. */
    it('the payload carries the base tag verbatim and the op list', () => {
        const sess = openSession();
        sess.apply({ op: 'resize', dim: 'height', value: 1100 });
        expect(sess.payload()).toEqual({
            base: { kind: 'bounce-level', region_id: 'r1' },
            edits: [{ op: 'resize', dim: 'height', value: 1100 }],
            certified: null,
        });
        expect(bounceEditAdapter.bases).toBeUndefined();
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SAVE MERGE — ONE BODY, TWO CALLERS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ A REGION-SHAPED FIXTURE. `assembleBounceRegionFromLevel` produces the
 * payload and rules; the grid-level wiring (`exits_placed`, the region id) is
 * what the pipeline adds and what the merge must PRESERVE.
 */
const contract = Object.freeze({
    exitSpecs: [{ side: 'N', requirement: [], counts: {} }],
    locationSpecs: [
        { id: 'loc_easy', item: 'Springs', requirement: [], counts: {} },
        { id: 'loc_easy2', item: 'Victory', requirement: [], counts: {} },
    ],
    physicsProfile: 'experimental',
    mode: 'column',
    freeArrow: 'right',
});

function fixtureRegion() {
    const built = assembleBounceRegionFromLevel(easyTower, {
        region_id: 'r1', ...contract,
    });
    return {
        region_id: 'r1',
        playable_payload: built.payload,
        obstacle_defs: built.obstacleDefs,
        exits_placed: [{ exit_id: 'side_exit_N', side: 'N' }],
        placed_items: ['Springs'],
        extracted_rules: {
            exits: [
                { id: 'side_exit_N', paths: built.exitPaths.N, access_rule: built.exitRules.N },
                { id: 'back_exit', paths: [], access_rule: { rule: 'True_' } },
            ],
            locations: built.locations,
        },
    };
}

/**
 * ⛓⛓⛓ **THE PANEL'S OLD BODY, KEPT AS A FIXTURE-ONLY REFERENCE.** ⛔ It is a
 * verbatim transcription of `BounceRegionEditorUI._buildEditedRegion` as it
 * stood at `9de6feb11`, and it exists for exactly one row: proving the export
 * is byte-identical to what it replaced. Nothing ships it.
 */
function referenceBuildEdited(region, c, level, settings) {
    const locationSpecs = (level.pickups ?? []).map((pk) => ({
        id: pk.id, item: pk.item ?? null, requirement: [], counts: {},
    }));
    const s = settings ?? {};
    const built = assembleBounceRegionFromLevel(level, {
        region_id: region.region_id,
        exitSpecs: c.exitSpecs ?? [],
        locationSpecs,
        physicsProfile: s.physicsProfile ?? c.physicsProfile ?? 'experimental',
        mode: s.mode ?? c.mode ?? 'column',
        freeArrow: s.freeArrow ?? c.freeArrow ?? 'right',
    });
    const next = structuredClone(region);
    next.playable_payload = built.payload;
    next.obstacle_defs = built.obstacleDefs;
    const sideByExitId = new Map(
        (region.exits_placed ?? []).map((p) => [p.exit_id, p.side]));
    for (const ex of next.extracted_rules?.exits ?? []) {
        const side = sideByExitId.get(ex.id);
        if (side && built.exitPaths[side]) {
            ex.paths = built.exitPaths[side];
            ex.access_rule = built.exitRules[side];
        }
    }
    if (next.extracted_rules) next.extracted_rules.locations = built.locations;
    return next;
}

describe('⛓⛓⛓ `buildEditedRegion` — byte-identical to the body it replaced', () => {
    /**
     * ⛓⛓⛓ MUTANT — **the import row.** Change ONE thing in the export (say,
     * `mode` defaulting to `'braid'`, or the locations merged rather than
     * replaced) and this goes RED. It is what makes deleting the verifier's
     * `buildEdited` copy safe: the two bodies are proven equal HERE, and the
     * verifier then has only one.
     */
    it.each([
        ['no settings (the verifier\'s call)', undefined],
        ['empty settings', {}],
        ['staged settings that OVERRIDE the contract', { mode: 'braid', freeArrow: 'left' }],
        ['partial settings', { physicsProfile: 'dj' }],
    ])('agrees with the panel\'s old body — %s', (_name, settings) => {
        const region = fixtureRegion();
        const level = structuredClone(easyTower);
        level.pickups[0].item = 'Jetpacks';
        expect(JSON.stringify(buildEditedRegion({ region, contract, level, settings })))
            .toBe(JSON.stringify(referenceBuildEdited(region, contract, level, settings)));
    });

    /** ⛔ NON-VACUITY — the settings ARM actually moves the output, so the
     *  row above is comparing two things that could have disagreed. */
    it('the settings arm is not vacuous — `mode: braid` changes the region', () => {
        const region = fixtureRegion();
        const level = structuredClone(easyTower);
        expect(JSON.stringify(buildEditedRegion({ region, contract, level })))
            .not.toBe(JSON.stringify(buildEditedRegion({
                region, contract, level, settings: { mode: 'braid' },
            })));
    });

    /** ⛓ The grid-level wiring survives: the back exit (not `exits_placed`)
     *  is left alone, and `placed_items` and the region id come through. */
    it('preserves the wiring the pipeline owns', () => {
        const region = fixtureRegion();
        const out = buildEditedRegion({ region, contract, level: structuredClone(easyTower) });
        expect(out.region_id).toBe('r1');
        expect(out.placed_items).toEqual(['Springs']);
        expect(out.exits_placed).toEqual(region.exits_placed);
        const back = out.extracted_rules.exits.find((e) => e.id === 'back_exit');
        expect(back).toEqual(region.extracted_rules.exits.find((e) => e.id === 'back_exit'));
    });

    /** ⛓ The LOCATIONS come from the edited level's pickups — wholesale, so a
     *  removal takes effect. ⛓ MUTANT: merge instead of replace. */
    it('a removed pickup disappears from the locations', () => {
        const region = fixtureRegion();
        const level = structuredClone(easyTower);
        level.pickups = level.pickups.filter((p) => p.id !== 'loc_easy2');
        const out = buildEditedRegion({ region, contract, level });
        expect(out.extracted_rules.locations.map((l) => l.id)).toEqual(['loc_easy']);
    });

    /** ⛓ It does not mutate the region it was handed. */
    it('leaves the source region untouched', () => {
        const region = fixtureRegion();
        const before = JSON.stringify(region);
        buildEditedRegion({ region, contract, level: structuredClone(easyTower) });
        expect(JSON.stringify(region)).toBe(before);
    });
});
