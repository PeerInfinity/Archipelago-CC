/**
 * ⛓⛓⛓ SEEDLING FIDELITY SF — the solver's BUDGET items, witnessed
 * deterministically.
 *
 * ⚖ The user's idea (2026-10-04): *"first search for solutions that don't
 * involve sword dashes, then if it finds a dashless solution, and runs out of
 * time while searching the dash options, it falls back on the solution it
 * already found. This same pattern might work for other expensive and optional
 * strategies."*
 *
 * ⛔ NO CLOCK IS READ HERE. SF2's hook is a callback the CALLER owns; a wall
 * clock would make these rows depend on machine load, so every trip below is a
 * COUNTER, and every row is a pure function of where it tripped.
 *
 * - SF2 `sword-dash`: `r9-solve-2`'s own room plans ONE dash window (23 t
 *   against the undashed 47 t). A counter that trips anywhere inside that scan
 *   plays the DASHLESS plan — the `dashMode: 'none'` keys exactly, in L0, with
 *   no death — and the trace names `deadline`. A counter that never trips is
 *   byte-identical to no hook at all.
 * - SF2 `block-route`: `r8-solve-4`'s shove is the plan, so a trip there is a
 *   REFUSAL, and it says so by name.
 * - SF3: two slow refusals proved before their scans — L16's pit `(13,4)`
 *   (relaxed reachability) and swordless L14's chaser arm (no sword).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseTape } from './tapeFormat.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import {
    DEADLINE_SITES, SolverRefusal, deriveBlockRoute, solveSegment,
} from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAPES = join(HERE, 'fixtures', 'tapes');
const levelSource = atlasLevelSource();

function runFromCommitted(name) {
    const t = parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    const run = createLevelRun({
        levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards,
        noDamage: false, grants: t.grants, persistence: t.persistence, despawn: [],
        equips: t.equips, pins: t.pins ?? [], save: t.save ?? null,
        rng: t.rng ?? null, seam: t.seam ?? null, roles: ROLES,
    });
    return { run, committed: t };
}

/** The exit entity the atlas places toward `to`, off the boot level's own record. */
const exitToward = (level, to) => (levelSource(level).entities ?? [])
    .find((e) => Number(e.attrs?.to) === to);

/** One solve of a committed room's `reach-exit`, with `over` spread on top. */
function solveRoom(tape, to, over = {}) {
    const { run, committed } = runFromCommitted(tape);
    const exit = exitToward(committed.boot.level, to);
    const out = solveSegment({
        run, goals: [{ kind: 'reach-exit', exit: { x: exit.x, y: exit.y } }],
        name: tape, boot: committed.boot, ...over,
    });
    return {
        out, run,
        keys: out.perTick.map((h) => [...h].sort().join('+')),
        json: JSON.stringify(out.trace),
    };
}

/** A deterministic deadline: answers false `n` times, then true. */
function counter(n) {
    const asked = [];
    const shouldStop = (site) => { asked.push(site); return asked.length > n; };
    return { shouldStop, asked };
}

const freshRun = (boot, grants = []) => createLevelRun({
    levelSource, boot, noclip: false, noHazards: [], noDamage: false, grants,
    despawn: [], roles: ROLES,
});

describe('SF2: the anytime deadline — `sword-dash` is an UPGRADE, so a trip keeps the dashless plan', () => {
    const DASH_ROOM = ['r9-solve-2', 0];

    it('no hook, a `null` hook and a counter that never trips are byte-identical', () => {
        const bare = solveRoom(...DASH_ROOM);
        const nulled = solveRoom(...DASH_ROOM, { shouldStop: null });
        const never = counter(Number.MAX_SAFE_INTEGER);
        const asked = solveRoom(...DASH_ROOM, { shouldStop: never.shouldStop });
        // the room really dashes, so the scan is what the counter sat inside
        expect(bare.out.trace.rows.some((r) => r.strategy?.swordDash?.planned)).toBe(true);
        expect(never.asked.length).toBeGreaterThan(1);
        expect(never.asked.every((s) => s === 'sword-dash')).toBe(true);
        for (const other of [nulled, asked]) {
            expect(other.keys).toEqual(bare.keys);
            expect(other.json).toBe(bare.json);
            expect('deadline' in other.out).toBe(false);
        }
    });

    it('a counter that trips ANYWHERE in the scan plays the `dashMode: none` plan, in L0, with no death, and says `deadline`', () => {
        const total = counter(Number.MAX_SAFE_INTEGER);
        const full = solveRoom(...DASH_ROOM, { shouldStop: total.shouldStop });
        const dashless = solveRoom(...DASH_ROOM, { dashMode: 'none' });
        expect(dashless.keys.length).toBeGreaterThan(full.keys.length);
        const n = total.asked.length;
        for (const k of [0, Math.floor(n / 2), n - 1]) {
            const c = counter(k);
            const got = solveRoom(...DASH_ROOM, { shouldStop: c.shouldStop });
            expect(got.keys, `trip after ${k} consult(s)`).toEqual(dashless.keys);
            expect(got.run.level).toBe(0);
            expect(got.run.playerDeaths.length).toBe(0);
            expect(got.out.deadline).toEqual({
                tripped: true, first: 'sword-dash', sites: { 'sword-dash': 1 },
            });
            // ⛓ it LATCHES: asked k times false, once true, and never again
            expect(c.asked.length).toBe(k + 1);
            const walk = got.out.trace.rows.find((r) => r.strategy?.swordDash);
            expect(walk.strategy.swordDash).toMatchObject({ planned: false, why: 'deadline' });
        }
    });

    it('the site is named, so a caller that bounds only OTHER sites leaves the dash untouched', () => {
        const bare = solveRoom(...DASH_ROOM);
        const got = solveRoom(...DASH_ROOM, { shouldStop: (site) => site !== 'sword-dash' });
        expect(got.json).toBe(bare.json);
        expect(DEADLINE_SITES).toEqual(['sword-dash', 'stance-hypothesis', 'block-route',
            'kill-chaser', 'detour']);
    });

    it('a deadline that is not a callback is refused by name', () => {
        expect(() => solveRoom(...DASH_ROOM, { shouldStop: 5000 }))
            .toThrow(/shouldStop must be a function/);
    });
});

describe('SF2: the anytime deadline — a REQUIRED rung that trips is a refusal, and says so', () => {
    it('`r8-solve-4`: its shove is the plan, so a trip in the block-route search refuses BY NAME', () => {
        const solved = solveRoom('r8-solve-4', 5);
        expect(solved.run.level).toBe(5);
        let err = null;
        try { solveRoom('r8-solve-4', 5, { shouldStop: () => true }); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.message).toMatch(/hit `deadline`/);
        expect(err.message).toMatch(/⏱ DEADLINE/);
        expect(err.deadline).toMatchObject({ tripped: true, first: 'block-route' });
    });
});

describe('SF3: bounded refusals — the refusal is proved before the scan', () => {
    it('L16\'s pit (13,4): unreachable even in the RELAXED room, so the block-route search is not run', () => {
        const boot = { level: 16, x: 32, y: 64 };
        const run = freshRun(boot);
        const row = run.world.pushables.find((p) => p.id === 'pushableblock@256,80');
        const r = deriveBlockRoute(run, row,
            { kind: 'clear-path', aim: { x: 216, y: 72 }, allowTeleporter: null }, new Set());
        expect(r.steps).toBeNull();
        expect(r.expansions).toBe(0);
        // the EXHAUSTED shape ("there is none"), never a bound ("I could not decide")
        expect(r.refused.bound).toBeNull();
        expect(r.refused.why).toMatch(/every pushable removed.*SF3/);
        // and the solve it served is still a refusal
        expect(() => solveSegment({
            run: freshRun(boot), name: 'sf3-l16-pit', boot,
            goals: [{ kind: 'reach-pit', pit: { tx: 13, ty: 4, x: 208, y: 64 } }],
        })).toThrow(SolverRefusal);
    });

    it('swordless L14: the chaser arm refuses on the missing sword without its stance scan; DETOUR then solves; with the sword it still solves', () => {
        // ⛓ fidelity L14 (the DETOUR rung) turned this arrival from a refusal into a solve:
        // KILL's SF3 refusal now shows as the trace's rejected `kill` row, ahead of `detour`.
        const boot = { level: 14, x: 160, y: 64 };
        const exit = exitToward(14, 15);
        const goals = [{ kind: 'reach-exit', exit: { x: exit.x, y: exit.y } }];
        const bare = freshRun(boot);
        const out = solveSegment({ run: bare, goals, name: 'sf3-l14', boot });
        expect(bare.level).toBe(15);
        const row = out.trace.rows.find((r) => r.strategy?.rung === 'detour');
        const kill = row.rejected.find((r) => r.option === 'kill');
        expect(JSON.stringify(kill)).toMatch(/chaser arm: this run holds no sword.*stance scan was not run \(SF3\)/s);
        const run = freshRun(boot, [{ level: 14, items: ['sword'] }]);
        solveSegment({ run, goals, name: 'sf3-l14-sword', boot });
        expect(run.level).toBe(15);
        expect(run.playerDeaths.length).toBe(0);
    });
});

describe('the `detour` deadline site — the DETOUR rung is bounded by the same hook', () => {
    it('`detour` is a named site, and a trip there refuses swordless L14 BY NAME (no hook: it solves)', () => {
        expect(DEADLINE_SITES).toContain('detour');
        const boot = { level: 14, x: 160, y: 64 };
        const exit = exitToward(14, 15);
        const goals = [{ kind: 'reach-exit', exit: { x: exit.x, y: exit.y } }];
        const tripAt = (n) => {
            let asked = 0;
            try {
                solveSegment({ run: freshRun(boot), goals, name: 'detour-deadline', boot,
                    shouldStop: (site) => site === 'detour' && ++asked > n });
            } catch (e) { return e; }
            return null;
        };
        // the first consult is before the via set is planned: nothing of the search runs
        const before = tripAt(0);
        expect(before).toBeInstanceOf(SolverRefusal);
        expect(before.message).toMatch(/reached before the DETOUR search, so it was not run/);
        expect(before.message).toMatch(/⏱ DEADLINE/);
        expect(before.deadline).toMatchObject({ tripped: true, first: 'detour' });
        // a later consult is before a preview: the rung reports the work it had done
        const during = tripAt(3);
        expect(during).toBeInstanceOf(SolverRefusal);
        expect(during.message).toMatch(/DETOUR search after 2 preview\(s\)/);
        expect(during.deadline).toMatchObject({ tripped: true, first: 'detour' });
        // a callback that bounds only the OTHER sites leaves the rung, and the solve, untouched
        const run = freshRun(boot);
        solveSegment({ run, goals, name: 'detour-other-sites', boot,
            shouldStop: (site) => site === 'block-route' });
        expect(run.level).toBe(15);
    });
});
