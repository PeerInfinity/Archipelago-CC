/**
 * ⛓ SEEDLING FIDELITY WANDENEMYBODIES (wave 68) — `wandShotEnemyBodies`: a WandShot stops on a live Turret, LavaTrap,
 * WallFlyer, IceTrap, SandTrap or Drill, and the hit is the game's (`Enemy.hit` and each class's own `knockback` /
 * `canHit`) — wave 67's residue, and L59/L62/L65's turret and L78's lavatraps on the late walk.
 *
 * Rows:
 *   - the key: default OFF, last, its env name in the solver's table;
 *   - the game witnesses (`fixtures/wandenemybodies-witness/*.json`, recorded by `probe-seedling-wandenemybodies.mjs`
 *     on p4g): ON is the game at every sampled tick (the player, every shot, every body of the six classes with its
 *     `hits` / `hitsTimer`, a flyer's `v`, a drill's and a turret's anim, every TurretSpit); OFF refuses the press with
 *     the shipped text; the numbers each measures;
 *   - the walk's rooms (L59, L62, L65, L78): OFF refuses; ON with the key alone still refuses, on wave 67's trap
 *     bodies only; ON with both keys gets past it;
 *   - the census: every body of the six classes is covered ON; the gates that still refuse, by name (`noDamage`,
 *     `STATIC_SWORD_ARM` OFF, `drillLive` OFF); a KILL refuses by name; two bodies under one shot refuse by name;
 *   - composition rows: the base's last eight OFF keys ON beside the key; `wandShotTrapBodies` ON alone beside it.
 * Every committed tape ON vs OFF, and the captured entry-37 request with both keys ON, are the slow half
 * (`fidelityWandEnemyBodies.slow.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { isBridgedChaser } from './chasers.js';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { withStaticSwordArm } from './enemyDamage.js';
import { withWandVerb } from './wandVerb.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    WAND_ENEMY_CLASSES, WAND_ENEMY_TAPES, compareSample, modelWandEnemySamples, wandEnemySwitches, wandEnemyTape,
} from '../../../scripts/procgen/probe-seedling-wandenemybodies.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = 'wandShotEnemyBodies';
const TRAP = 'wandShotTrapBodies';
const DIR = join(HERE, 'fixtures', 'wandenemybodies-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
const byName = Object.fromEntries(WITNESSES.map((w) => [w.name, w]));
/** The base's last eight keys, all OFF (wave 67's tip). */
const LAST_EIGHT = ['plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter',
    'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', TRAP];
const cannot = (level, list) => `a WandShot in level ${level} would collide with ${list.length} Enemy-typed bod(ies) `
    + `this run cannot place: ${list.join(', ')}.`;
const L36 = ['sandtrap@32,48', 'sandtrap@64,64', 'sandtrap@80,80', 'sandtrap@48,80', 'sandtrap@64,80'];
/** The shipped refusal each witness's press meets with both keys OFF. */
const OFF_REFUSAL = {
    'turret-live': cannot(59, ['grenade@112,112', 'turret@152,64']),
    'turret-iframes': cannot(59, ['grenade@112,112', 'turret@152,64']),
    'turret-l65': cannot(65, ['darktrap@144,144', 'turret@64,112']),
    'turret-die': cannot(62, ['turret@232,248', 'darktrap@112,208']),
    'turret-fade': cannot(62, ['turret@232,248', 'darktrap@112,208']),
    'turret-removed': cannot(62, ['turret@232,248', 'darktrap@112,208']),
    'lavatrap-live': cannot(78, ['lavatrap@96,80', 'lavatrap@144,48', 'lavatrap@144,96', 'grenade@232,72']),
    'lavatrap-iframes': cannot(78, ['lavatrap@96,80', 'lavatrap@144,48', 'lavatrap@144,96', 'grenade@232,72']),
    'icetrap-live': cannot(53, ['icetrap@160,192']),
    'sandtrap-live': cannot(16, ['sandtrap@32,32', 'sandtrap@48,32']),
    'sandtrap-l36': cannot(36, L36),
    'sandtrap-die': cannot(36, L36),
    // the two sword-killed traps have left the census by this press
    'sandtrap-removed': cannot(36, ['sandtrap@32,48', 'sandtrap@64,64', 'sandtrap@80,80']),
    'wallflyer-flight': cannot(27, ['wallflyer@192,48']),
    'drill-sit': cannot(88, ['drill@128,160']),
    'drill-hop': cannot(88, ['drill@128,160']),
};

/** The game's first sample with the shot playing "die" — the stop tick and point. */
const gameStop = (w, k = 0) => {
    const dies = w.samples.filter((x) => x.shots.some((y) => y.anim === 'die'));
    const starts = dies.filter((s, i) => i === 0 || dies[i - 1].t !== s.t - 1 || !dies[i - 1].shots.some((y) => y.anim === 'die'));
    const s = starts[k];
    return s ? { t: s.t, x: s.shots.find((y) => y.anim === 'die').x, y: s.shots.find((y) => y.anim === 'die').y } : null;
};
/** A body of class `cls` in the game's sample at tick `t` (the one at entity point `at`, when the room holds several). */
const body = (w, t, cls, at = null) => w.samples.find((s) => s.t === t)?.bodies
    .find((b) => b.cls === cls && (at === null || (b.x === at[0] && b.y === at[1]))) ?? null;

/** Run a tape to its end (or its throw) under `over`. */
const playTo = (tape, over, levelSource = atlasLevelSource()) => withWandVerb(true, () => withContactFidelity(over, () => {
    const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, levelSource);
    try {
        for (let i = 0; i < tape.tick_count; i += 1) {
            run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
        }
        return { run, error: null };
    } catch (e) {
        return { run, error: e.message };
    }
}));
const tapeOf = (name, patch = {}) => parseTape(JSON.stringify({ ...wandEnemyTape(name), ...patch }));

describe('fidelity WANDENEMYBODIES — the key', () => {
    it('ships OFF, is the last key, and its env name is in the solver\'s table', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        expect(CONTACT_FIDELITY_KEYS.at(-1)).toBe(KEY);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WAND_SHOT_ENEMY_BODIES');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
    });

    it('every witness the probe names is recorded, on p4g, on the delivered vanilla set', () => {
        expect(WITNESSES.map((w) => w.name).sort()).toEqual(Object.keys(WAND_ENEMY_TAPES).sort());
        expect(Object.keys(OFF_REFUSAL).sort()).toEqual(Object.keys(WAND_ENEMY_TAPES).sort());
        for (const w of WITNESSES) {
            expect(w.page, w.name).toBe('seedling_bot_ap_p4g');
            expect(w.delivered_set, w.name).toMatch(/^seedling-vanilla-record-/);
            // The recording embeds the probe's tape today (a drifted tape is not this witness).
            expect(w.tape, w.name).toEqual(wandEnemyTape(w.name));
        }
    });

    it('the witnesses cover all six classes', () => {
        const seen = new Set(WITNESSES.flatMap((w) => w.samples.flatMap((s) => s.bodies.map((b) => b.cls))));
        expect([...seen].sort()).toEqual([...WAND_ENEMY_CLASSES].sort());
    });
});

describe.each(WITNESSES.map((w) => [w.name, w]))('fidelity WANDENEMYBODIES — the game witness %s', (name, w) => {
    const tape = parseTape(JSON.stringify(w.tape));

    it('ON: the model is the game at every sampled tick (player, shots, the six classes\' bodies, spits)', async () => {
        const m = await modelWandEnemySamples(tape, wandEnemySwitches(name));
        expect(m.error).toBeNull();
        const dis = w.samples.flatMap((s) => compareSample(s.t, s, m.col[s.t]));
        expect(dis).toEqual([]);
        expect(w.samples.filter((s) => s.shots.length > 0).length).toBeGreaterThan(0);
    }, 120000);

    it('OFF: the press is refused with the shipped text', () => {
        const r = playTo(tape, { [KEY]: false, [TRAP]: false });
        expect(r.error).toContain(OFF_REFUSAL[name]);
    });
});

describe('fidelity WANDENEMYBODIES — what each witness measures (the game\'s numbers)', () => {
    it('(a) TURRET, L59: the shot stops at (151, 72) on tick 15; the turret takes hits 0.5 and 30 i-frames (29 on its own update)', () => {
        const w = byName['turret-live'];
        expect(gameStop(w)).toEqual({ t: 15, x: 151, y: 72 });
        expect(body(w, 14, 'Turret')).toMatchObject({ hits: 0, hitsTimer: 0 });
        expect(body(w, 15, 'Turret')).toMatchObject({ x: 160, y: 72, hits: 0.5, hitsTimer: 29 });
    });

    it('(a) TURRET i-frames: a second shot 20 ticks later lands in them (no damage); a third, 30 after it, lands (hits 1)', () => {
        const w = byName['turret-iframes'];
        expect(gameStop(w, 0)).toEqual({ t: 15, x: 151, y: 72 });
        expect(gameStop(w, 1).t).toBe(35);
        expect(body(w, 35, 'Turret')).toMatchObject({ hits: 0.5, hitsTimer: 9 });
        expect(gameStop(w, 2).t).toBe(65);
        expect(body(w, 65, 'Turret')).toMatchObject({ hits: 1, hitsTimer: 29 });
    });

    it('(b) TURRET after C1\'s sword kill: a body in "die" and in the fade (no damage: hits 3 >= hitsMax); after its removal the shot flies on', () => {
        const die = byName['turret-die'];
        const sd = gameStop(die);
        expect(body(die, sd.t, 'Turret')).toMatchObject({ x: 240, y: 256, anim: 'die', hits: 3, destroy: false });
        const fade = byName['turret-fade'];
        const sf = gameStop(fade);
        expect(body(fade, sf.t, 'Turret')).toMatchObject({ x: 240, y: 256, anim: '', destroy: true, hits: 3 });
        expect(sf).toEqual({ t: sf.t, x: sd.x, y: sd.y });
        const gone = byName['turret-removed'];
        const sg = gameStop(gone);
        expect(body(gone, sg.t, 'Turret')).toBeNull();
        expect(sg.x).toBeLessThan(sd.x - 40);
    });

    it('(d) TURRET, L65 (the walk\'s room, staged): the shot stops at (63, 120) on tick 15, hits 0.5', () => {
        const w = byName['turret-l65'];
        expect(gameStop(w)).toEqual({ t: 15, x: 63, y: 120 });
        expect(body(w, 15, 'Turret')).toMatchObject({ x: 72, y: 120, hits: 0.5, hitsTimer: 29 });
    });

    it('(a)/(d) LAVATRAP, L78 (staged, outside its tongue): stops at (98, 88) on tick 18, hits 0.5; the tongue is unchanged', () => {
        const w = byName['lavatrap-live'];
        expect(gameStop(w)).toEqual({ t: 18, x: 98, y: 88 });
        expect(body(w, 18, 'LavaTrap', [104, 88])).toMatchObject({ hits: 0.5, hitsTimer: 29 });
        const i = byName['lavatrap-iframes'];
        expect(gameStop(i, 1).t).toBe(38);
        expect(body(i, 38, 'LavaTrap', [104, 88])).toMatchObject({ hits: 0.5, hitsTimer: 9 });
    });

    it('(a) ICETRAP, L53: `canHit = false` — the shot stops at (178, 200) on tick 14 and the trap takes nothing', () => {
        const w = byName['icetrap-live'];
        expect(gameStop(w)).toEqual({ t: 14, x: 178, y: 200 });
        expect(w.samples.every((x) => x.bodies.filter((b) => b.cls === 'IceTrap').every((b) => b.hits === 0 && b.hitsTimer === 0))).toBe(true);
    });

    it('(a) SANDTRAP, L16 and L36: stops at (66, 40) / (72, 98) on tick 14, hits 0.5; after the sword kill a dying one is a body, a removed one is not', () => {
        expect(gameStop(byName['sandtrap-live'])).toEqual({ t: 14, x: 66, y: 40 });
        expect(body(byName['sandtrap-live'], 14, 'SandTrap')).toMatchObject({ hits: 0.5, hitsTimer: 29 });
        expect(gameStop(byName['sandtrap-l36'])).toEqual({ t: 14, x: 72, y: 98 });
        const die = byName['sandtrap-die'];
        const sd = gameStop(die);
        expect(die.samples.find((s) => s.t === sd.t).bodies.some((b) => b.cls === 'SandTrap' && b.anim === 'die' && b.hits === 3)).toBe(true);
        const gone = byName['sandtrap-removed'];
        expect(gone.samples.find((s) => s.t === gameStop(gone).t).bodies.filter((b) => b.cls === 'SandTrap').length).toBe(3);
    });

    it('(c) WALLFLYER, L27: the flyer launched at the player is met IN FLIGHT and reversed (v -4 → +4), hits 0.5', () => {
        const w = byName['wallflyer-flight'];
        const s = gameStop(w);
        expect(s).toEqual({ t: 16, x: 177, y: 56 });
        const before = body(w, s.t - 1, 'WallFlyer');
        const after = body(w, s.t, 'WallFlyer');
        expect(before.vx).toBe(-4);
        expect(after).toMatchObject({ hits: 0.5, hitsTimer: 29 });
        expect(after.x).toBe(before.x + 4);
    });

    it('(a)/(c) DRILL, L88: a sitting (invisible) drill stops the shot and plays "hit" for its i-frames; a hopped one is met at its new cell', () => {
        const sit = byName['drill-sit'];
        const s = gameStop(sit);
        expect(body(sit, s.t - 1, 'Drill')).toMatchObject({ x: 136, y: 168, anim: 'sit' });
        expect(body(sit, s.t, 'Drill')).toMatchObject({ anim: 'hit', hits: 0.5, hitsTimer: 29 });
        const hop = byName['drill-hop'];
        const h = gameStop(hop);
        expect(body(hop, 1, 'Drill')).toMatchObject({ x: 136, y: 184 });
        expect(body(hop, h.t, 'Drill')).toMatchObject({ x: 136, y: 184, anim: 'hit', hits: 0.5 });
    });
});

describe('fidelity WANDENEMYBODIES — the walk\'s rooms (L59, L62, L65, L78)', () => {
    const rooms = [['turret-live', 59], ['turret-die', 62], ['turret-l65', 65], ['lavatrap-live', 78]];

    it.each(rooms)('%s (L%i): OFF refuses; the key alone still refuses on wave 67\'s trap body only; both keys get past it', (name) => {
        const tape = tapeOf(name);
        expect(playTo(tape, { [KEY]: false, [TRAP]: false }).error).toContain(OFF_REFUSAL[name]);
        const alone = playTo(tape, { [KEY]: true, [TRAP]: false }).error;
        expect(alone).toMatch(/would collide with 1 Enemy-typed bod\(ies\) this run cannot place: (grenade|darktrap)@\d+,\d+\./);
        const both = playTo(tape, { [KEY]: true, [TRAP]: true });
        expect(both.error).toBeNull();
        expect(both.run.wandEnemyBodyHits.length).toBeGreaterThan(0);
    });
});

describe('fidelity WANDENEMYBODIES — the census and the gates', () => {
    const census = () => {
        const src = atlasLevelSource();
        const byClass = {};
        for (let n = 0; n < 200; n += 1) {
            let rec;
            try { rec = src(n); } catch { continue; }
            if (!rec) continue;
            const w = buildLevelWorld(rec, {});
            const boxed = new Set([...(w.bossTotems ?? []), ...(w.iceTurrets ?? []), ...(w.spinners ?? [])].map((b) => `${b.x},${b.y}`));
            for (const e of w.pressEnemies ?? []) {
                if (boxed.has(`${e.x},${e.y}`) || isBridgedChaser(e.tag)) continue;
                (byClass[e.as3] ??= []).push(`L${n}`);
            }
        }
        return byClass;
    };

    it('the six classes\' bodies on the extract (the census this key covers): 6 turrets, 9 lavatraps, 7 wallflyers, 5 icetraps, 13 sandtraps, 4 drills', () => {
        const c = census();
        expect(Object.fromEntries(WAND_ENEMY_CLASSES.map((k) => [k, c[k].join(' ')]))).toEqual({
            Turret: 'L29 L29 L29 L59 L62 L65',
            LavaTrap: 'L77 L78 L78 L78 L80 L80 L108 L108 L108',
            WallFlyer: 'L22 L22 L22 L22 L25 L25 L27',
            IceTrap: 'L45 L46 L46 L53 L54',
            SandTrap: 'L6 L6 L6 L6 L8 L8 L16 L16 L36 L36 L36 L36 L36',
            Drill: 'L28 L28 L88 L91',
        });
        // every other class outside the rosters is wave 67's
        expect(Object.keys(c).filter((k) => !WAND_ENEMY_CLASSES.includes(k)).sort()).toEqual(['DarkTrap', 'Grenade']);
    }, 120000);

    it('ON: every census room of the six classes fires (none still refused by class), the trap rooms with wave 67\'s key beside it', () => {
        // a stance per room that REACHES the press (OFF, each refuses there with the room's "cannot place" text)
        const stance = { 6: [32, 16], 8: [64, 80], 16: [0, 32], 22: [32, 80], 25: [16, 48], 27: [160, 48], 28: [48, 96],
            29: [48, 176], 36: [0, 48], 45: [32, 64], 46: [224, 384], 53: [128, 192], 54: [120, 216], 59: [120, 64],
            62: [232, 296], 65: [32, 112], 77: [64, 192], 78: [64, 80], 80: [0, 224], 88: [96, 160], 91: [32, 80], 108: [128, 48] };
        const still = [];
        for (const [n, [x, y]] of Object.entries(stance)) {
            const r = playTo(tapeOf('turret-live', { boot: { level: Number(n), x, y }, tick_count: 12, inputs: [{ key: 'primary', from: 4, to: 5 }] }),
                { [KEY]: true, [TRAP]: true });
            if (r.error && /cannot place/.test(r.error)) still.push(`L${n}: ${r.error.match(/cannot place: ([^.]*)\./)[1]}`);
            // the press was reached (the assertion runs at it): a stance that threw earlier would prove nothing
            else expect(r.run.wandShots.length, `L${n}: ${r.error}`).toBe(1);
        }
        expect(still).toEqual([]);
    }, 120000);

    it('ON under `noDamage`: no body is stepped for the shot, so the room still refuses by name (the chasers\' gate)', () => {
        expect(playTo(tapeOf('turret-live', { noDamage: true }), { [KEY]: true, [TRAP]: true }).error)
            .toContain(cannot(59, ['grenade@112,112', 'turret@152,64']));
    });

    it('ON with `STATIC_SWORD_ARM` OFF: a turret has no damage row, so it stays refused (the lavatraps do not)', () => {
        const r = withStaticSwordArm(false, () => playTo(tapeOf('turret-live'), { [KEY]: true, [TRAP]: true }));
        expect(r.error).toContain(cannot(59, ['turret@152,64']));
        expect(withStaticSwordArm(false, () => playTo(tapeOf('lavatrap-live'), { [KEY]: true, [TRAP]: true })).error).toBeNull();
    });

    it('ON with `drillLive` OFF: the drill is not stepped, so it stays refused', () => {
        expect(playTo(tapeOf('drill-sit'), { [KEY]: true, drillLive: false }).error).toContain(cannot(88, ['drill@128,160']));
    });

    it('ON: a hit that KILLS refuses by name (the sixth landed plain-wand hit on L59\'s turret: `dieEffects("Wand")`\'s Explosion)', () => {
        const presses = [4, 35, 66, 97, 128, 159].map((p) => ({ key: 'primary', from: p, to: p + 1 }));
        const r = playTo(tapeOf('turret-live', { tick_count: 190, inputs: [{ key: 'right', from: 0, to: 1 }, ...presses] }),
            { [KEY]: true, [TRAP]: true });
        expect(r.error).toMatch(/a wand shot \(wand@59#159\) KILLS turret@152,64 at tick \d+ in level 59 \(hits 3 reach hitsMax\): `Turret\.startDeath` calls `dieEffects\("Wand"\)`.*Refused by name \(WANDENEMYBODIES\)\./);
        expect(r.run.wandEnemyBodyHits.map((h) => h.hits)).toEqual([0.5, 1, 1.5, 2, 2.5]);
    });

    it('ON: a shot box over two "Enemy" bodies on one step refuses by name (the type-list order is not held)', () => {
        const src = atlasLevelSource();
        // a second icetrap 8 px above L53's: the shot's row (y 199..201) crosses both boxes
        const two = (n) => {
            const r = src(n);
            if (n !== 53) return r;
            return { ...r, entities: [...r.entities, { ...r.entities.find((e) => e.type === 'icetrap'), y: 184 }] };
        };
        const r = playTo(tapeOf('icetrap-live'), { [KEY]: true }, two);
        expect(r.error).toMatch(/overlaps 2 "Enemy" bodies on the same step \[icetrap@160,192, icetrap@160,184\]|overlaps 2 "Enemy" bodies on the same step \[icetrap@160,184, icetrap@160,192\]/);
    });
});

describe('fidelity WANDENEMYBODIES — composition', () => {
    it.each([['turret-iframes'], ['lavatrap-iframes'], ['wallflyer-flight'], ['drill-hop'], ['turret-die'], ['sandtrap-removed']])(
        '%s is still the game with the base\'s last eight OFF keys ON', async (name) => {
            const w = byName[name];
            const over = Object.fromEntries([...LAST_EIGHT, KEY].map((k) => [k, true]));
            const m = await modelWandEnemySamples(parseTape(JSON.stringify(w.tape)), over);
            expect(m.error).toBeNull();
            expect(w.samples.flatMap((s) => compareSample(s.t, s, m.col[s.t]))).toEqual([]);
        }, 120000,
    );

    it.each([['icetrap-live'], ['sandtrap-live'], ['drill-sit'], ['wallflyer-flight']])(
        '%s is still the game with `wandShotTrapBodies` ON beside the key', async (name) => {
            const w = byName[name];
            const m = await modelWandEnemySamples(parseTape(JSON.stringify(w.tape)), { [KEY]: true, [TRAP]: true });
            expect(m.error).toBeNull();
            expect(w.samples.flatMap((s) => compareSample(s.t, s, m.col[s.t]))).toEqual([]);
        }, 120000,
    );
});
