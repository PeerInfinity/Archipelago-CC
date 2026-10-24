/**
 * seedlingDemo/killLockWitness — the readings `scripts/procgen/probe-seedling-killlock.mjs` records and
 * `fidelityKillLock.test.js` replays (slice `seedling-fidelity-killlock`): the model's player stream and its counted
 * bodies per observation under every KILLLOCK switch, and the game's body rows (`botMobiles()`) read as removal
 * brackets. One implementation for the probe and the test.
 */
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { withKillLockBodies } from './killLockBodies.js';

/** Every switch this slice ships, ON — the state the arms were authored and are compared under. */
export const KILLLOCK_ALL_ON = Object.freeze({
    jellyfishLive: true, lavaRunnerLive: true, chaserKillArm: true, turretRemovalLedger: true, darkShieldIceTurret: true,
});

/** The body rows a run reports, keyed by id: alive / dying / gone, per observation tick. */
export function modelBodies(run) {
    const out = {};
    for (const c of (run.entities('chasers') ?? [])) {
        out[c.id] = { x: c.x, y: c.y, dying: !!c.dying, destroy: !!c.destroy, hits: c.hits, hitsTimer: c.hitsTimer };
    }
    const dmg = new Map((run.entities('turretDamage') ?? []).map((d) => [d.id, d]));
    for (const [id, t] of (run.entities('turrets') ?? new Map())) {
        if (!t.removed) out[id] = { x: t.x, y: t.y, dead: !!t.dead, hits: dmg.get(id)?.hits, hitsTimer: dmg.get(id)?.hitsTimer };
    }
    return out;
}

/** The model's readings of a tape under the switches: the player stream and each body's death/removal ticks. */
export function modelReadings(tape) {
    return withKillLockBodies(KILLLOCK_ALL_ON, () => {
        let run = null;
        const ticks = [];
        const bodies = [];
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            ticks.push(o);
            bodies[o.t] = run ? modelBodies(run) : null;
            r = st.next();
        }
        return { ticks, bodies, ...bodyEvents(bodies) };
    });
}

/** First tick each body is dying/dead and first tick it is gone, from a per-tick body map. */
export function bodyEvents(bodies) {
    const died = {};
    const gone = {};
    const seen = new Set();
    for (let t = 0; t < bodies.length; t += 1) {
        const b = bodies[t];
        if (!b) continue;
        for (const [id, r] of Object.entries(b)) {
            seen.add(id);
            if ((r.dying || r.dead || r.destroy) && died[id] === undefined) died[id] = t;
        }
        for (const id of seen) if (!(id in b) && gone[id] === undefined) gone[id] = t;
    }
    return { died, gone };
}

export const classOf = (id) => ({ jellyfish: 'Jellyfish', lavarunner: 'LavaRunner', iceturret: 'IceTurret' })[id.split('@')[0]];

/**
 * The game's removals, by class (botMobiles has no census id): for each class, the ticks its live count drops,
 * as [lo, hi] — the last sample it was present and the first it was not, so an unsampled tick widens the bracket
 * rather than being guessed. In order, so the k-th removal of a class pairs with the model's k-th.
 */
export function gameBodyEvents(samples, modelTicks) {
    const byTick = new Map();
    for (const s of samples) if (Number.isInteger(s.t) && !byTick.has(s.t)) byTick.set(s.t, s);
    const ts = [...byTick.keys()].sort((a, b) => a - b);
    let calibrated = true;
    for (const t of ts) {
        const p = byTick.get(t).rows.find((r) => r.cls === 'Player');
        const o = modelTicks[t];
        if (!p || !o) continue;
        if (Math.abs(p.x - o.x) > 1e-9 || Math.abs(p.y - o.y) > 1e-9) calibrated = false;
    }
    const gone = {};
    let prev = null;
    for (const t of ts) {
        const counts = {};
        for (const r of byTick.get(t).rows) if (r.cls !== 'Player') counts[r.cls] = (counts[r.cls] ?? 0) + 1;
        if (prev) {
            for (const [cls, n] of Object.entries(prev.counts)) {
                for (let k = 0; k < n - (counts[cls] ?? 0); k += 1) (gone[cls] ??= []).push({ lo: prev.t + 1, hi: t });
            }
        }
        prev = { t, counts };
    }
    return { calibrated, sampled: ts.length, gone };
}

