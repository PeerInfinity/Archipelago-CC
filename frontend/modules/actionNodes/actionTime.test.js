// actionNodes — TIME WINDOWS, THE CLOCK AND KNOWLEDGE in the headless core (slice AN-TIME-1).
// ⚖ Robert 2026-11-25: a window counts from the time spent this loop (Q1); an early arrival waits and pays the time
// (Q2); starting before the window closes is enough (Q3); an item may add time at the END of the day, never move its
// start (Q4); a timed graph defaults to no region XP (Q5); knowledge gates are brought forward, compiled as events (Q8).
// The exactness of the logic is pinned in `actionTimeLogic.slow.test.js`.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACTION_GRAPH_REFUSALS as R, DEFAULT_GRAPH_SETTINGS, TIMED_GRAPH_SETTINGS, isTimedGraph, knowledgeItemNameOf,
    resolvedSettingsOf, validateActionGraph,
} from './actionGraph.js';
import {
    buildActionModel, formatClock, itemVectorOf, loopStartState, perform, waitNote, whyNot,
} from './actionModel.js';
import { deriveActionLogic, enumerateLoop, itemCombinations, planTo } from './actionSearch.js';
import { orderForMana, PLAN_KINDS, planLoop, playToGoal } from './actionPlanner.js';
import { compileActionGraph, placementsFromRules } from './actionGraphCompiler.js';
import { substrateRegistryEntry } from './actionNodesLibrary.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (p) => JSON.parse(readFileSync(join(HERE, p), 'utf8'));
const HARBOUR = load('fixtures/harbour-morning.json');
const VISITS = load('fixtures/visits-day.json');
const EXAMPLE = load('graphs/example-village.json');
const PROV = HARBOUR.provenance;

const codes = (g) => validateActionGraph(g).errors.map((e) => e.code);
const clone = (g) => structuredClone(g);
const withNode = (g, id, patch) => { const c = clone(g); c.nodes[id] = { ...c.nodes[id], ...patch }; return c; };

describe('the format: windows, the clock, knowledge (validator)', () => {
    it('both fixtures and the example are valid', () => {
        for (const g of [HARBOUR, VISITS, EXAMPLE]) expect(validateActionGraph(g).errors).toEqual([]);
    });
    it('a window is {from?, until?} of whole numbers ≥ 0, at least one, opening no later than it closes', () => {
        expect(codes(withNode(HARBOUR, 'quay', { window: {} }))).toContain(R.BAD_WINDOW);
        expect(codes(withNode(HARBOUR, 'quay', { window: { from: -1 } }))).toContain(R.BAD_WINDOW);
        expect(codes(withNode(HARBOUR, 'quay', { window: { from: 1.5 } }))).toContain(R.BAD_WINDOW);
        expect(codes(withNode(HARBOUR, 'quay', { window: { at: 3 } }))).toContain(R.BAD_WINDOW);
        expect(codes(withNode(HARBOUR, 'quay', { window: { from: 4, until: 3 } }))).toContain(R.BAD_WINDOW);
        expect(codes(withNode(HARBOUR, 'quay', { window: { from: 3, until: 3 } }))).toEqual([]);
    });
    it('the start has no window', () => {
        expect(codes(withNode(HARBOUR, 'inn', { window: { until: 2 } }))).toContain(R.WINDOW_ON_START);
    });
    it('the clock is {start: "HH:MM", minutesPerUnit ≥ 1}', () => {
        for (const clock of [{ start: '9:00', minutesPerUnit: 60 }, { start: '09:00', minutesPerUnit: 0 }, { start: '25:00', minutesPerUnit: 60 },
            { start: '09:00', minutesPerUnit: 60, end: '17:00' }, 'nine']) {
            expect(codes({ ...HARBOUR, clock })).toContain(R.BAD_CLOCK);
        }
    });
    it('⚖ Q4: an item that would start the clock earlier is refused by name; one that adds time at the end is fine', () => {
        for (const key of ['earlier', 'clock', 'start']) {
            const g = clone(HARBOUR);
            g.boons['extra-hour'].gives[key] = 1;
            expect(codes(g)).toContain(R.EARLIER_START);
        }
        expect(HARBOUR.boons['extra-hour'].gives.mana).toBe(1);
    });
    it('knowledge: requires/learns name declared flags; every flag is learned; a flag id is not also a boon id', () => {
        expect(codes(withNode(VISITS, 'visit-d', { requires: { knowledge: ['read-z'] } }))).toContain(R.UNKNOWN_KNOWLEDGE);
        expect(codes(withNode(VISITS, 'visit-a', { results: { learns: ['read-z'] } }))).toContain(R.UNKNOWN_KNOWLEDGE);
        expect(codes(withNode(VISITS, 'visit-d', { requires: { knowledge: [] } }))).toContain(R.BAD_FIELD);
        const never = clone(VISITS);
        never.knowledge['read-f'] = { name: 'Paper F' };
        expect(codes(never)).toContain(R.KNOWLEDGE_NEVER_LEARNED);
        const clash = clone(VISITS);
        clash.knowledge.nothing = { name: 'Nothing' };
        clash.nodes['visit-a'].results.learns.push('nothing');
        expect(codes(clash)).toContain(R.BAD_FIELD);
        const named = clone(VISITS);
        named.boons.nothing.name = knowledgeItemNameOf('Paper A');
        expect(codes(named)).toContain(R.DUPLICATE_NAME);
    });
    it('a maximum requirement is still refused: a window is not a `requires` form', () => {
        expect(codes(withNode(HARBOUR, 'quay', { requires: { max: { evidence: 1 } } }))).toContain(R.MAXIMUM_REQUIREMENT);
    });
});

describe('⚖ Q5: a timed graph (one with a `clock`) defaults to no region XP; its own settings win', () => {
    it('defaults', () => {
        expect(isTimedGraph(HARBOUR)).toBe(true);
        expect(isTimedGraph(EXAMPLE)).toBe(false);
        expect(resolvedSettingsOf(HARBOUR)).toEqual({ ...DEFAULT_GRAPH_SETTINGS, ...TIMED_GRAPH_SETTINGS });
        expect(resolvedSettingsOf(HARBOUR).xpEffect).toBe('none');
        expect(resolvedSettingsOf({ ...HARBOUR, settings: { xpEffect: 'cost' } }).xpEffect).toBe('cost');
        expect(resolvedSettingsOf(EXAMPLE)).toEqual(EXAMPLE.settings);
    });
});

describe('the model: the clock, the wait, too late, knowledge', () => {
    const m = buildActionModel(HARBOUR);
    const ix = (id) => m.nodeIx.get(id);
    const after = (state, ...ids) => ids.reduce((s, id) => perform(m, s, ix(id)), state);

    it('the clock is time spent this loop; items never move it (an extra hour lengthens the day at the end)', () => {
        const plain = loopStartState(m);
        const boosted = loopStartState(m, { 'extra-hour': 1 });
        expect(plain.clock).toBe(0);
        expect(boosted.clock).toBe(0);
        expect(boosted.mana).toBe(plain.mana + 1);
    });
    it('formatClock reads the graph clock; with none, plain units', () => {
        expect(formatClock(m, 0)).toBe('09:00');
        expect(formatClock(m, 3)).toBe('12:00');
        expect(formatClock(buildActionModel(EXAMPLE), 40)).toBe('t=40');
    });
    it('⚖ Q2: early is not a refusal — the node waits for its window, and the wait is paid from the pool', () => {
        const s = loopStartState(m);
        expect(whyNot(m, s, ix('quay'))).toBeNull();
        expect(waitNote(m, s, ix('quay'))).toBe('waits 3 (opens 12:00)');
        const next = perform(m, s, ix('quay'));
        expect(next.clock).toBe(4);
        expect(next.mana).toBe(s.mana - 4);
        expect(next.spent).toBe(1); // region XP counts the price, not the wait
    });
    it('⚖ Q3: the start decides — a node may start at `until` exactly; after it, refused by name with the clock', () => {
        const atOne = after(loopStartState(m), 'walk');
        expect(whyNot(m, atOne, ix('landlady'))).toBeNull();
        const atTwo = after(atOne, 'walk');
        expect(whyNot(m, atTwo, ix('landlady'))).toEqual({ code: 'too-late', text: 'too late: after 10:00 (it is 11:00)' });
    });
    it('short of time, the line names the wait too', () => {
        const s = { ...loopStartState(m), mana: 2 };
        expect(whyNot(m, s, ix('quay'))).toMatchObject({ code: 'mana', short: 2, text: 'short by 2 mana (waits 3, opens 12:00)' });
    });
    it('knowledge: learned by performing, known from then on this loop; held from an earlier loop through the item vector', () => {
        const v = buildActionModel(VISITS);
        const vix = (id) => v.nodeIx.get(id);
        const s = loopStartState(v);
        expect(whyNot(v, s, vix('visit-d'))).toEqual({ code: 'knowledge', text: 'needs to know Paper A' });
        expect(whyNot(v, perform(v, s, vix('visit-a')), vix('visit-d'))).toBeNull();
        expect(itemVectorOf(v, { 'read-a': 1 })).toEqual([0, 1, 0, 0, 0, 0]);
        expect(whyNot(v, loopStartState(v, { 'read-a': 1 }), vix('visit-d'))).toBeNull();
    });
    it('a model without windows or knowledge (e.g. the runtime\'s own) behaves exactly as before', () => {
        const e = buildActionModel(EXAMPLE);
        expect(e.windowed).toBe(false);
        expect(e.knowledge).toEqual([]);
        expect(itemVectorOf(e, { 'strength-boost': 1 })).toEqual([1, 0]);
        const bare = { ...e, nodes: e.nodes.map(({ from, until, reqKnow, learns, ...rest }) => rest), knowledge: undefined };
        const s = loopStartState(e);
        expect(whyNot(bare, s, e.nodeIx.get('train'))).toBeNull();
        expect(perform(bare, s, e.nodeIx.get('train')).clock).toBe(20);
    });
});

/**
 * The order trap, in four nodes: `w` opens at 2 and pays 5 mana back, `z` takes 2, `t` needs both and closes at 3.
 * `z` then `w` reaches the counts {z, w} at clock 3; `w` then `z` at clock 5 (w waits). `w` is declared first, so a
 * walk that keeps the FIRST path to a count vector keeps the late one.
 */
const TRAP = {
    kind: 'action-graph', schema_version: 1, graph_id: 'order-trap', name: 'Order trap', provenance: PROV,
    loop: { mana: 10 }, stats: {}, resources: {}, boons: {}, start: 's',
    nodes: {
        s: { name: 'S', kind: 'start', time: 0, limit: 1 },
        w: { name: 'W', kind: 'action', time: 1, limit: 1, after: [['s']], window: { from: 2 }, results: { mana: 5 } },
        z: { name: 'Z', kind: 'action', time: 2, limit: 1, after: [['s']] },
        t: { name: 'T', kind: 'goal', time: 1, limit: 1, after: [['w', 'z']], window: { until: 3 } },
    },
};

describe('the search: one loop with windows', () => {
    const m = buildActionModel(TRAP);
    const t = m.nodeIx.get('t');
    it('keeps the EARLIEST clock per count vector, so the order that meets the window is found', () => {
        const { entries } = enumerateLoop(m);
        const k = entries.findIndex((e) => e.via === t);
        expect(k).toBeGreaterThan(0);
        expect(planTo(entries, k).map((i) => m.nodes[i].id)).toEqual(['z', 'w', 't']);
    });
    it('MUTATION: the plain counts key keeps the first (late) path and loses the target', () => {
        const { entries } = enumerateLoop({ ...m, windowed: false });
        expect(entries.some((e) => e.via === t)).toBe(false);
    });
    it('knowledge flags are logic dimensions after the boons, each 0/1', () => {
        const v = buildActionModel(VISITS);
        expect(itemCombinations(v)).toHaveLength(2 * 2 ** 5);
        expect(itemCombinations(buildActionModel(EXAMPLE))).toHaveLength(4);
    });
});

describe('the planner: orderForMana keeps a windowed target legal (the defect AN-TIME-D found)', () => {
    it('a reorder that would bring the target too late is not taken', () => {
        const m = buildActionModel(TRAP);
        const ids = ['z', 'w', 't'].map((id) => m.nodeIx.get(id));
        // Mana alone prefers W first (it pays 5 back), which makes T start at 5, after it closes at 3.
        expect(orderForMana(m, loopStartState(m), ids).map((i) => m.nodes[i].id)).toEqual(['z', 'w', 't']);
    });
    it('the toy plays to its goal in one loop, the wait in its reasoning', () => {
        const m = buildActionModel(HARBOUR);
        const { rules } = compileActionGraph(HARBOUR, { seed: 1 });
        const play = playToGoal(m, { placements: placementsFromRules(rules, m) });
        expect(play.reachedGoal).toBe(true);
        expect(play.loops).toHaveLength(1);
        expect(play.loops[0].lines[0]).toContain('Watch the Ferry Come In waits 2 (opens 12:00)');
    });
    it('no check this loop but knowledge to learn: the loop learns it (kind `learn`), and the next earns the goal', () => {
        const g = {
            kind: 'action-graph', schema_version: 1, graph_id: 'learn-first', name: 'Learn first', provenance: PROV,
            loop: { mana: 3 }, stats: {}, resources: {}, boons: {}, start: 's',
            knowledge: { k: { name: 'The Secret' } },
            nodes: {
                s: { name: 'S', kind: 'start', time: 0, limit: 1 },
                l: { name: 'Listen', kind: 'action', time: 2, limit: 1, after: [['s']], results: { learns: ['k'] } },
                g: { name: 'Tell', kind: 'goal', time: 2, limit: 1, after: [['s']], requires: { knowledge: ['k'] } },
            },
        };
        const m = buildActionModel(g);
        const first = planLoop(m);
        expect(first.kind).toBe(PLAN_KINDS.LEARN);
        expect(first.plan).toEqual(['l']);
        expect(first.lines[0]).toContain('Learning The Secret');
        expect(first.lines.join('\n')).toContain('Tell: short by 1 mana (Listen → Tell)');
        const play = playToGoal(m);
        expect(play.reachedGoal).toBe(true);
        expect(play.loops.map((l) => l.kind)).toEqual([PLAN_KINDS.LEARN, PLAN_KINDS.GOAL]);
    });
});

describe('the compiler: windows and knowledge in the world', () => {
    it('a node window and the clock travel in the payload and the block; a timed world records xpEffect none', () => {
        const { rules } = compileActionGraph(HARBOUR, { seed: 1 });
        expect(rules.preset_sidecars['1'].quay.playable_payload.window).toEqual({ from: 3, until: 4 });
        expect(rules.preset_sidecars['1'].walk.playable_payload).not.toHaveProperty('window');
        expect(rules.action_nodes['1'].clock).toEqual({ start: '09:00', minutesPerUnit: 60 });
        expect(rules.action_nodes['1'].settings.xpEffect).toBe('none');
        expect(rules.loop_costs['1'].regions.quay).toMatchObject({ xpEffect: 'none', actions: { act: 1 } });
    });
    it('each teaching node holds an EVENT location with its flag\'s event item (no AP id, locked, the same rule as the node)', () => {
        const { rules } = compileActionGraph(VISITS, { seed: 1 });
        const locs = rules.regions['1']['visit-c'].locations;
        const ev = locs.find((l) => l.event);
        expect(ev).toMatchObject({ name: 'Visit C (learns Paper C)', id: null, locked: true, event: true,
            item: { name: 'Knows: Paper C', advancement: true } });
        expect(ev.access_rule).toEqual(locs.find((l) => l.name === 'Visit C').access_rule);
        expect(rules.items['1']['Knows: Paper C']).toMatchObject({ id: null, event: true, classification: 'progression', max_count: 1 });
        expect(rules.itempool_counts['1']['Knows: Paper C']).toBe(1);
        expect(rules.preset_sidecars['1']['visit-d'].playable_payload.requires.knowledge).toEqual({ 'read-a': { name: 'Paper A' } });
        expect(rules.preset_sidecars['1']['visit-a'].playable_payload.results.learns).toEqual({ 'read-a': { name: 'Paper A' } });
    });
    it('the logic names knowledge only where an earlier loop is needed: the answer needs Paper C from another day', () => {
        const { report } = compileActionGraph(VISITS, { seed: 1 });
        // A and B fit in the same day as the answer; C needs B the same day and takes 2, so 1 + 1 + 2 > 3.
        expect(report.targets['Answer the Question'].rule).toBe('Has(Knows: Paper C)');
        expect(report.targets['Visit D'].rule).toBe('True');
        expect(report.knowledge['Knows: Paper C']).toEqual({ learners: ['visit-c'], rule: 'True' });
        expect(report.progression_items).toEqual([]);
    });
    it('the fill never places an event item; the sphere log collects the events and reaches the goal', () => {
        const { rules } = compileActionGraph(VISITS, { seed: 1 });
        const placed = Object.values(rules.regions['1']).flatMap((r) => r.locations).filter((l) => !l.event && l.item?.name !== 'Victory');
        expect(placed.every((l) => !l.item.name.startsWith('Knows: '))).toBe(true);
        const picks = rules.sphere_log.filter((e) => e.type === 'state_update').flatMap((e) => e.player_data['1'].sphere_locations);
        expect(picks).toContain('Visit C (learns Paper C)');
        expect(picks).toContain('Answer the Question');
    });
    it('both fixtures compile to schema-valid worlds whose payloads match the declared sidecar fields and carriers', () => {
        const schema = loadRulesSchema();
        for (const g of [HARBOUR, VISITS]) {
            const { rules } = compileActionGraph(g, { seed: 1 });
            expect(rulesJsonSchemaErrors(rules, schema), g.graph_id).toEqual([]);
            for (const [region, sc] of Object.entries(rules.preset_sidecars['1'])) {
                expect(sidecarPayloadErrors(sidecarFieldsOf(substrateRegistryEntry), sc.playable_payload), region).toEqual([]);
                expect(substrateRegistryEntry.apLocationNamesOf(sc.playable_payload))
                    .toEqual(rules.regions['1'][region].locations.map((l) => l.name));
            }
        }
    });
    it('the visits fixture plays to the goal (knowledge kept across loops)', () => {
        const v = buildActionModel(VISITS);
        const { rules } = compileActionGraph(VISITS, { seed: 1 });
        const play = playToGoal(v, { placements: placementsFromRules(rules, v) });
        expect(play.reachedGoal).toBe(true);
        expect(play.loops.at(-1).kind).toBe(PLAN_KINDS.GOAL);
    });
    it('deriveActionLogic over windows: the toy\'s ledger needs the pass, everything else is open with nothing', () => {
        const logic = deriveActionLogic(buildActionModel(HARBOUR));
        const m = buildActionModel(HARBOUR);
        const rule = (id) => logic.perform[m.nodeIx.get(id)].map((w) => w.items);
        expect(rule('ledger')).toEqual([[1, 0, 0]]);
        expect(rule('quay')).toEqual([[0, 0, 0]]);
        expect(rule('accuse')).toEqual([[0, 0, 0]]);
    });
});
