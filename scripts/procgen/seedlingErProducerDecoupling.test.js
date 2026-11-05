/**
 * ⛓ ER E4a — THE PRODUCER READS THE DOC'S CONNECTIONS, NOT THE VANILLA GAME LINKS (the swap pins).
 *
 * Every gate the playthrough rules producer derives from WHERE a door leads — an obstacle a landing sits inside, a
 * barrier that cuts a landing off (cross-room presses and in-room poles), a rope lane a landing stands in — goes on
 * the departures whose doc CONNECTION lands there (`departuresLandingAt`), so a shuffled layout gates the door that
 * really lands, and the vanilla one no longer.
 *
 * THE SWAP (the E1 design note's retarget): couple stair D (A→B₀) with stair E in B by retargeting D's connection to
 * `conn(rev(E)).to`, the existing arrival beside E — and, coupled (⚖ Q2), E to `conn(rev(D)).to`, rev(D) to
 * `conn(E).to`, rev(E) to `conn(D).to`. Four connections permuted over their own targets: every room keeps its
 * landing tiles, only WHO lands on each changes. The reverses are the E1 census's (game data).
 *
 * Each fixed reader gets its swap pins (the gate moves to the new departure and is gone from the old; every other
 * gate of the doc is unchanged) and a MUTANT: the reader handed `vanillaDepartureOf` (the retired `gameLandings`
 * reading) must turn its pin red. Pure: no wasm, no I/O beyond the committed tree.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const P = await import('./make-seedling-playthrough-rules.mjs');
const C = await import('./census-seedling-er-doorways.mjs');
const K = await import('./seedlingErDoorCensus.js');

let doc0;
let rev;
const idOf = (id) => {
    const [l, e] = id.split(':');
    return [`level_${l.slice(1)}`, e];
};
const connOf = (doc, id) => {
    const [r, e] = idOf(id);
    const c = doc.vanilla_layout.connections.find((x) => x.from[0] === r && x.from[1] === e);
    if (!c) throw new Error(`no connection from ${id}`);
    return c;
};
const dep = (id) => {
    const [region_id, exit_id] = idOf(id);
    return `${region_id}/${exit_id}`;
};
/** The coupled retarget of stair D with stair E (see the header). Returns a fresh doc. */
function coupledSwap(d, e) {
    const doc = structuredClone(doc0);
    const D = connOf(doc, d); const Dr = connOf(doc, rev.get(d)); const E = connOf(doc, e); const Er = connOf(doc, rev.get(e));
    const [tD, tDr, tE, tEr] = [D.to, Dr.to, E.to, Er.to];
    D.to = tEr; E.to = tDr; Dr.to = tE; Er.to = tD;
    return doc;
}
/** A plain two-connection retarget (any doorway class): the two departures trade arrivals. */
function trade(a, b) {
    const doc = structuredClone(doc0);
    const A = doc.vanilla_layout.connections.find((x) => `${x.from[0]}/${x.from[1]}` === a);
    const B = doc.vanilla_layout.connections.find((x) => `${x.from[0]}/${x.from[1]}` === b);
    [A.to, B.to] = [B.to, A.to];
    return doc;
}
const key = (g) => `${g.region_id}/${g.exit_id} ${JSON.stringify(g.rule)}`;
/** The gates `a` has and `b` lacks, and back — as `"<departure> <rule>"` rows. */
const diff = (a, b) => {
    const ka = a.map(key);
    const kb = b.map(key);
    return { gone: ka.filter((x) => !kb.includes(x)).sort(), added: kb.filter((x) => !ka.includes(x)).sort() };
};
/** `diff` restricted to departures: which departures LOST a gate and which GAINED one. */
const moved = (a, b) => {
    const d = diff(a, b);
    return { gone: [...new Set(d.gone.map((s) => s.split(' ')[0]))].sort(), added: [...new Set(d.added.map((s) => s.split(' ')[0]))].sort() };
};

beforeAll(async () => {
    const c = K.censusErDoorways(await C.loadCensusInputs({ producer: false }));
    rev = new Map(c.doorwayList.filter((d) => K.IN_SCOPE_CLASSES.includes(d.cls)).map((d) => [d.id, d.reverse]));
    doc0 = P.buildPlaythroughAtlas();
    P.setPlaythroughLandingAtlas(doc0);
}, 120_000);

describe('departuresLandingAt — the shared reader', () => {
    it('on the vanilla doc every game landing an event reads is reached by exactly its own door', () => {
        const rows = P.playthroughObstacleEvents(doc0).exitGates;
        expect(rows.length).toBeGreaterThan(0);
        // The rope landing (L17's stairs onto L16's lane) as a gameLandings row.
        const L = { from: 17, door: 'stairsup@32,48', level: 16 };
        expect(P.departuresLandingAt(doc0, L)).toEqual([{ region_id: 'level_17', exit_id: 'out_stairsup_32_48' }]);
        expect(P.vanillaDepartureOf(doc0, L)).toEqual(P.departuresLandingAt(doc0, L));
    });
    it('follows a retarget, and refuses by name an arrival nothing lands on', () => {
        const L = { from: 17, door: 'stairsup@32,48', level: 16 };
        const doc = coupledSwap('L5:out_stairsup_80_16', rev.get('L17:out_stairsup_32_48'));
        expect(P.departuresLandingAt(doc, L)).toEqual([{ region_id: 'level_5', exit_id: 'out_stairsup_80_16' }]);
        const orphan = structuredClone(doc0);
        connOf(orphan, 'L17:out_stairsup_32_48').to = ['level_16', 'in_nowhere'];
        expect(() => P.departuresLandingAt(orphan, L, 'rope events')).toThrow(/rope events: the atlas has no connection landing on level_16\/in_L17_32_48/);
    });
});

// ── 1. ROPE (playthroughRopeEvents): E1 defect 1 ─────────────────────────────
describe('rope events gate the departure whose connection lands in the lane', () => {
    const LANE_STAIR = 'L17:out_stairsup_32_48'; // lands on L16 (7,3), in arrowtrap@112,32's lane
    const cases = [
        ['E1 swap: L5 stairs into the lane', 'L5:out_stairsup_80_16'],
        ['second partner: L15 stairs into the lane', 'L15:out_stairsup_32_64'],
    ];
    for (const [name, d] of cases) {
        it(name, () => {
            const before = P.playthroughRopeEvents(doc0).exitGates;
            const doc = coupledSwap(d, rev.get(LANE_STAIR));
            const after = P.playthroughRopeEvents(doc).exitGates;
            expect(moved(before, after)).toEqual({ gone: [dep(LANE_STAIR)], added: [dep(d)] });
            // The doc's event-layer gates are unchanged by a swap whose stairs reach no obstacle/barrier landing.
            expect(diff(P.playthroughEventLayer(doc0).exitGates, P.playthroughEventLayer(doc).exitGates)).toEqual({ gone: [], added: [] });
        });
    }
    it('MUTANT: the vanilla departure leaves the real arrival UNGATED', () => {
        const doc = coupledSwap('L5:out_stairsup_80_16', rev.get(LANE_STAIR));
        const after = P.playthroughRopeEvents(doc, { departures: P.vanillaDepartureOf }).exitGates;
        expect(after.map((g) => `${g.region_id}/${g.exit_id}`)).not.toContain(dep('L5:out_stairsup_80_16'));
        expect(after.map((g) => `${g.region_id}/${g.exit_id}`)).toContain(dep(LANE_STAIR));
    });
});

// ── 2. BARRIER CUT (barrierAnalysis: playthroughButtonEvents + playthroughInRoomPoleEvents): E1 defect 2 ────────
describe('the barrier cut reads the departure from the doc\'s connections', () => {
    const POCKET_STAIR = 'L102:out_stairsdown_160_96'; // lands in L101's lightpole@144,64 pocket
    const cases = [
        ['E1 swap: L97 stairs into the pocket', 'L97:out_stairsdown_32_48'],
        ['second partner: L99 stairs into the pocket', 'L99:out_stairsup_48_96'],
    ];
    for (const [name, d] of cases) {
        it(name, () => {
            const doc = coupledSwap(d, rev.get(POCKET_STAIR));
            // E1's repro threw here ("the atlas has no connection level_102/out_stairsdown_160_96 -> level_101").
            const btn0 = P.playthroughButtonEvents(doc0).exitGates;
            expect(diff(btn0, P.playthroughButtonEvents(doc).exitGates)).toEqual({ gone: [], added: [] });
            const before = P.playthroughInRoomPoleEvents(doc0).exitGates;
            const after = P.playthroughInRoomPoleEvents(doc).exitGates;
            expect(moved(before, after)).toEqual({ gone: [dep(POCKET_STAIR)], added: [dep(d)] });
            // Only the pocket's departure moved: every other gate of the layer is the same row.
            const layer = diff(P.playthroughEventLayer(doc0).exitGates, P.playthroughEventLayer(doc).exitGates);
            expect(layer.gone.map((s) => s.split(' ')[0])).toEqual([dep(POCKET_STAIR)]);
            expect(layer.added.map((s) => s.split(' ')[0])).toEqual([dep(d)]);
            expect(diff(P.playthroughRopeEvents(doc0).exitGates, P.playthroughRopeEvents(doc).exitGates)).toEqual({ gone: [], added: [] });
        });
    }
    it('MUTANT: the vanilla departure prices the pocket from the door that no longer lands there, and the cut refuses', () => {
        // The pocket's side is named by L102's stair, which now leads elsewhere (L98), while the pocket's own stair leads
        // back to L97: "its doors connect [level_102, level_97]" — E1's defect 2, in the pole path's words.
        const doc = coupledSwap('L97:out_stairsdown_32_48', rev.get(POCKET_STAIR));
        expect(() => P.playthroughInRoomPoleEvents(doc, { departures: P.vanillaDepartureOf }))
            .toThrow(/cuts off the side of \[level_102\/out_stairsdown_160_96\], which is not a pocket/);
        expect(() => P.playthroughInRoomPoleEvents(doc)).not.toThrow();
    });
    it('an UNCOUPLED swap (out of Q2) is refused by name, not silently priced', () => {
        // E1's raw repro: only the two forward connections trade, so the pocket's own stair still leads to L102 while
        // L97 lands in it — its doors connect two regions, and the pocket test refuses.
        const doc = trade(dep(POCKET_STAIR), dep('L97:out_stairsdown_32_48'));
        expect(() => P.playthroughInRoomPoleEvents(doc)).toThrow(/not a pocket|cuts off/);
    });
});

// ── 3. OBSTACLE (playthroughObstacleEvents): no stairs in its domain today — the class closed on a teleporter ────
describe('obstacle events gate the departure whose connection lands inside the obstacle', () => {
    const IN_ROCK = 'level_1/out_teleporter_64_112'; // lands inside L0's breakablerock@80,112
    it('a departure that trades arrivals with it takes its gate, and it loses it', () => {
        const before = P.playthroughObstacleEvents(doc0).exitGates;
        const gated = new Set(before.map((g) => `${g.region_id}/${g.exit_id}`));
        // The first plain connection (not gated, not a pit or warp) from another level, by document order.
        const partner = doc0.vanilla_layout.connections.map((c) => `${c.from[0]}/${c.from[1]}`)
            .find((k) => !gated.has(k) && !k.startsWith('level_1/') && /\/out_teleporter_/.test(k));
        const doc = trade(IN_ROCK, partner);
        const after = P.playthroughObstacleEvents(doc).exitGates;
        expect(moved(before, after)).toEqual({ gone: [IN_ROCK], added: [partner] });
        expect(diff(before, after).added).toEqual([`${partner} ${JSON.stringify({ rule: 'Has', args: { item_name: 'L0 flag 4: breakablerock@80,112 cleared' } })}`]);
    });
    it('two gated departures that trade arrivals trade their gates', () => {
        const other = 'level_113/out_teleporter_64_144';
        const before = P.playthroughObstacleEvents(doc0).exitGates;
        const after = P.playthroughObstacleEvents(trade(IN_ROCK, other)).exitGates;
        const ruleOf = (rows, k) => rows.find((g) => `${g.region_id}/${g.exit_id}` === k).rule;
        expect(ruleOf(after, IN_ROCK)).toEqual(ruleOf(before, other));
        expect(ruleOf(after, other)).toEqual(ruleOf(before, IN_ROCK));
        expect(after.length).toBe(before.length);
    });
    it('MUTANT: the vanilla departure leaves the gate on the door that no longer lands there', () => {
        const before = P.playthroughObstacleEvents(doc0).exitGates;
        const gated = new Set(before.map((g) => `${g.region_id}/${g.exit_id}`));
        const partner = doc0.vanilla_layout.connections.map((c) => `${c.from[0]}/${c.from[1]}`)
            .find((k) => !gated.has(k) && !k.startsWith('level_1/') && /\/out_teleporter_/.test(k));
        const after = P.playthroughObstacleEvents(trade(IN_ROCK, partner), { departures: P.vanillaDepartureOf }).exitGates;
        expect(moved(before, after)).toEqual({ gone: [], added: [] });
    });
});
