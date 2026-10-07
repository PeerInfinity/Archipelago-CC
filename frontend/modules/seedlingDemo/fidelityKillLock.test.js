/**
 * SEEDLING FIDELITY KILLLOCK — the kill-lock rooms' bodies, replayed against the game in node.
 *
 * `fixtures/killlock-witness/<arm>.json` holds a tape the model authored with every KILLLOCK switch ON and the
 * GAME's readings of it (p4f headless, `scripts/procgen/probe-seedling-killlock.mjs --record`): the drained player
 * stream and one `botMobiles()` sample per game tick. With the switches ON the model reproduces the player at 0 px,
 * every counted body's `hits`/`hitsTimer` at every sampled tick, and every body's removal on the tick the game
 * removed it. With every switch OFF the bridge and the policy rows are the BEFORE model; the defaults are the user's ruling (K2 OFF).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    KILLLOCK_BODIES, KILLLOCK_BODIES_DEFAULTS, KILLLOCK_BODIES_KEYS, withKillLockBodies,
} from './killLockBodies.js';
import { bridgedChaserTags, isBridgedChaser } from './chasers.js';
import { KILL_ARM_POLICY, killArmModelled } from './enemyDamage.js';
import { classOf, gameBodyEvents, KILLLOCK_ALL_ON, modelReadings } from './killLockWitness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'killlock-witness');
const ARMS = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

describe('the defaults are the user\'s ruling, and all-OFF is the BEFORE model', () => {
    it('K1/K3/K4/K5 are ON and K2 lavaRunnerLive is OFF by default; ALL_ON names every switch', () => {
        expect(KILLLOCK_BODIES_DEFAULTS).toEqual({
            jellyfishLive: true, lavaRunnerLive: false, chaserKillArm: true, turretRemovalLedger: true,
            darkShieldIceTurret: true,
        });
        expect(Object.keys(KILLLOCK_ALL_ON).sort()).toEqual([...KILLLOCK_BODIES_KEYS].sort());
        expect({ ...KILLLOCK_BODIES }).toEqual(KILLLOCK_BODIES_DEFAULTS);
    });
    it('the bridge roster and the kill policy are the old ones with every switch OFF, and widen ON', () => {
        const ALL_OFF = Object.fromEntries(KILLLOCK_BODIES_KEYS.map((k) => [k, false]));
        withKillLockBodies(ALL_OFF, () => {
            expect(bridgedChaserTags()).toEqual(['bob', 'bobsoldier', 'puncher']);
            expect(isBridgedChaser('jellyfish')).toBe(false);
            expect(KILL_ARM_POLICY.Jellyfish.policy).toBe('refused');
            expect(KILL_ARM_POLICY.LavaRunner.policy).toBe('refused');
            expect(killArmModelled('Jellyfish')).toBe(false);
        });
        // the defaults: the jellyfish is bridged, the lavarunner is not
        expect(bridgedChaserTags()).toEqual(['bob', 'bobsoldier', 'jellyfish', 'puncher']);
        expect(KILL_ARM_POLICY.Jellyfish.policy).toBe('modelled');
        expect(killArmModelled('LavaRunner')).toBe(false);
        withKillLockBodies(KILLLOCK_ALL_ON, () => {
            expect(bridgedChaserTags()).toEqual(['bob', 'bobsoldier', 'jellyfish', 'lavarunner', 'puncher']);
            expect(KILL_ARM_POLICY.Jellyfish.policy).toBe('modelled');
            expect(killArmModelled('LavaRunner')).toBe(true);
        });
        expect(bridgedChaserTags()).toEqual(['bob', 'bobsoldier', 'jellyfish', 'puncher']);
    });
});

describe('the game witnesses (fixtures/killlock-witness/)', () => {
    it('three arms, each recorded on the game', () => {
        expect(ARMS.map((w) => w.arm)).toEqual(['killlock-l60-west', 'killlock-l98-jellies', 'killlock-l98-turret']);
        for (const w of ARMS) expect(w.game?.ticks?.length, w.arm).toBeGreaterThan(0);
    });

    for (const w of ARMS) {
        describe(w.arm, () => {
            const m = modelReadings(w.tape);
            it('the player stream is the game\'s, observation for observation (0 px)', () => {
                expect(m.ticks.length).toBe(w.game.ticks.length);
                const first = w.game.ticks.findIndex((o, i) => o.level !== m.ticks[i].level
                    || o.x !== m.ticks[i].x || o.y !== m.ticks[i].y);
                expect(first).toBe(-1);
            });
            it('every counted body\'s hits and i-frame are the game\'s at every sampled tick', () => {
                const bad = [];
                for (const s of w.game.samples) {
                    const mb = m.bodies[s.t];
                    if (!mb) continue;
                    for (const cls of ['Jellyfish', 'LavaRunner', 'IceTurret']) {
                        const g = s.rows.filter((r) => r.cls === cls).map((r) => `${r.hits}/${r.hitsTimer}`).sort();
                        const mm = Object.entries(mb).filter(([id]) => classOf(id) === cls)
                            .map(([, r]) => `${r.hits}/${r.hitsTimer}`).sort();
                        if (JSON.stringify(g) !== JSON.stringify(mm)) bad.push(`t${s.t} ${cls} ${g} | ${mm}`);
                    }
                }
                expect(bad).toEqual([]);
            });
            it('every body leaves the world on the tick the game removed it', () => {
                const ev = gameBodyEvents(w.game.samples, m.ticks);
                expect(ev.calibrated).toBe(true);
                const ids = Object.entries(m.gone).sort((a, b) => a[1] - b[1]);
                expect(ids.length).toBeGreaterThan(0);
                for (const [id, t] of ids) {
                    const g = ev.gone[classOf(id)].shift();
                    expect([id, g.lo <= t && t <= g.hi]).toEqual([id, true]);
                }
            });
        });
    }

    it('L60: both jellyfish are killed and the lock lets the walk through to L61 on the model\'s tick', () => {
        const w = ARMS.find((a) => a.arm === 'killlock-l60-west');
        expect(w.game.ticks.at(-1).level).toBe(61);
        expect(w.model.crossings).toEqual([{ t: w.game.ticks.length - 1, level: 61 }]);
        expect(w.tape.persistence.filter((r) => r.level === 60)).toEqual([expect.objectContaining({ tag: 0 })]);
    });

    it('L98: the turret dies to the dark shield\'s bump and its corpse DROWNS on its own Water tile (K4, K5)', () => {
        const w = ARMS.find((a) => a.arm === 'killlock-l98-turret');
        const rows = w.game.samples.map((s) => ({ t: s.t, r: s.rows.find((x) => x.cls === 'IceTurret') }));
        const hits = [...new Set(rows.filter((x) => x.r).map((x) => x.r.hits))];
        expect(hits).toEqual([0, 0.5, 2.5, 3]);
        const dead = rows.find((x) => x.r?.anim === 'dead').t;
        const gone = rows.find((x) => x.t > dead && !x.r).t;
        expect(gone - dead).toBe(11);
    });
});
