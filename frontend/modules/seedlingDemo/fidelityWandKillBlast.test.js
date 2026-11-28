/**
 * ⛓ SEEDLING FIDELITY WANDKILLBLAST (wave 73) — the wand kill's Explosion, its two halves wave 71 could not witness:
 *   (b) the PLAYER half (`Player.hit(null, 4, p, 1)`, `wandShotKill`'s own arm): witnessed with NO code change — the
 *       player walks into the disc on the kill tick, when the dying body's contact is gated by its "die";
 *   (c) the SECOND-BODY half (`Enemy.hit(4, p, 1)`): `wandKillBlastBodies` (OFF; needs `wandShotKill`) replaces wave
 *       71's refusal by name with each witnessed class's own hit.
 *
 * Rows:
 *   - the key: default OFF, last, its env name in the solver's table; it REQUIRES `wandShotKill`;
 *   - the game witnesses (`fixtures/wandkillblast-witness/*.json`, recorded by `probe-seedling-wandkillblast.mjs` on
 *     p4g, the neighbours STAGED through `botLoadLevels`): the model is the game at every sampled tick (the player and
 *     its `hits`/`hits_timer`, every shot, every wand-class body's `hits`/`hitsTimer`/anim and removal, every spit);
 *     OFF, a staged second body is wave 71's refusal, word for word;
 *   - the numbers each measures (the blast's tick, the player's hit and knockback, a neighbour's hit, the blast kill
 *     and its removal, no chain);
 *   - the refusals that stay (a chaser in the disc, a Turret the blast would kill);
 *   - composition: every queued fidelity key ON beside the wand keys.
 * Every committed tape ON vs OFF is the slow half (`fidelityWandKillBlast.slow.test.js`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { withWandVerb } from './wandVerb.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { compareKillSample, modelWandKillSamples } from '../../../scripts/procgen/probe-seedling-wandkill.mjs';
import {
    WAND_KILL_BLAST_SHAPES, wandKillBlastLevelSource, wandKillBlastSwitches, wandKillBlastTape,
} from '../../../scripts/procgen/probe-seedling-wandkillblast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = 'wandKillBlastBodies';
const KILL = 'wandShotKill';
const DIR = join(HERE, 'fixtures', 'wandkillblast-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
const byName = Object.fromEntries(WITNESSES.map((w) => [w.name, w]));
/** Every queued fidelity key past main (W63 → W71's, all OFF at this base). */
const QUEUED = ['publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep',
    'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies', 'freezeFramesStepResponders',
    'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame', 'itemPressHeldBySlash', 'drillSightLineGame',
    'wandShotKill'];

/** Run a shape's tape to its end (or its throw) under `over`, on the shape's own level source. */
const playShape = async (name, over, patchStage = null) => {
    const src = await wandKillBlastLevelSource(name);
    const levelSource = patchStage ? (n) => patchStage(n, src(n)) : src;
    const tape = parseTape(JSON.stringify(wandKillBlastTape(name)));
    return withWandVerb(true, () => withContactFidelity(over, () => {
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
};
const modelOf = async (name, over) => modelWandKillSamples(parseTape(JSON.stringify(byName[name].tape)), over,
    { levelSource: await wandKillBlastLevelSource(name) });
const sample = (w, t) => w.samples.find((s) => s.t === t) ?? null;
const bodyAt = (s, cls, x, y) => s?.bodies.find((b) => b.cls === cls && b.x === x && b.y === y) ?? null;
const firstHit = (w) => w.samples.find((s) => (s.hits ?? 0) > 0) ?? null;
const SECOND = ['second-turret', 'second-sandtrap', 'second-lavatrap', 'second-drill', 'wallflyer-rest', 'chain-sandtrap'];

describe('fidelity WANDKILLBLAST — the key', () => {
    it('ships OFF, is the last key (after `wandShotKill`), and its env name is in the solver\'s table (sorted, unique)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        expect(CONTACT_FIDELITY_KEYS.at(-1)).toBe(KEY);
        expect(CONTACT_FIDELITY_KEYS.at(-2)).toBe(KILL);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_WAND_KILL_BLAST_BODIES');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
    });

    it('REQUIRES `wandShotKill`: ON alone it reaches nothing — the sixth shot is refused with wave 68\'s kill text', async () => {
        const off = await playShape('second-turret', { ...wandKillBlastSwitches('second-turret'), [KEY]: false, [KILL]: false });
        const alone = await playShape('second-turret', { ...wandKillBlastSwitches('second-turret'), [KEY]: true, [KILL]: false });
        expect(off.error).toMatch(/levelRun: a wand shot \(wand@\d+#164\) KILLS turret@80,176 at tick \d+ in level 29 \(hits 3 reach hitsMax\): .*Refused by name \(WANDENEMYBODIES\)\.$/);
        expect(alone.error).toBe(off.error);
        expect(alone.run.wandKillBlastBodyHits).toEqual([]);
    });

    it('every shape the probe names is recorded, on p4g, on its own staged set, with the probe\'s tape and stage', () => {
        expect(WITNESSES.map((w) => w.name).sort()).toEqual(Object.keys(WAND_KILL_BLAST_SHAPES).sort());
        for (const w of WITNESSES) {
            const shape = WAND_KILL_BLAST_SHAPES[w.name];
            expect(w.page, w.name).toBe('seedling_bot_ap_p4g');
            expect(w.delivered_set, w.name).toMatch(/^seedling-vanilla-record-/);
            expect(w.set_id, w.name).toBe(shape.stage ? `${w.delivered_set}-wkb-${w.name}` : w.delivered_set);
            expect(w.stage, w.name).toEqual(shape.stage);
            expect(w.tape, w.name).toEqual(wandKillBlastTape(w.name));
        }
    });
});

describe.each(WITNESSES.map((w) => [w.name, w]))('fidelity WANDKILLBLAST — the game witness %s', (name, w) => {
    it('ON: the model is the game at every sampled tick', async () => {
        const m = await modelOf(name, wandKillBlastSwitches(name));
        expect(m.error).toBeNull();
        expect(w.samples.flatMap((s) => compareKillSample(s.t, s, m.col[s.t]))).toEqual([]);
        const game = (w.persistenceCleared ?? []).map((c) => `${c.level}:${c.tag}`).sort();
        const model = m.final.staticDeaths.filter((d) => d.write !== null).map((d) => `${d.level}:${d.tag}`).sort();
        expect(model).toEqual(game);
    }, 120000);

    it('OFF (`wandKillBlastBodies` alone OFF): a second body in the disc is wave 71\'s refusal, word for word; else ON = OFF', async () => {
        const off = await playShape(name, { ...wandKillBlastSwitches(name), [KEY]: false });
        if (!SECOND.includes(name)) {
            expect(off.error).toBeNull();
            expect(off.run.wandKillBlastBodyHits).toEqual([]);
            return;
        }
        expect(off.error).toMatch(/^levelRun: the Explosion of the wand kill of \S+ at \(\d+, \d+\) r \d+ on tick \d+ in level \d+ reaches \S+ — a second body's `Enemy\.hit\(4, p, 1\)` \(`Explosion\.as:62-65`\) from a wand kill is not witnessed\. Refused by name \(WANDKILL\)\.$/);
        expect(off.run.wandKillBlastBodyHits).toEqual([]);
    });
});

describe('fidelity WANDKILLBLAST — (b) the player half: what each witness measures (the game\'s numbers)', () => {
    it('blast-above: the sixth shot kills turret@80,176 on t178 with the player at (88, 174.7), 9.3 px from (88, 184) — in the disc', () => {
        const w = byName['blast-above'];
        const s177 = sample(w, 177);
        const s178 = sample(w, 178);
        expect(bodyAt(s177, 'Turret', 88, 184).hits).toBe(2.5);
        expect(bodyAt(s178, 'Turret', 88, 184)).toMatchObject({ hits: 3, anim: 'die' });
        expect(s178.player.x).toBe(88);
        expect(Math.hypot(s178.player.x - 88, s178.player.y - 184)).toBeLessThanOrEqual(10);
        // the box at t177 (the turret's contact on t178 is gated by "die"; on t177 it read t176's position, outside)
        expect(sample(w, 176).player.y + 3).toBeLessThanOrEqual(176);
    });

    it('blast-above: the player takes the Explosion\'s `Player.hit` on the kill tick — hits 0 → 1, `hits_timer` 20 — and is knocked UP (away from the blast)', () => {
        const w = byName['blast-above'];
        expect(firstHit(w)).toMatchObject({ t: 178, hits: 1, hitsTimer: 20 });
        expect(sample(w, 177).hits).toBe(0);
        expect(sample(w, 182).player.y).toBeLessThan(sample(w, 178).player.y);
        expect(w.hits).toBe(1);
    });

    it('blast-below: the same from below (turret@112,240, the player at (120, 257.3)): hit on t178, knocked DOWN', () => {
        const w = byName['blast-below'];
        expect(firstHit(w)).toMatchObject({ t: 178, hits: 1, hitsTimer: 20, player: { x: 120 } });
        expect(Math.hypot(0, firstHit(w).player.y - 248)).toBeLessThanOrEqual(10);
        expect(sample(w, 182).player.y).toBeGreaterThan(sample(w, 178).player.y);
    });

    it('controls: a tick later the player is outside the disc and takes nothing; with no sixth shot the turret\'s CONTACT lands instead', async () => {
        expect(firstHit(byName['blast-above-late'])).toBeNull();
        const noshot = firstHit(byName['blast-above-noshot']);
        expect(noshot).toMatchObject({ t: 178, hits: 1, hitsTimer: 19 });
        const late = (await modelOf('blast-above-late', wandKillBlastSwitches('blast-above-late'))).final.blasts;
        expect(late).toEqual([expect.objectContaining({ t: 178, inSquare: true, hitPlayer: false })]);
    }, 120000);

    it('the model\'s blast hits the player in both (`wandKillBlast`, force 4, damage 1) — the arm wave 71 derived', async () => {
        for (const name of ['blast-above', 'blast-below']) {
            const m = await modelOf(name, wandKillBlastSwitches(name));
            expect(m.final.blasts, name).toEqual([expect.objectContaining({ t: 178, radius: 10, inSquare: true, hitPlayer: true })]);
            expect(m.final.playerHits, name).toBe(1);
        }
    }, 120000);
});

describe('fidelity WANDKILLBLAST — (c) the second body: what each witness measures (the game\'s numbers)', () => {
    it.each([['second-turret', 'Turret'], ['second-sandtrap', 'SandTrap'], ['second-lavatrap', 'LavaTrap'], ['second-drill', 'Drill']])(
        '%s: the %s at (82, 190), 8.5 px from the blast, takes hits 0 → 1 and `hitsTimer` 30 on the kill tick (t173), 29 the next, and does not move',
        (name, cls) => {
            const w = byName[name];
            expect(bodyAt(sample(w, 172), cls, 82, 190)).toMatchObject({ hits: 0, hitsTimer: 0 });
            expect(bodyAt(sample(w, 173), 'Turret', 88, 184)).toMatchObject({ hits: 3, anim: 'die' });
            expect(bodyAt(sample(w, 173), cls, 82, 190)).toMatchObject({ hits: 1, hitsTimer: 30, vx: 0, vy: 0 });
            expect(bodyAt(sample(w, 174), cls, 82, 190)).toMatchObject({ hits: 1, hitsTimer: 29 });
            expect(bodyAt(sample(w, 200), cls, 82, 190)).not.toBeNull();
        },
    );

    it('second-drill: the sitting drill plays "hit" from the tick after the blast', () => {
        const w = byName['second-drill'];
        expect(bodyAt(sample(w, 173), 'Drill', 82, 190).anim).toBe('sit');
        expect(bodyAt(sample(w, 174), 'Drill', 82, 190).anim).toBe('hit');
    });

    it('second-icetrap: an IceTrap in the disc takes nothing (`canHit = false`), ON and OFF', async () => {
        const off = await playShape('second-icetrap', { ...wandKillBlastSwitches('second-icetrap'), [KEY]: false });
        const on = await playShape('second-icetrap', wandKillBlastSwitches('second-icetrap'));
        expect(off.error).toBeNull();
        expect(on.error).toBeNull();
        expect(on.run.wandKillBlastBodyHits).toEqual([]);
    });

    it('wallflyer-rest: a RESTING WallFlyer 1 px from a sandtrap\'s blast takes hits 1, `hitsTimer` 30, and stays at rest (v = -v of 0)', () => {
        const w = byName['wallflyer-rest'];
        expect(bodyAt(sample(w, 173), 'SandTrap', 31, 48)).toMatchObject({ hits: 3, anim: 'die' });
        expect(bodyAt(sample(w, 173), 'WallFlyer', 32, 48)).toMatchObject({ hits: 1, hitsTimer: 30, vx: 0, vy: 0 });
        expect(bodyAt(sample(w, 239), 'WallFlyer', 32, 48)).toMatchObject({ hits: 1 });
    });

    it('chain-sandtrap: the blast KILLS a sandtrap pre-hit to 2 ("die" at t401, hits 3, `hitsTimer` 30), removed a tick after the shot-killed one; tags 25 and 26 cleared', () => {
        const w = byName['chain-sandtrap'];
        expect(bodyAt(sample(w, 400), 'SandTrap', 104, 48)).toMatchObject({ hits: 2 });
        expect(bodyAt(sample(w, 401), 'SandTrap', 97, 55)).toMatchObject({ hits: 3, hitsTimer: 29, anim: 'die' });
        expect(bodyAt(sample(w, 401), 'SandTrap', 104, 48)).toMatchObject({ hits: 3, hitsTimer: 30, anim: 'die' });
        const gone = (x, y) => w.samples.find((s) => s.t > 401 && !bodyAt(s, 'SandTrap', x, y))?.t;
        expect(gone(104, 48)).toBe(gone(97, 55) + 1);
        expect(w.persistenceCleared.map((c) => `${c.level}:${c.tag}`).sort()).toEqual(['38:25', '38:26']);
    });

    it('chain-sandtrap: NO CHAIN — the third sandtrap, 9.9 px from the blast-killed one and 14 px from the first blast, takes nothing', () => {
        const w = byName['chain-sandtrap'];
        for (const s of w.samples) expect(bodyAt(s, 'SandTrap', 111, 55), `t ${s.t}`).toMatchObject({ hits: 0 });
    });

    it('the model ledger: one landed hit per second body, `t` "" (d 1), the kill only in chain-sandtrap', async () => {
        const got = {};
        for (const name of SECOND) {
            const r = await playShape(name, wandKillBlastSwitches(name));
            expect(r.error, name).toBeNull();
            got[name] = r.run.wandKillBlastBodyHits.map((h) => [h.as3, h.landed, h.killed, h.hits, h.hitsTimer]);
        }
        expect(got).toEqual({
            'second-turret': [['Turret', true, false, 1, 30]],
            'second-sandtrap': [['SandTrap', true, false, 1, 30]],
            'second-lavatrap': [['LavaTrap', true, false, 1, 30]],
            'second-drill': [['Drill', true, false, 1, 30]],
            'wallflyer-rest': [['WallFlyer', true, false, 1, 30]],
            'chain-sandtrap': [['SandTrap', true, true, 3, 30]],
        });
    }, 120000);
});

describe('fidelity WANDKILLBLAST — the refusals that stay (unwitnessed)', () => {
    it('a chaser (a Bob staged in the disc) is still wave 71\'s refusal by name, ON', async () => {
        const bob = (n, r) => (n !== 29 ? r : { ...r, entities: [...r.entities, { type: 'bob', x: 74, y: 182 }] });
        const r = await playShape('second-turret', wandKillBlastSwitches('second-turret'), (n, rec) => {
            const out = bob(n, rec);
            return n !== 29 ? out : { ...out, entities: out.entities.filter((e) => !(e.type === 'turret' && e.x === 74)) };
        });
        expect(r.error).toMatch(/reaches bob@74,182 — a second body's `Enemy\.hit\(4, p, 1\)`.*Refused by name \(WANDKILL\)\.$/);
    });

    it('a TURRET the blast would kill is refused by name (WANDKILLBLAST): chain-sandtrap with turrets', async () => {
        const turrets = (n, rec) => (n !== 38 ? rec : { ...rec,
            entities: rec.entities.map((e) => (e.type === 'sandtrap' && e.x === 96 ? { type: 'turret', x: e.x, y: e.y } : e)) });
        const r = await playShape('chain-sandtrap', wandKillBlastSwitches('chain-sandtrap'), turrets);
        expect(r.error).toMatch(/reaches turret@96,40 \(Turret\): the hit KILLS it \(hits 3\): a Turret's death by an Explosion — not witnessed\. Refused by name \(WANDKILLBLAST\)\.$/);
    });
});

describe('fidelity WANDKILLBLAST — composition', () => {
    it.each(Object.keys(WAND_KILL_BLAST_SHAPES).map((n) => [n]))(
        '%s is still the game with every queued fidelity key ON beside the wand keys', async (name) => {
            const w = byName[name];
            const over = { ...Object.fromEntries(QUEUED.map((k) => [k, true])), ...wandKillBlastSwitches(name) };
            const m = await modelOf(name, over);
            expect(m.error).toBeNull();
            expect(w.samples.flatMap((s) => compareKillSample(s.t, s, m.col[s.t]))).toEqual([]);
        }, 120000,
    );
});
