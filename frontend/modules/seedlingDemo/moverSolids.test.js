/**
 * seedlingDemo/moverSolids.test — solidity is a property of the MOVER.
 *
 * R5 slice 12 step 1. The census carries one `collider` field per class and
 * its docblock says *"does not block the player"*; FlashPunk asks
 * `collideTypes(solids, …)` against the list the MOVING entity carries, and
 * a `PushableBlock*` carries a different one from the Player.
 *
 * That gap cost the shaft its entire ledger: a wandering `Spinner` — a
 * `type: 'Enemy'`, `collider: 'none'` census row — wedged block 2 mid-glide
 * in L39. See `r5Shaft.SPINNER_WEDGE` for the four tapes, one of them the
 * same tape 120 ticks later and byte-exact against the game.
 */

import { describe, expect, it } from 'vitest';

import {
    ENTITY_CLASSES, PLAYER_SOLID_TYPES, SOLIDS_BY_MOVER, blocksMover,
} from './levelWorld.js';
import { SPINNER_WEDGE } from './r5Shaft.js';

describe('the three solids lists, transcribed', () => {
    it('the PLAYER\'s list is `Mobile`\'s plus LavaBoss — unchanged', () => {
        expect(SOLIDS_BY_MOVER.player).toEqual(PLAYER_SOLID_TYPES);
        expect(SOLIDS_BY_MOVER.player).toContain('LavaBoss');
        expect(SOLIDS_BY_MOVER.player).not.toContain('Enemy');
    });

    it('⛔⛔ a PUSHABLE\'s list adds "Enemy" and "Player" — the ctor push', () => {
        // `PushableBlock.as:28` / `PushableBlockFire.as:31`:
        //     solids.push("Enemy", "Player");
        expect(SOLIDS_BY_MOVER.pushable).toContain('Enemy');
        expect(SOLIDS_BY_MOVER.pushable).toContain('Player');
        expect(SOLIDS_BY_MOVER.pushable).not.toContain('LavaBoss');
    });

    it('an ENEMY\'s list is the base one — it adds nothing', () => {
        expect(SOLIDS_BY_MOVER.enemy).not.toContain('Enemy');
        expect(SOLIDS_BY_MOVER.enemy).not.toContain('Player');
    });

    it('rejects a mover it does not know, rather than defaulting to the player', () => {
        expect(() => blocksMover('Solid', 'crusher')).toThrow(/unknown mover/);
    });
});

describe('⛔⛔ the verdict that was true about the wrong mover', () => {
    it('every Enemy in the census is `collider: none` AND blocks a pushable', () => {
        // The two halves of the finding, stated together so neither can be
        // read as a defect in the other. The census rows are RIGHT; the
        // question they answer is the player's.
        const enemies = Object.entries(ENTITY_CLASSES)
            .filter(([, row]) => row.type === 'Enemy');
        expect(enemies.length).toBeGreaterThan(10);
        for (const [tag, row] of enemies) {
            // ⛓⛓ R5 SLICE 20: ONE EXCEPTION, AND IT IS A JOIN RATHER THAN A
            // COLLIDER. `iceturret` became `type: 'Enemy'` when the slice
            // corrected the misread that had it Solid from construction —
            // and it keeps `collider: 'rect'`, because its CORPSE is a real
            // solid and the entity is the id join `liveRectOf`'s turret arm
            // looks up (`solid.turretId`). That arm NEVER falls through to
            // `s.rect`, so the rect here is the live 32x32 body for the
            // hazard and the aim, and it is in nobody's collision answer.
            if (tag === 'iceturret') {
                expect(row.collider).toBe('rect');
                expect(row.as3).toBe('IceTurret');
            } else if (tag === 'bosstotem') {
                // ⛓⛓⛓ R5 SLICE 23: THE SECOND EXCEPTION, AND IT IS THE
                // TURRET'S RUN BACKWARDS. `BossTotem.type` is "Enemy" from
                // the base ctor too, but `type = "Solid"` is the ELSE of
                // `if (activated)` — so an UNWOKEN boss IS a wall and a
                // woken one is not, where a live turret is not a wall and
                // its corpse is. Both keep `collider: 'rect'` and both are
                // joins (`solid.bossId` / `solid.turretId`); the difference
                // is which way `liveRectOf`'s arm defaults, and that is
                // named at both sites.
                expect(row.collider).toBe('rect');
                expect(row.as3).toBe('BossTotem');
            } else {
                expect(row.collider, `${tag} blocks the player?`).toBe('none');
            }
            // ⚠ `blocksMover` is about the TYPE STRING, and both exceptions
            // above are classes whose type string CHANGES. "Enemy" never
            // blocks the player; what blocks them is the other value.
            expect(blocksMover(row.type, 'player'), `${tag} vs player`).toBe(false);
            expect(blocksMover(row.type, 'pushable'), `${tag} vs a block`).toBe(true);
        }
    });

    /**
     * ⛔⛔⛔ R5 SLICE 20 — THE EXCEPTION, ASSERTED AGAINST THE LEVEL SO THE
     * `collider: 'rect'` ABOVE CANNOT QUIETLY BECOME A WALL AGAIN.
     *
     * `IceTurret.type` is "Enemy" from the base ctor and `type = "Solid"` is
     * the else-arm of `if (currentAnim != "dead")` — the census used to read
     * it as the else-arm of the attack-range test and price the live body as
     * an unconditional 32x32 solid. The rect is still built; what changed is
     * that nothing returns it.
     */
    it('⛔⛔⛔ …and the iceturret\'s rect is a JOIN, not a wall — the level agrees', async () => {
        const { buildLevelWorld, ROLES } = await import('./levelWorld.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        const { playerBoxAt } = await import('./playerPhysicsV2.js');
        const w = buildLevelWorld(atlasLevelSource()(40), {
            roles: ROLES, inventory: { hasSword: true, hasFire: true },
        });
        const solid = w.solids.find((s) => s.turretId === 'iceturret@472,400');
        expect(solid, 'the join is still in the solids list').toBeTruthy();
        expect(solid.rect).toMatchObject({ x: 472, y: 400, right: 504, bottom: 432 });
        // …and the middle of that rect is walkable, from every option shape.
        for (const opts of [{}, { turrets: null }, { turrets: new Map() }]) {
            expect(w.collidesSolid(playerBoxAt(488, 424), opts)).toBeFalsy();
        }
    });

    it('⛓ the spinner in particular — the class that did it', () => {
        const spinner = ENTITY_CLASSES.spinner;
        expect(spinner.as3).toBe('Spinner');
        expect(spinner.type).toBe('Enemy');
        expect(blocksMover(spinner.type, 'player')).toBe(false);
        expect(blocksMover(spinner.type, 'pushable')).toBe(true);
        // …and the census row now SAYS so, so the next reader is not
        // re-deriving it from four recordings.
        expect(spinner.why).toMatch(/PUSHABLE BLOCK/);
    });

    it('⚠ and a Player-typed entity blocks a block too, which is the other half', () => {
        // `solids.push("Enemy", "Player")` is one line with two members, and
        // the arc has read a two-member list as one before
        // ([[feedback_two_member_list_one_member_read]]). The Player half is
        // what makes a block wedge PERMANENTLY: it cannot retreat through
        // the player who followed it in.
        expect(blocksMover('Player', 'pushable')).toBe(true);
        expect(blocksMover('Player', 'player')).toBe(false);
    });
});

describe('the wedge, as banked', () => {
    it('names the mover lists it is derived from', () => {
        expect(SPINNER_WEDGE.moverSolids).toEqual(SOLIDS_BY_MOVER.pushable);
        expect(SPINNER_WEDGE.playerSolids).toEqual(SOLIDS_BY_MOVER.player);
        expect(SPINNER_WEDGE.blockerType).toBe('Enemy');
    });

    it('⛓⛓ and the discriminator is a TIME SHIFT, recorded on both sides', () => {
        // The claim is not "a probe failed" — it is that the same inputs at
        // a different absolute time give a different answer, which no static
        // solid can do.
        const delayed = SPINNER_WEDGE.probes.find((p) => p.tape === 'r5-press-delay');
        expect(delayed.byteExact).toBe(true);
        expect(delayed.delayTicks).toBeGreaterThan(0);
        const wedged = SPINNER_WEDGE.probes.filter((p) => p.stuckY !== undefined);
        expect(wedged.length).toBe(3);
        // …and the two wedge positions DISAGREE with each other, which is
        // the second independent sign that the blocker is not geometry.
        expect(new Set(wedged.map((p) => p.stuckY)).size).toBeGreaterThan(1);
    });

    /**
     * ⛓⛓ THIS GUARD CAUGHT ITS OWN SLICE. Slice 13 restored two of the three
     * arms and this was the ONE red in the whole suite — a list that had
     * gone from a fact to a memory, reported by the check that existed for
     * exactly that. [[feedback_retired_oracle_check_the_regen]], pointing the
     * pleasant way for once.
     */
    it('⚠ the withdrawn tape is not in the fixture roster, and the restored ones ARE', async () => {
        const { fixtureNames } = await import('./fixtures/index.js');
        const names = new Set(fixtureNames());
        for (const w of SPINNER_WEDGE.withdrawn) expect(names.has(w)).toBe(false);
        // ⛔ AND THE OTHER HALF, which is what stops the first from being
        // satisfiable by deleting fixtures: the two arms whose model is no
        // longer refuted are back, with oracle recordings behind them.
        for (const r of SPINNER_WEDGE.restored) expect(names.has(r)).toBe(true);
        // …and the two lists are disjoint, so a name cannot be both.
        for (const w of SPINNER_WEDGE.withdrawn) expect(SPINNER_WEDGE.restored).not.toContain(w);
        // …and the committed pair IS.
        expect(names.has(SPINNER_WEDGE.committedPair.press)).toBe(true);
        expect(names.has(SPINNER_WEDGE.committedPair.control)).toBe(true);
    });

    /**
     * ⛔ AND THE ONE THAT STAYS OUT SAYS SO IN THE DATA. `reconstructible`
     * is the field that separates "we chose not to commit this" from "its
     * inputs do not exist" — two very different sentences that an empty
     * `withdrawn` entry would have spelled the same way.
     */
    it('every restored arm is marked reconstructible and the withdrawn one is not', () => {
        for (const r of SPINNER_WEDGE.restored) {
            expect(SPINNER_WEDGE.probes.find((p) => p.tape === r).reconstructible).toBe(true);
        }
        for (const w of SPINNER_WEDGE.withdrawn) {
            expect(SPINNER_WEDGE.probes.find((p) => p.tape === w).reconstructible).toBe(false);
        }
    });

    /**
     * ⛓⛓ AND THE GAME-SIDE NUMBER EACH REFUTATION LEFT BEHIND IS ASSERTED
     * AGAINST ITS OWN ROUNDED FORM, so the double and the prose cannot drift
     * apart. `stuckY` is what §25.3 wrote in a sentence; `gameY` is what
     * `--record` printed.
     */
    it('the banked gameY agrees with the stuckY the prose quotes', () => {
        for (const p of SPINNER_WEDGE.probes) {
            if (p.gameY === undefined) continue;
            expect(Number(p.gameY.toFixed(2))).toBe(p.stuckY);
        }
    });
});
