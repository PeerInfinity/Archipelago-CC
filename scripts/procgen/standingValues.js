/**
 * standingValues — **THE ROWS EVERY HANDSHAKE, SEAL AND AS-BUILT RE-TYPES,
 * AND THE COMMANDS THAT MEASURE THEM** (R9 slice 12e, ⚖ ruling 38 item (5)).
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * ⚖ Ruling 32 A says a slice whose head EQUALS the commit a standing value was
 * taken at should QUOTE it rather than re-measure. That is right, and it made
 * every handshake a transcription of ~20 numbers — the producers' `--check`
 * md5s, each gate's `N/M`, vitest's files and tests, the roster — copied from
 * one prompt to the next by hand. They drift: slice 11b's own record carries
 * vitest as 10216 in one place and 10217 in another, and nothing on disk could
 * say which was the measurement.
 *
 * ⇒ the values live in `standing-values.json`, WRITTEN BY THE INSTRUMENTS THAT
 * MEASURE THEM. A slice's BEFORE is that file at its head; its AFTER is a
 * regeneration and a `git diff` of it.
 *
 * ── ⛔ EVERY ROW IS DERIVED. NONE IS TYPED ────────────────────────────
 *
 *   the identity rows   `reachClosure.identityRows()`, which reads
 *                       `identity-block.sh` — label, script AND the whole
 *                       `$( … )` body, because three rows run the SAME script
 *                       with different flags and the digest is the PIPE form.
 *   the producers       every `solve-`/`plan-`/`rerecord-*.mjs` that READS
 *                       `--check` (thirteen), each run with the command
 *                       template the identity block's own loop uses.
 *   the gates           `gateRoster.js` — the twenty-six `check-*.mjs`, with
 *                       the flags each one parses for itself.
 *   the suite           the unfiltered `npx vitest run`.
 *
 * ⛔⛔ `cheap` IS MEASURED, NOT DECLARED. `--write` times every row; `--check`
 * re-runs exactly the rows that came in under `CHEAP_MS` and QUOTES the rest
 * with the head they were taken at. A hand-kept "this one is fast" list is the
 * same defect as a hand-kept value: right until somebody makes a gate slower.
 */

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { LOCAL_HOST, PAGES_ORIGIN, REPO, argvFor, gateRoster } from './gateRoster.js';
import { identityProducerTemplate, identityRows, identityShellHelpers } from './reachClosure.js';

const run = promisify(execFile);

export const FILE = 'scripts/procgen/standing-values.json';
/** ⛓ Under a minute is what a slice can afford to re-run on every check. */
export const CHEAP_MS = 60000;

/**
 * ⛓⛓⛓ R9 P3b, ⚖ 54 (7)'s third item — **`cheap` IS A STATE WITH HYSTERESIS,
 * NOT A THRESHOLD** (trap 735; §44.11).
 *
 * ⛔⛔ THE EVIDENCE, MEASURED. `gate: seedling-editor-arm` sits **2.5 % over**
 * the band and has flapped across three writes — 57 502 -> 61 470 -> 56 475 ms
 * — with its VALUE unchanged at `226/0` every time. `identity: generated set`
 * went 62 298 -> 72 125. A row that close will cross for reasons that say
 * NOTHING about the tree (another session's browser sweep, a cold page cache),
 * and each crossing rewrites a field a reader takes as a fact about the gate.
 *
 * ⛓ SO: a row inside ±10 % of `CHEAP_MS` KEEPS the classification it already
 * had; only leaving the band changes it. ⛔ NOT a hand list of "these ones
 * flap" and NOT an `alwaysCheap` flag — both are the hand-kept list this file
 * exists to refuse (⚖ 17). The band is derived from the one constant, and the
 * rule is a pure function of `(ms, previousCheap)` so it can be rowed.
 *
 * ⛔ AND A FIRST MEASUREMENT HAS NO STATE TO KEEP. With `previousCheap`
 * `undefined` the answer is the plain threshold — hysteresis is a memory, and
 * a row nobody has measured has none.
 */
export const HYSTERESIS_FRACTION = 0.1;
export const CHEAP_BAND = Object.freeze({
    low: CHEAP_MS * (1 - HYSTERESIS_FRACTION),
    high: CHEAP_MS * (1 + HYSTERESIS_FRACTION),
});

/**
 * @param {number} ms                 what this run measured
 * @param {boolean|undefined} previousCheap what the file already says, if anything
 * @returns {{cheap: boolean, held: boolean}} `held` is true when hysteresis
 *   kept an answer the bare threshold would have flipped — the caller PRINTS
 *   it, because a held row must never be a silent one.
 */
export function cheapFor(ms, previousCheap) {
    const bare = ms < CHEAP_MS;
    if (ms < CHEAP_BAND.low) return { cheap: true, held: false };
    if (ms > CHEAP_BAND.high) return { cheap: false, held: false };
    if (typeof previousCheap !== 'boolean') return { cheap: bare, held: false };
    return { cheap: previousCheap, held: previousCheap !== bare };
}

/**
 * ── ⛓⛓⛓ THE COMPOSITE CHECKPOINT ROW (R9 slice CAT, ⚖ 69 (c) / ⚖ 70 (c)) ──
 *
 * `roster: --win --tier=full` is the one row no headless session can ever
 * re-run: 150 tapes driven through the real game on a Windows GPU. ⚖ 69 (a)
 * made it a COMPOSITE for the first time — part measured at L15's head, the
 * 120-tape complement quoted from an earlier same-build run — and stated that
 * composition in PROSE, in the row's own `why`. ⚖ 17 forbids reading prose as
 * data, and the owed gate says so on every run ("the row's own `why` is PROSE
 * and is NOT read here"), so the composition had nowhere to live that anything
 * could act on.
 *
 * ⇒ **The parts become DATA.** `row.categories` carries one entry per derived
 * category (`fixtures/tiers.js`), each with its own tape count, its own
 * measured value and — the field the owed gate actually needs — its own
 * `measuredAt`. The row's `value` and `why` are then DERIVED FROM THE PARTS on
 * every write and re-derived on every read, so a hand edit to either cannot
 * survive: the file says what the parts say or the check refuses BY NAME.
 *
 * ── ⛔ A PART MAY BE INHERITED, AND IT SAYS SO ────────────────────────
 *
 * A part whose category has never been driven ALONE has no separable value:
 * ⚖ 69 (a) banked the complement as ONE number over 120 tapes, and splitting
 * it by category after the fact would be inventing a measurement. So a part
 * may carry `value: null` with `coveredBy` naming the run that covers it. Such
 * a part still carries a true `measuredAt` — the head at which every tape in
 * the category was driven — which is all the debt question needs. The derived
 * value names those tapes rather than summing them, and the row becomes a pure
 * sum the first time each category is driven on its own.
 */

/** The one key the checkpoint row lives under, spelled once. */
export const ROSTER_ROW_KEY = 'roster: --win --tier=full';

/** `P/F/S` (skips optional), the form every differential value is quoted in. */
const COUNTS_RE = /^(\d+)\/(\d+)(?:\/(\d+))?$/;

/**
 * The parts of a composite row, in the categories' own order.
 *
 * ⛓ A row with no `categories` is NOT a composite and this returns `[]` —
 * every reader branches on that rather than on the row's key, so an ordinary
 * quoted row keeps working unchanged.
 */
export function compositeParts(row, categories) {
    if (!row?.categories) return [];
    const order = categories ?? Object.keys(row.categories);
    return order
        .filter((c) => row.categories[c])
        .map((c) => ({ category: c, ...row.categories[c] }));
}

/**
 * The row's `value`, DERIVED from its parts — never typed, never kept.
 *
 * Every part separable  ⇒ `150 tapes 3702/0/40`, a pure sum.
 * Any part inherited    ⇒ the sum of what is separable, then the inherited
 *                         tapes named with the head that covers them, so a
 *                         reader can never mistake the total for a number
 *                         somebody measured over the whole roster.
 */
export function compositeValue(row, categories) {
    const parts = compositeParts(row, categories);
    if (!parts.length) return row?.value ?? null;
    const tapes = parts.reduce((n, p) => n + (p.tapes ?? 0), 0);
    const separable = parts.filter((p) => COUNTS_RE.test(p.value ?? ''));
    const inherited = parts.filter((p) => !COUNTS_RE.test(p.value ?? ''));
    const sum = [0, 0, 0];
    for (const p of separable) {
        const m = COUNTS_RE.exec(p.value);
        sum[0] += Number(m[1]); sum[1] += Number(m[2]); sum[2] += Number(m[3] ?? 0);
    }
    const heads = [...new Set(inherited.map((p) => p.measuredAt))].join(' / ');
    if (!inherited.length) return `${tapes} tapes ${sum[0]}/${sum[1]}/${sum[2]}`;
    const carried = `${inherited.map((p) => `${p.category} ${p.tapes}`).join(' + ')} `
        + `@${heads}, not separately banked`;
    if (!separable.length) return `${tapes} tapes @${heads}, not separately banked by category`;
    return `${tapes} tapes: ${separable.map((p) => `${p.category} ${p.tapes} ${p.value} `
        + `@${p.measuredAt}`).join(' + ')} + ${carried}`;
}

/**
 * The row's `why`, DERIVED from its parts — ⚖ 17's whole point.
 *
 * ⛔ IT OVERWRITES A HAND EDIT. The previous shape of this row carried a
 * paragraph a human wrote and a human had to keep true; the owed gate then had
 * to say, on every run, that it refuses to read it. One line per part,
 * generated, is a `why` that cannot go stale — and a check that re-derives it
 * makes an edit to the file a NAMED failure instead of a quiet fiction.
 *
 * ⛓ A `coveredBy` shared by several parts is stated ONCE. Three copies of the
 * same sentence is how a reader learns to stop reading the field.
 */
export function compositeWhy(row, categories) {
    const parts = compositeParts(row, categories);
    if (!parts.length) return row?.why ?? null;
    const lines = parts.map((p) => (COUNTS_RE.test(p.value ?? '')
        ? `${p.category} ${p.tapes} tape(s) ${p.value} MEASURED @${p.measuredAt}`
        : `${p.category} ${p.tapes} tape(s) @${p.measuredAt}, not separately banked`));
    const covers = [...new Set(parts.map((p) => p.coveredBy).filter(Boolean))];
    return `DERIVED from the parts (⚖ 70 (c)) — ${lines.join(' · ')}. Each part carries its `
        + 'OWN head: a category is owed a drive when the tree moved under IT, not when the '
        + `tree moved at all.${covers.length
            ? ` ⛓ Carried by: ${covers.join(' ; ')}.` : ''}`;
}

/**
 * A composite row with one category's part replaced — the `--quote` path.
 *
 * ⛓ The row's `value` and `why` are re-derived here, so quoting a category
 * is the ONLY way either of them can change and neither can disagree with the
 * parts.
 */
export function withCategoryQuote(row, { category, tapes, value, measuredAt, coveredBy },
    { categories, isAncestor } = {}) {
    if (!category) throw new Error('withCategoryQuote: --category= is required');
    const next = {
        ...row,
        categories: {
            ...(row?.categories ?? {}),
            [category]: {
                tapes,
                value: value ?? null,
                measuredAt,
                ...(coveredBy ? { coveredBy } : {}),
            },
        },
    };
    next.value = compositeValue(next, categories);
    next.why = compositeWhy(next, categories);
    next.quoted = true;
    next.measuredAt = oldestPartHead(next, { categories, isAncestor }) ?? next.measuredAt;
    return next;
}

/**
 * ⛔ THE ROW'S OWN `measuredAt` IS THE OLDEST PART'S, and it has to be: a
 * consumer that knows nothing about categories — and there are several —
 * reads that field as "the head this value is about", and answering with the
 * NEWEST part would tell it the row is fresher than its oldest measurement.
 * The direction of error is the owed gate's own: a spurious re-measure over a
 * missed one.
 *
 * ⛓ ANCESTRY IS INJECTED, never guessed. Commit hashes do not order, so
 * "oldest" is `git merge-base --is-ancestor` and this module does not shell
 * out; the caller that has a repo passes the predicate, and a test passes a
 * stub. With no predicate the FIRST part's head is kept and nothing is
 * invented.
 */
export function oldestPartHead(row, { categories, isAncestor } = {}) {
    const heads = compositeParts(row, categories).map((p) => p.measuredAt).filter(Boolean);
    if (!heads.length) return null;
    if (!isAncestor) return heads[0];
    let oldest = heads[0];
    for (const h of heads.slice(1)) if (h !== oldest && isAncestor(h, oldest)) oldest = h;
    return oldest;
}

/** The head a measurement belongs to — a value without one cannot be reproduced. */
export function head({ repo = REPO } = {}) {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    } catch { return null; }
}

/**
 * ⛓ A producer is one that can DRIFT — the same rule `reachClosure.partition`
 * uses (`solve-`/`plan-`/`rerecord-` WITH a `--check`), applied to the whole
 * directory rather than to a reached set. A producer without a `--check` has
 * no committed artifact to disagree with and so has no standing value.
 */
export function producerScripts({ repo = REPO } = {}) {
    const dir = join(repo, 'scripts/procgen');
    return readdirSync(dir)
        .filter((f) => /^(?:solve|plan|rerecord)-[a-z0-9-]+\.mjs$/.test(f)).sort()
        .filter((f) => {
            const src = readFileSync(join(dir, f), 'utf8');
            return src.includes("'--check'") || src.includes('--check=')
                || src.includes('"--check"');
        });
}

/**
 * ⛓⛓⛓ R9 P3b (g), ⚖ 54 (7)'s sibling ruling ⚖ 54 (6) — **WHEN A ROW'S ANSWER
 * SHOULD COME FROM CI INSTEAD OF THE BOX.**
 *
 * ⛔⛔ THE RULING'S PREMISE, MEASURED. ⚖ 54 (6) reads *"more standing rows
 * quoted from CI by SHA (every headless gate; only Windows/GPU rows stay
 * local)"*, and the economy it reaches for is ⚖ 52's: stop spending the box on
 * something CI already ran. Measured against `gateRoster` at this tree the
 * headless population is **FOUR of thirty-one** (23 browser, 4 windows), and
 * their local cost is 0.4 s, 2 s, 7 s and 15 s — all far under the band. So
 * quoting them from CI would buy PROVENANCE, not economy, and would cost a
 * network call plus a red on every unpushed head.
 *
 * ⇒ THE RULE IS DERIVED FROM THE SAME TWO FACTS THE FILE ALREADY CARRIES:
 * **a gate row is CI-sourced exactly when it is HEADLESS and NOT `cheap`** —
 * i.e. when it is both answerable by CI and expensive enough that the box
 * should stop paying for it. That is ⚖ 52's own criterion (the unfiltered
 * suite is CI's because it costs ~8 minutes), generalised rather than narrowed.
 *
 * ⛓ AT THIS HEAD IT SELECTS ZERO ROWS, AND `--write` SAYS SO OUT LOUD —
 * "CI-sourced: 0 row(s)" is a STATED zero, not a silence. The mechanism is
 * armed for the day a headless gate crosses the band, which is the day the
 * ruling's economy becomes real.
 *
 * ⛔ NOT a hand list of "these ones come from CI" — that is the same defect as
 * a hand-kept value (⚖ 17), and this file exists to refuse it.
 *
 * ── ⛔⛔⛔ R9 P4b (D) — **A GATE THAT DECLARES A `@ci-face` IS MEASURED
 *    LOCALLY, BECAUSE ITS CI FACE ANSWERS A DIFFERENT QUESTION** ────────
 *
 * ⚖ 54 (6) and P3b (g) are both right and they do not compose. Measured at
 * `a61feaaec`, on the first row ever to select the CI path:
 *
 *   `gate: procgen-help` is HEADLESS and `cheap: false` (573 s), so this rule
 *   selects it. Its command then becomes `ci-summary --gate="gate:
 *   procgen-help"` — and `ci-summary` REFUSES BY NAME, because the gate
 *   declares `@ci-face gate-help-ci` and CI publishes `gate-help-ci:
 *   procgen-help` instead. The read returns `null`, `--write` KEEPS, and the
 *   row is frozen at whatever it last measured **forever**: the CI path can
 *   never answer it and the local path is never chosen again.
 *
 * ⛔ THE FACE IS NOT THE ROW. `@ci-face` exists precisely to say *"the number
 * CI can produce for me is a DIFFERENT CLAIM"* — `--doors=ci` is a bounded
 * subset of `--doors=all` — and it gives that claim its own key so the two can
 * never be read as one. A rule that then routes the STANDING key down the CI
 * path is asking for the value under the key its own declaration excluded.
 *
 * ⇒ **a gate with a declared ci-face is NEVER CI-sourced.** Its full pass is
 * the standing value, measured on the box; the ci-face is CI's own bounded
 * witness under its own key, and the row's `command` says which by naming the
 * gate rather than `ci-summary`. Nothing is hand-listed: the gate declares the
 * face, `gateRoster` reads it, and this rule consumes it.
 *
 * @param {{headless: boolean, cheap: boolean|undefined,
 *          ciFace: {prefix: string}|null|undefined}} o
 */
export function ciSourced({ headless, cheap, ciFace = null }) {
    if (ciFace) return false;
    return Boolean(headless) && cheap === false;
}

/** ⛓ The command that reads one gate's answer out of CI, one spelling. */
export const ciGateCommand = (key) =>
    `node scripts/procgen/ci-summary.mjs --gate=${JSON.stringify(key)} --json`;

/* ══════════════════════════════════════════════════════════════════════
 * THE ROWS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ ONE GATE'S ROWS — the base row, then one per SECOND ARM the gate's own
 * docblock declares (`@standing-variant`, read by `gateRoster`).
 *
 * ⚖ Editor v3 §27.8 Q6. `check-seedling-editor-generate.mjs` reads 224/0 under
 * `--host=` and 230/0 on its own server, because claim 4 (`?gen=`) has no
 * vehicle when the caller supplies the server. Both are correct readings of
 * two DIFFERENT COMMANDS, and before this the second one was a number handed
 * from prompt to prompt by hand.
 *
 * ⛔⛔ A VARIANT WHOSE COMMAND EQUALS THE BASE ROW'S IS REFUSED BY NAME. The
 * `seen` set in `standingRows` would drop it in SILENCE, and silence is the
 * wrong answer here: a gate that reads no `host` flag declaring `(none)` has
 * asked for a SECOND NAME FOR THE SAME MEASUREMENT — two standing rows that
 * can never disagree, which is a fixed point wearing a second key.
 */
export function gateStandingRows(gate, argv) {
    const name = gate.file.replace(/^check-/, '').replace(/\.mjs$/, '');
    const commandOf = (a) => `node ${gate.path}${a.length ? ` ${a.join(' ')}` : ''}`;
    const of = (key, a) => ({
        key, kind: 'gate', command: commandOf(a), browser: gate.browser, windows: gate.windows,
    });
    const base = of(`gate: ${name}`, argv);
    const rows = [base];
    for (const v of gate.variants ?? []) {
        const command = commandOf(v.argv);
        if (command === base.command) {
            throw new Error(`standingValues: ${gate.file} declares the variant `
                + `${JSON.stringify(v.label)}, but its command is the BASE ROW'S — `
                + `\`${command}\`. That is a second name for the same measurement, `
                + 'not a second arm.');
        }
        rows.push(of(`gate: ${name} (${v.label})`, v.argv));
    }
    return rows;
}

/**
 * Every standing row, with the command that measures it. ⛔ The KEY is stable
 * and human-quotable, because it is what a seal will name.
 */
export function standingRows({ repo = REPO, host = LOCAL_HOST, pages = PAGES_ORIGIN } = {}) {
    const rows = [];
    const seen = new Set();
    const push = (row) => {
        if (seen.has(row.command)) return;
        seen.add(row.command);
        rows.push(row);
    };

    for (const r of identityRows({ repo })) {
        if (!r.command) continue;
        push({ key: `identity: ${r.label}`, kind: 'identity', command: r.command, shell: true });
    }

    const template = identityProducerTemplate({ repo });
    if (template) {
        for (const f of producerScripts({ repo })) {
            const name = f.replace(/\.mjs$/, '');
            push({
                key: `producer: ${name} --check`,
                kind: 'identity',
                command: template.split('$p').join(name),
                shell: true,
            });
        }
    }

    for (const g of gateRoster({ repo })) {
        const argv = argvFor(g, 'local', { host, pages });
        if (argv === null) continue;
        for (const row of gateStandingRows(g, argv)) push(row);
    }

    /**
     * ⚖ R9 RULING 52 (user, 2026-08-25): **THE UNFILTERED SUITE IS NOT RUN
     * LOCALLY.** CI's `JavaScript Unit Tests` job runs the same unfiltered
     * `vitest run` on every pushed head and its log carries the same two
     * numbers to the digit (measured on four heads: `9fdd344e0` -> 353/11031,
     * `989d385ab` -> 353/11026, `1c8ca217d` -> 352/10951 — each equal to the
     * standing row a session had spent ~8 minutes measuring). So the row's
     * recipe is now "read CI's answer for this SHA", and `alwaysQuoted` keeps
     * `--check` from ever re-running it: a value that can only be produced by
     * a PUSH must not red a check on an unpushed head.
     */
    push({
        key: 'suite: vitest (unfiltered)',
        kind: 'ci-suite',
        command: 'node scripts/procgen/ci-vitest-summary.mjs --json',
        alwaysQuoted: true,
    });
    return rows;
}

/* ══════════════════════════════════════════════════════════════════════
 * RUNNING A ROW, AND READING ITS HEADLINE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ THE FIVE VERDICT FORMS THE GATES ACTUALLY PRINT — read out of their own
 * `console.log`s, not guessed (`gates.mjs` carries the same list and the same
 * reason: a guessed vocabulary turns a green gate red).
 */
const TOTAL_RE = /^(?:ALL CHECKS PASSED|ALL PASS\b.*|OK|\d+ (?:CHECK\(S\) FAILED|FAILURE\(S\)))$/;

/** vitest paints its summary; the digits are behind SGR escapes. */
const plain = (s) => s.replace(/\[[0-9;]*m/g, '');

/**
 * The HEADLINE of a row's output — one short string a human can compare.
 *
 * ⛔ PER KIND, because the kinds print different things and one regex over all
 * of them would be a fourth reader nobody could check:
 *   identity  the last non-empty line — an md5, or a gate's own status line.
 *   gate      `PASS/FAIL` counted off the gate's own `PASS:`/`FAIL:` prefixes,
 *             which is the form every standing value is already quoted in
 *             ("ship 254/0", "demos 204/0", "export 27/2").
 *   suite     `files/tests` off vitest's own summary block.
 */
export function headlineOf(kind, out) {
    const lines = plain(out).split('\n').map((l) => l.replace(/\r$/, ''));
    if (kind === 'gate') {
        const body = lines.join('\n');
        const pass = (body.match(/^PASS:/gm) ?? []).length;
        const fail = (body.match(/^FAIL:/gm) ?? []).length;
        const skip = (body.match(/^SKIP:/gm) ?? []).length;
        const total = lines.map((l) => l.trim()).reverse().find((l) => TOTAL_RE.test(l)) ?? null;
        return { value: `${pass}/${fail}${skip ? `/${skip}` : ''}`, total };
    }
    if (kind === 'suite') {
        const body = lines.join('\n');
        const files = (/Test Files\s+.*?\((\d+)\)/.exec(body) ?? [])[1];
        const tests = (/\bTests\s+.*?\((\d+)\)/.exec(body) ?? [])[1];
        return { value: files && tests ? `${files}/${tests}` : null, total: null };
    }
    /**
     * ⛓ R9 P3b (g) — a gate row whose answer came from CI. `ci-summary
     * --gate= --json` already read the line; this takes its `value` rather
     * than re-deriving a headline from prose, exactly as `ci-suite` does.
     */
    if (kind === 'ci-gate') {
        try {
            const j = JSON.parse(plain(out));
            return { value: j.value ?? null, total: j.total ?? null };
        } catch { return { value: null, total: null }; }
    }
    if (kind === 'ci-suite') {
        /**
         * `ci-vitest-summary.mjs --json` already did the reading — it parses
         * vitest's OWN summary lines out of the CI job log — so this reads its
         * `standingRow` rather than re-deriving `files/tests` from prose. A
         * non-zero exit prints a one-line reason on stderr and no JSON at all
         * (exit 2 no run for this SHA, 3 not concluded, 4 no summary in the
         * log), which lands here as a `null` value: the caller KEEPS the value
         * it had rather than blanking a standing number because a head is not
         * pushed yet.
         */
        try {
            const j = JSON.parse(plain(out));
            return { value: j.standingRow ?? null, total: j.conclusion ?? null };
        } catch { return { value: null, total: null }; }
    }
    const last = [...lines].reverse().find((l) => l.trim());
    return { value: last ? last.trim() : null, total: null };
}

/**
 * Run one row and read its value.
 *
 * ⛓ A `shell: true` row is one of `identity-block.sh`'s, and it is run WITH
 * that file's own helper definitions prepended — `m () { md5sum | cut -d' '
 * -f1; }` is the definition of what an identity value MEANS, and a copy of it
 * in JS would be a second spelling of it.
 *
 * ⛓ `${PIPESTATUS[0]}`, never `$?`: every identity row is a PIPELINE, so `$?`
 * is `md5sum`'s exit and would report success for a producer that threw.
 */
export async function runRow(row, { repo = REPO } = {}) {
    const t0 = process.hrtime.bigint();
    let out = '';
    let code = 0;
    const script = row.shell
        ? `${identityShellHelpers({ repo })}\n${row.command}\nexit "\${PIPESTATUS[0]}"`
        : row.command;
    try {
        const r = await run('bash', ['-c', script], { cwd: repo, maxBuffer: 1 << 27 });
        out = `${r.stdout}${r.stderr}`;
    } catch (e) {
        code = typeof e.code === 'number' ? e.code : 1;
        out = `${e.stdout ?? ''}${e.stderr ?? ''}` || String(e.message ?? e);
    }
    const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
    const { value, total } = headlineOf(row.kind, out);
    return { value, total, exit: code, ms };
}

/** The script a command names, so `--check` can refuse a RETIRED instrument. */
export const scriptIn = (command) => (/scripts\/procgen\/[A-Za-z0-9._-]+/.exec(command) ?? [])[0]
    ?? null;

/**
 * ⛔ A row whose command names an instrument that is NO LONGER ON DISK. Slice
 * 13 retired `plan-seedling-r7-act2.mjs`; a standing value whose command
 * cannot be run any more is not "unchanged", it is unmeasurable, and
 * `--check` says so BY NAME rather than carrying the last value forward.
 */
export function missingScript(command, { repo = REPO } = {}) {
    const s = scriptIn(command);
    return s && !existsSync(join(repo, s)) ? s : null;
}

export function readStandingValues({ repo = REPO } = {}) {
    const p = join(repo, FILE);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
