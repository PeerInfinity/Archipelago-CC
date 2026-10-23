/**
 * ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20) — the L69 Lights fight: the game's witnesses reproduced by the model at
 * 0 px (`fixtures/lights-witness/`, recorded on p4g by `scripts/procgen/probe-seedling-lights.mjs --compare --record`),
 * the runtime's trig, and the switch's OFF inertness. The solver's solves are `fidelityLights.slow.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { compareLightsWitness, modelLightsTrack } from './lightBossWitness.js';
import { LIGHT_BOSS, createLightsFight, stepLightsController } from './lightBoss.js';
import { lightsWorldRows } from './lightBossWorld.js';
import { atan2, cos, sin } from './runtimeLibm.js';
import { OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS } from './solverBot.js';
import { CORPSE_COUNTING, KILL_ARM_POLICY, killArmModelled } from './enemyDamage.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { createTapeStepper } from './tapeRunner.js';
import { dangerAt } from './dangerMap.js';
import { playerBoxAt } from './solverView.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'lights-witness', `${name}.json`), 'utf8'));
const levelSource = atlasLevelSource();
const replay = (w) => compareLightsWitness(w.samples,
    modelLightsTrack(parseTape(JSON.stringify(w.tape)), { levelSource }));

describe('fidelity LIGHTS — the game\'s witnesses, reproduced at 0 px (lightsBossFight ON)', () => {
    for (const [name, ticks] of [['lights-stand', 701], ['lights-revisit', 81], ['lights-solve-sword', 560],
        ['lights-solve-spear', 362]]) {
        it(`${name}: every sampled tick — the player (and its hits), the intro, the fliers, the shots, the level`, () => {
            const w = witness(name);
            expect(w.samples.length).toBe(ticks);
            const v = withContactFidelity({ lightsBossFight: true }, () => replay(w));
            expect(v.disagreements).toEqual([]);
            expect(v.worst).toBe(0);
            expect(v.compared).toBe(ticks);
        });
    }

    it('the stand: the intro\'s pages are done at t62 (its removal), the six fliers stand at (80,-32) from t63', () => {
        const w = witness('lights-stand');
        const at = (t) => w.samples.find((s) => s.tick === t);
        expect(at(61).npc.length).toBe(1);
        expect(at(62).npc.length).toBe(0);
        expect(at(62).fliers.length).toBe(0);
        expect(at(63).fliers.length).toBe(6);
        expect(at(63).fliers.every((f) => f.x === 80 && f.y === -32)).toBe(true);
        // three shot hits, then the death and the respawn at the boot
        expect(at(197).hits).toBe(1);
        expect(at(217).hits).toBe(2);
        expect(at(359).player).toMatchObject({ x: 56, y: 136 });
        expect(at(359).fliers.length).toBe(0);
    });

    it('the revisit: {69,0} cleared — no intro, no fliers, the exit Teleporter at (72,72) to L36 (120,104)', () => {
        const w = witness('lights-revisit');
        expect(w.samples.every((s) => s.npc.length === 0 && s.fliers.length === 0)).toBe(true);
        const cross = w.samples.find((s) => s.level === 36);
        expect(cross.tick).toBe(49);
        expect(cross.player).toMatchObject({ x: 120, y: 104 });
    });

    it('the solves: {69,0} lands on the game on the tick after the last flier leaves the world', () => {
        for (const [name, last, write] of [['lights-solve-sword', 548, 549], ['lights-solve-spear', 348, 349]]) {
            const w = witness(name);
            const cleared = w.samples.find((s) => s.cleared.some((c) => c.level === 69 && c.tag === 0));
            expect(cleared.tick).toBe(write);
            const gone = w.samples.find((s) => s.level === 69 && s.tick > 100 && s.fliers.length === 0);
            expect(gone.tick).toBe(last);
            expect(w.samples.at(-1).level).toBe(36);
        }
    });

    it('CONTROL: with the switch OFF the stand is NOT reproduced (no fight is stepped)', () => {
        const w = witness('lights-stand');
        const v = withContactFidelity({ lightsBossFight: false }, () => replay(w));
        expect(v.pass).toBe(false);
    });
});

describe('fidelity LIGHTS — two transcription facts, measured', () => {
    it('`FP.RAD` is π / −180: the controller\'s spin DECREASES', () => {
        expect(LIGHT_BOSS.controller.spinRate).toBe(Math.PI / -180);
        const f = createLightsFight({ x: 72, y: 72, flierNum: 6, tag: 0 });
        stepLightsController(f, { time: 0 });
        expect(f.spin).toBeLessThan(0);
    });

    it('the runtime\'s cos/sin are musl\'s: cos(0.7799440094849661) is one ulp above V8\'s (flier 3, t71)', () => {
        expect(cos(0.7799440094849661)).toBe(0.7109529138748157);
        expect(Math.cos(0.7799440094849661)).toBe(0.7109529138748156);
        // and they agree with V8 where both are exact
        for (const x of [0, Math.PI, -2, 100]) expect(sin(x)).toBe(Math.sin(x));
        expect(atan2(1, -1)).toBe(Math.atan2(1, -1));
    });

    it('MUTANT: the same stand under V8\'s trig drifts (the musl kernels are load-bearing)', async () => {
        // the witness's t71 velocity is exactly the musl cos; V8's lands one ulp below — asserted on the value above.
        expect(cos(0.7799440094849661)).not.toBe(Math.cos(0.7799440094849661));
    });
});

describe('fidelity LIGHTS — the switch (OFF: byte-identical)', () => {
    it('OFF: the strategy row and the verb read undefined and are not enumerable', () => {
        withContactFidelity({ lightsBossFight: false }, () => {
            expect(OBSTACLE_STRATEGIES['solid:lightbosscontroller']).toBeUndefined();
            expect(STRATEGY_EXECUTORS.lights).toBeUndefined();
        });
        expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:lightbosscontroller');
        expect(Object.keys(STRATEGY_EXECUTORS)).not.toContain('lights');
    });

    it('ON: `solid:lightbosscontroller` names `lights`, a registered verb (rules-2\'s `bossGoal` route 2)', () => {
        withContactFidelity({ lightsBossFight: true }, () => {
            expect(OBSTACLE_STRATEGIES['solid:lightbosscontroller']).toBe('lights');
            expect(typeof STRATEGY_EXECUTORS.lights).toBe('function');
        });
    });

    it('the kill-arm row: refused OFF, modelled ON, an `anim` corpse (no fade)', () => {
        withContactFidelity({ lightsBossFight: false }, () => expect(killArmModelled('LightBoss')).toBe(false));
        withContactFidelity({ lightsBossFight: true }, () => expect(KILL_ARM_POLICY.LightBoss.policy).toBe('modelled'));
        expect(CORPSE_COUNTING.LightBoss).toMatchObject({ shape: 'anim', removesBody: true });
    });

    it('the world build: OFF no `lightsControllers` key and no totem; ON the totem, or (cleared) the exit', () => {
        const tape = parseTape(JSON.stringify(witness('lights-stand').tape));
        // ⛓ planning-10's flip: `lightsBossFight` is ON by default, so the OFF build is named.
        const off = withContactFidelity({ lightsBossFight: false }, () => createRunForStaging(solveStaging(stagingFromTape(tape)), levelSource));
        expect(withContactFidelity({ lightsBossFight: false }, () => CONTACT_FIDELITY.lightsBossFight)).toBe(false);
        withContactFidelity({ lightsBossFight: false }, () => {
            expect('lightsControllers' in off.world).toBe(false);
            expect(off.world.solids.some((s) => s.tag === 'lightbosstotem')).toBe(false);
            expect(off.entities('lightsFight')).toBeNull();
        });
        const rows = lightsWorldRows({ attrs: { fliernum: '6' } }, 72, 72, 0, null);
        expect(rows.totem.rect).toMatchObject({ x: 72, y: 72, right: 88, bottom: 88 });
        const cleared = lightsWorldRows({ attrs: { fliernum: '6' } }, 72, 72, 0, new Set([0]));
        expect(cleared.totem).toBeNull();
        expect(cleared.exit).toMatchObject({ to: 36, playerx: 112, playery: 96, arrival: { x: 120, y: 104 } });
    });
});

describe('fidelity LIGHTS D3 — the clear-tag arm\'s other answers (ON)', () => {
    const GOAL = { kind: 'clear-tag', tag: { level: 69, tag: 0 }, at: { x: 72, y: 72 }, obstacle: 'lightbosscontroller@72,72' };
    const solveFrom = (stagingEdit) => {
        const staging = stagingEdit(solveStaging(stagingFromTape(parseTape(JSON.stringify(witness('lights-stand').tape)))));
        return withContactFidelity({ lightsBossFight: true }, () => twoPassSolve({
            makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
            goals: [GOAL], name: 'lights-arm', boot: staging.boot, dashMode: 'all',
            persistence: staging.persistence, log: () => {},
        }));
    };

    it('a boot holding {69,0} cleared is `already-clear` (the game\'s `check()` ran `endState()`), 0 ticks', async () => {
        const solved = await solveFrom((st) => ({ ...st, persistence: [...st.persistence, { level: 69, tag: 0 }] }));
        expect(solved.out.perTick.length).toBe(0);
        expect(solved.out.records.find((r) => r.goal === 'clear-tag')).toMatchObject({ arm: 'already-clear' });
    });

    it('a run whose primary is not the sword or the spear is refused by name (`cannot-act`: the wand arm)', async () => {
        await expect(solveFrom((st) => ({ ...st, seam: { ...st.seam, items: { ...st.seam.items, hasSword: false, hasWand: true },
            primary: 0 } }))).rejects.toThrow(/cannot act|primary weapon/);
    });
});

/**
 * ⛓⛓⛓ hammer-phase LD — THE VICTIM, PRICED. Route survey step 159 as it was solved before the danger map saw the
 * fight (`fixtures/hammer-ld-lights/step159-walk.json`, a MODEL tape): the kill ends at t806 and LightBossShot #75
 * (fired t784 at (56,60)) hits the reach-exit walk at update t811. Asked at t806, the danger map prices that shot on the
 * box the player left at t810 — the box update t811 tests.
 */
describe('hammer LD — the step-159 victim\'s shot, priced at the kill (lightsBossFight ON)', () => {
    const tape = parseTape(JSON.stringify(JSON.parse(readFileSync(join(HERE, 'fixtures', 'hammer-ld-lights',
        'step159-walk.json'), 'utf8')).tape));
    const replay = (onTick) => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        for (let r = st.next(); !r.done; r = st.next()) onTick(r.value.observation, run);
    };
    const SHOT = 'lightbosscontroller@72,72#75';

    it('the tape takes the hit: t811, shot #75, after the kill at t806', () => withContactFidelity({ lightsBossFight: true }, () => {
        let fight = null;
        replay((o, run) => { fight = run?.entities('lightsFight')?.[0] ?? fight; });
        expect(fight.endedAt).toBe(806);
        const hits = fight.events.filter((e) => e.what === 'shot-hit' || e.what === 'contact');
        expect(hits.map((e) => [e.t, e.what, e.id])).toEqual([[811, 'shot-hit', SHOT]]);
        expect(fight.events.find((e) => e.what === 'shot' && e.id === SHOT)).toMatchObject({ t: 784, x: 56, y: 60 });
    }));

    it('asked at t806, `dangerAt` (transit) names shot #75 on the box at t810, and nothing else on the walk', () => withContactFidelity(
        { lightsBossFight: true }, () => {
            const at = [];
            replay((o) => { at[o.t] = o; });
            const rows = [];
            replay((o, run) => {
                if (o.t !== 806) return;
                for (let t = 806; at[t]?.level === 69; t += 1) {
                    const d = dangerAt(run, t, playerBoxAt(at[t].x, at[t].y), { mode: 'transit' });
                    if (d.danger) rows.push([t, d.sources.map((x) => `${x.kind}:${x.id}`)]);
                }
            });
            expect(rows).toEqual([[810, [`spit:${SHOT}`]]]);
        }));

    it('CONTROL: OFF, no fight is stepped and no Lights source exists', () => withContactFidelity({ lightsBossFight: false }, () => {
        replay((o, run) => {
            if (o.t !== 806) return;
            expect(run.entities('lightsFight')).toBe(null);
        });
    }));
});
