/**
 * SEEDLING FIDELITY FORCEDHIT — ⚖ the user, 2026-10-11 ("Allow forced hits"): when an exhaustive input search proves
 * that EVERY crossing takes a hit, the solver may plan the least-damage crossing and bill the hit (`forcedHit.js`,
 * the combat ladder's last rung, behind `FORCED_HITS` = `CONTACT_FIDELITY.forcedHits`, OFF).
 *
 * The measured case is LEASH's leg 622 (L73, the arrival from L74, `lavarunner@72,24` diagonally adjacent): the game
 * bills the walker's crossing at t2 (`leash-l73-622-up-lavarunner`), and every input over 36 held sets is hit by t2.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY_DEFAULTS } from './contactFidelity.js';
import { FORCED_HITS, FORCED_HIT_ALPHABET, FORCED_HIT_TRACE, planForcedCrossing, proveForcedHit,
    withForcedHits, worldHitsOf } from './forcedHit.js';
import { KNOWN_STRATEGY_VERBS } from './decisionTrace.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal, arrivalSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const W622 = witness('leash-l73-622-up-lavarunner');
// ⛓ D3: the forced-hit plan's first three ticks, played on the GAME (p4f headless, `--player-hits`)
const WPLAN = witness('forcedhit-l73-622-plan');
const levelSource = atlasLevelSource();
/** A fork at L73's arrival, as the LEASH witness stages it (a fresh run each call — the proof's own contract). */
const fork622 = () => createRunForStaging(stagingFromTape(parseTape(JSON.stringify(W622.tape))), levelSource);

// ── leg 622's staging, as the divergence sweep's page holds it at sphere 7.3 (LEASH's `ITEMS_73`) ──
const ITEMS_73 = {
    hitsMax: 3, hasTorch: true, hasDarkSuit: false, hasSpear: true, hasFeather: true, canSwim: true, hasFireWand: false,
    hasWand: true, hasFire: true, hasDarkShield: false, hasShield: true, hasGhostSword: false, hasDarkSword: false,
    hasSword: true,
};
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);

function solve622() {
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]);
    rt.tick();
    const s = rt.session.staging;
    const staging = { ...s, inventory_slots: [0, 1, 3, 2], seam: { ...s.seam, items: { ...s.seam.items, ...ITEMS_73 } } };
    const goal = { kind: 'exit', level: 73, tiles: [[4, 0]], name: 'level_73__r0c4 -> level_74' };
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(73) });
    const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
        scratchPersistence: true }), passes: ANYTIME_PASSES };
    const rows = [];
    FORCED_HIT_TRACE.sink = (r) => rows.push(r);
    try {
        return { res: createInPlaceProduceService().start(req).result, rows };
    } finally {
        FORCED_HIT_TRACE.sink = null;
    }
}

describe('FORCEDHIT — the switch, the alphabet, the verb', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_FORCED_HITS)('ships OFF, and `withForcedHits` restores it', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.forcedHits).toBe(false);
        expect(FORCED_HITS.enabled).toBe(false);
        expect(withForcedHits(true, () => FORCED_HITS.enabled)).toBe(true);
        expect(FORCED_HITS.enabled).toBe(false);
    });
    it('the alphabet: every direction or none, crossed with primary and secondary, each held set distinct', () => {
        expect(FORCED_HIT_ALPHABET.length).toBe(36);
        expect(new Set(FORCED_HIT_ALPHABET.map((k) => [...k].sort().join('+'))).size).toBe(36);
        expect(KNOWN_STRATEGY_VERBS).toContain('forced-hit');
    });
});

describe('FORCEDHIT D1 — the PROOF is a measured fact on the run, never a search that gave up', () => {
    it('leg 622: every input over 36 held sets is hit by t2 — proven at depth 2 (36 + 36² fork steps), least 1 hit', () => {
        const p = proveForcedHit(fork622);
        expect(p).toMatchObject({ proven: true, depth: 2, nodes: 1332, leaves: 1296, deadly: 0, minHits: 1,
            alphabet: 36 });
        // the GAME's hit: the body, the tick
        expect(p.best.every((l) => l.firstHit === 2 && l.hits === 1)).toBe(true);
    });
    it('a bound too shallow to close is NOT a proof: at depth 1 all 36 one-tick inputs are still hitless', () => {
        const p = proveForcedHit(fork622, { depthMax: 1 });
        expect(p.proven).toBe(false);
        expect(p.open).toBe(36);
        expect(p.why).toMatch(/36 prefix\(es\) of 1 tick\(s\) are still hitless .* no hit is proven forced/);
    });
    it('a budget that cannot finish a depth refuses BEFORE spending it (the whole depth or nothing)', () => {
        const p = proveForcedHit(fork622, { nodeBudget: 1000 });
        expect(p).toMatchObject({ proven: false, nodes: 36, depth: 2 });
        expect(p.why).toMatch(/depth 2 needs 1296 more fork step\(s\) than the budget's 964 — a search that gave up is not a proof/);
    });
    it('a proof asked deep in a segment is refused by its replay cost (every fork replays the segment so far)', () => {
        const p = proveForcedHit(fork622, { replayTicks: 1000 });
        expect(p).toMatchObject({ proven: false, nodes: 36, depth: 2 });
        expect(p.why).toMatch(/depth 2 needs 1296 fork\(s\), each replaying the segment's 1000 tick\(s\): 1298592 run ticks, over the advance budget's 563964/);
    });
    it('an input the model refuses to step leaves the proof open, by name', () => {
        const refusing = () => {
            const r = fork622();
            const advance = r.advance.bind(r);
            r.advance = (held) => {
                if (held.has('secondary')) throw new Error('levelRun: refused (the test\'s unmodelled input)');
                return advance(held);
            };
            return r;
        };
        const p = proveForcedHit(refusing);
        expect(p.proven).toBe(false);
        expect(p.why).toMatch(/the model refuses to step \[secondary\] .* an input with no answer leaves the proof open/);
    });
});

describe('FORCEDHIT D2 — the state a hit leaves is read off the run (`worldHitsOf`)', () => {
    it('after the hit it is the run\'s own `hits` (1, at t2, the lavarunner); a door starts the next world at 0', () => {
        const r = fork622();
        r.advance(new Set(['up']));
        expect(worldHitsOf(r)).toEqual({ hits: 0, lastHitAt: null, id: null });
        r.advance(new Set(['up']));
        expect(worldHitsOf(r)).toEqual({ hits: 1, lastHitAt: 2, id: 'lavarunner@72,24' });
        expect(r.damage.hits).toBe(1);
        // the 20-tick i-frame the hit opened (`PLAYER_DAMAGE.hitsTimerMax`; the game reads 19 on the hit tick, D3), and
        // the knockback the ledger row carries
        expect(r.damage.hitsTimer).toBeGreaterThan(0);
        expect(r.ledger('playerHits')[0].knockback).not.toBe(null);
        let crossed = null;
        for (let i = 0; i < 10 && !crossed; i += 1) crossed = r.advance(new Set(['up'])).transition;
        expect(crossed).toMatchObject({ from_level: 73, to_level: 74 });
        expect(worldHitsOf(r).hits).toBe(0);
        expect(r.damage.hits).toBe(0);
    });
});

describe('FORCEDHIT D2 — the crossing: least damage, under the budget, never a death', () => {
    const proof = proveForcedHit(fork622);
    const wps = [{ x: 72, y: 8 }];
    const crossTo = { level: 74 };
    const opts = { crossTo, tolerance: 0, maxTicks: 400, contacts: new Set(), hitsMax: 3, hitsNow: 0, budgetLeft: 2 };
    it('the budget refuses a crossing that would leave the player one hit from death (hits 1 of 3, margin 1)', () => {
        const plan = planForcedCrossing(fork622, proof, wps, { ...opts, hitsNow: 1 });
        expect(plan.best).toBe(null);
        expect(plan.rejected[0].why).toMatch(/takes 1 hit\(s\), over the budget's 0 \(hits now 1, hitsMax 3, margin 1/);
    });
    it('…and a segment that has spent its budget', () => {
        const plan = planForcedCrossing(fork622, proof, wps, { ...opts, budgetLeft: 0 });
        expect(plan.best).toBe(null);
    });
});

describe('FORCEDHIT D2 — leg 622 (L73 → L74): OFF refuses EXHAUSTED; ON bills the one forced hit and crosses', () => {
    it('OFF: the refusal is the BEFORE one (the ladder EXHAUSTED on lavarunner@72,24), and the rung is absent', () => {
        const { res, rows } = withForcedHits(false, () => solve622());
        expect(res.ok).toBe(false);
        expect(res.message).toMatch(/the combat ladder is EXHAUSTED.*chaser:lavarunner@72,24/s);
        expect(res.message).not.toMatch(/forced-hit/);
        expect(rows).toEqual([]);
    });
    it('ON: SOLVED in 4 ticks by `forced-hit` — up, up, down+right, down+right — billing lavarunner@72,24 at t2', () => {
        const { res, rows } = withForcedHits(true, () => solve622());
        expect(res.ok).toBe(true);
        expect(res.plan.verbs).toEqual(['forced-hit']);
        expect(res.plan.solution.map((k) => [...k].sort())).toEqual([['up'], ['up'], ['down', 'right'], ['down', 'right']]);
        expect(res.plan.expected.at(-1)).toMatchObject({ level: 74, deaths: 0 });
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            expect(r).toMatchObject({ outcome: 'billed', candidate: 'corridor-unarmed', ticks: 4,
                proof: { proven: true, depth: 2, nodes: 1332, minHits: 1 },
                billed: [{ t: 2, level: 73, source: 'chaser', id: 'lavarunner@72,24', hits: 1 }] });
            // a door swaps the `Player`: the next room starts at 0 hits
            expect(r.damage.hits).toBe(0);
        }
    });
});

describe('FORCEDHIT D3 — the forced-hit plan on the GAME: the hit tick, the knockback and the i-frame, at 0 px', () => {
    it('the game witness replays: the player (position, hits, hits_timer) and lavarunner@72,24 at every sample', () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(WPLAN.tape)), { levelSource, onTick: (t, x, h, rn) => { run = rn; } });
        const bad = [];
        const game = new Map(WPLAN.samples.map((g) => [g.t, g]));
        let compared = 0;
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const g = game.get(o.t);
            if (g) {
                compared += 1;
                const d = run ? run.damage : { hits: 0, hitsTimer: 0 };
                if (o.x !== g.player.x || o.y !== g.player.y) bad.push(`t ${o.t}: player game (${g.player.x}, ${g.player.y}) model (${o.x}, ${o.y})`);
                if (d.hits !== g.player.hits || d.hitsTimer !== g.player.hits_timer) {
                    bad.push(`t ${o.t}: hits game ${g.player.hits}/${g.player.hits_timer} model ${d.hits}/${d.hitsTimer}`);
                }
                const live = (run ? run.entities('chasers') ?? [] : []).filter((c) => c.tag === 'lavarunner' && !c.removed);
                for (const gb of g.bodies) {
                    if (!live.some((c) => c.x === gb.x && c.y === gb.y && c.vx === gb.vx && c.vy === gb.vy
                        && c.hits === gb.hits && c.hitsTimer === gb.hits_timer)) bad.push(`t ${o.t}: game lavarunner (${gb.x}, ${gb.y}) has no model body`);
                }
            }
            r = st.next();
        }
        expect(bad).toEqual([]);
        expect(compared).toBe(4);
        // the game bills the one hit the proof forced, at t2, and opens its i-frame there
        expect(WPLAN.samples.map((g) => [g.player.hits, g.player.hits_timer])).toEqual([[0, 0], [0, 0], [1, 19], [1, 18]]);
        expect(run.ledger('playerHits').map((h) => [h.t, h.id])).toEqual([[2, 'lavarunner@72,24']]);
    });
    it('the witness\'s keys are the ON plan\'s first three ticks (the fourth crosses to L74)', () => {
        const tape = parseTape(JSON.stringify(WPLAN.tape));
        expect(tape.tick_count).toBe(3);
        expect(WPLAN.tape.inputs).toEqual([{ key: 'up', from: 0, to: 2 }, { key: 'right', from: 2, to: 3 },
            { key: 'down', from: 2, to: 3 }]);
    });
});
