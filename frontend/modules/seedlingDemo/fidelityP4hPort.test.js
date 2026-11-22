/**
 * fidelityP4hPort — **THE MODEL SAYS WHAT p4h DOES** (slice seedling-fidelity-p4hport; rules-12's checklist step 6).
 *
 * p4h (`seedling_bot_ap_p4h`, Seedling `p4h-as3` 0ea17b675a) replaces the nine L57/L112 gameplay draws with
 * `Pattern.vdc` over the bosses' own counters (option A). The model reads the build's capabilities
 * (`modelBuild.js`): on `bossdraws` the Owl's `OwlPatternStream` and the beast's `TentaclePatternStream`, otherwise
 * today's seeded streams, byte for byte.
 *
 * Every pattern value below is checked against the AS3 formula evaluated HERE, independently: a hand-written
 * `vdc` and the constants as cited (`FinalBoss.as:139-141,157,214`, `RockFall.as:33`, `TentacleBeast.as:23,26-27`).
 * ⛔ Nothing here is a game witness: the p4h page judges the plans (`det-owl-*-A.json`) in the planner's local pass.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SeedlingRng } from './rng.js';
import { OWL_DRAW_SITES, OwlDrawStream, OwlPatternStream, owlStreamForBuild } from './finalBossRng.js';
import { createOwlRoom } from './finalBossFight.js';
import {
    TENTACLE_BEAST, TentacleDrawStream, TentaclePatternStream, createTentacleBeastFight, stepTentacleBeast,
} from './tentacleBeast.js';
import { P4G_CAPABILITIES, declaresBossDraws, modelBuildDefault, setModelBuildDefault } from './modelBuild.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity } from './contactFidelity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const P4H_CAPS = MANIFEST.builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities;

// ── the AS3, evaluated independently ────────────────────────────────────
/** `Pattern.vdc(n, b)`, hand-written from `src/Pattern.as` (not imported). */
function vdcRef(n, b) {
    let r = 0;
    let f = 1 / b;
    for (let m = n; m > 0; m = Math.trunc(m / b)) { r += (m % b) * f; f /= b; }
    return r;
}
const RADIUS = 20;          // FinalBoss.as:141
const STEPS_AHEAD = -15;    // FinalBoss.as:140
const ROCK_FREQ = 6;        // FinalBoss.as:139
const GRENADE_FREQ = 40;    // FinalBoss.as:157
const DEATH_N = 5;          // FinalBoss.as:214
const RT_MAX = 240;         // FinalBoss.as:31 rockfallTimeMax
const SPAWN = { x: 16, y: 96, width: 176, height: 96 };    // TentacleBeast.as:23
const T_MARGIN = { x: 8, y: 0, width: 8, height: 4 };      // TentacleBeast.as:26
const W_MARGIN = { x: 16, y: 16, width: 16, height: 16 };  // TentacleBeast.as:27 (Tile.w/h)

describe('the build reaches the model (modelBuild)', () => {
    it('a caller that names no build gets the default build\'s answer, and that is the manifest\'s default row', () => {
        const def = MANIFEST.builds.find((b) => b.role === 'default');
        expect(def.name).toBe('seedling_bot_ap_p4g');
        expect([...P4G_CAPABILITIES]).toEqual(def.capabilities);
        expect(modelBuildDefault()).toBe(P4G_CAPABILITIES);
        expect(declaresBossDraws(null)).toBe(false);
        expect(declaresBossDraws(undefined)).toBe(false);
        expect(declaresBossDraws(P4H_CAPS)).toBe(true);
    });

    it('a measurement can ask "what would p4h say" and restore the default', () => {
        const restore = setModelBuildDefault(P4H_CAPS);
        try { expect(declaresBossDraws(null)).toBe(true); } finally { restore(); }
        expect(declaresBossDraws(null)).toBe(false);
    });

    it('the p4g arm builds today\'s streams; the p4h arm builds the patterns', () => {
        expect(createOwlRoom({ tiles: [], seed: 5 }).stream).toBeInstanceOf(OwlDrawStream);
        expect(createOwlRoom({ tiles: [], seed: 5, bossDraws: true }).stream).toBeInstanceOf(OwlPatternStream);
        expect(owlStreamForBuild({ bossDraws: false, seed: 5 })).toBeInstanceOf(OwlDrawStream);
        expect(createTentacleBeastFight({ x: 80, y: 48, tag: 0 }, { seed: 5 }).stream).toBeInstanceOf(TentacleDrawStream);
        expect(createTentacleBeastFight({ x: 80, y: 48, tag: 0 }, { seed: null }).stream).toBe(null);
        expect(createTentacleBeastFight({ x: 80, y: 48, tag: 0 }, { seed: null, bossDraws: true }).stream)
            .toBeInstanceOf(TentaclePatternStream);
    });
});

describe('the Owl on bossdraws: each site is the AS3 formula', () => {
    it('barrage roll: `rockfallTime % rockFrequency == 0` on the decremented time — a rock every sixth tick', () => {
        const s = new OwlPatternStream();
        const got = [];
        for (let rt = RT_MAX - 1; rt >= 0; rt -= 1) got.push(s.barrageRoll(rt));
        const want = [];
        for (let rt = RT_MAX - 1; rt >= 0; rt -= 1) want.push(rt % ROCK_FREQ === 0);
        expect(got).toEqual(want);
        expect(got.filter(Boolean).length).toBe(RT_MAX / ROCK_FREQ);
        expect(() => s.barrageRoll(undefined)).toThrow(/rockfallTime/);
    });

    it('aim x/y and the HIT-box scale read the rock index (first rock = index one), reset at the pod snap', () => {
        const s = new OwlPatternStream();
        const leg = (px, py, vx, vy, n) => Array.from({ length: n }, () => {
            const x = s.spawnX(px, vx);
            const y = s.spawnY(py, vy);
            return [x, y, s.rockScale()];
        });
        const ref = (px, py, vx, vy, n) => Array.from({ length: n }, (_, i) => [
            px + vx * STEPS_AHEAD + vdcRef(i + 1, 2) * RADIUS * 2 - RADIUS,
            py + vy * STEPS_AHEAD + vdcRef(i + 1, 3) * RADIUS * 2 - RADIUS,
            vdcRef(i + 1, 5) / 2 + 0.25,
        ]);
        expect(leg(100, 120, 0.5, -0.25, 40)).toEqual(ref(100, 120, 0.5, -0.25, 40));
        s.podSnap();
        expect(leg(60, 70, 0, 1, 12)).toEqual(ref(60, 70, 0, 1, 12));
        // the scale set is the shipped box range: 32s x 16s, int
        const scales = ref(0, 0, 0, 0, 40).map((r) => r[2]);
        expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.25);
        expect(Math.max(...scales)).toBeLessThan(0.75);
    });

    it('grenade roll: `walkTicks++` then `% grenadeFrequency == 0`, counted per leg (reset at the pod snap)', () => {
        const s = new OwlPatternStream();
        const fires = (n) => Array.from({ length: n }, () => s.grenadeRoll());
        const a = fires(100);
        expect(a.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)).toEqual([GRENADE_FREQ, 2 * GRENADE_FREQ]);
        s.podSnap();
        const b = fires(GRENADE_FREQ - 1);
        expect(b.some(Boolean)).toBe(false);   // a leg shorter than the period throws none
        expect(s.grenadeRoll()).toBe(true);
    });

    it('death rocks: x = 120 + (i + 0.5) / n * 8 - 4 and scale = vdc(i + 1, 5) / 2 + 0.25, in the arm\'s order', () => {
        const s = new OwlPatternStream();
        s.spawnX(0, 0); s.spawnY(0, 0); s.rockScale();   // a barrage rock first: the death arm keys on i, not rockIndex
        const got = [];
        for (let i = 0; i < DEATH_N; i += 1) got.push([s.deathRockX(), s.rockScale()]);
        const want = Array.from({ length: DEATH_N }, (_, i) => [120 + (i + 0.5) / DEATH_N * 8 - 4, vdcRef(i + 1, 5) / 2 + 0.25]);
        expect(got).toEqual(want);
        expect(got.map((g) => Math.trunc(g[0]))).toEqual([116, 118, 120, 121, 123]);   // RockFall(_x:int)
        // and the next barrage rock reads its own index again
        expect(s.rockScale()).toBe(vdcRef(1, 5) / 2 + 0.25);
    });

    it('the ledger: every site is booked as OwlDrawStream books it, and only Enemy.coins turns the generator', () => {
        const s = new OwlPatternStream(101);
        s.levelBuild();
        s.barrageRoll(0); s.spawnX(0, 0); s.spawnY(0, 0); s.rockScale(); s.grenadeRoll(); s.enemyCoins(); s.deathRockX();
        expect(Object.keys(s.counts).sort()).toEqual(Object.keys(OWL_DRAW_SITES).sort());
        expect(Object.values(s.counts).every((c) => c >= 1)).toBe(true);
        const g = new SeedlingRng(101);
        g.next(); g.next();
        expect(s.state).toBe(g.state);
        expect(new OwlPatternStream().state).toBe(null);
    });
});

describe('the Tentacled Beast on bossdraws: each site is the AS3 formula', () => {
    const wx = (n) => Math.trunc(vdcRef(n, 2) * (SPAWN.width - W_MARGIN.x - W_MARGIN.width) + SPAWN.x + W_MARGIN.x);
    const wy = (n) => Math.trunc(vdcRef(n, 3) * (SPAWN.height - W_MARGIN.y - W_MARGIN.height) + SPAWN.y + W_MARGIN.y);
    const tx = (n) => Math.trunc(vdcRef(n, 2) * (SPAWN.width - T_MARGIN.x - T_MARGIN.width) + SPAWN.x + T_MARGIN.x);
    const ty = (n) => Math.trunc(vdcRef(n, 3) * (SPAWN.height - T_MARGIN.y - T_MARGIN.height) + SPAWN.y + T_MARGIN.y);
    const awake = (bossDraws) => {
        const f = createTentacleBeastFight({ x: 80, y: 48, tag: 0 }, { seed: bossDraws ? null : 9, bossDraws });
        Object.assign(f.beast, { activated: true, spr: null });
        return f;
    };
    const step = (f, tick) => {
        stepTentacleBeast(f, { tick, frozen: false, levelWidth: 208, player: { x: 0, y: 0, fallFromCeiling: false },
            setShake() {}, streamRefusal: () => null });
        for (const s of f.spawned.splice(0)) (s.kind === 'whirlpool' ? f.whirlpools : f.tentacles).push(s.body);
    };

    it('the constants this file cites are the model\'s', () => {
        expect(TENTACLE_BEAST.spawnRect).toMatchObject(SPAWN);
        expect(TENTACLE_BEAST.tentacleMargin).toMatchObject(T_MARGIN);
        expect(TENTACLE_BEAST.whirlpoolMargin).toMatchObject(W_MARGIN);
    });

    it('whirlpool x/y = the Halton (2,3) point of whirlIndex; tentacle x/y = that of tentacleIndex', () => {
        const s = new TentaclePatternStream();
        const B = TENTACLE_BEAST;
        const W = Array.from({ length: 30 }, () => [
            Math.trunc(s.draw('whirlX') * (B.spawnRect.width - B.whirlpoolMargin.x - B.whirlpoolMargin.width) + B.spawnRect.x + B.whirlpoolMargin.x),
            Math.trunc(s.draw('whirlY') * (B.spawnRect.height - B.whirlpoolMargin.y - B.whirlpoolMargin.height) + B.spawnRect.y + B.whirlpoolMargin.y),
        ]);
        const T = Array.from({ length: 30 }, () => [
            Math.trunc(s.draw('tentacleX') * (B.spawnRect.width - B.tentacleMargin.x - B.tentacleMargin.width) + B.spawnRect.x + B.tentacleMargin.x),
            Math.trunc(s.draw('tentacleY') * (B.spawnRect.height - B.tentacleMargin.y - B.tentacleMargin.height) + B.spawnRect.y + B.tentacleMargin.y),
        ]);
        expect(W).toEqual(Array.from({ length: 30 }, (_, i) => [wx(i + 1), wy(i + 1)]));
        expect(T).toEqual(Array.from({ length: 30 }, (_, i) => [tx(i + 1), ty(i + 1)]));
        expect(s.state).toBe(null);
    });

    it('the fight spawns the pattern\'s candidates, tick by tick', () => {
        const f = awake(true);
        step(f, 1);
        expect(f.whirlpools.map((w) => [w.x, w.y])).toEqual([[wx(1), wy(1)]]);
        // the whirlpool added this frame is not in the class list yet (`updateLists()`), so the tentacle stands too
        expect(f.tentacles.map((t) => [t.x, t.y])).toEqual([[tx(1), ty(1)]]);
    });

    it('the break: a failed whirlpool try ends the loop (one candidate per tick); the shipped loop tries every one', () => {
        const blockAt = (f) => f.tentacles.push({ id: 'blocker', x: wx(1), y: wy(1) });
        const p4h = awake(true);
        blockAt(p4h);
        step(p4h, 1);
        expect(p4h.stream.counts.whirlX).toBe(1);
        expect(p4h.whirlpools).toEqual([]);
        step(p4h, 2);   // the next tick reads the NEXT index
        expect(p4h.stream.whirlIndex).toBe(2);
        const p4g = awake(false);
        blockAt(p4g);
        step(p4g, 1);
        expect(p4g.stream.counts.whirlX).toBe(TENTACLE_BEAST.maxTries + 1);
    });
});

// ── the run: two entries are the same fight, and the Owl plans replay ─────
const TAPES = join(HERE, 'fixtures/p4h-owl-plans');
const tapeOf = (name) => parseTape(readFileSync(join(TAPES, name), 'utf8'));
const owlRun = (tape, { boot = tape.boot, seed, capabilities, extraGrants = [] }) => createLevelRun({
    levelSource: atlasLevelSource(), boot, noclip: false, noHazards: [], noDamage: false,
    grants: [...extraGrants, ...tape.grants], persistence: [{ level: 112, tag: 1 }], equips: tape.equips,
    pins: tape.pins, save: tape.save, rng: { seed, split: true }, roles: ROLES, capabilities,
});
const owlSig = (run) => run.owlTicks.map((o) => [o.phase, o.bossX, o.bossY, o.rockfallTime, o.cpod, o.rocks, o.grenades, o.hits].join(','));

describe('levelRun on bossdraws: every entry is the same fight', () => {
    it('L112 walked into from L111 (seed 7) plays the boot-room fight (seed 101) tick for tick; p4g refuses the walk-in', () => {
        const tape = tapeOf('det-owl-sword-A.json');
        const N = 600;
        const a = owlRun(tape, { seed: 101, capabilities: P4H_CAPS });
        for (let t = 0; t < N; t += 1) a.advance(heldKeysAt(tape, t));
        const b = owlRun(tape, { seed: 7, capabilities: P4H_CAPS, boot: { level: 111, x: 128, y: 80 },
            extraGrants: [{ level: 111, items: ['sword'] }] });
        let walk = 0;
        while (b.level !== 112 && walk < 200) { b.advance(new Set(['up'])); walk += 1; }
        expect(b.level).toBe(112);
        expect([b.state.x, b.state.y]).toEqual([40, 216]);   // the teleporter's arrival: the tape's boot cell
        for (let t = 0; t < N; t += 1) b.advance(heldKeysAt(tape, t));
        expect(owlSig(b)).toEqual(owlSig(a));
        expect(a.owlStreamState).not.toBe(null);   // the boot room's seeded build: Enemy.coins' position is known
        expect(b.owlStreamState).toBe(null);       // a walk-in's is not, and nothing gameplay reads it
        const g = owlRun(tape, { seed: 7, capabilities: null, boot: { level: 111, x: 128, y: 80 },
            extraGrants: [{ level: 111, items: ['sword'] }] });
        expect(() => { for (let t = 0; t < 60; t += 1) g.advance(new Set(['up'])); }).toThrow(/would open in level 112/);
    });
});

describe('levelRun on bossdraws: a death\'s rebuild of L57 restarts the beast\'s patterns', () => {
    // The door witness's staging (L57 at the L58 door), walked onto the first whirlpool's cell and held there: the
    // whirlpool drowns the player, `restartLevel()` rebuilds L57, and the rebuilt beast reads whirlIndex /
    // tentacleIndex from the start again — the same fight, so the same drown, one rebuild later.
    const DOOR = JSON.parse(readFileSync(join(HERE, 'fixtures/tentaclebeast-witness/tb-hitless-door.json'), 'utf8')).tape;
    const walk = (seed) => withContactFidelity({ tentacleBeastFight: true, whirlpoolDrown: true }, () => {
        const tape = { ...DOOR, inputs: [], tick_count: 0, rng: { ...DOOR.rng, seed } };
        const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(tape))), atlasLevelSource(),
            { capabilities: P4H_CAPS });
        for (let t = 0; t < 900 && run.playerDeaths.length < 2; t += 1) {
            const k = new Set();
            const dx = 104 - run.state.x;
            const dy = 133 - run.state.y;
            if (dx > 1) k.add('right'); if (dx < -1) k.add('left'); if (dy > 1) k.add('down'); if (dy < -1) k.add('up');
            run.advance(k);
        }
        return { deaths: run.playerDeaths.map((d) => [d.t, d.source]),
            spawns: run.tentacleBeastEvents.filter((e) => e.kind === 'whirlpool' || e.kind === 'tentacle')
                .map((e) => [e.t, e.kind, e.x, e.y]) };
    });

    it('two drowns one period apart, and the second build spawns the first build\'s candidates, shifted', () => {
        const a = walk(DOOR.rng.seed);
        expect(a.deaths.map((d) => d[1])).toEqual(['whirlpool', 'whirlpool']);
        const [d1, d2] = a.deaths.map((d) => d[0]);
        const first = a.spawns.filter((e) => e[0] <= d1);
        const second = a.spawns.filter((e) => e[0] > d1 && e[0] <= d2).map(([t, ...r]) => [t - d1, ...r]);
        expect(d2 - d1).toBe(d1);
        expect(second).toEqual(first);
        expect(walk(7)).toEqual(a);   // and the seed decides nothing
    });
});

describe('the Owl plans (option A) replay on the p4h model', () => {
    const play = (tape, seed) => {
        const run = owlRun(tape, { seed, capabilities: P4H_CAPS });
        for (let t = 0; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t));
        return { flags: run.finalBossFlags.map((f) => `${f.level}:${f.tag}`).sort(), level: run.level,
            hits: run.playerHits.length, sig: owlSig(run) };
    };
    for (const name of ['det-owl-sword-A.json', 'det-owl-spear-A.json']) {
        it(`${name}: no hits, both flags, into L113 — the same fight on two seeds`, () => {
            const tape = tapeOf(name);
            const a = play(tape, tape.rng.seed);
            const b = play(tape, 7);
            for (const r of [a, b]) {
                expect(r.hits).toBe(0);
                expect(r.flags).toEqual(['112:0', '112:1']);
                expect(r.level).toBe(113);
            }
            expect(b.sig).toEqual(a.sig);
        });
    }
});
