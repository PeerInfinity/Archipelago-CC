/**
 * solverPrefix — `solveSegment({prefix})`, the admission of a run that has
 * already ticked (Seedling JS solver-walk S0).
 *
 * The Playback Bot's solver mode (S1) solves a SHADOW: the page replays its
 * own session tape (staging + `perTick`) into a fresh run, hands that run to
 * the solver with the replayed keys as `prefix`, and plays the solution on
 * the live run. These rows hold the admission's contract:
 *
 *   1. `prefix: []` IS today — the same `perTick`, trace and danger queries
 *      as a call that does not name it, on two committed segments.
 *   2. A prefixed solve's `perTick` is the prefix followed by the solution,
 *      and the replay of that whole tape ends where the solved run ended.
 *   3. A ticked run with NO prefix still refuses with the v1 message, word
 *      for word; a prefix the run has not ticked through is refused by name.
 *   4. The witness: L4 (kit; `hold`/`shove`) and L6 (bare; `bait`) solved from
 *      a LIVE mid-room state of the JS runtime, through the real admission,
 *      and the solution played on the live page crosses with the end state
 *      identical to the shadow's.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 seed `perTick` empty instead of from the prefix
 *        -> 'perTick = prefix + solution' reds (the prefix is missing), and
 *           both witnesses red (the solution is sliced off the wrong tick)
 *   m2 drop the no-prefix refusal
 *        -> 'a ticked run with NO prefix still refuses' reds
 *   m3 drop the `ticksCompleted >= prefix.length` check
 *        -> 'a prefix the run never ticked through is refused' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { heldKeysAt, parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import {
    createRunForStaging, runTapeToStream, solveStaging, stagingFromTape,
} from './tapeRunner.js';
import { buildStagedTape } from './botDriverV1.js';
import { solveSegment } from './solverBot.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { returnKey, returnSpawnTable } from '../flashPanel/seedlingReturnSpawns.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const TAPES = join(ROOT, 'frontend/modules/seedlingDemo/fixtures/tapes');
const levelSource = atlasLevelSource();

/** The v1 refusal, verbatim — a ticked run with no prefix still gets it. */
const FRESH_REFUSAL = 'solveSegment: the run must be fresh (ticksCompleted 0) — the solver owns '
    + 'the whole segment from its declared boot, so the tape and the trace '
    + 'describe the same run from tick 0.';

/** A committed segment's staging (despawns dropped, as the producers solve it) and a fresh run on it. */
function committedStaging(name) {
    const committed = parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    const staging = solveStaging(stagingFromTape(committed));
    return { committed, staging, fresh: () => createRunForStaging(staging, levelSource) };
}

/** The serialisable face of a solve, for byte comparison. */
const faceOf = (out) => JSON.stringify({
    perTick: out.perTick.map((h) => [...h].sort()),
    trace: out.trace,
    dangerQueries: out.dangerQueries,
    transitions: out.transitions,
    equips: out.equips,
});

/** The two committed segments row 1 compares on (the same pair `solverBot.test` solves first). */
const SEGMENTS = [
    { name: 'r8-solve-2', goals: [{ kind: 'reach-exit', exit: { x: 48, y: 96 } }] },
    {
        name: 'r8-solve-10',
        goals: [
            { kind: 'collect-placement', placement: { x: 48, y: 48 } },
            { kind: 'reach-exit', exit: { x: 48, y: 16 } },
        ],
    },
];

describe('solveSegment({prefix}) — the admission of a ticked run', () => {
    for (const seg of SEGMENTS) {
        it(`\`prefix: []\` is today: ${seg.name} solves byte-identically with and without it`, () => {
            const { committed, fresh } = committedStaging(seg.name);
            const base = { goals: seg.goals, name: seg.name, boot: committed.boot };
            const today = solveSegment({ run: fresh(), ...base });
            const empty = solveSegment({ run: fresh(), ...base, prefix: [] });
            expect(faceOf(empty)).toBe(faceOf(today));
            expect(today.perTick.length).toBeGreaterThan(0);
        });
    }

    it('a prefixed solve: perTick = prefix + solution, and the replay of it ends where the run ended', () => {
        const seg = SEGMENTS[0];
        const { committed, staging, fresh } = committedStaging(seg.name);
        const K = 20;
        // The prefix is the committed tape's own first K ticks — any keys a
        // run really ticked through will do; these are known to stay on L2.
        const prefix = Array.from({ length: K }, (_, t) => heldKeysAt(committed, t));
        const run = fresh();
        for (const h of prefix) run.advance(h);
        expect(run.ticksCompleted).toBe(K);
        expect(run.level).toBe(committed.boot.level);
        const out = solveSegment({
            run, goals: seg.goals, name: seg.name, boot: committed.boot, prefix,
        });
        expect(out.perTick.length).toBeGreaterThan(K);
        expect(out.perTick.slice(0, K).map((h) => [...h].sort()))
            .toEqual(prefix.map((h) => [...h].sort()));
        // ⛔ COPIES — the caller's prefix is not the solver's tape.
        expect(out.perTick[0]).not.toBe(prefix[0]);
        // The whole tape is a tape FROM THE BOOT: replayed fresh, it ends where
        // the prefixed run ended — same level, same position, same crossing.
        const tape = parseTape(buildStagedTape({ staging, perTick: out.perTick, name: seg.name }));
        const { ticks, transitions } = runTapeToStream(tape, { levelSource });
        const last = ticks[ticks.length - 1];
        expect({ level: last.level, x: last.x, y: last.y })
            .toEqual({ level: run.level, x: run.state.x, y: run.state.y });
        expect(transitions).toEqual(out.transitions);
        expect(out.transitions[out.transitions.length - 1]).toMatchObject({ from_level: 2, to_level: 3 });
        // The trace indexes the WHOLE tape: every row's tick is past the prefix.
        for (const row of out.trace.rows) expect(row.tick).toBeGreaterThanOrEqual(K);
    });

    it('a ticked run with NO prefix still refuses — the v1 message, verbatim', () => {
        const seg = SEGMENTS[0];
        const { committed, fresh } = committedStaging(seg.name);
        for (const over of [{}, { prefix: [] }]) {
            const run = fresh();
            run.advance(new Set());
            expect(() => solveSegment({
                run, goals: seg.goals, name: seg.name, boot: committed.boot, ...over,
            })).toThrow(FRESH_REFUSAL);
            let message = null;
            try {
                solveSegment({ run, goals: seg.goals, name: seg.name, boot: committed.boot, ...over });
            } catch (err) { message = err.message; }
            expect(message).toBe(FRESH_REFUSAL);
        }
    });

    it('a prefix the run never ticked through is refused by name', () => {
        const seg = SEGMENTS[0];
        const { committed, fresh } = committedStaging(seg.name);
        const run = fresh();
        run.advance(new Set());
        const prefix = [new Set(), new Set(), new Set()];
        expect(() => solveSegment({
            run, goals: seg.goals, name: seg.name, boot: committed.boot, prefix,
        })).toThrow(/prefix of 3 tick\(s\).*has completed 1/s);
    });

    it('a prefix that is not an array of key sets is refused at the door', () => {
        const seg = SEGMENTS[0];
        const { committed, fresh } = committedStaging(seg.name);
        expect(() => solveSegment({
            run: fresh(), goals: seg.goals, name: seg.name, boot: committed.boot, prefix: 'up',
        })).toThrow(/prefix must be an array/);
        const run = fresh();
        run.advance(new Set());
        expect(() => solveSegment({
            run, goals: seg.goals, name: seg.name, boot: committed.boot, prefix: [['up']],
        })).toThrow(/prefix must be an array/);
    });
});

/**
 * ── THE WITNESS — §1.6's legs through the REAL admission (no Proxy) ──────
 *
 * The page's shape exactly: a JS runtime on the vanilla map, teleported into
 * the room, walked by the J2 walker for W ticks (enemies awake, the run is
 * mid-room and not fresh), then a SHADOW built from the session's own
 * staging and replayed through its `perTick`, solved with that `perTick` as
 * the prefix, and the solution played on the live runtime one key set per
 * tick.
 */
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const PLAYTHROUGH = JSON.parse(readFileSync(
    join(ROOT, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8')).preset_sidecars['1'];
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];

/** The state a shadow must reproduce: §1.5's digest. */
const digest = (run) => JSON.stringify({
    L: run.level, s: run.state, t: run.ticksCompleted, d: run.playerDeaths.length,
    tr: run.transitions.length, c: run.entities('chasers'), sb: run.entities('strikeBodies'),
});

function witness({ region, fromId, toId, walkTicks, kit }) {
    const pl = PLAYTHROUGH[region].playable_payload;
    const from = pl.exits.find((e) => e.exit_id === fromId);
    const spawn = returnSpawnTable(MAP).get(returnKey(pl.level, ...from.exit_tiles[0])) ?? from.entrance_spawn;
    const to = pl.exits.find((e) => e.exit_id === toId);
    const [, ex, ey] = /_(\d+)_(\d+)$/.exec(to.exit_id);
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    if (kit) rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, spawn.x, spawn.y] }]);
    rt.tick();
    rt.playback.walkTo({ kind: 'exit', level: pl.level, tiles: to.exit_tiles });
    rt.playback.play();
    for (let t = 0; t < walkTicks && rt.playback.state !== 'done'; t += 1) rt.tick();
    rt.playback.reset();
    const prefix = rt.session.perTick;
    const shadow = createRunForStaging(rt.session.staging, SRC);
    for (const h of prefix) shadow.advance(h);
    const shadowMatchesLive = digest(shadow) === digest(rt.run);
    const out = solveSegment({
        run: shadow, goals: [{ kind: 'reach-exit', exit: { x: Number(ex), y: Number(ey) } }],
        name: `witness-${region}`, boot: rt.session.staging.boot, prefix,
    });
    const solution = out.perTick.slice(prefix.length);
    let crossed = false;
    for (const h of solution) if (rt.tick(new Set(h)).crossing) crossed = true;
    return {
        level: pl.level, prefixLength: prefix.length, shadowMatchesLive, out, solution, crossed,
        endIdentical: digest(shadow) === digest(rt.run), liveLevel: rt.run.level, shadowLevel: shadow.level,
        verbs: [...new Set(out.trace.rows.map((r) => r.strategy.verb))].sort(),
    };
}

describe('the witness — a LIVE mid-room state solves through the real admission', () => {
    it('L4 (kit): hold + shove from 40 walker ticks in; the live page crosses to L5, end identical', () => {
        const w = witness({
            region: 'level_4', fromId: 'in_L3_128_48', toId: 'out_stairsdown_64_16', walkTicks: 40, kit: true,
        });
        expect(w.prefixLength).toBeGreaterThan(1);
        expect(w.shadowMatchesLive).toBe(true);
        expect(w.verbs).toEqual(expect.arrayContaining(['hold', 'shove']));
        expect(w.solution.length).toBeGreaterThan(0);
        expect(w.crossed).toBe(true);
        expect(w.liveLevel).toBe(5);
        expect(w.endIdentical).toBe(true);
    });

    it('L6 (bare): bait past the bobs from 150 walker ticks in; the live page crosses to L7, end identical', () => {
        const w = witness({
            region: 'level_6', fromId: 'in_L5_48_112', toId: 'out_stairsup_224_32', walkTicks: 150, kit: false,
        });
        expect(w.prefixLength).toBeGreaterThan(100);
        expect(w.shadowMatchesLive).toBe(true);
        expect(w.verbs).toContain('bait');
        expect(w.crossed).toBe(true);
        expect(w.liveLevel).toBe(7);
        expect(w.endIdentical).toBe(true);
    });
});
