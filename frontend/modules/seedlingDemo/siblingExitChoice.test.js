/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SIBLING-EXIT — the switch, the sibling set, the choice, the solve arm, the controller's goal
 * and the region binding's reading of the door taken (js-22 items 1–3 and 5; `siblingExitChoice.js`).
 *
 * The rules are the shipped playthrough's (`seedling_playthrough` AP_14089154938208861744); a row may USE the L16 pit
 * (`level_16__r1c9 -> level_17`, `#2` … `#7`) as its witness, and the logic it pins names no level.
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 `sameApRule` compares rule NAMES (`a.rule === b.rule`)       -> "a rule with other args is not the same rule" red.
 *   m2 the set drops the `connected_region` test                    -> "a non-sibling is refused by name" red (the rules copy
 *                                                                      whose #3 reaches another region keeps #3).
 *   m3 `chooseSiblingExit` keeps solve-time order (no sort)         -> "deterministic under any row order" red.
 *   m4 the solve arm solves the siblings when the named exit is clean -> "a hitless named exit solves nothing else" red.
 *   m5 the controller attaches siblings with the switch OFF         -> "OFF: the goal is today's" red.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SIBLING_EXIT_CHOICE, SIBLING_EXIT_CHOICE_DEFAULT, apSiblingExitsOf, attachSiblingSolverGoals, chooseSiblingExit,
    notSiblingReason, sameApRule, siblingExitNote, solveWithSiblings, withSiblingExitChoice,
} from './siblingExitChoice.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { resolveSeedlingAtlasGoal } from '../flashPanel/seedlingPlaybackController.js';
import { SeedlingRegionBinding } from '../flashPanel/seedlingRegionBinding.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const RULES = JSON.parse(readFileSync(abs('../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json'), 'utf8'));
const REGIONS = new Map(Object.entries(RULES.preset_sidecars['1']).map(([r, s]) => [r, s.playable_payload]));
const SETS = apSiblingExitsOf(RULES, '1', REGIONS);
const PIT = 'level_16__r1c9 -> level_17';
const PIT_REGION = 'level_16__r1c9';
const exitRow = (region, name) => RULES.regions['1'][region].exits.find((e) => e.name === name);

describe('⛓ SIBLING-EXIT — the switch', () => {
    it('ships OFF, is a solver env name, and `withSiblingExitChoice` restores it', () => {
        expect(SIBLING_EXIT_CHOICE_DEFAULT).toBe(false);
        expect(SIBLING_EXIT_CHOICE.enabled).toBe(globalThis.process?.env?.SEEDLING_SIBLING_EXIT_CHOICE === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SIBLING_EXIT_CHOICE');
        const was = SIBLING_EXIT_CHOICE.enabled;
        expect(withSiblingExitChoice(true, () => SIBLING_EXIT_CHOICE.enabled)).toBe(true);
        expect(withSiblingExitChoice(false, () => SIBLING_EXIT_CHOICE.enabled)).toBe(false);
        expect(SIBLING_EXIT_CHOICE.enabled).toBe(was);
    });
});

describe('⛓ SIBLING-EXIT — the set is EXACTLY the AP-equivalent exits (js-22 item 2)', () => {
    it('rules are compared as OBJECTS: key order is not a difference, other args are', () => {
        expect(sameApRule({ rule: 'Has', args: { item_name: 'A' } }, { args: { item_name: 'A' }, rule: 'Has' })).toBe(true);
        expect(sameApRule({ rule: 'Has', args: { item_name: 'A' } }, { rule: 'Has', args: { item_name: 'B' } })).toBe(false);
        expect(sameApRule({ rule: 'True_' }, null)).toBe(false);
        expect(sameApRule(undefined, null)).toBe(true);
    });

    it('the L16 pit: exactly its six siblings, in exit-name order, each one door tile into level 17', () => {
        const sibs = SETS.get(PIT);
        expect(sibs.map((s) => s.name)).toEqual([2, 3, 4, 5, 6, 7].map((n) => `${PIT} #${n}`));
        for (const s of sibs) {
            expect(s.tiles).toHaveLength(1);
            expect(s.level).toBe(17);
        }
        // every member sees the other six
        for (const s of sibs) expect(SETS.get(s.name).map((x) => x.name)).toEqual([PIT, ...sibs.map((x) => x.name)].filter((n) => n !== s.name).sort());
    });

    it('every set on the seed-1 rules is one source region, one connected_region and one rule OBJECT (generic)', () => {
        expect(SETS.size).toBeGreaterThan(0);
        for (const [name, sibs] of SETS) {
            const region = Object.keys(RULES.regions['1']).find((r) => RULES.regions['1'][r].exits.some((e) => e.name === name));
            const me = exitRow(region, name);
            for (const s of sibs) {
                const other = exitRow(region, s.name);
                expect(other, `${s.name} leaves ${region}`).toBeTruthy();
                expect(notSiblingReason(me, other)).toBeNull();
            }
        }
    });

    it('a non-sibling is refused by name: another region reached, another rule', () => {
        const pit = exitRow(PIT_REGION, PIT);
        const rope = exitRow(PIT_REGION, 'level_16__r1c9 -> level_16__r1c1');
        expect(notSiblingReason(pit, rope)).toBe(`"${rope.name}" reaches level_16__r1c1, not level_17`);
        expect(SETS.get(rope.name)).toBeUndefined();
        const sameTargetOtherRule = { ...exitRow(PIT_REGION, `${PIT} #2`), access_rule: { rule: 'Has', args: { item_name: 'Seal' } } };
        expect(notSiblingReason(pit, sameTargetOtherRule)).toMatch(/carries another rule \(\{"rule":"Has"/);
        // the derivation applies the same test: a rules copy whose #2 needs a Seal drops #2 from the set
        const copy = structuredClone(RULES);
        copy.regions['1'][PIT_REGION].exits.find((e) => e.name === `${PIT} #2`).access_rule = sameTargetOtherRule.access_rule;
        const otherTarget = copy.regions['1'][PIT_REGION].exits.find((e) => e.name === `${PIT} #3`);
        otherTarget.connected_region = 'level_16__r1c1';
        expect(apSiblingExitsOf(copy, '1', REGIONS).get(PIT).map((s) => s.name)).toEqual([4, 5, 6, 7].map((n) => `${PIT} #${n}`));
    });
});

describe('⛓ SIBLING-EXIT — the deterministic choice (js-22 item 3)', () => {
    const row = (name, ticks, hits, ok = true) => ({ name, ok, ticks, hits, deaths: 0 });

    it('a hitless named exit is kept, whatever the siblings say', () => {
        expect(chooseSiblingExit([row('a', 300, 0), row('b', 10, 0)])).toMatchObject({ chosen: 'a', index: 0 });
    });

    it('a named exit that hits gives way to the hitless sibling with fewest ticks, then by exit name', () => {
        expect(chooseSiblingExit([row('a', 100, 1), row('c', 200, 0), row('b', 150, 0), row('d', 90, 2)]))
            .toMatchObject({ chosen: 'b', index: 2 });
        expect(chooseSiblingExit([row('a', 100, 1), row('c', 150, 0), row('b', 150, 0)])).toMatchObject({ chosen: 'b', index: 2 });
    });

    it('deterministic under any row order (never solve-time order)', () => {
        const sibs = [row('#4', 174, 1), row('#3', 195, 0), row('#2', 315, 0), row('#6', 209, 0), row('#5', 233, 0)];
        const want = chooseSiblingExit([row('#1', 149, 1), ...sibs]).chosen;
        expect(want).toBe('#3');
        for (let k = 0; k < sibs.length; k += 1) {
            const rot = [...sibs.slice(k), ...sibs.slice(0, k)];
            expect(chooseSiblingExit([row('#1', 149, 1), ...rot]).chosen).toBe(want);
            expect(chooseSiblingExit([row('#1', 149, 1), ...rot.reverse()]).chosen).toBe(want);
        }
    });

    it('every sibling hits (or has no plan): the named exit is kept, and the note says so', () => {
        const c = chooseSiblingExit([row('a', 100, 1), row('b', 90, 1), row('c', null, null, false)]);
        expect(c).toMatchObject({ chosen: 'a', index: 0 });
        expect(c.why).toMatch(/every sibling hits or has no plan — the named exit is kept/);
    });

    it('a named exit with no plan keeps its refusal (the choice moves a hit, not a refusal)', () => {
        expect(chooseSiblingExit([row('a', null, null, false), row('b', 90, 0)])).toMatchObject({ chosen: 'a', index: 0 });
    });
});

describe('⛓ SIBLING-EXIT — the solve arm (`solveWithSiblings`)', () => {
    const answer = (ticks, hits) => ({ ok: true, plan: { solution: Array.from({ length: ticks }, () => new Set()), modelHits: { hits, deaths: 0 } } });
    const goals = { kind: 'reach-pit', pit: { tx: 1, ty: 1 }, siblingsOf: 'named',
        siblings: [{ name: 'named #2', goal: { kind: 'reach-pit', pit: { tx: 2, ty: 1 } } }, { name: 'named #3', goal: { kind: 'reach-pit', pit: { tx: 3, ty: 1 } } }] };

    it('a hitless named exit solves nothing else, and ships unchanged but for the stamp', () => {
        const asked = [];
        const out = solveWithSiblings({ solverGoal: goals, perTick: [] }, (r) => { asked.push(r.solverGoal); return answer(50, 0); });
        expect(asked).toEqual([{ kind: 'reach-pit', pit: { tx: 1, ty: 1 } }]);
        expect(out.plan.siblingExit).toMatchObject({ named: 'named', chosen: 'named', solved: 1, skipped: ['named #2', 'named #3'] });
        expect(siblingExitNote(out.plan)).toBe('');
    });

    it('a named exit that hits: each sibling solved once from the SAME request, the hitless one shipped; onPass hears the named only', () => {
        const asked = [];
        const heard = [];
        const by = { 1: answer(149, 1), 2: answer(315, 0), 3: answer(195, 0) };
        const out = solveWithSiblings({ solverGoal: goals, perTick: ['p'], live: 'L' }, (r, hear) => {
            asked.push({ tx: r.solverGoal.pit.tx, perTick: r.perTick, live: r.live });
            hear('pass', r.solverGoal.pit.tx);
            return by[r.solverGoal.pit.tx];
        }, (a, b) => heard.push(b));
        expect(asked).toEqual([1, 2, 3].map((tx) => ({ tx, perTick: ['p'], live: 'L' })));
        expect(heard).toEqual([1]);
        expect(out.plan.solution).toHaveLength(195);
        expect(out.plan.siblingExit).toMatchObject({ named: 'named', chosen: 'named #3', solved: 3 });
        expect(siblingExitNote(out.plan)).toMatch(/^sibling exit "named #3" in place of "named" — the named exit takes 1 hit/);
    });

    it('the mapper half: OFF-shaped goals come back as the SAME object; siblings are mapped one by one', () => {
        const mapped = { kind: 'reach-pit', pit: { tx: 1, ty: 1 } };
        expect(attachSiblingSolverGoals({ kind: 'exit', name: 'x', tiles: [[1, 1]] }, mapped, () => { throw new Error('no'); })).toBe(mapped);
        const g = { kind: 'exit', name: 'x', tiles: [[1, 1]], siblings: [{ name: 'x #2', tiles: [[2, 1]] }, { name: 'x #3', tiles: [[9, 9]] }] };
        const out = attachSiblingSolverGoals(g, mapped, (sg) => (sg.tiles[0][0] === 2 ? { kind: 'reach-pit', pit: { tx: 2, ty: 1 } } : null));
        expect(out).toEqual({ ...mapped, siblingsOf: 'x', siblings: [{ name: 'x #2', goal: { kind: 'reach-pit', pit: { tx: 2, ty: 1 } } }],
            siblingsDropped: [{ name: 'x #3', why: 'the solver has no goal for it' }] });
    });
});

describe('⛓ SIBLING-EXIT — the controller goal (js-22 item 1: OFF is today\'s)', () => {
    const atlas = { regions: REGIONS, siblingExits: SETS };

    it('OFF: the goal is today\'s, even from a map that carries siblings', () => {
        const r = withSiblingExitChoice(false, () => resolveSeedlingAtlasGoal({ kind: 'exit', name: PIT }, atlas, { region: PIT_REGION }));
        expect(r).toEqual({ goal: { kind: 'exit', level: 16, tiles: [[12, 3]], name: PIT } });
    });

    it('ON: the goal carries its six siblings and their tiles; an exit with none is today\'s', () => {
        const r = withSiblingExitChoice(true, () => resolveSeedlingAtlasGoal({ kind: 'exit', name: PIT }, atlas, { region: PIT_REGION }));
        expect(r.goal).toMatchObject({ kind: 'exit', level: 16, tiles: [[12, 3]], name: PIT });
        expect(r.goal.siblings.map((s) => s.name)).toEqual(SETS.get(PIT).map((s) => s.name));
        expect(r.goal.siblings.map((s) => s.tiles[0])).toEqual([[13, 3], [14, 3], [12, 4], [13, 4], [14, 4], [13, 5]]);
        const lone = 'level_16__r1c9 -> level_16__r4c21';
        const other = withSiblingExitChoice(true, () => resolveSeedlingAtlasGoal({ kind: 'exit', name: lone }, atlas, { region: PIT_REGION }));
        expect(other.goal?.siblings).toBeUndefined();
    });
});

describe('⛓ SIBLING-EXIT — the region binding reads the door TAKEN (js-22 items 2 and 5)', () => {
    // A pit writes no `pendingExit` (only Teleporter/Stairs do): the crossing is the `level` report, tie-broken on
    // `Main.playerPositionX/Y`, which the fall sets to the exit's CTOR spawn (`Player.checkFallingInPit` → `new Game`).
    const world = REGIONS.get(PIT_REGION);
    const cross = (spawn, to) => {
        let t = 0;
        const b = new SeedlingRegionBinding({ now: () => (t += 60000) });
        b.onStateReport('level', world.level);
        b.onLoadRegion({ region_id: PIT_REGION, world, arrivedFrom: null });
        b.onStateReport('level', world.level);
        b.onStateReport('playerPositionX', spawn.x);
        b.onStateReport('playerPositionY', spawn.y);
        return b.onStateReport('level', to);
    };

    it('each of the seven pit landings is credited as the exit actually taken, into level_17', () => {
        const pits = world.exits.filter((e) => e.target_level === 17);
        expect(pits).toHaveLength(7);
        for (const e of pits) {
            const move = cross(e.target_spawn, 17).find((x) => x.type === 'regionMove');
            expect(move, e.exitName).toMatchObject({ type: 'regionMove', sourceRegion: PIT_REGION, targetRegion: 'level_17', exitName: e.exitName });
        }
    });

    it('a landing no exit of the region reaches is refused by name, as today (no region move)', () => {
        const out = cross({ x: 0, y: 0 }, 99);
        expect(out.some((x) => x.type === 'regionMove')).toBe(false);
        expect(out.find((x) => x.type === 'warn')?.message).toMatch(/moved from level 16 to level 99, which region "level_16__r1c9" has no marked exit to/);
    });
});
