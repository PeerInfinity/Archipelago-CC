/**
 * textAdventureRegionRoundTrip — **THE TEXT ADVENTURE'S DOCUMENT ⇄ ROOM ROUND
 * TRIP, DRIVEN** (PRESET SIDECARS G2b-1; plan §25.2, §26).
 *
 * First on a spec room (two gated exits, one open; three locations, one gated),
 * then through the hub's REAL `inspectRegionRoom` / `deriveRegionRules` over
 * every committed text-adventure sidecar — the population read off `git
 * ls-files`, never listed here, and every rule compared against the DOCUMENT's
 * own, never against a rule typed here.
 *
 * ⚠ Edit ▸ needs a `roomEditor` too, which the entry does not declare (G2b-2 is
 * deferred). The corpus rows that ask the Edit door's own three checks install
 * a PLACEHOLDER launcher through `registerRegionEditor` — the resolver's
 * override table, which a test may write and a shipping module may not
 * (`regionEditors.test.js` scans for callers outside tests) — and remove it
 * after. The round trip itself is always the ENTRY's.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import { textAdventureRegionRoundTrip } from './textAdventureRegionRoundTrip.js';
import {
    extractTextAdventureRules,
    generateTextAdventureRoom,
    placeTextAdventureRules,
    serializeTextAdventureRoom,
    textAdventureRoomRefusal,
} from './textAdventureRoom.js';
import {
    deriveRegionRules, inspectRegionRoom, regionRoundTripOf, sameRule,
} from '../apworldEditor/regionRoundTrip.js';
import { regionEditors, registerRegionEditor } from '../procgenPipeline/regionEditors.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SUBSTRATE = substrateRegistryEntry.id;
const TRUE = { rule: 'True_' };
const bytes = (v) => JSON.stringify(v);

const GATE_A = { rule: 'Has', args: { item_name: 'Yellow Key' } };
const GATE_B = { rule: 'HasAll', args: { item_names: ['Black Key', 'Bridge'] } };
const LOC_GATE = { rule: 'Has', args: { item_name: 'Sword' } };
const SPEC = Object.freeze({
    exits: { North: GATE_A, East: GATE_B, Down: TRUE },
    locations: { 'Slay Dragon': LOC_GATE, 'Open Chest': TRUE, 'Pick Up Sword': TRUE },
});

/**
 * The spec room as a PRODUCER writes it: the room's own serializer, then the
 * engine's envelope stamps appended after it (the order `buildPresetSidecars`
 * writes them in is the caller's — `stamps` says which).
 */
function specPayload(regionId = 'Hall', stamps = { manaEnabled: true, fogEnabled: true }) {
    const { world } = generateTextAdventureRoom({
        region_id: regionId,
        exits: [
            { exit_id: 'North', side: 'N', targetRegion: 'Tower' },
            { exit_id: 'East', side: 'E', targetRegion: 'Vault' },
            { exit_id: 'Down', side: 'S', targetRegion: 'Cellar' },
        ],
    });
    placeTextAdventureRules(world, {
        exit_rules: SPEC.exits,
        location_rules: { 'Slay Dragon': LOC_GATE, 'Open Chest': TRUE },
        item_placements: [
            { item_id: 'Black Key', location_id: 'Slay Dragon' },
            { item_id: 'Bridge', location_id: 'Open Chest' },
            { item_id: 'Sword', location_id: 'Pick Up Sword' },
        ],
    });
    const serialized = serializeTextAdventureRoom(world, extractTextAdventureRules(world, { regionId }));
    return { world, serialized, payload: { ...serialized, ...stamps } };
}

const roundTrip = (payload, regionId = 'Hall') => {
    const ctx = { regionId, player: '1', payload };
    const opened = textAdventureRegionRoundTrip.open(ctx);
    return { opened, out: textAdventureRegionRoundTrip.save(opened.unedited, ctx) };
};

describe('the declaration — on the ENTRY, resolved by the hub without a name', () => {
    it('⛓ the registered entry carries this module\'s `{open, save}`, and the hub resolves it', () => {
        expect(substrateRegistry.get(SUBSTRATE)).toBe(substrateRegistryEntry);
        expect(substrateRegistryEntry.regionRoundTrip).toBe(textAdventureRegionRoundTrip);
        const { rt, why } = regionRoundTripOf(SUBSTRATE);
        expect(why).toBe(null);
        expect(rt).toBe(textAdventureRegionRoundTrip);
    });

    it('⛓ sync members — a value, not a promise (the hub awaits either)', () => {
        const { opened, out } = roundTrip(specPayload().payload);
        expect(typeof opened.then).toBe('undefined');
        expect(typeof out.then).toBe('undefined');
    });
});

describe('open → save on a spec room', () => {
    it('⛓⛓ an unedited round trip writes the serializer\'s payload plus the envelope, byte for byte', () => {
        const { serialized, payload } = specPayload();
        const { out } = roundTrip(payload);
        expect(bytes(out.payload)).toBe(bytes(payload));
        expect(bytes(Object.fromEntries(Object.keys(serialized).map((k) => [k, out.payload[k]]))))
            .toBe(bytes(serialized));
    });

    it('⛓⛓ every exit and location answers the SPEC\'s rule, `True_` explicit where there is none', () => {
        const { payload } = specPayload();
        const { out } = roundTrip(payload);
        expect(Object.fromEntries(out.exits.map((e) => [e.id, e.rule]))).toEqual(SPEC.exits);
        // ⛓ a location answers by the AP name the PAYLOAD baked (the producer's
        //   `makeLocationName`), in the payload's order — never a name typed here
        expect(out.locations.map((l) => l.name)).toEqual(payload.locations.map((l) => l.name));
        expect(out.locations.map((l) => l.rule)).toEqual(Object.values(SPEC.locations));
        expect(out.exits.every((e) => e.rule && typeof e.rule.rule === 'string')).toBe(true);
        // ⛓ targets travel with the exit, items with the location
        expect(out.exits.map((e) => e.target_region)).toEqual(['Tower', 'Vault', 'Cellar']);
        expect(out.locations.map((l) => l.item)).toEqual(payload.locations.map((l) => l.item));
        expect(out.locations.map((l) => l.item)).toContain('Sword');
    });

    it('⛓ the envelope keys the serializer never writes are re-appended IN THE ORIGINAL\'S ORDER', () => {
        const { serialized } = specPayload();
        const envelope = Object.keys(specPayload().payload).filter((k) => !(k in serialized));
        expect(envelope.length).toBeGreaterThan(1);    // ⛔ premise: order is observable
        for (const order of [envelope, [...envelope].reverse()]) {
            const { payload } = specPayload('Hall', Object.fromEntries(order.map((k) => [k, true])));
            const { out } = roundTrip(payload);
            expect(Object.keys(out.payload)).toEqual(Object.keys(payload));
        }
    });

    it('⛔ open does not alias: the session\'s room and the baseline\'s are different objects', () => {
        const { opened } = roundTrip(specPayload().payload);
        expect(opened.session.record.world).not.toBe(opened.unedited.world);
        expect(opened.session.room).toBe(0);
    });

    it('⛔ a payload that is not a room: `open` throws the ROOM\'s own sentence', () => {
        const tileGrid = { tiles: [0], width: 1, height: 1, exits: [], fogEnabled: true };
        const sentence = textAdventureRoomRefusal(tileGrid);
        expect(typeof sentence).toBe('string');
        expect(() => textAdventureRegionRoundTrip.open({ regionId: 'R', payload: tileGrid }))
            .toThrow(sentence);
    });

    it('⛔ a save that carries no room is refused by a sentence naming the region', () => {
        expect(() => textAdventureRegionRoundTrip.save({ library: {} }, { regionId: 'Hall', payload: {} }))
            .toThrow(/no text-adventure room .* for "Hall"/);
    });
});

/* ── the committed corpus ─────────────────────────────────────────────── */

/** ⛓ Every tracked text-adventure sidecar region: `{file, doc, slot, name}`. */
function corpus() {
    const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    const out = [];
    for (const file of files) {
        const doc = JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
        for (const [slot, regions] of Object.entries(doc.preset_sidecars ?? {})) {
            for (const [name, entry] of Object.entries(regions ?? {})) {
                if (entry?.substrate === SUBSTRATE) out.push({ file, doc, slot, name });
            }
        }
    }
    return out;
}

/**
 * ⛓ The population floor — the committed text-adventure regions at G2b-1's W0
 * census (plan §26.0). A floor, not an equality: a new world only adds rows.
 * ⛔ Without it a corpus that lost its regions would pass every row vacuously.
 */
const CORPUS_FLOOR = 15;

describe('⛓⛓⛓ the committed corpus — through the hub\'s REAL door', () => {
    const regions = corpus();
    const at = (r) => `${r.file} slot ${r.slot} "${r.name}"`;
    const regionOf = (r) => r.doc.regions[r.slot][r.name];

    it('⛔ the population is non-vacuous: the floor, a gated exit and a gated location', () => {
        expect(regions.length).toBeGreaterThanOrEqual(CORPUS_FLOOR);
        const gated = (list) => list.some((e) => e.access_rule && e.access_rule.rule !== 'True_');
        expect(regions.some((r) => gated(regionOf(r).exits ?? []))).toBe(true);
        expect(regions.some((r) => gated(regionOf(r).locations ?? []))).toBe(true);
    });

    it('⛔ Edit ▸ stays refused on the ENTRY as declared — no `roomEditor`, said by name', async () => {
        for (const r of regions) {
            const got = await inspectRegionRoom(r.doc, r.slot, r.name);
            expect(got.ok, at(r)).toBe(false);
            expect(got.why, at(r)).toContain('declares no `roomEditor`');
        }
    });

    describe('with a placeholder launcher, the Edit door\'s three checks', () => {
        beforeAll(() => registerRegionEditor(SUBSTRATE, () => null));
        afterAll(() => { delete regionEditors[SUBSTRATE]; });

        it('⛓⛓ every region opens: the baseline moves no byte, every endpoint maps, NOTHING frozen', async () => {
            for (const r of regions) {
                const got = await inspectRegionRoom(r.doc, r.slot, r.name);
                expect(got.ok, `${at(r)}: ${got.why}`).toBe(true);
                expect(got.frozen, at(r)).toEqual([]);
                expect(got.movableExits.size, at(r)).toBe((regionOf(r).exits ?? []).length);
                expect(got.movableLocations.size, at(r)).toBe((regionOf(r).locations ?? []).length);
            }
        });

        it('⛔ a non-room payload is refused with the substrate\'s own sentence', async () => {
            const r = regions[0];
            const doc = structuredClone(r.doc);
            doc.preset_sidecars[r.slot][r.name].playable_payload = { tiles: [0], exits: [], fogEnabled: true };
            const got = await inspectRegionRoom(doc, r.slot, r.name);
            expect(got.ok).toBe(false);
            expect(got.why).toBe(`"${SUBSTRATE}" refused this region's payload — `
                + `${textAdventureRoomRefusal(doc.preset_sidecars[r.slot][r.name].playable_payload)}`);
        });
    });

    it('⛓⛓⛓ Re-derive: every document endpoint\'s rule is the one the payload re-emits', async () => {
        let endpoints = 0;
        let agreed = 0;
        for (const r of regions) {
            const d = await deriveRegionRules(r.doc, r.slot, r.name);
            expect(d.ok, `${at(r)}: ${d.why}`).toBe(true);
            expect(d.unnamed, at(r)).toEqual([]);
            expect(d.unmatched, at(r)).toEqual([]);
            const region = regionOf(r);
            for (const [list, derived] of [[region.exits ?? [], d.exits], [region.locations ?? [], d.locations]]) {
                for (const e of list) {
                    endpoints += 1;
                    if (sameRule(derived.get(e.name), e.access_rule)) agreed += 1;
                    else expect.soft(derived.get(e.name), `${at(r)} "${e.name}"`).toEqual(e.access_rule);
                }
            }
        }
        expect(endpoints).toBeGreaterThan(regions.length);
        expect(agreed).toBe(endpoints);
    });
});
