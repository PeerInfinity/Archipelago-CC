/**
 * seedlingDemo/burnableTree.test — the eighth geometry family.
 *
 * R5 slice 12 step 2. The claims that matter are the three the source
 * inverts against a reader's expectation: the tree is SOLID for the whole
 * burn, the persistence write lands at ANIM END rather than at the hit,
 * and `check()` makes a cleared tag mean the tree is not built at all.
 */

import { describe, expect, it } from 'vitest';

import {
    BURN_ANIM, BURN_SPRITE, BurnableTreeError, HIT_TO_GONE_TICKS,
    WAIT_AFTER_PRESS_TICKS, assertBurnWaitCovers, burnTree, burnWrites,
    burnedTreeIds, createBurnState, treeBuiltIn,
} from './burnableTree.js';
import { BURNABLE_TREE } from './bobBoss.js';
import { ENTITY_CLASSES, ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { FIRE_ARM_POLICY } from './presses.js';

const tree = { id: 'burnabletree@872,784', tag: 0 };

describe('the animation, simulated rather than divided', () => {
    it('twenty frames at rate 15, looping — transcribed as the source has it', () => {
        expect(BURN_ANIM.frames).toBe(20);
        expect(BURN_ANIM.frameRate).toBe(15);
        // `add`'s fourth argument defaults to true. It changes nothing —
        // `burnEnd` removes the entity — and is recorded so the next
        // reader does not decide it "must" be false.
        expect(BURN_ANIM.loop).toBe(true);
    });

    it('⛔ 15 * 0.0333 is 0.4995, so it is NOT forty updates', () => {
        // A closed form gives 20 / 0.4995 = 40.04. The loop is what says
        // which update the twentieth index lands on.
        expect(HIT_TO_GONE_TICKS).toBeGreaterThan(40);
        expect(HIT_TO_GONE_TICKS).toBe(41);
    });

    it('⛓ and it agrees with the number bobBoss derived two slices ago', () => {
        // Two derivations of one constant, in two files, for two different
        // trees (L28's arena exit and L40's chest gate). They are joined
        // here so a change to either has to argue with the other.
        expect(BURNABLE_TREE.burnTicks).toBe(HIT_TO_GONE_TICKS);
        expect(BURNABLE_TREE.burnFrames).toBe(BURN_ANIM.frames);
        expect(BURNABLE_TREE.burnRate).toBe(BURN_ANIM.frameRate);
    });

    it('a leg must wait longer than the burn, and the promise is not the transcription', () => {
        expect(WAIT_AFTER_PRESS_TICKS).toBeGreaterThan(HIT_TO_GONE_TICKS);
        expect(() => assertBurnWaitCovers(HIT_TO_GONE_TICKS, 'leg')).toThrow(BurnableTreeError);
        expect(assertBurnWaitCovers(WAIT_AFTER_PRESS_TICKS, 'leg')).toBe(true);
    });
});

describe('⛔ the tree is SOLID for the whole burn', () => {
    it('the press starts the animation and removes nothing', () => {
        const state = createBurnState();
        const { started, goneAt } = burnTree(state, tree, 100);
        expect(started).toBe(true);
        expect(goneAt).toBe(100 + HIT_TO_GONE_TICKS);
        // every tick before `goneAt` — including the press tick itself
        expect(burnedTreeIds(state, 100).size).toBe(0);
        expect(burnedTreeIds(state, goneAt - 1).size).toBe(0);
        expect(burnedTreeIds(state, goneAt).has(tree.id)).toBe(true);
    });

    it('⚠ a second press on a burning tree is a REAL no-op, and says so', () => {
        // `hit()` is `if (t == "Fire" && !burn)`. Not a restart, not a
        // second write — and reported rather than swallowed, so an audit
        // can name what refused it.
        const state = createBurnState();
        burnTree(state, tree, 100);
        const again = burnTree(state, tree, 120);
        expect(again.started).toBe(false);
        expect(again.goneAt).toBe(100 + HIT_TO_GONE_TICKS);
        expect(again.why).toMatch(/already burning/);
    });

    it('rejects a tree with no id and a nonsense tick, rather than guessing', () => {
        const state = createBurnState();
        expect(() => burnTree(state, { tag: 0 }, 1)).toThrow(BurnableTreeError);
        expect(() => burnTree(state, tree, -1)).toThrow(BurnableTreeError);
    });
});

describe('⛔ the write lands at ANIM END — the opposite of a FallRock', () => {
    it('nothing is owed until the animation completes', () => {
        const state = createBurnState();
        burnTree(state, tree, 100);
        expect(burnWrites(state, 100, 40)).toEqual([]);
        expect(burnWrites(state, 140, 40)).toEqual([]);
        const at = burnWrites(state, 141, 40);
        expect(at).toHaveLength(1);
        expect(at[0].t).toBe(141);
        expect(at[0].flag).toMatchObject({ level: 40, tag: 0, outOfBand: false });
    });

    it('⚠ a `tag = -1` tree writes OUT OF BAND, into the previous level', () => {
        // `setPersistence(-1, false)` -> `level * 30 - 1` -> (level-1, 29).
        // L32's arena exit is one of these. It is not a no-op.
        const state = createBurnState();
        burnTree(state, { id: 'burnabletree@64,0', tag: -1 }, 0);
        const [w] = burnWrites(state, HIT_TO_GONE_TICKS, 32);
        expect(w.flag).toMatchObject({ level: 31, tag: 29, outOfBand: true });
    });
});

describe('⛔ `check()` — a cleared tag means the tree is NOT BUILT', () => {
    it('a tagged tree is absent once its flag is cleared', () => {
        expect(treeBuiltIn({ tag: 0 }, new Set())).toBe(true);
        expect(treeBuiltIn({ tag: 0 }, new Set([0]))).toBe(false);
    });

    it('⚠ …and a `tag = -1` tree is PER VISIT — rebuilt whole, every time', () => {
        // The guard is `tag >= 0 && !checkPersistence(tag)`, so a defaulted
        // tag can never satisfy it. Two trees, two lifetimes: L40's tag 0
        // stays burned and L32's comes back.
        expect(treeBuiltIn({ tag: -1 }, new Set([-1]))).toBe(true);
        expect(treeBuiltIn({ tag: -1 }, new Set())).toBe(true);
    });

    it('refuses a tree with no integer tag rather than defaulting it', () => {
        expect(() => treeBuiltIn({}, new Set())).toThrow(BurnableTreeError);
    });
});

describe('the census still says what the class is', () => {
    it('⛔ type is "Solid", never "Tree" — the ctor comment says why', () => {
        expect(ENTITY_CLASSES.burnabletree.as3).toBe('BurnableTree');
        expect(ENTITY_CLASSES.burnabletree.type).toBe('Solid');
    });

    it('and the sprite is 32x32 — a 2x2 solid, not a one-cell one', () => {
        expect(BURN_SPRITE.w).toBe(32);
        expect(BURN_SPRITE.h).toBe(32);
        expect(ENTITY_CLASSES.burnabletree.w).toBe(BURN_SPRITE.w);
        expect(ENTITY_CLASSES.burnabletree.h).toBe(BURN_SPRITE.h);
    });

    it('⛓ the FIRE arm is MODELLED now, not refused', () => {
        expect(FIRE_ARM_POLICY.BurnableTree.policy).toBe('modelled');
    });
});

describe('⛓⛓ the geometry, wired — the half a module test cannot see', () => {
    const source = atlasLevelSource();
    const l40 = (cleared = []) => buildLevelWorld(source(40), {
        roles: ROLES, inventory: { hasSword: true, hasFire: true }, cleared,
    });
    /** A probe box inside the tree's 2x2 footprint. */
    const box = { x: 880, y: 792, w: 4, h: 5, right: 884, bottom: 797 };

    it('L40\'s tree is in the roster, at (872,784), 32x32 and tag 0', () => {
        const [t] = l40().burnableTrees;
        expect(t).toMatchObject({ id: 'burnabletree@872,784', tag: 0, x: 872, y: 784 });
        expect(t.rect).toMatchObject({ w: 32, h: 32 });
    });

    it('⛔ SOLID until `goneAt`, then not — the whole point of the family', () => {
        const world = l40();
        const state = createBurnState();
        const [tree] = world.burnableTrees;
        expect(world.collidesSolid(box)).toBeTruthy();
        const { goneAt } = burnTree(state, tree, 200);
        // the press tick, and every tick of the burn
        for (const t of [200, 220, goneAt - 1]) {
            expect(world.collidesSolid(box, { burnedTrees: burnedTreeIds(state, t) }),
                `still solid at t${t}`).toBeTruthy();
        }
        expect(world.collidesSolid(box, { burnedTrees: burnedTreeIds(state, goneAt) }))
            .toBeFalsy();
    });

    it('⛔ and a CLEARED tag builds the room without it at all', () => {
        // `check()`, not a burn — this is the state a LATER window boots
        // into, and it is why such a window must declare the flag.
        const world = l40([0]);
        expect(world.burnableTrees).toEqual([]);
        expect(world.collidesSolid(box)).toBeFalsy();
    });

    it('⚠ BOTH trees in the extract are tag 0 — L32\'s is not per-visit', () => {
        // The brief said L32's tree was `tag = -1` and therefore per visit.
        // The extract says `tag="0"` for both it and L40's, and
        // `bobBoss.BOB_BOSS_LEDGER` has said {32,0} since slice 3. Two
        // strata; the brief is the one that is wrong.
        const l32 = buildLevelWorld(source(32), {
            roles: ROLES, inventory: { hasSword: true, hasFire: true },
        });
        expect(l32.burnableTrees.map((t) => t.tag)).toEqual([0]);
        expect(BURNABLE_TREE.tag).toBe(0);
    });
});
