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
            };
            r = st.next();
        }
    });
    return out;
}
const rows = (a) => a.map((p) => p.join(',')).sort();

describe('bosskills D3 — the game witnesses, at 0 px (the switch ON)', () => {
    it('there are four, each recorded on p4g', () => {
        expect(witnesses.map((w) => w.name)).toEqual(['tb-death-s3', 'tb-idle-s1', 'tb-policy-s2', 'tb-solve-s2']);
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

    it('OFF: the clear-tag refuses, and the refusal names the switch', () => {
        const staging = stagingFromTape(tapeOf({}));
        const run = createRunForStaging(staging, SRC);
        let e = null;
        try { solveSegment({ run, goals: goals.slice(0, 1), name: 'tb-off', boot: staging.boot }); } catch (x) { e = x; }
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/tentacleBeastFight/);
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
