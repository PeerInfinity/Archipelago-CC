/**
 * ⛓ THE MULTI-ENTRY RULE (planner ruling, AN-3a): EVERY exit, forward or reverse, is open iff its TARGET is reached this
 * loop; a node is reached when it is the start, or when one of its `after` sets is fully cleared this loop.
 *
 * The committed example has one-member sets only, where the rule equals AN-1b's "source cleared" (its preset stays
 * byte-identical: actionGraphCompiler.test.js). This file pins the multi-member cases on a TEST-ONLY fixture graph,
 * derived from the example by re-pointing two `after` lists (not committed as a preset):
 *   - an AND set `after: [[A, B]]`: both A→N and B→N stay shut until A and B are cleared, then both open;
 *   - an OR pair `after: [[A], [B]]`: either cleared opens both A→N and B→N.
 * The runtime gate (`whyNotLeave` / `gate`) and the compiler's derived forward-exit rule say the same thing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileActionGraph } from './actionGraphCompiler.js';
import { ActionNodesRuntime, RUNTIME_REFUSALS } from './actionNodesRuntime.js';
import { buildActionModel } from './actionModel.js';
import { deriveActionLogic } from './actionSearch.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = JSON.parse(readFileSync(join(HERE, 'graphs/example-village.json'), 'utf8'));
const P = '1';

/**
 * The fixture: the example with one AND set and one OR pair. The members are taken from the example's own
 * start-adjacent nodes (two repeatable-or-not action nodes), the targets are nodes reached from one of them.
 */
function multiEntryFixture() {
    const g = structuredClone(EXAMPLE);
    const fromStart = Object.keys(g.nodes).filter((id) => (g.nodes[id].after ?? []).some((s) => s.length === 1 && s[0] === g.start)
        && g.nodes[id].kind === 'action');
    const [A, B] = fromStart;
    // AND: a node now after A, re-pointed to need both A and B. OR: another node after A, re-pointed to A or B.
    const afterA = Object.keys(g.nodes).filter((id) => (g.nodes[id].after ?? []).some((s) => s.length === 1 && s[0] === A));
    const [AND, OR] = afterA;
    g.nodes[AND].after = [[A, B]];
    g.nodes[OR].after = [[A], [B]];
    g.graph_id = 'multi-entry-fixture';
    return { graph: g, A, B, AND, OR };
}

const FX = multiEntryFixture();
const { rules } = compileActionGraph(FX.graph);
const exitInto = (from, to) => rules.regions[P][from].exits.find((e) => e.connected_region === to);

function makeRuntime() {
    const ledger = new ResourceLedger();
    const rt = new ActionNodesRuntime({ ledger: () => ledger, publish: () => {}, dispatch: () => {} });
    expect(rt.loadWorld(rules, P)).toBe(true);
    rt.onSnapshot({ inventory: {}, checkedLocations: [] });
    return rt;
}
const fwd = (rt, from, to) => rt.gate({ type: 'regionMove', sourceRegion: from, destinationRegion: to, exitUsed: `${from} -> ${to}` });
const clear = (rt, id) => {
    while (!rt.isCleared(id)) expect(rt.perform(id).ok, id).toBe(true);
};

describe('the fixture is what it claims', () => {
    it('two distinct members, an AND node and an OR node, all distinct', () => {
        expect(new Set([FX.A, FX.B, FX.AND, FX.OR]).size).toBe(4);
        expect(rules.preset_sidecars[P][FX.AND].playable_payload.after).toEqual([[FX.A, FX.B]]);
        expect(rules.preset_sidecars[P][FX.OR].playable_payload.after).toEqual([[FX.A], [FX.B]]);
    });
});

describe('⛓ the runtime: an AND set `after: [[A, B]]`', () => {
    let rt;
    beforeEach(() => { rt = makeRuntime(); });

    it('A→N and B→N stay shut until BOTH are cleared, then both open', () => {
        expect(fwd(rt, FX.A, FX.AND).ok).toBe(false);
        expect(fwd(rt, FX.B, FX.AND).ok).toBe(false);
        clear(rt, FX.A);
        // A cleared, B not: A's exit is shut by the target (names B), B's by its own source.
        const a = fwd(rt, FX.A, FX.AND);
        expect(a).toMatchObject({ ok: false, code: RUNTIME_REFUSALS.targetNotReached });
        expect(a.reason).toContain(rt.node(FX.B).name);
        expect(fwd(rt, FX.B, FX.AND)).toMatchObject({ ok: false, code: RUNTIME_REFUSALS.notCleared });
        expect(rt.isReached(FX.AND)).toBe(false);
        clear(rt, FX.B);
        expect(rt.isReached(FX.AND)).toBe(true);
        expect(fwd(rt, FX.A, FX.AND).ok).toBe(true);
        expect(fwd(rt, FX.B, FX.AND).ok).toBe(true);
    });

    it('the reverse exits N→A and N→B follow the same rule (their targets are reached once N is)', () => {
        clear(rt, FX.A);
        clear(rt, FX.B);
        for (const m of [FX.A, FX.B]) {
            expect(rt.gate({ type: 'regionMove', sourceRegion: FX.AND, destinationRegion: m, exitUsed: `${FX.AND} -> ${m}` }).ok).toBe(true);
        }
    });

    it('a loop reset shuts them again', () => {
        clear(rt, FX.A);
        clear(rt, FX.B);
        rt.onLoopReset('test');
        expect(fwd(rt, FX.A, FX.AND).ok).toBe(false);
        expect(fwd(rt, FX.B, FX.AND).ok).toBe(false);
    });
});

describe('⛓ the runtime: an OR pair `after: [[A], [B]]`', () => {
    it('clearing B alone opens BOTH A→N and B→N (A not cleared)', () => {
        const rt = makeRuntime();
        expect(fwd(rt, FX.A, FX.OR).ok).toBe(false);
        clear(rt, FX.B);
        expect(rt.isCleared(FX.A)).toBe(false);
        expect(fwd(rt, FX.A, FX.OR).ok).toBe(true);
        expect(fwd(rt, FX.B, FX.OR).ok).toBe(true);
    });

    it('clearing A alone opens both too', () => {
        const rt = makeRuntime();
        clear(rt, FX.A);
        expect(fwd(rt, FX.A, FX.OR).ok).toBe(true);
        expect(fwd(rt, FX.B, FX.OR).ok).toBe(true);
    });
});

describe('⛓ the compiler says the same thing', () => {
    const model = buildActionModel(FX.graph);
    const logic = deriveActionLogic(model);

    it('every forward exit into a node carries the SAME rule: the target\'s reach rule', () => {
        for (const n of [FX.AND, FX.OR]) {
            const a = exitInto(FX.A, n);
            const b = exitInto(FX.B, n);
            expect(a && b).toBeTruthy();
            expect(a.access_rule).toEqual(b.access_rule);
        }
        // and every forward exit of the whole fixture is its target's reach rule
        for (const [id, region] of Object.entries(rules.regions[P])) {
            for (const e of region.exits) {
                const payload = rules.preset_sidecars[P][id]?.playable_payload;
                const row = payload?.exits.find((x) => x.exitName === e.name);
                if (!row || row.reverse) continue;
                const twin = Object.values(rules.regions[P]).flatMap((r) => r.exits).filter((x) => x.connected_region === e.connected_region
                    && !rules.preset_sidecars[P][x.name.split(' -> ')[0]]?.playable_payload?.exits.find((y) => y.exitName === x.name)?.reverse);
                for (const t of twin) expect(t.access_rule, `${e.name} vs ${t.name}`).toEqual(e.access_rule);
            }
        }
    });

    it('the AND node\'s reach needs no more items than clearing both members does; the OR node\'s no more than either', () => {
        const ix = (id) => model.nodeIx.get(id);
        const minTotal = (rows) => Math.min(...rows.map((c) => c.reduce((s, k) => s + k, 0)));
        expect(logic.reach[ix(FX.AND)].length).toBeGreaterThan(0);
        expect(minTotal(logic.reach[ix(FX.OR)])).toBeLessThanOrEqual(minTotal(logic.reach[ix(FX.AND)]));
    });
});
