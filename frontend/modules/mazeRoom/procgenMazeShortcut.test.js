/**
 * mazeRoom/procgenMazeShortcut — **THE ITEM-LOCKED CYCLE EDGE, AND THE FIFTH
 * GRADE REACHED ON A GENERATED LEVEL** (PROCGEN ELEMENTS arc 5, slice 5, D3/D4;
 * design §4.5/§4.7, ⚖ arc-5 kickoff §7.7).
 *
 * ⛔⛔ **THIS IS THE VENUE ROW.** §7.7's gate is *"SHORTENS is REACHED on ≥1
 * generated level per venue — witnessed with the reproducing command — plus a
 * synthetic unit row for the definition itself, plus the negative rows (a cut
 * graded STRONG never SHORTENS; identical ticks stays INERT)."* The synthetic
 * definition row is `procgenCore/differentialGrade.test.js`; the NEGATIVES and
 * the WITNESS are here, and every one of them is a REAL generated level rather
 * than a hand-built world — which is the difference between "the grade exists"
 * and "the grade is reachable" (trap 355).
 *
 * ⛓ EVERY SUBJECT NAMES ITS OWN COMMAND. A row that pinned a seed without the
 * line that reproduces it is a number nobody can re-derive (trap 304).
 */

import { describe, expect, it } from 'vitest';

import { GRADES } from '../procgenCore/differentialGrade.js';
import { MAZE_REFUSALS, SHORTCUT_SYMBOL, generateMazeLevel } from './procgenMaze.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { getItem, getObstacle } from './mazeRoomEngine.js';

/**
 * ⛓ ONE CALL SHAPE for every row — the same one
 * `generate-maze-level.mjs --seed=S --width=W --height=W --skeleton=rooms
 * --areas='1;shortcut=1'` makes.
 */
/**
 * ⛔⛔ THE SKELETON IS **PARSED**, NOT A BARE STRING, AND THAT IS NOT COSMETIC.
 * `parseSkeleton('rooms', {simulator: true, …})` is what the CLI hands in, and
 * a bare `'rooms'` normalises to a DIFFERENT room — `seed 8` at 11x11 refuses
 * `the-partition-yields-one-area-or-fewer` from the string and grades SHORTENS
 * from the parse. ⇒ a row driven the short way would pin numbers no published
 * command reproduces.
 */
const ROOMS = parseSkeleton('rooms', { simulator: true, substrate: 'the maze binding' });

const gen = (seed, size, params = { shortcut: 1 }) => generateMazeLevel({
    seed,
    skeleton: ROOMS,
    width: size,
    height: size,
    /**
     * ⛔ THE CLI'S OWN BOUNDS, SPELLED. `generate-maze-level.mjs` builds
     * `{obstacleTarget: 6, ...}` from its `--count` default and hands it in;
     * omitting it here would fall through to `DEFAULT_BOUNDS` and this file
     * would pin numbers no published command reproduces (trap 383 — a subject
     * found with a different instrument is a different subject).
     */
    bounds: { obstacleTarget: 6 },
    areas: { keys: 1, params },
});

describe('the knob is OPT-IN and its default runs nothing', () => {
    /**
     * ⛔⛔ THE BYTE-INERTNESS CLAIM, ASKED OF THE OBJECT RATHER THAN OF AN md5.
     * `shortcut=0` is the default, so the whole realisation is behind one `if`:
     * the summary carries neither field, no `door_SC` reaches the grid, and no
     * library entry is added. ⛓ The md5 half of this claim is the nine per-kind
     * CLI identities in the as-built; this is the half a reader can see.
     */
    it('⛓⛓ at the default the summary carries NO shortcut field at all', () => {
        const out = generateMazeLevel({ seed: 8, skeleton: ROOMS, width: 11, height: 11,
            bounds: { obstacleTarget: 6 }, areas: { keys: 1 } });
        expect(out.summary.shortcut).toBeUndefined();
        expect(out.summary.areas.shortcut).toBeUndefined();
        expect(out.summary.areas.shortcutRefused).toBeUndefined();
        expect(out.model.areas.addedObstacles).not.toContain(`door_${SHORTCUT_SYMBOL}`);
        expect(out.model.areas.addedItems).not.toContain(`key_${SHORTCUT_SYMBOL}`);
    });

    it('⛓ and at `shortcut=1` the library gains exactly the two `SC` entries', () => {
        const out = gen(8, 11);
        expect(out.summary.areas.shortcut).toBeDefined();
        expect(out.model.areas.addedObstacles).toContain(`door_${SHORTCUT_SYMBOL}`);
        expect(out.model.areas.addedItems).toContain(`key_${SHORTCUT_SYMBOL}`);
    });
});

describe('⛓⛓⛓ SHORTENS, REACHED — the witness', () => {
    /**
     * ⛓⛓⛓ **THE WITNESSED LEVEL.**
     *
     *   node scripts/procgen/generate-maze-level.mjs --seed=8 --width=11 \
     *       --height=11 --skeleton=rooms --areas='1;shortcut=1'
     *
     * The BFS solves BOTH arms — 37 steps with `key_SC`, 39 without it — so the
     * item is NOT required and the walk is STRICTLY cheaper with it. That is
     * design §4.5's fifth grade, on a level the generator produced, and it is
     * the first time in this design anything has reached it.
     */
    it('⛓⛓⛓ `rooms` seed 8 at 11x11 grades SHORTENS — 37 steps with the key, 39 without',
        () => {
            const out = gen(8, 11);
            const sc = out.summary.shortcut;
            expect(sc.symbol).toBe(SHORTCUT_SYMBOL);
            expect(sc.grade).toBe(GRADES.SHORTENS);
            expect(sc.planWith).toBe(37);
            expect(sc.planWithoutKey).toBe(39);
            expect(sc.planWith).toBeLessThan(sc.planWithoutKey);
        });

    /**
     * ⛓⛓ AND IT IS NOT ONE LUCKY SEED. Three more levels reach the grade at two
     * other sizes, each with its own command.
     *
     *   --seed=2  --width=15 --height=15   43 / 45
     *   --seed=1  --width=20 --height=20   57 / 59
     *   --seed=10 --width=20 --height=20   67 / 69
     */
    it.each([
        { seed: 2, size: 15, withKey: 43, without: 45 },
        { seed: 1, size: 20, withKey: 57, without: 59 },
        { seed: 10, size: 20, withKey: 67, without: 69 },
    ])('⛓⛓ `rooms` seed $seed at $size x $size grades SHORTENS ($withKey / $without)',
        ({ seed, size, withKey, without }) => {
            const sc = gen(seed, size).summary.shortcut;
            expect(sc.grade).toBe(GRADES.SHORTENS);
            expect(sc.planWith).toBe(withKey);
            expect(sc.planWithoutKey).toBe(without);
        });

    /**
     * ⛓ THE LEVEL THAT SHIPS REALLY HOLDS THE LOCK AND THE KEY, read off the
     * RECORD rather than off the summary — value, never echo (trap 269).
     */
    it('⛓⛓ the shipped level holds `door_SC` at the door cell and `key_SC` at the key cell',
        () => {
            const out = gen(8, 11);
            const sc = out.summary.shortcut;
            expect(getObstacle(out.record, sc.door.x, sc.door.y))
                .toBe(`door_${SHORTCUT_SYMBOL}`);
            expect(getItem(out.record, sc.key.x, sc.key.y)).toBe(`key_${SHORTCUT_SYMBOL}`);
            expect(out.record.obstacleLib[`door_${SHORTCUT_SYMBOL}`].clear_set)
                .toEqual([[`key_${SHORTCUT_SYMBOL}`]]);
        });
});

describe('⛔ the NEGATIVE rows — what SHORTENS must refuse', () => {
    /**
     * ⛔⛔⛔ **A CUT GRADED STRONG NEVER SHORTENS — ON REAL DATA.** `rooms` seed
     * 9 at 11x11 places a shortcut the TERRAIN law accepts (its geometry is
     * 4 steps open against 26 walled) and whose without-arm the BFS cannot
     * solve at all: the route to the OTHER key runs through the shortcut, so
     * removing `key_SC` seals the level. The terrain flood cannot see that —
     * `gridFlood`'s standing blindness is that entities are not terrain — and
     * the GRADE is what catches it.
     *
     *   node scripts/procgen/generate-maze-level.mjs --seed=9 --width=11 \
     *       --height=11 --skeleton=rooms --areas='1;shortcut=1'
     *
     * ⇒ this is mutant (a)'s row reached by the generator instead of by a
     * mutant: a shortcut that IS a cut ships, and the differential refuses to
     * call it a saving.
     */
    it('⛓⛓⛓ `rooms` seed 9 at 11x11 places a cut, and it grades STRONG — never SHORTENS',
        () => {
            const sc = gen(9, 11).summary.shortcut;
            expect(sc.planWithoutKey).toBeNull();
            expect(sc.grade).toBe(GRADES.STRONG);
            expect(sc.grade).not.toBe(GRADES.SHORTENS);
            // the TERRAIN law accepted it — that is the point of the row
            expect(sc.stepsWalled).toBeGreaterThan(sc.stepsOpen);
        });

    /**
     * ⛔ **IDENTICAL PLANS STAY INERT.** `rooms` seed 1 at 11x11 saves two steps
     * of GEOMETRY (16 open, 18 walled) and the BFS plan is 20 either way: the
     * walk to the key and the tree's own K-doors swallow the saving, so the
     * optimal plan ignores the key. ⛓ The grade says INERT and not SHORTENS,
     * which is the mechanism reporting that nothing reached it.
     *
     *   node scripts/procgen/generate-maze-level.mjs --seed=1 --width=11 \
     *       --height=11 --skeleton=rooms --areas='1;shortcut=1'
     */
    it('⛓⛓ `rooms` seed 1 at 11x11 saves 2 steps of GEOMETRY and 0 of PLAN — INERT', () => {
        const sc = gen(1, 11).summary.shortcut;
        expect(sc.stepsOpen).toBe(16);
        expect(sc.stepsWalled).toBe(18);
        expect(sc.planWith).toBe(20);
        expect(sc.planWithoutKey).toBe(20);
        expect(sc.grade).toBe(GRADES.INERT);
    });
});

describe('⛔ the refusals, each by name', () => {
    /**
     * ⛓⛓ **A ROOM WITH NO USABLE CYCLE HAS NOTHING TO SHORTEN**, and that is the
     * ordinary answer rather than a defect: a maze is a TREE unless its kind
     * says otherwise, and even `rooms` grows seeds whose every free cell either
     * cuts the level or costs the walk nothing.
     *
     *   node scripts/procgen/generate-maze-level.mjs --seed=1 --width=15 \
     *       --height=15 --skeleton=rooms --areas='1;shortcut=1'
     */
    it('⛓ a room with no usable cycle refuses `no-cell-can-carry-a-shortcut`', () => {
        const why = gen(1, 15).summary.areas.shortcutRefused;
        expect(why.reason).toBe('no-cell-can-carry-a-shortcut');
        expect(MAZE_REFUSALS).toContain(why.reason);
        expect(why.detail).toMatch(/A MAZE IS A TREE unless its kind says otherwise/);
    });

    /**
     * ⛓⛓ **THE KEY HAS TO PAY FOR ITSELF**, and this is the seed that made the
     * clause exist: `rooms` seed 5 at 11x11 shipped a two-step saving whose key
     * cost more to fetch than the door saved, and the differential graded the
     * level INERT.
     *
     *   node scripts/procgen/generate-maze-level.mjs --seed=5 --width=11 \
     *       --height=11 --skeleton=rooms --areas='1;shortcut=1'
     */
    it('⛔ `rooms` seed 5 at 11x11 — `the-shortcut-key-costs-more-than-the-shortcut-saves`',
        () => {
            const out = gen(5, 11);
            expect(out.summary.areas.shortcutRefused.reason)
                .toBe('the-shortcut-key-costs-more-than-the-shortcut-saves');
            expect(out.summary.shortcut).toBeUndefined();
        });

    /**
     * ⛔⛔ **A SHORTCUT REFUSAL DOES NOT THROW THE LEVEL AWAY, AND IT IS NOT
     * FILED UNDER `refused`.** The shortcut is an addition to a tree that is
     * already correct; a reader of `areas.refused` must not learn "the area
     * graph failed" about a run whose graph is fine.
     */
    it('⛓⛓ a refused shortcut leaves the AREA GRAPH ran and unrefused', () => {
        const out = gen(5, 11);
        expect(out.summary.areas.ran).toBe(true);
        expect(out.summary.areas.refused).toBeNull();
        expect(out.summary.areas.shortcutRefused).toBeTruthy();
    });
});

describe('⛓ the two arms of the candidate search', () => {
    /**
     * ⛓⛓⛓ **THE `graphify` ARM IS EMPTY ON EVERY MEASURED ROOM, AND THAT IS THE
     * FINDING.** D3's letter is *"a `door_<item>` on a recorded graphify/cycle
     * edge"*; the corridor components those edges name are ONE-WIDE by the
     * partition's own definition, so walling one cuts its corridor. Every level
     * that places therefore places `via: 'any-cycle-cell'`, and the row says so
     * rather than leaving the `via` column unexamined.
     */
    it('⛓⛓ every placed shortcut in the witnessed set placed via `any-cycle-cell`', () => {
        for (const [seed, size] of [[8, 11], [2, 15], [1, 20], [10, 20], [9, 11], [1, 11]]) {
            const sc = gen(seed, size).summary.shortcut;
            expect(sc.via, `seed ${seed} at ${size}x${size}`).toBe('any-cycle-cell');
        }
    });
});
