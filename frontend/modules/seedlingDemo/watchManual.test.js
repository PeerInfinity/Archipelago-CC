/**
 * watchManual — MANUAL mode and TAPE I/O, tested where they are pure
 * (editor arc slice 3).
 *
 * ⛔ THE ACCEPTANCE ROWS ARE AT THE BOTTOM AND THEY DRIVE A REAL LEVEL.
 * Kickoff §4's slice-3 acceptance is two round trips:
 *
 *   1. a hand-driven session folds to a tape that REPLAYS through the page's
 *      own REPLAY arm frame-for-frame;
 *   2. a pasted committed tape behaves identically to the picker's copy.
 *
 * Both are asserted here against the same `createManualSession` /
 * `foldRoundTrip` / `parseTapeText` the page calls, so the derivation under
 * test is the derivation on screen. The browser row
 * (`scripts/procgen/check-seedling-editor-manual.mjs`) proves the PAGE'S
 * PATH to it — the module graph loading at all, the keyboard, the DOM, and
 * chromium instead of node, which is the unshared part and the part slice 1
 * found broken for two rungs.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    clampTick, createManualSession, foldRoundTrip, heldFromCodes, KEYBOARD_BINDINGS,
    KEYBOARD_ROWS, liveOverlaysFor, parseTapeText, readViewParams, serializeTapeText,
    tapeKeyForCode,
} from './watchManual.js';
import { collectRun } from './watchOverlays.js';
import { buildStagedTape } from './botDriverV1.js';
import { KEY_NAMES, parseTape } from './tapeFormat.js';
import { stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const tape = (name) =>
    JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

// ── the keyboard ─────────────────────────────────────────────────────────

describe('the keyboard bindings', () => {
    it('⛔ every binding names a TAPE key — one vocabulary, not a second', () => {
        for (const [code, key] of Object.entries(KEYBOARD_BINDINGS)) {
            expect(KEY_NAMES, code).toContain(key);
        }
        // And the whole tape vocabulary is reachable: a key the format has
        // and the keyboard cannot press is a tape this page cannot record.
        expect([...Object.values(KEYBOARD_BINDINGS)].sort()).toEqual([...KEY_NAMES].sort());
    });

    it('bindings are PHYSICAL codes, so the layout does not change the run', () => {
        // `KeyX`, not `x` — an AZERTY keyboard drives the same run.
        expect(Object.keys(KEYBOARD_BINDINGS).every((c) => /^(Key|Arrow)/.test(c))).toBe(true);
        expect(tapeKeyForCode('KeyX')).toBe('primary');
        expect(tapeKeyForCode('ArrowLeft')).toBe('left');
    });

    it('an unbound key presses NOTHING — it is not an error and not a guess', () => {
        expect(tapeKeyForCode('KeyQ')).toBe(null);
        expect([...heldFromCodes(['ArrowUp', 'KeyQ', 'KeyC'])].sort())
            .toEqual(['secondary', 'up']);
        expect(heldFromCodes(null).size).toBe(0);
    });

    it('the legend rows ARE the binding table — one roster', () => {
        expect(KEYBOARD_ROWS.map((r) => r.code)).toEqual(Object.keys(KEYBOARD_BINDINGS));
    });
});

// ── the view parameters ──────────────────────────────────────────────────

describe('?tick= and ?shot=', () => {
    it('absent is not zero — `null` means "wherever the page starts"', () => {
        expect(readViewParams('')).toEqual({ tick: null, shot: false, tickWhy: null });
        expect(readViewParams('?tick=')).toEqual({ tick: null, shot: false, tickWhy: null });
    });

    it('a whole tick index reads as itself; ?shot=1 is the only true form', () => {
        expect(readViewParams('?tick=247&shot=1')).toEqual({
            tick: 247, shot: true, tickWhy: null,
        });
        expect(readViewParams('?shot=0').shot).toBe(false);
        expect(readViewParams('?shot=true').shot).toBe(false);
    });

    it('⚠ an unreadable ?tick= is REPORTED, never silently zero', () => {
        for (const bad of ['abc', '-3', '1.5']) {
            const got = readViewParams(`?tick=${bad}`);
            expect(got.tick, bad).toBe(null);
            expect(got.tickWhy, bad).toMatch(/not a whole tick index/);
        }
    });

    it('⛔ clampTick CLAMPS AND SAYS SO — a short run is a fact about the run', () => {
        expect(clampTick(10, 100)).toEqual({ tick: 10, why: null });
        expect(clampTick(99, 100)).toEqual({ tick: 99, why: null });
        const over = clampTick(500, 100);
        expect(over.tick).toBe(99);
        expect(over.why).toMatch(/past the last frame/);
        expect(over.why).toMatch(/100 frame/);
        // No request at all lands at 0, silently — that IS the default.
        expect(clampTick(null, 100)).toEqual({ tick: 0, why: null });
        // A run that collected nothing still has a legal cursor.
        expect(clampTick(0, 0)).toEqual({ tick: 0, why: null });
    });
});

// ── tape I/O ─────────────────────────────────────────────────────────────

describe('save / load', () => {
    it('⛔ an empty box, non-JSON and a bad TAPE are three different facts', () => {
        expect(parseTapeText('   ').error).toBe('empty');
        expect(parseTapeText('not json at all').error).toBe('json');
        const bad = parseTapeText('{"game":"seedling","name":"x"}');
        expect(bad.error).toBe('tape');
        // ⛓ THE PARSER'S OWN MESSAGE, verbatim — the same one the runner and
        // the differential would give it, never a second opinion.
        let why = null;
        try { parseTape({ game: 'seedling', name: 'x' }); } catch (e) { why = e.message; }
        expect(bad.why).toBe(why);
    });

    it('a committed tape survives serialise → parse BYTE-IDENTICALLY', () => {
        const committed = tape('r8-solve-18');
        const text = serializeTapeText(committed);
        const got = parseTapeText(text);
        expect(got.error).toBeUndefined();
        // ⚠ THE OBJECT IS NOT NORMALISED ON THE WAY OUT. Round-tripping
        // through `parseTape` first would round a v1 fixture up to the
        // current vocabulary and hand the user a tape the roster does not
        // contain.
        expect(JSON.stringify(got.tape)).toBe(JSON.stringify(committed));
    });

    it('⚠ and a v1 fixture too — the version that has the most to lose', () => {
        const v1 = tape('pit-fall-chain-85');
        expect(JSON.stringify(parseTapeText(serializeTapeText(v1)).tape))
            .toBe(JSON.stringify(v1));
    });
});

// ── the session ──────────────────────────────────────────────────────────

const levelSource = atlasLevelSource();
const stagingOf = (name) => stagingFromTape(parseTape(tape(name)));

/** A scripted hand-drive: the shape a keyboard produces, without one. */
function drive(session, script) {
    for (const [codes, ticks] of script) {
        for (let i = 0; i < ticks; i += 1) session.step(heldFromCodes(codes));
    }
    return session;
}

describe('a manual session', () => {
    it('⚠ RECORD-THEN-ACT: N ticks driven is N+1 observations', () => {
        const s = createManualSession({
            levelSource, staging: stagingOf('r7-act2-4'), name: 'm',
        });
        // Observation 0 exists BEFORE anything is driven — it is the boot
        // position under no input, exactly like `createTapeStepper`'s.
        expect(s.tick).toBe(0);
        expect(s.observations).toHaveLength(1);
        expect(s.observations[0].t).toBe(0);

        drive(s, [[['ArrowRight'], 20]]);
        expect(s.tick).toBe(20);
        expect(s.perTick).toHaveLength(20);
        expect(s.observations).toHaveLength(21);
        expect(s.samples).toHaveLength(21);
    });

    it('⛔ the held set is COPIED, not referenced — a live keyboard keeps moving', () => {
        const s = createManualSession({
            levelSource, staging: stagingOf('r7-act2-4'), name: 'm',
        });
        const live = new Set(['right']);
        s.step(live);
        live.add('primary');           // the user pressed X one tick later
        expect([...s.perTick[0]]).toEqual(['right']);
    });

    it('the session boots WHERE THE STAGING SAYS, through the one construction', () => {
        const staging = stagingOf('r7-act2-4');
        const s = createManualSession({ levelSource, staging, name: 'm' });
        expect(s.observations[0].level).toBe(staging.boot.level);
        // `solveStaging` is what makes the block honest — the same pair
        // `solveForPage` uses, so a manual run and a solved one in the same
        // room are the same world.
        expect(s.staging.noclip).toBe(false);
        expect(s.staging.noDamage).toBe(false);
        expect(s.staging.despawn).toEqual([]);
    });

    it('live overlays come from the SAME extractor the replay uses', () => {
        const s = drive(
            createManualSession({ levelSource, staging: stagingOf('r7-act2-4'), name: 'm' }),
            [[['ArrowRight'], 10], [['ArrowRight', 'KeyX'], 4], [[], 6]],
        );
        const { markers } = liveOverlaysFor(s);
        const press = markers.filter((m) => m.source === 'action');
        // ONE marker for a four-tick hold — an EDGE, not a hold.
        expect(press).toHaveLength(1);
        expect(press[0].tick).toBe(10);
        expect(press[0].label).toMatch(/primary pressed/);
    });
});

// ── ⛓⛓⛓ THE ACCEPTANCE ROWS (kickoff §4, slice 3) ───────────────────────

describe('⛓⛓⛓ ACCEPTANCE 1 — a hand-driven session REPLAYS frame-for-frame', () => {
    /**
     * ⛔ THIS IS THE ROW THAT MAKES THE PRODUCER LOOP LEGAL. A manual drive
     * advances the run itself, which is the thing the page's third law
     * (NO PRIVATE TICK LOOP) exists to police. The law's real content is
     * that no second READER of a tape may exist; a producer is fine PROVIDED
     * what it produces means, to the one reader, exactly what it meant while
     * being produced. That is this assertion and nothing weaker.
     */
    const script = [
        [['ArrowRight'], 30],
        [[], 5],
        [['ArrowDown'], 25],
        [['ArrowDown', 'KeyX'], 3],
        [[], 4],
        [['ArrowLeft'], 18],
        [['KeyX'], 2],
        [['ArrowUp'], 22],
        [[], 6],
    ];

    it('every observation and every held set survives the fold', () => {
        const s = drive(
            createManualSession({ levelSource, staging: stagingOf('r7-act2-4'), name: 'manual-row' }),
            script,
        );
        expect(s.tick).toBe(115);
        const trip = foldRoundTrip(s, levelSource);
        expect(trip.error).toBe(null);
        // ⚠ NAMED, not counted: a mismatch row carries its tick and both
        // sides, so a red here says WHAT diverged rather than that something did.
        expect(trip.mismatches).toEqual([]);
        expect(trip.ok).toBe(true);
        expect(trip.frames).toHaveLength(s.observations.length);
    });

    it('⛓ and the SPAN FOLD really compressed — this is not a per-tick dump', () => {
        // The half a position check cannot see. If the fold emitted one span
        // per tick the round trip would pass trivially and prove nothing
        // about `buildTape`.
        const s = drive(
            createManualSession({ levelSource, staging: stagingOf('r7-act2-4'), name: 'manual-row' }),
            script,
        );
        const t = s.fold();
        expect(t.tick_count).toBe(115);
        expect(t.inputs.length).toBeGreaterThan(0);
        expect(t.inputs.length).toBeLessThan(20);
        // ⛔ AND THE FOLD IS THE ONE FOLD: a v8 header, `noclip`/`noDamage`
        // off, which is what `buildStagedTape` writes and what the replay
        // above therefore ran.
        expect(t.tape_version).toBe(8);
        expect(t.noclip).toBe(false);
        expect(parseTape(t).tick_count).toBe(115);
    });

    it('⛓⛓ A REFUSED DRIVE ROUND-TRIPS ITS REFUSAL — same tick, same message', () => {
        /**
         * ⛔ THE CASE A HAND DRIVER MEETS CONSTANTLY, and the one a
         * pass/fail round trip would have reported as a broken fold. L4's
         * pit is LETHAL FLOOR (no control block), so walking into it is a
         * named refusal from `levelRun` — everything up to it was really
         * driven, so it folds, and the tape must meet the same wall.
         *
         * Found by the BROWSER row, not by inspection: a first cut at
         * `speed=4` walked far enough to fall in, and the check reported
         * "ROUND TRIP FAILED" with an EMPTY mismatch list — which is the
         * shape of a verdict answering the wrong question.
         */
        const s = createManualSession({
            levelSource, staging: stagingOf('r7-act2-4'), name: 'refused',
        });
        expect(() => drive(s, [
            [['ArrowRight'], 84], [[], 29], [['ArrowDown'], 72],
            [['KeyX'], 19], [[], 36], [['ArrowLeft'], 60],
        ])).toThrow(/fell into a pit in level 4/);
        expect(s.refusal.tick).toBe(272);
        expect(s.tick).toBe(273);
        // ⚠ ONE LONGER than the observations, and that is correct: the tick
        // WAS dispatched, there is simply no state after it.
        expect(s.observations).toHaveLength(273);

        const trip = foldRoundTrip(s, levelSource);
        expect(trip.faithful).toBe(true);          // the fold lost nothing
        expect(trip.mismatches).toEqual([]);
        expect(trip.reproduced).toBe(true);        // …and the wall is still there
        expect(trip.error.message).toBe(s.refusal.message);
        expect(trip.ok).toBe(true);
    });

    it('⛔ a session driven with NOTHING HELD still round-trips — 0 spans', () => {
        // The degenerate case a span fold is most likely to get wrong, and
        // the one a hand driver produces by pressing START and waiting.
        const s = drive(
            createManualSession({ levelSource, staging: stagingOf('r7-act2-4'), name: 'idle' }),
            [[[], 40]],
        );
        const trip = foldRoundTrip(s, levelSource);
        expect(trip.mismatches).toEqual([]);
        expect(trip.tape.inputs).toEqual([]);
        expect(trip.frames).toHaveLength(41);
    });
});

describe('⛔ THE ONE FOLD REFUSES TO MISLABEL ITS OWN VERSION', () => {
    /**
     * ⛔ `buildStagedTape` HAD NO TEST AT ALL, which is why one of its two
     * guards was missing for two slices.
     *
     * The assembly writes a version 8 header. `despawn` (v10) was guarded;
     * `persistence[].at` (v9) was not — so it emitted a v8 header around a
     * v9 field for SIX of the committed boots, producing a tape `parseTape`
     * refuses outright. MEASURED, not reasoned: solving in the page from
     * `r8-solve-18`'s own boot yielded a tape the page's own REPLAY arm then
     * refused. Slice 1 shipped that arm; slice 2's row solved from a v8 boot,
     * so nothing met it. Slice 3's manual arm folds a wider set of boots and
     * walked into it.
     *
     * ⚠ BOTH guards are pinned here, not just the new one — a test written
     * only for the gap that bit leaves the other one exactly as unprotected
     * as this one was.
     */
    const v8 = () => stagingOf('r7-act2-4');

    it('a v8 staging block folds, and the result PARSES', () => {
        const t = buildStagedTape({ staging: v8(), perTick: [new Set(['right'])], name: 'ok' });
        expect(t.tape_version).toBe(8);
        expect(() => parseTape(t)).not.toThrow();
    });

    it('⛔ a MID-RUN clear (v9 `at`) is REFUSED, by name and with the flag', () => {
        const staging = stagingOf('r8-solve-18');
        const midRun = staging.persistence.filter((c) => c.at !== undefined);
        expect(midRun.length).toBeGreaterThan(0);   // the fixture still has one
        expect(() => buildStagedTape({ staging, perTick: [], name: 'x' }))
            .toThrow(/MID-RUN clear\(s\).*version 9 field.*Extend the assembly to v9/s);
        // The message NAMES the offending flag and its tick, so the reader
        // knows which boot they cannot fold rather than that some boot fails.
        let why = '';
        try { buildStagedTape({ staging, perTick: [], name: 'x' }); } catch (e) { why = e.message; }
        expect(why).toContain(`{${midRun[0].level},${midRun[0].tag}}@${midRun[0].at}`);
    });

    it('⛔ a DESPAWN (v10) is still refused too — the guard that already existed', () => {
        const staging = { ...v8(), despawn: [{ level: 20, tag: 0, at: 5 }] };
        expect(() => buildStagedTape({ staging, perTick: [], name: 'x' }))
            .toThrow(/version 10 field/);
    });

    it('⛓ and the SEVEN committed boots that trip it are NAMED, not a mystery', () => {
        /**
         * A bounded sweep that says what it bounded: every committed tape,
         * and exactly which ones this assembly cannot label — SIX by the v9
         * `at` (the gap this slice found) and ONE more by the v10 `despawn`
         * (`r7-act2-6`, which stages `r8-solve-6`). Split by REASON, because
         * a single count would have hidden that the two guards catch
         * different boots.
         */
        const names = readdirSync(join(HERE, 'fixtures', 'tapes'))
            .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
        const byAt = names.filter((n) =>
            (tape(n).persistence ?? []).some((c) => c.at !== undefined));
        const byDespawn = names.filter((n) => (tape(n).despawn ?? []).length > 0);
        expect(byAt.sort()).toEqual([
            'r7-act2-5', 'r7-act2-8', 'r7-act2-full',
            'r8-solve-18', 'r8-solve-5', 'r8-solve-8',
        ]);
        expect(byDespawn.sort()).toEqual(['r7-act2-6', 'r7-act2-full']);
        expect(new Set([...byAt, ...byDespawn]).size).toBe(7);
        expect(names.length).toBeGreaterThan(140);   // and the sweep really swept
    });
});

describe('⛓⛓⛓ ACCEPTANCE 2 — a pasted tape is the picker\'s copy', () => {
    it('the pasted bytes replay to the SAME frames, positions and markers', () => {
        const committed = tape('r8-solve-18');
        const pasted = parseTapeText(serializeTapeText(committed)).tape;

        const a = collectRun(committed, levelSource);
        const b = collectRun(pasted, levelSource);

        expect(b.frames).toHaveLength(a.frames.length);
        // ⚠ FIELD BY FIELD OVER THE WHOLE STREAM, not a length check: two
        // runs of the same tape agreeing on how MANY frames there are is the
        // weakest thing they could agree on.
        expect(b.frames.map((f) => f.observation))
            .toEqual(a.frames.map((f) => f.observation));
        expect(b.samples).toEqual(a.samples);
    });
});

describe('⛓⛓⛓ ACCEPTANCE 3 — the clears layer, and the report that shrank', () => {
    /**
     * ⚖ Track B's condition (iv): the engine change rides in on a consumer,
     * and this is the measurable statement that it worked.
     *
     * ⚠ THE TAPE IS `r4-walk-full`, which is the one the page probe walks
     * (`probe-seedling-watch-page.mjs`'s default). Slice 2's as-built §9.3
     * names `r1-walk-full`; that tape earns ZERO clears (it collects
     * nothing), so the seven were always this one's.
     */
    it('⛔ SEVEN clears, SEVEN markers, ZERO unplaced — was 7 unplaced at slice 2', async () => {
        const { overlaysFor } = await import('./watchOverlays.js');
        const collected = collectRun(tape('r4-walk-full'), levelSource);
        const clears = collected.run.earnedClears;
        expect(clears).toHaveLength(7);
        // Every one of the seven carries a tick inside the collected walk —
        // which is what "there is somewhere honest to draw it" means.
        for (const c of clears) {
            expect(Number.isInteger(c.t), `${c.level}:${c.tag} by ${c.by}`).toBe(true);
            expect(c.t).toBeGreaterThanOrEqual(0);
            expect(c.t).toBeLessThan(collected.frames.length);
        }
        // ⛓ SIX MECHANISMS, ONE LEDGER — a bosslock, a lightpole and five
        // pickups. The tick came from each feeder's OWN write funnel, so a
        // ledger with one arm wrong would show up as one row's tick wrong.
        expect(clears.map((c) => c.by).sort()).toEqual([
            'bosslock@16,32', 'feather@160,96', 'ghostspear@72,24', 'health@16,16',
            'lightpole', 'sword@48,48', 'torchpickup@64,64',
        ]);

        const { markers, unplaced } = overlaysFor(collected);
        expect(unplaced).toEqual([]);
        expect(markers.filter((m) => m.source === 'clear')).toHaveLength(7);
    }, 120000);
});
