/**
 * ⛓ SEEDLING FIDELITY APFLIP — the apReportBosses flip for the R7 merge (planner `seedling-fidelity-planning-9`).
 *
 * The AS3 is vendor/seedling `ccdf189776` (R4 + the Totem gate), in the p4g wasm. Rows by D:
 *   D1  the L32 arena rock's Solid follows the ENTITY'S position under the switch (a moved rock, ROCKMOVE's
 *       `move` op, is the delivered set's), not the constant `ROCK.sealsRect`
 *   D2  `BossTotem.update`'s activation: `classCount(Wand) <= 0 && !activated && Player.hasAllTotemParts()`
 *       (`BossTotem.as:291` @ccdf189776), the parts read LIVE
 *   D4  the four boss rooms with no persistence response before (H2)
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { AP_BOSS_PERSISTENCE_RESPONSE, ROLES, buildLevelWorld, persistenceResponseOf } from './levelWorld.js';
import { PIN_NAMES, parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape, solveStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';
import { createBossTotem, stepBossTotem } from './bossTotem.js';

const ON = { apReportBosses: true };
const OFF = { apReportBosses: false };
const ALL_PARTS = [0, 1, 2, 3, 4];

const l43Run = (parts, persistence = []) => createLevelRun({
    levelSource: atlasLevelSource(), boot: { level: 43, x: 144, y: 248 }, noclip: false, noHazards: [],
    noDamage: true, grants: [], persistence, despawn: [], equips: [], pins: [...PIN_NAMES],
    save: { totem_parts: parts, keys: [], seal_parts: [] }, rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
});
/** The first tick (1-based) the room's BossTotem reads `activated`, or null within `n` idle ticks. */
function wakeTick(run, n = 60) {
    for (let i = 1; i <= n; i += 1) {
        run.advance(new Set());
        if ([...run.bosses.values()].some((b) => b.activated)) return i;
    }
    return null;
}

/** The vanilla atlas with L32's arena rock moved to (x, 128) — ROCKMOVE's `move`, as the delivered set would carry it. */
function l32MovedSource(x) {
    const A = loadAtlas();
    return levelSourceFromAtlas({ ...A, levels: A.levels.map((r) => (r.level !== 32 ? r : {
        ...r, entities: r.entities.map((e) => (e.type === 'fallrocklarge' ? { ...e, x } : e)) })) });
}
const l32FallenRun = (levelSource) => createLevelRun({
    levelSource, boot: { level: 32, x: 72, y: 120 }, noclip: false, noHazards: [], noDamage: true, grants: [],
    persistence: [{ level: 32, tag: 1 }], despawn: [], equips: [],
    pins: [...PIN_NAMES], save: { totem_parts: [], keys: [0, 1], seal_parts: [] }, rng: null,
    seam: { items: { hasSword: true } }, roles: ROLES,
});
const arenaRockRect = (run) => [...(run.liveGeometryOpts().fallenRocks ?? new Map()).values()]
    .find((r) => r.tag === 'fallrocklarge')?.rect ?? null;

describe('APFLIP D1 — the arena rock\'s Solid follows the entity (ROCKMOVE\'s move, ⚖ "Level-data patch")', () => {
    it('ON: a rock moved to x 88 lands as [88,120) x [128,160); OFF keeps the vanilla constant (64,128)', () => {
        withContactFidelity(ON, () => {
            const run = l32FallenRun(l32MovedSource(88));
            run.advance(new Set());
            expect(arenaRockRect(run)).toMatchObject({ x: 88, y: 128, w: 32, h: 32, right: 120, bottom: 160 });
        });
        withContactFidelity(OFF, () => {
            const run = l32FallenRun(l32MovedSource(88));
            run.advance(new Set());
            expect(arenaRockRect(run)).toMatchObject({ x: 64, y: 128 });
        });
    });
    it('ON at the vanilla placement: the rect is the constant, byte for byte', () => {
        const at = (fl) => withContactFidelity(fl, () => {
            const run = l32FallenRun(atlasLevelSource());
            run.advance(new Set());
            return arenaRockRect(run);
        });
        expect(at(ON)).toEqual(at(OFF));
    });
});

describe('APFLIP D2 — the Totem gate (`BossTotem.as:291` @ccdf189776)', () => {
    it('stepBossTotem: `allTotemParts` false holds the edge shut; true and undefined (the pre-R4 line) take it', () => {
        const shut = createBossTotem(144, 120);
        expect(stepBossTotem(shut, { wandGone: true, freezeObjects: false, allTotemParts: false }).activatedNow)
            .toBe(false);
        expect(shut.activated).toBe(false);
        const open = createBossTotem(144, 120);
        expect(stepBossTotem(open, { wandGone: true, freezeObjects: false, allTotemParts: true }).activatedNow)
            .toBe(true);
        const legacy = createBossTotem(144, 120);
        expect(stepBossTotem(legacy, { wandGone: true, freezeObjects: false }).activatedNow).toBe(true);
        const wand = createBossTotem(144, 120);
        expect(stepBossTotem(wand, { wandGone: false, freezeObjects: false, allTotemParts: true }).activatedNow)
            .toBe(false);
    });
    it('ON, the Wand gone ({43,0} cleared) and all five parts: the boss wakes on the first live tick', () => {
        expect(withContactFidelity(ON, () => wakeTick(l43Run(ALL_PARTS, [{ level: 43, tag: 0 }])))).toBe(1);
    });
    it('ON, the Wand gone and NO parts: no fight (and so no rocks: they drop only on `Wand.removed`)', () => {
        withContactFidelity(ON, () => {
            const run = l43Run([], [{ level: 43, tag: 0 }]);
            expect(wakeTick(run, 120)).toBe(null);
            expect(run.rockFalls ?? []).toEqual([]);
        });
    });
    it('ON, the Wand still in the room: asleep with or without the parts (`classCount(Wand) > 0`)', () => {
        expect(withContactFidelity(ON, () => wakeTick(l43Run(ALL_PARTS)))).toBe(null);
        expect(withContactFidelity(ON, () => wakeTick(l43Run([])))).toBe(null);
    });
    it('the parts are read LIVE: the gate is shut on a run whose save holds four', () => {
        expect(withContactFidelity(ON, () => wakeTick(l43Run([0, 1, 2, 3], [{ level: 43, tag: 0 }])))).toBe(null);
    });
    it('OFF is the old model: the edge is taken only inside the Wand\'s rock drop, so a Wand-less room never wakes', () => {
        expect(withContactFidelity(OFF, () => wakeTick(l43Run(ALL_PARTS, [{ level: 43, tag: 0 }])))).toBe(null);
    });
});

describe('APFLIP D4 — H2: the four boss rooms rebuilt after their kill (AS3 @ccdf189776)', () => {
    const src = atlasLevelSource();
    const build = (n, cleared) => buildLevelWorld(src(n), { roles: ROLES, ...(cleared ? { cleared } : {}) });
    const geometryOf = (w) => JSON.stringify({ solids: w.solids, objectSolids: w.objectSolids, pixelmasks: w.pixelmasks });
    it('the rows, and they are read only under the switch', () => {
        expect(AP_BOSS_PERSISTENCE_RESPONSE).toEqual({
            finalboss: 'despawn', bosstotem: 'despawn', tentaclebeast: 'built-dead', lightbosscontroller: 'end-state' });
        withContactFidelity(OFF, () => {
            for (const t of Object.keys(AP_BOSS_PERSISTENCE_RESPONSE)) expect(persistenceResponseOf(t)).toBeUndefined();
        });
        withContactFidelity(ON, () => {
            for (const [t, r] of Object.entries(AP_BOSS_PERSISTENCE_RESPONSE)) expect(persistenceResponseOf(t)).toBe(r);
            expect(persistenceResponseOf('shieldboss')).toBe('despawn');
        });
    });
    it('OFF: each cleared slot THROWS at the build (no declared response), as APBOSSES measured', () => {
        withContactFidelity(OFF, () => {
            for (const [n, tag] of [[112, 0], [43, 5], [57, 0], [69, 0]]) {
                expect(() => build(n, [tag])).toThrow(/NO declared/);
            }
        });
    });
    it('ON: the Owl ({112,0}) DESPAWNS — `FinalBoss.check` (:68-74)', () => {
        withContactFidelity(ON, () => {
            expect(build(112).finalBosses).toHaveLength(1);
            expect(build(112, [0]).finalBosses).toEqual([]);
        });
    });
    it('ON: the Totem ({43,5}) DESPAWNS — `BossTotem.check` (:462-468)', () => {
        withContactFidelity(ON, () => {
            expect(build(43).bossTotems).toHaveLength(1);
            expect(build(43, [5]).bossTotems).toEqual([]);
        });
    });
    it('ON: the Tentacled Beast ({57,0}) is built DEAD and STILL Solid — the geometry is the live room\'s', () => {
        withContactFidelity(ON, () => {
            const dead = build(57, [0]);
            expect(dead.pixelmasks.length).toBeGreaterThan(0);
            expect(geometryOf(dead)).toBe(geometryOf(build(57)));
            // the beast's body at its placement (80,48) is still a wall
            expect(Boolean(dead.collidesSolid({ x: 80, y: 48, w: 8, h: 8, right: 88, bottom: 56 }))).toBe(true);
        });
    });
    it('ON: the Lights ({69,0}) build with nothing of the fight — the controller is `notSolid`, so the room is unchanged', () => {
        withContactFidelity(ON, () => {
            expect(geometryOf(build(69, [0]))).toBe(geometryOf(build(69)));
        });
    });
    it('ON: the totem\'s kill is BANKED (`pendingEarnedClears`), so a same-run re-entry builds it despawned', () => {
        const tape = parseTape(JSON.parse(readFileSync(
            new URL('./fixtures/tapes/r6-totem-kill.json', import.meta.url), 'utf8')));
        const persistAfter = (fl) => withContactFidelity(fl, () => {
            const run = createRunForStaging(solveStaging(stagingFromTape(tape)), src);
            runTape(tape, { levelSource: src, run });
            expect(run.earnedClears.some((c) => c.level === 43 && c.tag === 5)).toBe(true);
            return run.stateDigest({ parts: true }).parts.persist;
        });
        // the earned clear is in both arms; only ON is it a PENDING clear (the persist part of the digest moves)
        expect(persistAfter(ON)).not.toBe(persistAfter(OFF));
    });
});
