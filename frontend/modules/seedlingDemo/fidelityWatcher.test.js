/**
 * Seedling fidelity WATCHER: a watcher placed with no text is not an obstacle.
 *
 *   · The game's rule (`NPCs/NPC.as`, `NPCs/Watcher.as`): `NPC.talk()` runs only
 *     `if (p && myText[0].length > 0)` (`NPC.as:188`), and `myText` is
 *     `prepNewText(_text)` (`:68`). A watcher whose `text` is "" therefore never
 *     opens a dialogue, never raises `Game.freezeObjects`, and never writes its
 *     tag; `Watcher.hit()` is gated on `text != ""` (`Watcher.as:119`) and its
 *     type `"Watcher"` is in no solids list. Ten of the eleven placed watchers
 *     are such placements; L114's is the only one that speaks.
 *   · The model: `levelRun.stepWatchersNow` has gated `talk()` on the text since
 *     R6 slice 6d (`canTalk`), but the census (`levelWorld`'s `watcher` row)
 *     priced all eleven as auto-talk volumes, and the solver refused route steps
 *     95 and 101 on L37's `watcher@104,264`. The row's `speaksFrom: 'text'` now
 *     lists an empty placement in `world.silentHazards` instead.
 *   · Two more census divergences on the one SPEAKING watcher (L114): its
 *     circle was priced as the 48x48 square (`inRange` is `FP.distance <= 24`,
 *     a disc, inclusive), and a CLEARED tag left the volume in place although
 *     `Watcher.update` runs `talk()` only while the tag holds.
 *   · The `talk` verb (`solverBot.resolveTalkStrategy` / `execTalk`): a speaking
 *     watcher's circle on the frontier is passed by its dialogue — approach until
 *     it opens, page it on the ceremony cadence, and the cleared tag silences it.
 *   · The witnesses (`scripts/procgen/plan-seedling-watcher-witness.mjs`,
 *     recorded on the game): `watcher-l37-reach-l38` (step 95) and
 *     `watcher-l37-reach-l44` (step 101) are the solver's plans, each crossing
 *     the old 48x48 square; `watcher-l37-silent-lean` stands inside the 24 px
 *     circle itself and walks on; `watcher-l114-silent` walks through L114's
 *     circle with `{114,0}` cleared; `watcher-l114-talk` talks its way through.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, rectsOverlap, RELAXED_ROLES, ROLES } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, solveSegment } from './solverBot.js';
import { R8_STRATEGY_EXECUTORS } from './r8Acceptance.js';
import { KNOWN_STRATEGY_VERBS, summarizeTrace } from './decisionTrace.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const expectation = (name) => JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));

/** `NPC.talkRange` (`NPCs/NPC.as:27`); L37's watcher centre (`NPC.as:47`'s half tile). */
const TALK_RANGE = 24;
const L37_WATCHER = { id: 'watcher@104,264', ex: 112, ey: 272 };

/** Every placed watcher in the extract, with its text as `Game.as:2394` passes it. */
const PLACED = MAP.levels.flatMap((l) => l.entities
    .filter((e) => e.type === 'watcher')
    .map((e) => ({ level: l.level, id: `watcher@${e.x},${e.y}`, text: e.attrs?.text ?? '' })));

describe('fidelity WATCHER — the census lists a watcher with no text as SILENT', () => {
    it('the extract places eleven watchers, and only L114\'s has text', () => {
        expect(PLACED).toHaveLength(11);
        expect(PLACED.filter((w) => w.text !== '').map((w) => w.level)).toEqual([114]);
    });

    it.each(PLACED)('L$level $id: silent iff its text is empty', ({ level, id, text }) => {
        const w = buildLevelWorld(MAP.levels.find((l) => l.level === level), { roles: RELAXED_ROLES });
        const volume = w.proximityHazards.filter((h) => h.tag === 'watcher');
        const silent = w.silentHazards.filter((h) => h.id === id);
        if (text === '') {
            expect(volume).toEqual([]);
            expect(silent).toHaveLength(1);
        } else {
            expect(volume).toHaveLength(1);
            expect(volume[0]).toMatchObject({ kind: 'auto-talk' });
            expect(silent).toEqual([]);
        }
    });

    it('CONTROL: the same L37 placement WITH text is priced as the auto-talk volume again', () => {
        const record = structuredClone(MAP.levels.find((l) => l.level === 37));
        const e = record.entities.find((x) => `${x.type}@${x.x},${x.y}` === L37_WATCHER.id);
        e.attrs = { ...e.attrs, text: 'Hello.' };
        const w = buildLevelWorld(record, { roles: ROLES });
        expect(w.silentHazards).toEqual([]);
        expect(w.proximityHazards.filter((h) => h.tag === 'watcher')).toEqual([
            expect.objectContaining({ kind: 'auto-talk', disc: { x: 112, y: 272, r: 24, inclusive: true } }),
        ]);
    });
});

describe('fidelity WATCHER — the run never talks to a silent watcher', () => {
    it('`watcher-l37-silent-lean` stands inside the circle, moves on every `left` tick, and earns nothing', () => {
        const t = tape('watcher-l37-silent-lean');
        const out = runTape(t, { levelSource: SRC });
        const inside = out.ticks.filter((o) => Math.hypot(o.x - L37_WATCHER.ex, o.y - L37_WATCHER.ey)
            <= TALK_RANGE);
        expect(inside.length).toBeGreaterThan(20);
        // `left` is held on ticks 20..39.
        for (let i = 21; i <= 40; i += 1) expect(out.ticks[i].x, `t${i}`).not.toBe(out.ticks[i - 1].x);
        const run = createRunForStaging({ ...t, equips: [] }, SRC);
        for (let i = 0; i < t.tick_count; i += 1) {
            const held = new Set(t.inputs.filter((s) => s.from <= i && i < s.to).map((s) => s.key));
            run.advance(held);
        }
        expect(run.watcherTalks).toEqual([]);
        expect(run.watcherFlags).toEqual([]);
    });

    it('THE GAME agrees: its recorded stream moves on every `left` tick inside the circle', () => {
        const game = expectation('watcher-l37-silent-lean');
        const model = runTape(tape('watcher-l37-silent-lean'), { levelSource: SRC });
        expect(game.ticks).toHaveLength(model.ticks.length);
        for (let i = 21; i <= 40; i += 1) expect(game.ticks[i].x, `t${i}`).not.toBe(game.ticks[i - 1].x);
        expect(game.ticks.some((o) => Math.hypot(o.x - L37_WATCHER.ex, o.y - L37_WATCHER.ey) <= 19.01))
            .toBe(true);
        expect(game.transitions).toEqual([]);
    });
});

const CASES = [
    { name: 'watcher-l37-reach-l38', step: 95, to: 38, goal: { kind: 'reach-exit', exit: { x: 288, y: 0 } } },
    { name: 'watcher-l37-reach-l44', step: 101, to: 44, goal: { kind: 'reach-exit', exit: { x: 0, y: 256 } } },
];

describe.each(CASES)('fidelity WATCHER — route step $step ($name)', ({ name, to, goal }) => {
    const t = tape(name);
    it(`the solver crosses L37 past the silent watcher into L${to}`, () => {
        const staging = { ...t, equips: [], despawn: [], tick0: null };
        const run = createRunForStaging(staging, SRC);
        expect(run.world.silentHazards.map((h) => h.id)).toEqual([L37_WATCHER.id]);
        expect(run.world.proximityHazards.filter((h) => h.tag === 'watcher')).toEqual([]);
        const out = solveSegment({ run, goals: [goal], name: `${name}-resolve`, boot: staging.boot });
        expect(out.perTick.length).toBe(t.tick_count);
        expect(run.level).toBe(to);
    });

    it('the committed tape crosses the census\'s old square, and the game recorded the crossing', () => {
        const model = runTape(t, { levelSource: SRC });
        const sq = { x: 88, y: 248, right: 136, bottom: 296 };
        const inSquare = model.ticks.filter((o) => o.level === 37 && rectsOverlap(playerBoxAt(o.x, o.y), sq));
        expect(inSquare.length).toBeGreaterThan(0);
        const game = expectation(name);
        expect(game.transitions).toEqual([{ t: t.tick_count, from_level: 37, to_level: to }]);
        expect(game.ticks).toHaveLength(model.ticks.length);
    });
});

const L114 = MAP.levels.find((l) => l.level === 114);
const L114_WATCHER = { id: 'watcher@72,72', ex: 80, ey: 80 };
/** The player box's entity offsets, so an avoid query can be asked at a POSITION. */
const boxAt = (x, y) => playerBoxAt(x, y);

describe('fidelity WATCHER — L114: the circle exactly, and the cleared state', () => {
    it('the volume is the 24 px DISC, inclusive of its rim (`FP.distance <= talkRange`)', () => {
        const w = buildLevelWorld(L114, { roles: RELAXED_ROLES });
        expect(w.proximityHazards).toEqual([expect.objectContaining({
            tag: 'watcher', kind: 'auto-talk', rect: null,
            disc: { x: 80, y: 80, r: 24, inclusive: true },
        })]);
        const hits = (x, y) => w.avoidVolumesAt(boxAt(x, y), { x, y }).length > 0;
        expect(hits(80, 56)).toBe(true); // exactly 24: in range
        expect(hits(80, 55.99)).toBe(false);
        // The corridor's top cell centre: 25.3 px, outside the circle, inside the old square.
        expect(Math.hypot(72 - 80, 56 - 80)).toBeGreaterThan(24);
        expect(hits(72, 56)).toBe(false);
    });

    it('built with {114,0} CLEARED, the watcher is SILENT: no volume, and the reason names the tag', () => {
        const w = buildLevelWorld(L114, { roles: ROLES, cleared: [0] });
        expect(w.proximityHazards).toEqual([]);
        expect(w.silentHazards).toEqual([expect.objectContaining({
            id: L114_WATCHER.id, why: expect.stringMatching(/\{114,0\} is cleared/),
        })]);
    });

    it('`watcher-l114-silent`: the solver walks through the circle with the tag cleared, and never talks', () => {
        const t = tape('watcher-l114-silent');
        const run = createRunForStaging({ ...t, equips: [] }, SRC);
        const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 144 } }],
            name: 'watcher-l114-silent-resolve', boot: t.boot });
        expect(run.level).toBe(113);
        expect(out.perTick.length).toBe(t.tick_count);
        expect(out.records.filter((r) => r.strategy === 'talk')).toEqual([]);
        expect(run.watcherTalks).toEqual([]);
    });

    it('THE GAME agrees: the cleared watcher never froze the walk, which crossed into L113', () => {
        const t = tape('watcher-l114-silent');
        const game = expectation('watcher-l114-silent');
        expect(game.transitions).toEqual([{ t: t.tick_count, from_level: 114, to_level: 113 }]);
        const inside = game.ticks.filter((o) => o.level === 114
            && Math.hypot(o.x - L114_WATCHER.ex, o.y - L114_WATCHER.ey) <= TALK_RANGE);
        expect(inside.length).toBeGreaterThan(5);
    });
});

describe('fidelity WATCHER — the `talk` verb', () => {
    it('the table names `talk` for `proximity-hazard:watcher`, the executor is registered and derived', () => {
        expect(OBSTACLE_STRATEGIES['proximity-hazard:watcher']).toBe('talk');
        expect(typeof STRATEGY_EXECUTORS.talk).toBe('function');
        expect(R8_STRATEGY_EXECUTORS.executorDerivations.talk.length).toBeGreaterThan(0);
        expect(KNOWN_STRATEGY_VERBS).toContain('talk');
    });

    const t = tape('watcher-l114-talk');
    const goal = { kind: 'reach-exit', exit: { x: 64, y: 144 } };
    it('`watcher-l114-talk`: the solver pages the whole dialogue, earns {114,0} and crosses into L113', () => {
        const run = createRunForStaging({ ...t, equips: [] }, SRC);
        expect(run.world.proximityHazards.map((h) => h.tag)).toEqual(['watcher']);
        const out = solveSegment({ run, goals: [goal], name: 'watcher-l114-talk-resolve', boot: t.boot });
        expect(run.level).toBe(113);
        expect(out.perTick.length).toBe(t.tick_count);
        const [rec] = out.records.filter((r) => r.strategy === 'talk');
        expect(rec).toMatchObject({ verb: 'talk', target: L114_WATCHER.id, cause: 'done', stance: null });
        expect(rec.pages).toBeGreaterThan(1);
        expect(run.watcherTalks).toEqual([expect.objectContaining({ id: L114_WATCHER.id, cause: 'done' })]);
        expect(run.watcherFlags).toEqual([expect.objectContaining({ level: 114, tag: 0, value: false })]);
        const summary = summarizeTrace(out.trace);
        expect(summary.unknownStrategyVerbs).toEqual([]);
    });

    it('the committed tape IS the plan, and every page is a press-then-release of X', () => {
        const run = createRunForStaging({ ...t, equips: [] }, SRC);
        const out = solveSegment({ run, goals: [goal], name: 'watcher-l114-talk-resolve', boot: t.boot });
        const keysAt = (i) => [...out.perTick[i]].sort().join('+');
        const tapeKeysAt = (i) => t.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)
            .sort().join('+');
        for (let i = 0; i < t.tick_count; i += 1) expect(tapeKeysAt(i), `t${i}`).toBe(keysAt(i));
        const presses = t.inputs.filter((sp) => sp.key === 'primary');
        expect(presses.every((sp) => sp.to - sp.from === 1)).toBe(true);
    });

    it('CONTROL: the same boot with {114,0} cleared is no obstacle at all — no `talk` row runs', () => {
        const run = createRunForStaging({ ...t, equips: [],
            persistence: [...t.persistence, { level: 114, tag: 0, note: 'control' }] }, SRC);
        const out = solveSegment({ run, goals: [goal], name: 'watcher-l114-talk-control', boot: t.boot });
        expect(run.level).toBe(113);
        expect(out.records.filter((r) => r.strategy === 'talk')).toEqual([]);
        expect(out.perTick.length).toBeLessThan(t.tick_count);
    });

    it('THE GAME agrees: the walk freezes inside the circle for the dialogue and leaves to L113', () => {
        const game = expectation('watcher-l114-talk');
        const model = runTape(t, { levelSource: SRC });
        expect(game.ticks).toHaveLength(model.ticks.length);
        expect(game.transitions).toEqual([{ t: t.tick_count, from_level: 114, to_level: 113 }]);
        // The longest run of identical positions is the dialogue's freeze.
        let best = 0;
        let run = 0;
        for (let i = 1; i < game.ticks.length; i += 1) {
            const same = game.ticks[i].x === game.ticks[i - 1].x && game.ticks[i].y === game.ticks[i - 1].y;
            run = same ? run + 1 : 0;
            best = Math.max(best, run);
        }
        expect(best).toBeGreaterThan(300);
    });
});
