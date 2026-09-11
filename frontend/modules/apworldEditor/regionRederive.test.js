/**
 * apworldEditor/regionRederive — **`Re-derive rules ▸`** (PRESET SIDECARS S2).
 *
 * ⛓⛓ Every row goes THROUGH A SESSION — `createEditSession(rulesEditAdapter,
 * base)`, a raw `set-region-sidecar`, then the re-derivation handed the
 * session's own `{base, ops, doc}` — because the one thing this file adds over
 * H4b is recovering the PRE-EDIT payload from that record. A row that handed
 * the function a pre-edit document directly would test a function nobody calls.
 *
 * ⛓ The tile a row flips is FOUND BY DERIVATION (`flipWhere`), never typed: the
 * first region whose Edit ▸ inspection opens, and the first single-tile flip
 * whose derivation changes exactly the endpoints the row needs. The region the
 * grid-gate row uses is found the same way — the one whose inspection FREEZES a
 * rule — so the premise is asserted off the document, not recalled.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// ⛓ registration side effect — a STATIC import (see regionRoundTrip.test.js).
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import {
    deriveRegionRules, inspectRegionRoom, prettyBytes, regionRoundTripOf, sameRule, sidecarOf,
} from './regionRoundTrip.js';
import {
    priorRegionState, rederiveRegionRules, REDERIVE_NO_BASELINE, REDERIVE_PAYLOAD_KEPT,
    REDERIVE_PAYLOAD_NORMALISED, REDERIVE_POINTS_AT_EDIT,
} from './regionRederive.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS = join(HERE, '..', '..', 'presets');
const read = (...p) => JSON.parse(readFileSync(join(PRESETS, ...p), 'utf8'));
const bytes = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(JSON.stringify(o));

const MAZE_1 = read('procgen_maze', 'AP_1', 'AP_1_rules.json');
const MAZE_2 = read('procgen_maze', 'AP_2', 'AP_2_rules.json');
const FOUR = read('multiworld', 'AP_05594871498841892311', 'AP_05594871498841892311_rules.json');
const SEEDLING = read('seedling_atlas', 'AP_1', 'AP_1_rules.json');
const ATLAS_MAZE = read('seedling_atlas_maze', 'AP_1', 'AP_1_rules.json');

function firstRulesJson(dir) {
    const seed = readdirSync(join(PRESETS, dir))[0];
    const file = readdirSync(join(PRESETS, dir, seed)).find((f) => f.endsWith('_rules.json'));
    return read(dir, seed, file);
}

/** ⛓ Every endpoint of a derivation, `exit "n"` / `location "n"` → rule. */
const endpoints = (d) => new Map([
    ...[...d.exits].map(([n, r]) => [`exit "${n}"`, r]),
    ...[...d.locations].map(([n, r]) => [`location "${n}"`, r]),
]);

/** ⛓ The document with one tile of one region's payload flipped. */
function flipped(doc, slot, region, i) {
    const next = clone(doc);
    const tiles = next.preset_sidecars[slot][region].playable_payload.tiles;
    tiles[i] = tiles[i] ? 0 : 1;
    return next;
}

/**
 * ⛓⛓ THE LAW THAT PICKS A ROW'S EDIT: over `regions` (sidecar key order), the
 * first single-tile flip whose derivation differs from the unedited one on
 * exactly the endpoints `want(changedLabels)` accepts. → `{region, i, changed}`.
 */
async function flipWhere(doc, slot, regions, want) {
    for (const region of regions) {
        const tiles = sidecarOf(doc, slot, region)?.playable_payload?.tiles;
        if (!Array.isArray(tiles)) continue;
        // eslint-disable-next-line no-await-in-loop
        if (!(await inspectRegionRoom(doc, slot, region)).ok) continue;
        // eslint-disable-next-line no-await-in-loop
        const was = endpoints(await deriveRegionRules(doc, slot, region));
        for (let i = 0; i < tiles.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const now = await deriveRegionRules(flipped(doc, slot, region, i), slot, region);
            if (!now.ok) continue;
            const is = endpoints(now);
            const changed = [...was.keys()].filter((k) => !sameRule(was.get(k), is.get(k)));
            if (want(changed)) return { region, i, changed };
        }
    }
    return null;
}

/** ⛓ A session on `base`, one raw `set-region-sidecar` of `entry` applied. */
function rawEdited(base, slot, region, entry) {
    const session = createEditSession(rulesEditAdapter, base);
    const res = session.apply({ op: 'set-region-sidecar', player: slot, region, entry });
    expect(res.applied, res.description).toBe(true);
    return session;
}
const historyOf = (session, base) => ({ base, ops: session.ops(), doc: session.record() });

/** ⛓ Every access rule of a region, by `exit "n"` / `location "n"`. */
const docRules = (doc, slot, region) => new Map([
    ...doc.regions[slot][region].exits.map((e) => [`exit "${e.name}"`, e.access_rule]),
    ...doc.regions[slot][region].locations.map((l) => [`location "${l.name}"`, l.access_rule]),
]);

describe('rederiveRegionRules — a raw edit on a maze region, then the button', () => {
    const slot = Object.keys(MAZE_1.preset_sidecars)[0];
    const regions = Object.keys(MAZE_1.preset_sidecars[slot]);
    const onlyOneExit = (c) => c.length === 1 && c[0].startsWith('exit ');

    it('⛓⛓⛓ the exit whose reachability the raw edit changed MOVES to the derived rule, '
        + 'and every other byte of the document stays', async () => {
        const pick = await flipWhere(MAZE_1, slot, regions, onlyOneExit);
        expect(pick, 'premise: a single-tile flip that changes one exit\'s derived rule').not.toBe(null);
        const { region, i, changed } = pick;
        const edited = flipped(MAZE_1, slot, region, i).preset_sidecars[slot][region];
        const session = rawEdited(MAZE_1, slot, region, edited);
        const afterRaw = session.record();
        // ⛓ the raw save moved NO rule (S1's op) — so there is something to re-derive.
        expect(bytes(afterRaw.regions)).toBe(bytes(MAZE_1.regions));

        const out = await rederiveRegionRules(historyOf(session, MAZE_1), slot, region);
        expect(out.error).toBeUndefined();
        expect(out.moved).toEqual(changed);
        expect(out.frozen).toEqual([]);
        expect(out.baseline).toEqual({ index: 0, of: 1, op: 'set-region-sidecar' });
        expect(out.op).toMatchObject({ op: 'replace-region-sidecar', player: slot, region });

        const res = session.apply(out.op);
        expect(res.applied, res.description).toBe(true);
        expect(session.ops()).toHaveLength(2);
        // ⛓⛓ the WHOLE document after = the raw-saved one with exactly the exit's
        //   rule and the payload replaced by the derivation's (1306's strongest form).
        const derived = await deriveRegionRules(afterRaw, slot, region);
        const exitName = changed[0].replace(/^exit "|"$/g, '');
        const want = clone(afterRaw);
        want.regions[slot][region].exits.find((e) => e.name === exitName).access_rule
            = derived.exits.get(exitName);
        want.preset_sidecars[slot][region].playable_payload = derived.payload;
        expect(bytes(session.record())).toBe(bytes(want));
        // …and that rule really did change (not a no-op dressed as a move).
        expect(sameRule(derived.exits.get(exitName),
            docRules(afterRaw, slot, region).get(changed[0]))).toBe(false);

        // ⛓ ONE undo removes ONLY the re-derive — the raw edit stays.
        expect(session.undo()).toBe(true);
        expect(bytes(session.record())).toBe(bytes(afterRaw));
    });

    it('⛓⛓ the payload the serializer normalises is WRITTEN in its normal form, and the '
        + 'message names the rewritten fields and the size', async () => {
        const pick = await flipWhere(MAZE_1, slot, regions, onlyOneExit);
        const { region, i } = pick;
        const edited = flipped(MAZE_1, slot, region, i).preset_sidecars[slot][region];
        const session = rawEdited(MAZE_1, slot, region, edited);
        const derived = await deriveRegionRules(session.record(), slot, region);
        // ⛓ premise, off the round trip: its form of this payload is not the raw one.
        expect(bytes(derived.payload)).not.toBe(bytes(edited.playable_payload));
        const rewritten = Object.keys(derived.payload)
            .filter((k) => bytes(derived.payload[k]) !== bytes(edited.playable_payload[k]));
        expect(rewritten.length).toBeGreaterThan(0);

        const out = await rederiveRegionRules(historyOf(session, MAZE_1), slot, region);
        expect(bytes(out.op.payload)).toBe(bytes(derived.payload));
        expect(out.normalised).toEqual({
            keys: rewritten,
            before: prettyBytes(edited.playable_payload),
            after: prettyBytes(derived.payload),
        });
        expect(out.message).toContain(REDERIVE_PAYLOAD_NORMALISED);
        for (const k of rewritten) expect(out.message).toContain(`\`${k}\``);
        expect(out.message).toContain(`${prettyBytes(derived.payload).toLocaleString('en-US')} B`);
        expect(out.message).not.toContain(REDERIVE_PAYLOAD_KEPT);
    });

    it('⛓ a second press moves nothing and freezes nothing — the rules now agree with the room', async () => {
        const { region, i } = await flipWhere(MAZE_1, slot, regions, onlyOneExit);
        const edited = flipped(MAZE_1, slot, region, i).preset_sidecars[slot][region];
        const session = rawEdited(MAZE_1, slot, region, edited);
        session.apply((await rederiveRegionRules(historyOf(session, MAZE_1), slot, region)).op);
        const again = await rederiveRegionRules(historyOf(session, MAZE_1), slot, region);
        expect(again.moved).toEqual([]);
        expect(again.frozen).toEqual([]);
        expect(again.normalised).toBe(null);
        expect(again.message).toContain(REDERIVE_PAYLOAD_KEPT);
        expect(session.apply(again.op).applied).toBe(false);
    });

    it('⛓⛓ the Document tab\'s whole-slot `set-key` is a raw edit too — the baseline is '
        + 'found by what the op DID, not by its name', async () => {
        const { region, i, changed } = await flipWhere(MAZE_1, slot, regions, onlyOneExit);
        const slice = flipped(MAZE_1, slot, region, i).preset_sidecars[slot];
        const session = createEditSession(rulesEditAdapter, MAZE_1);
        expect(session.apply({
            op: 'set-key', key: 'preset_sidecars', scope: 'player', player: slot, value: slice,
        }).applied).toBe(true);
        const out = await rederiveRegionRules(historyOf(session, MAZE_1), slot, region);
        expect(out.baseline).toEqual({ index: 0, of: 1, op: 'set-key' });
        expect(out.moved).toEqual(changed);
    });

    it('⛔ a rule written BY HAND after the raw edit is frozen, not overwritten', async () => {
        const { region, i, changed } = await flipWhere(MAZE_1, slot, regions, onlyOneExit);
        const edited = flipped(MAZE_1, slot, region, i).preset_sidecars[slot][region];
        const session = rawEdited(MAZE_1, slot, region, edited);
        const exitName = changed[0].replace(/^exit "|"$/g, '');
        const hand = { rule: 'Has', args: { item_name: 'a_hand_written_item' } };
        const regionsNow = clone(session.record().regions[slot]);
        regionsNow[region].exits.find((e) => e.name === exitName).access_rule = hand;
        expect(session.apply({
            op: 'set-key', key: 'regions', scope: 'player', player: slot, value: regionsNow,
        }).applied).toBe(true);
        const out = await rederiveRegionRules(historyOf(session, MAZE_1), slot, region);
        expect(out.moved).toEqual([]);
        expect(out.frozen).toEqual(changed);
        expect(out.op.rules.exits[exitName]).toEqual(hand);
    });
});

describe('the grid-composed gate stays FROZEN under a re-derive', () => {
    const slot = Object.keys(MAZE_2.preset_sidecars)[0];

    it('⛓⛓⛓ the gate the grid composed is left exactly as it is, named and counted, while '
        + 'the rule the raw edit changed moves', async () => {
        // ⛓ premise, by the LAW: the region whose Edit ▸ inspection FREEZES a rule.
        let gated = null;
        for (const r of Object.keys(MAZE_2.preset_sidecars[slot])) {
            // eslint-disable-next-line no-await-in-loop
            const ins = await inspectRegionRoom(MAZE_2, slot, r);
            if (ins.ok && ins.frozen.length) { gated = { region: r, frozen: ins.frozen }; break; }
        }
        expect(gated, 'premise: a region with a rule its room does not produce').not.toBe(null);
        const { region, frozen } = gated;
        const pick = await flipWhere(MAZE_2, slot, [region],
            (c) => c.length === 1 && c[0].startsWith('location '));
        expect(pick, 'premise: a flip that moves one location of that region').not.toBe(null);

        const edited = flipped(MAZE_2, slot, region, pick.i).preset_sidecars[slot][region];
        const session = rawEdited(MAZE_2, slot, region, edited);
        const out = await rederiveRegionRules(historyOf(session, MAZE_2), slot, region);
        expect(out.moved).toEqual(pick.changed);
        expect(out.frozen).toEqual(frozen);
        expect(out.message).toContain(`${frozen.length} frozen`);
        for (const f of frozen) expect(out.message).toContain(f);

        session.apply(out.op);
        const was = docRules(MAZE_2, slot, region);
        const now = docRules(session.record(), slot, region);
        for (const f of frozen) expect(bytes(now.get(f)), f).toBe(bytes(was.get(f)));
        // ⛓ …and the payload's own derivation would have OPENED it — the thing a
        //   re-derive that ignored the frozen set would have written.
        const derived = endpoints(await deriveRegionRules(session.record(), slot, region));
        for (const f of frozen) expect(sameRule(derived.get(f), was.get(f)), f).toBe(false);
    });
});

describe('with NO pre-edit state in the record, nothing moves and the message says why', () => {
    const slot = Object.keys(MAZE_1.preset_sidecars)[0];
    const regions = Object.keys(MAZE_1.preset_sidecars[slot]);

    it('⛓⛓ a fresh session on an ALREADY hand-edited document: no rule moves, the '
        + 'changed exit is frozen, and the message points at Edit ▸', async () => {
        const { region, i, changed } = await flipWhere(MAZE_1, slot, regions,
            (c) => c.length === 1 && c[0].startsWith('exit '));
        const arrived = flipped(MAZE_1, slot, region, i);
        const session = createEditSession(rulesEditAdapter, arrived);
        const out = await rederiveRegionRules(historyOf(session, arrived), slot, region);
        expect(out.baseline).toEqual({ why: REDERIVE_NO_BASELINE });
        expect(out.moved).toEqual([]);
        expect(out.frozen).toEqual(changed);
        expect(out.message).toContain(REDERIVE_NO_BASELINE);
        expect(out.message).toContain(REDERIVE_POINTS_AT_EDIT);
        expect(out.op.rules.exits[changed[0].replace(/^exit "|"$/g, '')])
            .toEqual(docRules(arrived, slot, region).get(changed[0]));
    });

    it('⛓ …and the same after the raw edit is UNDONE — the record no longer holds it', async () => {
        const { region, i } = await flipWhere(MAZE_1, slot, regions,
            (c) => c.length === 1 && c[0].startsWith('exit '));
        const session = rawEdited(MAZE_1, slot, region,
            flipped(MAZE_1, slot, region, i).preset_sidecars[slot][region]);
        session.undo();
        const out = await rederiveRegionRules(historyOf(session, MAZE_1), slot, region);
        expect(out.baseline).toEqual({ why: REDERIVE_NO_BASELINE });
        expect(out.moved).toEqual([]);
        expect(out.frozen).toEqual([]);
        expect(session.apply(out.op).applied).toBe(false);
    });

    it('⛔ a history that does not end at the document in hand is not used', () => {
        const { region } = { region: regions[0] };
        const other = flipped(MAZE_1, slot, region, 0);
        const prior = priorRegionState({ base: MAZE_1, ops: [], doc: other }, slot, region);
        expect(prior.doc).toBe(null);
        expect(prior.why).toContain('does not reproduce');
    });
});

describe('refusals, by name', () => {
    it('⛔ a substrate declaring `refused` answers with the SUBSTRATE\'s own sentence', async () => {
        const slot = Object.keys(SEEDLING.preset_sidecars)[0];
        const region = Object.keys(SEEDLING.preset_sidecars[slot])[0];
        const { substrate } = sidecarOf(SEEDLING, slot, region);
        const decl = substrateRegistry.get(substrate)?.regionRoundTrip;
        expect(typeof decl?.refused, 'premise: the entry declares `refused`').toBe('string');
        const out = await rederiveRegionRules(
            historyOf(createEditSession(rulesEditAdapter, SEEDLING), SEEDLING), slot, region);
        expect(out.op).toBeUndefined();
        expect(out.error).toBe(decl.refused);
    });

    it('⛔ a substrate with no round trip at all is refused with the registry lookup\'s sentence', async () => {
        const jta = firstRulesJson('jta_substrate_test');
        const slot = Object.keys(jta.preset_sidecars)[0];
        const region = Object.keys(jta.preset_sidecars[slot])[0];
        const out = await rederiveRegionRules(
            historyOf(createEditSession(rulesEditAdapter, jta), jta), slot, region);
        expect(out.error).toBe(regionRoundTripOf(sidecarOf(jta, slot, region).substrate).why);
    });

    it('⛔ a payload that gained an endpoint the document does not name is refused by the '
        + 'hub; one that LOST an endpoint is refused by the op', async () => {
        const slot = Object.keys(FOUR.preset_sidecars)[0];
        // ⛓ a region whose payload places at least one item — one it can LOSE.
        const region = Object.keys(FOUR.preset_sidecars[slot])
            .find((r) => sidecarOf(FOUR, slot, r).playable_payload.items?.length > 0);
        expect(region, 'premise: a maze region with an item').toBeTruthy();
        const entry = clone(sidecarOf(FOUR, slot, region));
        const gained = clone(entry);
        gained.playable_payload.items.push({ x: 1, y: 1, id: 'slot_s2', locationName: null });
        const a = await rederiveRegionRules(historyOf(rawEdited(FOUR, slot, region, gained), FOUR),
            slot, region);
        expect(a.op).toBeUndefined();
        expect(a.error).toContain('does not name');

        const lost = clone(entry);
        lost.playable_payload.items = lost.playable_payload.items.slice(1);
        const b = await rederiveRegionRules(historyOf(rawEdited(FOUR, slot, region, lost), FOUR),
            slot, region);
        expect(b.op).toBeUndefined();
        expect(b.error).toContain('no longer has');
    });
});

describe('deriveRegionRules — the derivation alone, NOT the door', () => {
    it('⛓ derives a room check (1) refuses — and the door still refuses it', async () => {
        const slot = Object.keys(ATLAS_MAZE.preset_sidecars)[0];
        const region = Object.keys(ATLAS_MAZE.preset_sidecars[slot])
            .find((r) => sidecarOf(ATLAS_MAZE, slot, r).substrate === 'maze');
        const door = await inspectRegionRoom(ATLAS_MAZE, slot, region);
        expect(door.ok).toBe(false);
        expect(door.why).toContain('UNCHANGED would already rewrite');
        const d = await deriveRegionRules(ATLAS_MAZE, slot, region);
        expect(d.ok, d.why).toBe(true);
        expect(bytes(d.payload)).not.toBe(bytes(sidecarOf(ATLAS_MAZE, slot, region).playable_payload));
    });

    it('⛓ on an unedited region every endpoint is named, and its payload is the document\'s', async () => {
        for (const slot of Object.keys(FOUR.preset_sidecars)) {
            for (const region of Object.keys(FOUR.preset_sidecars[slot])) {
                // eslint-disable-next-line no-await-in-loop
                const d = await deriveRegionRules(FOUR, slot, region);
                expect(d.ok, `${slot}/${region}: ${d.why}`).toBe(true);
                expect(d.unnamed, `${slot}/${region}`).toEqual([]);
                expect(d.unmatched, `${slot}/${region}`).toEqual([]);
                expect(bytes(d.payload), `${slot}/${region}`)
                    .toBe(bytes(sidecarOf(FOUR, slot, region).playable_payload));
                expect([...endpoints(d).keys()].sort(), `${slot}/${region}`)
                    .toEqual([...docRules(FOUR, slot, region).keys()].sort());
            }
        }
    });

    it('⛔ no room editor is needed — a declared round trip is — and the sentence for none '
        + 'does not claim a room editor', async () => {
        const jta = firstRulesJson('jta_substrate_test');
        const slot = Object.keys(jta.preset_sidecars)[0];
        const region = Object.keys(jta.preset_sidecars[slot])[0];
        const { substrate } = sidecarOf(jta, slot, region);
        expect(substrateRegistry.get(substrate)?.roomEditor, 'premise').toBeUndefined();
        const d = await deriveRegionRules(jta, slot, region);
        expect(d.ok).toBe(false);
        expect(d.why).toBe(regionRoundTripOf(substrate).why);
        expect(d.why).not.toContain('room editor');
    });
});

describe('⛔ the module names no substrate', () => {
    it('no registered id appears in its source as a string literal', () => {
        const src = readFileSync(join(HERE, 'regionRederive.js'), 'utf8');
        for (const { id } of substrateRegistry.getAll()) {
            expect(src.includes(`'${id}'`) || src.includes(`"${id}"`), id).toBe(false);
        }
    });
});
