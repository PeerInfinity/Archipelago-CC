/**
 * procgen/walkMoves — **WHICH COMMITTED WALKS TODAY'S SOLVER RE-SOLVES
 * DIFFERENTLY, MEASURED; AND THE LICENCE THAT MAY PERMIT THEM.**
 *
 * R9 slice 12c′, ⚖ ruling 43 (user, 2026-08-23: *"I want the pipeline to be
 * able to handle changes to existing tapes, not just adding new tapes. I
 * expect this won't be the only time…"*).
 *
 * ── ⛔ THE LAW THIS MODULE EXISTS TO KEEP ─────────────────────────────
 *
 * `rerecord-seedling-campaign.mjs`'s sealed table has always been a
 * PERMISSION, not a forecast (§18.4), and `walk-moves` was a STOP by design —
 * *"a walk move is the user's licence, never this pipeline's"*. That STOP was
 * enforced against a verdict **nothing measured**: S0 asserted no segment was
 * PREDICTED to move its walk, which is true of a prediction nobody made.
 *
 * ⇒ this measures it instead, and ⚖ ruling 17 says to measure it out of the
 * PRODUCERS: a producer's own `--check` re-solves every segment it owns from
 * that segment's committed boot, and `walkReport.js` makes it say so field by
 * field. **A walk move is an `inputs` move**, never a byte move — see that
 * module for why the distinction is the whole point.
 *
 * ── ⛔⛔ THREE FILTERS, AND EVERY ONE OF THEM IS NEGATIVE ──────────────
 *
 * "which producer owns this segment", "which producer may participate" and
 * "which segment moved" are all filters that answer by EXCLUDING, and a
 * negative filter that looks like precision is the shape traps 579/580 name.
 * So each one is calibrated against a KNOWN POSITIVE, in
 * `walkMoves.test.js`:
 *
 * 1. **OWNERSHIP IS THE PRODUCER'S OWN CLAIM.** The candidate set is
 *    NOMINATED by the segment tapes' `description` (which names its author),
 *    but the ANSWER is each producer's own walk report — the segments it
 *    actually emitted. ⛔ A description is what a tape SAYS ABOUT ITSELF:
 *    `r7-ends-meet-1` names no producer at all and yet
 *    `plan-seedling-r7-ends-meet.mjs:274` emits it. Trap 576 — ask what the
 *    derivation is a derivation OF.
 * 2. **PARTICIPATION IS THE PRODUCER'S OWN ARGV**, read out of the
 *    instruments scan the procgen reference already publishes rather than
 *    re-spelled here (⚖ ruling 38 (6)'s law, one directory over). A candidate
 *    that does not accept `--walk-report` cannot be measured — and when the
 *    same scan says it DRIVES A BROWSER, that mechanism is the reason
 *    printed, because S0 is offline by contract and §26.6's law says a scratch
 *    tree cannot run a browser stage at all.
 * 3. **EVERY CHAIN SEGMENT MUST BE ACCOUNTED FOR — in exactly one report, or
 *    in the named `unmeasured` list.** In neither is a STOP by name; in TWO is
 *    a STOP by name (trap 578: a producer owning N segments must yield N
 *    rows, and fewer is a STOP, never a zero).
 *
 * ── THE LICENCE ───────────────────────────────────────────────────────
 *
 * `--license-walks=<ruling-id>` turns the measured STOP into a permission for
 * EXACTLY the measured set. It is refused BY NAME without an id, it can never
 * WIDEN the set (the set IS the measurement, and a licence is checked against
 * it rather than consulted for it), and every successor of a moved walk
 * becomes `boot-only` automatically — its boot is its predecessor's latch and
 * the predecessor's walk just changed.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export class WalkMovesError extends Error {
    constructor(message) { super(message); this.name = 'WalkMovesError'; }
}
const fail = (m) => { throw new WalkMovesError(m); };

export const LICENSE_FLAG = '--license-walks';

/**
 * ⛔⛔ **THE PRODUCER'S OWN CHECK FLAG, AS A CONSTANT — AND THE REASON IS A
 * DEFECT THIS SLICE SHIPPED AND THEN CAUGHT.**
 *
 * `standingValues.producerScripts` decides what is "a producer with a
 * `--check`" by scanning every `solve-`/`plan-`/`rerecord-*.mjs` for the
 * LITERAL `'--check'` **anywhere in its text**. S0's walk measurement SHELLS
 * OUT to producers with that flag, so the moment the literal appeared inside
 * `rerecord-seedling-campaign.mjs` the standing-values row list grew a
 * `producer: rerecord-seedling-campaign --check` row — and that pipeline
 * IGNORES unknown flags, so the "check" ran **the whole S0..S5 pipeline**,
 * drove Windows Chrome, and would have baked a twenty-minute GPU row into the
 * baseline every slice re-measures.
 *
 * ⇒ the flag is named HERE, in a `.js` the producer regex does not match, and
 * the pipeline REFUSES `--check` by name (see its argv block) so the landmine
 * is loud rather than silent if anything re-arms it.
 *
 * ⚠ The deeper fix belongs to the instrument: "contains the string" is not
 * "reads it out of argv", and the instruments scan already answers the second
 * question correctly. Not changed here — it would move the row LIST, which is
 * the baseline ⚖ ruling 32 A makes the next slice's BEFORE.
 */
export const CHECK_FLAG = '--check';
/** The one verdict a licence covers. */
export const LICENSABLE = 'walk-moves';

/**
 * The producers a chain's segments NOMINATE — read out of each committed
 * tape's own `description`, which names the script that authored it.
 *
 * ⛔ THIS IS A NOMINATION, NOT AN ANSWER. It exists to keep the candidate set
 * finite and cheap (five producers rather than every instrument with a
 * `--check`); `reportRows` below takes the producers' own reports as the
 * ownership answer.
 *
 * @returns {Map<string, string[]>} producer file name -> the segments that
 *   nominated it, in chain order.
 */
export function nominateOwners(chains, { tapesDir } = {}) {
    if (!tapesDir) fail('nominateOwners: `tapesDir` is required');
    const out = new Map();
    for (const chain of chains) {
        for (const segment of chain.segments) {
            const path = join(tapesDir, `${segment}.json`);
            if (!existsSync(path)) continue;
            let desc = '';
            try { desc = JSON.parse(readFileSync(path, 'utf8')).description ?? ''; } catch { /* */ }
            for (const m of desc.matchAll(/scripts\/procgen\/([A-Za-z0-9._-]+\.mjs)/g)) {
                if (!out.has(m[1])) out.set(m[1], []);
                if (!out.get(m[1]).includes(segment)) out.get(m[1]).push(segment);
            }
        }
    }
    return out;
}

/**
 * May a nominated producer be MEASURED, and if not, why — in the producer's
 * own terms.
 *
 * @param {string[]} files nominated producer file names
 * @param {object[]} instrumentRows `buildInstruments().rows` — the scan the
 *   procgen reference publishes, not a second spelling of it.
 */
export function participationOf(files, { instrumentRows } = {}) {
    if (!Array.isArray(instrumentRows)) {
        fail('participationOf: needs `buildInstruments().rows` — the participation '
            + 'predicate is the instruments scan\'s own reading of each producer\'s argv, '
            + 'and a second spelling of it would decay separately');
    }
    const byFile = new Map(instrumentRows.map((r) => [r.file, r]));
    return files.map((file) => {
        const row = byFile.get(file) ?? null;
        const participates = (row?.flags ?? []).some((f) => f.name === 'walk-report');
        let why = null;
        if (!row) {
            why = `${file} is not in the instruments index at all, so nothing can be `
                + 'derived about the flags it reads';
        } else if (!participates) {
            why = row.browser
                ? `${file} DRIVES A BROWSER (the instruments scan reads a playwright `
                    + 'import in its own source), and S0 is offline by contract — §26.6\'s '
                    + 'law is that a scratch tree cannot run a browser stage at all, so a '
                    + 'measurement taken there would be about the wrong tree. It does not '
                    + `accept \`--walk-report\` and its segments cannot be licensed here`
                : `${file} does not accept \`--walk-report\`, so it cannot report which of `
                    + 'its walks moved';
        }
        return { file, participates, browser: row?.browser ?? null, why };
    });
}

/**
 * The per-segment rows, and the accounting that must balance.
 *
 * @param {object[]} reports each producer's own walk report (`walkReport.js`'s
 *   `{producer, segments}`)
 * @param {object[]} chains `[{id, segments}]`
 * @param {object[]} unmeasurable `participationOf` rows that cannot participate
 * @param {Map<string, string[]>} [nominations] `nominateOwners`' map, producer
 *   -> the segments that nominated it. ⛔ R9 12e′: WITHOUT it an unmeasured
 *   segment's `why` was every blocked producer's reason joined together, which
 *   is a TRUE sentence about the WRONG SUBJECT — `r8-solve-20` was told it was
 *   unmeasured because a producer it never nominated imports playwright. With
 *   it, a segment names only the producers IT nominated, and a segment that
 *   nominated nobody says that instead.
 * @returns {{rows, unmeasured, stops}}
 */
export function reportRows(reports, chains, unmeasurable = [], nominations = null) {
    const owner = new Map();
    const stops = [];
    for (const report of reports) {
        for (const s of report.segments ?? []) {
            if (owner.has(s.segment)) {
                stops.push(`${s.segment} is reported by TWO producers — `
                    + `${owner.get(s.segment).producer} and ${report.producer}. Ownership is `
                    + 'the producer\'s own claim, so two claims is a defect in the tree, not '
                    + 'a row to average');
                continue;
            }
            owner.set(s.segment, { ...s, producer: report.producer });
        }
    }
    const blocked = new Map();
    for (const u of unmeasurable) blocked.set(u.file, u.why);
    const rows = [];
    const unmeasured = [];
    for (const chain of chains) {
        for (const [index, segment] of chain.segments.entries()) {
            const hit = owner.get(segment);
            if (hit) {
                rows.push({ chain: chain.id, index, segment, ...hit });
                continue;
            }
            const mine = nominations
                ? [...nominations.entries()]
                    .filter(([file, segs]) => segs.includes(segment) && blocked.has(file))
                    .map(([file]) => blocked.get(file))
                : [...blocked.values()];
            const why = mine.length
                ? `no participating producer reported it — ${mine.join('; ')}`
                : 'no producer reported it, and no producer IT NOMINATED was blocked — so '
                    + 'nothing in this tree claims to author it';
            unmeasured.push({ chain: chain.id, index, segment, why });
        }
    }
    return { rows, unmeasured, stops };
}

/**
 * The segments a licence must cover: every `walk-moves` row, in chain order.
 */
export function movedSegments(rows) {
    return rows.filter((r) => r.verdict === LICENSABLE)
        .map((r) => ({ chain: r.chain, index: r.index, segment: r.segment,
            producer: r.producer, before: r.committedTicks, after: r.solvedTicks }));
}

/**
 * ⛓⛓ **THE CASCADE.** A moved walk ends somewhere new, so every SUCCESSOR in
 * its chain boots from a latch that has changed — `boot-only`, automatically
 * and without anybody typing a name.
 *
 * ⛔ IT IS THE FIRST MOVE THAT DECIDES, not each move: once segment `k` moves,
 * everything after it is downstream whether or not it moved too.
 *
 * @returns {Map<chainId, {firstMove: number, successors: string[]}>}
 */
export function cascadeFrom(chains, moved) {
    const first = new Map();
    for (const m of moved) {
        const at = first.get(m.chain);
        if (at === undefined || m.index < at) first.set(m.chain, m.index);
    }
    const out = new Map();
    for (const chain of chains) {
        const at = first.get(chain.id);
        if (at === undefined) continue;
        out.set(chain.id, {
            firstMove: at,
            firstMoveSegment: chain.segments[at],
            successors: chain.segments.slice(at + 1),
        });
    }
    return out;
}

/**
 * The licence, read off argv.
 *
 * ⛔ REFUSED BY NAME WITHOUT A RULING ID. The whole value of the flag is that
 * the sealed table can say WHOSE permission this was; a bare `--license-walks`
 * would write tapes under nobody's authority.
 *
 * @returns {?{ruling: string}} `null` when the flag is absent.
 */
export function licenceFrom(argv = process.argv) {
    const token = argv.find((a) => a === LICENSE_FLAG || a.startsWith(`${LICENSE_FLAG}=`));
    if (token === undefined) return null;
    const ruling = token === LICENSE_FLAG ? '' : token.slice(LICENSE_FLAG.length + 1).trim();
    if (ruling === '') {
        fail(`${LICENSE_FLAG} is REFUSED without a ruling id — \`${LICENSE_FLAG}=<ruling-id>\`. `
            + 'A walk move is the user\'s licence, never this pipeline\'s, so the table has '
            + 'to be able to say whose permission it was. Nothing is written.');
    }
    return { ruling };
}

/**
 * ⛓ THE LICENCE IS CHECKED AGAINST THE MEASUREMENT, NEVER CONSULTED FOR IT.
 * It can only ever say *"the measured set is permitted"* — it has no way to
 * name a segment, so it has no way to widen.
 *
 * @returns {{permitted: object[], stops: string[], sealed: ?object}}
 */
export function applyLicence(moved, licence) {
    if (moved.length === 0) {
        return {
            permitted: [],
            stops: [],
            sealed: licence
                ? { ruling: licence.ruling, segments: [], note: 'the licence was offered and '
                    + 'the measured set is EMPTY — nothing moved, so nothing was permitted' }
                : null,
        };
    }
    if (!licence) {
        return {
            permitted: [],
            sealed: null,
            stops: moved.map((m) => `${m.segment} RE-SOLVES DIFFERENTLY (${m.before} t `
                + `committed against ${m.after} t today) and no licence was given. A walk `
                + `move is the user's licence, never this pipeline's — re-run with `
                + `\`${LICENSE_FLAG}=<ruling-id>\` if it is permitted`),
        };
    }
    return {
        permitted: moved.slice(),
        stops: [],
        sealed: {
            ruling: licence.ruling,
            segments: moved.map((m) => ({ segment: m.segment, chain: m.chain,
                producer: m.producer, before: m.before, after: m.after })),
        },
    };
}
