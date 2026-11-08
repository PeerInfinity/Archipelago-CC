/**
 * seedlingDemo/hammerKeylockTurretL40 — the L40 flag-8 arrivals of hammer-phase KEYLOCK-TURRET's rows
 * (`hammerKeylockTurret.test.js`, `hammerKeylockTurret.train.test.js`): the page's own staging of legs 395/412
 * (`probe-seedling-divergence-sweep --capture-requests`, sphere 6.6, tag 12 staged with `--stage-flags`) cut to its
 * fields, and the worker's solve of it with its keys replayed on a fresh run (30(c)). Test support only: nothing in the
 * app imports it.
 */
import { liveOf, replayTape, settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';

const LOCK = 'bosslock@480,352';
const TURRET = 'iceturret@472,400';
const GOAL = Object.freeze({ kind: 'clear-tag', tag: { level: 40, tag: 8 }, at: { x: 480, y: 352 }, obstacle: LOCK });

/**
 * The page's own staging of an L40 flag-8 arrival (`probe-seedling-divergence-sweep --capture-requests`, sphere 6.6,
 * `--stage-flags=…=>40:12`), cut to its fields: the level records are the committed atlas (the capture's own records
 * answer byte for byte: 412 SOLVED 748 at 322 work units both ways).
 */
export function l40Flag8Staging({ boot, time, door = true }) {
    return {
        boot: { level: 40, ...boot }, noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: door ? [{ level: 40, tag: 12 }] : [], despawn: [], equips: [], pins: ['sound', 'dead_frames'],
        save: { totem_parts: [0], keys: [0, 1, 2], seal_parts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
        rng: { seed: 1510219060, split: true, cosmetic: 0 },
        seam: {
            items: { hasSword: true, hasGhostSword: false, hasShield: true, hasFire: true, hasWand: false,
                hasFireWand: false, canSwim: true, hasSpear: false, hasDarkShield: false, hasDarkSuit: false,
                hasDarkSword: false, hasFeather: false, hasTorch: true },
            beam: false, rock_set: false, hits_max: 3, time, primary: 0, secondary: 0,
            cutscene: [false, false, false, false], menu_state: 0,
        },
        inventory_slots: [0, 1],
    };
}

/** Leg 412's arrival from L43 (the boot the page re-arrives at; the player stands at (328,600)). */
export const LEG_412 = Object.freeze({ boot: { x: 320, y: 592 }, time: 5248 });

/** Leg 395's arrival from L39 (the player stands at (488,904)). */
export const LEG_395 = Object.freeze({ boot: { x: 480, y: 896 }, time: 5233 });

/**
 * Solve an L40 flag-8 staging as the page's worker does (`solveFromTape`, the dashless pass: both legs' plans are
 * dashless) and, for a plan, replay its keys on a FRESH run of the staging: `{ok, message, ticks, verbs, hits, deaths,
 * open, dead}` (the lock open, the turret dead at the end).
 */
export function solveL40Flag8(staging) {
    const levelSource = atlasLevelSource();
    const live = liveOf(replayTape({ staging, perTick: [], levelSource, scratchPersistence: true }));
    const answer = settleSolve(() => solveFromTape({ staging, perTick: [], live, levelSource, solverGoal: GOAL,
        name: 'wasm-location-40', scratchPersistence: true, dashMode: 'none', fineCheckpoints: true }));
    if (!answer.ok) return { ok: false, message: answer.message };
    const run = replayTape({ staging, perTick: [], levelSource, scratchPersistence: true });
    for (const held of answer.plan.solution) run.advance(held);
    return {
        ok: true,
        ticks: answer.plan.solution.length,
        verbs: answer.plan.verbs,
        hits: run.playerHits.map((h) => `t${h.t} ${h.source}:${h.id}`),
        deaths: run.playerDeaths.length,
        open: run.entities('openActivators').has(LOCK),
        dead: run.entities('turrets').get(TURRET)?.dead === true,
    };
}
