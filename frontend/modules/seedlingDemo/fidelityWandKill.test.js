/**
 * ⛓ SEEDLING FIDELITY WANDKILL (wave 71) — `wandShotKill`: the plain wand's SIXTH landed hit (`damage` 0.5 against
 * `hitsMax` 3, each after the last one's 30 i-frames) kills with the class's own death, and `dieEffects("Wand")`'s
 * Explosion is drained in `updateLists()` with its player and its "Enemy" arm — wave 68's residue.
 *
 * Rows:
 *   - the key: default OFF, last, its env name in the solver's table; it REQUIRES `wandShotEnemyBodies` (alone it
 *     reaches nothing: the room refuses with the shipped text);
 *   - the game witnesses (`fixtures/wandkill-witness/*.json`, recorded by `probe-seedling-wandkill.mjs` on p4g): ON is
 *     the game at every sampled tick (the player and its `hits`/`hits_timer`, every shot, every body of the six classes
 *     — `hits`, `hitsTimer`, the "die" anim, `destroy`, the removal — and every TurretSpit), and the persistence the
 *     game cleared is the model's; OFF (the key alone OFF) is wave 68's kill refusal, word for word;
 *   - the numbers each measures (the kill tick, the "die" span, `destroy`, the removal, the tag, the Explosion's point
 *     and radius, the player outside it);
 *   - the census: no two bodies a wand can kill within a disc of each other on the extract; the second-body refusal
 *     (a staged neighbour inside the disc); the player's stance (no stance beside a body puts the player in the
 *     square at the kill);
 *   - composition: with `wandShotTrapBodies` and the base's last eight OFF keys ON beside both wand keys.
 * Every committed tape ON vs OFF is the slow half (`fidelityWandKill.slow.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { withWandVerb } from './wandVerb.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    WAND_KILL_TAPES, compareKillSample, modelWandKillSamples, wandKillSwitches, wandKillTape,
} from '../../../scripts/procgen/probe-seedling-wandkill.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = 'wandShotKill';
const BODIES = 'wandShotEnemyBodies';
const TRAP = 'wandShotTrapBodies';
const DIR = join(HERE, 'fixtures', 'wandkill-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
const byName = Object.fromEntries(WITNESSES.map((w) => [w.name, w]));
/** The base's last eight OFF keys before the two wand keys (wave 67's list, `wandShotTrapBodies` its last). */
const LAST_SIX = ['plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter',
    'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton'];

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
const tapeOf = (name, patch = {}) => parseTape(JSON.stringify({ ...wandKillTape(name), ...patch }));
/** The game's body of class `cls` at tick `t`. */
const body = (w, t, cls) => w.samples.find((s) => s.t === t)?.bodies.find((b) => b.cls === cls) ?? null;
/** The kill's game timeline for the witness's one killed body: the kill, the "die" span, `destroy`, the removal. */
const timeline = (w) => {
    let kill = null; let dieEnd = null; let destroyAt = null; let gone = null; let at = null;
    for (const s of w.samples) {
        const b = at ? s.bodies.find((x) => x.x === at[0] && x.y === at[1]) : s.bodies.find((x) => x.hits >= 3);
        if (!at && b) { kill = s.t; at = [b.x, b.y]; }
        if (at && b?.anim === 'die') dieEnd = s.t;
        if (at && b?.destroy && destroyAt === null) destroyAt = s.t;
        if (at && !b && gone === null) gone = s.t;
    }
    return { kill, at, dieEnd, destroyAt, gone };
};

describe('fidelity WANDKILL — the key', () => {
    it('ships OFF, is the last key, and its env name is in the solver\'s table (sorted, unique)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        expect(CONTACT_FIDELITY_KEYS.at(-1)).toBe(KEY);
        // ⛓ stacked after wave 69 (DEADFRAME2) and wave 70 (WANDSWINGDRILL), which follow BODIES.
        expect(CONTACT_FIDELITY_KEYS.slice(CONTACT_FIDELITY_KEYS.indexOf(BODIES) + 1)).toEqual(['freezeFramesStepResponders', 'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame', 'itemPressHeldBySlash', 'drillSightLineGame', KEY]);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WAND_SHOT_KILL');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
    });

    it('REQUIRES `wandShotEnemyBodies`: ON alone it reaches nothing — the press is refused with the shipped text', () => {
        const off = playTo(tapeOf('turret-kill'), { [KEY]: false, [BODIES]: false, [TRAP]: true });
        const alone = playTo(tapeOf('turret-kill'), { [KEY]: true, [BODIES]: false, [TRAP]: true });
        expect(off.error).toContain('a WandShot in level 59 would collide with 1 Enemy-typed bod(ies) this run cannot '
            + 'place: turret@152,64.');
        expect(alone.error).toBe(off.error);
        expect(alone.run.wandKills).toEqual([]);
    });

    it('every witness the probe names is recorded, on p4g, on the delivered vanilla set, with the probe\'s tape', () => {
        expect(WITNESSES.map((w) => w.name).sort()).toEqual(Object.keys(WAND_KILL_TAPES).sort());
        for (const w of WITNESSES) {
            expect(w.page, w.name).toBe('seedling_bot_ap_p4g');
            expect(w.delivered_set, w.name).toMatch(/^seedling-vanilla-record-/);
            expect(w.tape, w.name).toEqual(wandKillTape(w.name));
        }
    });
});

describe.each(WITNESSES.map((w) => [w.name, w]))('fidelity WANDKILL — the game witness %s', (name, w) => {
    const tape = parseTape(JSON.stringify(w.tape));

    it('ON: the model is the game at every sampled tick, and the persistence it cleared is the game\'s', async () => {
        const m = await modelWandKillSamples(tape, wandKillSwitches(name));
        expect(m.error).toBeNull();
        expect(w.samples.flatMap((s) => compareKillSample(s.t, s, m.col[s.t]))).toEqual([]);
        const game = (w.persistenceCleared ?? []).map((c) => `${c.level}:${c.tag}`).sort();
        const model = m.final.staticDeaths.filter((d) => d.write !== null).map((d) => `${d.level}:${d.tag}`).sort();
        expect(model).toEqual(game);
    }, 120000);

    it('OFF: the kill is wave 68\'s refusal, word for word (the IceTrap: nothing to refuse, ON = OFF)', () => {
        const off = playTo(tape, { ...wandKillSwitches(name), [KEY]: false });
        if (name === 'icetrap-six') {
            expect(off.error).toBeNull();
            expect(off.run.wandEnemyBodyHits.map((h) => h.hits)).toEqual([0, 0, 0, 0, 0, 0]);
            return;
        }
        expect(off.error).toMatch(/levelRun: a wand shot \(wand@\d+#164\) KILLS \S+ at tick \d+ in level \d+ \(hits 3 reach hitsMax\): .*Refused by name \(WANDENEMYBODIES\)\.$/);
        expect(off.run.wandKills).toEqual([]);
    });
});

describe('fidelity WANDKILL — what each witness measures (the game\'s numbers)', () => {
    it('TURRET (L59, L65): six shots 32 apart land at 15, 47, …, 175; the sixth kills ("die" 175–192), `destroy` at 193, removed by 204', () => {
        for (const name of ['turret-kill', 'turret-kill-l65']) {
            const w = byName[name];
            expect(timeline(w), name).toMatchObject({ kill: 175, dieEnd: 192, destroyAt: 193, gone: 204 });
            expect(body(w, 174, 'Turret').hits, name).toBe(2.5);
            expect(body(w, 175, 'Turret'), name).toMatchObject({ hits: 3, hitsTimer: 29, anim: 'die' });
            expect(w.hits, name).toBe(0);
        }
        // the kill holds the barrel: no spit after the kill
        expect(byName['turret-kill'].samples.filter((s) => s.t >= 175).every((s) => s.spits.length === 0)).toBe(true);
    });

    it('SANDTRAP (L16, L36): the kill at 174 ("die" to 191), removed at 192, and `removed()` clears its tag ({16,2}, {36,5})', () => {
        expect(timeline(byName['sandtrap-kill'])).toMatchObject({ kill: 174, dieEnd: 191, destroyAt: null, gone: 192 });
        expect(byName['sandtrap-kill'].persistenceCleared).toEqual([{ tag: 2, level: 16 }]);
        expect(timeline(byName['sandtrap-kill-l36'])).toMatchObject({ kill: 174, dieEnd: 191, gone: 192 });
        expect(byName['sandtrap-kill-l36'].persistenceCleared).toEqual([{ tag: 5, level: 36 }]);
    });

    it('LAVATRAP (L108): the kill at 178 ("die" to 195, no `destroy`), removed at 196; no Explosion, no tag', () => {
        const w = byName['lavatrap-kill'];
        expect(timeline(w)).toMatchObject({ kill: 178, at: [136, 184], dieEnd: 195, destroyAt: null, gone: 196 });
        expect(w.persistenceCleared).toEqual([]);
        expect(w.hits).toBe(0);
    });

    it('WALLFLYER (L27, L22): "die" from the kill for 12 updates, `destroy`, removed 11 updates later', () => {
        expect(timeline(byName['wallflyer-kill'])).toMatchObject({ kill: 175, at: [201, 56], dieEnd: 186, destroyAt: 187, gone: 198 });
        expect(timeline(byName['wallflyer-kill-l22'])).toMatchObject({ kill: 178, at: [137, 88], dieEnd: 189, destroyAt: 190, gone: 201 });
    });

    it('DRILL (L88): the kill at 185 ("die" to 202), `destroy` at 203, removed by 214', () => {
        expect(timeline(byName['drill-kill'])).toMatchObject({ kill: 185, at: [136, 168], dieEnd: 202, destroyAt: 203, gone: 214 });
    });

    it('ICETRAP (L46): six shots stop at (186, 336) and the trap takes nothing (`canHit = false`): it never dies', () => {
        const w = byName['icetrap-six'];
        expect(w.samples.every((s) => s.bodies.filter((b) => b.cls === 'IceTrap').every((b) => b.hits === 0 && b.hitsTimer === 0))).toBe(true);
        expect(w.samples.at(-1).bodies.filter((b) => b.cls === 'IceTrap').length).toBe(2);
    });

    it('the Explosion (model): at the body\'s int point, radius int(max(w, h) × 0.65) — 10, 10, 9, 6 — and the player outside it in every witness', async () => {
        const radius = {};
        for (const name of ['turret-kill', 'sandtrap-kill', 'wallflyer-kill', 'drill-kill', 'lavatrap-kill']) {
            const m = await modelWandKillSamples(parseTape(JSON.stringify(byName[name].tape)), wandKillSwitches(name));
            const k = m.final.kills;
            expect(k.length, name).toBe(1);
            radius[name] = k[0].blast?.radius ?? null;
            for (const b of m.final.blasts) expect([b.inSquare, b.hitPlayer], name).toEqual([false, false]);
            if (k[0].blast) expect([k[0].blast.x, k[0].blast.y], name).toEqual(timeline(byName[name]).at);
        }
        expect(radius).toEqual({ 'turret-kill': 10, 'sandtrap-kill': 10, 'wallflyer-kill': 9, 'drill-kill': 6, 'lavatrap-kill': null });
    }, 120000);
});

describe('fidelity WANDKILL — the census, the second body and the player', () => {
    const src = atlasLevelSource();
    const R = { Turret: 10, SandTrap: 10, WallFlyer: 9, Drill: 6 };

    it('no census body sits inside the disc of a body a wand can kill (the nearest is 16 px off: L16, L25, L36, L53)', () => {
        let nearest = Infinity;
        const inside = [];
        for (let n = 0; n < 200; n += 1) {
            let rec;
            try { rec = src(n); } catch { continue; }
            if (!rec) continue;
            const en = buildLevelWorld(rec, {}).pressEnemies ?? [];
            for (const a of en.filter((e) => R[e.as3])) {
                for (const b of en) {
                    if (a === b) continue;
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    nearest = Math.min(nearest, d);
                    if (d <= R[a.as3]) inside.push(`L${n}: ${a.tag}@${a.x},${a.y} ~ ${b.tag}@${b.x},${b.y}`);
                }
            }
        }
        expect(inside).toEqual([]);
        expect(nearest).toBe(16);
    }, 120000);

    it('L36: three neighbours\' boxes meet the prefilter square of sandtrap@64,80\'s Explosion, every origin 16 px off — the disc decides, none is hit (the witness)', () => {
        const en = buildLevelWorld(src(36), {}).pressEnemies.filter((e) => e.as3 === 'SandTrap');
        const [cx, cy] = [72, 88];
        const sq = { x: cx - 10, y: cy - 10, right: cx + 10, bottom: cy + 10 };
        const inSquare = en.filter((e) => `${e.x},${e.y}` !== '64,80'
            && e.x < sq.right && sq.x < e.x + 16 && e.y < sq.bottom && sq.y < e.y + 16);
        expect(inSquare.map((e) => `${e.x},${e.y}`).sort()).toEqual(['48,80', '64,64', '80,80']);
        expect(inSquare.map((e) => Math.hypot(e.x + 8 - cx, e.y + 8 - cy))).toEqual([16, 16, 16]);
    });

    it('a SECOND body inside the disc is refused by name (a neighbour staged 8 px W of L16\'s sandtrap@48,32)', () => {
        const two = (n) => {
            const r = src(n);
            if (n !== 16) return r;
            const t = r.entities.find((e) => e.type === 'sandtrap' && e.x === 48 && e.y === 32);
            return { ...r, entities: [...r.entities, { ...t, x: 40, y: 32 }] };
        };
        const r = playTo(tapeOf('sandtrap-kill'), wandKillSwitches('sandtrap-kill'), two);
        expect(r.error).toMatch(/the Explosion of the wand kill of sandtrap@48,32 at \(56, 40\) r 10 on tick 174 in level 16 reaches sandtrap@40,32 — a second body's `Enemy\.hit\(4, p, 1\)`.*Refused by name \(WANDKILL\)\./);
    });

    it('the player beside a body: the closest stances that still kill leave the player outside the square (a closer one takes the body\'s contact and misses)', async () => {
        const seen = [];
        for (const [name, x, y, face] of [['turret-kill', 136, 64, 'right'], ['sandtrap-kill-l36', 64, 104, 'up'],
            ['drill-kill', 104, 160, 'right'], ['wallflyer-kill-l22', 128, 56, 'down']]) {
            const t = wandKillTape(name);
            t.boot = { ...t.boot, x, y };
            t.inputs[0].key = face;
            const m = await modelWandKillSamples(parseTape(JSON.stringify(t)), wandKillSwitches(name));
            expect(m.error, name).toBeNull();
            seen.push(...(m.final?.blasts ?? []).map((b) => [name, b.inSquare, b.hitPlayer]));
        }
        expect(seen).toEqual([['turret-kill', false, false], ['sandtrap-kill-l36', false, false],
            ['drill-kill', false, false], ['wallflyer-kill-l22', false, false]]);
    }, 120000);
});

describe('fidelity WANDKILL — composition', () => {
    it.each([['turret-kill'], ['sandtrap-kill-l36'], ['lavatrap-kill'], ['wallflyer-kill-l22'], ['drill-kill']])(
        '%s is still the game with both wand keys, `wandShotTrapBodies` and the base\'s last OFF keys ON', async (name) => {
            const w = byName[name];
            const over = Object.fromEntries([...LAST_SIX, TRAP, BODIES, KEY].map((k) => [k, true]));
            const m = await modelWandKillSamples(parseTape(JSON.stringify(w.tape)), over);
            expect(m.error).toBeNull();
            expect(w.samples.flatMap((s) => compareKillSample(s.t, s, m.col[s.t]))).toEqual([]);
        }, 120000,
    );
});
