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
import { loadExpectation, loadTape } from './fixtures/index.js';
import { KARLORE } from './r5Chain.js';
import {
    CONCH, D5_EARNED, D5_INERT_LOCK, D5_LADDER, D5_UNCROSSED, D5_WALK,
    SWIM_PAIR, SWIM_LATCH, L48_WATER, WATERFALL_PAIR, FEATHER_BLOCKER,
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

describe('⛓ the swim term, read off the GAME\'s own recording', () => {
    // ⚠ THE INDEPENDENT STRATUM. `r5Acceptance.test.js` mutates hand-built
    // inputs and asserts the checks go red; this runs the SAME checks
    // against the committed recording, which came out of the real game and
    // was never touched by this side. A claim that only ever runs against
    // fabricated inputs is a claim about the fabrication.
    it('the pair\'s two streams really are byte-identical, and the timer is the difference', async () => {
        const { swimPairFindings } = await import('./r5Acceptance.js');
        const replayed = new Map([
            [SWIM_PAIR.cross, {
                stream: loadExpectation(SWIM_PAIR.cross).stream,
                status: { drown_timer: 0, items: { hitsMax: 3, hasFire: true, canSwim: true } },
            }],
            [SWIM_PAIR.drown, {
                stream: loadExpectation(SWIM_PAIR.drown).stream,
                status: { drown_timer: SWIM_PAIR.drownTimer, items: { hitsMax: 3, hasFire: true } },
            }],
        ]);
        const bad = swimPairFindings(replayed).filter((f) => !f.ok);
        expect(bad.map((f) => `${f.name}: ${f.detail}`)).toEqual([]);
    });

    it('⛓ the LATCH is in the recorded positions — 0.700 against 0.450', async () => {
        // The whole claim, against the game's own stream: a mid-cycle
        // swimming tick and the first tick after a 90-tick stop, and the
        // difference between them is `Player.as:530`'s addend.
        const { swimLatchFindings, SWIM_BOOST, SWIM_STEADY_STEP, SWIM_LATCH_TICKS } =
            await import('./r5Acceptance.js');
        const stream = loadExpectation(SWIM_LATCH.name).stream;
        const step = (t) => stream.ticks[t].y - stream.ticks[t + 1].y;
        expect(step(SWIM_LATCH_TICKS.steady)).toBeCloseTo(SWIM_STEADY_STEP, 9);
        expect(step(SWIM_LATCH_TICKS.latched) - step(SWIM_LATCH_TICKS.steady))
            .toBeCloseTo(SWIM_BOOST, 9);
        const bad = swimLatchFindings(new Map([[SWIM_LATCH.name, {
            stream,
            status: { drown_timer: 0, items: { canSwim: true, hasFire: true, hitsMax: 3 } },
        }]])).filter((f) => !f.ok);
        expect(bad.map((f) => f.name)).toEqual([]);
    });

    it('⚠ and the boost is NOT there mid-cycle — the negative half', async () => {
        // Without this the claim above would be satisfied by a term that
        // was on every tick. Six frames of every 47 carry it; tick 166 and
        // its neighbours do not.
        const { SWIM_LATCH_TICKS, SWIM_STEADY_STEP } = await import('./r5Acceptance.js');
        const stream = loadExpectation(SWIM_LATCH.name).stream;
        const step = (t) => stream.ticks[t].y - stream.ticks[t + 1].y;
        for (const t of [SWIM_LATCH_TICKS.steady - 2, SWIM_LATCH_TICKS.steady - 1,
            SWIM_LATCH_TICKS.steady, SWIM_LATCH_TICKS.steady + 1]) {
            expect(step(t), `tick ${t}`).toBeCloseTo(SWIM_STEADY_STEP, 9);
        }
    });

    it('the pair\'s tapes are one field apart and nothing else', () => {
        const a = loadTape(SWIM_PAIR.cross);
        const b = loadTape(SWIM_PAIR.drown);
        for (const k of ['boot', 'noHazards', 'pins', 'inputs', 'tick_count', 'persistence',
            'noclip', 'noDamage', 'equips']) {
            expect(JSON.stringify(a[k]), k).toBe(JSON.stringify(b[k]));
        }
        // ⚠ `parseTape` SORTS the item list, so the assertion is on the set
        // rather than on the order the planner happened to write.
        expect(a.grants).toEqual([{ level: 47, items: ['conch', 'fire'] }]);
        expect(b.grants).toEqual([{ level: 47, items: ['fire'] }]);
        // ⛔ AND WATER IS ARMED ON BOTH. A pair that coerced it would be two
        // walks on a floor.
        expect(a.noHazards).not.toContain('water');
        expect(a.noHazards).toEqual(['waterfall']);
    });

    it('⛔ the drowning arm is DECLARED, and its band contains what it does', () => {
        expect(DROWN_EXPECTED_NAMES).toContain(SWIM_PAIR.drown);
        const contact = DROWN_TIMER_MAX - SWIM_PAIR.drownTimer + 1;
        const d = DROWN_EXPECTED[SWIM_PAIR.drown];
        expect(contact).toBeGreaterThanOrEqual(d.minTicks);
        expect(contact).toBeLessThanOrEqual(d.maxTicks);
        // ...and the SWIM arm is NOT declared, which is the half that keeps
        // the declaration honest.
        expect(DROWN_EXPECTED_NAMES).not.toContain(SWIM_PAIR.cross);
        expect(DROWN_EXPECTED_NAMES).not.toContain(SWIM_LATCH.name);
    });
});

describe('⛓ the armed waterfall, against the extract and the recordings', () => {
    const source = atlasLevelSource();
    const w = () => buildLevelWorld(source(WATERFALL_PAIR.level), { roles: ROLES });

    it('the declared tile IS a waterfall, with WATER above and below', () => {
        // ⛔ The reason `noHazards` is empty on both arms and the conch is in
        // BOTH of them: a featherless probe standing under this tile is also
        // a swimmer, and coercing water to keep it alive would have coerced
        // the thing the pair is standing on.
        const world = w();
        const typeAt = (tx, ty) => world.walkableTiles
            .find((t) => t.tx === tx && t.ty === ty)?.t;
        const { tx, ty } = WATERFALL_PAIR.tile;
        expect(typeAt(tx, ty)).toBe(HAZARD_STATES.waterfall);
        expect(typeAt(tx, ty - 1)).toBe(HAZARD_STATES.water);
        expect(typeAt(tx, ty + 1)).toBe(HAZARD_STATES.water);
    });

    it('the SHIPPED predicate says what the pair is a witness for', async () => {
        // Asked of `climbsArmedWaterfall` itself, so the fixtures witness the
        // rule the planner actually consults rather than a re-derivation.
        const { climbsArmedWaterfall } = await import('./botDriverV2.js');
        const world = w();
        const { tx, ty } = WATERFALL_PAIR.tile;
        const step = [{ tx, ty: ty + 1 }, { tx, ty }];
        expect(climbsArmedWaterfall(world, ...step,
            { noHazards: [], inventory: { canSwim: true }, lattice: 16 })).toBe(true);
        expect(climbsArmedWaterfall(world, ...step,
            { noHazards: [], inventory: { canSwim: true, hasFeather: true }, lattice: 16 }))
            .toBe(false);
        // ...and a COERCED waterfall is not a directed edge at all, which is
        // how R1-R4 crossed this tile without ever meeting the rule.
        expect(climbsArmedWaterfall(world, ...step,
            { noHazards: ['waterfall'], inventory: { canSwim: true }, lattice: 16 }))
            .toBe(false);
    });

    it('⛓ the RECORDED arms: one stalls on the face, the other goes through', () => {
        const shut = loadExpectation(WATERFALL_PAIR.shut).stream.ticks;
        const climb = loadExpectation(WATERFALL_PAIR.climb).stream.ticks;
        const row = (o) => Math.floor(o.y / TILE_SIZE);
        expect(row(shut.at(-1))).toBe(WATERFALL_PAIR.shutRow);
        expect(row(climb.at(-1))).toBe(WATERFALL_PAIR.climbRow);
        // ⚠ AND THE REFUSING ARM REALLY TOUCHED IT — the check a "did not
        // climb" assertion would miss, because a walk that never arrived
        // also does not climb.
        expect(shut.filter((o) => row(o) === WATERFALL_PAIR.shutRow).length)
            .toBeGreaterThan(20);
        const net = (t) => WATERFALL_PAIR.startY - t.at(-1).y;
        expect(net(climb)).toBeGreaterThan(net(shut) * 4);
    });

    it('⚠ and R4\'s recorded "3.33 px DOWN" no longer describes this game', () => {
        // `botDriverV2`'s docblock measured the featherless arm at R4, when
        // the swim term was hard-coded to zero. `inWater` is
        // `eff == 1 || eff == 25`, so a waterfall runs the water speed table
        // AND the +0.25 boost — and under the real term the same arm goes
        // UP before it stalls. The RULE survives (0.45 + 0.25 < 0.8); the
        // NUMBER does not.
        const shut = loadExpectation(WATERFALL_PAIR.shut).stream.ticks;
        expect(WATERFALL_PAIR.startY - shut.at(-1).y).toBeGreaterThan(0);
    });

    it('the two tapes are one field apart, and NOTHING is coerced', () => {
        const a = loadTape(WATERFALL_PAIR.shut);
        const b = loadTape(WATERFALL_PAIR.climb);
        for (const k of ['boot', 'noHazards', 'pins', 'inputs', 'tick_count', 'noclip',
            'noDamage', 'persistence', 'equips']) {
            expect(JSON.stringify(a[k]), k).toBe(JSON.stringify(b[k]));
        }
        expect(a.noHazards).toEqual([]);
        expect(a.grants).toEqual([{ level: 0, items: ['conch'] }]);
        expect(b.grants).toEqual([{ level: 0, items: ['conch', 'feather'] }]);
    });
});

describe('⛔ the FEATHER blocker — §2.6.3 overturned, and the numbers that do it', () => {
    const source = atlasLevelSource();

    it('the feather\'s pocket has WATERFALLS above and below it, and solids either side', () => {
        const w = buildLevelWorld(source(FEATHER_BLOCKER.level), { roles: ROLES });
        const typeAt = (tx, ty) => w.walkableTiles.find((t) => t.tx === tx && t.ty === ty)?.t;
        const { tx, ty } = FEATHER_BLOCKER.tile;
        const f = w.pickups.find((p) => p.x === FEATHER_BLOCKER.pickup.x
            && p.y === FEATHER_BLOCKER.pickup.y);
        expect(f?.tag).toBe('feather');
        expect(typeAt(tx, ty)).toBe(HAZARD_STATES.water);
        for (const a of FEATHER_BLOCKER.approaches) {
            expect(typeAt(a.tx, a.ty), `${a.tx},${a.ty}`).toBe(HAZARD_STATES.waterfall);
        }
        // ...and the sides are solid, which is what makes the two waterfall
        // tiles the ONLY approaches rather than merely two of several.
        expect(w.collidesSolid(playerBoxAt((tx - 1) * TILE_SIZE + 8, ty * TILE_SIZE + 8)))
            .not.toBeNull();
        expect(w.collidesSolid(playerBoxAt((tx + 1) * TILE_SIZE + 8, ty * TILE_SIZE + 8)))
            .not.toBeNull();
    });

    it('⛔ a DIRECTED flood confirms it: unreachable from L87\'s door, reachable from L91\'s', async () => {
        // The measurement §2.6.3's sentence needed and did not have. With
        // `canSwim` held and the waterfall ARMED, the difference between the
        // two doors is the whole finding.
        const { climbsArmedWaterfall } = await import('./botDriverV2.js');
        const w = buildLevelWorld(source(FEATHER_BLOCKER.level), { roles: ROLES });
        const opts = { noHazards: [], inventory: { canSwim: true, hasFeather: false }, lattice: 16 };
        const walk = (tx, ty) => tx >= 0 && ty >= 0 && tx < w.width && ty < w.height
            && !w.collidesSolid(playerBoxAt(tx * TILE_SIZE + 8, ty * TILE_SIZE + 8));
        const flood = (start) => {
            const seen = new Set();
            const q = [[start.tx, start.ty]];
            while (q.length) {
                const [x, y] = q.pop();
                const k = `${x},${y}`;
                if (seen.has(k) || !walk(x, y)) continue;
                seen.add(k);
                for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                    if (!walk(nx, ny)) continue;
                    // ⛔ THE STEP IS REFUSED, NOT THE CELL — an armed
                    // waterfall is crossed downward all the time.
                    if (climbsArmedWaterfall(w, { tx: x, ty: y }, { tx: nx, ty: ny }, opts)) continue;
                    q.push([nx, ny]);
                }
            }
            return seen;
        };
        const key = `${FEATHER_BLOCKER.tile.tx},${FEATHER_BLOCKER.tile.ty}`;
        for (const f of FEATHER_BLOCKER.floods) {
            const seen = flood(f.at);
            expect(seen.size, `from L${f.door}'s door`).toBe(f.reaches);
            expect(seen.has(key), `feather from L${f.door}'s door`).toBe(f.feather);
        }
    });

    it('⛔ and L87 is SPLIT: the L92 door is not in the D5 corridor\'s component', async () => {
        // What closes the upper route. Measured with the L92 teleporter
        // itself exempted, so this is not the teleporter-volume policy
        // reporting its own avoidance as a wall.
        const { isWalkableTile } = await import('./botDriverV2.js');
        const world = buildLevelWorld(source(87), { roles: ROLES });
        const tel = world.teleporters.find((t) => t.to === FEATHER_BLOCKER.l87.door.to);
        expect(tel).toBeDefined();
        for (const [inv, want] of [
            [{ canSwim: true }, FEATHER_BLOCKER.l87.reachesWithConch],
            [{ canSwim: false }, FEATHER_BLOCKER.l87.reachesWithout],
        ]) {
            const o = { noHazards: ['waterfall'], inventory: inv, lattice: 16, nodeMargin: 0 };
            const ok = (x, y) => isWalkableTile(world, x, y, tel, o);
            const seen = new Set();
            const q = [[FEATHER_BLOCKER.l87.from.tx, FEATHER_BLOCKER.l87.from.ty]];
            while (q.length) {
                const [x, y] = q.pop();
                const k = `${x},${y}`;
                if (seen.has(k) || !ok(x, y)) continue;
                seen.add(k);
                q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }
            expect(seen.size, JSON.stringify(inv)).toBe(want);
            expect(seen.has(`${FEATHER_BLOCKER.l87.door.tx},${FEATHER_BLOCKER.l87.door.ty}`))
                .toBe(FEATHER_BLOCKER.l87.connected);
        }
    });
});
