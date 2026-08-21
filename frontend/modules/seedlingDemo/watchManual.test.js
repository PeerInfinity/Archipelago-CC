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
import { checkSolveDespawns, createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
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

describe('⛓⛓⛓ THE ONE FOLD DERIVES ITS OWN VERSION (slice 5)', () => {
    /**
     * ⛓ SLICE 3 PINNED TWO REFUSALS HERE AND SLICE 5 REPLACES ONE OF THEM
     * WITH THE FEATURE IT WAS STANDING IN FOR.
     *
     * Slice 3 found this assembly emitting a version 8 header around a v9
     * `persistence[].at` for six committed boots, and closed the hole with a
     * refusal that said extending the assembly was the real repair. ⚖ The
     * user promoted it (kickoff §12.1): the `at` rows are now CARRIED and the
     * header is `requiredTapeVersion`'s answer.
     *
     * ⚠ The v9 refusal test is not DELETED, it is SUPERSEDED by the rows
     * below that prove the six boots fold AND round-trip — trap 62's
     * distinction. What replaces it as a refusal is the BOUND (an `at` past
     * the run's own last tick), which is a different and still-live failure.
     */
    const v8 = () => stagingOf('r7-act2-4');

    it('a v8 staging block folds to v8 STILL — the floor does not move', () => {
        const t = buildStagedTape({ staging: v8(), perTick: [new Set(['right'])], name: 'ok' });
        expect(t.tape_version).toBe(8);
        expect(() => parseTape(t)).not.toThrow();
    });

    it('⛓⛓⛓ THE SIX BOOTS THAT REFUSED NOW FOLD — v9, and every one REPLAYS', () => {
        /**
         * ⛔ THE ROUND TRIP IS THE ROW, not the version number. A tape stamped
         * 9 that `parseTape` still refused would be the same defect wearing a
         * bigger number — and refusing is exactly what it did at v8. So each
         * boot is folded WITH ITS OWN TAPE'S INPUTS (the walk whose length the
         * declared `at` fits) and then parsed back.
         */
        const six = ['r7-act2-5', 'r7-act2-8', 'r7-act2-full',
            'r8-solve-5', 'r8-solve-8', 'r8-solve-18'];
        for (const n of six) {
            const committed = tape(n);
            // ⚠ `solveStaging`, because that is what the callers hand over —
            // and `r7-act2-full` is BOTH a v9 `at` boot and the v10 despawn
            // one, so the raw block would refuse here for the OTHER reason.
            const staging = solveStaging(stagingOf(n));
            const perTick = Array.from({ length: committed.tick_count }, () => new Set());
            for (const s of committed.inputs) {
                for (let t = s.from; t < s.to && t < perTick.length; t += 1) perTick[t].add(s.key);
            }
            const folded = buildStagedTape({ staging, perTick, name: `fold-${n}` });
            expect(folded.tape_version).toBe(9);
            const at = folded.persistence.filter((c) => c.at !== undefined);
            // The rows are CARRIED, not merely tolerated: same count, same ticks.
            expect(at.map((c) => c.at))
                .toEqual(committed.persistence.filter((c) => c.at !== undefined).map((c) => c.at));
            expect(() => parseTape(JSON.parse(JSON.stringify(folded)))).not.toThrow();
        }
    });

    it('⛔ an `at` PAST THE RUN\'S LAST TICK is refused — the bound, not the version', () => {
        /**
         * The failure that survives the extension, and it is the one a SOLVE
         * meets: `at` is bounded by `[0, tick_count]` and a fold's tick_count
         * is the RUN'S. A boot declaring a clear at 385 and a solve that
         * finished in 100 would emit a tape `parseTape` refuses outright —
         * the same unparseable artifact, through a different door.
         */
        const staging = stagingOf('r8-solve-18');
        const midRun = staging.persistence.filter((c) => c.at !== undefined);
        expect(midRun.length).toBeGreaterThan(0);
        const short = Array.from({ length: 100 }, () => new Set());
        expect(() => buildStagedTape({ staging, perTick: short, name: 'x' }))
            .toThrow(/beyond this run's own 100 tick\(s\)/);
        let why = '';
        try { buildStagedTape({ staging, perTick: short, name: 'x' }); } catch (e) { why = e.message; }
        expect(why).toContain(`{${midRun[0].level},${midRun[0].tag}}@${midRun[0].at}`);
        // ⛓ AND IT IS THE BOUND AND NOT THE FIELD: one tick longer than the
        // declared clear and the same block folds.
        const long = Array.from({ length: midRun[0].at }, () => new Set());
        expect(buildStagedTape({ staging, perTick: long, name: 'x' }).tape_version).toBe(9);
    });

    it('⛔ a DESPAWN (v10) is still refused — this assembly has NO WITNESS to offer', () => {
        /**
         * ⚠ The guard survives the version derivation, and its reason CHANGED.
         * It used to say "this assembly writes a version 8 header"; the header
         * is derived now. What stands is `tapeFormat`'s own law — a despawn is
         * a WITNESSED removal — and a fold has no witness: every row it emits
         * is a fact about the run it just folded. Carrying a boot block's row
         * would put somebody else's measurement under this tape's name.
         */
        const staging = { ...v8(), despawn: [{ level: 20, id: 'bob@16,16', at: 5 }] };
        expect(() => buildStagedTape({ staging, perTick: [], name: 'x' }))
            .toThrow(/no witness to offer/);
        // …and the SOLVE side is what guarantees nothing arrives with one.
        expect(solveStaging(stagingOf('r7-act2-6')).despawn).toEqual([]);
    });

    it('⛓ and the committed boots are STILL NAMED, split by what happens to each', () => {
        /**
         * The bounded sweep slice 3 wrote, re-aimed: it named seven boots this
         * assembly could not label. SIX of them now FOLD, and the sweep says
         * so rather than being deleted along with the refusal it guarded.
         */
        const names = readdirSync(join(HERE, 'fixtures', 'tapes'))
            .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
        const byAt = names.filter((n) =>
            (tape(n).persistence ?? []).some((c) => c.at !== undefined));
        const byDespawn = names.filter((n) => (tape(n).despawn ?? []).length > 0);
        // ⛓ R9 slice 3: `r8-d2` joined the list. The splice put L18 inside the
        // headline, and L18's `lock@144,112` is `tset -1` — so the re-derived
        // headline declares the same timed `{18,0}` its own segment 0 does and
        // is a v9 tape now. A hand-kept list is exactly what should red here.
        // ⛓ R9 slice 6: `r9-campaign` joined the list, for the same reason
        //   `r8-d2` did one slice-family over — a headline that walks every
        //   room in ONE run declares every timed clear its segments do, so the
        //   true-start chain's headline carries L5's `{5,0}` and L8's two,
        //   sequence-absolute. A hand-kept list is exactly what should red here.
        expect(byAt.sort()).toEqual([
            'r7-act2-5', 'r7-act2-8', 'r7-act2-full',
            'r8-d2', 'r8-solve-18', 'r8-solve-5', 'r8-solve-8', 'r9-campaign',
        ]);
        expect(byDespawn.sort()).toEqual(['r7-act2-6', 'r7-act2-full']);
        expect(names.length).toBeGreaterThan(140);   // and the sweep really swept
        // ⛓ THE SIX FOLD; the despawn pair is emptied by `solveStaging` before
        // it ever reaches the assembly, so NO committed boot refuses now.
        for (const n of byDespawn) expect(solveStaging(stagingOf(n)).despawn).toEqual([]);
    });
});

describe('⛓⛓⛓ THE DESPAWN DROP, NOW A DROP **AND A CHECK** (slice 5)', () => {
    /**
     * ⛔ THE DRIVEN CASE, AND ITS NUMBER IS THE SLICE'S MAIN RESULT.
     *
     * `r7-act2-6` declares ONE despawn: `bob@112,48` in L6, `at: 120`. The
     * solve side has dropped it since the two run constructions were unified
     * (editor arc slice 1), on the R7-era reason that the model could not see
     * a chaser die. Since R8 slice 1 it CAN — `chaserTerrainDeaths` — and
     * `levelRun`'s own docblock says that ledger is "what makes 'the game
     * removed this body' checkable against the declaration rather than merely
     * compatible with it". This is that check.
     *
     * ⛔⛔ MEASURED: the model computes the removal at tick **55**, not 120.
     * That is NOT a disagreement, and the reason is written in the format
     * itself: *"`at` is the phases block's own end tick"* — and
     * `witnessedDespawnFindings` enforces exactly that arithmetic
     * (`startsAtTick + ticks - base === at`). `L6_BOB_DROWN` is 26 ticks of
     * approach plus 94 of dwell, and the game was asked ONCE, at the end. So
     * 120 is the tick the WITNESS CLOSED, and the removal happened somewhere
     * inside `[0, 120]`. The game's own `--mobiles` reading of that walk is
     * "t~62" (`tapeFormat` v10 docblock), which brackets the model's 55
     * exactly as the ten-tick `Mobile.death` fade predicts: destroy at 55,
     * `FP.world.remove` around 65.
     */
    const declaredOf = (n) => stagingFromTape(parseTape(tape(n)));
    const driveTape = (n) => {
        const committed = parseTape(tape(n));
        const run = createRunForStaging(solveStaging(stagingFromTape(committed)), levelSource);
        const perTick = Array.from({ length: committed.tick_count }, () => new Set());
        for (const s of committed.inputs) {
            for (let t = s.from; t < s.to && t < perTick.length; t += 1) perTick[t].add(s.key);
        }
        for (const held of perTick) run.advance(held);
        return run;
    };

    it('⛓⛓⛓ THE POSITIVE WITNESS — the model computes r7-act2-6\'s declared removal itself', () => {
        const run = driveTape('r7-act2-6');
        const rows = checkSolveDespawns(declaredOf('r7-act2-6'), run);
        expect(rows).toEqual([{
            level: 6, id: 'bob@112,48', at: 120, reproduced: true, t: 55, cause: 'water',
        }]);
        // ⛔ AND THE ID IS THE HALF THAT IS EXACT. The declared row names one
        // of the room's TWO bobs and the model's ledger names both — the
        // other drowns at 259, undeclared and correctly so
        // (`playthroughWalk`'s L6 block rules it "correct rather than
        // sloppy"). A check keyed on the ledger's LENGTH would have passed
        // for the wrong body.
        expect(run.chaserTerrainDeaths.map((d) => `${d.id}@${d.t}`))
            .toEqual(['bob@112,48@55', 'bob@96,16@259']);
    });

    it('⛔ a removal computed AFTER the witness closed is a FINDING, not a rounding', () => {
        // The band's far edge, driven from the same run: move the declaration
        // one tick BEFORE the computed removal and the check must refuse.
        const run = driveTape('r7-act2-6');
        const tight = { ...declaredOf('r7-act2-6'), despawn: [{ level: 6, id: 'bob@112,48', at: 54 }] };
        expect(() => checkSolveDespawns(tight, run)).toThrow(/1 tick\(s\) LATE/);
        // …and AT the edge it passes: `<=` is the band, not a slack.
        const edge = { ...declaredOf('r7-act2-6'), despawn: [{ level: 6, id: 'bob@112,48', at: 55 }] };
        expect(checkSolveDespawns(edge, run)[0].reproduced).toBe(true);
    });

    it('⛔ an UNBRIDGED family REFUSES — the R7-era blindness, still whole', () => {
        const run = driveTape('r7-act2-6');
        const blind = {
            ...declaredOf('r7-act2-6'),
            despawn: [{ level: 6, id: 'sandtrap@64,16', at: 120 }],
        };
        expect(() => checkSolveDespawns(blind, run))
            .toThrow(/not a family this run STEPS/);
    });

    it('⚠ a walk that never causes the removal REPORTS it, and does NOT refuse', () => {
        /**
         * ⛔ THE ROW THE DROP EXISTS FOR. A solve derives its own route;
         * `r7-act2-6`'s bob drowns because the HAND walk baited it into the
         * water. A walk that never baits it leaves it standing — in the game
         * exactly as in the model — so refusing here would make every
         * despawn-carrying boot unsolvable, which is the failure the drop was
         * built to avoid.
         */
        const declared = declaredOf('r7-act2-6');
        const run = createRunForStaging(solveStaging(declared), levelSource);
        for (let i = 0; i < 10; i += 1) run.advance(new Set());
        expect(run.chaserTerrainDeaths).toEqual([]);
        expect(checkSolveDespawns(declared, run)).toEqual([{
            level: 6, id: 'bob@112,48', at: 120, reproduced: false, t: null, cause: null,
        }]);
    });

    it('a block with NO despawn checks nothing and says so with an empty list', () => {
        const run = driveTape('r7-act2-4');
        expect(checkSolveDespawns(declaredOf('r7-act2-4'), run)).toEqual([]);
    });

    it('⛓ and a MANUAL session exposes the same check on its own drive', () => {
        const s = drive(
            createManualSession({
                levelSource, staging: declaredOf('r7-act2-6'), name: 'l6-idle',
            }),
            [[[], 10]],
        );
        expect(s.checkDespawns()).toEqual([{
            level: 6, id: 'bob@112,48', at: 120, reproduced: false, t: null, cause: null,
        }]);
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

/**
 * ⛓⛓⛓ GROUP B — DRIVING A CEREMONY BY HAND.
 *
 * ⚖ The item was "manual mode has no way to display or advance text", and the
 * ADVANCE half is what these rows are about. A pickup ceremony freezes the
 * player and pages on `Input.released(X)`, SPACED — a release that lands before
 * the page has typed out fast-forwards it instead of turning it — so a driver
 * with no rhythm can be stuck in one indefinitely while the page says nothing.
 *
 * ⛔ THE LOAD-BEARING ROW IS THE CONTROL ARM. "The ceremony finished" proves
 * nothing on its own: a ceremony that would have finished anyway makes an
 * auto-advance that does nothing look like one that works. So the same drive
 * runs TWICE from the same staging, pressing NOTHING both times, and the two
 * arms must disagree.
 */
describe('group B — the ceremony advances itself while driving', () => {
    const levelSourceB = atlasLevelSource();
    /** Drive to the first tick a ceremony is up, using the tape's own keys. */
    const driveToCeremony = (name, opts) => {
        const s = createManualSession({
            levelSource: levelSourceB, staging: stagingOf(name), name: 'ceremony',
        });
        const held = collectRun(tape(name), levelSourceB).frames.map((f) => f.held);
        let approach = 0;
        // ⚠ The approach is the TAPE's, replayed through `heldFor` — which
        // outside a ceremony must hand the keys straight back. That is asserted
        // here rather than in a row of its own: if it did not, this drive would
        // never reach the pickup at all.
        while (!s.run.inCeremony && approach < held.length) {
            const want = held[approach] ?? new Set();
            const got = s.heldFor(want, opts);
            expect(got.auto).toBe(false);
            expect(got.held).toBe(want);
            s.step(got.held);
            approach += 1;
        }
        return { s, approach };
    };

    it('⛔ pressing NOTHING, the page pages the dialogue out — and the control arm does not',
        () => {
            const BUDGET = 400;
            // ── the treatment: auto-advance ON, the driver's hands off ──
            const on = driveToCeremony('r3-collect-sword', { autoAdvanceText: true });
            expect(on.s.run.inCeremony).toBe(true);
            let ticks = 0;
            while (on.s.run.inCeremony && ticks < BUDGET) {
                const { held } = on.s.heldFor(new Set(), { autoAdvanceText: true });
                on.s.step(held);
                ticks += 1;
            }
            expect(on.s.run.inCeremony).toBe(false);
            expect(on.s.autoText.ceremonies).toBe(1);
            expect(on.s.autoText.releases).toBeGreaterThan(0);
            // ⚠ THE PRESS-AFTER-CEREMONY HAZARD, COUNTED RATHER THAN ASSUMED
            // AWAY. A dialogue ends on a RELEASE, so the cadence should never
            // be mid-press when the freeze lifts — a release landing on a live
            // frame reaches `useItem(Main.primary)`, which is a swing at best
            // and a DASH at worst. Zero is the claim.
            expect(on.s.autoText.endedPressing).toBe(0);

            // ── the control: identical drive, switch OFF ────────────────
            const off = driveToCeremony('r3-collect-sword', { autoAdvanceText: false });
            expect(off.s.run.inCeremony).toBe(true);
            for (let i = 0; i < BUDGET; i += 1) {
                const { held, auto } = off.s.heldFor(new Set(), { autoAdvanceText: false });
                expect(auto).toBe(false);
                off.s.step(held);
            }
            // ⛔ THE DIFFERENTIAL: same room, same staging, same empty hands,
            // and the ceremony is STILL UP after the budget the other arm
            // finished inside. Without this the row would pass on an
            // auto-advance that did nothing at all.
            expect(off.s.run.inCeremony).toBe(true);
            expect(off.s.autoText.releases).toBe(0);
            expect(off.s.autoText.ceremonies).toBe(0);
        });

    it('⛓ the driven releases are RECORDED — the fold round-trips them', () => {
        const { s } = driveToCeremony('r3-collect-sword', { autoAdvanceText: true });
        let ticks = 0;
        while (s.run.inCeremony && ticks < 400) {
            const { held } = s.heldFor(new Set(), { autoAdvanceText: true });
            s.step(held);
            ticks += 1;
        }
        // ⛔ The keys the PAGE dispatched are in the tape, not merely in the
        // run: a producer that drove inputs it did not record would fold to a
        // tape that cannot reproduce the walk it came from.
        const primaries = s.perTick.filter((h) => h.has('primary')).length;
        expect(primaries).toBe(s.autoText.releases);
        const rt = foldRoundTrip(s, levelSourceB);
        expect(rt.ok).toBe(true);
    });

    /**
     * ⚠ THE FIRST CEREMONY TICK IS THE DRIVER'S, and it has to be.
     * `run.inCeremony` is read BEFORE `advance`, and the contact that starts a
     * ceremony happens INSIDE it — so the tick that walks onto the pickup
     * carries the walk's own keys, exactly as `runCollect`'s approach loop
     * leaves them. A `heldFor` that peeked forward would drop that step.
     */
    it('⚠ the tick that walks ONTO the pickup carries the driver\'s own keys', () => {
        const { s, approach } = driveToCeremony('r3-collect-sword', { autoAdvanceText: true });
        expect(approach).toBeGreaterThan(0);
        expect(s.autoText.ticks).toBe(0);
        expect(s.autoText.ceremonies).toBe(0);
        // the very next decision is the first auto one
        const first = s.heldFor(new Set(), { autoAdvanceText: true });
        expect(first.auto).toBe(true);
        expect(s.autoText.ceremonies).toBe(1);
    });
});
