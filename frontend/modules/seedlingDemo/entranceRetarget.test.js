/**
 * ER E5 IN THE LEVEL DATA — the retarget's mapping, pinned over the committed `seedling_er` preset and the
 * vanilla record set (`entranceRetarget.js`). Pure: no browser, no game.
 *
 * Nothing here names a pair. The oracle for "which exits moved" is the preset's own `placements` read against
 * the vanilla playthrough (a stairs is moved when the door it lands beside is not the door it landed beside in
 * vanilla), built independently of the module's plan.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    ENTRANCE_RETARGET_GENERATOR, EntranceRetargetError, applyEntranceShuffle, entranceShuffleBlock,
    exitsOfRecordSet, planEntranceRetarget, retargetSetForEntrances, signForDoorway,
} from './entranceRetarget.js';
import { EXIT_ELEMENTS, signForTransition } from './levelSetExits.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { parseRoomXml, validateLevelSet } from './levelSetValidator.js';
import { recordToOel } from './procgenLevelOel.js';
import { buildPlacementTable, rewriteRecordSet, AP_ITEM_TYPE } from './apPlacementRewriter.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';

const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const EMBED = readJson('./fixtures/seedling-vanilla-set.json');
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const ER = readJson('../../presets/seedling_er/AP_1/AP_1_rules.json');
const PLAYTHROUGH = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const SLOT = '1';

const { set: VANILLA } = vanillaRecordSet(EMBED, MAP);
const VANILLA_TEXT = JSON.stringify(VANILLA);
const PLAN = planEntranceRetarget({ rules: ER, slot: SLOT, set: VANILLA });
const { set: SHUFFLED, retargeted: RETARGETED } = retargetSetForEntrances(VANILLA, PLAN,
    { entranceRandomization: entranceShuffleBlock(ER, SLOT) });

/** Every sidecar departure of a preset, by its AP exit name. */
const departuresOf = (rules) => {
    const out = new Map();
    for (const [region, sidecar] of Object.entries(rules.preset_sidecars[SLOT])) {
        const payload = sidecar.playable_payload;
        for (const exit of payload?.exits ?? []) if (exit.exitName && exit.targetRegion) out.set(exit.exitName, { region, payload, exit });
    }
    return out;
};
const ER_DEPARTURES = departuresOf(ER);
/** The vanilla departure of the same DOOR (level + exit id): what the shuffle moved it away from. */
const VANILLA_BY_DOOR = new Map([...departuresOf(PLAYTHROUGH).values()]
    .map((d) => [`${d.payload.level}|${d.exit.exit_id}`, d]));
const doorOf = (name) => {
    const d = ER_DEPARTURES.get(name);
    return `${d.payload.level}|${d.exit.exit_id}`;
};
const PLACEMENTS = entranceShuffleBlock(ER, SLOT).placements;
/** The oracle: a placement is MOVED when its door lands on another arrival than in the vanilla playthrough. */
const ORACLE_MOVED = PLACEMENTS.filter((p) => {
    const now = ER_DEPARTURES.get(p.exit).exit;
    const then = VANILLA_BY_DOOR.get(doorOf(p.exit)).exit;
    return now.target_level !== then.target_level || now.targetExitId !== then.targetExitId;
}).map((p) => p.exit);

const exitRows = (set) => exitsOfRecordSet(set).exits;
const keyOf = (ex) => `${ex.level}|${ex.index}`;

describe('the plan: which room exits an entrance-randomized world moves', () => {
    it('a world that places no entrance has no plan, and its set comes back the same object', () => {
        expect(entranceShuffleBlock(PLAYTHROUGH, SLOT)).toBe(null);
        expect(planEntranceRetarget({ rules: PLAYTHROUGH, slot: SLOT, set: VANILLA })).toBe(null);
        const r = applyEntranceShuffle({ rules: PLAYTHROUGH, slot: SLOT, set: VANILLA });
        expect(r.set).toBe(VANILLA);
        expect(r.retargeted).toBe(0);
        expect(JSON.stringify(VANILLA)).toBe(VANILLA_TEXT);
    });

    it('every placement is planned: the moved ones are exactly the oracle\'s, each exactly once', () => {
        expect(ORACLE_MOVED.length).toBeGreaterThan(0);
        expect(PLAN.placements).toBe(PLACEMENTS.length);
        expect(PLAN.moved.map((m) => m.exit).sort()).toEqual([...ORACLE_MOVED].sort());
        expect([...PLAN.unmoved].sort()).toEqual(PLACEMENTS.map((p) => p.exit).filter((n) => !ORACLE_MOVED.includes(n)).sort());
        // one edit per room exit, and one room exit per moved placement
        const edits = [...PLAN.byLevel].flatMap(([level, list]) => list.map((e) => `${level}|${e.index}`));
        expect(new Set(edits).size).toBe(edits.length);
        expect(edits.length).toBe(PLAN.moved.length);
        expect(RETARGETED).toBe(PLAN.moved.length);
    });

    it('each moved row is the door its sidecar names: the room, the exit ordinal, the element and the tile', () => {
        const rows = new Map(exitRows(VANILLA).map((ex) => [keyOf(ex), ex]));
        for (const m of PLAN.moved) {
            const { payload, exit } = ER_DEPARTURES.get(m.exit);
            const here = rows.get(`${m.level}|${m.index}`);
            expect(m.level, m.exit).toBe(payload.level);
            expect(`out_${here.element}_${here.x}_${here.y}`, m.exit).toBe(exit.exit_id);
            expect([here.to, here.playerx, here.playery, here.sign], m.exit)
                .toEqual([m.from.to, m.from.playerx, m.from.playery, m.from.sign]);
            // ⚖ Q1: stairs only
            expect(['stairsup', 'stairsdown'], m.exit).toContain(here.element);
        }
    });

    it('the destination is the sidecar\'s level, and the landing is the game\'s own for that doorway', () => {
        const tables = exitsOfRecordSet(VANILLA);
        for (const m of PLAN.moved) {
            const { exit, payload } = ER_DEPARTURES.get(m.exit);
            expect(m.to.to, m.exit).toBe(exit.target_level);
            expect(m.spawn, m.exit).toEqual(exit.target_spawn);
            // the landing is on the sidecar's tile ...
            const size = payload.tile_size;
            expect([Math.floor(m.to.playerx / size), Math.floor(m.to.playery / size)], m.exit)
                .toEqual([Math.floor(exit.target_spawn.x / size), Math.floor(exit.target_spawn.y / size)]);
            // ... and is where a VANILLA exit into that room lands (the doorway the game's data states)
            expect(m.doorway.stated && m.doorway.agreed, m.exit).toBe(true);
            expect(tables.exits.some((ex) => ex.to === m.to.to && ex.playerx === m.to.playerx && ex.playery === m.to.playery), m.exit)
                .toBe(true);
        }
        // ⚠ the reason the landing is not simply `target_spawn`: a sidecar spawn is tile-snapped, and at least
        // one vanilla landing is not on the grid (measured; if none were, this module's doorway lookup would be
        // unexercised and this row says so)
        const offGrid = PLAN.moved.filter((m) => m.to.playerx !== m.spawn.x || m.to.playery !== m.spawn.y);
        expect(offGrid.length).toBeGreaterThan(0);
    });

    it('COUPLED: each moved stairs\' placement target is a moved stairs that leads back to the room it left', () => {
        const byName = new Map(PLAN.moved.map((m) => [m.exit, m]));
        for (const m of PLAN.moved) {
            const partner = byName.get(m.target);
            expect(partner, m.exit).toBeTruthy();
            expect(partner.target, m.exit).toBe(m.exit);
            expect(partner.level, m.exit).toBe(m.to.to);
            expect(partner.to.to, m.exit).toBe(m.level);
            expect(partner.region, m.exit).toBe(m.targetRegion);
        }
    });
});

describe('the sign: the landing doorway\'s, never the source exit\'s old one', () => {
    const tables = exitsOfRecordSet(VANILLA);

    it('on vanilla the rule reproduces every exit\'s own landing and sign (the whole set, teleporters included)', () => {
        const size = MAP.tile_size;
        const wrong = tables.exits.filter((ex) => {
            const doorway = tables.doorwayOf(ex.to, { x: ex.playerx, y: ex.playery }, size);
            return !doorway.agreed || doorway.x !== ex.playerx || doorway.y !== ex.playery
                || signForDoorway(tables, ex.level, doorway) !== ex.sign;
        });
        expect(wrong).toEqual([]);
        // and the set does carry signed exits, so the row above is not vacuous
        expect(tables.exits.some((ex) => ex.sign !== 0)).toBe(true);
    });

    it('a moved stairs carries the sign of the vanilla exit whose landing it takes, silenced inside that region', () => {
        for (const m of PLAN.moved) {
            const landing = tables.exits.filter((ex) => ex.to === m.to.to && ex.playerx === m.to.playerx && ex.playery === m.to.playery);
            const signs = [...new Set(landing.map((ex) => ex.sign))];
            expect(signs, m.exit).toHaveLength(1);
            expect(m.to.sign, m.exit).toBe(signForTransition(tables.regionOf(m.level), signs[0]));
        }
    });

    it('a signed vanilla stairs that moved lost its sign unless its new landing announces, and the announcing landing kept one entrance', () => {
        const signedBefore = PLAN.moved.filter((m) => m.from.sign !== 0);
        const signedAfter = PLAN.moved.filter((m) => m.to.sign !== 0);
        // the seed's draw moves a signed stairs (else this row would measure nothing)
        expect(signedBefore.length).toBeGreaterThan(0);
        for (const m of signedBefore) {
            // ⛔ carrying the old sign would announce the region of the room the player did NOT go to
            if (m.to.sign !== 0) expect(m.to.sign, m.exit).toBe(m.doorway.sign);
            else expect(m.doorway.sign === 0 || tables.regionOf(m.level) === m.doorway.sign, m.exit).toBe(true);
        }
        // every signed landing the shuffle vacated is taken by exactly one moved stairs, which announces it
        for (const m of signedBefore) {
            const takers = signedAfter.filter((t) => t.to.to === m.from.to && t.to.playerx === m.from.playerx && t.to.playery === m.from.playery);
            expect(takers.map((t) => t.to.sign), m.exit).toEqual([m.from.sign]);
        }
    });

    it('a stairs leaving a room of the region its landing announces stays silent (a synthetic doorway)', () => {
        const signed = tables.exits.find((ex) => ex.sign !== 0);
        const doorway = tables.doorwayOf(signed.to, { x: signed.playerx, y: signed.playery }, MAP.tile_size);
        expect(doorway.sign).toBe(signed.sign);
        expect(tables.regionOf(signed.to)).toBe(signed.sign);
        expect(signForDoorway(tables, signed.to, doorway)).toBe(0);
        expect(signForDoorway(tables, signed.level, doorway)).toBe(signed.sign);
    });
});

describe('the retargeted set', () => {
    it('unmoved exits are untouched: the only bytes that differ are the planned exits\' four attributes', () => {
        expect(JSON.stringify(VANILLA)).toBe(VANILLA_TEXT);        // the input is not written to
        const planned = new Map(PLAN.moved.map((m) => [`${m.level}|${m.index}`, m]));
        let changedEntities = 0;
        expect(SHUFFLED.rooms).toHaveLength(VANILLA.rooms.length);
        VANILLA.rooms.forEach((room, i) => {
            const next = SHUFFLED.rooms[i];
            const { source: a, ...restA } = room;
            const { source: b, ...restB } = next;
            expect(restB).toEqual(restA);
            const { entities: ea, ...recA } = a.record;
            const { entities: eb, ...recB } = b.record;
            expect(recB).toEqual(recA);
            expect(eb).toHaveLength(ea.length);
            let index = 0;
            ea.forEach((e, k) => {
                const isExit = EXIT_ELEMENTS.includes(e.type) && (e.attrs?.to ?? '') !== '';
                const m = isExit ? planned.get(`${room.id}|${index}`) : undefined;
                if (isExit) index += 1;
                if (!m) { expect(eb[k]).toEqual(e); return; }
                changedEntities += 1;
                const { attrs: before, ...entA } = e;
                const { attrs: after, ...entB } = eb[k];
                expect(entB).toEqual(entA);
                const keep = (o) => Object.fromEntries(Object.entries(o).filter(([key]) => !['to', 'playerx', 'playery', 'sign'].includes(key)));
                expect(keep(after)).toEqual(keep(before));
                expect([Number(after.to), Number(after.playerx), Number(after.playery), Number(after.sign ?? 0)])
                    .toEqual([m.to.to, m.to.playerx, m.to.playery, m.to.sign]);
                // absent + default stays absent (the writers' rule)
                if (before.sign === undefined && m.to.sign === 0) expect(Object.hasOwn(after, 'sign')).toBe(false);
            });
        });
        expect(changedEntities).toBe(PLAN.moved.length);
    });

    it('round-trips through the OEL: `parseRoomXml` of each rendered room yields the shuffled destinations', () => {
        const planned = new Map(PLAN.moved.map((m) => [`${m.level}|${m.index}`, m]));
        const before = new Map(exitRows(VANILLA).map((ex) => [keyOf(ex), ex]));
        let seenMoved = 0;
        for (const room of SHUFFLED.rooms) {
            const doc = parseRoomXml(recordToOel(room.source.record));
            doc.exits.forEach((ex, index) => {
                const key = `${room.id}|${index}`;
                const m = planned.get(key);
                const want = m ? m.to : before.get(key);
                if (m) seenMoved += 1;
                expect([ex.to, ex.playerx, ex.playery, ex.sign], key).toEqual([want.to, want.playerx, want.playery, want.sign]);
            });
        }
        expect(seenMoved).toBe(PLAN.moved.length);
    });

    it('every stairs departure of the shuffled world agrees with the delivered data: level and landing tile', () => {
        const rows = new Map(exitRows(SHUFFLED).map((ex) => [`${ex.level}|out_${ex.element}_${ex.x}_${ex.y}`, ex]));
        let stairs = 0;
        for (const { payload, exit } of ER_DEPARTURES.values()) {
            const here = rows.get(`${payload.level}|${exit.exit_id}`);
            if (!here || !Number.isInteger(exit.target_level)) continue;   // a pit, or an exit the level data cannot name
            if (here.element !== 'teleporter') stairs += 1;
            const size = payload.tile_size;
            expect([here.to, Math.floor(here.playerx / size), Math.floor(here.playery / size)], exit.exitName)
                .toEqual([exit.target_level, Math.floor(exit.target_spawn.x / size), Math.floor(exit.target_spawn.y / size)]);
        }
        expect(stairs).toBeGreaterThanOrEqual(PLACEMENTS.length);
    });

    it('is a DIFFERENT, valid set: re-stamped, provenance says what it is, the validator passes', () => {
        expect(SHUFFLED.set_id).not.toBe(VANILLA.set_id);
        expect(SHUFFLED.provenance.content_hash).not.toBe(VANILLA.provenance.content_hash);
        expect(SHUFFLED.provenance.generator).toBe(ENTRANCE_RETARGET_GENERATOR);
        expect(SHUFFLED.provenance.derived_from).toEqual({ set_id: VANILLA.set_id, content_hash: VANILLA.provenance.content_hash });
        expect(SHUFFLED.provenance.entrance_randomization).toEqual({ exits: PLAN.moved.length,
            seed: entranceShuffleBlock(ER, SLOT).seed, algorithm: entranceShuffleBlock(ER, SLOT).algorithm });
        const verdict = validateLevelSet(SHUFFLED);
        expect(verdict.errors).toEqual([]);
        expect(verdict.ok).toBe(true);
    });

    it('a plan that moves nothing hands back the set it was given (an identity shuffle changes no byte)', () => {
        const again = planEntranceRetarget({ rules: ER, slot: SLOT, set: SHUFFLED });
        expect(again.moved).toEqual([]);
        expect(again.unmoved).toHaveLength(PLACEMENTS.length);
        const r = retargetSetForEntrances(SHUFFLED, again);
        expect(r.set).toBe(SHUFFLED);
        expect(r.retargeted).toBe(0);
    });
});

describe('composing with the AP item rewrite', () => {
    const itemOf = new Map(Object.values(ER.regions[SLOT]).flatMap((r) => r.locations ?? []).map((l) => [l.name, l.item]));
    const { table } = buildPlacementTable({
        locationItemOf: (name) => (itemOf.get(name) ? { name: itemOf.get(name).name, player: itemOf.get(name).player } : null),
        ledger: R7_GOAL_LEDGER,
        rooms: MAP.levels,
        selfPlayer: 1,
        bossReport: true,
    });
    const { set: placed, replaced } = rewriteRecordSet(VANILLA, table);

    it('items then exits and exits then items give the same rooms; neither rewrite touches the other\'s entities', () => {
        const a = applyEntranceShuffle({ rules: ER, slot: SLOT, set: placed });
        const b = rewriteRecordSet(SHUFFLED, table);
        expect(a.retargeted).toBe(PLAN.moved.length);
        expect(b.replaced).toBe(replaced);
        expect(a.set.rooms.map((r) => r.source.record)).toEqual(b.set.rooms.map((r) => r.source.record));
        const count = (set, type) => set.rooms.flatMap((r) => r.source.record.entities).filter((e) => e.type === type).length;
        expect(count(a.set, AP_ITEM_TYPE)).toBe(replaced);
        expect(exitRows(a.set)).toEqual(exitRows(SHUFFLED));
        // the composed set's identity is its own (the delivery's): not the placed set's, not the vanilla retarget's
        expect(a.set.set_id).not.toBe(placed.set_id);
        expect(a.set.provenance.derived_from.set_id).toBe(placed.set_id);
        expect(validateLevelSet(a.set).ok).toBe(true);
    });
});

describe('refusals are by name', () => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const withBlock = (edit) => {
        const rules = { entrance_randomization: clone(ER.entrance_randomization), preset_sidecars: ER.preset_sidecars };
        edit(rules.entrance_randomization[SLOT]);
        return rules;
    };
    const first = PLAN.moved[0];

    it('a placement naming no departure', () => {
        const rules = withBlock((b) => { b.placements.push({ exit: 'nowhere -> nothing', target: first.exit }); });
        expect(() => planEntranceRetarget({ rules, slot: SLOT, set: VANILLA })).toThrow(EntranceRetargetError);
        expect(() => planEntranceRetarget({ rules, slot: SLOT, set: VANILLA })).toThrow(/nowhere -> nothing.*names no departure/);
    });

    it('two placements on one door', () => {
        const rules = withBlock((b) => { b.placements.push({ ...b.placements.find((p) => p.exit === first.exit) }); });
        expect(() => planEntranceRetarget({ rules, slot: SLOT, set: VANILLA })).toThrow(/are both exit .* one door has one destination/);
    });

    it('a destination the level data cannot name (no level, or no landing)', () => {
        const rules = { entrance_randomization: ER.entrance_randomization, preset_sidecars: clone(ER.preset_sidecars) };
        const exit = rules.preset_sidecars[SLOT][first.region].playable_payload.exits.find((e) => e.exitName === first.exit);
        exit.target_level = null;
        expect(() => planEntranceRetarget({ rules, slot: SLOT, set: VANILLA })).toThrow(new RegExp(`${first.exit}.*no level or no landing`));
    });

    it('a door the set does not hold, and rules with no sidecars', () => {
        const rules = { entrance_randomization: ER.entrance_randomization, preset_sidecars: clone(ER.preset_sidecars) };
        const exit = rules.preset_sidecars[SLOT][first.region].playable_payload.exits.find((e) => e.exitName === first.exit);
        exit.exit_id = 'out_stairsup_9999_9999';
        exit.exit_tiles = [[9999, 9999]];
        expect(() => planEntranceRetarget({ rules, slot: SLOT, set: VANILLA })).toThrow(/no exit of that room match it/);
        expect(() => planEntranceRetarget({ rules: { entrance_randomization: ER.entrance_randomization }, slot: SLOT, set: VANILLA }))
            .toThrow(/carry no `preset_sidecars`/);
    });

    it('a plan applied to a set it was not made for', () => {
        const other = clone(VANILLA);
        const level = PLAN.moved[0].level;
        other.rooms = other.rooms.filter((r) => r.id !== level);
        expect(() => retargetSetForEntrances(other, PLAN)).toThrow(/addresses .* room\(s\) and .* were found/);
    });

    it('a hand-named door is found by its tile (the starter atlas\'s kind of id)', () => {
        const rules = { entrance_randomization: ER.entrance_randomization, preset_sidecars: clone(ER.preset_sidecars) };
        const exit = rules.preset_sidecars[SLOT][first.region].playable_payload.exits.find((e) => e.exitName === first.exit);
        exit.exit_id = 'a_named_stairs';
        const plan = planEntranceRetarget({ rules, slot: SLOT, set: VANILLA });
        expect(plan.moved.find((m) => m.exit === first.exit)).toMatchObject({ level: first.level, index: first.index, to: first.to });
    });
});
