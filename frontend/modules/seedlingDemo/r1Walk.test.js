/**
 * r1Walk — the R1 full walk: the route, the six segments, and the four-part
 * ENDS-MEET claim that makes a chain of segment tapes mean anything.
 *
 * ⚠ THE THING THIS SUITE EXISTS TO PREVENT: six tapes that each start
 * wherever they like and each end wherever they get to are six unrelated
 * walks, and a "chain" of them proves nothing at all. The claim has to be
 * that the segments are a PARTITION of the headline walk — which is
 * asserted here in its strongest available form: the headline tape's input
 * spans are exactly the six segments' spans, concatenated at the boundary
 * ticks. If that holds, every weaker phrasing (same level, same position,
 * same items, same component) holds too, and a deleted or reordered
 * segment cannot pass.
 *
 * The other half is the SYNTHESIZED-FIXTURE DOCTRINE: the driver re-emits
 * every committed R1 tape from the committed route, here, in CI. So a
 * geometry, pricing or physics change that would have re-routed the walk
 * is a red before anybody spends eleven minutes recording it — and the
 * tapes cannot drift from the route they claim to come from.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { plannerObstacleAt, synthesizeLegs, tileAt, tileCentre } from './botDriverV2.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { RELAXED_ROLES, TILE_SIZE, buildLevelWorld, rectsOverlap } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ITEM_PROPERTIES, serializeTape } from './tapeFormat.js';
import { runTape } from './tapeRunner.js';
import {
    R1_FULL_WALK_NAME,
    R1_ITEM_ROOMS,
    R1_NO_HAZARDS,
    R1_PERSISTENCE_EFFECTS,
    R1_SEGMENT_NAMES,
    assertRouteWellFormed,
    r1AllItems,
    r1TapeSpecs,
} from './r1Walk.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const route = JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'r1-route.json'), 'utf8'),
);
const levelSource = atlasLevelSource();
const specs = r1TapeSpecs(route);
const segments = specs.filter((s) => s.segment !== null);
const headline = specs.find((s) => s.name === R1_FULL_WALK_NAME);

/** Every committed R1 tape, parsed once. */
const tapes = Object.fromEntries(
    [...R1_SEGMENT_NAMES, R1_FULL_WALK_NAME].map((n) => [n, loadTape(n)]),
);
/** Every R1 tape's JS run, once — several are thousands of ticks. */
const runs = Object.fromEntries(
    Object.entries(tapes).map(([n, t]) => [n, runTape(t, { levelSource })]),
);

/** The R1 plan geometry, for the component half of the ends-meet claim. */
const PLAN = { noclip: true, noHazards: [...R1_NO_HAZARDS], avoidVolumes: true };
const worlds = new Map();
const worldFor = (n) => {
    if (!worlds.has(n)) worlds.set(n, buildLevelWorld(levelSource(n), { roles: RELAXED_ROLES }));
    return worlds.get(n);
};
/**
 * The connected component of walkable tiles a position stands in, or null.
 *
 * Flood-filled here rather than imported, because the route planner's copy
 * is authoring tooling that no claim may rest on. Only the handful of
 * boundary levels are ever filled.
 */
const componentAt = (level, x, y) => {
    const world = worldFor(level);
    const free = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return false;
        const c = tileCentre(tx, ty);
        return plannerObstacleAt(world, c.x, c.y, null, PLAN) === null;
    };
    const start = { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
    if (!free(start.tx, start.ty)) return null;
    const seen = new Set([`${start.tx},${start.ty}`]);
    const queue = [start];
    while (queue.length > 0) {
        const { tx, ty } = queue.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const key = `${tx + dx},${ty + dy}`;
            if (seen.has(key) || !free(tx + dx, ty + dy)) continue;
            seen.add(key);
            queue.push({ tx: tx + dx, ty: ty + dy });
        }
    }
    // A canonical id for the blob: its lowest tile in (ty, tx) order.
    return [...seen].sort()[0];
};

describe('the committed route', () => {
    it('is well formed against the R1 decisions', () => {
        expect(() => assertRouteWellFormed(route)).not.toThrow();
    });

    it('visits every R1 item room, in the ruled order', () => {
        const visited = [];
        for (const leg of route.legs) {
            const room = R1_ITEM_ROOMS.find((r) => r.level === leg.level);
            if (room && !visited.includes(room.level)) visited.push(room.level);
        }
        expect(visited).toEqual(R1_ITEM_ROOMS.map((r) => r.level));
    });

    it('orders the wand before the Witch — the one item->item dependency', () => {
        // `Witch.doneTalking()` grants darksword under `hasWand &&
        // !hasDarkSword`, so a tour that touched L12 first would contradict
        // the only real item gate in the game.
        const wand = route.legs.findIndex((l) => l.level === 43);
        const witch = route.legs.findIndex((l) => l.level === 12);
        expect(wand).toBeGreaterThan(-1);
        expect(witch).toBeGreaterThan(wand);
    });

    it('never names a pit tile as an exit except the four planned falls', () => {
        const falls = route.legs.filter((l) => l.exit?.pit);
        expect(falls).toHaveLength(4);
        for (const leg of falls) {
            const world = worldFor(leg.level);
            expect(world.pitTiles.some(
                (t) => t.tx === leg.exit.pit.tx && t.ty === leg.exit.pit.ty,
            )).toBe(true);
            expect(world.fallthrough).not.toBeNull();
        }
    });

    it('declares exactly two forced contacts, and both are real', () => {
        // An arrival is not a position the planner chose. Two on this route:
        // L3's own return trigger (the v2 latch witness, live at last) and
        // L38's arrival buttonroom, which is a room-entry puzzle.
        const declared = route.legs
            .map((l, i) => ({ i, level: l.level, contacts: l.contacts ?? [] }))
            .filter((l) => l.contacts.length > 0);
        expect(declared.map((d) => `L${d.level}:${d.contacts.join(',')}`)).toEqual([
            'L3:teleporter:-1@96,128',
            'L38:proximity-hazard:buttonroom@144,288',
        ]);
    });
});

describe('the synthesized-fixture doctrine', () => {
    // The driver re-plans every leg against the geometry as it stands NOW.
    // A wrong hitbox, a wrong tile classification, a re-priced volume or a
    // changed physics constant re-routes the walk and this goes red — which
    // is the point: an oracle recording is only meaningful while the tape it
    // recorded is still the tape the route produces.
    for (const spec of specs) {
        it(`${spec.name}: the driver still emits the committed tape`, () => {
            const result = synthesizeLegs(spec.legs, {
                levelSource,
                boot: spec.boot,
                name: spec.name,
                relax: spec.relax,
                extraVolumes: spec.extraVolumes,
                maxTicksPerTarget: spec.maxTicksPerTarget,
            });
            const emitted = JSON.parse(serializeTape({
                ...result.tape,
                description: tapes[spec.name].description,
            }));
            expect(emitted).toEqual(JSON.parse(JSON.stringify(tapes[spec.name])));
        // ⚠ Generous, and it has to be: re-planning the headline walk is
        // 79 legs of A* plus 14,963 simulated ticks, ~30s on an idle box
        // and past 60s when the rest of the suite is running beside it.
        // A tighter bound would make this test flake under contention,
        // which for a doctrine check is worse than slow.
        }, 180000);
    }
});

describe('ENDS-MEET: the segments are a partition of the headline walk', () => {
    /** Boundary `i` starts segment `i + 1`; the tick it starts at. */
    const offsets = segments.reduce((acc, s) => {
        acc.push(acc[acc.length - 1] + tapes[s.name].tick_count);
        return acc;
    }, [0]);

    it('the six segments cost exactly the headline walk in ticks', () => {
        // A segment ends ON its boundary arrival (its terminal leg has no
        // exit and no targets, so it contributes no ticks), which is what
        // makes the partition exact rather than approximately additive.
        expect(offsets[offsets.length - 1]).toBe(tapes[R1_FULL_WALK_NAME].tick_count);
    });

    /**
     * A tape as the engines read it: one held-key set per tick.
     *
     * Comparing SPANS directly would fail on an encoding difference rather
     * than a meaning one — a key held across a boundary is two spans in the
     * segments and one merged span in the headline, which is the same tape.
     * Per-tick sets are what both consumers actually act on.
     */
    const heldPerTick = (tape) => {
        const held = Array.from({ length: tape.tick_count }, () => []);
        for (const span of tape.inputs) {
            for (let t = span.from; t < span.to; t++) held[t].push(span.key);
        }
        return held.map((keys) => keys.sort().join('+'));
    };

    it('the headline tape IS the six segment tapes, tick for tick', () => {
        // The strongest available phrasing. Every segment boots into a state
        // identical to the one the headline run is in at that tick — same
        // position, zero velocity, fresh terrain, pre-armed latch, same
        // inventory — so the driver makes the same choices and emits the
        // same spans. Anything less than identical spans would mean a
        // boundary that only LOOKS like the walk passes through it.
        const concatenated = segments.flatMap((s) => heldPerTick(tapes[s.name]));
        const full = heldPerTick(tapes[R1_FULL_WALK_NAME]);
        expect(concatenated).toHaveLength(full.length);
        const firstDiff = concatenated.findIndex((h, t) => h !== full[t]);
        expect(firstDiff === -1 ? 'identical' : `tick ${firstDiff}: segments held `
            + `"${concatenated[firstDiff]}", headline held "${full[firstDiff]}"`)
            .toBe('identical');
    });

    segments.forEach((spec, i) => {
        const next = segments[i + 1];
        const run = runs[spec.name];
        const last = run.ticks[run.ticks.length - 1];

        it(`${spec.name} ends where ${next ? next.name : 'the walk'} `
            + 'expects — level, position, component, items', () => {
            const boot = next ? next.boot : null;
            // LEVEL and POSITION: an arrival is exactly the constructor
            // half-tile, which is what a parameterised boot reproduces.
            if (boot) {
                expect(last.level).toBe(boot.level);
                expect(last.x).toBe(boot.x + TILE_SIZE / 2);
                expect(last.y).toBe(boot.y + TILE_SIZE / 2);
            }
            // COMPONENT: non-null is the load-bearing half. Equal follows
            // from equal positions; NON-NULL is the claim that the walk
            // stopped somewhere the next segment can actually plan from,
            // rather than inside a volume or on unmodelled terrain.
            const component = componentAt(last.level, last.x, last.y);
            expect(component).not.toBeNull();
            if (boot) {
                expect(componentAt(boot.level, boot.x + TILE_SIZE / 2, boot.y + TILE_SIZE / 2))
                    .toBe(component);
            }
            // ITEMS: the next segment's single inherited grant entry fires
            // at tick 0 and must reproduce this segment's ending inventory
            // exactly — including `hitsMax`, which ADDS.
            if (next) {
                const booted = createLevelRun({
                    levelSource,
                    boot: next.boot,
                    noclip: true,
                    noHazards: next.relax.noHazards,
                    noDamage: next.relax.noDamage,
                    grants: next.relax.grants,
                    roles: RELAXED_ROLES,
                });
                expect(booted.inventory).toEqual(run.inventory);
            }
        });

        it(`${spec.name} starts at the headline walk's tick ${offsets[i]}`, () => {
            const full = runs[R1_FULL_WALK_NAME];
            const there = full.ticks[offsets[i]];
            expect({ level: there.level, x: there.x, y: there.y })
                .toEqual({ level: run.ticks[0].level, x: run.ticks[0].x, y: run.ticks[0].y });
        });
    });
});

describe('the terminal claim, on the JS side', () => {
    // ⚠ The verdict is the GAME's — `verify-seedling-bot-differential.mjs`
    // reads `botStatus.items` and compares against this mirror. What is
    // asserted here is that the mirror says what R1 claims, so a route that
    // silently stopped collecting something is red in CI rather than eleven
    // minutes into a recording.
    const inventory = () => runs[R1_FULL_WALK_NAME].inventory;

    it('collects 11 of the 13 non-combat items', () => {
        expect(r1AllItems()).toHaveLength(11);
        const wanted = ['sword', 'darksword', 'shield', 'darkshield', 'wand', 'conch',
            'feather', 'spear', 'darksuit', 'torch'];
        for (const item of wanted) {
            expect(inventory()[ITEM_PROPERTIES[item].property]).toBe(true);
        }
        // `health` is the odd one: it ADDS to `hitsMax` over the base 3.
        expect(inventory().hitsMax).toBe(4);
        // Ten booleans true and no eleventh — a mirror that granted
        // everything would pass the loop above.
        expect(Object.values(inventory()).filter((v) => v === true)).toHaveLength(10);
    });

    it('leaves the published blocked list FALSE', () => {
        // fire (L32, combat-gated), ghostsword (L106, behind L98's ice
        // turret) and firewand (L109, behind L108's lavatrap ferry) — all
        // three enemy-shaped, all three R5.
        for (const item of ['fire', 'ghostsword', 'firewand']) {
            expect(inventory()[ITEM_PROPERTIES[item].property]).toBe(false);
        }
    });

    it('fires every grant the route declares, once each', () => {
        const fired = runs[R1_FULL_WALK_NAME].grants;
        expect(fired.map((g) => g.level)).toEqual(route.grants.map((g) => g.level));
        expect(fired.map((g) => g.items.join('+')))
            .toEqual(route.grants.map((g) => g.items.join('+')));
    });

    it('crosses 78 times, of which 4 are pit falls', () => {
        // Quantitative pins: every positional claim is satisfiable by a bot
        // that teleports, and a transport count is what says the falls
        // actually happened.
        expect(runs[R1_FULL_WALK_NAME].transitions).toHaveLength(78);
        expect(runs[R1_FULL_WALK_NAME].transports).toHaveLength(4);
        expect(new Set(route.legs.map((l) => l.level)).size).toBe(47);
    });
});

describe('the persistence effect the walk cannot avoid', () => {
    const effect = R1_PERSISTENCE_EFFECTS[0];

    it('is caused by a leg that really makes the contact', () => {
        const leg = route.legs[route.persistence_effects[0].fromLeg];
        expect(leg.contacts).toContain(effect.contact);
        expect(leg.level).toBe(38);
    });

    it('never has the walk stand in the armed FallRock', () => {
        // The press arms L37's FallRock, whose `update` writes the player's
        // y directly — outside `noclip` and outside `noDamage`. This asserts
        // the EMITTED TAPE clears it, not merely that the planner meant to:
        // every observation in L37 after the press, box against rect.
        const { rect } = effect;
        const press = route.persistence_effects[0].fromLeg;
        const pressTick = runs[R1_FULL_WALK_NAME].transitions
            .find((t) => t.to_level === 38)?.t;
        expect(pressTick).toBeGreaterThan(0);
        expect(press).toBeGreaterThan(0);
        const inside = runs[R1_FULL_WALK_NAME].ticks.filter(
            (o) => o.level === 37 && o.t > pressTick
                && rectsOverlap(playerBoxAt(o.x, o.y), rect),
        );
        expect(inside).toEqual([]);
        // …and the level really is on the route after the press, so the
        // check above is not vacuous.
        expect(runs[R1_FULL_WALK_NAME].ticks.some(
            (o) => o.level === 37 && o.t > pressTick,
        )).toBe(true);
    });
});

describe('the witnesses the route closes (v2 vacuity table)', () => {
    // ⚠ ORACLE-BACKED, deliberately: these read the GAME's recorded stream,
    // not the JS run. A model property that no fixture can see is closed by
    // a recording that saw it, or it is not closed at all.
    const gameStream = (name) => {
        const { stream, provisional } = loadExpectation(name);
        expect(provisional).toBe(false);
        return stream;
    };

    it('THE LATCH: L11 -> L3 arrives ON L3\'s own return trigger, and it '
        + 'does not fire', () => {
        // v2 recorded this as a bounded vacuity — "neither arrival in
        // transition-west-return lands on a trigger, which is exactly why
        // the round trip is two crossings and not a bounce". The R1 route
        // walks 10 -> 11 -> 3, and L11's (32,0) teleporter arrives at
        // (104,136), inside L3's (96,128) trigger back to L11. If
        // `arriveIn` did not pre-arm the latch the way `Game`'s first frame
        // does, the game would bounce straight back and the recording would
        // show level 11 again on the very next tick.
        const stream = gameStream(R1_SEGMENT_NAMES[0]);
        const arrival = stream.transitions.find((t) => t.from_level === 11 && t.to_level === 3);
        expect(arrival).toBeDefined();
        const at = stream.ticks[arrival.t];
        expect({ x: at.x, y: at.y }).toEqual({ x: 104, y: 136 });

        const world = worldFor(3);
        const trigger = world.teleporters.find((tp) => tp.x === 96 && tp.y === 128);
        expect(trigger).toBeDefined();
        expect(trigger.to).toBe(11);
        expect(trigger.deactivated).toBe(false);
        // Still standing in the volume, still in level 3 — for as long as
        // the walk takes to leave it. The count is asserted non-trivial so
        // a run that stepped clear on tick one could not pass vacuously.
        let inside = 0;
        for (let t = arrival.t; t < stream.ticks.length; t++) {
            const o = stream.ticks[t];
            if (!rectsOverlap(playerBoxAt(o.x, o.y), trigger.rect)) break;
            expect(o.level).toBe(3);
            inside++;
        }
        expect(inside).toBeGreaterThan(1);
    });

    it('THE PASS-THROUGH: L84 is crossed with no walkable component at all', () => {
        // The 83 -> 84 arrival lands in the centre of a 3x3 block of pits,
        // so the descent ends on a pit and the edge re-fires on the next
        // tick. The recording shows two crossings one after the other with
        // the level 84 observations in between and no input dispatched.
        const stream = gameStream(R1_SEGMENT_NAMES[5]);
        const into84 = stream.transitions.find((t) => t.to_level === 84);
        const outOf84 = stream.transitions.find((t) => t.from_level === 84);
        expect(into84).toBeDefined();
        expect(outOf84).toBeDefined();
        // 61 ticks: 41 of descent (always exactly 83 px) and then 20 of
        // fall-out. NO 39-tick bounce, because the landing tile is a PIT —
        // which is the pass-through's whole signature, and the one arrival
        // of the four where the inverted landing rule takes the LAND arm.
        expect(outOf84.t - into84.t).toBe(61);
        // ⚠ ONE input tick, and it is not a walk: the controller brakes the
        // descent's residual downward velocity on the landing tick, and the
        // pit edge re-fires on the tick after. What must be empty is the
        // TRANSPORT WINDOW itself — the twenty fall-out ticks, where the
        // game refuses input and a span either consumer honoured would be
        // the asymmetry the format exists to prevent.
        const spans = loadTape(R1_SEGMENT_NAMES[5]).inputs.filter(
            (span) => span.from >= into84.t && span.from < outOf84.t,
        );
        expect(spans.map((sp) => sp.to - sp.from)).toEqual([1]);
        expect(spans[0].from).toBe(into84.t + 41);
        expect(loadTape(R1_SEGMENT_NAMES[5]).inputs.filter(
            (span) => span.from > into84.t + 41 && span.from < outOf84.t,
        )).toEqual([]);
        // ⚠ The claim is about the ARRIVAL, not the level. L84 does have
        // walkable tile centres elsewhere; what it has none of is a
        // walkable neighbour of the tile the fall lands on — a 3x3 block of
        // pits with the arrival in the middle. So there is no component for
        // the player to step into, the next tick's state edge fires, and
        // the fall chains. A router that demanded a walkable component at
        // the arrival calls the whole underworld cluster unreachable.
        const world = worldFor(84);
        const arrival = tileAt(stream.ticks[outOf84.t - 1].x, stream.ticks[outOf84.t - 1].y);
        expect(world.pitTiles.some((t) => t.tx === arrival.tx && t.ty === arrival.ty))
            .toBe(true);
        const steppableNeighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]]
            .map(([dx, dy]) => tileCentre(arrival.tx + dx, arrival.ty + dy))
            .filter((c) => plannerObstacleAt(world, c.x, c.y, null, PLAN) === null);
        expect(steppableNeighbours).toEqual([]);
    });
});
