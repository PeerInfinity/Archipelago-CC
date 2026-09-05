/**
 * apworldEditor/regionRoundTrip — **THE HUB'S DOOR INTO A REGION'S ROOM**
 * (APWORLD EDITOR HUB slice H4b).
 *
 * ⛓⛓ **THE FIXTURE IS THE COMMITTED FOUR-PLAYER DOCUMENT, ON PURPOSE.** H4a
 * built `multiworld/AP_05594871498841892311` precisely because it is the ONLY
 * committed document with more than one populated sidecar slot, and every claim
 * this file makes is about mapping a ROOM onto a DOCUMENT — a hand-built
 * fixture would be a document whose shape I chose to make the mapping work.
 * Slots 1–2 are `Procgen Maze WorldGen` (3 regions each, the LAB door) and
 * slots 3–4 are `Bounce Demo WorldGen` (5 regions each, the PANEL door), so one
 * file exercises both kinds and the per-slot stamp at once.
 *
 * ⛔ The libraries are imported for their REGISTRATION side effect — see the
 * import block below for why that is a STATIC import.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ⛓⛓ **THE LIBRARIES ARE IMPORTED AT THE TOP, NOT IN A `beforeAll`.** They are
 * imported for their REGISTRATION side effect — that is how a headless caller
 * gets a populated registry (`substrate-registry.md`'s own "that first bullet
 * is load-bearing"). ⛔ In a hook they were a FLAKE: `mazeRoomLibrary` pulls
 * `mazeRoomUI` and the whole panel graph behind it, which takes longer than
 * vitest's 10 s hook budget when the rest of the suite is competing for the
 * CPU — measured, this file passed alone and timed out its hook beside
 * `frontend/modules/mazeRoom/`. A static import is module loading, which no
 * hook timeout applies to.
 */
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { applyRulesDocOp } from './rulesDocOps.js';
import {
    buildSidecarOp, inspectRegionRoom, regionRoundTripOf, sameRule, sidecarOf,
} from './regionRoundTrip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS = join(HERE, '..', '..', 'presets');
const FIXTURE = join(PRESETS, 'multiworld', 'AP_05594871498841892311',
    'AP_05594871498841892311_rules.json');
/**
 * ⛓⛓ **THE OTHER LINEAGE, and the biggest class of regions this door serves.**
 * A `procgen_topdown` region carries a maze payload whose AP location names are
 * the SOURCE GAME's (`Inside Yellow Castle`), not anything
 * `makeLocationName(region, id, position)` could reconstruct — `compileRegion`
 * passes `global_name` through and `extractPathsAndObstacles` cannot recover it
 * from tiles. The payload BAKES them (`mazeSerializer.js:49-55`), which is the
 * only reason such a region is editable at all: measured, 978 of the 1,046
 * committed maze-payload sidecar regions are this lineage.
 */
const TOPDOWN = join(PRESETS, 'procgen_topdown', 'AP_1', 'AP_1_rules.json');

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const bytes = (o) => JSON.stringify(o);

const doc = read(FIXTURE);

describe('the fixture is what the rows think it is', () => {
    it('⛓ four slots, two games, maze 3 regions and bounce 5', () => {
        expect(Object.keys(doc.preset_sidecars)).toEqual(['1', '2', '3', '4']);
        for (const p of ['1', '2']) {
            expect(Object.keys(doc.preset_sidecars[p])).toHaveLength(3);
            expect(sidecarOf(doc, p, 'region_1_0').substrate).toBe('maze');
        }
        for (const p of ['3', '4']) {
            expect(Object.keys(doc.preset_sidecars[p])).toHaveLength(5);
            expect(sidecarOf(doc, p, 'region_1_0').substrate).toBe('bounce');
        }
    });
});

describe('sameRule — the equivalence the Python round trip forces', () => {
    const has = (n) => ({ rule: 'Has', args: { item_name: n } });

    it('⛓ byte-equal rules are the same rule', () => {
        expect(sameRule({ rule: 'True_' }, { rule: 'True_' })).toBe(true);
        expect(sameRule(has('Key'), has('Key'))).toBe(true);
    });

    it('⛓⛓ `HasAll([a,b])` IS `And(Has a, Has b)` — the exporter renormalizes it', () => {
        const hasAll = { rule: 'HasAll', args: { item_names: ['Left arrow', 'Right arrow'] } };
        const andOf = { rule: 'And', children: [has('Left arrow'), has('Right arrow')] };
        expect(sameRule(hasAll, andOf)).toBe(true);
        expect(bytes(hasAll)).not.toBe(bytes(andOf));
    });

    it('⛔ `True_` is NOT `False_` — the `exact` guard, and it is the whole guard', () => {
        expect(sameRule({ rule: 'True_' }, { rule: 'False_' })).toBe(false);
        expect(sameRule({ rule: 'False_' }, { rule: 'False_' })).toBe(true);   // byte-equal
    });

    it('⛔ an `Or` is not equivalent to either branch — the fragment is AND-of-items', () => {
        const or = { rule: 'Or', children: [has('a'), has('b')] };
        expect(sameRule(or, has('a'))).toBe(false);
        expect(sameRule(or, { rule: 'True_' })).toBe(false);
    });

    it('⛓ different item sets are different rules', () => {
        expect(sameRule(has('Left arrow'), has('Right arrow'))).toBe(false);
        expect(sameRule({ rule: 'HasAll', args: { item_names: ['a', 'b'] } }, has('a'))).toBe(false);
    });
});

describe('regionRoundTripOf — the declaration, resolved off the registry', () => {
    it('⛓ maze and bounce declare `{open, save}`', () => {
        for (const id of ['maze', 'bounce']) {
            const { rt, why } = regionRoundTripOf(id);
            expect(why, id).toBe(null);
            expect(typeof rt.open).toBe('function');
            expect(typeof rt.save).toBe('function');
        }
    });

    it('⛓⛓ Seedling declares `refused` — and the SENTENCE is the substrate\'s own', () => {
        const { rt, why } = regionRoundTripOf('flash_seedling');
        expect(rt).toBe(null);
        expect(why).toContain('ATLAS REFERENCE');
        expect(why).toContain('atlas_ref');
        // ⛓ …and its ROOM EDITOR declaration is untouched: the pipeline still
        //   opens a Seedling room from a live run. It is the DOCUMENT direction
        //   that has no answer.
        expect(substrateRegistry.get('flash_seedling').roomEditor.kind).toBe('lab');
    });

    it('⛔ a substrate with no declaration is NAMED, not silently skipped', () => {
        const { rt, why } = regionRoundTripOf('jta');
        expect(rt).toBe(null);
        expect(why).toContain('jta');
        expect(why).toContain('regionRoundTrip');
    });

    it('⛔ a MALFORMED declaration says so, and says which member is wrong', () => {
        const id = '__h4b_malformed__';
        substrateRegistry.register({
            id, sharing: {}, regionRoundTrip: Object.freeze({ open: 1, save: null }),
        });
        const { rt, why } = regionRoundTripOf(id);
        expect(rt).toBe(null);
        expect(why).toContain('open=number');
        expect(why).toContain('save=object');
    });
});

describe('inspectRegionRoom — what the Edit button knows before it is pressed', () => {
    it('⛓ a maze region of slot 1 is EDITABLE, and every rule is movable', async () => {
        const r = await inspectRegionRoom(doc, '1', 'region_1_0');
        expect(r.ok, r.why).toBe(true);
        expect(r.substrate).toBe('maze');
        expect(r.movableExits.size).toBe(2);
        expect(r.movableLocations.size).toBe(2);
        expect(r.frozen).toEqual([]);
        // ⛓ the LAB door's two words, from the substrate's own declaration
        expect(r.session.room).toBe(0);
        expect(r.session.record.entries).toHaveLength(1);
        expect(r.session.record.entries[0].substrate).toBe('maze');
    });

    it('⛓ a bounce region of slot 3 is EDITABLE through the PANEL door', async () => {
        const r = await inspectRegionRoom(doc, '3', 'region_1_0');
        expect(r.ok, r.why).toBe(true);
        expect(r.substrate).toBe('bounce');
        // ⛓ the panel door's two words: a region descriptor and a contract
        expect(r.session.region.region_id).toBe('region_1_0');
        expect(r.session.contract.exitSpecs).toHaveLength(2);
        expect(r.session.contract.locationSpecs.map((l) => l.id)).toEqual(['loc_arrow']);
        // ⛓ …and the contract carries the DOCUMENT's item pool and start set
        expect(r.session.contract.itemPool).toContain('Right arrow');
        expect(r.session.contract.expectedItems).toEqual([]);
    });

    it('⛔ a bounce region whose portal is not `side_exit_<side>` is REFUSED BY NAME', async () => {
        // ⛓ `region_1_1` is the `spring_gap` zone: its north portal is authored
        //   as `exit_up`, and `assembleBounceRegionFromLevel` names every exit
        //   `side_exit_<side>` — so an UNEDITED save would already rewrite the
        //   payload's `sidePortals`. Measured, not predicted.
        const r = await inspectRegionRoom(doc, '3', 'region_1_1');
        expect(r.ok).toBe(false);
        expect(r.why).toContain('UNCHANGED would already rewrite');
        expect(r.why).toContain('region_1_1');
    });

    it('⛔ a jta region is disabled BY NAME — no `roomEditor` at all', async () => {
        const jta = read(jtaFixture());
        const p = Object.keys(jta.preset_sidecars)[0];
        const name = Object.keys(jta.preset_sidecars[p])[0];
        const r = await inspectRegionRoom(jta, p, name);
        expect(r.ok).toBe(false);
        expect(r.hidden).toBeUndefined();
        expect(r.why).toContain('no region editor for "jta"');
    });

    it('⛔ a region with NO sidecar is HIDDEN, not disabled — a classic AP region', async () => {
        const r = await inspectRegionRoom(doc, '1', 'Menu');
        expect(r.ok).toBe(false);
        expect(r.hidden).toBe(true);
    });

    it('⛓⛓ every slot of the fixture answers, and the two bounce slots agree', async () => {
        const verdicts = {};
        for (const p of Object.keys(doc.preset_sidecars)) {
            verdicts[p] = [];
            for (const name of Object.keys(doc.preset_sidecars[p])) {
                // eslint-disable-next-line no-await-in-loop
                const r = await inspectRegionRoom(doc, p, name);
                verdicts[p].push(`${name}:${r.ok ? 'edit' : 'no'}`);
            }
        }
        expect(verdicts['1']).toEqual(verdicts['2']);
        expect(verdicts['3']).toEqual(verdicts['4']);
        expect(verdicts['1'].filter((v) => v.endsWith(':edit'))).toHaveLength(3);
        expect(verdicts['3'].filter((v) => v.endsWith(':edit'))).toHaveLength(3);
    });
});

describe('the top-down lineage — names the convention cannot reconstruct', () => {
    const tdDoc = read(TOPDOWN);

    it('⛓ its location names really are the SOURCE GAME\'s, not the convention\'s', () => {
        const region = tdDoc.regions['1'].YellowCastle;
        const names = region.locations.map((l) => l.name);
        expect(names).toContain('Inside Yellow Castle');
        // ⛔ the premise, asserted rather than assumed: NOTHING here looks like
        //    `Region__id__x_y`, so a matcher built on the convention alone
        //    cannot name a single one of them.
        for (const n of names) expect(n).not.toMatch(/__/);
        // …and the payload BAKES them, which is what makes the region editable.
        const items = tdDoc.preset_sidecars['1'].YellowCastle.playable_payload.items;
        expect(items.map((i) => i.locationName).sort()).toEqual([...names].sort());
    });

    it('⛓⛓ …and the door opens it, mapping every endpoint', async () => {
        const r = await inspectRegionRoom(tdDoc, '1', 'YellowCastle');
        expect(r.ok, r.why).toBe(true);
        expect(r.substrate).toBe('maze');
        expect(r.movableLocations.size + r.frozen.length)
            .toBe(tdDoc.regions['1'].YellowCastle.locations.length
                + tdDoc.regions['1'].YellowCastle.exits.length
                - r.movableExits.size);
        expect([...r.movableLocations]).toContain('Inside Yellow Castle');
    });

    it('⛔ an edit keeps those names and moves only the rule it explains', async () => {
        const ins = await inspectRegionRoom(tdDoc, '1', 'YellowCastle');
        const library = clone(ins.session.record);
        // ⛓ open every wall of the room: the geometry changes, the AP identity
        //   must not — every location keeps the source game's own name.
        library.entries[0].payload.obstacles = [];
        const { op } = await buildSidecarOp({
            saved: { library, overlay: {} }, inspection: ins,
        });
        expect(Object.keys(op.rules.locations).sort())
            .toEqual(tdDoc.regions['1'].YellowCastle.locations.map((l) => l.name).sort());
        const res = applyRulesDocOp(tdDoc, op);
        expect(res.ok, res.error).toBe(true);
        expect(res.doc.regions['1'].YellowCastle.locations.map((l) => l.name))
            .toEqual(tdDoc.regions['1'].YellowCastle.locations.map((l) => l.name));
        expect(res.doc.preset_sidecars['1'].YellowCastle.playable_payload.items
            .map((i) => i.locationName).sort())
            .toEqual(tdDoc.regions['1'].YellowCastle.locations.map((l) => l.name).sort());
    });
});

describe('buildSidecarOp — the save, folded into ONE op', () => {
    const libraryOf = (inspection) => clone(inspection.session.record);
    const saveOf = (library) => ({ library, overlay: {} });

    it('⛓⛓ AN UNEDITED SAVE IS A NO-OP ON THE SESSION — the door\'s own law', async () => {
        const ins = await inspectRegionRoom(doc, '1', 'region_1_0');
        const { op, moved } = await buildSidecarOp({
            saved: saveOf(libraryOf(ins)), inspection: ins,
        });
        expect(moved).toBe(0);
        const session = createEditSession(rulesEditAdapter, doc);
        const res = session.apply(op);
        expect(res.ok).toBe(true);
        expect(res.applied, 'open-and-save-unchanged moved the document').toBe(false);
        expect(session.ops()).toHaveLength(0);
    });

    it('⛓⛓⛓ AN EDIT MOVES THE PAYLOAD **AND** THE RULE IT EXPLAINS', async () => {
        const ins = await inspectRegionRoom(doc, '1', 'region_1_0');
        const library = libraryOf(ins);
        // ⛓ Take the red door out of the room. The location behind it is
        //   `region_1_0__key_red_pickup__2_4`, gated `Has(key_red)` by that ONE
        //   obstacle — so removing it must open the location and nothing else.
        expect(library.entries[0].payload.obstacles).toEqual([{ x: 3, y: 4, id: 'door_red' }]);
        library.entries[0].payload.obstacles = [];

        const { op, moved } = await buildSidecarOp({ saved: saveOf(library), inspection: ins });
        expect(moved).toBe(1);
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, res.error).toBe(true);

        const region = res.doc.regions['1'].region_1_0;
        expect(region.locations.map((l) => [l.name, l.access_rule])).toEqual([
            ['region_1_0__key_red_pickup__5_5', { rule: 'True_' }],
            ['region_1_0__key_red_pickup__2_4', { rule: 'True_' }],
        ]);
        expect(res.doc.preset_sidecars['1'].region_1_0.playable_payload.obstacles).toEqual([]);
        // ⛔ …and the AP identity the LIBRARY strips is back: the exit targets
        //    the map draws its connection lines from, and the baked names.
        const payload = res.doc.preset_sidecars['1'].region_1_0.playable_payload;
        expect(payload.exits.map((e) => e.targetRegion)).toEqual(['region_2_0', 'region_1_1']);
        expect(payload.items.map((i) => i.locationName)).toEqual([
            'region_1_0__key_red_pickup__5_5', 'region_1_0__key_red_pickup__2_4',
        ]);
        // ⛓ and the fill's placements are untouched.
        expect(region.locations[0].item.name).toBe('Left arrow');
        expect(region.locations[0].id).toBe(1000);
    });

    it('⛓ ONE undo folds the whole sub-edit away', async () => {
        const ins = await inspectRegionRoom(doc, '1', 'region_1_0');
        const library = libraryOf(ins);
        library.entries[0].payload.obstacles = [];
        const { op } = await buildSidecarOp({ saved: saveOf(library), inspection: ins });
        const session = createEditSession(rulesEditAdapter, doc);
        const before = bytes(session.record());
        expect(session.apply(op).applied).toBe(true);
        expect(session.ops()).toHaveLength(1);
        expect(session.undo()).toBe(true);
        expect(bytes(session.record())).toBe(before);
    });

    it('⛔ a location the edited room LOST is refused by the OP, naming the item on it', async () => {
        const ins = await inspectRegionRoom(doc, '1', 'region_1_0');
        const library = libraryOf(ins);
        library.entries[0].payload.items = library.entries[0].payload.items.slice(0, 1);
        const { op } = await buildSidecarOp({ saved: saveOf(library), inspection: ins });
        const res = applyRulesDocOp(doc, op);
        expect(res.ok).toBe(false);
        expect(res.error).toContain('no longer has');
        expect(res.error).toMatch(/region_1_0__key_red_pickup__\d_\d/);
        expect(res.error).toMatch(/the fill placed "(Left arrow|Blue platforms)" there/);
    });

    it('⛔ a location the edited room ADDED is refused by the HUB, before an op exists', async () => {
        const ins = await inspectRegionRoom(doc, '1', 'region_1_0');
        const library = libraryOf(ins);
        library.entries[0].payload.items.push({ x: 1, y: 1, id: 'slot_9', locationName: null });
        const out = await buildSidecarOp({ saved: saveOf(library), inspection: ins });
        expect(out.op).toBeUndefined();
        expect(out.error).toContain('a new location');
        expect(out.error).toContain('needs an');
    });

    it('⛓⛓ THE OP IS STAMPED WITH THE SLOT THE INSPECTION WAS OPENED ON', async () => {
        const ins = await inspectRegionRoom(doc, '2', 'region_1_0');
        const library = libraryOf(ins);
        library.entries[0].payload.obstacles = [];
        const { op } = await buildSidecarOp({ saved: saveOf(library), inspection: ins });
        expect(op.player).toBe('2');
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, res.error).toBe(true);
        // ⛔ slot 1's same-named region is untouched — the mutant H4a's §16.6 #3
        //    caught in miniature, and this fixture is the only one that can.
        expect(bytes(res.doc.preset_sidecars['1'].region_1_0))
            .toBe(bytes(doc.preset_sidecars['1'].region_1_0));
        expect(bytes(res.doc.regions['1'].region_1_0))
            .toBe(bytes(doc.regions['1'].region_1_0));
        expect(res.doc.preset_sidecars['2'].region_1_0.playable_payload.obstacles).toEqual([]);
    });

    it('⛓⛓⛓ A FROZEN RULE IS NOT MOVED — the door only overwrites what it authored', async () => {
        // ⛓ slot 3's `region_0_1` carries two endpoints whose rule the bounce
        //   derivation does NOT reproduce from the document-recoverable
        //   contract, and one it does. Measured on the committed fixture.
        const ins = await inspectRegionRoom(doc, '3', 'region_0_1');
        expect(ins.ok, ins.why).toBe(true);
        expect(ins.frozen.length).toBeGreaterThan(0);
        const region = doc.regions['3'].region_0_1;
        const frozenNames = ins.frozen.map((f) => f.replace(/^\w+ "/, '').replace(/"$/, ''));
        for (const e of [...region.exits, ...region.locations]) {
            if (!frozenNames.includes(e.name)) continue;
            expect(ins.movableExits.has(e.name)).toBe(false);
            expect(ins.movableLocations.has(e.name)).toBe(false);
        }
        // ⛔ and an UNEDITED save leaves every one of them exactly as it was.
        const { op } = await buildSidecarOp({ saved: ins.unedited, inspection: ins });
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, res.error).toBe(true);
        expect(bytes(res.doc.regions['3'].region_0_1)).toBe(bytes(region));
    });
});

/** ⛓ The jta control document — a committed preset with a jta sidecar. */
function jtaFixture() {
    const base = join(PRESETS, 'jta_substrate_test');
    const seed = readdirSync(base)[0];
    const file = readdirSync(join(base, seed)).find((f) => f.endsWith('_rules.json'));
    return join(base, seed, file);
}
