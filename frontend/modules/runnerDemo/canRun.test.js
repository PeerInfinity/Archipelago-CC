/**
 * canRun solver gates (plan §4.3): fixture edges with known-required
 * jumps (full hold / double jump / gated platform), the ∀-arrival
 * failure case, the doom/touch/launch refinement, graph + BFS
 * plumbing, and full-vs-layered flood agreement. The solver ⊆ oracle
 * corpus test lives in canRun.slow.test.js.
 */

import { describe, it, expect } from 'vitest';
import {
    ENTRANCE, nodeKey, nodePlatformId, planPlatformIds,
    canRun, canRunDetailed, runQuery, policiesFor, survivesFrom, entryTarget,
    buildRunGraph, findRunPath, reachablePlatforms, reachableRunPlatforms,
} from './canRun.js';
import {
    flatRun, gapJump, oneWay, spikeRun, doubleGap, stepStone, FIXTURES,
} from './fixtures.js';
import { noAbilities, allAbilities } from './suppression.js';
import { DEFAULTS } from './physics.js';
import { validateLevel } from './level.js';

const NONE = noAbilities();
const DJ = { doubleJump: true, blue: false };
const BLUE = { doubleJump: false, blue: true };

/** First policy whose name matches, instantiated for one run. */
function probe(level, fromId, abilities, x0, vx0, nameRe) {
    const from = level.platforms.find((p) => p.id === fromId);
    const policy = policiesFor(level, from, abilities).find((p) => nameRe.test(p.name));
    expect(policy, `no policy matching ${nameRe}`).toBeTruthy();
    return runQuery(level, fromId, abilities, { x0, vx0, policy: policy.make() });
}

describe('entry legs', () => {
    it('resolves the spawn platform even when the spawn rests flush on it (no landing tick)', () => {
        for (const f of FIXTURES) {
            expect(entryTarget(f, NONE), f.id).toBeTruthy();
        }
        expect(entryTarget(flatRun, NONE)).toBe('floorA');
        expect(entryTarget(oneWay, NONE)).toBe('ledge');
    });

    it('is the sole ENTRANCE edge, and carries the doom grade', () => {
        // gapJump entry is live: the edge jump escapes floorA
        const live = canRunDetailed(gapJump, ENTRANCE, 'floorA', NONE);
        expect(live).toMatchObject({ ok: true, touch: true });
        // doubleGap entry without Double Jump is doomed (auto-run
        // always ends in the pit) — touch-reached, not chainable
        const doomed = canRunDetailed(doubleGap, ENTRANCE, 'floorA', NONE);
        expect(doomed).toMatchObject({ ok: false, touch: true });
        expect(canRunDetailed(doubleGap, ENTRANCE, 'floorA', DJ).ok).toBe(true);
        // and never to a platform the drop can't reach
        expect(canRunDetailed(gapJump, ENTRANCE, 'floorB', NONE).touch).toBe(false);
    });
});

describe('flush boundaries (standingOn legs)', () => {
    it('flatRun floorA→floorB: every arrival crosses with NO input at all', () => {
        const r = canRunDetailed(flatRun, 'floorA', 'floorB', NONE);
        expect(r.ok).toBe(true);
        expect(r.witnesses.length).toBeGreaterThan(0);
        for (const w of r.witnesses) expect(w.policy).toBe('none');
    });
});

describe('gap needing a full hold (gapJump)', () => {
    it('edge exists without any abilities', () => {
        expect(canRun(gapJump, 'floorA', 'floorB', NONE)).toBe(true);
    });

    it('a tap from the edge dies in the gap; the full hold lands it', () => {
        const edgeX = 15.25; // stand at floorA's right end
        const tap = probe(gapJump, 'floorA', NONE, edgeX, DEFAULTS.maxSpeed, /^jump@15.95\+1$/);
        expect(tap.died).toBe('fell');
        const full = probe(gapJump, 'floorA', NONE, edgeX, DEFAULTS.maxSpeed, /^jump@15.95\+21$/);
        expect(full.landedOn).toBe('floorB');
    });

    it('the reverse edge is impossible (auto-run never goes left)', () => {
        expect(canRun(gapJump, 'floorB', 'floorA', NONE)).toBe(false);
    });
});

describe('gap needing Double Jump (doubleGap)', () => {
    it('uncrossable without the ability, crossable with it', () => {
        expect(canRun(doubleGap, 'floorA', 'floorB', NONE)).toBe(false);
        const r = canRunDetailed(doubleGap, 'floorA', 'floorB', DJ);
        expect(r.ok).toBe(true);
        // every witness needed the second (air) press
        for (const w of r.witnesses) expect(w.policy).toMatch(/\+air@/);
    });

    it('reach: pre-gate floor stays touch-reached without the item (item-before-the-gate), far side gated', () => {
        expect([...reachableRunPlatforms(doubleGap, NONE)]).toEqual(['floorA']);
        expect([...reachableRunPlatforms(doubleGap, DJ)].sort())
            .toEqual(['floorA', 'floorB']);
    });
});

describe('gap needing the gated one-way stepping stone (stepStone)', () => {
    it('the full gap beats even Double Jump; the stone chains two plain jumps', () => {
        expect(canRun(stepStone, 'floorA', 'floorB', NONE)).toBe(false);
        expect(canRun(stepStone, 'floorA', 'floorB', DJ)).toBe(false);
        expect(canRun(stepStone, 'floorA', 'floorB', allAbilities())).toBe(false); // next support is the stone
        expect(canRun(stepStone, 'floorA', 'stone', BLUE)).toBe(true);
        expect(canRun(stepStone, 'stone', 'floorB', BLUE)).toBe(true);
    });

    it('reach under each ability set', () => {
        expect([...reachableRunPlatforms(stepStone, NONE)]).toEqual(['floorA']);
        expect([...reachableRunPlatforms(stepStone, DJ)]).toEqual(['floorA']);
        expect([...reachableRunPlatforms(stepStone, BLUE)].sort())
            .toEqual(['floorA', 'floorB', 'stone']);
    });

    it('suppressed stone is not a node in the graph', () => {
        const g = buildRunGraph(stepStone, NONE);
        expect(g.nodes).not.toContain(nodeKey('stone'));
        expect(buildRunGraph(stepStone, BLUE).nodes).toContain(nodeKey('stone'));
    });
});

describe('∀-arrival failure', () => {
    // A shelf over floorA's LEFT half: reachable by jumping from a
    // left arrival, but auto-run can never come back for it from a
    // right arrival — SOME arrival works, so ∃ would claim the edge;
    // the ∀ must kill it.
    const leftShelf = {
        id: 'leftShelf',
        size: { width: 30, height: 16 },
        platforms: [
            { id: 'floorA', x: 0, y: 0, w: 20, h: 1, type: 'ground' },
            { id: 'shelf', x: 2, y: 2.5, w: 3, h: 0.5, type: 'ground' },
            { id: 'floorB', x: 23, y: 0, w: 7, h: 1, type: 'ground' },
        ],
        hazards: [],
        pickups: [],
        portals: [{ id: 'exit_main', on: 'floorB', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
        spawn: { x: 0.5, y: 1 },
    };

    it('the fixture itself is structurally valid', () => {
        expect(validateLevel(leftShelf)).toEqual([]);
    });

    it('some single arrival reaches the shelf…', () => {
        const from = leftShelf.platforms[0];
        const landings = policiesFor(leftShelf, from, NONE).map((p) => runQuery(
            leftShelf, 'floorA', NONE,
            { x0: 0.3, vx0: 0.6 * DEFAULTS.maxSpeed, policy: p.make() },
        ).landedOn);
        expect(landings).toContain('shelf');
    });

    it('…but the edge is dead: right-side arrivals can never make it', () => {
        expect(canRun(leftShelf, 'floorA', 'shelf', NONE)).toBe(false);
        expect(canRunDetailed(leftShelf, 'floorA', 'shelf', NONE).touch).toBe(false);
    });
});

describe('hazard corridors and the doom refinement (spikeRun)', () => {
    it('running into the spikes with no input dies', () => {
        const r = runQuery(spikeRun, 'floorA', NONE, { x0: 1, vx0: DEFAULTS.maxSpeed, policy: null });
        expect(r.died).toBe('hazard');
    });

    it('the edge still verifies: hazard-lead policies hop the spikes, arrivals doomed inside the spike window are excluded from the ∀', () => {
        const r = canRunDetailed(spikeRun, 'floorA', 'floorB', NONE);
        expect(r.ok).toBe(true);
        // arrivals before the spikes (x < 14) must jump them; arrivals
        // beyond may walk the flush boundary flat
        for (const w of r.witnesses) {
            if (w.x0 < 12) expect(w.policy).toMatch(/^jump@/);
        }
        expect(r.witnesses.some((w) => w.policy.startsWith('jump@'))).toBe(true);
        expect(reachableRunPlatforms(spikeRun, NONE).has('floorB')).toBe(true);
    });

    it('an arrival state standing inside the hazard dies on the arrival tick itself', () => {
        // (which is why no leg can ever produce such an arrival)
        const r = runQuery(spikeRun, 'floorA', NONE, { x0: 14.2, vx0: 0, policy: null });
        expect(r.died).toBe('hazard');
    });
});

describe('one-way platforms (oneWay)', () => {
    it('ledge run is carried by the shelf only with the item', () => {
        expect(canRun(oneWay, 'ledge', 'blue1', BLUE)).toBe(true);
        expect(canRunDetailed(oneWay, 'ledge', 'blue1', NONE).touch).toBe(false);
        expect(canRun(oneWay, 'ledge', 'floor', NONE)).toBe(true); // falls straight through
    });

    it('drop-through policies exist on one-way hosts and descend to the floor', () => {
        const shelf = oneWay.platforms.find((p) => p.id === 'blue1');
        const names = policiesFor(oneWay, shelf, BLUE).map((p) => p.name);
        expect(names.some((n) => n.startsWith('drop@'))).toBe(true);
        const solid = oneWay.platforms.find((p) => p.id === 'floor');
        const solidNames = policiesFor(oneWay, solid, BLUE).map((p) => p.name);
        expect(solidNames.some((n) => n.startsWith('drop@'))).toBe(false);
        const r = probe(oneWay, 'blue1', BLUE, 10, DEFAULTS.maxSpeed, /^drop@/);
        expect(r.landedOn).toBe('floor');
    });
});

describe('graph, BFS, and the reserved hits dimension', () => {
    it('node keys carry hitsRemaining from day one (always 0 in v1)', () => {
        expect(nodeKey('floorA')).toBe('floorA~h0');
        expect(nodeKey('floorA', 2)).toBe('floorA~h2');
        expect(nodePlatformId('floorA~h0')).toBe('floorA');
        expect(nodePlatformId(nodeKey(ENTRANCE))).toBe(ENTRANCE);
    });

    it('findRunPath plans the stone chain under blue', () => {
        const g = buildRunGraph(stepStone, BLUE);
        const r = findRunPath(g, 'floorB');
        expect(r.ok).toBe(true);
        expect(planPlatformIds(r.plan)).toEqual(['floorA', 'stone', 'floorB']);
        expect(findRunPath(buildRunGraph(stepStone, DJ), 'floorB').ok).toBe(false);
    });

    it('touch edges live beside launch edges in the graph', () => {
        const g = buildRunGraph(doubleGap, NONE);
        const entry = nodeKey(ENTRANCE);
        expect(g.edges.get(entry).size).toBe(0); // doomed entry: no launch
        expect(g.touches.get(entry).has(nodeKey('floorA'))).toBe(true);
        expect(reachablePlatforms(g).has('floorA')).toBe(true);
        expect(reachablePlatforms(g).has('floorB')).toBe(false);
    });

    it('graph builds are deterministic', () => {
        const a = buildRunGraph(spikeRun, NONE);
        const b = buildRunGraph(spikeRun, NONE);
        expect([...a.edges].map(([k, v]) => [k, [...v].sort()]))
            .toEqual([...b.edges].map(([k, v]) => [k, [...v].sort()]));
    });
});

describe('layered flood ⇔ full graph (verdict identity)', () => {
    // The lazy left-to-right flood must agree with the full N² graph
    // on every fixture × ability set (canRun.js header argument).
    for (const f of FIXTURES) {
        for (const [name, ab] of [['none', NONE], ['dj', DJ], ['blue', BLUE], ['all', allAbilities()]]) {
            it(`${f.id} × ${name}`, () => {
                const full = reachablePlatforms(buildRunGraph(f, ab));
                const lazy = reachableRunPlatforms(f, ab);
                expect([...lazy].sort()).toEqual([...full].sort());
            });
        }
    }

    it('goalHosts early-exit returns every goal host it reached', () => {
        const hosts = [...stepStone.pickups, ...stepStone.portals].map((g) => g.on);
        const reached = reachableRunPlatforms(stepStone, BLUE, { goalHosts: hosts });
        for (const h of hosts) expect(reached.has(h)).toBe(true);
    });
});

describe('survivesFrom', () => {
    it('a landed state before an uncrossable gap is doomed; before a crossable one it is not', () => {
        const land = (level, x0) => runQuery(level, ENTRANCE, NONE, { policy: null });
        const gapLanding = land(gapJump);
        expect(survivesFrom(gapJump, 'floorA', gapLanding.landingState, NONE)).toBe(true);
        const doomLanding = land(doubleGap);
        expect(survivesFrom(doubleGap, 'floorA', doomLanding.landingState, NONE)).toBe(false);
        expect(survivesFrom(doubleGap, 'floorA', doomLanding.landingState, DJ)).toBe(true);
    });
});
