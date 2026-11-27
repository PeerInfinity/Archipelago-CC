/**
 * ⛓ SEEDLING FIDELITY WANDTRAPBODIES (wave 67) — `wandShotTrapBodies`: a WandShot stops on a live darktrap or a
 * collidable placed grenade, and a room holding one may fire (re-measure-10's entry-37 wall, L63).
 *
 * Rows:
 *   - the key: default OFF, last, its env name in the solver's table;
 *   - the game witnesses (`fixtures/wandtrapbodies-witness/*.json`, recorded by `probe-seedling-wandtrapbodies.mjs`
 *     on p4g): ON is the game at every sampled tick (player, every shot, darktrap and grenade); OFF refuses the press
 *     with the shipped text; the stop tick and point of each;
 *   - the census: the classes a shot still cannot place, by name, and the trap bodies the key covers;
 *   - the gates: `noDamage` still refuses; a darktrap inside a grenade's blast light refuses by name;
 *   - the captured entry-37 requests (re-measure-10): 37:7 here; 37:8 (a 2560 solve, ~50 s) is the slow half;
 *   - a composition row with the base's last seven OFF keys ON.
 * Every committed tape ON vs OFF, and 37:8 OFF vs ON, are the slow half (`fidelityWandTrapBodies.slow.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { isBridgedChaser } from './chasers.js';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    WAND_TRAP_TAPES, compareSample, modelWandTrapSamples, wandTrapTape,
} from '../../../scripts/procgen/probe-seedling-wandtrapbodies.mjs';
import { replayOnce } from '../../../scripts/procgen/replay-seedling-solve-request.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = 'wandShotTrapBodies';
const DIR = join(HERE, 'fixtures', 'wandtrapbodies-witness');
const EVIDENCE = join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports', 'seedling-whole-game-wasm-remeasure-10-evidence');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
const byName = Object.fromEntries(WITNESSES.map((w) => [w.name, w]));
const L63_REFUSAL = 'a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, '
    + 'darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272.';
/** The base's last seven keys, all OFF (wave 66's tip). */
const LAST_SEVEN = ['plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter',
    'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton'];

/** The game's first sample with the shot playing "die" — the stop tick and point. */
const gameStop = (w) => {
    const s = w.samples.find((x) => x.shots.some((y) => y.anim === 'die'));
    return s ? { t: s.t, x: s.shots[0].x, y: s.shots[0].y } : null;
};
/** The game's last sample with a shot in flight ("flare"). */
const lastFlare = (w) => w.samples.filter((x) => x.shots.some((y) => y.anim === 'flare')).at(-1);

/** Run a tape to its end (or its throw) under `over`. */
const playTo = (tape, over, levelSource = atlasLevelSource()) => withContactFidelity(over, () => {
    const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, levelSource);
    try {
        for (let i = 0; i < tape.tick_count; i += 1) {
            run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
        }
        return { run, error: null };
    } catch (e) {
        return { run, error: e.message };
    }
});

describe('fidelity WANDTRAPBODIES — the key', () => {
    it('ships OFF, is the last key, and its env name is in the solver\'s table', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        expect(CONTACT_FIDELITY_KEYS.slice(CONTACT_FIDELITY_KEYS.indexOf(KEY) + 1)).toEqual(['wandShotEnemyBodies']); // ⛓ wave 68: WANDENEMYBODIES
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WAND_SHOT_TRAP_BODIES');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
    });

    it('every witness the probe names is recorded, on p4g, on the delivered vanilla set', () => {
        expect(WITNESSES.map((w) => w.name).sort()).toEqual(Object.keys(WAND_TRAP_TAPES).sort());
        for (const w of WITNESSES) {
            expect(w.page, w.name).toBe('seedling_bot_ap_p4g');
            expect(w.delivered_set, w.name).toMatch(/^seedling-vanilla-record-/);
            // The recording embeds the probe's tape today (a drifted tape is not this witness).
            expect(w.tape, w.name).toEqual(wandTrapTape(w.name));
        }
    });
});

describe.each(WITNESSES.map((w) => [w.name, w]))('fidelity WANDTRAPBODIES — the game witness %s', (name, w) => {
    const tape = parseTape(JSON.stringify(w.tape));

    it('ON: the model is the game at every sampled tick (player, every shot, darktrap and grenade)', async () => {
        const m = await modelWandTrapSamples(tape, { [KEY]: true });
        expect(m.error).toBeNull();
        const dis = w.samples.flatMap((s) => compareSample(s.t, s, m.col[s.t]));
        expect(dis).toEqual([]);
        expect(w.samples.filter((s) => s.shots.length > 0).length).toBeGreaterThan(0);
    }, 120000);

    it('OFF: the press is refused with the shipped text', () => {
        const r = playTo(tape, { [KEY]: false });
        if (tape.boot.level === 63) expect(r.error).toContain(L63_REFUSAL);
        else expect(r.error).toContain('a WandShot in level 75 would collide with 1 Enemy-typed bod(ies) this run cannot place: grenade@72,168.');
    });
});

describe('fidelity WANDTRAPBODIES — what each witness measures (the game\'s numbers)', () => {
    it('(a) a live darktrap: the shot stops at (63, 112) on tick 17, the trap lives on', () => {
        const w = byName['a-live'];
        expect(gameStop(w)).toEqual({ t: 17, x: 63, y: 112 });
        expect(w.samples.at(-1).traps.some((b) => b.x === 72 && b.y === 104 && b.anim !== 'die1')).toBe(true);
    });

    it('(b) a dying darktrap is a body through its counter and "die1", to its removal tick; one tick later it is not', () => {
        expect(gameStop(byName['b-counter'])).toEqual({ t: 17, x: 63, y: 112 });
        const d = byName['b-die1'];
        expect(gameStop(d)).toEqual({ t: 47, x: 63, y: 112 });
        expect(d.samples.find((s) => s.t === 47).traps.find((b) => b.x === 72 && b.y === 104).anim).toBe('die1');
        // The trap is removed at the end of tick 73; the shot updates first, so on tick 73 it still meets it.
        const edge = byName['b-removal-edge'];
        expect(gameStop(edge)).toEqual({ t: 73, x: 63, y: 112 });
        const gone = byName['b-removed'];
        expect(gone.samples.find((s) => s.t === 74).traps.some((b) => b.x === 72 && b.y === 104)).toBe(false);
        // One tick later: no body; it flies on into the wall at x 79.
        expect(gameStop(gone)).toEqual({ t: 80, x: 79, y: 112 });
    });

    it('(c) a DORMANT grenade (L75, never armed) is collidable from its ctor: the shot stops at (76, 128) on tick 16', () => {
        const w = byName['c-dormant'];
        expect(gameStop(w)).toEqual({ t: 16, x: 76, y: 128 });
        expect(w.samples.find((s) => s.t === 16).grenades).toEqual([{ x: 80, y: 128, anim: 'sit' }]);
    });

    it('(d) a FALLING or BOUNCING grenade is not collidable: the shot crosses its box and flies on to the wall', () => {
        for (const [name, crossing] of [['d-fall', 30], ['d-bounce', 71]]) {
            const w = byName[name];
            const s = w.samples.find((x) => x.t === crossing);
            const g = s.grenades[0];
            const shot = s.shots[0];
            // The shot's box (3 x 3, origin 2) overlaps the grenade's (6 x 6, origin 3) on the crossing tick …
            expect(Math.abs(shot.x - g.x) < 4.5 && Math.abs(shot.y - g.y) < 4.5, name).toBe(true);
            expect(shot.anim, name).toBe('flare');
            // … and it dies on the wall at x 159, not on the grenade.
            expect(gameStop(w).x, name).toBe(159);
        }
    });

    it('(d) a RESTING grenade, and one in "explode" or "hit", stops the shot at (132, 136); after its removal it does not', () => {
        for (const [name, t, anim] of [['d-rest', 99, 'sit'], ['d-explode', 139, 'explode'], ['d-hit', 159, 'hit'], ['d-removal-edge', 163, 'hit']]) {
            const w = byName[name];
            expect(gameStop(w), name).toEqual({ t, x: 132, y: 136 });
            const g = w.samples.find((s) => s.t === t - 1)?.grenades[0];
            if (g) expect(g.anim, name).toBe(anim);
        }
        const gone = byName['d-removed'];
        expect(gone.samples.find((s) => s.t === 164).grenades).toEqual([]);
        expect(gameStop(gone)).toEqual({ t: 173, x: 159, y: 136 });
        expect(lastFlare(gone).shots[0].x).toBeGreaterThan(139);
    });

    it('(e) the entry-37 search\'s shot: from the request\'s boot, facing E, it stops on darktrap@64,96 at (63, 104) on tick 20', () => {
        expect(byName['e-route'].tape.boot).toEqual({ level: 63, x: 16, y: 96 });
        expect(gameStop(byName['e-route'])).toEqual({ t: 20, x: 63, y: 104 });
    });

    it('no witness takes a hit but the L75 one (a lavarunner, not the grenade)', () => {
        for (const w of WITNESSES) expect(w.hits, w.name).toBe(w.name === 'c-dormant' ? 1 : 0);
    });
});

describe('fidelity WANDTRAPBODIES — the census (what a shot still cannot place)', () => {
    // The press census's Enemy-typed bodies outside the totem / ice-turret / spinner rosters and the bridged chasers.
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
                (byClass[e.as3] ??= new Set()).add(n);
            }
        }
        return Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
    };

    it('the key covers DarkTrap and Grenade; Drill, IceTrap, LavaTrap, SandTrap, Turret and WallFlyer stay refused', () => {
        const c = census();
        expect(c.DarkTrap).toEqual([62, 63, 65, 101]);
        expect(c.Grenade).toEqual([59, 63, 75, 78]);
        const residue = Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'DarkTrap' && k !== 'Grenade'));
        expect(residue).toEqual({
            Drill: [28, 88, 91],
            IceTrap: [45, 46, 53, 54],
            LavaTrap: [77, 78, 80, 108],
            SandTrap: [6, 8, 16, 36],
            Turret: [29, 59, 62, 65],
            WallFlyer: [22, 25, 27],
        });
    }, 120000);

    it('a room whose only unplaced bodies are trap bodies fires ON; a residue class still refuses by name (L59: turret)', () => {
        const press = (level, boot) => parseTape(JSON.stringify({ ...wandTrapTape('a-live'), boot, tick_count: 20 }));
        expect(playTo(press(63, { level: 63, x: 24, y: 104 }), { [KEY]: true }).error).toBeNull();
        const r59 = playTo(press(59, { level: 59, x: 32, y: 128 }), { [KEY]: true });
        expect(r59.error).toMatch(/a WandShot in level 59 would collide with 1 Enemy-typed bod\(ies\) this run cannot place: turret@152,64\./);
    });
});

describe('fidelity WANDTRAPBODIES — the gates', () => {
    it('ON under `noDamage`: no body is stepped for the shot, so the room still refuses by name (the chasers\' gate)', () => {
        const tape = parseTape(JSON.stringify({ ...wandTrapTape('a-live'), noDamage: true }));
        // The jellyfish are refused too: under `noDamage` the chasers are not stepped either (L12DOORS D1's gate).
        expect(playTo(tape, { [KEY]: true }).error).toContain('a WandShot in level 63 would collide with 7 Enemy-typed bod(ies) '
            + 'this run cannot place: jellyfish@160,64, jellyfish@192,56, grenade@128,128, darktrap@64,96, darktrap@80,64, '
            + 'darktrap@32,272, darktrap@128,272.');
    });

    it('ON with `darkTrapLight` OFF: the darktraps are not stepped, so they stay refused (the grenade does not)', () => {
        const r = playTo(parseTape(JSON.stringify(wandTrapTape('a-live'))), { [KEY]: true, darkTrapLight: false });
        expect(r.error).toContain('cannot place: darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272.');
    });

    it('ON: a darktrap within a grenade\'s blast light (radiusMin 20) refuses by name (none does on the extract)', () => {
        const src = atlasLevelSource();
        const moved = (n) => {
            const r = src(n);
            if (n !== 63) return r;
            return { ...r, entities: r.entities.map((e) => (e.type === 'grenade' ? { ...e, x: 64, y: 112 } : e)) };
        };
        const r = playTo(parseTape(JSON.stringify(wandTrapTape('a-live'))), { [KEY]: true }, moved);
        expect(r.error).toMatch(/darktrap@64,96 in level 63 stands within 20 px of grenade@64,112's blast light/);
    });
});

describe('fidelity WANDTRAPBODIES — the captured entry-37 requests (re-measure-10, `9c5ba5c37277`)', () => {
    const load = (file, id, i) => {
        const legs = gunzipSync(readFileSync(join(EVIDENCE, file))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
        return legs.find((l) => l.id === id).requests.find((r) => r.i === i).request;
    };

    it('S1 37:7 (the 640 cut): the same deadline cut either way — the cut lands before any wand press', async () => {
        const req = load('S1.stop-requests-32-33-37.jsonl.gz', 37, 7);
        const on = await withContactFidelity({ [KEY]: true }, () => replayOnce(req));
        expect(on.answer).toBe('2e192645c34b');
    }, 300000);
});

describe('fidelity WANDTRAPBODIES — composition with the base\'s last seven OFF keys ON', () => {
    it.each([['a-live'], ['b-removed'], ['d-fall'], ['d-rest']])('%s is still the game', async (name) => {
        const w = byName[name];
        const over = Object.fromEntries([...LAST_SEVEN, KEY].map((k) => [k, true]));
        const m = await modelWandTrapSamples(parseTape(JSON.stringify(w.tape)), over);
        expect(m.error).toBeNull();
        expect(w.samples.flatMap((s) => compareSample(s.t, s, m.col[s.t]))).toEqual([]);
    }, 120000);
});
