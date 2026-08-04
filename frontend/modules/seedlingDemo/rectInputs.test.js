/**
 * The rect-input sweep, as a committed gate.
 *
 * R5 slice 8, step 0. The probe (`scripts/procgen/probe-seedling-rect-inputs.mjs`)
 * is the readable report; this is the thing that goes red when somebody adds
 * a `PRESS_ARMS` entry, a hazard row or an entity class whose box the table
 * does not carry.
 *
 * ⛔ THE FAILURE IT GUARDS CANNOT FAIL ANY OTHER WAY. A rect with a
 * non-finite edge answers every `rectsOverlap` question "no": a wall that is
 * not there, a press census that cannot see its own target, a clearance
 * proof over nothing. It has shipped twice on this arc — the rope (slice 7)
 * and the `Watcher` (this slice) — and both times the entity was ALSO
 * `refused` by policy, so no route was ever going to find it.
 */

import { describe, expect, it } from 'vitest';

import {
    ENTITY_CLASSES, PRESS_ARMS, PRESS_BOX_OVERRIDES, ROLES,
    WATCHER_PRESS_BOX, buildLevelWorld, entityRect, rect, rectsOverlap,
} from './levelWorld.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { assertEnvelopeBody } from './encounters.js';
import { ENEMY_CLASSES } from './combat.js';

const source = atlasLevelSource();

/** Every field of a built world that carries a rect. */
const RECT_FIELDS = [
    ['solids', (o) => [o.rect, o.shrunkRect]],
    ['objectSolids', (o) => [o.rect, o.shrunkRect]],
    ['pixelmasks', (o) => [o.rect]],
    ['teleporters', (o) => [o.rect]],
    ['pickups', (o) => [o.rect]],
    ['hazards', (o) => [o.rect]],
    ['pressers', (o) => [o.rect]],
    ['pressResponders', (o) => [o.rect]],
    ['activators', (o) => [o.rect, o.touchRect]],
];

const finite = (r) => Number.isFinite(r.x) && Number.isFinite(r.y)
    && Number.isFinite(r.right) && Number.isFinite(r.bottom);

describe('the rect-input sweep', () => {
    it('⛔ a rect with a non-finite edge never overlaps anything — the premise', () => {
        const real = rect(0, 0, 16, 16);
        expect(rectsOverlap(real, { x: 0, y: 0, right: NaN, bottom: 16 })).toBe(false);
        expect(rectsOverlap(real, { x: 0, y: 0, right: null, bottom: 16 })).toBe(false);
        expect(rectsOverlap(real, { x: 0, y: 0, w: 16, h: 16 })).toBe(false);
        // ...and in the other direction too, which is what makes it silent.
        expect(rectsOverlap({ x: 0, y: 0, right: NaN, bottom: 16 }, real)).toBe(false);
    });

    it('⛔⛔ every rect the five-role census builds, in every level, is finite', () => {
        const atlas = loadAtlas();
        const records = Array.isArray(atlas.levels) ? atlas.levels : Object.values(atlas.levels ?? atlas);
        const bad = [];
        let checked = 0;
        let built = 0;
        for (const record of records) {
            let world;
            try {
                world = buildLevelWorld(record, { roles: ROLES });
            } catch {
                // A level the census refuses to BUILD is a different, named
                // finding (`FROZEN_UNBUILDABLE`), not a malformed rect.
                continue;
            }
            built += 1;
            for (const [field, pick] of RECT_FIELDS) {
                for (const o of world[field] ?? []) {
                    for (const r of pick(o)) {
                        if (r === null || r === undefined) continue;
                        checked += 1;
                        if (!finite(r)) {
                            bad.push(`L${record.level} ${field} "${o.tag ?? o.as3}" `
                                + `${JSON.stringify(r)}`);
                        }
                    }
                }
            }
        }
        expect(built).toBeGreaterThan(100);
        expect(checked).toBeGreaterThan(5000);
        expect(bad).toEqual([]);
    });

    it('⛔ `entityRect` THROWS on a class with no box, rather than returning NaN', () => {
        // The rope's shape and the Watcher's, reduced: a class whose `w` the
        // entity table does not carry.
        expect(() => entityRect({ as3: 'Boxless', dx: 0, dy: 0, originX: 0, originY: 0 }, 0, 0))
            .toThrow(/never overlaps anything/i);
        expect(() => entityRect({ as3: 'Boxless', dx: 0, dy: 0, w: 16, h: 16 }, 0, 0))
            .toThrow(/never overlaps anything/i);
    });

    it('⛓ and every `PRESS_ARMS` class can be given a rect at all', () => {
        // The generalisation of the two failures: a class the press census
        // will call `entityRect` on had better have a box from SOMEWHERE —
        // its own entry, an override, or the `rope` collider's span.
        const boxless = [];
        for (const [tag, cls] of Object.entries(ENTITY_CLASSES)) {
            if (!PRESS_ARMS[cls.as3]) continue;
            if (cls.collider === 'rope') continue;      // ropeSpanRect
            if (PRESS_BOX_OVERRIDES[cls.as3]) continue; // LightPole, Watcher
            if (!Number.isFinite(cls.w) || !Number.isFinite(cls.h)) boxless.push(tag);
        }
        expect(boxless).toEqual([]);
    });

    it('⛓ the Watcher\'s press box is its OWN hitbox, not its talk circle', () => {
        // `Watcher.as:49` is `setHitbox(16, 16, 8, 8)` and `NPC.as:47`
        // constructs at the placement's half-tile, so the two cancel: one
        // cell, exactly on the placement. The 48x48 in `ENTITY_CLASSES`
        // is the auto-talk hazard and answers a different question.
        expect(entityRect(WATCHER_PRESS_BOX, 64, 96))
            .toMatchObject({ x: 64, y: 96, right: 80, bottom: 112 });
        expect(ENTITY_CLASSES.watcher.hazard.w).toBe(48);
    });

    it('⛔ L43\'s Watcher — the wand room — has a real press rect now', () => {
        const w = buildLevelWorld(source(43), { roles: ROLES });
        const watchers = w.pressResponders.filter((p) => p.as3 === 'Watcher');
        expect(watchers.length).toBeGreaterThan(0);
        for (const p of watchers) expect(finite(p.rect)).toBe(true);
    });

    it('⛔⛔ `chaseEnvelope` refuses a body-less row that has no exemption', () => {
        // The one real finding among the ten enumerated sites: the `??
        // {w:0,h:0,ox:0,oy:0}` default kept the arithmetic finite and made
        // the clearance optimistic instead — a plausible number rather than
        // a silent false, which is harder to notice, not easier.
        //
        // ⚠ TESTED ON THE GUARD, NOT THROUGH `chaseEnvelope`. Every shipped
        // row satisfies it, so a test that went the long way round could
        // only ever exercise the PASSING arm — which is the shape of check
        // this whole step exists to refuse.
        expect(() => assertEnvelopeBody('invented', { hitbox: null }))
            .toThrow(/no transcribed hitbox/);
        expect(assertEnvelopeBody('a-boss', { hitbox: null, boss: 'an arena' })).toBeNull();
        expect(assertEnvelopeBody('a-turret', { hitbox: null, envelopeProof: false })).toBeNull();
        expect(assertEnvelopeBody('bob', { hitbox: { w: 8, h: 8, ox: 4, oy: 4 } }))
            .toEqual({ w: 8, h: 8, ox: 4, oy: 4 });
    });

    it('⛓ ...and every row that HAS no hitbox carries one of the two exemptions', () => {
        const unexcused = Object.entries(ENEMY_CLASSES)
            .filter(([, row]) => !row.hitbox && !row.boss && row.envelopeProof !== false)
            .map(([tag]) => tag);
        expect(unexcused).toEqual([]);
    });
});
