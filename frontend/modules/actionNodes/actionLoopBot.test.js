/**
 * The live bot (design §7, AN-3a): the registry entry's `loopBot.planLoop` over the COMMITTED example, its Loops path,
 * and the path played headless through the real runtime gate (`actionLiveSim.js`). Every node, price and item is read
 * from the preset.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime, getActionNodesRuntime } from './actionNodesRuntime.js';
import { hopsBetween, planLiveLoop, plannerModelOf, routeOfPlan } from './actionLoopBot.js';
import { playLiveToGoal } from './actionLiveSim.js';
import { PLAN_KINDS, planLoop, playToGoal } from './actionPlanner.js';
import { buildActionModel, loopStartState, perform, isReached } from './actionModel.js';
import { placementsFromRules } from './actionGraphCompiler.js';
import { substrateRegistryEntry } from './actionNodesLibrary.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
const P = '1';
const BLOCK = RULES.action_nodes[P];
const START_REGION = RULES.start_regions[P].default[0];
const GRAPH = JSON.parse(readFileSync(join(HERE, '../../..', RULES.procgen_metadata[P].graph_path), 'utf8'));

function loaded() {
    const rt = new ActionNodesRuntime({ ledger: () => new ResourceLedger(), publish: () => {}, dispatch: () => {} });
    rt.loadWorld(RULES, P);
    return rt;
}

describe('the loop plan as a Loops path', () => {
    const rt = loaded();
    const live = planLiveLoop({ model: rt.model, startRegion: START_REGION });

    it('is the pure planner\'s plan (same kind, same performances, same reasoning)', () => {
        const model = plannerModelOf(rt.model);
        const pure = planLoop(model, { start: loopStartState(model, {}) });
        expect(live.kind).toBe(pure.kind);
        expect(live.plan).toEqual(pure.plan);
        expect(live.lines).toEqual(pure.lines);
        expect(live.reason).toBe(pure.lines[0]);
    });

    it('starts with the hop from the start region to the start node', () => {
        expect(live.path[0]).toMatchObject({ type: 'regionMove', sourceRegion: START_REGION, destinationRegion: BLOCK.start });
    });

    it('one act entry per performance, in order, each in its own node, after the hops that get there', () => {
        const acts = live.path.filter((e) => e.type === 'customAction');
        expect(acts.map((e) => e.params.nodeId)).toEqual(live.plan);
        let at = START_REGION;
        for (const e of live.path) {
            if (e.type === 'regionMove') {
                expect(e.sourceRegion).toBe(at);
                at = e.destinationRegion;
            } else {
                expect(e).toMatchObject({ actionName: BLOCK.action, sourceRegion: at });
            }
        }
    });

    it('⛓ every hop leads to a node reached at that point of the plan (the start gate never refuses one)', () => {
        const model = plannerModelOf(rt.model);
        let state = loopStartState(model, {});
        for (const e of live.path) {
            if (e.type === 'regionMove') {
                const t = model.nodeIx.get(e.destinationRegion);
                expect(isReached(model, state, t), e.exitUsed).toBe(true);
            } else {
                state = perform(model, state, model.nodeIx.get(e.params.nodeId));
            }
        }
    });

    it('hopsBetween: shortest over reached targets; null to a node not reached', () => {
        const model = plannerModelOf(rt.model);
        const s = loopStartState(model, {});
        const [a, b] = RULES.preset_sidecars[P][BLOCK.start].playable_payload.exits.filter((x) => !x.reverse).map((x) => x.targetRegion);
        expect(hopsBetween(model, s, a, b).map((h) => h.to)).toEqual([BLOCK.start, b]);
        expect(hopsBetween(model, s, a, a)).toEqual([]);
        expect(hopsBetween(model, s, BLOCK.start, BLOCK.goal)).toBeNull();
    });

    it('an attempt is the last act', () => {
        const model = plannerModelOf(rt.model);
        const s = loopStartState(model, {});
        const firstPlan = live.plan.slice(0, 1);
        const path = routeOfPlan(model, s, firstPlan, live.plan[1], { startRegion: START_REGION });
        expect(path.filter((e) => e.type === 'customAction').map((e) => e.params.nodeId)).toEqual(live.plan.slice(0, 2));
    });

    it('a done world: no path', () => {
        const goalLoc = rt.model.nodes[rt.model.goalIndex].location;
        const done = planLiveLoop({ model: rt.model, startRegion: START_REGION, checkedLocations: [goalLoc] });
        expect(done).toMatchObject({ kind: PLAN_KINDS.DONE, path: [] });
    });
});

describe('the registry entry declares it', () => {
    it('loopBot.planLoop plans from the app\'s runtime; with no world it says so', () => {
        const rt = getActionNodesRuntime();
        rt.setEnv({ ledger: () => new ResourceLedger(), publish: () => {}, dispatch: () => {} });
        rt.unload();
        expect(substrateRegistryEntry.loopBot.planLoop({ startRegion: START_REGION })).toMatchObject({ kind: 'unreachable' });
        rt.loadWorld(RULES, P);
        const plan = substrateRegistryEntry.loopBot.planLoop({ startRegion: START_REGION });
        expect(plan.path.length).toBeGreaterThan(0);
        expect(plan.lines.length).toBeGreaterThan(0);
        rt.unload();
    });
});

describe('⛓ the live path played headless through the runtime gate reaches the goal', () => {
    const run = playLiveToGoal(RULES);

    it('reaches the goal; no hop or act is ever refused', () => {
        expect(run.refused).toBeNull();
        expect(run.reachedGoal).toBe(true);
    });

    it('every loop names its reason, and the last one is the goal', () => {
        for (const loop of run.loops) {
            expect(loop.reason, `loop ${loop.loop}`).toBeTruthy();
            expect(loop.lines.length).toBeGreaterThan(0);
        }
        expect(run.loops.at(-1).kind).toBe(PLAN_KINDS.GOAL);
        expect(run.loops.at(-1).checks).toContain(RULES.preset_sidecars[P][BLOCK.goal].playable_payload.location);
    });

    it('every check of the world is earned on the way, each once', () => {
        const all = run.loops.flatMap((l) => l.checks);
        expect(new Set(all).size).toBe(all.length);
        const locations = Object.values(RULES.preset_sidecars[P]).map((s) => s.playable_payload.location).filter(Boolean);
        for (const c of all) expect(locations).toContain(c);
    });
});

describe('⛓ AN-3b, limit (b): the mid-loop replan — the live path takes the pure planner\'s loop count', () => {
    it('the live path reaches the goal in as many loops as playToGoal (the example: 2; AN-3a\'s live path took 3)', () => {
        const live = playLiveToGoal(RULES);
        const model = buildActionModel(GRAPH);
        const pure = playToGoal(model, { placements: placementsFromRules(RULES, model, P) });
        expect(live.reachedGoal).toBe(true);
        expect(pure.reachedGoal).toBe(true);
        expect(live.loops.length).toBe(pure.loops.length);
        expect(live.loops.length).toBe(2);
        // the replan happened in loop 1, after the first check's item, and its lines say so
        expect(live.loops[0].replans).toBeGreaterThan(0);
        expect(live.loops[0].lines.some((l) => l.startsWith('(replan) '))).toBe(true);
        // and its lines are the pure planner's, line for line
        expect(live.loops[0].lines).toEqual(pure.loops[0].lines);
    });

    it('continueFrom: the rest of the loop from the live state, routed from the player\'s node (no Menu hop)', () => {
        const rt = getActionNodesRuntime();
        rt.setEnv({ ledger: () => new ResourceLedger(), publish: () => {}, dispatch: () => {} });
        rt.loadWorld(RULES, P);
        const first = substrateRegistryEntry.loopBot.planLoop({ startRegion: START_REGION });
        const firstAct = first.path.find((e) => e.type === 'customAction').params.nodeId;
        rt.perform(firstAct);
        const rest = substrateRegistryEntry.loopBot.planLoop({ startRegion: START_REGION, maxMana: 1000,
            continueFrom: { region: firstAct, mana: 1000 } });
        expect(rest.path.length).toBeGreaterThan(0);
        expect(rest.path.some((e) => e.sourceRegion === START_REGION)).toBe(false);
        const firstMove = rest.path.find((e) => e.type === 'regionMove');
        if (firstMove) expect(firstMove.sourceRegion).toBe(firstAct);
        rt.unload();
    });
});
