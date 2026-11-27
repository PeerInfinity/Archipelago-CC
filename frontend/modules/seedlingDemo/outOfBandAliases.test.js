/**
 * outOfBandAliases — slice `rules-spinner-alias-guards`: the ONE derivation of the `{N, 29}` slots a tag −1 write
 * clears (`Main.as:222`), and the three guards that call it: the allocator reservation (a), the end-of-build
 * refusal of a level set (a), and the rules producer's refusal of an event on an alias slot (b).
 *
 * ⛔ The vanilla answer `{17:{29}, 91:{29}}` appears HERE ONLY, as an expectation: every guard derives it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    ALIAS_CITE, ALIAS_WRITER_TYPES, OutOfBandAliasError,
    aliasCollisionsOf, aliasReservedFor, aliasTargetsOf, aliasWritersAt, aliasWritersOf, assertNoAliasCollision,
} from './outOfBandAliases.js';
import { OUT_OF_BAND_WRITERS } from './outOfBandLedger.js';
import { OUT_OF_BAND_WRITER_CLASSES } from './levelWorld.js';
import { placementTagId } from './procgenSeedling.js';
import { buildPlacementTable } from './apPlacementRewriter.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';
import { buildLevelSet } from './levelSetExporter.js';
import { validateLevelSet } from './levelSetValidator.js';
import { refuseAliasedEvents } from '../flashPanel/seedlingObstacleEvents.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const PLAYTHROUGH = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');

const asObject = (m) => Object.fromEntries([...m].map(([l, s]) => [l, [...s].sort((a, b) => a - b)]));
const withLevel = (map, level, edit) => ({
    ...map, levels: map.levels.map((l) => (l.level === level ? { ...l, entities: edit(l.entities) } : l)),
});
const ent = (type, tag, x = 16, y = 16) => ({ type, x, y, ...(tag === undefined ? {} : { attrs: { tag: String(tag) } }) });

describe('aliasTargetsOf — the derivation', () => {
    it('vanilla map → exactly {17:{29}, 91:{29}}, from five named writers', () => {
        expect(asObject(aliasTargetsOf(MAP))).toEqual({ 17: [29], 91: [29] });
        expect(aliasWritersOf(MAP).map((w) => `L${w.from} ${w.id} ${w.as3} -> {${w.level},${w.tag}}`)).toEqual([
            'L18 spinner@48,96 Spinner -> {17,29}',
            'L18 spinner@112,48 Spinner -> {17,29}',
            'L92 spinner@224,64 Spinner -> {91,29}',
            'L92 breakablerock@176,48 BreakableRock -> {91,29}',
            'L92 breakablerock@256,112 BreakableRock -> {91,29}',
        ]);
        expect(aliasCollisionsOf(MAP)).toEqual([]);
        expect(aliasReservedFor(aliasTargetsOf(MAP), 17)).toEqual([29]);
        expect(aliasReservedFor(aliasTargetsOf(MAP), 16)).toEqual([]);
    });

    it('a synthetic L18 without its spinners derives no target in L17', () => {
        const bare = withLevel(MAP, 18, (es) => es.filter((e) => e.type !== 'spinner'));
        expect(asObject(aliasTargetsOf(bare))).toEqual({ 91: [29] });
    });

    it('only an EXPLICIT negative tag counts: an absent `tag` is int("") = 0 in the loader, an in-band write', () => {
        const absent = withLevel(MAP, 18, (es) => es.map((e) => (e.type === 'spinner' ? { ...e, attrs: {} } : e)));
        expect(aliasTargetsOf(absent).has(17)).toBe(false);
        const inBand = withLevel(MAP, 18, (es) => es.map((e) => (e.type === 'spinner' ? ent('spinner', 4, e.x, e.y) : e)));
        expect(aliasTargetsOf(inBand).has(17)).toBe(false);
    });

    it('a writer in level 0 writes index -1, before the first row: no alias, no throw', () => {
        expect(aliasTargetsOf([{ level: 0, entities: [ent('spinner', -1)] }]).size).toBe(0);
    });

    it('a record without an integer level is refused by name', () => {
        expect(() => aliasTargetsOf([{ entities: [] }])).toThrow(OutOfBandAliasError);
        expect(() => aliasTargetsOf(null)).toThrow(/map document/);
    });
});

describe('ALIAS_WRITER_TYPES — read from the engine and the ledger, never re-listed', () => {
    it('carries every engine row unchanged', () => {
        for (const [type, as3] of Object.entries(OUT_OF_BAND_WRITER_CLASSES)) expect(ALIAS_WRITER_TYPES[type]).toBe(as3);
        for (const as3 of new Set(Object.values(ALIAS_WRITER_TYPES))) expect(OUT_OF_BAND_WRITERS[as3], as3).toBeTruthy();
    });

    it('every Game.as loader element that builds a LEDGER class maps to it (a ledger class arrives without a second edit)', () => {
        const game = readFileSync(join(ROOT, 'vendor/seedling/src/Game.as'), 'utf8');
        const built = [...game.matchAll(/xml\.objects\[0\]\.(\w+)\)\s*\{[^}]*?new (\w+)\(/g)]
            .map(([, type, cls]) => [type, cls]).filter(([, cls]) => OUT_OF_BAND_WRITERS[cls]);
        expect(built.length).toBeGreaterThan(0);
        for (const [type, cls] of built) expect(ALIAS_WRITER_TYPES[type], `<${type}> builds ${cls}`).toBe(cls);
        // ⛓ the case this buys today: `fire` (Game.as `new Fire(o.@x, o.@y, o.@tag)`) has no engine row, yet a map-
        // placed fire carrying tag -1 is a writer (Fire.removed()), so it must derive.
        expect(OUT_OF_BAND_WRITER_CLASSES.fire).toBeUndefined();
        const fire = withLevel(MAP, 33, (es) => [...es, ent('fire', -1)]);
        expect(aliasWritersAt(fire, { level: 32, tag: 29 })).toEqual(['fire@16,16 (L33, Fire)']);
    });
});

describe('guard (a) — the allocator never hands out an alias slot', () => {
    // L17 with tags 0..28 already used: the lowest free slot is exactly the alias slot.
    const crowded = withLevel(MAP, 17, (es) => [...es, ...Array.from({ length: 29 }, (_, t) => ent('lock', t, 32 + 16 * t, 32))]);
    const room17 = crowded.levels.find((l) => l.level === 17);

    it('placementTagId with the derived reservation refuses rather than return 29', () => {
        expect(placementTagId(room17, [])).toBe(29);   // the latent bug, alias-blind
        expect(() => placementTagId(room17, aliasReservedFor(aliasTargetsOf(crowded), 17)))
            .toThrow(/no private slot left/);
    });

    it('buildPlacementTable reserves the alias slots of the rooms it is handed', () => {
        // The canonical rewrite allocates L19 tag 3; crowd L19 to 0..28 and give L20 a tag -1 spinner.
        const placed = new Map();
        for (const region of Object.values(PLAYTHROUGH.regions['1'])) {
            for (const loc of region.locations ?? []) if (loc.event !== true) placed.set(loc.name, loc.item);
        }
        const used19 = new Set(MAP.levels.find((l) => l.level === 19).entities
            .map((e) => Number(e.attrs?.tag)).filter((t) => Number.isInteger(t) && t >= 0));
        const pad = Array.from({ length: 29 }, (_, t) => t).filter((t) => !used19.has(t))
            .map((t) => ent('lock', t, 400 + 16 * t, 400));
        const mutant = withLevel(withLevel(MAP, 19, (es) => [...es, ...pad]), 20, (es) => [...es, ent('spinner', -1)]);
        const table = (rooms) => buildPlacementTable({ locationItemOf: (n) => placed.get(n) ?? null,
            ledger: R7_GOAL_LEDGER, rooms, selfPlayer: 1, bossReport: true });
        expect(asObject(aliasTargetsOf(mutant))[19]).toEqual([29]);
        expect(() => table(mutant.levels)).toThrow(/no private slot left/);
        // control: the same crowding with no writer in L20 hands out 29 (alias-free, so legitimate)
        const control = withLevel(MAP, 19, (es) => [...es, ...pad]);
        const e19 = table(control.levels).entries.filter((e) => e.level === 19 && e.tagSource === 'allocated');
        expect(e19.map((e) => e.tag)).toEqual([29]);
    });
});

describe('guard (a) — a level set is refused at the END of its build', () => {
    const room = (entities) => ({
        width: 3, height: 3, entities,
        layers: [{ name: 'tiles', set: 'tileset', tiles: [[1, 1, 1, 0]] }],
    });
    const setOf = (r0, r1) => buildLevelSet([{ record: room(r0), name: 'a' }, { record: room(r1), name: 'b' }],
        { link: false, setId: 'alias-test', start: { level: 0, x: 16, y: 16 }, menuRooms: [0], generator: 'test' }).set;
    const aliasErrors = (s) => validateLevelSet(s).errors.filter((e) => e.includes('Main.as:222'));

    it('an apitem at {0,29} with a tag -1 spinner in room 1 is refused, naming both', () => {
        const errs = aliasErrors(setOf([ent('apitem', 29)], [ent('spinner', -1, 48, 96)]));
        expect(errs).toHaveLength(1);
        expect(errs[0]).toMatch(/apitem@16,16 in L0/);
        expect(errs[0]).toMatch(/spinner@48,96 \(L1, Spinner\)/);
    });

    it('controls: no writer, or the writer in-band, or the owner at another slot — no alias error', () => {
        expect(aliasErrors(setOf([ent('apitem', 29)], [ent('spinner', 3)]))).toEqual([]);
        expect(aliasErrors(setOf([ent('apitem', 29)], []))).toEqual([]);
        expect(aliasErrors(setOf([ent('apitem', 28)], [ent('spinner', -1)]))).toEqual([]);
    });

    it('assertNoAliasCollision throws by name with the citation', () => {
        const map = [{ level: 0, entities: [ent('apitem', 29)] }, { level: 1, entities: [ent('breakablerock', -1)] }];
        expect(() => assertNoAliasCollision(map, { who: 'test' })).toThrow(OutOfBandAliasError);
        expect(() => assertNoAliasCollision(map)).toThrow(/breakablerock@16,16 \(L1, BreakableRock\).*Main\.as:222/s);
        expect(ALIAS_CITE).toMatch(/Main\.as:222/);
    });
});

describe('guard (b) — the rules producer refuses an event on an alias slot', () => {
    // The committed playthrough's flag events, re-keyed as the producer keys them (`flag:L<level>:<tag>`).
    const events = () => Object.values(PLAYTHROUGH.regions['1']).flatMap((r) => r.locations ?? [])
        .map((l) => [l.name, /^L(\d+) flag (\d+):/.exec(l.name)]).filter(([, m]) => m)
        .map(([name, m]) => ({ name, fields: { event_id: `flag:L${m[1]}:${m[2]}` } }));

    it('the committed playthrough events pass (none sits on an alias slot)', () => {
        expect(events().length).toBeGreaterThan(0);
        expect(() => refuseAliasedEvents(events(), aliasWritersOf(MAP))).not.toThrow();
    });

    it('a synthetic event at {17,29} throws with the writers named and Main.as:222 cited', () => {
        const bad = [...events(), { name: 'L17 flag 29: synthetic@0,0 cleared', fields: { event_id: 'flag:L17:29' } }];
        expect(() => refuseAliasedEvents(bad, aliasWritersOf(MAP)))
            .toThrow(/L17 flag 29.*spinner@48,96 \(L18, Spinner\), spinner@112,48 \(L18, Spinner\).*Main\.as:222/s);
    });

    it('the same event on a map whose L18 has no spinners passes', () => {
        const bare = withLevel(MAP, 18, (es) => es.filter((e) => e.type !== 'spinner'));
        const ev = [{ name: 'L17 flag 29: synthetic@0,0 cleared', fields: { event_id: 'flag:L17:29' } }];
        expect(() => refuseAliasedEvents(ev, aliasWritersOf(bare))).not.toThrow();
    });

    it('refuses a missing writer list by name rather than passing everything', () => {
        expect(() => refuseAliasedEvents([], undefined)).toThrow(/writers/);
    });
});
