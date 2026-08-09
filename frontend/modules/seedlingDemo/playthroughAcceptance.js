/**
 * seedlingDemo/playthroughAcceptance — ENDS-MEET v2: the chain, checked.
 * R7 slice 2.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.1/§3.2, §7 G1.
 * Data: `playthroughWalk.js`. Signature and per-field derivation:
 * `r7Acceptance.js`.
 *
 * ── THE FOUR CLAIMS, AND WHY IT TAKES FOUR ────────────────────────────
 *
 * R1 asserted a partition: six tapes are the headline tick for tick, and
 * their tick counts sum to the headline's. That is unfakeable about the
 * PATH — a deleted or reordered segment cannot pass it — and it is silent
 * about everything else. R7 needs the chain to be a PLAYTHROUGH, so:
 *
 *  1. **ARITHMETIC.** The segment tick counts sum to the headline's, and
 *     each boundary tick is observed TWICE (as segment k's last and segment
 *     k+1's first) with the two observations agreeing. R1's claim, kept.
 *  2. **THE STREAM.** Segment k's observations are the headline's slice,
 *     tick for tick. R1's claim, kept.
 *  3. **THE SEAM.** `boot(k+1) == latch(k)` over the whole
 *     `SEAM_SIGNATURE` — the GAME's latch on one side, the successor tape's
 *     own eight blocks on the other. NEW, and it is the reason a chain of
 *     independently-booted tapes can be called one walk.
 *  4. **THE ENDING STATE.** The last segment's terminal latch equals the
 *     headline's, field by field. NEW, and it is the claim that closes the
 *     loop: two runs that walked the same path and ended in different
 *     states did not do the same thing.
 *
 * Plus the custody base case — segment 1 boots the TRUE INITIAL STATE and
 * inherits nothing — because a chain whose first segment starts from a
 * staged grant is a chain that proves nothing about the ones after it.
 *
 * ── ⛔ EVERY FAMILY IS A `.map()` OVER A LIST ─────────────────────────
 *
 * Trap 119, fourth and fifth instances. The seam rows come from
 * `seamFindings`, which maps `SEAM_SIGNATURE`; the ending-state rows map it
 * here; the per-segment rows map the chain's own `segments`. There is no
 * hand-written row for any signature field or any segment anywhere in this
 * file, so a field or a segment added tomorrow cannot go unreported.
 *
 * ── ⚠ A MISSING TAPE IS A NAMED SKIP, NEVER A SILENCE ─────────────────
 *
 * `--tier=fast` and `--only` both narrow the roster, and R1 paid for
 * learning that a narrowed sweep which returns NO findings prints "ALL
 * CHECKS PASSED" without ever mentioning that the chain was not looked at.
 * Every claim below either runs or says why it did not.
 */

import {
    SEAM_SIGNATURE, seamBootFields, seamExitFields, seamFindings, seamLatchFindings,
} from './r7Acceptance.js';
import { PLAYTHROUGH_CHAINS, TRUE_INITIAL_BOOT } from './playthroughWalk.js';

/**
 * Two LATCHES compared field by field — the ending-state claim, and the
 * shape a seam probe reports.
 *
 * ⛔ NOT `seamFindings`, and the difference is which two things are being
 * compared. `seamFindings` is a latch against a TAPE (a measured state
 * against a declaration, where a declaration may legitimately be absent).
 * This is a latch against a LATCH — two measured states, where an absence
 * on either side is a defect in the readout and never a design choice.
 *
 * `declared-not-compared` rows are reported and not compared, for the
 * reason `r7Acceptance`'s `fp.seed` branch gives: a seam duplicates one
 * level BUILD, so the successor's FlashPunk LCG is that build's FP draws
 * ahead — and nothing in this game reads it.
 */
export function latchAgreementFindings(label, a, b, labels = ['A', 'B']) {
    const out = SEAM_SIGNATURE.map((row) => {
        const name = `${label}: ${row.field}`;
        if (row.comparable === 'excluded') {
            return { name, ok: true, detail: `EXCLUDED — ${row.why.split('.')[0]}` };
        }
        const hasA = a && Object.prototype.hasOwnProperty.call(a, row.field);
        const hasB = b && Object.prototype.hasOwnProperty.call(b, row.field);
        if (!hasA || !hasB) {
            return {
                name,
                ok: false,
                detail: `UNCLAIMED — ${!hasA && !hasB ? 'neither latch carries it'
                    : `the ${!hasA ? labels[0] : labels[1]} latch does not carry it`}`
                    + ` (${row.comparable}; ${row.cite})`,
            };
        }
        // ⛔ The qualifier is read off the FIRST latch — both sides are
        // measured states here, and a qualifier that disagreed between them
        // would already be a red row of its own (`static.Rng.split` is an
        // equality field).
        if (row.qualifier && a[row.qualifier] === false) {
            return {
                name,
                ok: true,
                detail: `N/A — ${row.qualifier} is false, so this field is not part of `
                    + `the state (${labels[0]} ${JSON.stringify(a[row.field])}, `
                    + `${labels[1]} ${JSON.stringify(b[row.field])})`,
            };
        }
        if (row.comparable === 'declared-not-compared') {
            return {
                name,
                ok: true,
                detail: `DECLARED, NOT COMPARED — ${labels[0]} `
                    + `${JSON.stringify(a[row.field])}, ${labels[1]} `
                    + `${JSON.stringify(b[row.field])}. ${row.why.split('⛓')[1]
                        ? 'No consumer in this game reads it.' : ''}`,
            };
        }
        const sa = JSON.stringify(a[row.field]);
        const sb = JSON.stringify(b[row.field]);
        return {
            name,
            ok: sa === sb,
            detail: sa === sb ? `${row.comparable}: ${sa}`
                : `${labels[0]} ${sa} vs ${labels[1]} ${sb}`,
        };
    });
    return out;
}

/**
 * One chain's findings. `replayed` is `name -> {stream, status, seam}` and
 * `tapes` is `name -> parsed tape`.
 *
 * ⚠ `seam` MUST be carried through by the caller. The differential reads
 * `botSeam()` once per tape and used to drop it on the floor when it
 * populated `replayed`; without it every seam row here reads UNCLAIMED,
 * which is correct behaviour and a useless run.
 */
export function chainFindings(chain, tapes, replayed) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const missing = [...chain.segments, chain.headline]
        .filter((n) => !replayed.has(n));
    if (missing.length) {
        add(`chain ${chain.id}: SKIPPED — this sweep did not replay `
            + `${missing.join(', ')}`, true,
        `the chain needs all ${chain.segments.length} segment(s) and its headline; `
            + 'run --tier=full or --only with every name');
        found[found.length - 1].skipped = true;
        return found;
    }

    const seg = (n) => replayed.get(n);
    const tape = (n) => tapes.get(n);
    const headline = seg(chain.headline);

    // ── 0. THE CUSTODY BASE CASE ──────────────────────────────────────
    // ⛔ A chain whose first segment inherits a staged state proves nothing
    // about the segments after it. The first segment boots the game's own
    // boot (`Main.as:50-51`) and declares NO seam block — there is no
    // predecessor to inherit from, and saying so is the base case of the
    // induction the rest of this function is.
    const first = tape(chain.segments[0]);
    const bootsInitial = first.boot.level === TRUE_INITIAL_BOOT.level
        && first.boot.x === TRUE_INITIAL_BOOT.x && first.boot.y === TRUE_INITIAL_BOOT.y;
    add(`chain ${chain.id}: segment 1 boots the TRUE INITIAL STATE and inherits nothing`,
        bootsInitial && first.seam === null
        && first.save.keys.length === 0 && first.save.totem_parts.length === 0
        && first.save.seal_parts.length === 0 && first.grants.length === 0
        && first.persistence.length === 0,
        `boot ${JSON.stringify(first.boot)} (want ${JSON.stringify(TRUE_INITIAL_BOOT)}), `
        + `seam ${first.seam === null ? 'none' : JSON.stringify(first.seam)}, `
        + `${first.grants.length} grant(s), ${first.persistence.length} clear(s), `
        + `save {keys: ${first.save.keys.length}, totem: ${first.save.totem_parts.length}, `
        + `seals: ${first.save.seal_parts.length}}`);

    // ── 1. THE ARITHMETIC — R1's claim, kept ──────────────────────────
    const sum = chain.segments.reduce((n, name) => n + tape(name).tick_count, 0);
    add(`chain ${chain.id}: the segment tick counts sum to the headline's`,
        sum === tape(chain.headline).tick_count,
        `${chain.segments.map((n) => tape(n).tick_count).join(' + ')} = ${sum}; `
        + `${chain.headline} is ${tape(chain.headline).tick_count}`);

    // ── 2/3. PER SEGMENT: the stream slice, the calm arrival, the seam ─
    let offset = 0;
    chain.segments.forEach((name, i) => {
        const here = seg(name);
        const t = tape(name);

        // 2. the stream slice, tick for tick
        const want = headline.stream.ticks.filter(
            (o) => o.t >= offset && o.t <= offset + t.tick_count);
        const got = here.stream.ticks;
        let firstDiff = -1;
        for (let k = 0; k < Math.max(want.length, got.length); k += 1) {
            const a = want[k];
            const b = got[k];
            if (!a || !b || a.t - offset !== b.t || a.x !== b.x || a.y !== b.y
                || a.level !== b.level) { firstDiff = k; break; }
        }
        add(`chain ${chain.id}: ${name} is the headline's ticks `
            + `${offset}..${offset + t.tick_count}, tick for tick`,
        firstDiff === -1 && want.length === got.length,
        firstDiff === -1 && want.length === got.length
            ? `${got.length} observations`
            : `${want.length} expected vs ${got.length} observed; first difference at `
                + `index ${firstDiff}: headline ${JSON.stringify(want[firstDiff])} vs `
                + `segment ${JSON.stringify(got[firstDiff])}`);

        // ⛔ 3a. THE CALM ARRIVAL, REQUIRED. This is what `requireCalm: true`
        // means and where it lives: the roster runs it FALSE because no
        // committed fixture ends at an arrival, and a segment claims one by
        // construction. The six invariants are already written and already
        // mutation-tested — consumed here, not restated.
        const calm = seamLatchFindings(here.seam ?? null, { requireCalm: true });
        const notCalm = calm.filter((r) => !r.ok);
        add(`chain ${chain.id}: ${name} ends at a CALM ARRIVAL`,
            notCalm.length === 0,
            notCalm.length === 0
                ? `${calm.length - 1} signature rows latched at tick `
                    + `${here.seam?.seam?.['latch.tick']}`
                : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));

        // 3b. the seam itself, and the boundary tick observed twice
        const nextName = chain.segments[i + 1];
        if (nextName) {
            // ⛓ R7 slice 2b: `seamExitFields`, NOT `here.seam?.seam`. Four
            // rows are PRE-BUILD and their exit reading is the arrival
            // world's `Game.begin()`-ENTRY latch; the rest are the terminal
            // one. Handing the raw terminal block here is what made the seam
            // compare a declaration against a number one whole build later.
            const rows = seamFindings([{
                name: `${name}->${nextName}`,
                exit: seamExitFields(here.seam),
                boot: seamBootFields(tape(nextName)),
            }]);
            const bad = rows.filter((r) => !r.ok);
            add(`chain ${chain.id}: ⛓ THE SEAM ${name} -> ${nextName} is GREEN over the `
                + 'whole signature',
            bad.length === 0,
            bad.length === 0 ? `${rows.length - 1} signature rows compared`
                : `${bad.length} row(s): `
                    + bad.map((r) => `${r.name} [${r.detail}]`).join('; '));

            // ⚠ THE BOUNDARY TICK IS OBSERVED TWICE, and the two must agree.
            // Segment k's last observation and segment k+1's tick 0 are the
            // same instant of the same walk seen from two different boots —
            // which is exactly why the tick counts SUM to the headline's
            // rather than overshooting by one per seam.
            const last = got[got.length - 1];
            const nextFirst = seg(nextName).stream.ticks[0];
            add(`chain ${chain.id}: the boundary tick is observed twice and agrees`,
                Boolean(last) && Boolean(nextFirst) && last.level === nextFirst.level
                && last.x === nextFirst.x && last.y === nextFirst.y,
                `${name} ends ${JSON.stringify(last)}; ${nextName} starts `
                + `${JSON.stringify(nextFirst)}`);
        }
        offset += t.tick_count;
    });

    // ── 4. THE ENDING STATE — EQUAL, on all 46 rows ───────────────────
    // ⛓ The claim that makes the other three add up to a playthrough. Two
    // runs that walked the same path and ended in different states did not
    // do the same thing, and nothing above would have said so.
    //
    // ⛔⛔ AND IT IS AN EQUALITY AGAIN. Slice 2 could not make it one: the
    // boot side declared a PRE-build stream position while the latch read a
    // POST-build one, so a segmented chain ended exactly one level build
    // away from its headline (1562 draws and 21 dead frames for L94,
    // measured with zero residue). That was bridged by asserting the ENDING
    // state OFFSET by the seam level's own build cost —
    // `PLAYTHROUGH_CHAINS[].seamBuildCost` plus two `⚖ the seam costs
    // EXACTLY…` rows here — an approved bridge with a scheduled deletion.
    //
    // R7 slice 2b's begin()-ENTRY latch made the declaration and the latch
    // the same instant, so the successor's own build consumes the same 1562
    // draws and the chain lands where the headline lands. THE BRIDGE IS
    // DELETED, NOT REWORKED (kickoff §10.1 step 4), and it is deleted
    // DELIBERATELY: everything here stays green with a stale declaration in
    // place, which is exactly trap 119's shape — a number that is no longer
    // measuring anything, still passing.
    const lastSeg = seg(chain.segments[chain.segments.length - 1]);
    const agree = latchAgreementFindings(
        `chain ${chain.id} ending state`,
        headline.seam?.seam, lastSeg.seam?.seam, ['headline', 'chain']);
    const disagree = agree.filter((r) => !r.ok);
    add(`chain ${chain.id}: ⛓ THE ENDING STATE — the chain ends where the headline ends, `
        + 'field by field, with NO offset declared anywhere',
    disagree.length === 0,
    disagree.length === 0 ? `${agree.length} signature rows agree`
        : `${disagree.length} row(s) DIFFER: `
            + disagree.map((r) => `${r.name} [${r.detail}]`).join('; '));

    // ── 5. THE FREE ORACLE, when the sweep has it ─────────────────────
    if (chain.freeOracle && replayed.has(chain.freeOracle)) {
        const oracle = seg(chain.freeOracle);
        const n = Math.min(headline.stream.ticks.length, oracle.stream.ticks.length);
        let diff = -1;
        for (let k = 0; k < n; k += 1) {
            const a = headline.stream.ticks[k];
            const b = oracle.stream.ticks[k];
            if (a.t !== b.t || a.x !== b.x || a.y !== b.y || a.level !== b.level) {
                diff = k; break;
            }
        }
        add(`chain ${chain.id}: the headline reproduces the FROZEN ${chain.freeOracle} `
            + `over its first ${n} observations`,
        diff === -1,
        diff === -1
            ? `${n} observations identical — the chain's pins are observation-inert, `
                + 'which is why a frozen R1 fixture can stand as its oracle'
            : `first difference at index ${diff}: `
                + `${JSON.stringify(headline.stream.ticks[diff])} vs `
                + `${JSON.stringify(oracle.stream.ticks[diff])} — a FINDING about the `
                + 'pins, not a failure of the chain');
    } else if (chain.freeOracle) {
        add(`chain ${chain.id}: the free oracle ${chain.freeOracle} was NOT replayed`,
            true, 'run --tier=full or add it to --only to get the comparison for free');
        found[found.length - 1].skipped = true;
    }
    return found;
}

/** Every chain, or a named SKIP. */
export function playthroughAcceptanceFindings(tapes, replayed) {
    return PLAYTHROUGH_CHAINS.flatMap((chain) => chainFindings(chain, tapes, replayed));
}
