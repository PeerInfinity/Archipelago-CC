/**
 * ⛓⛓⛓ seedling-fidelity-bosskills D3 — THE TENTACLED BEAST (`tentacleBeast.js`, `CONTACT_FIDELITY.tentacleBeastFight`).
 *
 * Three strata:
 *   1. the transcription's own arithmetic, row by row against `Enemies/TentacleBeast.as`, `Enemies/Tentacle.as` and
 *      `Puzzlements/Whirlpool.as` @ccdf189776 (the lifecycle the game measured in D1, the draw stream's first
 *      placements per seed, the stream's premises, the swipe's side);
 *   2. the GAME WITNESSES (`fixtures/tentaclebeast-witness/*.json`, recorded on p4g by
 *      `scripts/procgen/probe-seedling-bosskills.mjs --record --dir=tentaclebeast-witness`): each embedded tape replayed
 *      in node with the switch ON, and every tick of the model — the player, the level, the hits, the beast's anim,
 *      every tentacle's position / anim / frame / alpha, and the gameplay generator's state — equal to the game's;
 *   3. the solver: a clear-tag on `{57,0}` plays the `tentaclebeast` verb and the walk leaves by the mouth into L58;
 *      OFF, and with the stream unsplit, it refuses by name.
 *
 * Mutants (predicted, made by copy + edit + run + restore; the report's table):
 *   T1 the swipe's side from the 160-wide screen (`xpos < 80`), not the level's width → tb-death-s3 reds (t213: the
 *      tentacle at x 81 swipes right on the game and the model's swipes left, so the hit is missed) — RUN: that, and
 *      also the solver's ON row (its walk is a different length), which the prediction did not name;
 *   T2 a death's rebuild re-seeds the stream (no carry) → tb-death-s3 reds at its rebuild (the rng state);
 *   T3 the cut's wrap re-creates the anim (`play("cut")` treated as a restart) → tb-policy-s2 and tb-solve-s2 red (a
 *      cut frame one update late in its second loop);
 *   T4 the whirlpool loop's `cont` reset on every try (the "fix" of the game's quirk) → every witness whose stream
 *      meets a rejected whirlpool try reds on the rng state — RUN: all four witnesses and the solver's ON row.
 * T2 RUN: tb-death-s3 alone; T3 RUN: tb-policy-s2 and tb-solve-s2, as predicted.
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
import { SeedlingRng } from './rng.js';
import {
    TENTACLE, TENTACLE_ANIMS, TENTACLE_BEAST, TENTACLE_BEAST_ANIMS, TentacleDrawStream, createTentacleBeastFight,
    hitTentacle, tentacleStreamRefusal, tentacleSwipeRect,
} from './tentacleBeast.js';
import { SolverRefusal, solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WITNESS_DIR = join(HERE, 'fixtures', 'tentaclebeast-witness');
const SRC = atlasLevelSource();
const witnesses = readdirSync(WITNESS_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(WITNESS_DIR, f), 'utf8')));
const L57 = { x: 80, y: 48, tag: 0 };

describe('bosskills D3 — the transcription (`Enemies/TentacleBeast.as`, `Enemies/Tentacle.as`)', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY.tentacleBeastFight).toBe(false);
    });

    it('a tentacle\'s life is rise 16, sit 37, hit 16, hitting 4, sink 13 (86 updates); the beast rises in 46, dies in 61', () => {
        const t = (name) => animTicks(...TENTACLE_ANIMS[name]);
        expect(['rise', 'sit', 'hit', 'hitting', 'sink', 'cut'].map(t)).toEqual([16, 37, 16, 4, 13, 13]);
        expect([animTicks(...TENTACLE_BEAST_ANIMS.rise), animTicks(...TENTACLE_BEAST_ANIMS.dying)]).toEqual([46, 61]);
    });

    it('the beast is the ctor point (x + 24, y + 24), asleep, eight tentacles and one whirlpool owed', () => {
        const f = createTentacleBeastFight(L57, { seed: 1 });
        expect([f.beast.x, f.beast.y, f.beast.activated, f.beast.maxTentacles, f.beast.maxWhirlpools])
            .toEqual([104, 72, false, 8, 1]);
        expect(f.stream.counts.build).toBe(1);
        expect(TENTACLE_BEAST.distActivate).toBe(48);
    });

    it('the stream is the runtime LFSR on the declared seed, the build\'s one draw first (D1: placements per seed)', () => {
        // D1 measured the first tentacle on p4g: seed 1 (104,138), seed 2 (61,142), seed 3 (176,131); each first spawn
        // draws the whirlpool's x, y, then the tentacle's x, y and its coins — five after the build's one.
        const B = TENTACLE_BEAST;
        const first = (seed) => {
            const s = new TentacleDrawStream(seed);
            const wm = B.whirlpoolMargin;
            const tm = B.tentacleMargin;
            const wx = Math.trunc(s.draw('whirlX') * (B.spawnRect.width - wm.x - wm.width) + B.spawnRect.x + wm.x);
            const wy = Math.trunc(s.draw('whirlY') * (B.spawnRect.height - wm.y - wm.height) + B.spawnRect.y + wm.y);
            const tx = Math.trunc(s.draw('tentacleX') * (B.spawnRect.width - tm.x - tm.width) + B.spawnRect.x + tm.x);
            const ty = Math.trunc(s.draw('tentacleY') * (B.spawnRect.height - tm.y - tm.height) + B.spawnRect.y + tm.y);
            return { w: [wx, wy], t: [tx, ty] };
        };
        expect([1, 2, 3].map((seed) => first(seed).t)).toEqual([[104, 138], [61, 142], [176, 131]]);
        // the stream IS `SeedlingRng`: no private generator
        const a = new TentacleDrawStream(7);
        const b = new SeedlingRng(7);
        b.next();
        expect(a.state).toBe(b.state);
    });

    it('the stream\'s premises, refused by name: a declared seed, `split: true`, and this room the only one built', () => {
        const ok = { seed: 1, split: true };
        expect(tentacleStreamRefusal(ok, { bootLevel: 57, level: 57, worldEntries: 0 })).toBe(null);
        expect(tentacleStreamRefusal({ seed: 1, split: false }, { bootLevel: 57, level: 57, worldEntries: 0 }))
            .toMatch(/split: true/);
        expect(tentacleStreamRefusal({ seed: 0, split: true }, { bootLevel: 57, level: 57, worldEntries: 0 }))
            .toMatch(/declared `rng.seed`/);
        expect(tentacleStreamRefusal(ok, { bootLevel: 56, level: 57, worldEntries: 1 })).toMatch(/after a boot in level 56/);
        expect(tentacleStreamRefusal(ok, { bootLevel: 57, level: 57, worldEntries: 2 })).toMatch(/re-entry from another room/);
        // a death's rebuild of the same room carries the stream on
        expect(tentacleStreamRefusal(ok, { bootLevel: 57, level: 57, worldEntries: 1, onlyThisRoom: true })).toBe(null);
    });

    it('the swipe is a 66x8 rect on the tentacle\'s facing side (`Rectangle(66 * int(!right), 6, 66, 8)`)', () => {
        expect(tentacleSwipeRect({ x: 81, y: 113, right: true })).toMatchObject({ x: 81, y: 107, right: 147, bottom: 115 });
        expect(tentacleSwipeRect({ x: 130, y: 113, right: false })).toMatchObject({ x: 64, y: 107, right: 130, bottom: 115 });
        expect([TENTACLE.force, TENTACLE.damage]).toEqual([2, 1]);
    });

    it('a sword lands only on a sitting tentacle (`canHit`), once (`hitsMax` 1), and starts its cut', () => {
        const t = { canHit: false, hits: 0, hitsTimer: 0, destroy: false };
        expect(hitTentacle(t, { d: 1, t: 'Sword' })).toMatchObject({ landed: false });
        t.canHit = true;
        expect(hitTentacle(t, { d: 1, t: 'Fire' })).toMatchObject({ landed: false });
        expect(hitTentacle(t, { d: 1, t: 'Sword' })).toMatchObject({ landed: true, killed: true });
        expect([t.destroy, t.hitsTimer]).toEqual([true, 30]);
    });
});

function modelSamples(tape) {
    const out = [];
    withContactFidelity({ tentacleBeastFight: true }, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: SRC, onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const v = run ? run.tentacleBeastFight : null;
            out[o.t] = {
                x: o.x, y: o.y, level: run ? run.level : tape.boot.level, hits: run ? run.damage.hits : 0,
                beast: v ? v.beast.anim : null,
                tentacles: (v?.tentacles ?? []).map((q) => [q.x, q.y, q.anim, q.index, q.alpha]),
                rngState: v ? v.rngState : null,
                // ⛓ BOSSFORK D2: a beast BUILT dead has no draw stream (it owes no draws), so its `rngState` is null
                dead: v ? v.beast.dead === true : false,
            };
            r = st.next();
        }
    });
    return out;
}
const rows = (a) => a.map((p) => p.join(',')).sort();

describe('bosskills D3 — the game witnesses, at 0 px (the switch ON)', () => {
    // ⛓ BOSSFORK D2 added `tb-enter-cleared` (L58 → L57 with {57,0} cleared: the arrival stands on the mouth and stays).
    it('there are five, each recorded on p4g', () => {
        expect(witnesses.map((w) => w.name)).toEqual(['tb-death-s3', 'tb-enter-cleared', 'tb-idle-s1', 'tb-policy-s2',
            'tb-solve-s2']);
        for (const w of witnesses) expect(w.page).toBe('seedling_bot_ap_p4g');
    });

    for (const w of witnesses) {
        it(`${w.name}: every one of ${w.samples.length} ticks — the player, the beast, every tentacle, the generator`, () => {
            const m = modelSamples(parseTape(JSON.stringify(w.tape)));
            const bad = [];
            for (const g of w.samples) {
                const s = m[g.t];
                if (!s) { bad.push(`t ${g.t}: no model tick`); continue; }
                if (s.x !== g.x || s.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${s.x}, ${s.y})`);
                if (s.level !== g.level) bad.push(`t ${g.t}: level game ${g.level} model ${s.level}`);
                if (s.hits !== g.hits) bad.push(`t ${g.t}: player hits game ${g.hits} model ${s.hits}`);
                if (g.level !== 57) continue;
                if ((g.boss?.anim ?? null) !== s.beast) bad.push(`t ${g.t}: beast game ${g.boss?.anim} model ${s.beast}`);
                if (rows(g.tentacleRows).join('|') !== rows(s.tentacles).join('|')) bad.push(`t ${g.t}: tentacles differ`);
                // A beast built dead (BOSSFORK D2's `tb-enter-cleared`) has no stream: the model claims no generator
                // state there, so there is nothing to compare (the room owes no draw after its build).
                if (s.rngState === null && s.dead) continue;
                if (g.rngState !== s.rngState) bad.push(`t ${g.t}: rng game ${g.rngState} model ${s.rngState}`);
            }
            expect(bad.slice(0, 6)).toEqual([]);
        }, 120000);
    }

    it('tb-death-s3: the game dies and rebuilds the room, and the stream runs on (no re-seed)', () => {
        const w = witnesses.find((x) => x.name === 'tb-death-s3');
        const i = w.samples.findIndex((s, k) => k > 0 && s.tentacleRows.length === 0
            && w.samples[k - 1].tentacleRows.length > 0);
        expect(i).toBeGreaterThan(0);
        expect(w.samples[i].boss.anim).toBe('under');
        expect(w.samples[i].rngState).not.toBe(new TentacleDrawStream(3).state);
    });

    it('tb-solve-s2: the game writes {57,0} and leaves through the mouth into L58', () => {
        const w = witnesses.find((x) => x.name === 'tb-solve-s2');
        expect(w.samples.some((s) => s.cleared.includes(0))).toBe(true);
        expect(w.end.level).toBe(58);
    });
});

describe('bosskills D3 — the solver (`solid:tentaclebeast` → `tentaclebeast`)', () => {
    const w = witnesses.find((x) => x.name === 'tb-solve-s2');
    const tapeOf = (rng) => parseTape(JSON.stringify({ ...w.tape, rng: { ...w.tape.rng, ...rng }, inputs: [], tick_count: 0 }));
    const goals = [
        { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
        { kind: 'reach-exit', exit: { x: 96, y: 64 } },
    ];

    it('ON: the verb opens the mouth with no death, {57,0} is earned, and the walk leaves into L58', () => {
        const staging = stagingFromTape(tapeOf({}));
        withContactFidelity({ tentacleBeastFight: true }, () => {
            const run = createRunForStaging(staging, SRC);
            const out = solveSegment({ run, goals, name: 'tb-solve-s2', boot: staging.boot,
                forkRun: () => createRunForStaging(staging, SRC) });
            expect(run.level).toBe(58);
            expect(run.earnedClears.map((c) => `${c.level}:${c.tag}`)).toContain('57:0');
            expect(run.playerDeaths.length).toBe(0);
            expect(out.perTick.length).toBe(w.tape.tick_count);
        });
    }, 120000);

    // ⛓ BOSSKILLS harvest: the `solid:tentaclebeast` row is switch-gated (as Lights' is), so OFF the catalogue has no row
    // at all — the survey's `bossGoal` reads `skip` as it did before the slice, and a clear-tag handed it refuses on the row.
    it('OFF: the clear-tag refuses, and the refusal names the missing strategy row', () => {
        const staging = stagingFromTape(tapeOf({}));
        const run = createRunForStaging(staging, SRC);
        let e = null;
        try { solveSegment({ run, goals: goals.slice(0, 1), name: 'tb-off', boot: staging.boot }); } catch (x) { e = x; }
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/no strategy row exists for solid:tentaclebeast/);
    }, 120000);

    it('ON, unsplit: the clear-tag refuses, and the refusal names the stream\'s premise', () => {
        const staging = stagingFromTape(tapeOf({ split: false }));
        let e = null;
        withContactFidelity({ tentacleBeastFight: true }, () => {
            const run = createRunForStaging(staging, SRC);
            try { solveSegment({ run, goals: goals.slice(0, 1), name: 'tb-nosplit', boot: staging.boot }); } catch (x) { e = x; }
        });
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/split: true/);
    }, 120000);
});

/**
 * ⛓⛓ fidelity BOSSFORK D2 — A CLEARED L57 BUILDS WITH THE MOUTH STANDING. The fight is asked lazily (the steppers' first
 * `advance`), so before D2 a run that BUILT L57 with {57,0} cleared held no mouth Teleporter in `run.world` until then.
 * The game's ctor builds the beast dead with the mouth standing: BOSSKILLS D1's revisit (seed 1, boot (96,160), {57,0}
 * cleared, `up` for 162 ticks) reached L58 at t162 at (64,104), and BOSSFORK D2 re-ran it on p4g with the same ticks.
 * The staging is `tb-idle-s1`'s with that persistence row and that input.
 *
 * The other build, `enterWorld`, is the witness `tb-enter-cleared` (p4g, 121 t): from L58 through the door to L57 the
 * arrival (104,72) stands ON the mouth, and the game keeps the player in L57 for all 120 ticks. Before D2 the model built
 * the mouth only at the first step, after the arrival's latch was taken, and walked the player back into L58 at t3.
 *
 * Mutants (predicted, copy + restore): M-D2a drop the boot's `tentacleMouthAtBuild()` → the "at the build" row reds (no
 * teleporter at t0); the walk row still passes (the first step asks the fight, as before D2). M-D2b drop the
 * `enterWorld` call → `tb-enter-cleared` reds at t3 (L58 (64,104) where the game stands in L57 (104,72)).
 */
describe('bossfork D2 — a cleared L57 holds its mouth at the build (`tentacleMouthAtBuild`)', () => {
    const base = witnesses.find((w) => w.name === 'tb-idle-s1').tape;
    const revisit = { ...base, name: 'revisit-57', persistence: [{ level: 57, tag: 0, note: '' }],
        inputs: [{ key: 'up', from: 0, to: 162 }], tick_count: 163 };
    const stagingOf = (t) => stagingFromTape(parseTape(JSON.stringify({ ...t, inputs: [], tick_count: 0 })));
    const mouths = (run) => run.world.teleporters.filter((t) => t.runtime === 'tentacle_beast_mouth')
        .map((t) => `${t.x},${t.y}->L${t.to}@${t.playerx},${t.playery}`);

    it('ON, at the build (no advance): the mouth (96,64) → L58 (56,96) stands', () => {
        withContactFidelity({ tentacleBeastFight: true }, () => {
            expect(mouths(createRunForStaging(stagingOf(revisit), SRC))).toEqual(['96,64->L58@56,96']);
        });
    });

    it('OFF, and ON with the beast alive: no mouth at the build', () => {
        expect(mouths(createRunForStaging(stagingOf(revisit), SRC))).toEqual([]);
        withContactFidelity({ tentacleBeastFight: true }, () => {
            expect(mouths(createRunForStaging(stagingOf(base), SRC))).toEqual([]);
        });
    });

    it('ON, the revisit walk: into L58 at t162 at (64,104), as the game', () => {
        withContactFidelity({ tentacleBeastFight: true }, () => {
            const st = createTapeStepper(parseTape(JSON.stringify(revisit)), { levelSource: SRC });
            let first = null;
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                if (first === null && o.level === 58) first = { t: o.t, x: o.x, y: o.y };
                r = st.next();
            }
            expect(first).toEqual({ t: 162, x: 64, y: 104 });
        });
    });
});

/**
 * ⛓⛓ fidelity BOSSFORK D1b — A REACH-EXIT AT THE MOUTH, ASKED WHILE THE BEAST IS DYING. The report lands as "dying"
 * starts and the mouth only when it ends, so a reach-exit asked in between (the JS page's continue request, sweep leg
 * 505 at t2866) found no teleporter and refused. `awaitTentacleMouth` idles until the run builds it. Staged on
 * `tb-solve-s2`: the witness's own keys to t789 (the report is t787), then the reach-exit alone: the continuation is the
 * witness's tape, tick for tick, into L58.
 *
 * Mutant (predicted, copy + restore): drop the `awaitTentacleMouth(goal)` call → the row reds with "no teleporter at
 * (96,64)".
 */
describe('bossfork D1b — a reach-exit at the mouth waits out "dying" (`awaitTentacleMouth`)', () => {
    it('from t789 (report t787, "dying", no mouth yet) the walk idles, then leaves by the mouth: the witness\'s tape', () => {
        const w = witnesses.find((x) => x.name === 'tb-solve-s2');
        const staging = stagingFromTape(parseTape(JSON.stringify({ ...w.tape, inputs: [], tick_count: 0 })));
        const per = Array.from({ length: w.tape.tick_count }, () => new Set());
        for (const i of w.tape.inputs) for (let t = i.from; t < i.to; t += 1) per[t].add(i.key);
        withContactFidelity({ tentacleBeastFight: true }, () => {
            const run = createRunForStaging(staging, SRC);
            for (let t = 0; t < 789; t += 1) run.advance(per[t]);
            const f = run.entities('tentacleBeastFight');
            expect([f.beast.anim, f.mouth, f.report]).toEqual(['dying', null, { tag: 0 }]);
            const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 64 } }], name: 'd1b',
                boot: staging.boot, prefix: per.slice(0, 789) });
            expect(run.level).toBe(58);
            expect(out.perTick.map((k) => [...k].sort().join('+'))).toEqual(per.map((k) => [...k].sort().join('+')));
        });
    }, 120000);
});
