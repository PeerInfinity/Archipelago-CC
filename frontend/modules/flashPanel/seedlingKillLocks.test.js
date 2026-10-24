/**
 * ⛓ RULES kill-locks — `killLockRoomRuling`: a `tset == -1` lock costs the
 * conjunction, over its room's COUNTED bodies, of each body's ways to die.
 *
 * Synthetic rooms pin the combination (an enemy-kill table → the rule; a free
 * environmental kill; an undecided room keeps today's rule); the real map pins
 * the census the generator charges, and the committed rules pin the two doors
 * that stand under a kill-lock (L5 free, L98 charged).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ENTITY_SEMANTICS, conditionKey, flag, anyOf, tileTypeForColumn, SEEDLING_TILE_SIZE } from './seedlingSemantics.js';
import {
    A_WEAPON,
    KILL_ARM_CONDITION,
    KILL_ARM_ITEMS,
    KILL_LOCK_BODY_CLASSES,
    KILL_LOCK_UNREAD_COUNTED_TAGS,
    buildKillLockRulings,
    killLockRoomRuling,
    overlayEntitySemantics,
} from './seedlingPlaythroughOverlay.js';
import { TOTAL_ENEMIES_CLASSES } from '../seedlingDemo/combat.js';

const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const MAP = read('./atlases/seedling-map.json');

/** A tileset placement that paints tile type `t` at tile (x, y). */
const COLUMN_OF = (t) => {
    for (let c = 0; c < 256; c += 1) if (tileTypeForColumn(c) === t) return c;
    throw new Error(`no column paints tile type ${t}`);
};
const tile = (x, y, t) => [x, y, COLUMN_OF(t) * SEEDLING_TILE_SIZE, 0];
const ent = (type, x, y, attrs = {}) => ({ type, x, y, attrs });
const room = (level, entities, tiles = []) => ({
    level, entities: [ent('lock', 0, 0, { tset: '-1', tag: '0' }), ...entities], layers: [{ name: 'ground', tiles }],
});
const W = conditionKey(KILL_ARM_CONDITION);

describe('the kill table → the rule', () => {
    it('the item arms are exactly the four the AS3 hands to Enemy.hit', () => {
        expect(Object.keys(KILL_ARM_ITEMS).sort()).toEqual(['hasDarkShield', 'hasSpear', 'hasSword', 'hasWand']);
        expect(W).toBe(conditionKey(anyOf(...Object.keys(KILL_ARM_ITEMS).map((f) => flag(f)))));
    });

    it('two weapon-only bodies cost ONE disjunction (the conjunction dedupes)', () => {
        const r = killLockRoomRuling(room(900, [ent('jellyfish', 32, 32), ent('spinner', 64, 32)]));
        expect(r.verdict).toBe('gated');
        expect(conditionKey(r.condition)).toBe(W);
        expect(r.bodies.map((b) => b.class)).toEqual(['Jellyfish', 'Spinner']);
    });

    it('the ruling reaches the lock through the overlay ctx', () => {
        const level = room(901, [ent('puncher', 32, 32)]);
        const ctx = { level: 901, killLocks: buildKillLockRulings({ levels: [level] }) };
        const ruled = overlayEntitySemantics(level.entities[0], ENTITY_SEMANTICS.lock, ctx);
        expect(ruled.kind).toBe('gated');
        expect(conditionKey(ruled.condition)).toBe(W);
        expect(ruled.why).toMatch(/killLockRoomRuling/);
    });

    it('an uncounted class (lavatrap, shadow) costs nothing and a room of none is free', () => {
        const r = killLockRoomRuling(room(902, [ent('lavatrap', 32, 32), ent('shadow', 48, 48)]));
        expect(r.verdict).toBe('free');
        expect(r.bodies).toEqual([]);
    });

    it('a level with no tset -1 lock has no row', () => {
        expect(killLockRoomRuling({ level: 903, entities: [ent('lock', 0, 0, { tset: '0' })], layers: [] })).toBeNull();
    });
});

describe('a free kill', () => {
    it('a MEASURED environmental arm (L5, the arrows) makes the room free and the lock OPEN', () => {
        const level = room(5, [ent('bob', 16, 64), ent('bob', 48, 80), ent('arrowtrap', 16, 16)], [tile(1, 1, 1)]);
        const r = killLockRoomRuling(level);
        expect(r.verdict).toBe('free');
        expect(r.bodies.every((b) => b.env === 'measured:ceiling')).toBe(true);
        const ruled = overlayEntitySemantics(level.entities[0], ENTITY_SEMANTICS.lock,
            { level: 5, killLocks: new Map([[5, r]]) });
        expect(ruled.kind).toBe('open');
        expect(ruled.cite).toMatch(/f1-l5-lock-removal/);
    });

    it('a self-removing body (the grenade) is free', () => {
        expect(killLockRoomRuling(room(904, [ent('grenade', 32, 32)])).verdict).toBe('free');
    });
});

describe('an undecided room keeps its rule', () => {
    it('a body that dies on a tile the room holds, with nothing measured, is undecided → A_WEAPON', () => {
        const level = room(905, [ent('bob', 32, 32)], [tile(5, 5, 1)]);
        const r = killLockRoomRuling(level);
        expect(r.verdict).toBe('undecided');
        expect(conditionKey(r.condition)).toBe(conditionKey(A_WEAPON));
        const ruled = overlayEntitySemantics(level.entities[0], ENTITY_SEMANTICS.lock,
            { level: 905, killLocks: new Map([[905, r]]) });
        expect(conditionKey(ruled.condition)).toBe(conditionKey(A_WEAPON));
        expect(ruled.why).toMatch(/UNDECIDED \(kept\)/);
    });

    it('…unless another body already forces the same items (absorption)', () => {
        const level = room(906, [ent('bob', 32, 32), ent('jellyfish', 64, 64)], [tile(5, 5, 1)]);
        const r = killLockRoomRuling(level);
        expect(r.verdict).toBe('gated');
        expect(conditionKey(r.condition)).toBe(W);
    });

    it('an enemy-hitting entity is an environmental arm too', () => {
        expect(killLockRoomRuling(room(907, [ent('spinner', 32, 32), ent('pulser', 64, 64)])).verdict).toBe('undecided');
    });

    it('an IceTurret whose corpse cannot drown never opens its lock by a kill', () => {
        const dry = killLockRoomRuling(room(908, [ent('iceturret', 0, 0)]));
        expect(dry.verdict).toBe('undecided');
        expect(dry.why.join()).toMatch(/corpse stays counted/);
        const wet = killLockRoomRuling(room(909, [ent('iceturret', 0, 0)], [tile(1, 1, 1)]));
        expect(wet.verdict).toBe('gated');
        expect(conditionKey(wet.condition)).toBe(W);
    });

    it('a body standing on lava it survives is an undecided reach', () => {
        const r = killLockRoomRuling(room(910, [ent('lavarunner', 32, 32)], [tile(2, 2, 17)]));
        expect(r.verdict).toBe('undecided');
        expect(r.why.join()).toMatch(/lava it survives/);
    });

    it('an unread counted class and a spawner are undecided', () => {
        expect(killLockRoomRuling(room(911, [ent('flyer', 32, 32)])).verdict).toBe('undecided');
        expect(killLockRoomRuling(room(912, [ent('jellyfish', 32, 32), ent('lavaboss', 64, 64)])).verdict).toBe('undecided');
    });
});

describe('the tables against the model\'s transcription', () => {
    it('every read or unread tag is a class Game.totalEnemies() counts', () => {
        const read_ = Object.values(KILL_LOCK_BODY_CLASSES).map((r) => r.class);
        for (const c of read_) expect(TOTAL_ENEMIES_CLASSES).toContain(c);
        expect(KILL_LOCK_UNREAD_COUNTED_TAGS.filter((t) => KILL_LOCK_BODY_CLASSES[t])).toEqual([]);
    });

    it('every counted tag PLACED in the map is read or named unread', () => {
        const known = new Set([...Object.keys(KILL_LOCK_BODY_CLASSES), ...KILL_LOCK_UNREAD_COUNTED_TAGS]);
        const counted = new Set(TOTAL_ENEMIES_CLASSES.map((c) => c.toLowerCase()));
        const placed = new Set(MAP.levels.flatMap((l) => l.entities.map((e) => e.type)));
        const missing = [...placed].filter((t) => counted.has(t.replace(/\d+$/, '')) && !known.has(t));
        expect(missing).toEqual([]);
    });
});

describe('the census over the map (the generator charges this)', () => {
    const rulings = buildKillLockRulings(MAP);
    const by = (v) => [...rulings.values()].filter((r) => r.verdict === v).map((r) => r.level);

    it('ten kill-lock rooms: L5 free; five decided by their bodies; four undecided', () => {
        expect([...rulings.keys()]).toEqual([5, 18, 26, 39, 53, 60, 71, 78, 98, 99]);
        expect(by('free')).toEqual([5]);
        expect(by('gated')).toEqual([18, 26, 53, 60, 98]);
        expect(by('undecided')).toEqual([39, 71, 78, 99]);
        for (const l of by('gated')) expect(conditionKey(rulings.get(l).condition)).toBe(W);
    });
});

describe('the committed rules: the doors under a kill-lock', () => {
    const rules = read('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
    const regions = rules.regions['1'] ?? rules.regions;
    const exitTo = (from, to) => (regions[from]?.exits ?? []).find((e) => e.connected_region === to);
    const items = (rule) => JSON.stringify(rule);

    it('L5 → L6 (the teleporter under the lock) stays True_: its bobs die to the arrows', () => {
        expect(exitTo('level_5__r1c5', 'level_6').access_rule).toEqual({ rule: 'True_' });
    });

    it('L98 → L99 (the stairs under the lock) costs the room\'s kill', () => {
        const rule = items(exitTo('level_98', 'level_99__r2c7').access_rule);
        for (const item of ['Progressive Sword', 'Ghost Spear', 'Wand']) expect(rule).toContain(item);
        expect(rule).toMatch(/Progressive Shield/);
    });
});
