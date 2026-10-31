/**
 * SEEDLING FIDELITY FORCEDHITXC (wave 36) — with `CONTACT_FIDELITY.secondaryUse` ON, the forced-hit rung crosses L73
 * leg 612/622 (`level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0`) by the game's HITLESS X+C.
 *
 * W0 (measured at main b646d32d95): ON, the proof found five one-tick X+C sets hitless at depth 2 (180 open prefixes,
 * first `[up+primary+secondary ·]`), depth 3 was over the node budget (6,480 forks vs 659 left), and the game's
 * crossing is at t4 (past `depthMax` 3) — so the rung refused EXHAUSTED. D1 (`forcedHit.continueHitless`): an open
 * hitless prefix is carried on by holding each alphabet member in order; the first that leaves the room with no hit is
 * the proof's `crossing`, and the rung walks it. At leg 622 the first open prefix carried on by holding `·` crosses at
 * t4: the plan `[up+primary+secondary, ·, ·, ·]`.
 *
 * The GAME witness (`fixtures/secondary-use-witness/secuse-l73-622-xc-stand.json`, p4g headless,
 * `probe-seedling-secondary-use.mjs --record`, recorded ×2 at this slice's port): that plan crosses to L74 at t4 with
 * 0 hits, and the `XC` arm beside it reproduces C4's `secuse-l73-622-xc` sample for sample.
 *
 * OFF (`secondaryUse` false, the shipped default) every verdict is byte-identical: the continuation is never asked.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { FORCED_HITS, FORCED_HIT_TRACE, crossingMatches, proveForcedHit, withForcedHits } from './forcedHit.js';
import { gunzipSync } from 'node:zlib';
import { ANYTIME_PASSES as PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { LAPSE_NARROW_RETRY } from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal, arrivalSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const json = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const W622 = json('fixtures', 'chaser-witness', 'leash-l73-622-up-lavarunner.json');
const WXC = json('fixtures', 'secondary-use-witness', 'secuse-l73-622-xc.json');
const WSTAND = json('fixtures', 'secondary-use-witness', 'secuse-l73-622-xc-stand.json');
const levelSource = atlasLevelSource();
const fork622 = () => createRunForStaging(stagingFromTape(parseTape(JSON.stringify(W622.tape))), levelSource);
const PLAN = [['up', 'primary', 'secondary'], [], [], []];
const sorted = (keys) => keys.map((k) => [...k].sort());

const ITEMS_73 = {
    hitsMax: 3, hasTorch: true, hasDarkSuit: false, hasSpear: true, hasFeather: true, canSwim: true, hasFireWand: false,
    hasWand: true, hasFire: true, hasDarkShield: false, hasShield: true, hasGhostSword: false, hasDarkSword: false,
    hasSword: true,
};
const RECS = new Map(indexLevels(json('..', 'flashPanel', 'atlases', 'seedling-map.json')));
const SRC = levelSourceFromAtlas(RECS);
/** Leg 622's solve, as FORCEDHIT's / STAGEDHITS' `solve622`. */
function solve622(playerDamage) {
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]);
    rt.tick();
    const s = rt.session.staging;
    const staging = { ...s, inventory_slots: [0, 1, 3, 2], seam: { ...s.seam, items: { ...s.seam.items, ...ITEMS_73 } },
        ...(playerDamage ? { player_damage: playerDamage } : {}) };
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

describe('FORCEDHITXC — the GAME witness of the ON plan (p4g, ×2)', () => {
    it('is the game\'s, recorded by the instrument on the C4 witness\'s base: two arms over 6 ticks', () => {
        expect(WSTAND).toMatchObject({ page: 'seedling_bot_ap_p4g', base: WXC.base, tick_count: 6,
            recordedBy: 'scripts/procgen/probe-seedling-secondary-use.mjs --record' });
        expect(Object.keys(WSTAND.arms)).toEqual(['XC-stand', 'XC']);
    });
    it('XC-stand (the plan: X+C+up on t0, then nothing held) crosses to L74 at t4 with 0 hits', () => {
        const s = WSTAND.arms['XC-stand'].samples;
        expect(s.map((r) => r.hits)).toEqual([0, 0, 0, 0, 0, 0, 0]);
        expect(s.map((r) => r.level)).toEqual([73, 73, 73, 73, 74, 74, 74]);
        expect(s[1]).toMatchObject({ x: 72, y: 21.2, vy: -2.8 });
    });
    it('the XC control reproduces C4\'s recording sample for sample (the game is deterministic here)', () => {
        expect(WSTAND.arms.XC.samples).toEqual(WXC.arms.XC.samples);
    });
});

describe('FORCEDHITXC D1 — the proof carries an open hitless prefix on to a crossing (ON only)', () => {
    let witnessFirst;
    beforeEach(() => { witnessFirst = CONTACT_FIDELITY.forcedHitWitnessFirst; });
    afterEach(() => { CONTACT_FIDELITY.forcedHitWitnessFirst = witnessFirst; });
    const prove = (over, opts) => withContactFidelity(over, () => proveForcedHit(fork622, opts));

    it('OFF: the BEFORE verdict, byte for byte — proven at depth 2, no continuation asked', () => {
        const p = prove({ secondaryUse: false, forcedHitWitnessFirst: false });
        expect(p).toMatchObject({ proven: true, depth: 2, nodes: 1332, minHits: 1 });
        expect(p).not.toHaveProperty('crossing');
        expect(p).not.toHaveProperty('continuation');
    });
    it('OFF: an OPEN verdict stays the BEFORE one too — no continuation, no crossing (depth 1: 36 hitless prefixes)', () => {
        const p = prove({ secondaryUse: false, forcedHitWitnessFirst: false }, { depthMax: 1 });
        expect(p).toEqual({ proven: false, nodes: 36, depth: 1, leaves: 0, open: 36, hitless: '·',
            why: '36 prefix(es) of 1 tick(s) are still hitless (first [·]) — no hit is proven forced inside the bound' });
    });
    it('ON: the open prefix [up+primary+secondary ·] held on `·` leaves L73 for L74 at t4, hitless — one more fork', () => {
        const p = prove({ secondaryUse: true, forcedHitWitnessFirst: false });
        expect(p).toMatchObject({ proven: false, depth: 3, nodes: 1333, open: 180, hitless: 'up+primary+secondary · · ·',
            continuation: { nodes: 1 } });
        expect(sorted(p.crossing.keys)).toEqual(sorted(PLAN));
        expect(p.crossing).toMatchObject({ ticks: 4, transition: { from_level: 73, to_level: 74 } });
        expect(p.openWhy).toMatch(/180 prefix\(es\) of 2 tick\(s\) are still hitless .*depth 3 needs 6480 more/);
        expect(p.why).toMatch(/carried on by holding \[·\] leaves level 73 for 74 at tick 4/);
    });
    it('ON with the witness first (the default): the nine witness forks, then the same crossing', () => {
        const p = prove({ secondaryUse: true, forcedHitWitnessFirst: true });
        expect(p).toMatchObject({ proven: false, nodes: 1342, hitless: 'up+primary+secondary · · ·' });
        expect(sorted(p.crossing.keys)).toEqual(sorted(PLAN));
    });
    it('ON: the crossing is the GAME\'s — the model steps its keys onto every XC-stand sample (0 px, 0 hits)', () => {
        withContactFidelity({ secondaryUse: true, forcedHitWitnessFirst: false }, () => {
            const keys = proveForcedHit(fork622).crossing.keys;
            const run = fork622();
            const hits = () => (run.ledger('playerHits') ?? []).length;
            const rows = [{ t: 0, level: run.level, x: run.state.x, y: run.state.y, hits: 0 }];
            for (const k of keys) {
                run.advance(new Set(k));
                rows.push({ t: rows.length, level: run.level, x: run.state.x, y: run.state.y, hits: hits() });
            }
            expect(rows).toEqual(WSTAND.arms['XC-stand'].samples.slice(0, 5)
                .map((s) => ({ t: s.t, level: s.level, x: s.x, y: s.y, hits: s.hits })));
        });
    });
    it('ON: a continuation the budget cannot afford leaves the proof open, saying so (no crossing invented)', () => {
        const p = prove({ secondaryUse: true, forcedHitWitnessFirst: false }, { nodeBudget: 1332 });
        expect(p).toMatchObject({ proven: false, nodes: 1332, continuation: { nodes: 0 } });
        expect(p.continuation.why).toMatch(/ran out of budget after 0 fork/);
        expect(p).not.toHaveProperty('crossing');
    });
    it('ON: a horizon short of the door is not a crossing — the proof stays open on its own verdict', () => {
        const ticks = FORCED_HITS.continuationTicks;
        const forks = FORCED_HITS.continuationForks;
        FORCED_HITS.continuationTicks = 3;
        try {
            // the shipped cap: 36 forks (one alphabet's width) of the 6,480 (prefix, hold) pairs, not the 668 left
            const p = prove({ secondaryUse: true, forcedHitWitnessFirst: false });
            expect(p).not.toHaveProperty('crossing');
            expect(p.why).toMatch(/180 prefix\(es\) of 2 tick\(s\) are still hitless/);
            expect(p).toMatchObject({ nodes: 1332 + 36, continuation: { nodes: 36 } });
            expect(p.continuation.why).toMatch(/ran out of budget after 36 fork/);
            // with room for every pair (the tree stopped at depth 2, its bound), none leaves the room inside 3 ticks
            FORCED_HITS.continuationForks = 6480;
            const q = prove({ secondaryUse: true, forcedHitWitnessFirst: false }, { depthMax: 2, nodeBudget: 1332 + 6480 });
            expect(q).not.toHaveProperty('crossing');
            expect(q.continuation).toMatchObject({ nodes: 6480 });
            expect(q.continuation.why).toMatch(/no hitless continuation .* within 3 tick/);
        } finally {
            FORCED_HITS.continuationTicks = ticks;
            FORCED_HITS.continuationForks = forks;
        }
    });
    it('ON: a quiet room (hitless, never left) costs at most the cap — one alphabet\'s width — after the witness', () => {
        let forks = 0;
        const quiet = () => {
            forks += 1;
            return { ledger: () => [], advance: () => ({ transition: null }) };
        };
        const p = withContactFidelity({ secondaryUse: true, forcedHitWitnessFirst: true },
            () => proveForcedHit(quiet, { replayTicks: 134 }));
        expect(p).toMatchObject({ proven: false, witness: true, nodes: 1 + 36, continuation: { nodes: 36 } });
        expect(p).not.toHaveProperty('crossing');
        expect(forks).toBe(37);
    });
});

describe('FORCEDHITXC D2 — leg 622 solves by the game\'s hitless X+C (ON); OFF is the forced hit', () => {
    it('OFF: the FORCEDHIT plan — up, up, down+right, down+right — billing the lavarunner at t2', () => {
        const { res } = withContactFidelity({ secondaryUse: false }, () => withForcedHits(true, () => solve622()));
        expect(res.ok).toBe(true);
        expect(sorted(res.plan.solution)).toEqual([['up'], ['up'], ['down', 'right'], ['down', 'right']]);
    });
    it('ON: SOLVED in 4 ticks, the game\'s XC-stand keys, crossing to L74 with 0 hits billed', () => {
        const { res, rows } = withContactFidelity({ secondaryUse: true }, () => withForcedHits(true, () => solve622()));
        expect(res.ok).toBe(true);
        expect(res.plan.verbs).toEqual(['forced-hit']);
        expect(sorted(res.plan.solution)).toEqual(sorted(PLAN));
        expect(res.plan.expected.at(-1)).toMatchObject({ level: 74, deaths: 0 });
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            expect(r).toMatchObject({ outcome: 'hitless', candidate: 'hitless-continuation', billed: [], ticks: 4,
                proof: { proven: false } });
            expect(r.damage.hits).toBe(0);
        }
    });
    it('ON: the game\'s damage staged (1 or 2 of 3) does not matter — the hitless crossing bills nothing', () => {
        for (const hits of [1, 2]) {
            const { res, rows } = withContactFidelity({ secondaryUse: true },
                () => withForcedHits(true, () => solve622({ hits, hits_timer: 0 })));
            expect(res.ok).toBe(true);
            expect(sorted(res.plan.solution)).toEqual(sorted(PLAN));
            expect(rows.every((r) => r.outcome === 'hitless')).toBe(true);
        }
    });
});

describe('FORCEDHITXC D3 — a crossing is the walk\'s only by the walk\'s OWN exit (`crossingMatches`)', () => {
    const t = (over) => ({ transition: { to_level: 74, before: { x: 72, y: 16.35 }, landing: { x: 296, y: 136 }, ...over } });
    it('the drive\'s test: the level AND the arrival point exactly; a pit by the pre-move probe; no points, no match', () => {
        expect(crossingMatches(t(), { level: 74, arrival: { x: 296, y: 136 } })).toBe(true);
        expect(crossingMatches(t(), { level: 74, arrival: { x: 288, y: 144 } })).toBe(false);
        expect(crossingMatches(t(), { level: 73, arrival: { x: 296, y: 136 } })).toBe(false);
        expect(crossingMatches(t(), { level: 74, pit: { rect: { x: 64, y: 8, right: 80, bottom: 24 } } })).toBe(true);
        expect(crossingMatches(t(), { level: 74, pit: { rect: { x: 200, y: 200, right: 216, bottom: 216 } } })).toBe(false);
        expect(crossingMatches(t({ before: undefined }), { level: 74, arrival: { x: 296, y: 136 } })).toBe(false);
        expect(crossingMatches(t(), null)).toBe(false);
    });
    it('leg 622\'s continuation, asked with the leg\'s exit, still crosses — it IS that exit', () => {
        const p = withContactFidelity({ secondaryUse: true, forcedHitWitnessFirst: false },
            () => proveForcedHit(fork622, { crossTo: { level: 74, arrival: { x: 296, y: 136 } } }));
        expect(p.crossing).toMatchObject({ ticks: 4 });
        const q = withContactFidelity({ secondaryUse: true, forcedHitWitnessFirst: false },
            () => proveForcedHit(fork622, { crossTo: { level: 74, arrival: { x: 0, y: 0 } } }));
        expect(q).not.toHaveProperty('crossing');
        expect(q.continuation.why).toMatch(/ran out of budget after 36 fork\(s\) \(\d+ left by another exit\)/);
    });
    it('L40 leg 403 (`… <- in_L43_176_464 -> exit:out_pit_13_20`, LAPSECOST\'s request at budget 160): ON refuses as OFF '
        + 'does — the continuation\'s hitless `up` leaves by the ARRIVAL door (L43 too), not the pit', () => {
        const line = JSON.parse(gunzipSync(readFileSync(join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports',
            'seedling-fidelity-lapsecost-evidence', 'd1', 'leg-403-requests.jsonl.gz'))).toString('utf8').split('\n')[0]);
        const req = restoreRequest(line.requests[0].request);
        const { passes = PASSES, source, ...tape } = req;
        const solve = (su) => {
            const rows = [];
            FORCED_HIT_TRACE.sink = (r) => rows.push(r);
            LAPSE_NARROW_RETRY.enabled = false;
            try {
                const res = withContactFidelity({ strikeIframeLapse: true, secondaryUse: su }, () => solveAnytime(
                    { ...tape, budgetWork: 160, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }));
                return { res, rows };
            } finally {
                LAPSE_NARROW_RETRY.enabled = true;
                FORCED_HIT_TRACE.sink = null;
            }
        };
        const off = solve(false);
        const on = solve(true);
        for (const { res } of [off, on]) {
            expect(res.ok).toBe(false);
            expect(res.passes[0]).toMatchObject({ pass: 'dashless', ok: false, deadline: 'detour', limit: 'budget' });
        }
        expect(on.res.message).toBe(off.res.message);
        expect(off.rows.map((r) => [r.outcome, r.proof.nodes])).toEqual([['not-proven', 1]]);
        expect(on.rows.map((r) => [r.outcome, r.proof.nodes])).toEqual([['not-proven', 37]]);
    }, 60000);
});
