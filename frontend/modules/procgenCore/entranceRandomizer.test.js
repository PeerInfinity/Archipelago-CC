/**
 * entranceRandomizer — the PROPERTY SUITE for the ER shuffle core (ER arc, E3).
 *
 * Over GENERATED graphs (a seeded generator below) and one family read from an
 * existing procgen output (`frontend/presets/procgen_maze/AP_{1,2,3}` — maze
 * rules.json files with doorways and no shuffle, read as DATA), every result
 * must be:
 *   - fully reachable (every region and location, under the injected evaluator);
 *   - coupled when asked (A→B ⇒ B→A);
 *   - group-legal (each target's group ∈ targetGroupLookup[exit's group]);
 *   - a bijection (every exit placed once, every target used once);
 *   - deterministic per seed, and seed-sensitive;
 * and an unsatisfiable input is REFUSED BY NAME.
 *
 * MUTANTS: each GER guard is switched off through `guards` and the suite is
 * shown to catch the loss. A guard whose loss the suite cannot see is pinned as
 * a FINDING (its row asserts the measured blindness, so a change in either
 * direction is noticed) — see the "findings" describe block.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
    randomizeEntrances, disconnectForRandomization, bakeTargetGroupLookup,
    makePlainGraphReach, plainGraphProgressionRegions, EntranceRandomizationError,
    EntranceLookup, ENTRANCE_TYPE,
} from './entranceRandomizer.js';
import { rngFor } from '../mazeRoom/procgenRng.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

// ── the generated family ────────────────────────────────────────────────

const STAIRS_LOOKUP = new Map([['up', ['down']], ['down', ['up']], ['side', ['side']]]);
const FLAT_LOOKUP = new Map([['0', ['0']]]);

/**
 * A random, vanilla-beatable region graph: a spanning tree of two-way doors
 * plus extra doors (optionally one-way exits), some doors gated on keys that
 * sit in EARLIER regions (so the vanilla graph is beatable by induction).
 * `stairs` gives each door an up/down orientation (or "side") so the group
 * filter has something to refuse.
 */
function generateGraph(seed, { regions = 8, extraDoors = 4, oneWays = 0, stairs = false, keys = 3 } = {}) {
    const rng = rngFor(seed);
    const R = Array.from({ length: regions }, (_, i) => `R${i}`);
    const exits = [{ name: 'Menu->R0', from: 'Menu', to: 'R0', requires: [] }];
    const locations = [];
    const keyRegion = new Map();
    for (let k = 0; k < keys; k += 1) {
        const at = rng.nextInt(Math.max(1, regions - 1));
        keyRegion.set(`key${k}`, at);
        locations.push({ name: `key${k}@R${at}`, region: `R${at}`, item: `key${k}`, requires: [] });
    }
    R.forEach((r) => locations.push({ name: `chest@${r}`, region: r, item: null, requires: [] }));
    let d = 0;
    const door = (i, j) => {
        // gate the i→j direction on a key held strictly before j (beatable by induction)
        const usable = [...keyRegion].filter(([, at]) => at < j).map(([k]) => k);
        const requires = usable.length && rng.next() < 0.4 ? [rng.pick(usable)] : [];
        const orient = !stairs ? null : rng.next() < 0.25 ? ['side', 'side'] : rng.next() < 0.5 ? ['up', 'down'] : ['down', 'up'];
        const id = d++;
        exits.push({ name: `d${id}a`, from: R[i], to: R[j], requires, type: ENTRANCE_TYPE.TWO_WAY, group: orient ? orient[0] : 0 });
        exits.push({ name: `d${id}b`, from: R[j], to: R[i], requires: [], type: ENTRANCE_TYPE.TWO_WAY, group: orient ? orient[1] : 0 });
    };
    for (let j = 1; j < regions; j += 1) door(rng.nextInt(j), j);
    for (let e = 0; e < extraDoors; e += 1) {
        const i = rng.nextInt(regions);
        let j = rng.nextInt(regions);
        if (j === i) j = (j + 1) % regions;
        door(Math.min(i, j), Math.max(i, j));
    }
    for (let o = 0; o < oneWays; o += 1) {
        const i = rng.nextInt(regions);
        const j = rng.nextInt(regions);
        exits.push({ name: `ow${o}`, from: R[i], to: R[j], requires: [], type: ENTRANCE_TYPE.ONE_WAY, group: stairs ? 'side' : 0 });
    }
    return { start: ['Menu'], regions: ['Menu', ...R], exits, locations };
}

/**
 * A DEAD-END-HEAVY graph: a chain of hubs, each with leaf rooms hanging off it
 * (a leaf's only door is its way in). Placing leaves before hubs caps the graph,
 * which is exactly what GER's dead-end preference exists to avoid.
 */
function generateComb(seed, { hubs = 6, leavesPerHub = 2 } = {}) {
    const rng = rngFor(seed);
    const exits = [{ name: 'Menu->H0', from: 'Menu', to: 'H0', requires: [] }];
    const regions = ['Menu'];
    const locations = [];
    let d = 0;
    const door = (a, b) => {
        const id = d++;
        exits.push({ name: `c${id}a`, from: a, to: b, requires: [], type: ENTRANCE_TYPE.TWO_WAY, group: 0 });
        exits.push({ name: `c${id}b`, from: b, to: a, requires: [], type: ENTRANCE_TYPE.TWO_WAY, group: 0 });
    };
    for (let h = 0; h < hubs; h += 1) {
        regions.push(`H${h}`);
        if (h > 0) door(`H${h - 1}`, `H${h}`);
        const leaves = 1 + rng.nextInt(leavesPerHub);
        for (let l = 0; l < leaves; l += 1) {
            regions.push(`L${h}_${l}`);
            locations.push({ name: `chest@L${h}_${l}`, region: `L${h}_${l}`, item: null, requires: [] });
            door(`H${h}`, `L${h}_${l}`);
        }
    }
    return { start: ['Menu'], regions, exits, locations };
}

/** rules.json (a procgen maze preset) → a plain graph with paired doorways. */
function graphFromRulesJson(rules) {
    const regions = rules.regions['1'];
    const start = rules.start_regions['1'].default;
    const toReq = (rule) => {
        if (rule.rule === 'True_') return [];
        if (rule.rule === 'Has') return [rule.args.item_name];
        if (rule.rule === 'And') return rule.children.flatMap(toReq);
        throw new Error(`graphFromRulesJson: rule ${rule.rule} is outside this adapter's conjunction-of-Has vocabulary`);
    };
    const exits = [];
    const locations = [];
    for (const [name, region] of Object.entries(regions)) {
        for (const ex of region.exits ?? []) {
            exits.push({ name: `${name}::${ex.name}`, from: name, to: ex.connected_region, requires: toReq(ex.access_rule) });
        }
        for (const loc of region.locations ?? []) {
            locations.push({ name: loc.name, region: name, requires: toReq(loc.access_rule), item: loc.item?.advancement ? loc.item.name : null });
        }
    }
    // a doorway = an exit whose reverse exists; the start's one-way entry stays fixed.
    const doorways = exits.filter((ex) => exits.some((o) => o.from === ex.to && o.to === ex.from));
    doorways.forEach((ex) => { ex.type = ENTRANCE_TYPE.TWO_WAY; ex.group = 0; });
    return { graph: { start, regions: Object.keys(regions), exits, locations }, doorways: doorways.map((e) => e.name) };
}

function prepare(graph, shuffled) {
    const dis = disconnectForRandomization(graph, shuffled, { oneWayTargetName: (ex) => `${ex.name}_t` });
    return {
        dis,
        reach: makePlainGraphReach(dis.graph),
        progressionRegions: plainGraphProgressionRegions(dis.graph),
    };
}

function run(graph, shuffled, { seed, coupled, lookup, guards, preserveGroupOrder = false }) {
    const { dis, reach, progressionRegions } = prepare(graph, shuffled);
    const input = {
        exits: dis.exits, targets: dis.targets, fixedEdges: dis.fixedEdges, progressionRegions,
        reach, rng: rngFor(seed), coupled, targetGroupLookup: lookup, guards, preserveGroupOrder,
    };
    try {
        return { input, dis, reach, result: randomizeEntrances(input) };
    } catch (err) {
        if (!(err instanceof EntranceRandomizationError)) throw err;
        return { input, dis, reach, error: err };
    }
}

/** Every property; returns the list of violations (empty = the result is good). */
function violations({ input, dis, reach, result }, graph, { coupled, lookup }) {
    const out = [];
    const exitBy = new Map(input.exits.map((e) => [e.name, e]));
    const targetBy = new Map(input.targets.map((t) => [t.name, t]));
    // bijection
    const exitCount = new Map();
    const targetCount = new Map();
    for (const p of result.placements) {
        exitCount.set(p.exit, (exitCount.get(p.exit) ?? 0) + 1);
        targetCount.set(p.target, (targetCount.get(p.target) ?? 0) + 1);
    }
    for (const e of input.exits) if (exitCount.get(e.name) !== 1) out.push(`exit ${e.name} placed ${exitCount.get(e.name) ?? 0}×`);
    for (const t of input.targets) if (targetCount.get(t.name) !== 1) out.push(`target ${t.name} used ${targetCount.get(t.name) ?? 0}×`);
    // groups + types
    for (const p of result.placements) {
        const e = exitBy.get(p.exit);
        const t = targetBy.get(p.target);
        if (!e || !t) { out.push(`unknown placement ${p.exit}->${p.target}`); continue; }
        const allowed = lookup.get(String(e.group)) ?? [];
        if (!allowed.map(String).includes(String(t.group))) out.push(`group: ${p.exit} [${e.group}] -> ${p.target} [${t.group}]`);
        if (e.type !== t.type) out.push(`type: ${p.exit} ${e.type} -> ${p.target} ${t.type}`);
    }
    // coupling
    if (coupled) {
        const pairs = new Set(result.placements.map((p) => `${p.exit}\u0001${p.target}`));
        for (const p of result.placements) {
            if (exitBy.get(p.exit)?.type !== ENTRANCE_TYPE.TWO_WAY) continue;
            if (!pairs.has(`${p.target}\u0001${p.exit}`)) out.push(`coupling: ${p.exit}->${p.target} has no ${p.target}->${p.exit}`);
        }
    }
    // full reachability under the injected evaluator
    const conns = result.placements.map((p) => ({ exit: p.exit, from: exitBy.get(p.exit)?.region, to: targetBy.get(p.target)?.region }));
    const r = reach(conns);
    for (const region of graph.regions) if (!r.regions.has(region)) out.push(`unreachable region ${region}`);
    const locs = new Set(r.locations);
    for (const l of graph.locations) if (!locs.has(l.name)) out.push(`unreachable location ${l.name}`);
    void dis;
    return out;
}

const FAMILIES = [
    { name: 'flat coupled', opts: { regions: 8, extraDoors: 4 }, coupled: true, lookup: FLAT_LOOKUP },
    { name: 'flat uncoupled', opts: { regions: 8, extraDoors: 4 }, coupled: false, lookup: FLAT_LOOKUP },
    { name: 'stairs coupled', opts: { regions: 10, extraDoors: 5, stairs: true }, coupled: true, lookup: STAIRS_LOOKUP },
    { name: 'stairs uncoupled + one-ways', opts: { regions: 10, extraDoors: 5, stairs: true, oneWays: 3 }, coupled: false, lookup: STAIRS_LOOKUP },
    { name: 'flat coupled + one-ways, sparse', opts: { regions: 12, extraDoors: 1, oneWays: 2, keys: 4 }, coupled: true, lookup: FLAT_LOOKUP },
    { name: 'comb (dead-end heavy) coupled', gen: generateComb, opts: { hubs: 6, leavesPerHub: 2 }, coupled: true, lookup: FLAT_LOOKUP },
    { name: 'comb (dead-end heavy) uncoupled', gen: generateComb, opts: { hubs: 6, leavesPerHub: 3 }, coupled: false, lookup: FLAT_LOOKUP },
];

function sweepFamily(fam, guards) {
    const stats = { ok: 0, refused: 0, violating: 0, firstViolation: null, refusals: [] };
    for (const seed of SEEDS) {
        const graph = (fam.gen ?? generateGraph)(seed, fam.opts);
        const vanilla = makePlainGraphReach(graph)([]);
        if (vanilla.regions.size !== graph.regions.length) throw new Error(`generator: seed ${seed} is not vanilla-beatable`);
        const shuffled = graph.exits.filter((e) => e.type).map((e) => e.name);
        const out = run(graph, shuffled, { seed, coupled: fam.coupled, lookup: fam.lookup, guards });
        if (out.error) { stats.refused += 1; stats.refusals.push(out.error); continue; }
        const v = violations(out, graph, fam);
        if (v.length) { stats.violating += 1; stats.firstViolation ??= { seed, v }; } else stats.ok += 1;
    }
    return stats;
}

describe('entranceRandomizer — the property suite (generated graphs)', () => {
    for (const fam of FAMILIES) {
        it(`${fam.name}: every result satisfies every property; refusals are by name and rare`, () => {
            const s = sweepFamily(fam);
            expect(s.firstViolation).toBe(null);
            expect(s.violating).toBe(0);
            for (const err of s.refusals) {
                expect(err.details.unplacedExits.length).toBeGreaterThan(0);
                expect(err.message).toMatch(/Stranded \(unplaced\) exits: /);
            }
            // GER is single-pass and MAY deadlock (the mode retries, E4), but on
            // these families it measured 0 refusals over every seed — pinned, so
            // a guard whose loss only costs success rate (the speculative sweep)
            // is still caught below.
            expect(s.refused).toBe(0);
            expect(s.ok).toBe(SEEDS.length);
        });
    }

    it('determinism: the same seed gives byte-identical placements; different seeds differ', () => {
        const fam = FAMILIES[2];
        const graph = generateGraph(7, fam.opts);
        const shuffled = graph.exits.filter((e) => e.type).map((e) => e.name);
        const a = run(graph, shuffled, { seed: 11, coupled: true, lookup: fam.lookup });
        const b = run(graph, shuffled, { seed: 11, coupled: true, lookup: fam.lookup });
        expect(a.error).toBeUndefined();
        expect(JSON.stringify(b.result)).toBe(JSON.stringify(a.result));
        const distinct = new Set();
        for (const seed of SEEDS.slice(0, 10)) {
            const r = run(graph, shuffled, { seed, coupled: true, lookup: fam.lookup });
            if (r.result) distinct.add(JSON.stringify(r.result.placements));
        }
        expect(distinct.size).toBeGreaterThan(1);
    });

    it('preserveGroupOrder keeps every property', () => {
        const fam = FAMILIES[2];
        let ok = 0;
        for (const seed of SEEDS.slice(0, 20)) {
            const graph = generateGraph(seed, fam.opts);
            const shuffled = graph.exits.filter((e) => e.type).map((e) => e.name);
            const out = run(graph, shuffled, { seed, coupled: true, lookup: fam.lookup, preserveGroupOrder: true });
            if (out.error) continue;
            expect(violations(out, graph, fam)).toEqual([]);
            ok += 1;
        }
        expect(ok).toBeGreaterThan(10);
    });
});

describe('entranceRandomizer — the preset family (procgen_maze AP_1..3, read as data)', () => {
    for (const n of [1, 2, 3]) {
        const file = path.join(REPO, `frontend/presets/procgen_maze/AP_${n}/AP_${n}_rules.json`);
        const { graph, doorways } = graphFromRulesJson(JSON.parse(readFileSync(file, 'utf8')));
        for (const coupled of [true, false]) {
            it(`AP_${n} (${doorways.length} doorways), coupled=${coupled}: all properties over ${SEEDS.length} seeds`, () => {
                expect(doorways.length).toBeGreaterThan(0);
                let ok = 0;
                for (const seed of SEEDS) {
                    const out = run(graph, doorways, { seed, coupled, lookup: FLAT_LOOKUP });
                    expect(out.error).toBeUndefined(); // measured: 0 refusals on every AP_n, both modes
                    expect(violations(out, graph, { coupled, lookup: FLAT_LOOKUP })).toEqual([]);
                    ok += 1;
                }
                expect(ok).toBe(SEEDS.length);
            });
        }
    }
});

describe('entranceRandomizer — refusals by name', () => {
    const lone = (lookup) => {
        // Start has one exit "a" (group in); the only targets are "out" — nothing it may connect to.
        const graph = {
            start: ['S'], regions: ['S', 'D'],
            exits: [
                { name: 'a', from: 'S', to: 'D', type: 'one_way', group: 'in' },
                { name: 'b', from: 'D', to: 'S', type: 'one_way', group: 'in' },
            ],
            locations: [],
        };
        const dis = disconnectForRandomization(graph, ['a', 'b'], {
            oneWayTargetName: (ex) => `${ex.name}_t`, targetGroup: () => 'out',
        });
        return () => randomizeEntrances({
            exits: dis.exits, targets: dis.targets, fixedEdges: dis.fixedEdges,
            reach: makePlainGraphReach(dis.graph), rng: rngFor(1), coupled: false, targetGroupLookup: lookup,
        });
    };

    it('a lone group with no legal target refuses with EntranceRandomizationError naming the exits and the group', () => {
        const go = lone(new Map([['in', ['in']], ['out', ['out']]]));
        expect(go).toThrow(EntranceRandomizationError);
        try { go(); } catch (err) {
            expect(err.details.strandedExits.map((e) => e.name).sort()).toEqual(['a', 'b']);
            expect(err.details.groups).toContain('in');
            expect(err.message).toMatch(/a \[group in, S\]/);
            expect(err.details.placements).toEqual([]);
            expect(typeof err.details.draws).toBe('number');
        }
    });

    it('a dead end that strands the remaining exits refuses (the validity check holds)', () => {
        // S has one exit; D1/D2 are dead ends; X's exit is unreachable (no target leads into X).
        const graph = {
            start: ['S'], regions: ['S', 'D1', 'D2', 'X'],
            exits: [
                { name: 's', from: 'S', to: 'D1', type: 'one_way' },
                { name: 'x', from: 'X', to: 'D2', type: 'one_way' },
            ],
            locations: [],
        };
        const dis = disconnectForRandomization(graph, ['s', 'x'], { oneWayTargetName: (ex) => `${ex.name}_t` });
        const go = () => randomizeEntrances({
            exits: dis.exits, targets: dis.targets, reach: makePlainGraphReach(dis.graph),
            rng: rngFor(3), coupled: false, targetGroupLookup: FLAT_LOOKUP,
        });
        expect(go).toThrow(EntranceRandomizationError);
        try { go(); } catch (err) {
            expect(err.details.strandedExits.map((e) => e.name)).toEqual(['x']);
            expect(err.details.unplacedTargets).toEqual(['x_t']);
            expect(err.details.placements).toEqual([{ exit: 's', target: 's_t' }]);
        }
    });

    it('preconditions refuse by name: count mismatch, missing group, duplicate names', () => {
        const reach = () => ({ regions: ['S'], exits: [] });
        const ex = { name: 'e', region: 'S', type: 'two_way', group: 0 };
        const t = { name: 't', region: 'S', type: 'two_way', group: 0 };
        const base = { reach, rng: rngFor(1), coupled: true, targetGroupLookup: FLAT_LOOKUP };
        expect(() => randomizeEntrances({ ...base, exits: [ex], targets: [] })).toThrow(/mismatched count/);
        expect(() => randomizeEntrances({ ...base, exits: [{ ...ex, group: 9 }], targets: [t] })).toThrow(/no target groups for group 9 \(exit e\)/);
        expect(() => randomizeEntrances({ ...base, exits: [ex, ex], targets: [t, { ...t, name: 'u' }] })).toThrow(/two exits are named e/);
        expect(() => randomizeEntrances({ ...base, reach: undefined, exits: [ex], targets: [t] })).toThrow(EntranceRandomizationError);
    });
});

describe('entranceRandomizer — the transforms', () => {
    it('disconnectForRandomization is pure and follows GER\'s naming contract', () => {
        const graph = {
            start: ['A'], regions: ['A', 'B'],
            exits: [
                { name: 'ab', from: 'A', to: 'B', type: 'two_way', group: 'up' },
                { name: 'ba', from: 'B', to: 'A', type: 'two_way', group: 'down' },
                { name: 'drop', from: 'A', to: 'B', type: 'one_way' },
                { name: 'fixed', from: 'B', to: 'A' },
            ],
            locations: [],
        };
        const before = JSON.stringify(graph);
        const dis = disconnectForRandomization(graph, ['ab', 'ba', 'drop'], { oneWayTargetName: (e) => `${e.name} landing` });
        expect(JSON.stringify(graph)).toBe(before);
        expect(dis.targets).toEqual([
            { name: 'ab', region: 'A', type: 'two_way', group: 'up' },
            { name: 'ba', region: 'B', type: 'two_way', group: 'down' },
            { name: 'drop landing', region: 'B', type: 'one_way', group: 0 },
        ]);
        expect(dis.fixedEdges).toEqual([{ from: 'B', to: 'A' }]);
        expect(dis.graph.exits.filter((e) => e.to === null).map((e) => e.name)).toEqual(['ab', 'ba', 'drop']);
        expect(() => disconnectForRandomization(graph, ['drop'])).toThrow(/needs a target name/);
        expect(() => disconnectForRandomization(graph, ['nope'])).toThrow(/no exit named nope/);
        // the vanilla pairing is the coupled pairing ab -> ba, so a coupled "shuffle" can restore it
        const out = randomizeEntrances({
            exits: dis.exits.slice(0, 2), targets: dis.targets.slice(0, 2), fixedEdges: dis.fixedEdges,
            reach: makePlainGraphReach(dis.graph), rng: rngFor(1), coupled: true, targetGroupLookup: STAIRS_LOOKUP,
        });
        expect(out.placements).toEqual([{ exit: 'ab', target: 'ba' }, { exit: 'ba', target: 'ab' }]);
        expect(out.couplings).toEqual([['ab', 'ba']]);
    });

    it('bakeTargetGroupLookup maps every exit group once', () => {
        const calls = [];
        const m = bakeTargetGroupLookup([{ group: 'up' }, { group: 'down' }, { group: 'up' }], (g) => { calls.push(g); return [g === 'up' ? 'down' : 'up']; });
        expect([...m]).toEqual([['up', ['down']], ['down', ['up']]]);
        expect(calls).toEqual(['up', 'down']);
    });

    it('EntranceLookup files targets as dead ends unless they reach a usable exit or progression', () => {
        const structure = {
            fixedOut: new Map([['C', ['P']]]),
            exitsByRegion: new Map([['B', [{ name: 'b' }]], ['Self', [{ name: 'self' }]]]),
            progressionRegions: new Set(['P']),
        };
        const targets = ['A', 'B', 'C', 'Self'].map((r) => ({ name: r === 'Self' ? 'self' : `t${r}`, region: r, group: 0 }));
        const lk = new EntranceLookup({ rng: rngFor(1), coupled: true, usableExitNames: new Set(['b', 'self']), structure, targets });
        expect([...lk.deadEnds].map((t) => t.name).sort()).toEqual(['self', 'tA']); // A: nothing; Self: only its own reverse
        expect([...lk.others].map((t) => t.name).sort()).toEqual(['tB', 'tC']);
        expect(lk.findTarget('tC').region).toBe('C');
        expect(lk.size).toBe(4);
    });
});

// ── MUTANTS ────────────────────────────────────────────────────────────

function sweepAll(guards) {
    return FAMILIES.map((fam) => ({ fam: fam.name, ...sweepFamily(fam, guards) }));
}

describe('entranceRandomizer — mutants: the suite catches each guard\'s loss', () => {
    it('validityCheck off → strandings (unreachable regions) appear', () => {
        const rows = sweepAll({ validityCheck: false });
        const hits = rows.filter((r) => r.violating > 0);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.some((r) => r.firstViolation.v.some((m) => /^unreachable/.test(m)))).toBe(true);
    });

    it('coupling off → coupled pairs break', () => {
        const rows = sweepAll({ coupling: false }).filter((r, i) => FAMILIES[i].coupled);
        expect(rows.every((r) => r.violating > 0)).toBe(true);
        expect(rows.some((r) => r.firstViolation.v.some((m) => /^coupling/.test(m)))).toBe(true);
    });

    it('groupFilter off → group violations appear', () => {
        const rows = sweepAll({ groupFilter: false }).filter((r, i) => FAMILIES[i].lookup === STAIRS_LOOKUP);
        expect(rows.every((r) => r.violating > 0)).toBe(true);
        expect(rows.some((r) => r.firstViolation.v.some((m) => /^group/.test(m)))).toBe(true);
    });

    it('speculativeSweep off → refusals appear (caught by the pinned zero-refusal rows)', () => {
        // ⚠ It cannot produce a BAD result: a stranding is still refused, so what
        // its loss costs is success rate — visible only because the family rows pin
        // refused === 0.
        const rows = sweepAll({ speculativeSweep: false });
        expect(rows.reduce((n, r) => n + r.violating, 0)).toBe(0);
        expect(rows.reduce((n, r) => n + r.refused, 0)).toBeGreaterThan(0);
    });
});

describe('entranceRandomizer — FINDING: a mutant the property suite does NOT catch (pinned, not deleted)', () => {
    const total = (rows, k) => rows.reduce((n, r) => n + r[k], 0);

    it('deadEndPreference off ALONE is invisible: no violation, no refusal, on every family', () => {
        // ⚠ FINDING. The speculative sweep covers for it: with one placeable exit
        // left, a dead-end target fails the speculative test and is skipped, so
        // the graph is not capped. This row pins the blindness, so a change in
        // either direction (a family that does see it, or a regression) is noticed.
        const rows = sweepAll({ deadEndPreference: false });
        expect(total(rows, 'violating')).toBe(0);
        expect(total(rows, 'refused')).toBe(0);
    });

    it('…but deadEndPreference + speculativeSweep off together → refusals on the dead-end-heavy comb', () => {
        const rows = sweepAll({ deadEndPreference: false, speculativeSweep: false });
        expect(total(rows, 'violating')).toBe(0);
        const comb = rows.find((r) => r.fam === 'comb (dead-end heavy) coupled');
        expect(comb.refused).toBeGreaterThan(0);
    });
});
