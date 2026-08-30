/**
 * r2Walk — the committed route, the specs it produces, and the claim that
 * the segments are a PARTITION of the headline walk.
 *
 * ⚠ Why the partition is the load-bearing test. Six recordings stand in for
 * one twenty-minute one, and six tapes that each start wherever they like
 * and each end wherever they get to are six unrelated walks. The chain
 * checks in `r2Acceptance` say the endpoints MEET; this says the six tapes
 * ARE the headline, tick for tick — after which every weaker phrasing
 * follows and a deleted segment cannot pass.
 *
 * The other half is the ROUTE itself: it is generated, and a generated
 * artifact that has drifted from the intent it was generated for is exactly
 * the thing a committed file cannot tell you on its own.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, persistenceClearsFor, TILE_SIZE } from './levelWorld.js';
import { runTape } from './tapeRunner.js';
import { synthesizeLegs } from './botDriverV2.js';
import { ITEM_PROPERTIES, parseTape } from './tapeFormat.js';
import {
    R2_BLOCKED,
    R2_BOOT,
    R2_FULL_WALK_NAME,
    R2_HITS_MAX,
    R2_HOLD_TICKS,
    R2_HOLD_WITNESS,
    R2_ITEM_ROOMS,
    R2_LATTICE,
    R2_NO_HAZARDS,
    R2_SEGMENT_NAMES,
    assertRouteWellFormed,
    r2TapeSpecs,
} from './r2Walk.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const route = JSON.parse(readFileSync(join(HERE, 'fixtures', 'r2-route.json'), 'utf8'));
const specs = r2TapeSpecs(route);
const segments = specs.filter((s) => s.segment !== null);
const levelSource = atlasLevelSource();
const tapes = Object.fromEntries(
    [...R2_SEGMENT_NAMES, R2_FULL_WALK_NAME].map((n) => [n, loadTape(n)]),
);

describe('the committed route is the route this rung meant', () => {
    it('is well formed', () => {
        expect(() => assertRouteWellFormed(route)).not.toThrow();
    });

    it('boots where the build boots and keeps pits LIVE', () => {
        expect(route.boot).toEqual({ ...R2_BOOT });
        expect(route.noHazards).toEqual([...R2_NO_HAZARDS]);
        expect(route.noHazards).not.toContain('pit');
    });

    it('grants exactly the eight ruled item rooms, in order', () => {
        expect(route.grants).toEqual(R2_ITEM_ROOMS.map((r) => ({
            level: r.level, items: [...r.items],
        })));
    });

    it('names one hold, on L71\'s button', () => {
        expect(route.holds).toHaveLength(1);
        expect(route.holds[0]).toMatchObject({
            level: R2_HOLD_WITNESS.level,
            presser: R2_HOLD_WITNESS.presser,
            ticks: R2_HOLD_TICKS,
            opens: [R2_HOLD_WITNESS.lock_tag],
        });
    });

    /**
     * ⚠ EVERY CLEAR NAMES A BLOCKER IN A LEVEL THE WALK ENTERS, and both
     * halves are re-derived here rather than trusted. A clear list is forty
     * pairs of numbers; the reason it is reviewable at all is that each pair
     * came from `persistenceClearsFor` reading that level's own entities.
     */
    it('every clear is one the level itself offers', () => {
        const levels = new Set(route.legs.map((l) => l.level));
        for (const c of route.persistence) {
            expect(levels.has(c.level), `L${c.level} is on the route`).toBe(true);
            const offered = persistenceClearsFor(levelSource(c.level)).offered;
            const match = offered.find((o) => o.tag === c.tag);
            expect(match, `L${c.level} tag ${c.tag} is offered`).toBeTruthy();
            expect(c.note).toBe(match.note);
        }
    });

    it('and every clear the route makes is one the derivation still offers', () => {
        // The other direction: a level whose offered set SHRANK (a class
        // reclassified, a response corrected) must not leave a stale clear
        // behind in the committed route.
        const levels = [...new Set(route.legs.map((l) => l.level))];
        const derived = levels.flatMap((l) => persistenceClearsFor(levelSource(l)).offered)
            .map((c) => `${c.level}:${c.tag}`).sort();
        const committed = route.persistence.map((c) => `${c.level}:${c.tag}`).sort();
        expect(committed).toEqual(derived);
    });

    it('refuses nothing on the route silently — the refusals are published', () => {
        // An empty findings list and a clean pass print the same thing.
        expect(Array.isArray(route.persistence_refused)).toBe(true);
        expect(route.persistence_refused.length).toBeGreaterThan(0);
        for (const r of route.persistence_refused) expect(r.why).toBeTruthy();
    });
});

describe('the blocked list is a claim about entities, not about a map', () => {
    it('names six items, each with one seal and the rung that opens it', () => {
        expect(R2_BLOCKED).toHaveLength(6);
        for (const b of R2_BLOCKED) {
            expect(ITEM_PROPERTIES[b.item], b.item).toBeTruthy();
            expect(b.seal.length, b.item).toBeGreaterThan(20);
            expect(b.rung, b.item).toMatch(/^R[3-9]$/);
        }
    });

    it('and the eight claimed plus the six blocked are the thirteen, plus health', () => {
        // 13 non-combat items; `health` appears on the blocked list and is
        // the one that ADDS rather than flipping a boolean.
        const claimed = R2_ITEM_ROOMS.flatMap((r) => r.items);
        const blocked = R2_BLOCKED.map((b) => b.item);
        expect(new Set([...claimed, ...blocked]).size).toBe(claimed.length + blocked.length);
        expect(claimed).toHaveLength(8);
        expect(blocked).toHaveLength(6);
        expect(ITEM_PROPERTIES.health.kind).toBe('add');
        expect(ITEM_PROPERTIES.health.base).toBe(R2_HITS_MAX);
    });
});

/**
 * ⚠ `r2Acceptance` COPIES these rects rather than importing them, because
 * it is dependency-free by design. A copied rect that drifted would make
 * every claim about the hold a claim about nothing — green, forever.
 */
describe('the acceptance readout\'s copied geometry is the geometry', () => {
    const world = buildLevelWorld(levelSource(R2_HOLD_WITNESS.level));

    it('the button rect is Button@112,176\'s own', () => {
        const p = world.pressers.find((q) => `${q.tag}@${q.x},${q.y}` === R2_HOLD_WITNESS.presser);
        expect(p).toBeTruthy();
        expect({
            x: p.rect.x, y: p.rect.y, right: p.rect.right, bottom: p.rect.bottom,
        }).toEqual({ ...R2_HOLD_WITNESS.button });
    });

    it('the lock rect is lock@112,160\'s own', () => {
        const a = world.activators.find((q) => q.id === R2_HOLD_WITNESS.lock_tag);
        expect(a).toBeTruthy();
        expect({
            x: a.rect.x, y: a.rect.y, right: a.rect.right, bottom: a.rect.bottom,
        }).toEqual({ ...R2_HOLD_WITNESS.lock });
    });

    it('and the two are DISJOINT, which is what makes the crossing a crossing', () => {
        const b = R2_HOLD_WITNESS.button;
        const l = R2_HOLD_WITNESS.lock;
        expect(b.x < l.right && l.x < b.right && b.y < l.bottom && l.y < b.bottom).toBe(false);
    });
});

describe('the driver still emits the committed tapes', () => {
    for (const spec of specs) {
        it(`${spec.name}: the driver still emits the committed tape`, () => {
            const result = synthesizeLegs(spec.legs, {
                levelSource,
                boot: spec.boot,
                name: spec.name,
                relax: spec.relax,
                lattice: spec.lattice,
                nodeMargin: spec.nodeMargin,
                triggerMargin: spec.triggerMargin,
                allowGrazes: spec.allowGrazes,
                maxTicksPerTarget: spec.maxTicksPerTarget,
            });
            // ⚠ Through `parseTape`, because `buildTape` emits spans in the
            // order they CLOSED and `parseTape` normalises them. Comparing
            // the raw emission against a loaded tape reports an ordering
            // difference between two spans that start on the same tick as a
            // changed tape, which is a difference in bookkeeping rather than
            // in what the tape asks for.
            const emitted = parseTape(result.tape);
            const tape = tapes[spec.name];
            expect(emitted.tick_count).toBe(tape.tick_count);
            expect(emitted.inputs).toEqual(tape.inputs);
            expect(emitted.persistence).toEqual(tape.persistence);
            expect(emitted.noclip).toBe(false);
        // ⚠ Generous, and it has to be: re-planning the headline walk is
        // 55 legs of A* at an eight-pixel lattice plus 13,875 simulated
        // ticks — past a minute on an idle box and well past it when the
        // rest of the suite is running beside it. A tighter bound would
        // make a doctrine check flake under contention, which is worse
        // than slow.
        }, 300000);
    }
});

describe('ENDS-MEET: the segments are a partition of the headline walk', () => {
    const offsets = segments.reduce((acc, s) => {
        acc.push(acc[acc.length - 1] + tapes[s.name].tick_count);
        return acc;
    }, [0]);

    it('the six segments cost exactly the headline walk in ticks', () => {
        // A segment ends ON its boundary arrival (its terminal leg has no
        // exit and no targets, so it contributes no ticks), which is what
        // makes the partition exact rather than approximately additive.
        expect(offsets[offsets.length - 1]).toBe(tapes[R2_FULL_WALK_NAME].tick_count);
    });

    /** A tape as the engines read it: one held-key set per tick. */
    const heldPerTick = (tape) => {
        const held = Array.from({ length: tape.tick_count }, () => []);
        for (const span of tape.inputs) {
            for (let t = span.from; t < span.to; t++) held[t].push(span.key);
        }
        return held.map((keys) => keys.sort().join('+'));
    };

    it('the headline tape IS the six segment tapes, tick for tick', () => {
        const concatenated = segments.flatMap((s) => heldPerTick(tapes[s.name]));
        const full = heldPerTick(tapes[R2_FULL_WALK_NAME]);
        expect(concatenated).toHaveLength(full.length);
        const firstDiff = concatenated.findIndex((h, t) => h !== full[t]);
        expect(firstDiff === -1 ? 'identical' : `tick ${firstDiff}: segments held `
            + `"${concatenated[firstDiff]}", headline held "${full[firstDiff]}"`)
            .toBe('identical');
    });

    it('every segment carries the SAME clear list — one experiment, six tapes', () => {
        // A clear is applied once, before the first live tick, and reaches
        // only the level it names. Giving each segment its own subset would
        // make six tapes six different experiments and the chain claim
        // meaningless.
        const headline = JSON.stringify(tapes[R2_FULL_WALK_NAME].persistence);
        for (const s of segments) {
            expect(JSON.stringify(tapes[s.name].persistence), s.name).toBe(headline);
        }
    });

    segments.forEach((spec, i) => {
        const next = segments[i + 1];
        it(`${spec.name} ends where ${next ? next.name : 'the walk'} expects`, () => {
            const run = runTape(tapes[spec.name], { levelSource });
            const last = run.ticks[run.ticks.length - 1];
            const boot = next ? next.boot : null;
            if (boot) {
                expect(last.level).toBe(boot.level);
                expect(last.x).toBe(boot.x + TILE_SIZE / 2);
                expect(last.y).toBe(boot.y + TILE_SIZE / 2);
            } else {
                expect(last.level).toBe(route.legs[route.legs.length - 1].level);
            }
            // hitsMax never moves at this rung, at any boundary.
            expect(run.inventory.hitsMax).toBe(R2_HITS_MAX);
        });
    });
});

describe('the planner knobs are the rung, and they are declared', () => {
    it('every spec plans at the R2 lattice with collision ON', () => {
        for (const s of specs) {
            expect(s.lattice, s.name).toBe(R2_LATTICE);
            expect(s.relax.noclip, s.name).toBe(false);
            expect(s.relax.noDamage, s.name).toBe(true);
            expect(s.relax.persistence.length, s.name).toBe(route.persistence.length);
        }
    });

    it('the emitted tapes are version 3 and say noclip false', () => {
        for (const name of [...R2_SEGMENT_NAMES, R2_FULL_WALK_NAME]) {
            expect(tapes[name].tape_version, name).toBe(3);
            expect(tapes[name].noclip, name).toBe(false);
            expect(tapes[name].persistence.length, name).toBe(route.persistence.length);
        }
    });
});
