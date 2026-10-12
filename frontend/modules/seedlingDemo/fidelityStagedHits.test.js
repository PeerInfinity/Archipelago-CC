/**
 * seedling-fidelity-stagedhits (wave 14, planner `seedling-fidelity-planning-6`) — the player's DAMAGE at a staging.
 *
 * D2: `player_damage` (`{hits, hits_timer, direction_face?}`, an OPTIONAL staging field) through
 * `createRunForStaging` → `levelRun`'s initial `damage`; absent = a fresh `Player`, byte-identical. The forced-hit
 * budget (`worldHitsOf`) and the death check (`playerHit`'s own `hits >= hitsMax`) read the staged value.
 * D3: the GAME witness (`probe-seedling-staged-hits.mjs --record`, p4f headless): leg 622's L73 arrival, the
 * lavarunner's hit, a HOLD inside its i-frame, the continuation on the game's skip path — replayed here at 0 px.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { PLAYER_DAMAGE, PlayerDamageError, playerDamageFromStatus, stagedHitsMismatch, stagedPlayerDamage,
    STAGED_PLAYER_DAMAGE_KEYS } from './playerDamage.js';
import { FORCED_HIT_TRACE, proveForcedHit, withForcedHits, worldHitsOf } from './forcedHit.js';
import { runDigest } from './jsRuntimeSolver.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal, arrivalSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const json = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const W622 = json('fixtures', 'chaser-witness', 'forcedhit-l73-622-plan.json');
const levelSource = atlasLevelSource();
const ARRIVAL = stagingFromTape(parseTape(JSON.stringify(W622.tape)));
const run = (staging = ARRIVAL) => createRunForStaging(staging, levelSource);
const keysOf = (s) => new Set(s);
/** the run's state after each of `keys` — position, velocity, damage, level */
const trace = (r, keys) => keys.map((k) => {
    r.advance(keysOf(k));
    return { x: r.state.x, y: r.state.y, vx: r.state.vx, vy: r.state.vy, level: r.level, ...r.damage };
});

describe('STAGEDHITS D2 — the field: absent is a fresh Player, byte for byte', () => {
    it('the keys, and stagingFromTape does NOT copy the field (no tape carries it); solveStaging keeps it', () => {
        expect(STAGED_PLAYER_DAMAGE_KEYS).toEqual(['hits', 'hits_timer', 'direction_face']);
        expect(stagingFromTape({ ...W622.tape, player_damage: { hits: 1, hits_timer: 0 } })).not.toHaveProperty('player_damage');
        expect(solveStaging({ ...ARRIVAL, player_damage: { hits: 1, hits_timer: 0 } }).player_damage)
            .toEqual({ hits: 1, hits_timer: 0 });
    });
    it('absent, null and `{hits: 0, hits_timer: 0}` all build the same run, and step it identically', () => {
        const keys = [['down', 'right'], ['down', 'right'], ...Array(30).fill(['left'])];
        const a = run();
        const b = run({ ...ARRIVAL, player_damage: null });
        const c = run({ ...ARRIVAL, player_damage: { hits: 0, hits_timer: 0 } });
        expect(a.damage).toEqual({ hits: 0, hitsTimer: 0, directionFace: -1 });
        expect(a.stagedDamage).toBe(null);
        expect(b.stagedDamage).toBe(null);
        expect(runDigest(b)).toBe(runDigest(a));
        expect(runDigest(c)).toBe(runDigest(a));
        const ta = trace(a, keys);
        expect(trace(b, keys)).toEqual(ta);
        expect(trace(c, keys)).toEqual(ta);
        expect(a.ledger('playerHits')).toEqual(c.ledger('playerHits'));
    });
    it('a staged block reaches the run\'s initial damage, and `stagedDamage` says what was staged', () => {
        const r = run({ ...ARRIVAL, player_damage: { hits: 1, hits_timer: 7, direction_face: 3 } });
        expect(r.damage).toEqual({ hits: 1, hitsTimer: 7, directionFace: 3 });
        expect(r.stagedDamage).toEqual({ hits: 1, hitsTimer: 7, directionFace: 3 });
    });
});

describe('STAGEDHITS D2 — a staging the game cannot be in is refused BY NAME', () => {
    const at = (pd) => () => run({ ...ARRIVAL, player_damage: pd });
    it.each([
        [{ hits: 3, hits_timer: 0 }, /`hits` 3 ≥ `hitsMax` 3: that player is dead/],
        [{ hits: -1, hits_timer: 0 }, /`hits` is not a non-negative integer/],
        [{ hits: 1.5, hits_timer: 0 }, /`hits` is not a non-negative integer/],
        [{ hits: 1 }, /`hits_timer` is not an integer in 0\.\.20/],
        [{ hits: 1, hits_timer: 21 }, /`hits_timer` is not an integer in 0\.\.20/],
        [{ hits: 1, hits_timer: 0, direction_face: 4 }, /`direction_face` is not −1/],
        [{ hits: 1, hits_timer: 0, hitsTimer: 3 }, /names \["hitsTimer"\], which it does not carry/],
        [[1, 0], /is not an object/],
    ])('%j', (pd, why) => {
        expect(at(pd)).toThrow(PlayerDamageError);
        expect(at(pd)).toThrow(why);
    });
    it('`hitsMax` is the RUN\'s: a heart (`hits_max` 4) admits hits 3', () => {
        const s = { ...ARRIVAL, seam: { ...ARRIVAL.seam, items: { ...ARRIVAL.seam.items, hitsMax: 4 } } };
        expect(stagedPlayerDamage({ hits: 3, hits_timer: 0 }, { hitsMax: 4 })).toEqual({ hits: 3, hitsTimer: 0, directionFace: -1 });
        expect(() => stagedPlayerDamage({ hits: 3, hits_timer: 0 }, { hitsMax: 3 })).toThrow(/dead/);
        expect(() => stagedPlayerDamage({ hits: 0, hits_timer: 0 }, {})).toThrow(/no default here/);
        void s;
    });
});

describe('STAGEDHITS D2 — the staged state is the run\'s own: the i-frame, the death, the budget', () => {
    it('a staged i-frame blocks the arrows for its ticks AND swallows the lavarunner\'s t2 contact — it lands at the lapse', () => {
        const at = (r) => [r.state.x, r.state.y, r.damage.hits, r.damage.hitsTimer];
        const staged = run({ ...ARRIVAL, player_damage: { hits: 1, hits_timer: 5 } });
        const fresh = run();
        const s = [];
        const f = [];
        for (let i = 0; i < 6; i += 1) {
            staged.advance(keysOf(['down']));
            fresh.advance(keysOf(['down']));
            s.push(at(staged));
            f.push(at(fresh));
        }
        // staged: `down` held, and the player does not move while the window is open (`canSteer`); the contact the
        // fresh run takes at t2 is swallowed (`hitsTimer > 0`), and the hit lands on t6, the first tick after the lapse
        expect(s.slice(0, 5)).toEqual([[72, 24, 1, 4], [72, 24, 1, 3], [72, 24, 1, 2], [72, 24, 1, 1], [72, 24, 1, 0]]);
        expect(s[5].slice(2)).toEqual([2, 19]);
        expect(staged.ledger('playerHits').map((h) => [h.t, h.id, h.hits])).toEqual([[6, 'lavarunner@72,24', 2]]);
        // fresh: steers at t1 and is hit at t2 (FORCEDHIT's tick)
        expect(f[0].slice(0, 2)).toEqual([72, 24.8]);
        expect(fresh.ledger('playerHits').map((h) => [h.t, h.hits])).toEqual([[2, 1]]);
        expect(staged.contactsSuppressed.length).toBeGreaterThan(0);
    });
    it('staged at hitsMax − 1 the lavarunner\'s t2 hit KILLS — the run\'s own `playerHit`, a death row, a new Player', () => {
        const r = run({ ...ARRIVAL, player_damage: { hits: 2, hits_timer: 0 } });
        trace(r, [['up'], ['up'], []]);
        expect(r.ledger('playerDeaths').map((d) => d.t)).toEqual([2]);
        expect(r.damage.hits).toBe(0);
    });
    it('`worldHitsOf` reads the staged hits until a hit, a door or a death replaces them', () => {
        const r = run({ ...ARRIVAL, player_damage: { hits: 1, hits_timer: 0 } });
        expect(worldHitsOf(r)).toEqual({ hits: 1, lastHitAt: null, id: null, staged: true });
        r.advance(keysOf(['up']));
        r.advance(keysOf(['up']));
        expect(worldHitsOf(r)).toEqual({ hits: 2, lastHitAt: 2, id: 'lavarunner@72,24' });
        let crossed = null;
        for (let i = 0; i < 10 && !crossed; i += 1) crossed = r.advance(keysOf(['up'])).transition;
        expect(crossed).toMatchObject({ to_level: 74 });
        expect(worldHitsOf(r)).toEqual({ hits: 0, lastHitAt: null, id: null });
        // unstaged: exactly the BEFORE shape
        expect(worldHitsOf(run())).toEqual({ hits: 0, lastHitAt: null, id: null });
    });
    it('the proof steps forks that carry the staging: at hitsMax − 1 every leaf is a death', () => {
        const p = proveForcedHit(() => run({ ...ARRIVAL, player_damage: { hits: 2, hits_timer: 0 } }));
        expect(p).toMatchObject({ proven: true, depth: 2, deadly: 1296, minHits: null });
    });
});

// ── leg 622's solve, as FORCEDHIT's `solve622`, with the staging's damage ──
const ITEMS_73 = {
    hitsMax: 3, hasTorch: true, hasDarkSuit: false, hasSpear: true, hasFeather: true, canSwim: true, hasFireWand: false,
    hasWand: true, hasFire: true, hasDarkShield: false, hasShield: true, hasGhostSword: false, hasDarkSword: false,
    hasSword: true,
};
const MAP = json('..', 'flashPanel', 'atlases', 'seedling-map.json');
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
function solve622(playerDamage) {
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]);
    rt.tick();
    const s = rt.session.staging;
    const staging = { ...s, inventory_slots: [0, 1, 3, 2], seam: { ...s.seam, items: { ...s.seam.items, ...ITEMS_73 } },
        ...(playerDamage ? { player_damage: playerDamage } : {}) };
    const goal = { kind: 'exit', level: 73, tiles: [[4, 0]], name: 'level_73__r0c4 -> level_74' };
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(73) });
    const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
        scratchPersistence: true }), passes: ANYTIME_PASSES };
    const rows = [];
    FORCED_HIT_TRACE.sink = (r) => rows.push(r);
    try {
        return { res: createInPlaceProduceService().start(req).result, rows };
    } finally {
        FORCED_HIT_TRACE.sink = null;
    }
}

describe('STAGEDHITS D2 — leg 622 with the game\'s damage staged: the forced-hit budget reads it, never a death', () => {
    it('staged 0 (= absent): the FORCEDHIT plan, 4 ticks, billing the one hit', () => {
        const { res } = withForcedHits(true, () => solve622({ hits: 0, hits_timer: 0 }));
        expect(res.ok).toBe(true);
        expect(res.plan.verbs).toEqual(['forced-hit']);
    });
    it('staged hits 1 of 3: the proof holds, and the budget refuses the crossing BY NAME (hits now 1, margin 1)', () => {
        const { res, rows } = withForcedHits(true, () => solve622({ hits: 1, hits_timer: 0 }));
        expect(res.ok).toBe(false);
        expect(res.message).toMatch(/the combat ladder is EXHAUSTED/);
        expect(res.message).toMatch(/forced-hit: every input from here is hit .*over the budget's 0 \(hits now 1, hitsMax 3, margin 1/s);
        expect(rows.every((r) => r.outcome === 'no-crossing')).toBe(true);
    });
    it('staged hits 2 of 3 (hitsMax − 1): every proof leaf DIES, so no crossing is planned — never a death', () => {
        const { res, rows } = withForcedHits(true, () => solve622({ hits: 2, hits_timer: 0 }));
        expect(res.ok).toBe(false);
        expect(res.message).toMatch(/forced-hit: .*every proof leaf dies/s);
        expect(rows.every((r) => r.outcome === 'no-crossing')).toBe(true);
    });
});

describe('STAGEDHITS — the helpers the JS arc wires', () => {
    it('`playerDamageFromStatus` takes the two keys the game names, and refuses a status without them', () => {
        expect(playerDamageFromStatus({ hits: 1, hits_timer: 9, x: 1 })).toEqual({ hits: 1, hits_timer: 9 });
        expect(() => playerDamageFromStatus({ hits: 1 })).toThrow(/no integer `hits` \/ `hits_timer`/);
    });
    it('`stagedHitsMismatch`: null when equal, else {expected (the model), got (the game)}', () => {
        const r = run({ ...ARRIVAL, player_damage: { hits: 1, hits_timer: 9 } });
        expect(stagedHitsMismatch(r, { hits: 1, hits_timer: 9 })).toBe(null);
        expect(stagedHitsMismatch(r, { hits: 1, hits_timer: 8 })).toEqual({ expected: { hits: 1, hits_timer: 9 },
            got: { hits: 1, hits_timer: 8 } });
        expect(stagedHitsMismatch(run(), { hits: 1, hits_timer: 9 })).toMatchObject({ expected: { hits: 0, hits_timer: 0 } });
        expect(stagedHitsMismatch(r, null)).toEqual({ expected: { hits: 1, hits_timer: 9 }, got: null });
        expect(PLAYER_DAMAGE.hitsTimerMax).toBe(20);
    });
});
