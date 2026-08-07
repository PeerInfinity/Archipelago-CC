/**
 * bossTotem — the wake, transcribed, against the table a PROBE derived
 * three slices earlier from the same source.
 *
 * ⛓⛓ THE HEADLINE TEST IS THE TABLE. `r5Totem.L43_BOSS_WAKE.ticks` was
 * produced at slice 20 by `probe-seedling-r5-l43-boss-wake.mjs`, which
 * transcribed `BossTotem.update()` as a throwaway loop inside the probe.
 * This file re-derives every one of those numbers from a DIFFERENT
 * transcription — the committed family — and asserts they agree. Two
 * transcriptions of one source, written three slices apart, is the nearest
 * thing to an independent stratum a model of a source file can have.
 * [[feedback_verifier_shared_assumption]]
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_TOTEM, WAND_PICKUP, BossTotemError,
    bossTotemClampY, bossTotemSolidRect, bossWakeTable,
    createBossTotem, stepBossTotem, wandFadeFreezeTicks, wandFadeGateOpen,
} from './bossTotem.js';
import { fallRockFreezeTicks } from './fallRock.js';
import { L43_BOSS_WAKE, L43_WAND_WINDOW } from './r5Totem.js';

/** `bosstotem@152,168` — the OEL point IS the entity point for this class. */
const boss = () => createBossTotem(152, 168);
/** L43's three `fallrock`s, entity y = OEL y + 8. */
const ROCK_FALL_TO = [344, 344, 392];
/** The tick the freeze drains on — the EARLIEST rock's release wins. */
const freezeUntil = () => Math.min(...ROCK_FALL_TO.map((f) => fallRockFreezeTicks(f).total));

describe('⛓⛓ the wake table, re-derived and checked against slice 20\'s probe', () => {
    it('reproduces every tick of `L43_BOSS_WAKE.ticks`', () => {
        const t = bossWakeTable(freezeUntil());
        expect(t.activation).toBe(L43_BOSS_WAKE.ticks.activation);
        expect(t.rampStarts).toBe(L43_BOSS_WAKE.ticks.rampStarts);
        expect(t.fullyActivated).toBe(L43_BOSS_WAKE.ticks.fullyActivated);
        expect(t.clampOnset).toBe(L43_BOSS_WAKE.ticks.clampOnset);
        expect(t.restDrained).toBe(L43_BOSS_WAKE.ticks.restDrained);
        expect(t.walkStarts).toBe(L43_BOSS_WAKE.ticks.walkStarts);
    });

    it('⛓ the clamp lands ONE TICK AFTER the flag, and that is the ordering', () => {
        // The assignment is at the TOP of `update()`, above the block that
        // sets `fullyActivated`, so the tick that raises the flag cannot be
        // the tick that clamps. A model that put them together would be one
        // tick early for the whole rest of the window.
        const t = bossWakeTable(freezeUntil());
        expect(t.clampOnset).toBe(t.fullyActivated + 1);
    });

    it('⛔ the rest timer is FREEZE-GATED and the ramp is NOT', () => {
        // On this room's own schedule the gate never binds — the flag lands
        // at 215 and the freeze drained at 185 — so the two are separated
        // by a synthetic freeze that outlasts the ramp. Without the gate the
        // walk would start on the same tick either way, and the transcription
        // would be untested.
        const late = bossWakeTable(400);
        const onTime = bossWakeTable(freezeUntil());
        expect(onTime.fullyActivated).toBe(late.fullyActivated);
        expect(late.walkStarts).toBeGreaterThan(onTime.walkStarts);
        // 400 - 215 = 185 ticks of rest the freeze refused to spend.
        expect(late.walkStarts).toBe(onTime.walkStarts + (400 - onTime.fullyActivated));
    });

    it('the boundary band the window plans is exactly this table\'s two terms', () => {
        const t = bossWakeTable(freezeUntil());
        expect(L43_WAND_WINDOW.boundaryBand.from).toBe(t.clampOnset + 1);
        expect(L43_WAND_WINDOW.boundaryBand.to).toBe(t.walkStarts - 1);
        expect(L43_WAND_WINDOW.boundaryBand.width)
            .toBe(L43_WAND_WINDOW.boundaryBand.to - L43_WAND_WINDOW.boundaryBand.from + 1);
    });
});

describe('the activation edge', () => {
    it('does not fire while the Wand is still in the world', () => {
        const b = boss();
        for (let i = 0; i < 500; i++) {
            stepBossTotem(b, { wandGone: false, freezeObjects: false, playerY: 100 });
        }
        expect(b.activated).toBe(false);
        expect(b.fullyActivated).toBe(false);
        expect(b.rumblingTime).toBe(BOSS_TOTEM.rumblingTimeMax);
    });

    it('⛔ fires ONCE — `!activated` is the edge, not a level', () => {
        const b = boss();
        const first = stepBossTotem(b, { wandGone: true, freezeObjects: false });
        const second = stepBossTotem(b, { wandGone: true, freezeObjects: false });
        expect(first.activatedNow).toBe(true);
        expect(second.activatedNow).toBe(false);
        expect(b.sinceActivation).toBe(1);
    });
});

describe('⛓ the pre-wake SOLID, which levelWorld\'s ROLES row does not have', () => {
    it('is the arena\'s five open columns, and null once activated', () => {
        const b = boss();
        // `setHitbox(80, 32, 40, -12)` ⇒ [x-40, x+40) x [y+12, y+44).
        expect(bossTotemSolidRect(b)).toEqual({ x: 112, right: 192, y: 180, bottom: 212 });
        expect(L43_BOSS_WAKE.boss.box)
            .toEqual({ x: 112, right: 192, y: 180, bottom: 212 });
        stepBossTotem(b, { wandGone: true, freezeObjects: false });
        // ⛔ null MEANS NOT SOLID — an activated boss is `type = "Enemy"`,
        // which is not in `Mobile.solids`, so the player walks through it.
        // Falling through to a static rect here would close the only window
        // the room's northward run has.
        expect(bossTotemSolidRect(b)).toBeNull();
    });

    it('its bottom edge IS the clamp\'s y — one number, two mechanisms', () => {
        const b = boss();
        expect(bossTotemSolidRect(b).bottom).toBe(212);
        expect(bossTotemClampY(b)).toBeNull();
        for (let i = 0; i < 300; i++) {
            stepBossTotem(b, { wandGone: true, freezeObjects: false });
        }
        expect(bossTotemClampY(b)).toBe(212);
    });
});

describe('⛔⛔ the clamp is a FLOOR and only a walk that goes NORTH sees it', () => {
    const wound = () => {
        const b = boss();
        for (let i = 0; i < 216; i++) {
            stepBossTotem(b, { wandGone: true, freezeObjects: false, playerY: 240 });
        }
        return b;
    };

    it('does nothing to a player standing where the wand was', () => {
        // The wand's entity y is 232 — SOUTH of 212 — so a window that
        // collected it and stood still would report "the clamp holds"
        // having tested nothing at all.
        const r = stepBossTotem(wound(), {
            wandGone: true, freezeObjects: false, playerY: 232,
        });
        expect(r.clampedY).toBeNull();
    });

    it('teleports a player who is north of 212, and it is an ASSIGNMENT', () => {
        const r = stepBossTotem(wound(), {
            wandGone: true, freezeObjects: false, playerY: 180,
        });
        // Not a sweep, not a collision resolution: one write of one number.
        expect(r.clampedY).toBe(212);
    });

    it('is not gated on the freeze', () => {
        const r = stepBossTotem(wound(), {
            wandGone: true, freezeObjects: true, playerY: 180,
        });
        expect(r.clampedY).toBe(212);
    });

    it('is silent when the caller models no player', () => {
        expect(stepBossTotem(wound(), { wandGone: true, freezeObjects: false }).clampedY)
            .toBeNull();
    });
});

describe('⛔⛔ the wand FADE — a freeze that fires on approach, not on contact', () => {
    it('costs 99 FROZEN frames out of 100 alpha steps, and they are two numbers', () => {
        // `Game.freezeObjects = alpha < 1` is written AFTER the step, so
        // the hundredth step leaves the flag FALSE and is not a dead frame.
        // The records' `fadeTicks: 100` is the step count; this is the cost.
        // [[feedback_accumulate_dont_divide_the_fade]]
        expect(wandFadeFreezeTicks()).toBe(99);
        expect(L43_BOSS_WAKE.ceremony.fadeTicks).toBe(100);
        expect(Math.round(1 / WAND_PICKUP.alphaRate)).toBe(100);
    });

    it('the gate is the player\'s Y ALONE, plus two booleans', () => {
        const at = (playerY, over = {}) => wandFadeGateOpen({
            playerY, wandY: 232, hasAllTotemParts: true, fallFromCeiling: false, ...over,
        });
        // `p.y < y + Tile.h` = p.y < 248 — half a room, not a hitbox.
        expect(at(247)).toBe(true);
        expect(at(248)).toBe(false);
        expect(at(100)).toBe(true);
        // ⛔ The wall slice 22 hit, and the one this batch removed.
        expect(at(100, { hasAllTotemParts: false })).toBe(false);
        // ⛔ And the arrival is a DESCENT, which the gate excludes — which is
        // why a BOOT is a cleaner entry than the pit the room is reached by.
        expect(at(100, { fallFromCeiling: true })).toBe(false);
    });
});

describe('the family refuses rather than guessing', () => {
    it('throws if the wake never reaches its walk', () => {
        expect(() => bossWakeTable(1e9)).toThrow(BossTotemError);
    });
});
