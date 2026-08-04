/**
 * r5Swim — the drown DECLARATION, driven through all four of its quadrants.
 *
 * `drownFinding` is the only piece of harness policy this arc has that can
 * turn a hard failure into a pass, so it gets the treatment the
 * `saw_input_refused` precedent gets: every combination of (declared?,
 * timer) asserted here, in milliseconds, rather than only ever observed
 * passing at the end of a twenty-minute replay. A check that has never
 * failed is indistinguishable from one that cannot.
 *
 * ⚠ THE DECLARED QUADRANTS ARE DRIVEN THROUGH AN INJECTED TABLE, and that
 * is not a convenience. The shipped `DROWN_EXPECTED` is EMPTY until the arm
 * that needs it is recorded — the roster guard refuses an entry naming a
 * fixture the repo does not have — so a test that read only the shipped
 * table would leave the two declared quadrants unexercised for exactly as
 * long as they matter most.
 */

import { describe, expect, it } from 'vitest';

import { DROWN_TIMER_MAX as PHYSICS_DROWN_TIMER_MAX, playerBoxAt } from './playerPhysicsV2.js';
import { buildLevelWorld, ROLES, TILE_SIZE } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { HAZARD_STATES } from './tapeFormat.js';
import { loadTape } from './fixtures/index.js';
import { KARLORE } from './r5Chain.js';
import {
    CONCH, D5_EARNED, D5_INERT_LOCK, D5_LADDER, D5_UNCROSSED, D5_WALK,
    DROWN_EXPECTED, DROWN_EXPECTED_NAMES, DROWN_TIMER_MAX, R5SwimError,
    drownDeclarationRosterFindings, drownFinding,
} from './r5Swim.js';

const UNDECLARED = 'r5-karlore-fire';
const DECLARED = 'a-declared-drowning-arm';
/** The shape the shipped table will carry once its fixture exists. */
const TABLE = Object.freeze({
    [DECLARED]: Object.freeze({ minTicks: 3, maxTicks: 9, why: 'the armed-water witness' }),
});
/**
 * `checkDrowning` writes MAX on the FIRST contact tick without decrementing
 * and decrements on every later one, so contact ticks and timer values run
 * in opposite directions: `contact = MAX - timer + 1`.
 */
const timerFor = (contact) => DROWN_TIMER_MAX - contact + 1;

describe('the drown declaration, in all four quadrants', () => {
    it('UNDECLARED + timer 0 — the ordinary pass, and the positive control', () => {
        const f = drownFinding(UNDECLARED, 0, TABLE);
        expect(f.ok).toBe(true);
        expect(f.name).toContain('never started drowning');
    });

    it('⛔ UNDECLARED + timer non-zero — still the hard failure it always was', () => {
        // The whole point of the declaration is that it does not loosen
        // this. A tape nobody declared that drowned is a route defect, and
        // the detail points at the table rather than hiding it.
        const f = drownFinding(UNDECLARED, 7, TABLE);
        expect(f.ok).toBe(false);
        expect(f.detail).toContain('DROWN_EXPECTED');
    });

    it('DECLARED + timer non-zero — the armed-water witness, and it PASSES', () => {
        const f = drownFinding(DECLARED, timerFor(5), TABLE);
        expect(f.ok).toBe(true);
        expect(f.name).toContain('DECLARED drowning fired');
    });

    it('⛔⛔ DECLARED + timer 0 — a RED, because a control that did not drown '
        + 'is a pair that proves nothing', () => {
        const f = drownFinding(DECLARED, 0, TABLE);
        expect(f.ok).toBe(false);
        expect(f.detail).toContain('never fired');
    });

    it('and the two names differ, so a reader can tell which check ran', () => {
        expect(drownFinding(UNDECLARED, 0, TABLE).name)
            .not.toBe(drownFinding(DECLARED, timerFor(5), TABLE).name);
    });
});

describe('the band, and why it has both edges', () => {
    const decl = TABLE[DECLARED];

    it('the declared band\'s interior passes', () => {
        for (let c = decl.minTicks; c <= decl.maxTicks; c += 1) {
            expect(drownFinding(DECLARED, timerFor(c), TABLE).ok, `${c} contact tick(s)`)
                .toBe(true);
        }
    });

    it('⛔ one tick UNDER the floor fails — too brief to be a deliberate stand', () => {
        expect(drownFinding(DECLARED, timerFor(decl.minTicks - 1), TABLE).ok).toBe(false);
    });

    it('⛔ one tick OVER the ceiling fails — the next tick is `die()`', () => {
        expect(drownFinding(DECLARED, timerFor(decl.maxTicks + 1), TABLE).ok).toBe(false);
    });

    it('⚠ the ceiling exists because the MODEL throws on the death, not as taste', () => {
        // `checkDrowning` latches `drowning` on the eleventh cumulative
        // contact tick and `playerPhysicsV2.step` throws on the death that
        // follows. A declared arm is allowed to drown and is not allowed to
        // die — a dead player's stream is a respawn, not a comparison.
        expect(DROWN_TIMER_MAX).toBe(PHYSICS_DROWN_TIMER_MAX);
        expect(timerFor(DROWN_TIMER_MAX)).toBe(1);
    });
});

describe('the readings that are not answers', () => {
    it('no timer at all yields NO finding — a pre-R5 build is not this check\'s business', () => {
        expect(drownFinding(UNDECLARED, undefined, TABLE)).toBeNull();
        expect(drownFinding(UNDECLARED, null, TABLE)).toBeNull();
    });

    it('⛔ a non-numeric readout FAILS rather than passing vacuously', () => {
        // The old `status.drown_timer === 0` would have been false for a
        // string "0" and true for nothing else. A check that cannot answer
        // must not pass, whichever way it cannot answer — and it must not
        // pass on the DECLARED side either.
        for (const bad of ['0', NaN, {}, []]) {
            expect(drownFinding(UNDECLARED, bad, TABLE)?.ok, JSON.stringify(bad)).toBe(false);
            expect(drownFinding(DECLARED, bad, TABLE)?.ok, JSON.stringify(bad)).toBe(false);
        }
    });
});

describe('the declaration cannot rot', () => {
    it('every SHIPPED declaration names a real fixture', async () => {
        const { fixtureNames } = await import('./fixtures/index.js');
        const [f] = drownDeclarationRosterFindings(fixtureNames());
        expect(f.ok, f.detail).toBe(true);
    });

    it('⛔ and a declaration whose fixture is missing goes red', () => {
        // Driven through the roster rather than the table, because the
        // shipped table is empty: an empty table against an empty roster is
        // vacuously fine, and this is the arm that has to work.
        const [f] = drownDeclarationRosterFindings([]);
        for (const n of DROWN_EXPECTED_NAMES) expect(f.detail).toContain(n);
        expect(f.ok).toBe(DROWN_EXPECTED_NAMES.length === 0);
    });

    it('the roster check refuses a caller that passes nothing', () => {
        expect(() => drownDeclarationRosterFindings(undefined)).toThrow(R5SwimError);
    });

    it('⚠ the shipped table is a list of NAMES with well-formed bands', () => {
        // `feedback_coincidental_predicate_rots`. A predicate over "declares
        // water armed" would sweep in the SWIM arm, whose entire claim is
        // that it crossed armed water and the timer never started.
        for (const [name, d] of Object.entries(DROWN_EXPECTED)) {
            expect(typeof name).toBe('string');
            expect(d.why, name).toMatch(/\S/);
            expect(d.minTicks, name).toBeGreaterThan(0);
            expect(d.maxTicks, name).toBeGreaterThanOrEqual(d.minTicks);
            expect(d.maxTicks, name).toBeLessThan(DROWN_TIMER_MAX + 1);
        }
    });
});

describe('the D5 walk\'s declarations, against the EXTRACT', () => {
    const source = atlasLevelSource();
    /** ⛓ The world the walk really runs in — `fire` is banked at the boot. */
    const worldFor = (n) => buildLevelWorld(source(n), {
        roles: ROLES, inventory: { hasFire: true },
    });

    it('every declared exit is a real door in its level, in order', () => {
        let expected = D5_WALK.boot.level;
        for (const leg of D5_WALK.legs) {
            expect(leg.level, 'the legs are a chain').toBe(expected);
            const w = worldFor(leg.level);
            if (!leg.exit) { expected = null; continue; }
            if (leg.exit.pit) {
                expect(w.pitTiles.some((p) => p.tx === leg.exit.pit.tx
                    && p.ty === leg.exit.pit.ty), `L${leg.level} pit`).toBe(true);
                // ⚠ A pit with no `control` block is `die()`, not a transport.
                expect(w.fallthrough, `L${leg.level} fallthrough`).not.toBeNull();
                expected = w.fallthrough.level;
                continue;
            }
            const tel = w.teleporters.find((t) => t.x === leg.exit.x && t.y === leg.exit.y);
            expect(tel, `L${leg.level}@${leg.exit.x},${leg.exit.y}`).toBeDefined();
            expected = tel.to;
        }
    });

    it('⛔ the route passes karlore\'s plug — so `fire` is SPENT here', () => {
        // The claim that makes this walk the chain's first payment rather
        // than a probe: L48's arrival is one tile south of the plug, and
        // the plug is the corridor.
        expect(D5_WALK.legs.map((l) => l.level)).toContain(KARLORE.level);
        const arrival = worldFor(47).teleporters.find((t) => t.to === KARLORE.level).arrival;
        expect(Math.floor(arrival.x / TILE_SIZE)).toBe(KARLORE.tile.tx);
        expect(Math.floor(arrival.y / TILE_SIZE) - 1).toBe(KARLORE.tile.ty);
        // ...and the model only builds the open version because the run
        // banks the item first.
        expect(buildLevelWorld(source(KARLORE.level), { roles: ROLES })
            .solids.some((s) => s.tag === 'karlore')).toBe(true);
        expect(worldFor(KARLORE.level).solids.some((s) => s.tag === 'karlore')).toBe(false);
    });

    it('the conch is where the declaration says, on ICE, with a walkable approach', () => {
        const w = worldFor(CONCH.level);
        const conch = w.pickups.find((p) => p.x === CONCH.pickup.x && p.y === CONCH.pickup.y);
        expect(conch?.tag).toBe(CONCH.item);
        const tileAt = (x, y) => w.walkableTiles.find(
            (t) => t.tx === Math.floor(x / TILE_SIZE) && t.ty === Math.floor(y / TILE_SIZE));
        // Both knobs in `D5_WALK` were derived from ice friction; if the
        // conch stopped standing on ice, both derivations would be stale.
        expect(tileAt(conch.rect.x + 4, conch.rect.y + 4)?.t).toBe(HAZARD_STATES.ice);
        expect(w.collidesSolid(playerBoxAt(CONCH.approach.x, CONCH.approach.y))).toBeNull();
        // The approach is a NEIGHBOUR cell, not the pickup's own: a collect
        // target the planner could path to is one it walks around, not
        // through (`runCollect` drives the last pixels itself).
        expect(Math.floor(CONCH.approach.y / TILE_SIZE))
            .toBe(Math.floor(conch.rect.y / TILE_SIZE) - 1);
    });

    it('the EARNED flag is the conch\'s own, and it is the only one', () => {
        expect(D5_EARNED.map((e) => `${e.level}:${e.tag}`)).toEqual([`${CONCH.level}:${CONCH.tag}`]);
    });

    it('⚠ L48\'s bosslock really is keyType 3 — the inertness names something', () => {
        // "Inert" is a claim about the RUN, not the geometry. The geometry
        // half is here; the run half is the planner's own `keys` list.
        const lock = worldFor(D5_INERT_LOCK.level).activators
            .find((a) => a.x === D5_INERT_LOCK.at.x && a.y === D5_INERT_LOCK.at.y);
        expect(lock?.tag).toBe('bosslock');
        expect(lock?.keyType).toBe(D5_INERT_LOCK.keyType);
        expect(lock?.persistTag).toBe(D5_INERT_LOCK.tag);
    });

    it('the ladder and the UNCROSSED list together are the corridor\'s whole census', () => {
        // `feedback_bounded_sweep_must_name_what_it_bounded`: an encounter
        // plan reporting one crossing over a six-instance corridor has
        // either threaded five or failed to look at five, and those print
        // the same thing. The two declarations must PARTITION the census.
        const census = new Set();
        for (const leg of D5_WALK.legs) {
            const w = worldFor(leg.level);
            for (const e of [...w.combat.enemies, ...w.combat.hazards]) {
                census.add(`${leg.level}:${e.tag}@${e.x},${e.y}`);
            }
        }
        const declared = [
            ...D5_LADDER.map((v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}`),
            ...D5_UNCROSSED.map((v) => `${v.level}:${v.tag}@${v.at.x},${v.at.y}`),
        ];
        expect([...declared].sort()).toEqual([...census].sort());
        expect(new Set(declared).size, 'no instance declared twice').toBe(declared.length);
    });

    it('every ladder verdict is a THREAD — this walk carries no sword', () => {
        for (const v of D5_LADDER) expect(v.rung).toBe('wake-and-thread');
    });

    it('the shipped tape carries the declared knobs and grant', () => {
        // The tape is FROZEN once recorded, so this is the check that the
        // declarations and the artifact have not drifted apart.
        const tape = loadTape(D5_WALK.name);
        expect(tape.boot).toEqual({ ...D5_WALK.boot });
        expect(tape.noHazards).toEqual([...D5_WALK.noHazards]);
        expect(tape.pins).toEqual([...D5_WALK.pins]);
        expect(tape.grants).toEqual(D5_WALK.grants.map((g) => ({ level: g.level, items: [...g.items] })));
        expect(tape.noclip).toBe(false);
        expect(tape.persistence).toEqual([]);
    });

    it('⛔ the coast is far longer than the ground default, and it has to be', () => {
        // `assertWindowEndsAtRest`'s 8 ticks come from ground friction
        // (0.25); ice is 0.025 and a PICKUP_CEREMONY freezes the player
        // WITHOUT zeroing `v`. Rest was measured at 24 coast ticks.
        expect(D5_WALK.coastTicks).toBeGreaterThanOrEqual(24);
        // ...and the tolerance is not the ground default either.
        expect(D5_WALK.tolerance).toBeGreaterThan(1.0);
    });
});
