/**
 * ⛓ SEEDLING FIDELITY OWLSUIT (wave 49) — the Owl's body contact at its AS3 slot, and his "Suit" retaliation
 * (`CONTACT_FIDELITY.owlContactInStep`, OFF).
 *
 *     FinalBoss.as:110      super.update();      // Enemy.update → mobileUpdate, hitUpdate, hitPlayer (Enemy.as:106-111)
 *     FinalBoss.as:116-124  the lava self-hit     // reads hitsTimer / destroy
 *     FinalBoss.as:126-182  the cap, the phases   // read v.length; the barrage aim reads p.v; the walk arm snaps x/y
 *
 * The model billed `owlBody` after `stepFinalBoss`'s arms. ON, the step calls the bill at the slot above
 * (`onHitPlayer`), and the dark suit's `e.hit(1, p, 1, "Suit")` (`Player.as:1384-1387`) is declared:
 * `Enemy.hit` → `justKnock` → `knockback(1, p)` into the Owl's `v` (`FinalBoss.as:61-62`, `Enemy.as:176-178, 247-255`).
 *
 * Every row stages the committed `r6-owl-kill` tape (L112 `finalboss@64,96`): with a `darksuit` grant (whose
 * `primary` presses swing nothing, wave 48's caveat), or without it with the presses stripped from tick 10 on (the
 * intro's release is the press at tick 2, which must stay), or with the tape's own keys up to a tick and a hold after
 * it — the holds `tools/search.mjs` found (report `CC/docs/cloud-reports/seedling-fidelity-owlsuit.md`).
 */
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { FINAL_BOSS, pointLength } from './finalBossFight.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const KEY = 'owlContactInStep';
const ID = 'finalboss@64,96';
const REFUSAL = /hasDarkSuit` retaliates INTO the attacker/;
const D1_TEXT = /fidelity DARKSUITBOSSES D1: `FinalBoss.hit` is `Enemy.hit` with `onlyHitBy = "Lava"`/;
const ROCK_REFUSAL = /the Owl's body touched the player at tick 58 on a tick that also SPAWNED a rock/;

/** Boot `r6-owl-kill` (optionally with the suit), drive `keysAt(t)` for `ticks`, with the two keys set. */
function stage({ ticks, suit = false, keysAt, peek = [] }, on, dsbr = false) {
    const tape = loadTape('r6-owl-kill');
    const grants = [...(tape.grants ?? []), ...(suit ? [{ level: tape.boot.level, items: ['darksuit'] }] : [])];
    return withContactFidelity({ [KEY]: on, darkSuitBossRetaliation: dsbr }, () => {
        const run = createRunForStaging({ ...stagingFromTape(tape), grants }, levelSource);
        let thrown = null;
        const seen = {};
        try {
            for (let t = 0; t < ticks; t += 1) {
                run.advance(keysAt(t, tape));
                if (peek.includes(t)) seen[t] = { state: { ...run.state }, rocks: run.owlProjectilesNow.rocks };
            }
        } catch (e) {
            thrown = e.message;
        }
        return { thrown, hits: run.ledger('playerHits'), owl: run.owlTicks, seen };
    });
}

/** The tape's keys (the presses kept, or stripped from tick 10 on). */
const tapeKeys = (presses) => (t, tape) => new Set([...heldKeysAt(tape, t)].filter((k) => presses || t < 10 || k !== 'primary'));
/** The tape's keys to `from`, then `dir` held for `dur` ticks, then nothing. */
const holdAfter = (from, dir, dur) => (t, tape) => (t < from ? heldKeysAt(tape, t) : t < from + dur ? new Set(dir) : new Set());

const SUIT = { ticks: 40, suit: true, keysAt: tapeKeys(true), peek: [25] };
const BARE = { ticks: 40, suit: false, keysAt: tapeKeys(false) };
const SNAP = { ticks: 440, keysAt: holdAfter(190, ['down'], 31) };
const ROCK = { ticks: 60, keysAt: holdAfter(30, ['up', 'right'], 26), peek: [57, 59] };

describe('OWLSUIT — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_OWL_CONTACT_IN_STEP)(
        'ships OFF, appended after darkSuitBossRetaliation, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 50: TURRETSUIT `turretSuitRetaliation` was appended after this key.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['turretSuitRetaliation', 'pickupTickFreeze', 'dialogueFrameFreeze', 'frozenTickUngated', 'freezeEdgeFrames', 'freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies', 'freezeFramesStepResponders', 'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_OWL_CONTACT_IN_STEP');
        });
});

describe('OWLSUIT — the dark suit contact (the tape\'s first contact, with the suit)', () => {
    it('OFF: the named `byEnemy` refusal; with `darkSuitBossRetaliation` ON it carries wave 48\'s D1 text', () => {
        const off = stage(SUIT, false);
        expect(off.thrown).toMatch(/the `owlBody` hit \(finalboss@64,96\) at tick 27 in level 112/);
        expect(off.thrown).toMatch(REFUSAL);
        expect(off.thrown).not.toMatch(/DARKSUITBOSSES/);
        const w48 = stage(SUIT, false, true);
        expect(w48.thrown).toMatch(REFUSAL);
        expect(w48.thrown).toMatch(D1_TEXT);
    });

    it('ON: billed in the step; the shove is `knockback(1, p)` into `v`, and that tick\'s phase reads the new `|v|`', () => {
        const on = stage(SUIT, true);
        expect(on.thrown).toBe(null);
        expect(on.hits.map((h) => [h.t, h.source, h.hits])).toEqual([[27, 'owlBody', 1]]);
        const r = on.hits[0].retaliation;
        expect(r).toMatchObject({ id: ID, as3: 'FinalBoss', landed: true, damaged: false, force: 1,
            why: 'justKnock: onlyHitBy "Lava" != "Suit"' });
        // From the AS3, by hand: tick 25's walk arm set `v` to `moveSpeed` toward pod 0; tick 26's friction leaves
        // 0.75 of it and moves him; then `knockback(1, p)` adds the unit vector from the player's point (the end of
        // tick 25) through his.
        const [w25, w26] = [on.owl[25], on.owl[26]];
        const pod = FINAL_BOSS.podPositions[0];
        const to = { x: pod.x - w25.bossX, y: pod.y - w25.bossY };
        const s = pointLength(to.x, to.y);
        const keep = (FINAL_BOSS.moveSpeed - FINAL_BOSS.friction) / FINAL_BOSS.moveSpeed;
        const p = on.seen[25].state;
        const a = Math.atan2(w26.bossY - p.y, w26.bossX - p.x);
        expect(r.vx).toBeCloseTo((to.x / s) * keep + Math.cos(a), 12);
        expect(r.vy).toBeCloseTo((to.y / s) * keep + Math.sin(a), 12);
        expect(pointLength(r.vx, r.vy)).toBeGreaterThan(FINAL_BOSS.moveSpeed);
        // `v.length <= moveSpeed` is now false: that tick takes NO arm (the coast row), so it rolls no grenade.
        expect([w25.phase, w26.phase]).toEqual(['walk', 'coast']);
        expect(w26.streamCount).toBe(w25.streamCount);
    });

    it('ON with `darkSuitBossRetaliation` ON as well: the same rows (this key declares the Owl by itself)', () => {
        const a = stage(SUIT, true);
        const b = stage(SUIT, true, true);
        expect(b).toEqual(a);
    });

    it('the same inputs without the suit: the tick is a walk and the Owl\'s `v` is his own, ON as OFF', () => {
        const off = stage(BARE, false);
        const on = stage(BARE, true);
        expect(on).toEqual(off);
        expect(on.hits.map((h) => [h.t, h.source])).toEqual([[27, 'owlBody']]);
        expect(on.hits[0]).not.toHaveProperty('retaliation');
        expect(on.owl[26].phase).toBe('walk');
    });
});

describe('OWLSUIT — no suit: the order moves a measured value', () => {
    it('the pod snap: the AS3 bills the PRE-snap point, so the lethal contact lands a tick later ON', () => {
        const off = stage(SNAP, false);
        const on = stage(SNAP, true);
        // the snap tick: the walk arm parks him at (pod.x, pod.y + 1) AFTER `super.update()`'s `hitPlayer`
        const pod = FINAL_BOSS.podPositions[1];
        const snap = on.owl.find((w) => w.t > 400 && w.rockfallTime === FINAL_BOSS.rockfallTimeMax);
        expect([snap.t, snap.bossX, snap.bossY]).toEqual([424, pod.x, pod.y + 1]);
        // the two runs agree on every Owl tick before it (OFF dies on the snap tick, so it pushes no row for it)
        expect(off.owl.slice(0, snap.t)).toEqual(on.owl.slice(0, snap.t));
        expect(off.owl).toHaveLength(snap.t);
        const rows = (r) => r.hits.map((h) => [h.t, h.source, h.hits]);
        expect(rows(off)).toEqual([[277, 'owlRock', 1], [403, 'owlBody', 2], [425, 'owlBody', 3]]);
        expect(rows(on)).toEqual([[277, 'owlRock', 1], [403, 'owlBody', 2], [426, 'owlBody', 3]]);
        expect(off.thrown).toMatch(/the player died \(owlBody\) at tick 425 in level 112/);
        expect(on.thrown).toMatch(/the player died \(owlBody\) at tick 426 in level 112/);
    });

    it('a rock-spawn tick: OFF refuses; ON bills, and the barrage aim reads the knocked-back `p.v`', () => {
        const off = stage(ROCK, false);
        expect(off.thrown).toMatch(ROCK_REFUSAL);
        const on = stage(ROCK, true);
        expect(on.thrown).toBe(null);
        expect(on.owl[58].phase).toBe('barrageSpawn');
        const hit = on.hits.find((h) => h.t === 59);
        expect([hit.source, hit.hits]).toEqual(['owlBody', 1]);
        // `new RockFall(p.x + p.v.x * stepsAhead + random * radius * 2 - radius, …)` (`FinalBoss.as:144`), with
        // `stepsAhead` -15 and `radius` 20: the two `p.v.x` (before / after the knockback) give disjoint windows.
        const p = on.seen[57].state;
        const rock = on.seen[59].rocks.find((r) => r.id.endsWith('@58'));
        const window = (vx) => [Math.trunc(p.x + vx * -15 - 20), p.x + vx * -15 + 20];
        const [lo, hi] = window(p.vx + hit.knockback.dx);
        const [plo, phi] = window(p.vx);
        expect(rock.x).toBeGreaterThanOrEqual(lo);
        expect(rock.x).toBeLessThan(hi);
        expect(rock.x >= plo && rock.x < phi).toBe(false);
    });
});
