import { describe, it, expect } from 'vitest';
import {
    windowsFrom, boundaryFindings, streamBoundaryFindings, traceFindings, traceTicks,
    assertWindowEndsAtRest, continuationFindings, DirectorError,
    boundaryFlagClearanceFindings, LOCK_FLAG_WRITE_TICKS,
    crutchScheduleFindings, CRUTCH_JUSTIFICATION,
    PAGE_CHAINS, parseTapesParam, formatTapesParam, expandSequence, sequenceAdmission,
    continuationAdmission, refusalsOnly, jsLiveEnvelope,
    PAGE_CHAIN_META, CAMPAIGN_REQUIREMENTS, campaignChoice,
} from './director.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTape } from './fixtures/index.js';
import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The director's own stratum: pure functions over the GAME's reports, with
 * every input mutated in turn and the corresponding check asserted red.
 *
 * ⚠ THIS SHARES ITS GENERATOR'S ASSUMPTIONS AND SAYS SO. The statuses below
 * are hand-built, so this file can only prove that the checks fire on the
 * shapes it imagines — it cannot prove the shapes are the ones the game
 * produces. The independent stratum is `run-seedling-director.mjs --bridge`,
 * whose expectations are six recordings made before the director existed
 * (R4's §14 lesson, applied to this rung's first new machinery).
 */

const status = (over = {}) => ({
    level: 59,
    x: 296.5,
    y: 136.5,
    items: {
        hasSword: true, hasDarkSword: false, hasGhostSword: false, hasShield: false,
        hasDarkShield: false, hasFire: false, hasWand: false, hasFireWand: false,
        canSwim: false, hasFeather: true, hasSpear: true, hasDarkSuit: false,
        hasTorch: true, hitsMax: 3,
    },
    grants: [],
    persistence_cleared: [{ level: 12, tag: 0 }, { level: 30, tag: 0 }],
    dead_frames: 87,
    ...over,
});

const stream = (over = {}) => ({
    ticks: [{ t: 0, level: 59, x: 296.5, y: 136.5 }],
    transitions: [],
    ...over,
});

const tape = (name, over = {}) => ({
    tape_version: 4, game: 'seedling', name,
    boot: { level: 0, x: 80, y: 128 },
    noclip: false, noDamage: true, noHazards: ['water', 'waterfall'],
    grants: [], persistence: [], equips: [], tick_count: 10, inputs: [],
    ...over,
});

describe('windowsFrom: the two things a window after the first may not declare', () => {
    it('leaves the FIRST window exactly as authored', () => {
        const first = tape('w0', {
            grants: [{ level: 0, items: ['sword'] }],
            persistence: [{ level: 12, tag: 0, note: 'x' }],
        });
        const out = windowsFrom([first, tape('w1')]);
        expect(out[0]).toBe(first);
    });

    it('REFUSES a later window that declares persistence clears, by name', () => {
        // The load-bearing one: `botStart` resets EVERY tag in EVERY level to
        // true before applying a declared list, so this would erase what the
        // earlier windows earned rather than adding to it.
        expect(() => windowsFrom([
            tape('w0'),
            tape('w1', { persistence: [{ level: 12, tag: 0, note: 'x' }] }),
        ])).toThrow(/window 1 \("w1"\) declares 1 persistence clear/);
        expect(() => windowsFrom([tape('w0'), tape('w1', { persistence: [] })]))
            .not.toThrow();
    });

    it('REFUSES a later window that declares grants, by name', () => {
        expect(() => windowsFrom([
            tape('w0'),
            tape('w1', { grants: [{ level: 0, items: ['sword'] }] }),
        ])).toThrow(/window 1 \("w1"\) declares 1 grant/);
    });

    it('strips instead of refusing ONLY when the caller says it is authoring', () => {
        const out = windowsFrom([
            tape('w0'),
            tape('w1', {
                grants: [{ level: 0, items: ['sword'] }],
                persistence: [{ level: 12, tag: 0, note: 'x' }],
            }),
        ], { strip: true });
        expect(out[1].grants).toEqual([]);
        expect(out[1].persistence).toEqual([]);
        // ...and it does not mutate the caller's tape.
        expect(out[1]).not.toBe(out[0]);
    });

    it('refuses an empty list rather than returning one', () => {
        expect(() => windowsFrom([])).toThrow(DirectorError);
    });
});

describe('boundaryFindings: both sides are the GAME, one instant apart', () => {
    it('finds nothing when the boundary held', () => {
        expect(boundaryFindings(status(), status(), stream())).toEqual([]);
    });

    it('catches a RE-BOOT, which is what a bad boundary looks like', () => {
        // `botStart` re-boots when the tape's boot block does not name the
        // current world's construction args — and then the window chain is N
        // unrelated walks rather than one.
        const f = boundaryFindings(status(), status({ x: 88, y: 136 }), stream());
        expect(f).toHaveLength(1);
        expect(f[0].detail).toMatch(/botStart RE-BOOTED/);
    });

    it('catches a level change across the boundary', () => {
        const f = boundaryFindings(status(), status({ level: 60 }), stream());
        expect(f.map((x) => x.what)).toContain('the level changed across the boundary');
    });

    it('catches the drained STREAM disagreeing with the status beside it', () => {
        const f = boundaryFindings(
            status(), status(), stream({ ticks: [{ t: 0, level: 59, x: 1, y: 2 }] }),
        );
        expect(f.map((x) => x.what))
            .toContain('the drained stream disagrees with the status it was drained beside');
    });

    it('catches an item LOST across a boundary', () => {
        const before = status();
        const after = status({ items: { ...before.items, hasTorch: false } });
        const f = boundaryFindings(before, after, stream());
        expect(f.map((x) => x.what)).toContain('the item set changed across the boundary');
    });

    it('catches an item GAINED across a boundary — a grant nobody declared', () => {
        const before = status();
        const after = status({ items: { ...before.items, hasWand: true } });
        const f = boundaryFindings(before, after, stream());
        expect(f.map((x) => x.what)).toContain('the item set changed across the boundary');
    });

    it('checks hitsMax ON ITS OWN, because health has no boolean', () => {
        // R4's rule: folded into the item set, a run that lost `hasSword` and
        // gained health would be green. `hitsMax` is an int and `health` ADDS.
        const before = status();
        const after = status({ items: { ...before.items, hitsMax: 4 } });
        const f = boundaryFindings(before, after, stream());
        expect(f).toHaveLength(1);
        expect(f[0].what).toBe('hitsMax changed across the boundary');
    });

    it('catches cleared flags COMING BACK — the reset-everything backstop', () => {
        const before = status();
        const after = status({ persistence_cleared: [{ level: 12, tag: 0 }] });
        const f = boundaryFindings(before, after, stream());
        expect(f).toHaveLength(1);
        expect(f[0].detail).toMatch(/reset every tag in every level/);
        // ...and a flag ADDED is fine: the ledger is monotone, not frozen.
        expect(boundaryFindings(before, status({
            persistence_cleared: [...before.persistence_cleared, { level: 59, tag: 3 }],
        }), stream())).toEqual([]);
    });

    it('catches a window that fired a grant', () => {
        const f = boundaryFindings(
            status(), status({ grants: [{ t: 0, level: 59, items: ['sword'] }] }), stream(),
        );
        expect(f.map((x) => x.what)).toContain('the window fired grants');
    });

    it('refuses to pass when a status is MISSING rather than reading undefined', () => {
        expect(boundaryFindings(null, status(), stream())).toHaveLength(1);
        expect(boundaryFindings(status(), undefined, stream())).toHaveLength(1);
    });
});

describe('traceFindings: the partition claim', () => {
    // ⚠ `dead_frames: 0` on the terminal status is not decoration — it is
    // the CONTINUATION assert's input, and a window that paid a fade
    // without leaving its room is a re-boot. See the block below.
    const win = (label, over = {}) => ({
        label, stream: stream(), status: status({ dead_frames: 0 }),
        boundary_before: status(), boundary_after_start: status(), ...over,
    });

    it('holds for a clean three-window trace', () => {
        expect(traceFindings([win('a'), win('b'), win('c')])).toEqual([]);
    });

    it('reports a trace with no windows rather than passing vacuously', () => {
        expect(traceFindings([])).toHaveLength(1);
        expect(traceFindings(null)).toHaveLength(1);
    });

    it('names the window a broken boundary belongs to', () => {
        // ⚠ `boundary_after_start`, not `status`: the boundary is the instant
        // between two windows, and a window's END state is a different
        // question (it is where the walk got to, which is the point).
        const bad = win('c', { boundary_after_start: status({ level: 60 }) });
        const f = traceFindings([win('a'), win('b'), bad]);
        expect(f).toHaveLength(1);
        expect(f[0].where).toBe('boundary 1 → 2 (c)');
    });

    it('counts live ticks as stream length MINUS ONE, per RECORD-THEN-ACT', () => {
        // An N-tick tape yields N+1 observations, so three windows of one
        // observation each are three windows of ZERO live ticks.
        expect(traceTicks([win('a'), win('b')])).toBe(0);
        expect(traceTicks([win('a', {
            stream: { ticks: new Array(642).fill({ t: 0 }), transitions: [] },
        })])).toBe(641);
        expect(traceTicks([])).toBe(0);
    });
});

describe('streamBoundaryFindings: the comparison that can be believed', () => {
    // The status pair is sampled the instant `botStart` returns, and a
    // re-boot's `FP.world = new Game(...)` only records a `_goto` — the swap
    // lands at END OF TICK. So the status still shows the old world's player.
    // An OBSERVATION is recorded by the bot's hook at the top of a live
    // frame and is never mid-swap.
    const s = (t, x, y, level = 0) => ({ ticks: [{ t, x, y, level }], transitions: [] });

    it('holds when the last observation and the first agree', () => {
        expect(streamBoundaryFindings(s(9, 264, 264), s(0, 264, 264))).toEqual([]);
    });

    it('names the field that is not continuous', () => {
        const f = streamBoundaryFindings(s(9, 264, 264), s(0, 263.2, 264));
        expect(f).toHaveLength(1);
        expect(f[0].what).toBe('x is not continuous across the boundary');
        expect(f[0].detail).toBe('264 → 263.2');
    });

    it('catches a level discontinuity', () => {
        expect(streamBoundaryFindings(s(9, 264, 264, 0), s(0, 264, 264, 12))
            .map((x) => x.what)).toContain('level is not continuous across the boundary');
    });

    it('refuses an empty stream rather than passing vacuously', () => {
        expect(streamBoundaryFindings({ ticks: [] }, s(0, 1, 1))).toHaveLength(1);
        expect(streamBoundaryFindings(null, s(0, 1, 1))).toHaveLength(1);
    });
});

describe('assertWindowEndsAtRest: the authoring rule the R4 bridge discovered', () => {
    const t = (inputs, tick_count = 100) => ({ tick_count, inputs });

    it('finds nothing when every span closes with room to coast', () => {
        expect(assertWindowEndsAtRest(t([{ key: 'up', from: 10, to: 80 }]))).toEqual([]);
    });

    it('names a span that runs to tick_count — the key is still HELD', () => {
        // `r4-walk-1-sword` really is `{up 591..641}` with `tick_count` 641,
        // and the release edge fires at `to`, which the tick loop never
        // reaches. Every fixture before R5 got a fresh page, which released
        // the keys implicitly; a window does not, and the player walks off
        // the boundary while the game keeps ticking.
        const f = assertWindowEndsAtRest(t([{ key: 'up', from: 591, to: 641 }], 641));
        expect(f).toHaveLength(1);
        expect(f[0]).toMatch(/runs to tick_count \(641\).*still HELD/);
    });

    it('names a span that closes too late to coast to a stop', () => {
        const f = assertWindowEndsAtRest(t([{ key: 'primary', from: 90, to: 99 }]));
        expect(f).toHaveLength(1);
        expect(f[0]).toMatch(/releases only 1 tick\(s\) before the end/);
    });

    it('takes the coast length from the caller, since it is a physics number', () => {
        expect(assertWindowEndsAtRest(t([{ key: 'up', from: 10, to: 95 }], 100),
            { coast: 3 })).toEqual([]);
        expect(assertWindowEndsAtRest(t([{ key: 'up', from: 10, to: 95 }], 100),
            { coast: 20 })).toHaveLength(1);
    });
});

describe('continuationFindings: the assert a re-boot ERASES its own evidence from', () => {
    // ⛔ The shape: when a window's boot block does not match the current
    // world, `botStart` rebuilds it — and the next stream then starts
    // exactly on the declared boot position, so every position check comes
    // back clean. The R4 bridge's five held-key boundaries are all of them:
    // silent `streamBoundaryFindings`, byte-identical streams, and a
    // continuation nobody made. Dead frames are what the re-boot cannot
    // hide, because a room fade is ~19 frames the tape never asked for.
    const win = (over = {}) => ({
        label: 'w', stream: stream(), status: status({ dead_frames: 0 }), ...over,
    });

    it('holds for a window that stayed in one room and paid no fade', () => {
        expect(continuationFindings(win(), { index: 1 })).toEqual([]);
    });

    it('NAMES a continuation window that paid dead frames', () => {
        const f = continuationFindings(win({ status: status({ dead_frames: 19 }) }),
            { index: 1 });
        expect(f).toHaveLength(1);
        expect(f[0].what).toMatch(/CONTINUATION window paid dead frames/);
        expect(f[0].detail).toMatch(/ERASES the drift/);
    });

    it('is UNASSERTED, not passing, when the window crosses a door', () => {
        // A window that crosses pays a fade for the crossing, and separating
        // that from botStart's is a per-load constant this module has no
        // business owning. An unasserted check and a passing one must not
        // print the same thing.
        const crossed = win({
            status: status({ dead_frames: 19 }),
            stream: {
                ticks: [{ t: 0, level: 59, x: 1, y: 1 }, { t: 1, level: 60, x: 1, y: 1 }],
                transitions: [],
            },
        });
        const f = continuationFindings(crossed, { index: 1 });
        expect(f).toHaveLength(1);
        expect(f[0].informational).toBe(true);
        expect(f[0].what).toMatch(/unasserted — the window crosses a door/);
    });

    it('is UNASSERTED for a window that declares a re-boot', () => {
        const f = continuationFindings(win({ status: status({ dead_frames: 19 }) }),
            { index: 0, reBootExpected: true });
        expect(f[0].informational).toBe(true);
        expect(f[0].what).toMatch(/declares a re-boot/);
    });

    it('a MISSING dead_frames is a finding, not a pass', () => {
        // The build without the readout would otherwise make the whole
        // assert vacuous by comparing undefined to zero.
        const f = continuationFindings(win({ status: status({ dead_frames: undefined }) }),
            { index: 1 });
        expect(f).toHaveLength(1);
        expect(f[0].informational).toBeUndefined();
        expect(f[0].what).toMatch(/no dead_frames/);
    });

    it('traceFindings folds it in, and window 0 is exempt', () => {
        // Window 0's fade is the boot's own. Windows 1+ are continuations.
        const w = (over = {}) => ({
            label: 'w', stream: stream(), status: status({ dead_frames: 0 }),
            boundary_before: status(), boundary_after_start: status(), ...over,
        });
        expect(traceFindings([w({ status: status({ dead_frames: 300 }) }), w()]))
            .toEqual([]);
        const f = traceFindings([w(), w({ status: status({ dead_frames: 19 }) })]);
        expect(f).toHaveLength(1);
        expect(f[0].what).toMatch(/CONTINUATION window paid dead frames/);
    });
});

describe('boundaryFlagClearanceFindings: a boundary may not sit inside a fade', () => {
    /** A window whose drained stream has `n` observations, i.e. n-1 ticks. */
    const win = (n, label = 'w') => ({
        label,
        stream: { ticks: Array.from({ length: n }, (_, t) => ({ t, level: 60, x: 1, y: 1 })) },
    });

    it('is silent when the write clears the boundary by the fade', () => {
        // 301 observations => last tick 300; a write at 200 leaves exactly
        // the 100 the alpha decay costs.
        expect(boundaryFlagClearanceFindings(
            [win(301)], [{ window: 0, tick: 200, what: 'lock@128,80' }],
        )).toEqual([]);
    });

    it('fires ONE TICK short — the boundary is the fencepost this exists for', () => {
        const f = boundaryFlagClearanceFindings(
            [win(300)], [{ window: 0, tick: 200, what: 'lock@128,80' }],
        );
        expect(f).toHaveLength(1);
        expect(f[0].what).toMatch(/inside a flag write/);
        // The detail carries both numbers, because "too close" without them
        // sends the reader back to the plan to work out by how much.
        expect(f[0].detail).toMatch(/latches at tick 200/);
        expect(f[0].detail).toMatch(/99 tick\(s\) of margin/);
    });

    it('takes a per-event clearance — a BossLock is 80, not 100', () => {
        // `keyTimer` 60 + twenty `alpha -= 0.05`, `activators.opensOnKeyTick`.
        const events = [{ window: 0, tick: 200, what: 'bosslock@224,208', clearance: 80 }];
        expect(boundaryFlagClearanceFindings([win(281)], events)).toEqual([]);
        expect(boundaryFlagClearanceFindings([win(280)], events)).toHaveLength(1);
    });

    it('a window with no drained stream is a FINDING, not a pass', () => {
        // Otherwise a trace that failed to drain a window would report every
        // one of its boundaries as clear.
        const f = boundaryFlagClearanceFindings(
            [{ label: 'w', stream: { ticks: [] } }], [{ window: 0, tick: 0, what: 'x' }],
        );
        expect(f).toHaveLength(1);
        expect(f[0].what).toMatch(/no drained stream/);
    });

    it('an event naming a window that does not exist THROWS', () => {
        // A silently ignored event is a clearance check that ran on nothing.
        expect(() => boundaryFlagClearanceFindings([win(10)], [{ window: 3, tick: 0, what: 'x' }]))
            .toThrow(DirectorError);
        expect(() => boundaryFlagClearanceFindings([win(10)], [{ tick: 0, what: 'x' }]))
            .toThrow(/not one of the 1 windows/);
    });

    it('no events is vacuous and says so by being empty, not by passing', () => {
        expect(boundaryFlagClearanceFindings([win(10)], [])).toEqual([]);
        expect(boundaryFlagClearanceFindings([win(10)], undefined)).toEqual([]);
    });

    it('the default clearance is the Lock alpha fade', () => {
        expect(LOCK_FLAG_WRITE_TICKS).toBe(100);
    });
});

describe('⛓ the CRUTCH SCHEDULE — a coercion may not outlive its justification', () => {
    const win = (label, noHazards, items) => ({
        label,
        tape: { noHazards },
        boundary_after_start: { items },
    });
    const NOTHING = { canSwim: false, hasFeather: false, hasDarkSuit: false };
    const CONCH = { ...NOTHING, canSwim: true };
    const BOTH = { canSwim: true, hasFeather: true, hasDarkSuit: false };
    const failing = (fs) => fs.filter((f) => !f.ok).map((f) => f.name);

    it('⛓ THE FIRST FLIP: water retired, and `canSwim` is NAMED as the reason', () => {
        // R5 slice 4 step 4's own boundary. The passing finding is the
        // point — this check exists to PRINT the justification, not merely
        // to stay quiet about it.
        const fs = crutchScheduleFindings([
            win('d5', ['water', 'waterfall'], NOTHING),
            win('swim', ['waterfall'], CONCH),
        ]);
        expect(failing(fs)).toEqual([]);
        const retire = fs.find((f) => f.name.includes('"water" retired'));
        expect(retire).toBeDefined();
        expect(retire.name).toContain('canSwim');
        expect(retire.ok).toBe(true);
    });

    it('⛔ RED when a hazard is armed WITHOUT the item that survives it', () => {
        const fs = crutchScheduleFindings([
            win('d5', ['water', 'waterfall'], NOTHING),
            win('swim', ['waterfall'], NOTHING),
        ]);
        expect(failing(fs)).toContain('boundary 0 (d5) → 1 (swim): "water" retired, '
            + 'justified by `canSwim`');
        expect(fs.find((f) => !f.ok).detail).toContain('die()');
    });

    it('⛔ RED when a coercion OUTLIVES its justification', () => {
        // The rule that makes this a schedule. A window still coercing
        // water while the game already holds the conch is a ladder that has
        // stopped descending and is still reporting green.
        const fs = crutchScheduleFindings([
            win('d5', ['water', 'waterfall'], NOTHING),
            win('next', ['water', 'waterfall'], CONCH),
        ]);
        expect(failing(fs)).toContain('boundary 0 (d5) → 1 (next): "water" is still coerced');
    });

    it('⛔ RED when a coercion comes BACK', () => {
        const fs = crutchScheduleFindings([
            win('swim', ['waterfall'], CONCH),
            win('back', ['water', 'waterfall'], CONCH),
        ]);
        expect(failing(fs)).toContain('boundary 0 (swim) → 1 (back): no coercion came BACK');
    });

    it('the WHOLE schedule: two flips, three windows, every step justified', () => {
        const fs = crutchScheduleFindings([
            win('d5', ['water', 'waterfall'], NOTHING),
            win('swim', ['waterfall'], CONCH),
            win('feather', [], BOTH),
        ]);
        expect(failing(fs)).toEqual([]);
        expect(fs.filter((f) => f.name.includes('retired')).map((f) => f.name)).toEqual([
            'boundary 0 (d5) → 1 (swim): "water" retired, justified by `canSwim`',
            'boundary 1 (swim) → 2 (feather): "waterfall" retired, justified by `hasFeather`',
        ]);
    });

    it('⛔ a boundary with NO live item readout cannot answer, so it FAILS', () => {
        // `feedback_graceful_fallback_vacuous_replay`: a schedule judged
        // against the tape's own grants would be the plan agreeing with
        // itself, and a check that cannot answer must not pass.
        const fs = crutchScheduleFindings([
            win('d5', ['water', 'waterfall'], NOTHING),
            { label: 'swim', tape: { noHazards: ['waterfall'] } },
        ]);
        expect(failing(fs)).toContain('boundary 0 (d5) → 1 (swim): the schedule has a live '
            + 'item readout to judge against');
    });

    it('⚠ ice and pit are justified by NOTHING, which is a statement not a gap', () => {
        // Both are `null` in the table: ice is not lethal and has been armed
        // since R4, and no item in the game makes standing on a pit
        // survivable. Coercing either after R4 is a finding with no way to
        // satisfy it, and that is the right answer.
        expect(CRUTCH_JUSTIFICATION.ice).toBeNull();
        expect(CRUTCH_JUSTIFICATION.pit).toBeNull();
        const fs = crutchScheduleFindings([
            win('a', ['ice'], BOTH),
            win('b', [], BOTH),
        ]);
        expect(failing(fs)).toContain('boundary 0 (a) → 1 (b): "ice" retired, justified by '
            + '`nothing in the game`');
    });

    it('refuses a caller that passes nothing', () => {
        expect(() => crutchScheduleFindings([])).toThrow(DirectorError);
    });

    it('a single window has no boundary, so it makes no claim', () => {
        expect(crutchScheduleFindings([win('only', ['water'], NOTHING)])).toEqual([]);
    });
});

/**
 * ══ ⛓⛓⛓ R9 SLICE 2 — THE SEQUENCE THE PAGE ASKS FOR ═════════════════════
 *
 * ⚖ Ruling 10's admission rule, one row per refusal. The chain table is
 * asserted ACROSS the boundary it cannot be imported across — `director.js`
 * has no imports at all so that `watch.html` can load it, and this file runs
 * in node where `PLAYTHROUGH_CHAINS` is reachable.
 */
describe('⛓⛓⛓ the page-side chain table is CHECKED against PLAYTHROUGH_CHAINS', () => {
    it('has exactly the chains the roster has, with their own segment lists', async () => {
        const { PLAYTHROUGH_CHAINS } = await import('./playthroughWalk.js');
        const fromRoster = Object.fromEntries(
            PLAYTHROUGH_CHAINS.map((c) => [c.id, [...c.segments]]),
        );
        const fromPage = Object.fromEntries(
            Object.entries(PAGE_CHAINS).map(([k, v]) => [k, [...v]]),
        );
        expect(fromPage).toEqual(fromRoster);
    });

    it('⛓ and the headline subject is the two segments the slice claims', () => {
        // ⛓ R9 slice 3: THREE segments — `r8-solve-18` promoted in front.
        expect(PAGE_CHAINS['r8-d2']).toEqual(['r8-solve-18', 'r8-d2-19', 'r8-d2-20']);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 11b — **AND THE PAGE COPY CARRIES NO TICK AT ALL**
     * (⚖ ruling 32 D). `cuts`, `endsAt` and a clear's `at` are now derived from
     * the tapes on the node side; the browser cannot read tapes, so the
     * temptation is to mirror the NUMBERS here — and a mirrored number is the
     * exact constant trap 556 is about, one boundary further from the thing
     * that would move it. The page table holds NAMES only, and this row is what
     * says so. What the page needs about ticks it asks the tape it is playing.
     */
    it('⛔⛔ holds NAMES only — no cut, endsAt or clear tick is mirrored here', async () => {
        const src = readFileSync(new URL('./director.js', import.meta.url), 'utf8');
        const tables = src.slice(
            src.indexOf('export const PAGE_CHAINS'),
            src.indexOf('export const CAMPAIGN_REQUIREMENTS'),
        );
        expect(tables.length).toBeGreaterThan(1000);
        expect(tables).not.toMatch(/\b(cuts|endsAt|removedAt|measuredAt|carriesAt)\b/);
        // non-vacuity: the same slice DOES contain the names it is meant to
        expect(tables).toMatch(/'r8-solve-18'/);
    });

    it('⛓ every page-side chain id has DERIVED ticks on the node side', async () => {
        const { PLAYTHROUGH_CHAINS } = await import('./playthroughWalk.js');
        const byId = new Map(PLAYTHROUGH_CHAINS.map((c) => [c.id, c]));
        for (const id of Object.keys(PAGE_CHAINS)) {
            const c = byId.get(id);
            expect(Number.isFinite(c.endsAt)).toBe(true);
            expect(c.cuts.length).toBe(c.segments.length - 1);
            // the spans a page-side sequence would be sliced by are contiguous
            // and end exactly where the chain does
            const bounds = [0, ...c.cuts, c.endsAt];
            for (let i = 1; i < bounds.length; i += 1) {
                expect(bounds[i]).toBeGreaterThan(bounds[i - 1]);
            }
        }
    });
});

/**
 * ══ ⛓⛓⛓ R9 SLICE 10 — THE METADATA TABLE IS DERIVED FROM DISK ═══════════
 *
 * ⚖ Ruling 19 asks the ▶ campaign control for a chain nobody typed, so this is
 * where "which chain" is actually computed. Every field of `PAGE_CHAIN_META` is
 * recomputed here from three sources the browser cannot reach —
 * `PLAYTHROUGH_CHAINS` (via `chainKind`), the committed tapes, and the
 * decision-trace sidecars — and compared WHOLE. ⛔ Not field by field with a
 * loop that could skip: `toEqual` over the whole object, so a chain present in
 * one table and absent from the other is a failure rather than a silence.
 */
const TRACE_OF = (name) => join(HERE, 'fixtures', 'traces', `${name}.trace.json`);
const TAPE_OF = (name) => JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

/**
 * ⛓ WHAT "A FRESH GAME START" IS, AS THE GAME DEFINES IT SINCE ⚖ RULING 25.
 *
 * R9 slice 9b made the fork's boot reset UNCONDITIONAL: a tape that declares
 * nothing boots FRESH instead of inheriting whatever the page was holding. So
 * "declares nothing carried" IS "starts where a new game does", and this
 * predicate says that rather than naming a coordinate — `{0, 80, 128}` is
 * where L0 happens to put the player and would be a claim about one room.
 */
const declaresNothingCarried = (tape) => !tape.seam
    && (tape.persistence ?? []).length === 0
    && (tape.grants ?? []).length === 0
    && (tape.despawn ?? []).length === 0;

describe('⛓⛓⛓ the page-side chain METADATA is CHECKED against disk (slice 10)', () => {
    it('kind, trueStart and solverRecorded are all recomputed, whole', async () => {
        const { PLAYTHROUGH_CHAINS, chainKind } = await import('./playthroughWalk.js');
        const fromDisk = Object.fromEntries(PLAYTHROUGH_CHAINS.map((c) => [c.id, {
            kind: chainKind(c),
            trueStart: declaresNothingCarried(TAPE_OF(c.segments[0])),
            solverRecorded: c.segments.every((n) => existsSync(TRACE_OF(n))),
        }]));
        expect(Object.fromEntries(
            Object.entries(PAGE_CHAIN_META).map(([k, v]) => [k, { ...v }]),
        )).toEqual(fromDisk);
    });

    /**
     * ⛔⛔ THE PARTITION THE CONTROL RESTS ON, MEASURED OVER THE DOMAIN IT IS
     * APPLIED TO — and it is clean there.
     *
     * ⚠ IT IS NOT CLEAN ROSTER-WIDE, and slice 10 measured the exception rather
     * than assuming it away: `diagonal-run` is a HAND physics micro-fixture
     * ("Hold RIGHT+UP for 30 ticks") that carries a `.trace.json` because it is
     * `decisionTrace.test.js`'s own FORMAT fixture — no producer under
     * `scripts/procgen/` writes it. So "has a sidecar" admits exactly one tape
     * the solver did not record, and that tape is in no chain. ⇒ the predicate
     * is asserted over the domain the control applies it to (chain segments),
     * in BOTH directions, and the out-of-domain exception is named.
     */
    it('⛔ over CHAIN SEGMENTS the sidecar partitions solver tapes exactly', async () => {
        const { PLAYTHROUGH_CHAINS } = await import('./playthroughWalk.js');
        const solverNamed = (n) => /^r[89]-(solve|d2)/.test(n);
        const rows = PLAYTHROUGH_CHAINS.flatMap((c) => c.segments.map((n) => ({
            n, traced: existsSync(TRACE_OF(n)), solver: solverNamed(n),
        })));
        // ⛔ Both directions: a solver segment with no trace and a hand segment
        // with one are DIFFERENT defects, and neither may pass as the other.
        expect(rows.filter((r) => r.solver && !r.traced).map((r) => r.n)).toEqual([]);
        expect(rows.filter((r) => !r.solver && r.traced).map((r) => r.n)).toEqual([]);
        // …and BOTH sides of the partition are non-empty, which is what makes
        // the two rows above claims rather than vacuities (trap 475).
        expect(rows.some((r) => r.traced)).toBe(true);
        expect(rows.some((r) => !r.traced)).toBe(true);
    });

    it('⚠ the ONE roster-wide exception is `diagonal-run`, and it is in no chain', async () => {
        const { PLAYTHROUGH_CHAINS } = await import('./playthroughWalk.js');
        // ⛔ SEGMENTS **AND HEADLINES**. `r8-d2` is a chain's headline tape —
        // the same walk driven in ONE run — and the solver records it exactly
        // as it records a segment, so a set built from segments alone would
        // report it as an exception it is not.
        const inAChain = new Set(PLAYTHROUGH_CHAINS
            .flatMap((c) => [...c.segments, c.headline]));
        const traced = readdirSync(join(HERE, 'fixtures', 'traces'))
            .filter((f) => f.endsWith('.trace.json'))
            .map((f) => f.replace(/\.trace\.json$/, ''));
        // ⛔ A PIN, not a filter: the day a SECOND untraceable-by-a-producer
        // sidecar appears this row reds and somebody reads why, instead of the
        // control quietly widening.
        expect(traced.filter((n) => !inAChain.has(n))).toEqual(['diagonal-run']);
    });
});

describe('⛓⛓⛓ campaignChoice — the ▶ campaign control picks by RULE (slice 10)', () => {
    it('picks the one chain that satisfies all three requirements', () => {
        const c = campaignChoice();
        expect(c.refusal).toBeNull();
        expect(c.segments).toEqual([...PAGE_CHAINS[c.id]]);
        // ⛔ THE NAME APPEARS HERE AND NOWHERE IN THE CONTROL. A roster that
        // grows a different campaign fails in this row, where a human reads the
        // reason, rather than in a page that silently plays something else.
        expect(c.id).toBe('r9-campaign');
        expect(c.why).toMatch(/custody \+ true-start \+ solver-recorded/);
    });

    /**
     * ⛓⛓⛓ THE MEASUREMENT THAT MAKES ⚖ RULING 19's SECOND HALF LOAD-BEARING.
     *
     * `toy-west-pair` is ALSO a custody chain and its first segment ALSO
     * declares nothing — `r7-ends-meet-1` and `r8-solve-1` have byte-identical
     * boot blocks. So the true-start axis separates nothing among custody
     * chains today, and "only tapes generated by the solver" is what leaves one
     * answer standing. Without it the control would face a REAL tie, not a
     * hypothetical one — and it refuses rather than picking the first.
     */
    it('⛔ the solver rule breaks a REAL tie — both custody chains are true starts', () => {
        expect(PAGE_CHAIN_META['toy-west-pair'])
            .toEqual({ kind: 'custody', trueStart: true, solverRecorded: false });
        expect(TAPE_OF('r7-ends-meet-1').boot).toEqual(TAPE_OF('r8-solve-1').boot);
        const both = {
            ...PAGE_CHAIN_META,
            'toy-west-pair': { kind: 'custody', trueStart: true, solverRecorded: true },
        };
        const tie = campaignChoice({ meta: both });
        expect(tie.id).toBeNull();
        expect(tie.refusal.reason).toMatch(/more than one campaign/);
        expect(tie.refusal.detail).toMatch(/toy-west-pair/);
        expect(tie.refusal.detail).toMatch(/r9-campaign/);
    });

    it('⛔ a STAGED chain is not picked, however solver-recorded it is', () => {
        const staged = Object.fromEntries(Object.entries(PAGE_CHAIN_META)
            .map(([k, v]) => [k, k === 'r9-campaign' ? { ...v, kind: 'staged' } : v]));
        const c = campaignChoice({ meta: staged });
        expect(c.id).toBeNull();
        expect(c.refusal.reason).toMatch(/no chain plays from a fresh game start/);
        expect(c.rejected.find((r) => r.id === 'r9-campaign').failed).toBe('custody');
    });

    it('⛔ a chain with ONE hand tape in it is refused BY NAME, not silently dropped', () => {
        const handed = Object.fromEntries(Object.entries(PAGE_CHAIN_META)
            .map(([k, v]) => [k, k === 'r9-campaign' ? { ...v, solverRecorded: false } : v]));
        const c = campaignChoice({ meta: handed });
        expect(c.id).toBeNull();
        const row = c.rejected.find((r) => r.id === 'r9-campaign');
        expect(row.failed).toBe('solver-recorded');
        expect(row.why).toMatch(/not recorded by the solver/);
        expect(c.refusal.detail).toMatch(/r9-campaign: .*not recorded by the solver/);
    });

    it('⛔ a chain whose first segment carries a state is not a fresh start', () => {
        const mid = Object.fromEntries(Object.entries(PAGE_CHAIN_META)
            .map(([k, v]) => [k, k === 'r9-campaign' ? { ...v, trueStart: false } : v]));
        const c = campaignChoice({ meta: mid });
        expect(c.id).toBeNull();
        expect(c.rejected.find((r) => r.id === 'r9-campaign').failed).toBe('true-start');
    });

    it('a chain in the table with no metadata row is NAMED, not skipped', () => {
        const { 'r9-campaign': _drop, ...missing } = PAGE_CHAIN_META;
        const c = campaignChoice({ meta: missing });
        expect(c.id).toBeNull();
        expect(c.rejected.find((r) => r.id === 'r9-campaign').failed).toBe('meta');
    });

    it('every requirement carries its own WHY and its own refusal sentence', () => {
        for (const r of CAMPAIGN_REQUIREMENTS) {
            expect(r.why.length).toBeGreaterThan(20);
            expect(typeof r.failed({ kind: 'staged', trueStart: false, solverRecorded: false }))
                .toBe('string');
        }
    });
});

describe('the ?tapes= codec', () => {
    it('absent is NOT empty — the two are distinguishable', () => {
        expect(parseTapesParam(null)).toBeNull();
        expect(parseTapesParam(undefined)).toBeNull();
        expect(parseTapesParam('')).toEqual([]);
    });

    it('splits on the page\'s own separator and trims', () => {
        expect(parseTapesParam('a,b,c')).toEqual(['a', 'b', 'c']);
        expect(parseTapesParam(' a , b ')).toEqual(['a', 'b']);
        expect(parseTapesParam('a,,b,')).toEqual(['a', 'b']);
    });

    it('⛓ round-trips as a FIXED POINT over every spelling', () => {
        for (const raw of ['a', 'a,b', 'a,b,c', 'x/y/z.json,q.json']) {
            expect(formatTapesParam(parseTapesParam(raw))).toBe(raw);
        }
    });

    it('⛔ writes NOTHING for an empty list, so the writer DELETES the key', () => {
        expect(formatTapesParam([])).toBeNull();
        expect(formatTapesParam(null)).toBeNull();
        expect(formatTapesParam(['', '  '])).toBeNull();
    });
});

describe('a chain HEADLINE is a legal member and expands', () => {
    it('expands a chain id to its segments, in order, and REPORTS that it did', () => {
        const got = expandSequence(['r8-d2']);
        expect(got.names).toEqual(['r8-solve-18', 'r8-d2-19', 'r8-d2-20']);
        expect(got.expansions).toEqual([{
            from: 'r8-d2', to: ['r8-solve-18', 'r8-d2-19', 'r8-d2-20'],
        }]);
    });

    it('leaves a plain tape name alone, and mixes the two', () => {
        const got = expandSequence(['some/tape.json', 'r8-d2']);
        expect(got.names).toEqual([
            'some/tape.json', 'r8-solve-18', 'r8-d2-19', 'r8-d2-20',
        ]);
        expect(got.expansions).toHaveLength(1);
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 5 — **`jsLiveEnvelope` LIVES HERE NOW, AND `watchViewer.js`
 * RE-EXPORTS IT RATHER THAN KEEPING A COPY.**
 *
 * The campaign census (`census-seedling-campaign.mjs`) has to ask the SAME
 * question the page asks, in node, with no DOM — and `watchViewer.js` cannot
 * be imported outside a browser (it touches `window` at module scope). A
 * census that re-spelled the envelope would be measuring a lookalike and
 * reporting it under the page's name (trap 383).
 *
 * ⛔ SO THE CLAIM IS ASSERTED ON THE SOURCE, because the identity cannot be
 * asserted by importing: `watchViewer.js` must carry `export { jsLiveEnvelope }`
 * and must NOT define one.
 */
describe('⛓⛓ the live envelope is ONE function, and the page re-exports it', () => {
    const viewer = readFileSync(join(HERE, 'watchViewer.js'), 'utf8');

    it('⛔ `watchViewer.js` RE-EXPORTS `jsLiveEnvelope` — it does not define one', () => {
        expect(viewer).toMatch(/export \{ jsLiveEnvelope \};/);
        expect(viewer).not.toMatch(/function jsLiveEnvelope\s*\(/);
    });

    it('⛓ …and it imports the name from THIS module', () => {
        const imports = viewer.slice(0, viewer.indexOf("} from './director.js';"));
        expect(imports).toMatch(/jsLiveEnvelope/);
    });

    it('⛓ the envelope FOLDS the run\'s APPLIED timed clears — the third ledger', () => {
        // ⛔ `earnedClears` holds what the MODEL computed and `levelRun` refuses
        //    to compute a kill-lock clear at all, so a declared timed row is in
        //    NEITHER it nor `spinnerWrites` — but the GAME's persistence array
        //    holds it, and that array is what the successor's block was read
        //    out of (trap 493, one room over from the splice's out-of-band fold).
        const run = {
            level: 5,
            worldCtor: { x: 80, y: 32 },
            earnedClears: [],
            spinnerWrites: [],
            appliedTimedClears: [{ level: 5, tag: 0, at: 427 }],
            saveState: {
                sealSlotsEarned: 0, totem_parts: [], keys: [], bootSealParts: [],
            },
        };
        expect(jsLiveEnvelope(run, [], ['dead_frames']).cleared)
            .toEqual([{ level: 5, tag: 0 }]);
    });

    it('⛔ …and window 1\'s OWN timed rows are NOT trusted before their tick', () => {
        // A boot list may itself carry a v9 timed row (`r8-solve-5` does). It
        // is not in the world until `at`, and `appliedTimedClears` is what says
        // whether it is — so the boot fold takes the LATCH rows only.
        const run = {
            level: 5,
            worldCtor: { x: 80, y: 32 },
            earnedClears: [],
            spinnerWrites: [],
            appliedTimedClears: [],
            saveState: {
                sealSlotsEarned: 0, totem_parts: [], keys: [], bootSealParts: [],
            },
        };
        const boot = [{ level: 8, tag: 1 }, { level: 5, tag: 0, at: 427 }];
        expect(jsLiveEnvelope(run, boot, []).cleared).toEqual([{ level: 8, tag: 1 }]);
    });

    it('a run with no `appliedTimedClears` is handled — the fold is additive', () => {
        const run = {
            level: 1, worldCtor: { x: 0, y: 0 }, earnedClears: [], spinnerWrites: [],
            saveState: {
                sealSlotsEarned: 0, totem_parts: [], keys: [], bootSealParts: [],
            },
        };
        expect(jsLiveEnvelope(run, [], []).cleared).toEqual([]);
    });
});

describe('TIER 1 — admission at queue time', () => {
    /**
     * ⛓ R9 SLICE 8: every fixture here carries a `tick0` block, because from
     * ruling 20 on a CONTINUATION window that lacks one is refused at this
     * tier by name. A fixture without it would red every row below for the
     * new rule rather than for the rule each row is about — so the block is
     * part of what "a well-formed continuation window" MEANS now, and the
     * refusal gets its own test.
     */
    const TICK0 = {
        rng: { seed: 1196897329, split: false, cosmetic: 0, fp: 341033166 },
        seam: { time: 6208 },
    };
    const tape = (over = {}) => ({
        name: 'w', boot: { level: 20, x: 192, y: 64 }, tick_count: 100,
        inputs: [], persistence: [], grants: [], tick0: TICK0, ...over,
    });

    /**
     * ⛔⛔ R9 SLICE 8 (⚖ ruling 20) — A CONTINUATION WINDOW WITHOUT A TICK-0
     * LATCH IS REFUSED IN THE PICKER, BY NAME, WITH ITS OWN CURE.
     *
     * This is mutant (b) of the slice, as a permanent row: strip the field
     * from one window and the queue refuses before a frame exists, naming the
     * window and printing the derivation command. The alternative the page
     * used to have — serving it under slice 5's zeroing — is the
     * silent-wrong-answer shape: it plays, disagrees with its own fresh-page
     * recording from tick 0, and surfaces as somebody else's `rng` refusal
     * several boundaries later (§16.8's `boundary 5/15`).
     */
    it('⛔ a later window with NO tick-0 latch is refused, with the command', () => {
        const fs = sequenceAdmission([tape(), tape({ name: 'r8-solve-6', tick0: undefined })]);
        const row = fs.find((f) => f.what === 'a later window declares no tick-0 latch');
        expect(row, JSON.stringify(fs)).toBeTruthy();
        expect(row.where).toContain('r8-solve-6');
        expect(row.detail).toMatch(/derive-seedling-tick0\.mjs --only=r8-solve-6/);
    });

    it('⚠ WINDOW 0 needs none — a fresh boot applies its own declaration', () => {
        expect(sequenceAdmission([tape({ tick0: undefined }), tape()])).toEqual([]);
    });

    it('an empty queue is refused by name', () => {
        expect(sequenceAdmission([])[0].what).toBe('the queue is empty');
    });

    it('a later window declaring GRANTS is refused by name', () => {
        const fs = sequenceAdmission([tape(), tape({ grants: [{ level: 20, items: ['x'] }] })]);
        expect(fs.map((f) => f.what)).toContain('a later window declares grants');
    });

    it('window 0 may declare grants — it boots', () => {
        const fs = sequenceAdmission([tape({ grants: [{ level: 19, items: ['x'] }] }), tape()]);
        expect(fs).toEqual([]);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 5 — **`split` IS THE ONE rng FIELD THE PAGE CANNOT STRIP**,
     * so a window that changes it is refused here rather than handed to a game
     * that would apply it. `Bot.botStart` assigns `Rng.split` UNCONDITIONALLY
     * (`Bot.as:1771`); the three stream positions are applied only when
     * non-zero, which is what makes `watchWasm.continuationTape`'s zeroing a
     * no-op on the game and this one not.
     *
     * ⛓ THE RULE HAS A LIVE WITNESS, NOT ONLY A MUTANT (trap 475):
     * `r6-owl-control` and `r6-owl-kill` are the two tapes on the 154-tape
     * roster that really declare `split: true`.
     */
    it('⛓⛓ a later window declaring a DIFFERENT `rng.split` is refused by name', () => {
        const fs = sequenceAdmission([
            tape({ rng: { seed: 1, split: false } }),
            tape({ rng: { seed: 2, split: true } }),
        ]);
        expect(fs.map((f) => f.what))
            .toContain('a later window declares a different `rng.split`');
        expect(fs[0].detail).toMatch(/Bot\.as:1771/);
    });

    it('⛓ …and an ABSENT `rng` block is `split: false` — not a third state', () => {
        // ⚠ 110 of the 154 roster tapes are pre-v7 and carry no `rng` at all;
        //   `botLoadTape` defaults the field, so "declares nothing" and
        //   "declares false" are the SAME instruction to the game.
        expect(sequenceAdmission([tape({ rng: { seed: 1, split: false } }), tape()]))
            .toEqual([]);
        expect(sequenceAdmission([tape(), tape({ rng: { seed: 1, split: false } })]))
            .toEqual([]);
        // ⛔ and a true one still refuses against an absent one
        expect(sequenceAdmission([tape(), tape({ rng: { seed: 1, split: true } })])
            .map((f) => f.what))
            .toContain('a later window declares a different `rng.split`');
    });

    it('⛓ window 0 may declare `split: true` — every window then agrees with it', () => {
        expect(sequenceAdmission([
            tape({ rng: { seed: 1, split: true } }),
            tape({ rng: { seed: 2, split: true } }),
        ])).toEqual([]);
    });

    it('⛓ a window that does not end at rest REPORTS, and NAMES the keys', () => {
        const held = tape({ inputs: [{ key: 'down', from: 0, to: 100 }] });
        const fs = sequenceAdmission([held, tape()]);
        expect(fs).toHaveLength(1);
        // ⛔ NOT a refusal: the JS model has no input static, and `r8-d2-19` —
        //    the slice's own subject — ends with `down` HELD at tick_count.
        expect(refusalsOnly(fs)).toEqual([]);
        expect(fs[0].informational).toBe(true);
        expect(fs[0].keys).toEqual(['down']);
        expect(fs[0].what).toMatch(/must RELEASE/);
        // ⚠ nothing follows the last window, so its tail is the walk's own ending.
        expect(sequenceAdmission([tape(), held])).toEqual([]);
    });
});

describe('⛓⛓⛓ TIER 2 — the boundary, and the ruled sentence field by field', () => {
    const LIVE = {
        level: 20,
        ctor: { x: 192, y: 64 },
        cleared: [{ level: 5, tag: 0 }, { level: 19, tag: 0 }],
        blocks: { rng: { seed: 7 }, seam: { time: 5 }, save: null, pins: ['dead_frames'] },
        blocksWhy: null,
    };
    const tape = (over = {}) => ({
        name: 'w2', boot: { level: 20, x: 192, y: 64 },
        persistence: [{ level: 5, tag: 0 }, { level: 19, tag: 0 }],
        grants: [], ...over,
    });
    const whats = (fs) => fs.map((f) => f.what);

    it('⛓ THE SUBJECT: a LATCH that matches is ADMITTED — no findings at all', () => {
        expect(continuationAdmission(tape(), LIVE)).toEqual([]);
    });

    it('a boot naming another LEVEL is refused, and the refusal names the rebuild', () => {
        const fs = continuationAdmission(tape({ boot: { level: 4, x: 192, y: 64 } }), LIVE);
        expect(whats(fs)).toContain('the boot names a level the live world is not in');
        expect(fs[0].detail).toMatch(/REBUILD/);
    });

    it('a boot naming other CONSTRUCTION ARGS is refused — the game\'s own test', () => {
        const fs = continuationAdmission(tape({ boot: { level: 20, x: 200, y: 72 } }), LIVE);
        expect(whats(fs))
            .toContain('the boot names construction args the live world was not built with');
        // ⛔ (200,72) is where the player STANDS after the half-tile spawn offset;
        //    `atBootPosition` compares the ARGS, which are (192,64).
        expect(fs[0].detail).toMatch(/Main\.playerPositionX\/Y/);
    });

    it('the refusal carries its own NEXT WORK ORDER when the caller has one', () => {
        const fs = continuationAdmission(tape({ boot: { level: 4, x: 1, y: 2 } }), LIVE,
            { nearest: 'r8-d2' });
        expect(fs[0].detail).toMatch(/nearest continuation the roster has is r8-d2/);
    });

    it('a SUPERSET of the live cleared set is refused — it would clear an unearned flag', () => {
        const fs = continuationAdmission(
            tape({ persistence: [...tape().persistence, { level: 99, tag: 1 }] }), LIVE);
        expect(whats(fs))
            .toContain('the window declares a clear the live world does not hold');
        expect(fs[0].detail).toMatch(/99:1/);
    });

    it('a SUBSET is refused too — the reset path would bring the flag BACK', () => {
        const fs = continuationAdmission(tape({ persistence: [{ level: 5, tag: 0 }] }), LIVE);
        expect(whats(fs))
            .toContain('the window does not declare a clear the live world holds');
        expect(fs[0].detail).toMatch(/19:0/);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 3 — THE OUT-OF-BAND ROW, AND IT IS WHY THE PAGE'S LIVE
     * SET IS NOT `earnedClears`.
     *
     * The splice put L18 in front of `r8-d2`, and L18's two Spinners carry
     * `tag = "-1"`. `Main.levelPersistenceSet` indexes `level * 30 + tag` with
     * NO bounds check, so each kill writes the PREVIOUS level's LAST slot —
     * `{17,29}` — and the measured latch carries it, which is why every
     * segment after L18 declares it.
     *
     * ⛔ THE MODEL IS RIGHT NOT TO PUT IT IN `earnedClears`: that ledger is
     * *what the next BUILD of a level may be handed*, and `buildLevelWorld`
     * refuses "a clear which no entity in this level reads", which an
     * out-of-band slot is by construction (`r5-feather` measured that throw).
     * It REPORTS the write on `spinnerWrites` instead.
     *
     * ⇒ TWO LEDGERS, TWO MEANINGS, and they agreed until a room wrote out of
     * band. A live set built from `earnedClears` alone is short exactly the
     * out-of-band rows, and the admission then refuses the next window BY NAME
     * for a flag the game really did write — a true sentence about the wrong
     * ledger. `watchViewer.jsLiveEnvelope` folds the reported writes in; this
     * row is what says the fold is load-bearing rather than decorative.
     */
    it('⛓⛓ an OUT-OF-BAND write belongs in the live set, and leaving it out '
        + 'refuses the next window by name', () => {
        const run = runTape(loadTape('r8-solve-18'), { levelSource: atlasLevelSource() });
        const outOfBand = run.spinnerWrites.filter((w) => w.outOfBand);
        // the ledger fact, first: REPORTED and not APPLIED
        expect(outOfBand.map((w) => `${w.flag.level}:${w.flag.tag}`)).toEqual(['17:29', '17:29']);
        expect(run.earnedClears).toEqual([]);

        const declared = loadTape('r8-d2-19').persistence.map((c) => ({
            level: c.level, tag: c.tag,
        }));
        const next = { name: 'r8-d2-19', boot: loadTape('r8-d2-19').boot,
            persistence: declared, grants: [] };
        const base = { level: 19, ctor: { x: 16, y: 144 },
            blocks: { save: null, pins: [] }, blocksWhy: null };
        // ⛔ WITHOUT the fold — `earnedClears` only, plus segment 0's own boot
        const without = continuationAdmission(next, {
            ...base,
            cleared: [...loadTape('r8-solve-18').persistence.map((c) => ({
                level: c.level, tag: c.tag,
            })), ...run.earnedClears],
        });
        expect(whats(without))
            .toContain('the window declares a clear the live world does not hold');
        expect(without[0].detail).toMatch(/17:29/);
        // ⛓ WITH it — admitted, and nothing else changes
        const with_ = continuationAdmission(next, {
            ...base,
            cleared: [...loadTape('r8-solve-18').persistence.map((c) => ({
                level: c.level, tag: c.tag,
            })), ...run.earnedClears,
            ...outOfBand.map((w) => ({ level: w.flag.level, tag: w.flag.tag }))],
        });
        expect(with_).toEqual([]);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 5 (⚖ ruling 14) — **THE TIMED-ROW RULE**, which is what
     * turned `act2-the-sword` from four windows into eleven without moving a
     * byte of any tape.
     */
    it('⛓⛓⛓ a TIMED row is NOT compared — it is the walk\'s OWN clear, not a latch',
        () => {
            // ⛔ the live world holds neither `{7,3}` nor anything but the latch
            //    pair, and the window is ADMITTED anyway.
            const fs = continuationAdmission(
                tape({ persistence: [...tape().persistence, { level: 7, tag: 3, at: 42 }] }),
                LIVE);
            expect(refusalsOnly(fs)).toEqual([]);
        });

    it('⛓ …and it is REPORTED, so the rule is visible rather than inferred', () => {
        const fs = continuationAdmission(
            tape({ persistence: [...tape().persistence, { level: 7, tag: 3, at: 42 }] }),
            LIVE);
        const row = fs.find((f) => /forward declaration\(s\) set aside/.test(f.what));
        expect(row).toBeDefined();
        expect(row.informational).toBe(true);
        expect(row.detail).toMatch(/7:3@42/);
    });

    it('⛔⛔ a forward row the live world ALREADY HOLDS is refused BY NAME', () => {
        // `{19,0}` IS in LIVE.cleared — so this walk cannot be what earns it.
        const fs = continuationAdmission(
            tape({ persistence: [{ level: 5, tag: 0 }, { level: 19, tag: 0, at: 9 }] }),
            LIVE);
        expect(fs.map((f) => f.what))
            .toContain('a forward declaration the live world ALREADY holds');
        expect(refusalsOnly(fs)[0].detail).toMatch(/19:0/);
        expect(refusalsOnly(fs)[0].detail).toMatch(/before the walk\s+that opens it/);
    });

    it('⛔ an UNTIMED mismatch still refuses — the old rows are untouched', () => {
        // ⛓ the same tape, the same missing flag, with `at` REMOVED: still a
        //   refusal. This is the CONTROL for the row above (trap 297).
        const fs = continuationAdmission(
            tape({ persistence: [{ level: 5, tag: 0 }] }), LIVE);
        expect(fs.map((f) => f.what))
            .toContain('the window does not declare a clear the live world holds');
    });

    it('⛓ a timed row is excluded from BOTH directions of the equality', () => {
        // ⛔ not merely from the "declares a clear the world lacks" half: a
        //   latch set that is equal EXCEPT for a timed extra must be equal.
        const fs = continuationAdmission(
            tape({ persistence: [{ level: 5, tag: 0 }, { level: 19, tag: 0 },
                { level: 99, tag: 9, at: 1 }] }), LIVE);
        expect(refusalsOnly(fs)).toEqual([]);
    });

    it('grants are refused here too — tier 2 does not trust tier 1 to have run', () => {
        const fs = continuationAdmission(tape({ grants: [{ level: 20, items: ['x'] }] }), LIVE);
        expect(whats(fs)).toContain('a later window declares grants');
    });

    it('a declared `rng` that DISAGREES with the live world is refused', () => {
        const fs = continuationAdmission(tape({ rng: { seed: 8 } }), LIVE);
        expect(whats(fs)).toContain('the declared `rng` is not the live world\'s');
    });

    it('…and one that AGREES is legal — that is what a staged latch IS', () => {
        expect(continuationAdmission(tape({ rng: { seed: 7 } }), LIVE)).toEqual([]);
    });

    it('⛔ a row the live side cannot answer for is UNASSERTED BY NAME, never passed', () => {
        const js = { ...LIVE, blocks: { save: null, pins: [] },
            blocksWhy: { rng: 'the JS run models no LFSR position' } };
        const fs = continuationAdmission(tape({ rng: { seed: 7 } }), js);
        expect(fs).toHaveLength(1);
        expect(fs[0].informational).toBe(true);
        expect(fs[0].what).toMatch(/^unasserted/);
        expect(fs[0].detail).toMatch(/models no LFSR position/);
        // …and an unasserted row is not a refusal.
        expect(refusalsOnly(fs)).toEqual([]);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 8 (⚖ ruling 20) — THE POSTURE GATE ON THE `rng` ROW.
     *
     * `rng.gameplay` is a `level-qualified-equality` row: the stream position
     * is an equality field only where the boot room's RENDER path takes no
     * draws. In a render-coupled room the two sides are a render COUNT apart
     * and a render count is ±2-banded, so asserting equality would red for a
     * frame budget rather than for a defect.
     *
     * ⛔ AND THE EXCUSED ROW IS STILL REPORTED, carrying its render sites. A
     * boundary nobody can assert is a fact about the chain; one that vanished
     * from the readout would read exactly like one that passed (trap 119).
     */
    const COUPLED = { comparable: false, renderSites: ["Tile.render's waterfall spray "
        + 'draws 2 per render (t=25)'], consumers: [], verdict: 'NOT COMPARABLE' };
    const CLEAN = { comparable: true, renderSites: [], consumers: [], verdict: 'RENDER-CLEAN' };

    it('⛓ a mismatch in a RENDER-COUPLED room is UNASSERTED, with its sites', () => {
        const fs = continuationAdmission(tape({ rng: { seed: 8 } }), LIVE,
            { rngPosture: COUPLED });
        expect(refusalsOnly(fs)).toEqual([]);
        const row = fs.find((f) => f.what.includes('NOT COMPARABLE'));
        expect(row.informational).toBe(true);
        expect(row.detail).toMatch(/waterfall spray/);
        // …and the two values are still printed, so the delta is readable.
        expect(row.detail).toMatch(/tape .*seed.*8.*vs live/);
    });

    it('⛔ MUTANT (c): the SAME mismatch in a render-CLEAN room still REFUSES', () => {
        // The discriminating half. Without it the row above would pass for a
        // gate that had simply stopped checking `rng` at all.
        const fs = continuationAdmission(tape({ rng: { seed: 8 } }), LIVE,
            { rngPosture: CLEAN });
        expect(whats(refusalsOnly(fs))).toContain('the declared `rng` is not the live world\'s');
    });

    it('⛔ FAIL-CLOSED: no posture at all means ASSERT, exactly as before', () => {
        const fs = continuationAdmission(tape({ rng: { seed: 8 } }), LIVE, {});
        expect(whats(refusalsOnly(fs))).toContain('the declared `rng` is not the live world\'s');
    });

    it('⛓ the gate is the `rng` row ONLY — a coupled room does not excuse `seam`', () => {
        // A posture is a statement about DRAWS. The clock, the save block and
        // the pins are not render-coupled in any room, so a render-coupled
        // boot room must not launder a `seam` mismatch through this gate.
        const fs = continuationAdmission(tape({ seam: { time: 999 } }), LIVE,
            { rngPosture: COUPLED });
        expect(whats(refusalsOnly(fs))).toContain('the declared `seam` is not the live world\'s');
    });

    it('a tape with no boot block, and a boundary with no live world, both refuse', () => {
        expect(continuationAdmission({}, LIVE)[0].what).toBe('the window has no boot block');
        expect(continuationAdmission(tape(), null)[0].what)
            .toBe('there is no live world to continue');
    });
});
