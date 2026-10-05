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
    DEADLINE_SITES, SolverRefusal, solveSegment,
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
            'kill-chaser']);
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
