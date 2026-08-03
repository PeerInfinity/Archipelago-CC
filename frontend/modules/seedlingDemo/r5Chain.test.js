/**
 * r5Chain — the slice-4 declarations, asserted against the EXTRACT, and the
 * key leg's two recordings asserted against each other.
 *
 * `r5Acceptance.test.js` mutates the CLAIM; this file asks whether the
 * numbers the claim is phrased over are the ones the game's own level data
 * carries. They are different questions, and the second one is where a
 * declaration that was true when it was written goes stale.
 */

import { describe, expect, it } from 'vitest';

import { buildLevelWorld, ROLES, rectsOverlap } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { keyLineTouches, KEY_RESPONDERS, opensOnKeyTick } from './activators.js';
import { loadExpectation, loadTape } from './fixtures/index.js';
import {
    R5_KEY_TYPE, R5_KEY_PICKUP, R5_KEY_LOCKS, R5_ARENA_ARM_Y, R5_KEY_LEG_BOOT,
    R5_LOCK_SHUT_BOOT, KEY_LEG, KEY_LOCK_SHUT, KEY_LEG_EARNED, keyLockStance,
    R5ChainError, TILE,
} from './r5Chain.js';
import { KEY_LEG_ARM, KEY_LEG_CONTROL, KEY_LEG_LOCK_FACE_Y } from './r5Acceptance.js';

const source = atlasLevelSource();
const worldFor = (n) => buildLevelWorld(source(n), { roles: ROLES });

describe('the key and the two locks it opens', () => {
    it('the declared pickup is a keyType-1 BossKey where the extract says', () => {
        const w = worldFor(R5_KEY_PICKUP.level);
        const key = w.pickups.find((p) => p.x === R5_KEY_PICKUP.x && p.y === R5_KEY_PICKUP.y);
        expect(key).toBeDefined();
        expect(key.tag).toBe('bosskey');
        expect(key.keyType).toBe(R5_KEY_TYPE);
    });

    it('⛔ BOTH declared locks exist, are keyType 1, and carry the declared tags', () => {
        // The tag is what the ledger claim NAMES. A lock whose tag moved
        // would still open and would write a different flag, and a claim
        // phrased over whatever the extract happens to carry would follow it.
        for (const dec of R5_KEY_LOCKS) {
            const lock = worldFor(dec.level).activators
                .find((a) => a.x === dec.lock.x && a.y === dec.lock.y);
            expect(lock, `L${dec.level} @${dec.lock.x},${dec.lock.y}`).toBeDefined();
            expect(lock.tag).toBe('bosslock');
            expect(lock.keyType).toBe(R5_KEY_TYPE);
            expect(lock.persistTag).toBe(dec.tag);
        }
    });

    it('and the EARNED list is exactly those two flags', () => {
        expect(KEY_LEG_EARNED.map((e) => `${e.level}:${e.tag}`))
            .toEqual(R5_KEY_LOCKS.map((l) => `${l.level}:${l.tag}`));
    });

    it('⛔ L31\'s stairs to L30 are NOT reachable with the pocket lock shut', () => {
        // The finding that makes the second lock load-bearing rather than
        // incidental: §2.6.1 prices one lock, and a walk planned that way
        // reaches the middle of L31 with the key in hand and no verb aimed
        // at the wall in front of it.
        const w = worldFor(31);
        const walkable = (tx, ty) => tx >= 0 && ty >= 0 && tx < w.width && ty < w.height
            && !w.collidesSolid(playerBoxAt(tx * TILE + 8, ty * TILE + 8));
        const seen = new Set();
        const q = [[24, 7]];          // the L29 stairs' arrival tile
        while (q.length) {
            const [x, y] = q.pop();
            const k = `${x},${y}`;
            if (seen.has(k) || !walkable(x, y)) continue;
            seen.add(k);
            q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        const stairs = w.teleporters.find((t) => t.to === 30);
        expect(seen.has(`${stairs.x / TILE},${stairs.y / TILE}`)).toBe(false);
        // ...and the tile SOUTH of the lock, which the stance stands on, is.
        expect(seen.has('12,28')).toBe(true);
    });
});

describe('keyLockStance: one pixel wide, and both edges are a failure', () => {
    it('puts an integer probe of the key line inside the player box', () => {
        for (const dec of R5_KEY_LOCKS) {
            const w = worldFor(dec.level);
            const lock = w.activators.find((a) => a.x === dec.lock.x && a.y === dec.lock.y);
            const at = keyLockStance(lock);
            expect(keyLineTouches(playerBoxAt(at.x, at.y), lock.keyLine),
                `${lock.id} stance`).toBe(true);
            expect(w.collidesSolid(playerBoxAt(at.x, at.y))).toBeFalsy();
        }
    });

    it('⛔ and ONE PIXEL LOWER misses the probe row entirely', () => {
        // The L31 failure, kept as a test because the miss is silent: the
        // lock simply never latches and the walk stands there for its whole
        // window. `collideLine` tests INTEGER points, so a box top a fifth
        // of a pixel past the row contains nothing.
        const w = worldFor(31);
        const lock = w.activators.find((a) => a.x === 192 && a.y === 432);
        const at = keyLockStance(lock);
        expect(keyLineTouches(playerBoxAt(at.x, at.y + 1.2), lock.keyLine)).toBe(false);
    });

    it('refuses a lock it cannot read rather than returning NaN', () => {
        expect(() => keyLockStance(null)).toThrow(R5ChainError);
        expect(() => keyLockStance({ x: 1 })).toThrow(R5ChainError);
    });

    it('the declared leg targets ARE the derived stances', () => {
        for (const dec of R5_KEY_LOCKS) {
            const lock = worldFor(dec.level).activators
                .find((a) => a.x === dec.lock.x && a.y === dec.lock.y);
            const at = keyLockStance(lock);
            const leg = KEY_LEG.legs.find((l) => l.level === dec.level);
            const target = leg.targets.find((t) => t.keylock);
            expect({ x: target.x, y: target.y }).toEqual(at);
            expect(target.keylock.lock).toEqual({ x: dec.lock.x, y: dec.lock.y });
        }
    });
});

describe('the arena mouth, and why the leg stops one door short of it', () => {
    it('L32\'s arrival is eight pixels clear of the rock\'s arm line', () => {
        const arrival = worldFor(30).teleporters.find((t) => t.to === 32).arrival;
        expect(arrival).toEqual({ x: 80, y: 128 });
        expect(arrival.y - R5_ARENA_ARM_Y).toBe(8);
    });

    it('⛔ and BOTH pit tiles are under the burnable tree — the exit needs fire', () => {
        // §2.6.1 says `control fallthrough=30` is how you leave. It is, and
        // the two tiles it applies to are covered exactly by a 32x32
        // `type = "Solid"` that only `hit("Fire")` removes. So the arena's
        // exit needs the item the arena grants.
        const w = worldFor(32);
        const tree = w.solids.find((s) => s.tag === 'burnabletree');
        expect(tree).toBeDefined();
        expect(w.pitTiles).toHaveLength(2);
        for (const pit of w.pitTiles) {
            expect(rectsOverlap(tree.rect, pit.rect), `pit (${pit.tx},${pit.ty})`).toBe(true);
        }
    });

    it('the last leg is L30 and it declares no exit', () => {
        const last = KEY_LEG.legs.at(-1);
        expect(last.level).toBe(30);
        expect(last.exit).toBeUndefined();
    });
});

describe('what the game did — the key leg and its control', () => {
    const leg = loadExpectation(KEY_LEG_ARM).stream;
    const control = loadExpectation(KEY_LEG_CONTROL).stream;
    const legTape = loadTape(KEY_LEG_ARM);
    const controlTape = loadTape(KEY_LEG_CONTROL);

    it('both tapes are pinned, boot where the plan says, and clear nothing', () => {
        for (const t of [legTape, controlTape]) {
            expect(t.tape_version).toBe(5);
            expect([...t.pins]).toEqual([...KEY_LEG.pins]);
            expect([...t.noHazards]).toEqual([...KEY_LEG.noHazards]);
            // ⚠ THE WHOLE LEDGER CLAIM RESTS ON THIS. A declared clear would
            // turn "the walk opened two locks" into "the tape asked for two
            // flags", and the two are indistinguishable downstream.
            expect(t.persistence).toEqual([]);
            expect(t.grants).toEqual([]);
            expect(t.noDamage).toBe(true);
        }
        expect(legTape.boot).toEqual(R5_KEY_LEG_BOOT);
        expect(controlTape.boot).toEqual(R5_LOCK_SHUT_BOOT);
    });

    it('the leg crosses two doors and the control crosses none', () => {
        expect(leg.transitions.map((t) => `${t.from_level}->${t.to_level}`))
            .toEqual(['29->31', '31->30']);
        expect(control.transitions).toEqual([]);
        expect(new Set(control.ticks.map((o) => o.level))).toEqual(new Set([30]));
    });

    it('the control arm MOVES and then stops — a pin, not a tape that did nothing', () => {
        // 16 px of travel and then nothing. A control booted ON the line
        // could not move at all, and a position that never changes is one a
        // reader cannot tell from a tape with no inputs.
        const first = control.ticks[0];
        const last = control.ticks.at(-1);
        expect(first.y).toBeGreaterThan(last.y + 12);
        expect(last.x).toBe(first.x);
        expect(last.y - 2).toBeGreaterThanOrEqual(KEY_LEG_LOCK_FACE_Y);
        expect(last.y - 2).toBeLessThan(KEY_LEG_LOCK_FACE_Y + 1);
    });

    it('⚠ and it never REACHES the face — `Mobile.moveY` stops short and creeps', () => {
        // §14.9 again: the sweep steps `min(1, |yrel| - i)` and returns as
        // soon as the next step would collide, so `y - 2 === 224` is a
        // position this game does not produce. An assertion written that way
        // would be asserting a sweep nobody does.
        expect(control.ticks.at(-1).y - 2).not.toBe(KEY_LEG_LOCK_FACE_Y);
    });

    it('the leg arm ends inside the chamber, north of the whole lock tile', () => {
        const last = leg.ticks.at(-1);
        expect(last.level).toBe(30);
        expect(last.y + 3).toBeLessThanOrEqual(KEY_LEG_LOCK_FACE_Y - TILE);
    });

    it('and both windows end AT REST — every span released before tick_count', () => {
        for (const t of [legTape, controlTape]) {
            for (const span of t.inputs) expect(span.to).toBeLessThan(t.tick_count - 4);
        }
    });

    it('the BossLock fade is 80 ticks, and both keylock holds cover it', () => {
        const opensOn = opensOnKeyTick(
            KEY_RESPONDERS.bosslock.keyTimer, KEY_RESPONDERS.bosslock.fade,
        );
        expect(opensOn).toBe(80);
        // The control's hold is deliberately longer, so a pin here cannot be
        // read as impatience.
        expect(KEY_LOCK_SHUT.holdTo - KEY_LOCK_SHUT.holdFrom).toBeGreaterThan(opensOn);
    });
});
