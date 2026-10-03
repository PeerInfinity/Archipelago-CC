/**
 * fidelityF4 — Seedling fidelity F4: a static "Enemy" body's ARROW DEATH (L8's
 * sandtraps), so the solver plans L8 from either state.
 *
 * ⚖ The user, 2026-10-03: the solver must handle L8 with the sandtraps already
 * cleared or not, know which state it is in, and neither clear the save nor
 * leave and re-enter the room.
 *
 * D1, ON THE GAME (`f4-l8-sandtraps`, recorded twice; `fixtures/f4-sandtraps-oracle.json`
 * holds the game's own SandTrap rows). An arrow is `Enemy.hit(5, p)`: one damage,
 * 30 i-frames that only the body's own update runs down (29 on the hit's own
 * observation), so the volley that lands is the first after `hitsTimer` reaches 0
 * (t164, t197, t230 on a 11-tick cadence). `SandTrap.knockback` is empty. The
 * third hit plays "die", six frames at rate 10: 19 updates, the first on the
 * killing tick, and `endAnim` removes the body on the 19th (t248), when
 * `removed()` writes the tag: the body is gone and `persistence_cleared` carries
 * {8,0} on the same observation. `sandtrap@96,128`: t564, t597, t630, gone t648.
 *
 * D2, THE MODEL: `levelRun` steps the body (`staticBodyStates`, `enemyHit` and the
 * chasers' sprite stepper, in the body's own slot), removes it on that tick and
 * writes the tag through its channel (`staticBodyDeaths`: declared, scratch or
 * earned). The solver's static arm then holds until the LIVE room has no body.
 *
 * ── THE MUTATION LIST (run during development, copy + restore) ──
 *
 *   m1 the death off: `applyArrowHit`'s static arm never starts "die"
 *        -> the oracle rows red from t230, and the uncleared solver row declines
 *           with a `BotDriverV2Error` whose message names the F4 refusal (the
 *           hold's bound runs out on a body the run computes)
 *   m2 the §11.4 lift reverted: `STATIC_ARROW_DEATH.SandTrap.policy` 'refused'
 *        -> the three uncleared-state solver rows decline with the OLD
 *           `PendingDeclaration` {source 'game'} and the old §11.4 words; the
 *           both-cleared row stays green
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTape } from './fixtures/index.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { solveSegment } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import {
    CORPSE_COUNTING, KILL_SIDE_WRITES, STATIC_ARROW_DEATH, createStaticBodyDamage, removalTicksAfterHit,
} from './enemyDamage.js';
import { animTicks } from './chasers.js';
// The JS arc's modules, imported read-only: the staging and the arrival goal.
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal } from './wasmArrival.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'f4-sandtraps-oracle.json'), 'utf8'));
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const RECS = indexLevels(MAP);
const SRC = levelSourceFromAtlas(RECS);

/**
 * Replay a tape; per tick in L8, the LIVE room's sandtraps as the game's
 * `botMobiles()` rows read them: `[x, y, hits, hits_timer, die index | null]`,
 * sorted by y. A body the run removed is gone; one no arrow has reached is the
 * census row, unhit.
 */
function sandtrapsPerTick(tape) {
    let run = null;
    const perTick = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        if (!run || run.level !== 8) continue;
        const live = new Map(run.entities('staticBodies').map((b) => [b.id, b]));
        const ids = new Set([
            ...(run.world.combat?.enemies ?? []).filter((e) => e.as3 === 'SandTrap').map((e) => `${e.tag}@${e.x},${e.y}`),
            ...live.keys(),
        ]);
        const rows = [];
        for (const id of ids) {
            const b = live.get(id);
            if (b?.removed) continue;
            const [x, y] = id.split('@')[1].split(',').map(Number);
            rows.push([x + 8, y + 8, b?.hits ?? 0, b?.hitsTimer ?? 0, b?.dying ? b.dieIndex : null]);
        }
        perTick[o.t] = rows.sort((a, b) => a[1] - b[1]);
    }
    return { run, perTick };
}

describe('F4 D1/D2 — the sandtraps\' arrow death is the game\'s, row for row', () => {
    for (const name of Object.keys(ORACLE.tapes)) {
        it(`⛓⛓⛓ ${name}: every sandtrap on every sampled L8 tick is the game's (position, hits, i-frames, "die" frame, presence)`, () => {
            const { perTick } = sandtrapsPerTick(loadTape(name));
            let first = null;
            let compared = 0;
            for (const [t, game] of ORACLE.tapes[name]) {
                compared += 1;
                const m = JSON.stringify(perTick[t] ?? null);
                if (m !== JSON.stringify(game) && !first) first = `t${t}: game ${JSON.stringify(game)}, model ${m}`;
            }
            expect(first).toBeNull();
            expect(compared).toBe(ORACLE.tapes[name].length);
        });
    }

    it('⛓⛓ the death ticks: three arrows, "die" from the third, removed 18 ticks later — and the game\'s flags land on the removal', () => {
        const { run } = sandtrapsPerTick(loadTape('f4-l8-sandtraps'));
        const deaths = run.staticBodyDeaths.map((d) => [d.id, d.killedAt, d.removedAt, d.write, d.declaredAt]);
        expect(deaths).toEqual([
            ['sandtrap@96,80', 230, 248, 'declared', 248],
            ['sandtrap@96,128', 630, 648, 'declared', 648],
        ]);
        expect(ORACLE.cleared['f4-l8-sandtraps']).toEqual({ '8,0': 248, '8,1': 648 });
        const landed = run.arrowBodyHits.filter((h) => h.arm === 'static-body' && h.damaged)
            .map((h) => [h.body, h.t, h.hitsAfter]);
        expect(landed).toEqual([
            ['sandtrap@96,80', 164, 1], ['sandtrap@96,80', 197, 2], ['sandtrap@96,80', 230, 3],
            ['sandtrap@96,128', 564, 1], ['sandtrap@96,128', 597, 2], ['sandtrap@96,128', 630, 3],
        ]);
    });

    it('⛓ the committed declarations the model now disagrees with, by the game\'s own removal ticks', () => {
        // ⛓ fidelity F5 re-recorded r8-solve-8: it declared {8,0}@246 and {8,1}@645 (the
        // game removes them on t248 and t648); the re-solve declares neither, and the run's
        // own death EARNS both tags on the game's ticks (recorded on the game, F5 D2:
        // "sandtrap@96,80 -> 8:0 (removed t248, earned)"). The oracle's r8-solve-8 rows were
        // sampled on the pre-F5 walk, which is the same walk until t247.
        const r8 = sandtrapsPerTick(loadTape('r8-solve-8')).run.staticBodyDeaths
            .map((d) => [d.id, d.removedAt, d.write, d.declaredAt]);
        expect(r8).toEqual([['sandtrap@96,80', 248, 'earned', null], ['sandtrap@96,128', 648, 'earned', null]]);
        expect(loadTape('r8-solve-8').persistence.filter((p) => p.level === 8 && p.at !== undefined)).toEqual([]);
        expect(ORACLE.cleared['r8-solve-8']).toEqual({ '8,0': 248, '8,1': 648 });
        // r7-act2-full declares {8,0}@2515 and {8,1}@3067; the game removes them on t2383 and t2905.
        const r7 = sandtrapsPerTick(loadTape('r7-act2-full')).run.staticBodyDeaths
            .map((d) => [d.id, d.removedAt, d.declaredAt]);
        expect(r7).toEqual([['sandtrap@96,80', 2383, 2515], ['sandtrap@96,128', 2905, 3067]]);
        expect(ORACLE.cleared['r7-act2-full']).toEqual({ '8,0': 2383, '8,1': 2905 });
    });

    it('⛓ the class rows: an `anim` corpse (no fade), its own tag written on removal, 19 die updates', () => {
        expect(CORPSE_COUNTING.SandTrap.shape).toBe('anim');
        expect(KILL_SIDE_WRITES.SandTrap.writes).toBe('ownTag');
        const anim = STATIC_ARROW_DEATH.SandTrap.dieAnim;
        expect(animTicks(anim.frames, anim.rate)).toBe(19);
        expect(removalTicksAfterHit('SandTrap', 19)).toBe(19);
        expect(createStaticBodyDamage('SandTrap')).toMatchObject({ hitsMax: 3, hitsTimerMax: 30, hits: 0 });
        expect(() => createStaticBodyDamage('Cactus')).toThrow(/§11.4 refuses to compute a static "Enemy" body's arrow death/);
        expect(Object.keys(STATIC_ARROW_DEATH)).toEqual(['SandTrap']);
    });
});

describe('F4 D2 — the L8 arrival solves from all four boot states (the JS arc\'s staging, read-only)', () => {
    const GOAL = { kind: 'exit', level: 8, tiles: [[6, 12]], name: 'out_teleporter_96_192' };
    const arrive = (clears, { scratch = true } = {}) => {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [8, 144, 48] }]);
        rt.tick();
        const staging = { ...rt.session.staging, persistence: [...rt.session.staging.persistence, ...clears] };
        const m = arrivalSolverGoal(GOAL, { staging, levelSource: SRC, record: RECS.get(8) });
        const run = createRunForStaging(staging, SRC, { scratchPersistence: scratch });
        try {
            return { run, out: solveSegment({ run, goals: [m.goal], name: 'l8', boot: staging.boot }) };
        } catch (e) {
            return { run, err: e };
        }
    };
    const keyOf = (s) => [...s].sort().join('+');
    const heldAt = (tape, k) => tape.inputs.filter((s) => s.from <= k && k < s.to).map((s) => s.key).sort().join('+');

    it('⛓⛓⛓ NEITHER cleared: solves in 827 ticks, zero hits, the scratch layer writes {8,0} and {8,1} on the game\'s ticks — and it IS the recorded game witness', () => {
        const { run, out, err } = arrive([]);
        expect(err).toBeUndefined();
        expect(out.perTick.length).toBe(827);
        expect(run.playerHits).toEqual([]);
        expect(run.scratchClears.map((c) => [c.level, c.tag, c.declaredAt, c.by]))
            .toEqual([[8, 0, 248, 'sandtrap@96,80'], [8, 1, 648, 'sandtrap@96,128']]);
        // `f4-l8-sandtraps` was recorded on the game (zero hits, the flags on t248 and t648).
        const witness = loadTape('f4-l8-sandtraps');
        expect(witness.tick_count).toBe(out.perTick.length);
        const diff = out.perTick.findIndex((s, k) => keyOf(s) !== heldAt(witness, k));
        expect(diff).toBe(-1);
    });

    it('⛓⛓ {8,0} only: solves in 650 ticks, zero hits, and kills only the body that is there', () => {
        const { run, out, err } = arrive([{ level: 8, tag: 0 }]);
        expect(err).toBeUndefined();
        expect(out.perTick.length).toBe(650);
        expect(run.playerHits).toEqual([]);
        expect(run.staticBodyDeaths.map((d) => [d.id, d.removedAt])).toEqual([['sandtrap@96,128', 436]]);
    });

    it('⛓⛓ {8,1} only: solves in 509 ticks, zero hits', () => {
        const { run, out, err } = arrive([{ level: 8, tag: 1 }]);
        expect(err).toBeUndefined();
        expect(out.perTick.length).toBe(509);
        expect(run.playerHits).toEqual([]);
        expect(run.staticBodyDeaths.map((d) => [d.id, d.removedAt])).toEqual([['sandtrap@96,80', 248]]);
    });

    it('⛓ BOTH cleared: solves in 294 ticks, zero hits, and nothing dies', () => {
        const { run, out, err } = arrive([{ level: 8, tag: 0 }, { level: 8, tag: 1 }]);
        expect(err).toBeUndefined();
        expect(out.perTick.length).toBe(294);
        expect(run.playerHits).toEqual([]);
        expect(run.staticBodyDeaths).toEqual([]);
    });

    it('⛓ a run with no scratch layer solves the same keys and banks the tags for the next build', () => {
        const scratch = arrive([]);
        const plain = arrive([], { scratch: false });
        expect(plain.err).toBeUndefined();
        expect(plain.out.perTick.map(keyOf)).toEqual(scratch.out.perTick.map(keyOf));
        expect(plain.run.staticBodyDeaths.map((d) => [d.id, d.write])).toEqual([
            ['sandtrap@96,80', 'earned'], ['sandtrap@96,128', 'earned'],
        ]);
        expect(plain.run.scratchClears).toEqual([]);
    });
});

describe('F4 — a staging that boots with a tag cleared builds the room without that body', () => {
    it('⛓ {8,0} booted cleared: the run never has `sandtrap@96,80` to hit', () => {
        const base = loadTape('r8-solve-8');
        const staging = { ...stagingFromTape(base), persistence: [{ level: 8, tag: 0 }] };
        const run = createRunForStaging(staging, SRC);
        expect((run.world.combat?.enemies ?? []).map((e) => `${e.tag}@${e.x},${e.y}`)
            .filter((id) => id.startsWith('sandtrap'))).toEqual(['sandtrap@96,128']);
    });
});
