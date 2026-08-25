/**
 * rerecordCampaign — the PURE HALF of `rerecord-seedling-campaign.mjs`.
 * ⚖ R9 ruling 21 (user, 2026-08-21), slice 9.
 *
 * Everything here is a function of DATA — a chain list, a tape, a `botSeam()`
 * envelope — so the pipeline's laws can be unit-rowed without a browser and
 * without a GPU. The `.mjs` beside it owns the process: the run directory, the
 * Windows driver, the stage flags.
 *
 * ⛔⛔⛔ THE LAW THIS MODULE EXISTS TO ENFORCE — **A SUCCESSOR'S BOOT IS BUILT
 * FROM THE ENVELOPE ALONE, NEVER MERGED OVER A COMMITTED BLOCK.** R9 slice 9's
 * defect hunt was sent looking for a merge that had kept a stale `rng` and
 * found that slice 6 had done no such thing — every one of the eleven cached
 * latches carries exactly its successor's committed seed, and the game
 * reproduces both today. But the SHAPE is still the one an authoring pass can
 * fail in silently, because a merge that keeps a committed field produces a
 * tape that parses, records and replays. So the shape is made impossible
 * rather than merely observed to be absent: `bootFromEnvelopeOnly` builds the
 * blocks from the envelope, REFUSES BY NAME on a field the envelope does not
 * carry, and takes the committed block only to DIFF against.
 */

import { createHash } from 'node:crypto';

/**
 * ⛔ A TRUE START IS DERIVED, NEVER NAMED. `botStart` applies a declared
 * stream only when it is non-zero and writes `Main.time` only for a non-zero
 * declaration, so a tape that declares neither is a tape that inherits the
 * page's own fresh boot — which is what "the game's own start" means. The
 * position is the fork's `new Game(0, 80, 128)`.
 *
 * @param {object} tape a PARSED tape
 */
export function isTrueStart(tape) {
    return tape.rng?.seed === 0 && (tape.seam === null || tape.seam === undefined);
}

/**
 * The chains this pipeline is the re-record pipeline FOR: a CUSTODY chain
 * (`kind` defaults to custody — a staged chain declares its boots and has no
 * custody to re-derive) of two or more segments whose FIRST segment is a true
 * start. ⛓ Derived from `PLAYTHROUGH_CHAINS`; nothing is typed, so a chain
 * added tomorrow is picked up or excluded by its own shape.
 *
 * @param {Array} chains `PLAYTHROUGH_CHAINS`
 * @param {function} tapeOf label -> parsed tape
 */
export function chainSubjects(chains, tapeOf) {
    return chains
        .filter((c) => (c.kind ?? 'custody') === 'custody' && (c.segments ?? []).length >= 2)
        .filter((c) => isTrueStart(tapeOf(c.segments[0])))
        .map((c) => ({ id: c.id, segments: c.segments.slice() }));
}

/**
 * ⛓⛓⛓ R9 SLICE 12e′ — **THE ACCOUNTING UNIVERSE, WHICH IS A DIFFERENT
 * QUESTION FROM THE SUBJECT, AND CONFLATING THEM LOST A REAL WALK MOVE.**
 *
 * `subjects()` answers *"whose BOOTS does this pipeline re-derive"* — and the
 * honest answer is "multi-segment chains", because a one-segment chain has no
 * boundary to author. S0's walk accounting was handed that same list and so
 * answered a question nobody asked: *"every chain segment is ACCOUNTED FOR"*
 * was total over the chains it ENUMERATED rather than over the chains that
 * EXIST. `r8-solve-11` lives in the one-segment chain `r8-battery-11`, its own
 * producer REPORTED it as a walk move, and `reportRows` dropped it on the
 * floor — in neither the table nor the named `unmeasured` list. Measured
 * 2026-08-25 (R9 §33): it re-solves 87 t -> 84 t under ⚖ ruling 46 and the
 * only thing that surfaced it was a producer's `--check` going red much later.
 *
 * ⇒ the universe is every chain's segments, DEDUPLICATED, because ten of the
 * twelve one-segment chains name a segment `r9-campaign` already carries and
 * a segment counted twice would break the arithmetic that makes the check
 * mean anything ("in exactly one report" cannot survive a duplicate subject).
 * The first chain to claim a segment keeps it, and multi-segment chains are
 * offered first so no existing row changes its `chain` label.
 *
 * ⛔ IT IS NOT A WIDER SUBJECT. Nothing here reaches S1's boundaries or S2's
 * writes; a one-segment chain still authors no boot. What it widens is who
 * gets NOMINATED, MEASURED and NAMED — so a walk move in one of them is a row
 * the licence can cover, and a segment nobody can measure is named with its
 * reason instead of vanishing.
 *
 * @param {Array} chains `PLAYTHROUGH_CHAINS`
 * @returns {Array<{id: string, segments: string[]}>}
 */
export function accountingUniverse(chains) {
    const claimed = new Set();
    const out = [];
    const inOrder = [
        ...chains.filter((c) => (c.segments ?? []).length >= 2),
        ...chains.filter((c) => (c.segments ?? []).length === 1),
    ];
    for (const c of inOrder) {
        const mine = (c.segments ?? []).filter((s) => !claimed.has(s));
        for (const s of mine) claimed.add(s);
        if (mine.length) out.push({ id: c.id, segments: mine });
    }
    return out;
}

/**
 * ⛔⛔ THE CACHE KEY IS THE **COMPLETE** BYTES DRIVEN, NOT THE GAME-VISIBLE
 * PROJECTION.
 *
 * `solve-seedling-r9-campaign.mjs`'s `latchOf` keys on
 * `gameVisibleTape(parseTape(t))` — the projection. That is honest for what it
 * measures (a latch is a pure function of what the GAME ran) and it is exactly
 * one field short of honest for what it CACHES: two different COMPLETE boots
 * can project to the same game-visible bytes, because `GAME_VISIBLE_DROPS`
 * removes `tick0` — and the tick-0 block is what a CONTINUATION window is
 * driven with. A cache keyed on the projection would hand a second complete
 * boot the first one's latch file.
 *
 * ⇒ this keys on the serialised COMPLETE tape. A projection-keyed cache can
 * only ever be too permissive; a complete-bytes one can only ever be too
 * strict, and too strict costs a GPU run rather than a wrong number.
 *
 * @param {object} completeTape the tape as it will be committed/driven, whole
 */
export function latchCacheKey(completeTape) {
    return createHash('md5').update(JSON.stringify(completeTape)).digest('hex').slice(0, 12);
}

/**
 * ⛔⛔⛔ THE PER-FIELD AUTHORING. `project` is `segmentBootFromLatch` (injected
 * so this module stays free of the browser tree and so a unit row can hand it
 * a stub). The returned blocks are the projection's, verbatim; `committed` is
 * read ONLY to produce `rows`.
 *
 * A field the envelope does not carry is a REFUSAL BY NAME — never a
 * carry-over from `committed`, which is the defect shape this whole pipeline
 * is built around.
 *
 * @returns {object} `{blocks, rows}` — `rows` is one entry per compared field:
 *   `{field, committed, measured, moved}`.
 */
export function bootFromEnvelopeOnly(envelope, committed, project) {
    const blocks = project(envelope);
    const rows = [];
    const walk = (prefix, measured, was) => {
        if (measured === null || measured === undefined
            || typeof measured !== 'object' || Array.isArray(measured)) {
            rows.push({
                field: prefix,
                committed: was === undefined ? null : was,
                measured: measured === undefined ? null : measured,
                moved: JSON.stringify(was ?? null) !== JSON.stringify(measured ?? null),
            });
            return;
        }
        for (const k of Object.keys(measured)) {
            walk(prefix ? `${prefix}.${k}` : k, measured[k],
                was === null || was === undefined ? undefined : was[k]);
        }
    };
    for (const block of Object.keys(blocks)) walk(block, blocks[block], committed?.[block]);
    /**
     * ⛔ AND THE COMMITTED SIDE IS WALKED TOO, so a field the committed tape
     * HAS and the measurement does NOT is a REFUSAL rather than a silent
     * survival. Without this the "no carry-over" law would be enforced only
     * for fields the envelope happened to produce.
     */
    const measuredFields = new Set(rows.map((r) => r.field));
    const missing = [];
    const walkCommitted = (prefix, was) => {
        if (was === null || was === undefined
            || typeof was !== 'object' || Array.isArray(was)) {
            if (!measuredFields.has(prefix)) missing.push(prefix);
            return;
        }
        for (const k of Object.keys(was)) walkCommitted(prefix ? `${prefix}.${k}` : k, was[k]);
    };
    for (const block of Object.keys(committed ?? {})) {
        walkCommitted(block, committed[block]);
    }
    if (missing.length) {
        throw new Error('⛔ the measurement does not carry '
            + `${missing.join(', ')}, which the committed block declares. A boot field `
            + 'the envelope cannot produce is a REFUSAL BY NAME — carrying the committed '
            + 'value forward is how a stale field survives a re-record (R9 slice 9).');
    }
    return { blocks, rows };
}

/**
 * ⛔⛔⛔ R9 SLICE 9's FINDING, AS A DERIVATION — **WHICH BOUNDARIES A
 * FRESH-PAGE LATCH CANNOT PREDICT.**
 *
 * `Bot.as:1587` applies a tape's declared persistence clears BEFORE the world
 * is built, and says why in its own comment: "applying a clear after the world
 * exists would leave the blocker standing for this visit". So for a window
 * that is a CONTINUATION — whose room the GAME built at the previous boundary
 * — a declared clear for that room lands too late and the body stands, while
 * the same tape on a FRESH page never spawns it at all.
 *
 * ⇒ a segment that (a) is not window 0 and (b) declares a TIMED (`at`) clear
 * for its OWN boot level walks two different streams on the two paths, and its
 * fresh-page latch is NOT the number the continuation will reach.
 *
 * ⛓ MEASURED, and the measurement is what narrows the rule: `r8-solve-5`
 * (L5, `{5,0}@427`) moves 514746467 -> 1196897329 between the two paths, while
 * `r8-solve-8` (L8, `{8,0}@246`, `{8,1}@645`) is INVARIANT. Both satisfy (a)
 * and (b), so the hazard is NECESSARY and NOT SUFFICIENT: the gated body must
 * also draw from the gameplay stream. This reports the hazard and says so.
 *
 * @param {object} tape a PARSED tape
 * @param {number} index the segment's 0-based position in its chain
 */
export function timedClearHazard(tape, index) {
    const timed = (tape.persistence ?? []).filter((c) => c.at !== undefined);
    const own = timed.filter((c) => c.level === tape.boot.level);
    return {
        timed: timed.map((c) => `${c.level}:${c.tag}@${c.at}`),
        ownRoom: own.map((c) => `${c.level}:${c.tag}`),
        // window 0 boots the page itself, so its declaration IS applied before
        // its own build on both paths — which is why `r8-d2` has always
        // admitted despite `r8-solve-18`'s `{18,0}@385`.
        atRisk: index > 0 && own.length > 0,
        why: index === 0
            ? 'window 0 is a FRESH boot on both paths — its own declaration is applied '
                + 'before its own build, so no clear can land late'
            : own.length === 0
                ? 'declares no timed clear for its own room'
                : `declares ${own.map((c) => `${c.level}:${c.tag}`).join(', ')} for its OWN `
                    + 'boot room and is a continuation window, so the clear lands AFTER '
                    + 'the game built that room and the body stands. NECESSARY, NOT '
                    + 'SUFFICIENT — the standing body must also draw from the gameplay '
                    + 'stream (measured: L5 does, L8 does not)',
    };
}

/**
 * ⛔⛔⛔ A PERSISTENCE ROW HAS A MEASURED HALF AND A MODEL HALF, AND ONLY ONE
 * OF THEM IS THE LATCH'S TO AUTHOR.
 *
 * `segmentBootFromLatch` reads `save.levelPersistence` and returns
 * `{level, tag}` — the SET of clears in force when the successor begins. That
 * is the measured half, and it is the whole boot state.
 *
 * The committed row can carry two more keys, and NEITHER is derivable from a
 * latch:
 *  · `note` — provenance prose a solver wrote (`r8-solve-8`'s two rows carry
 *    the binary search that measured them on the real GPU);
 *  · `at` — ⚖ ruling 14's TIMED clear, which is a statement about the
 *    successor's OWN walk. It is `GAME_VISIBLE_DROPS`'s first entry precisely
 *    because it is model-only, and a latch taken BEFORE that walk cannot see
 *    it: the flag is not set yet, so the measured set correctly omits it.
 *
 * ⇒ writing the measured set verbatim would DELETE both, silently — the
 * timed rows a walk depends on and the provenance of the numbers in them. This
 * merges: the measured set decides which untimed rows exist, the committed row
 * supplies `note`, and every committed TIMED row is re-appended because it was
 * never the latch's to drop.
 *
 * ⛔ AND IT REFUSES THE CONTRADICTION: a committed row carrying `at` that the
 * measurement says is ALREADY IN FORCE at boot is a tape claiming a clear is
 * both inherited and earned. Sorted the way `parsePersistence` sorts, so a
 * re-derivation that changed only ORDER is not a diff.
 *
 * @param {Array} measured `[{level, tag}]` from the latch
 * @param {Array} committed the successor's committed `persistence` block
 */
export function mergePersistence(measured, committed) {
    const key = (c) => `${c.level}:${c.tag}`;
    const was = new Map((committed ?? []).map((c) => [key(c), c]));
    const inForce = new Set((measured ?? []).map(key));
    const timed = (committed ?? []).filter((c) => c.at !== undefined);
    const clash = timed.filter((c) => inForce.has(key(c)));
    if (clash.length) {
        throw new Error('⛔ '
            + clash.map(key).join(', ')
            + ' is declared as a TIMED clear the walk earns AND is already in force in the '
            + 'measured boot state. A clear cannot be both inherited and earned; the tape\'s '
            + '`at` row or the predecessor\'s walk is wrong.');
    }
    const rows = (measured ?? []).map((c) => ({
        level: c.level,
        tag: c.tag,
        note: was.get(key(c))?.note ?? '',
    }));
    for (const c of timed) rows.push({ ...c });
    rows.sort((a, b) => a.level - b.level || a.tag - b.tag);
    return rows;
}
