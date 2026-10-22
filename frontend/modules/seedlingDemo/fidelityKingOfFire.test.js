/**
 * ⛓⛓⛓ seedling-fidelity-bosskills D2 — THE KING OF FIRE (`lavaBoss.js`, `CONTACT_FIDELITY.kingOfFireFight`).
 *
 * Three strata:
 *   1. the transcription's own arithmetic, row by row against `Enemies/LavaBoss.as` @ccdf189776 (the cycle the game
 *      measured in D1, the damage gate, the reflection, the runner's jump, the arena rock's schedule);
 *   2. the GAME WITNESSES (`fixtures/lavaboss-witness/*.json`, recorded on p4g by
 *      `scripts/procgen/probe-seedling-bosskills.mjs --record`): each embedded tape replayed in node with the switch
 *      ON, and every tick of the model's fight — the player, the body's anim / index / hits / i-frames / alpha, every
 *      ball and every runner — equal to the game's at 0 px;
 *   3. the solver: from the route survey's step-203 arrival the `lavaboss` verb kills him and the walk leaves by the
 *      exit; with the switch OFF it refuses by name.
 *
 * Mutants (predicted, made by copy + edit + run + restore; the report's table):
 *   M1 `lavaBossHit` counts a hit outside the window → the gate rows red, and every witness with a press reddens
 *      where a stray swing lands (kof-reflect, kof-policy-kill, kof-solve-203);
 *   M2 the airborne runner stays out of the swing (`chaserPressBodiesNow` skips `inAir`) → kof-death-respawn reds (t916:
 *      the swing that kills a runner mid-jump);
 *   M3 the arena rock's dead frames age nothing → kof-death-respawn and kof-solve-203 red (the dash after the arm);
 *   M4 the Explosion drain does not re-read `next` → kof-solve-203 reds (t150, the knockback lost);
 *   M5 the suit's kill on lava is not taken back (no `undead`) → kof-death-respawn reds (t913).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { withContactFidelity, CONTACT_FIDELITY } from './contactFidelity.js';
import { animTicks } from './chasers.js';
import {
    LAVA_BOSS, LAVA_BOSS_ANIMS, LAVA_EXPLOSION, LAVA_RUNNER, createLavaBossFight, lavaArenaRockSchedule, lavaBossHit,
    reflectLavaBall, stepLavaRunnerAir,
} from './lavaBoss.js';
import { SolverRefusal, solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WITNESS_DIR = join(HERE, 'fixtures', 'lavaboss-witness');
const SRC = atlasLevelSource();
const witnesses = readdirSync(WITNESS_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(WITNESS_DIR, f), 'utf8')));
const L82 = { x: 112, y: 48, tag: 0 };

describe('bosskills D2 — the transcription (`Enemies/LavaBoss.as`)', () => {
    // ⛓ shipped OFF; planning-10's flip (⚖ user "Flip kingOfFireFight", 2026-10-21) turns it ON.
    it('ships ON (flipped)', () => {
        expect(CONTACT_FIDELITY.kingOfFireFight).toBe(true);
    });

    it('the cycle the game measured: sit 19 (20 on the wake), smash 16, smashback 16, armsup 22, sweep 10, sweepback 16 = 99', () => {
        const t = (name) => animTicks(...LAVA_BOSS_ANIMS[name]);
        expect([t('sit'), t('smash'), t('smashback'), t('armsup'), t('sweep'), t('sweepback')])
            .toEqual([19, 16, 16, 22, 10, 16]);
        expect(t('sit') + t('smash') + t('smashback') + t('armsup') + t('sweep') + t('sweepback')).toBe(99);
        expect(t('die')).toBe(43);
    });

    it('the body is the ctor point (x + 48, y + 40) and the respawn the ctor writes is (152, 176)', () => {
        const f = createLavaBossFight(L82);
        expect([f.boss.x, f.boss.y]).toEqual([160, 88]);
        expect(LAVA_BOSS.respawn).toEqual({ x: 152, y: 176 });
    });

    it('the gate: a ball opens the window and counts nothing; the first sword hit in it counts; a sword alone does nothing', () => {
        const f = createLavaBossFight(L82);
        expect(lavaBossHit(f, 'Sword')).toMatchObject({ counted: false, opened: false, hits: 0, hitsTimer: 0 });
        expect(lavaBossHit(f, 'LavaBall')).toMatchObject({ counted: false, opened: true, hits: 0, hitsTimer: 120 });
        expect(lavaBossHit(f, 'LavaBall')).toMatchObject({ counted: false, opened: false, hits: 0 });
        // `lastHitType` moved to "LavaBall" again; the sword counts (it is the hit after a ball, in the window).
        expect(lavaBossHit(f, 'Sword')).toMatchObject({ counted: true, hits: 1, hitsTimer: 120 });
        // …and the window is closed by its own count: `lastHitType` is "Sword".
        expect(lavaBossHit(f, 'Sword')).toMatchObject({ counted: false, hits: 1 });
        expect(lavaBossHit(f, 'Fire')).toMatchObject({ counted: false, hits: 1 });
    });

    it('the third count is `startDeath`: "die", `destroy`, and the report on the body\'s own tag', () => {
        const f = createLavaBossFight(L82);
        for (let i = 0; i < 2; i += 1) {
            f.boss.hitsTimer = 0;
            lavaBossHit(f, 'LavaBall');
            lavaBossHit(f, 'Sword');
        }
        expect(f.report).toBe(null);
        f.boss.hitsTimer = 0;
        lavaBossHit(f, 'LavaBall');
        expect(lavaBossHit(f, 'Spear')).toMatchObject({ counted: true, died: true, hits: 3 });
        expect(f.boss.destroy).toBe(true);
        expect(f.boss.spr.name).toBe('die');
        expect(f.report).toEqual({ tag: 0 });
    });

    it('a dark hit is refused by name: nothing in the game can deliver one', () => {
        const f = createLavaBossFight(L82);
        f.boss.hitsTimer = 0;
        expect(() => lavaBossHit(f, 'LavaBall') && lavaBossHit(f, 'Suit')).toThrow(/nothing in the game can deliver/);
    });

    it('a reflection reverses the ball at twice the speed, once', () => {
        const s = { id: 'b', x: 160, y: 140, vx: 0, vy: 1, beenHit: false };
        expect(reflectLavaBall(s)).toBe(true);
        expect([s.vx, s.vy, s.beenHit]).toEqual([-0, -2, true]);
        expect(reflectLavaBall(s)).toBe(false);
        expect(s.vy).toBe(-2);
    });

    it('the runner\'s jump: the game\'s own arc (D1: 117.45, 115.1, … 139.5) and it lands at startY + 3.5', () => {
        const r = { id: 'r', x: 194, y: 120, jumpV: LAVA_RUNNER.jumpV, startY: 136, inAir: true };
        const ys = [];
        while (r.inAir) { stepLavaRunnerAir(r); ys.push(Math.round(r.y * 100) / 100); }
        expect(ys.slice(0, 5)).toEqual([117.45, 115.1, 112.95, 111, 109.25]);
        expect(ys.at(-1)).toBe(139.5);
        expect(ys.length).toBe(35);
        expect(r.vy).toBeCloseTo(3.75, 12);
    });

    it('the Explosion\'s radius truncates (int 16 × 0.65 → 10) and the arena rock\'s schedule is 180 dead frames', () => {
        expect(LAVA_EXPLOSION.radius).toBe(10);
        const s = lavaArenaRockSchedule({ x: 128, y: 224 });
        expect(s).toMatchObject({ armY: 216, fallTicks: 30, deadFrames: 180 });
        expect(s.rect).toEqual({ x: 128, y: 224, w: 32, h: 32, right: 160, bottom: 256 });
    });
});

/** The model's sample, in the probe's own format (`probe-seedling-bosskills.sampleOf`). */
function modelSamples(tape) {
    const out = [];
    withContactFidelity({ kingOfFireFight: true }, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: SRC, onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const v = run ? run.lavaBossFight : null;
            const b = v && !v.boss.removed ? v.boss : null;
            out[o.t] = {
                x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0,
                boss: b ? { anim: b.anim, index: b.index, alpha: b.alpha, hits: b.hits, hitsTimer: b.hitsTimer } : null,
                balls: (v?.balls ?? []).map((s) => [s.x, s.y]),
                runners: (v?.runners ?? []).filter((c) => !c.removed).map((c) => [c.x, c.y]),
            };
            r = st.next();
        }
    });
    return out;
}
const sorted = (a) => a.map((p) => `${p[0]},${p[1]}`).sort();

describe('bosskills D2 — the game witnesses, at 0 px (the switch ON)', () => {
    // ⛓ fidelity BOSSFORK D1 added `kof-fork-665` / `kof-fork-667`: the clear-tag arm's answers to sweep legs 665 and
    // 667 (the latter staged with the arena rock {82,1} cleared), played on the game.
    it('there are seven, each recorded on p4g', () => {
        expect(witnesses.map((w) => w.name)).toEqual(['kof-death-respawn', 'kof-fork-665', 'kof-fork-667', 'kof-idle',
            'kof-policy-kill', 'kof-reflect', 'kof-solve-203']);
        for (const w of witnesses) expect(w.page).toBe('seedling_bot_ap_p4g');
    });

    for (const w of witnesses) {
        it(`${w.name}: every one of ${w.samples.length} ticks — the player, the body, every ball and runner`, () => {
            const m = modelSamples(parseTape(JSON.stringify(w.tape)));
            const bad = [];
            for (const g of w.samples) {
                const s = m[g.t];
                if (!s) { bad.push(`t ${g.t}: no model tick`); continue; }
                if (s.x !== g.x || s.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${s.x}, ${s.y})`);
                if (s.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${s.level}`);
                if (s.hits !== g.hits) bad.push(`t ${g.t}: player hits game ${g.hits} model ${s.hits}`);
                const gb = g.boss && g.boss.cls === 'LavaBoss' ? g.boss : null;
                if (!!gb !== !!s.boss) bad.push(`t ${g.t}: body game ${!!gb} model ${!!s.boss}`);
                else if (gb && (gb.anim !== s.boss.anim || gb.index !== s.boss.index || gb.hits !== s.boss.hits
                    || gb.hitsTimer !== s.boss.hitsTimer || gb.alpha !== s.boss.alpha)) {
                    bad.push(`t ${g.t}: body game ${JSON.stringify(gb)} model ${JSON.stringify(s.boss)}`);
                }
                if (sorted(g.balls).join('|') !== sorted(s.balls).join('|')) bad.push(`t ${g.t}: balls differ`);
                if (sorted(g.runners).join('|') !== sorted(s.runners).join('|')) bad.push(`t ${g.t}: runners differ`);
            }
            expect(bad.slice(0, 6)).toEqual([]);
        }, 120000);
    }

    it('kof-policy-kill: the game writes {82,0} at the tick the model banks the report, and the body leaves at 867', () => {
        const w = witnesses.find((x) => x.name === 'kof-policy-kill');
        const firstCleared = w.samples.find((s) => s.cleared.includes(0)).t;
        const gone = w.samples.find((s, i) => i > 0 && s.boss === null && w.samples[i - 1].boss !== null).t;
        expect([firstCleared, gone]).toEqual([724, 867]);
        let report = null;
        withContactFidelity({ kingOfFireFight: true }, () => {
            const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: SRC,
                onTick: (t, s, h, rn) => { report = rn.lavaBossEvents.find((e) => e.kind === 'report') ?? report; } });
            let r = st.next();
            while (!r.done) r = st.next();
        });
        expect(report.t).toBe(724);
        expect(report.flag).toMatchObject({ level: 82, tag: 0 });
    });

    // ⛓ planning-10's flip: the OFF arm is now named (it was the default).
    it('the witnesses need the switch: OFF the model has no fight, and the idle arrival parts from the game at the first runner contact', () => withContactFidelity({ kingOfFireFight: false }, () => {
        const w = witnesses.find((x) => x.name === 'kof-idle');
        let first = null;
        const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: SRC });
        let r = st.next();
        const byT = new Map(w.samples.map((s) => [s.t, s]));
        while (!r.done && first === null) {
            const o = r.value.observation;
            const g = byT.get(o.t);
            if (g && (g.x !== o.x || g.y !== o.y)) first = o.t;
            r = st.next();
        }
        expect(first).toBe(121);
    }));
});

describe('bosskills D2 — the solver (`solid:lavaboss` → `lavaboss`)', () => {
    const w = witnesses.find((x) => x.name === 'kof-solve-203');
    const staging = stagingFromTape(parseTape(JSON.stringify({ ...w.tape, inputs: [], tick_count: 0 })));
    const goals = [{ kind: 'reach-exit', exit: { x: 144, y: 0 } }];

    it('ON: from the survey\'s step-203 arrival the verb kills him and the walk leaves by teleporter@144,0', () => {
        withContactFidelity({ kingOfFireFight: true }, () => {
            const run = createRunForStaging(staging, SRC);
            const out = solveSegment({ run, goals, name: 'kof-row-203', boot: staging.boot,
                forkRun: () => createRunForStaging(staging, SRC) });
            expect(run.level).toBe(96);
            expect(run.earnedClears.map((c) => `${c.level}:${c.tag}`)).toEqual(expect.arrayContaining(['82:0', '82:1']));
            expect(run.playerDeaths.length).toBe(0);
            expect(out.perTick.length).toBeGreaterThan(800);
        });
    }, 120000);

    // ⛓ planning-10's flip: the OFF arm is now named (it was the default).
    it('OFF: the same goal refuses, and the refusal names the switch', () => withContactFidelity({ kingOfFireFight: false }, () => {
        const run = createRunForStaging(staging, SRC);
        let e = null;
        try { solveSegment({ run, goals, name: 'kof-row-203-off', boot: staging.boot }); } catch (x) { e = x; }
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/lavaboss/);
    }), 120000);
});

/**
 * ⛓⛓ fidelity BOSSFORK D1 — THE CLEAR-TAG ARM PASSES THE SEGMENT'S FORK. Sweep legs 665 / 667 (`location:Level 082 -
 * King of Fire`) are the clear-tag {82,0} on `lavaboss@112,48`. Before D1 the arm handed the executor no `ctx.fork`, so
 * `execLavaBoss` played variant 0 alone and it dies (spent 691 / 707). With the fork it plays variants 0 and 1 on forks
 * (both die), commits variant 2 (`standY` 160), and the walk is the witness's own tape. 667's staging is leg 664's
 * captured request with the arena rock {82,1} cleared (the L96 side's arrival; no 667 capture exists ON yet).
 *
 * Mutant (predicted, copy + restore): drop `fork` from the clear-tag arm's executor context → the ON row reds with the
 * variant-0 refusal (spent 691), and the no-fork row still passes.
 */
for (const [leg, tried, ticks, presses] of [
    ['665', [[false, 691], [false, 923], [true, 844]], 870, ['0:primary+up|up', '2:primary+up|up']],
    ['667', [[false, 707], [false, 938], [true, 853]], 865, []],
]) describe(`bossfork D1 — the clear-tag arm hands the executor the segment's fork (leg ${leg})`, () => {
    const w = witnesses.find((x) => x.name === `kof-fork-${leg}`);
    const staging = stagingFromTape(parseTape(JSON.stringify({ ...w.tape, inputs: [], tick_count: 0 })));
    const goals = [{ kind: 'clear-tag', tag: { level: 82, tag: 0 }, at: { x: 112, y: 48 }, obstacle: 'lavaboss@112,48' }];
    const keysOf = (perTick) => perTick.map((k) => [...k].sort().join('+'));
    const tapeKeys = () => {
        const per = Array.from({ length: w.tape.tick_count }, () => new Set());
        for (const i of w.tape.inputs) for (let t = i.from; t < i.to; t += 1) per[t].add(i.key);
        return keysOf(per);
    };

    it('ON, with a fork: variants 0 and 1 die on forks, variant 2 kills him, and the walk is the witness\'s tape', () => {
        withContactFidelity({ kingOfFireFight: true }, () => {
            const run = createRunForStaging(staging, SRC);
            const out = solveSegment({ run, goals, name: `kof-fork-${leg}`, boot: staging.boot,
                forkRun: () => createRunForStaging(staging, SRC) });
            const rec = out.records.find((r) => r.verb === 'lavaboss');
            expect(rec.params).toEqual({ standY: 160, strike: 20 });
            expect(rec.tried.map((t) => [t.ok, t.spent])).toEqual(tried);
            expect(run.earnedClears.map((c) => `${c.level}:${c.tag}`)).toEqual(expect.arrayContaining(['82:0']));
            expect(run.playerDeaths.length).toBe(0);
            // The witness's tape is the page solver's answer (`solveAnytime` on the leg's request). 665's walk equals it
            // on every tick but 0 and 2, where it also holds `primary` (the arrival's swing; measured); 667's on all.
            const mine = keysOf(out.perTick);
            const theirs = tapeKeys();
            expect([mine.length, theirs.length]).toEqual([ticks, ticks]);
            const diff = mine.map((k, t) => (k === theirs[t] ? null : `${t}:${k}|${theirs[t]}`)).filter(Boolean);
            expect(diff).toEqual(presses);
        });
    }, 120000);

    it(`ON, without a fork (no \`forkRun\`): variant 0 alone, and it refuses on its death at spent ${tried[0][1]}`, () => {
        withContactFidelity({ kingOfFireFight: true }, () => {
            const run = createRunForStaging(staging, SRC);
            let e = null;
            try { solveSegment({ run, goals, name: `kof-nofork-${leg}`, boot: staging.boot }); } catch (x) { e = x; }
            expect(e).toBeInstanceOf(SolverRefusal);
            expect(e.message).toMatch(new RegExp('\\{"standY":168,"strike":20\\} did not kill lavaboss@112,48: the player '
                + `died at spent ${tried[0][1]}`));
        });
    }, 120000);
});
