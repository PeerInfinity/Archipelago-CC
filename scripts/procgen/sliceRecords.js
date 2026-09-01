/**
 * sliceRecords — **THE KICKOFF AS-BUILT §N IS THE RECORD; THE OTHER FOUR
 * SURFACES ARE FACT LINES DERIVED FROM IT AND FROM GIT** (R9 slice P4b,
 * ⚖ ruling 54 (8); user, 2026-08-28: *"I would like to implement one
 * recording surface if possible"*).
 *
 * ── ⛔⛔ THE DEFECT THIS CLOSES, MEASURED ─────────────────────────────
 *
 * A slice fold writes FIVE records by hand and nothing checks any of them
 * against the others or against git:
 *
 *   1. the kickoff as-built `## N. SLICE <id> AS-BUILT — … · <author>, <date>`
 *   2. the tracked doc `### R9 slice <id>: <title>` (a re-voicing for an
 *      outside reader — no SHAs)
 *   3. the queue `**⇒ <id> CLOSED (…)**` block
 *   4. memory: the R9 project file's close line + two `MEMORY.md` bullets
 *   5. the trap ladder
 *
 * ⛔ AND SURFACE 1 IS ALREADY WRONG AT THE HEAD THIS FILE WAS WRITTEN AT.
 * §51.21's WHAT LANDED table names ELEVEN commits, and `git merge-base
 * --is-ancestor` says NONE of them is on `main`: P4a's commits were rewritten
 * by `git filter-branch` after a push rejection (trap 921), the range was
 * re-sent to the orchestrator, and the as-built's own table was not. Eleven
 * rows against twelve commits. That is a hand-written fact about git that git
 * disagrees with, and it is exactly what a `--check` is for.
 *
 * ── ⛓ THE SHAPE, AND IT IS `generate-procgen-reference`'s ────────────
 *
 * ⛔ **THIS MODULE NEVER EDITS WHAT IT READS.** It parses §N, derives the same
 * facts from git, and where the two DISAGREE it records a FINDING — never a
 * fix. Same rule, same reason: the record is the record, and a tool that
 * silently corrected it would make the record say whatever the tool believes.
 *
 * ⛔ **AND IT EMITS NO TIMESTAMP.** A stamp would make every emission a diff.
 *
 * Every emitted field carries WHERE IT CAME FROM, because "the record knows
 * this" is a claim a reader is entitled to check:
 *
 *   `git`     derived by running git at `--head`. Nothing typed.
 *   `section` read out of §N's own text (a SHA table, a `**TRAPS a–b.**`
 *             line, the header's date).
 *   `both`    derived AND stated in §N, and they AGREE. A disagreement is a
 *             finding and the DERIVED value is the one emitted.
 *   `prose`   §N said it and nothing derives it (*"NO DEFAULT MOVED"* — there
 *             is no such thing as "a default" to git). Carried VERBATIM,
 *             never paraphrased, and marked, so a reader can see which half
 *             of a line a machine stands behind.
 *
 * ── ⛔ WHAT STAYS PROSE, AND WHY THAT IS NOT A GAP ───────────────────
 *
 * The queue BODY and the tracked-doc BODY are RE-VOICINGS FOR TWO DIFFERENT
 * READERS — the queue for the next orchestrator, the tracked doc for someone
 * outside this campaign who will never open the kickoff. Measured on 12j:
 * §50's title is *"ONE CONSTANT PER PERMISSION, A LOCK WHOSE POPULATION IS THE
 * MACHINE …"* and the tracked doc's is *"TWO CONSTANTS WHERE THERE WAS ONE,
 * AND A LOCK THAT NOW COVERS THE THING IT WAS BUILT FOR"*. Those are not two
 * spellings of one string; they are one fact told to two audiences. So the
 * TITLE of the tracked heading is prose too, and this module emits §N's title
 * as a DEFAULT its author is expected to re-voice. What is derived is the
 * heading's PREFIX (`### R9 slice <id>:`), which is the part every citation
 * and every gate resolves against.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');

/**
 * ⛓ THE TWO REPO-INTERNAL SURFACES, DECLARED — and each one CHECKED, so a
 * declaration that stops resolving is a hard error rather than a silently
 * empty answer.
 *
 * ⚖ 17 asks for derivation over a typed constant. There is nothing here to
 * derive FROM: the tracked doc is the procgen document ⚖ 22 binds, and the
 * queue is the one cross-arc handoff file. Both are single, both are named in
 * the rulings that created them, and `docsIndex.README_ORDER` independently
 * lists the tracked doc — which is the check.
 */
export const TRACKED_DOC = 'docs/json/developer/procgen/seedling-bot.md';
export const QUEUE_DOC = 'CC/docs/plans/fable-to-opus-handoff-2026-07.md';
/** ⛓ The artifact ⚖ 22 requires in the SAME commit as a procgen-doc edit. */
export const DOCS_INDEX = 'frontend/modules/procgenDocs/generated/docsIndex.js';
/** ⛓ The tape directory ⚖ 40's "NO TAPE MOVED" is a diff over. */
export const FIXTURES_DIR = 'frontend/modules/seedlingDemo/fixtures/';
/** ⛓ …and the standing values, which "ZERO VALUES MOVED" is a diff over. */
export const STANDING_VALUES = 'scripts/procgen/standing-values.json';

/**
 * ⛓⛓⛓ THE TRAP LADDER IS FROZEN, AND THE NUMBER IS DECLARED WITH ITS
 * PROVENANCE BECAUSE NOTHING IN THIS REPOSITORY CAN DERIVE IT.
 *
 * ⚖ 63 (e) (user, 2026-08-28, on being shown 758 KB / 9,627 lines / ~805
 * numbered entries / 653 → 907 in three weeks): *"How did the trap list grow
 * to 907 entries so quickly? Are there duplicates? Is it practical to refer to
 * a list that long?"* ⇒ freeze the ladder, one file per trap from here on,
 * every new trap names a family.
 *
 * The ladder lives in the MEMORY directory, which is OUTSIDE the repository
 * and invisible to CI. So the boundary is a literal here, WITH the sentence
 * why (⚖ 17's "only where nothing derives it"): P4a's tail measured at
 * `86f7974d7` was 921, so 921 is the last ladder number that will ever exist
 * and 922 is the first `traps/` file. ⛔ A citation `trap NNN` with NNN ≤ this
 * resolves in the ladder; above it, in `traps/`.
 */
export const LADDER_FROZEN_AT = 921;

/* ══════════════════════════════════════════════════════════════════════
 * WHERE THE MEMORY DIRECTORY IS — DERIVED, NOT TYPED
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ THE MEMORY DIRECTORY IS A PURE FUNCTION OF THE PRIMARY WORKTREE'S PATH,
 * so a session running in a `-wt-*` worktree still finds the ONE memory
 * directory rather than inventing a per-worktree one.
 *
 * The harness names a project's memory `~/.claude/projects/<path with every
 * `/` replaced by `-`>/memory`. ⛔ The path it uses is the PRIMARY tree's:
 * `git rev-parse --git-common-dir` points at `<primary>/.git` from inside any
 * linked worktree, which is the only spelling that survives a worktree.
 */
export function memoryDir({ repo = REPO, env = process.env } = {}) {
    if (env.CLAUDE_MEMORY_DIR) return env.CLAUDE_MEMORY_DIR;
    let primary = repo;
    try {
        const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
            { cwd: repo, encoding: 'utf8' }).trim();
        primary = common.replace(/\/\.git\/?$/, '');
    } catch { /* not a repo — fall back to the path we were given */ }
    return join(homedir(), '.claude', 'projects', primary.split('/').join('-'), 'memory');
}

export const LADDER_FILE = 'reference_seedling_arc_traps.md';
export const FAMILIES_FILE = 'reference_pitfall_families.md';
export const R9_FILE = 'project_seedling_bot_r9.md';
export const INDEX_FILE = 'MEMORY.md';
export const TRAPS_DIR = 'traps';

/* ══════════════════════════════════════════════════════════════════════
 * READING §N
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ THE HEADER, AND ITS SHAPE IS MEASURED OVER EVERY AS-BUILT IN THE FILE,
 * not over the one this slice happens to be writing.
 *
 *   `## 50. SLICE 12j AS-BUILT — ⛓⛓⛓ **TITLE** · Opus, 2026-08-28`
 *   `## 35. SLICE 12e′ RE-RUN AS-BUILT — …`      ← a HYPHENATED qualifier
 *   `## 42. SLICE 12e′ FOURTH RUN AS-BUILT — …`  ← a two-WORD qualifier
 *
 * ⛓ MEASURED OVER THE WHOLE KICKOFF: 44 as-built headers, and the first cut
 * refused THREE of them — §18, §22 and §23 — all for one reason, a TWO-DAY
 * date (`2026-08-21/22`). A refusal that names the line is how that was found
 * in one run; a parser that had defaulted the field would have emitted three
 * fact lines dated a day before the fold.
 *
 * ⛔⛔ AND THE SECTION NUMBER IS NOT AN INTEGER. Three folds live at `21b.`,
 * `23b.` and `23c.` — a fold inserted between two that were already written.
 * The gate found them by REPORTING that three tracked-doc headings had no
 * as-built section at all; they had one, numbered in a shape `\d+` could not
 * see. ⇒ `section` is a STRING everywhere, never a number.
 *
 * ⛔ The slice ID can carry a PRIME (`12e′`, U+2032) and the qualifier can be
 * absent, so neither is `\w+` and neither is optional-by-greed. A header this
 * does not match is a REFUSAL BY NAME — never a section parsed with empty
 * fields, which is how a fact line about nothing gets emitted.
 */
export const HEADER_RE =
    /^## (\d+[a-z]?)\. SLICE (\S+)(?: ([A-Z][A-Z -]*?))? AS-BUILT — (.*?) · ([^,]+), (\d{4}-\d{2}-\d{2}(?:\/\d{2})?)\s*$/;

/** ⛓ `⛓⛓⛓ **TITLE**` → `TITLE`. The decoration is the file's house style. */
export const bareTitle = (s) => s.replace(/^[⛓⛔⚠\s]+/, '').replace(/^\*\*|\*\*$/g, '').trim();

/** ⛓ A `**TRAPS 903–907.**` line — an EN DASH or a hyphen, and a single
 *  number is a range of one. Absent on §51, which is a finding, not a crash. */
const TRAPS_RE = /^\*\*TRAPS\s+(\d+)(?:\s*[–-]\s*(\d+))?\.?\*\*\s*$/;

/** ⛓ A short SHA in a markdown code span, which is the only spelling this
 *  file's tables and preambles use for a commit. */
const SHA_SPAN_RE = /`([0-9a-f]{7,40})`/g;

/** ⛓ A fast-forward range as the preambles spell it: `` `a..b` `` then
 *  `` `..c` `` for each later one, the base being carried forward. */
const FF_RE = /`([0-9a-f]{7,40})?\.\.([0-9a-f]{7,40})`/g;

/** ⛓ A ruling the section says it answered or discharged. */
const RULING_RE = /⚖\s*(\d+[a-z]?)\s*(?:\(([^)]*)\)\s*)?(ANSWERED|DISCHARGED|CLOSED)/g;
/** ⛓ …and a bare mention, for a section that names a ruling without a verdict. */
const RULING_MENTION_RE = /⚖\s*(\d+[a-z]?)\s*(?:\(([^)]{1,12})\))?/g;

/**
 * ⛓ A user quote, in the one spelling this campaign uses for them: italic
 * inside double quotes. ⛔ Quotes are carried VERBATIM and never paraphrased
 * — a re-voiced user ruling is a ruling nobody made.
 */
const QUOTE_RE = /\*"([^"]+)"\*/g;

/**
 * ⛓⛓ THE RULINGS A SECTION NAMES — **with a verdict where it states one, and
 * WITHOUT one where it does not.**
 *
 * ⛔ MEASURED ON §50: it names ⚖ 61 and ⚖ 62 and never writes ANSWERED or
 * DISCHARGED, while the hand-written queue header for the same slice says
 * *"⚖ 61 ANSWERED, ⚖ 62 DISCHARGED"*. A regex that only matched the verdict
 * form would have emitted an EMPTY ruling list and the calibration would have
 * read "the queue header has rulings, the record has none" as a tool bug. It
 * is not a tool bug: it is a fact the four surfaces disagree about, and the
 * finding says so instead of the parser hiding it.
 */
export function rulingsIn(text, opening = '') {
    const out = new Map();
    for (const m of text.matchAll(RULING_RE)) {
        out.set(m[1], { n: m[1], item: m[2] ?? null, verdict: m[3] });
    }
    for (const m of opening.matchAll(RULING_MENTION_RE)) {
        if (!out.has(m[1])) out.set(m[1], { n: m[1], item: m[2] ?? null, verdict: null });
    }
    return [...out.values()].sort((a, b) => Number.parseInt(a.n, 10) - Number.parseInt(b.n, 10));
}

/** The `## N.` .. next `## ` block, or `null` when there is no such section. */
export function sectionText(text, n) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l.startsWith(`## ${n}. `));
    if (start < 0) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
        if (/^## /.test(lines[i])) { end = i; break; }
    }
    return { text: lines.slice(start, end).join('\n'), line: start + 1 };
}

/**
 * Parse the as-built §N. ⛔ Every field that is not there comes back `null`
 * WITH a finding — a section is not required to carry a preamble (§51 does
 * not) and a missing field must be visible rather than defaulted.
 */
export function parseSection(text, n) {
    const found = sectionText(text, n);
    if (!found) throw new Error(`sliceRecords: no \`## ${n}. \` section in the kickoff`);
    const lines = found.text.split('\n');
    const header = HEADER_RE.exec(lines[0]);
    if (!header) {
        throw new Error(`sliceRecords: §${n}'s heading is not an as-built header — expected `
            + '`## N. SLICE <id> [QUALIFIER] AS-BUILT — <title> · <author>, <date>`, got '
            + `${JSON.stringify(lines[0])}`);
    }
    const [, section, slice, qualifier, rawTitle, author, date] = header;
    const findings = [];

    /* ── the preamble: the paragraph between the header and the first `###` ── */
    const firstSub = lines.findIndex((l) => /^### /.test(l));
    const preamble = lines.slice(1, firstSub < 0 ? lines.length : firstSub).join('\n').trim();
    const branch = (/[Bb]ranch `([^`]+)`/.exec(preamble) ?? [])[1] ?? null;
    if (!branch) findings.push(`§${section} states no \`Branch \`…\`\` in its preamble`);

    /* ── the fast-forward ranges, base carried forward as the preambles do ── */
    const ffRanges = [];
    let carried = null;
    for (const m of preamble.matchAll(FF_RE)) {
        const from = m[1] ?? carried;
        if (m[1]) carried = m[1];
        ffRanges.push({ from, to: m[2] });
    }

    /* ── the subsections ─────────────────────────────────────────────── */
    const subRe = new RegExp(`^### ${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`);
    const subsections = lines.filter((l) => subRe.test(l)).length;

    /* ── the traps line ──────────────────────────────────────────────── */
    let traps = null;
    for (const l of lines) {
        const m = TRAPS_RE.exec(l.trim());
        if (m) traps = { from: Number(m[1]), to: Number(m[2] ?? m[1]) };
    }
    if (!traps) findings.push(`§${section} carries no \`**TRAPS a–b.**\` line`);

    /* ── WHAT LANDED: the commit table, which is the SHA list git checks ── */
    /**
     * ⛓ A `\* pre-rebase SHAs` footnote makes every `*`-marked row a
     * DECLARED pre-rebase SHA. ⛔ Without the footnote a `*` means nothing and
     * the row is checked like any other.
     */
    const preRebaseFootnote = /^\\?\*\s*pre-rebase/m.test(found.text);
    const landed = landedIn(lines, section)
        .map((r) => ({ ...r, preRebase: Boolean(r.starred && preRebaseFootnote) }));
    if (!landed.length) findings.push(`§${section} has no WHAT LANDED table with \`sha\` rows`);

    /* ── the rulings and the user's own words ────────────────────────── */
    /**
     * ⛓ THE OPENING IS WHERE A SLICE NAMES ITS OWN RULINGS — the preamble, or
     * §N.0 when there is no preamble (§51 has none). ⛔ A bare `⚖ NN` mention
     * read over the WHOLE section pulls in every ruling the narrative cites in
     * passing: §50 mentions ⚖ 17, 22, 41, 46 and 52 as well as its own 61 and
     * 62, and a queue header naming all seven would be a header about the
     * campaign rather than about the slice.
     */
    const opening = preamble || lines.slice(firstSub < 0 ? lines.length : firstSub,
        lines.findIndex((l, i) => i > firstSub && /^### /.test(l)) + 1 || lines.length).join('\n');
    const rulings = rulingsIn(found.text, opening);
    if (rulings.length && rulings.every((r) => !r.verdict)) {
        findings.push(`§${section} names ${rulings.length} ruling(s) but states no verdict word `
            + '(ANSWERED / DISCHARGED / CLOSED) for any of them — the queue header\'s verdicts '
            + 'are then a fact the record does not carry');
    }
    /**
     * ⛓⛓ THE USER'S WORDS COME FROM THE OPENING, NOT FROM THE WHOLE SECTION.
     *
     * ⛔ MEASURED ON §50: `*"…"*` over the whole section returns six quotes,
     * and three of them are the slice quoting its OWN docblocks and a doc's
     * prose back at itself (*"the headline's first 410 ticks ARE
     * r8-solve-18's walk"*). A fact line that carried those as the user's
     * rulings would attribute a tool's sentence to a person. The opening is
     * where a slice states whose words it is acting on, and nowhere else is.
     */
    const seenQuote = new Set();
    const quotes = [...opening.matchAll(QUOTE_RE)]
        .map((m) => m[1].replace(/\s+/g, ' ').trim())
        .filter((q) => !seenQuote.has(q) && seenQuote.add(q));

    /** ⛓ `NEXT:` — the line that names the slice after this one. */
    const next = (/^\s*(?:⇒\s*)?\*{0,2}NEXT:?\*{0,2}\s*(.+?)\s*$/m.exec(found.text) ?? [])[1] ?? null;

    /**
     * ⛓ The preamble's ⛔ CLAIMS, carried VERBATIM. These are the sentences a
     * fact line re-voices and this module cannot derive (*"NO DEFAULT
     * MOVED"*): git has no notion of a default.
     */
    const claims = [...preamble.matchAll(/⛔\s*\*\*([^*]+)\*\*/g)]
        .map((m) => m[1].replace(/\s+/g, ' ').trim());

    return {
        /** ⛓ A STRING — three folds are numbered `21b`, `23b`, `23c`. */
        section,
        line: found.line,
        slice,
        qualifier: qualifier ? qualifier.trim() : null,
        title: bareTitle(rawTitle),
        author,
        date,
        subsections,
        preamble,
        branch,
        ffRanges,
        traps,
        landed,
        preRebaseFootnote,
        rulings,
        quotes,
        next,
        claims,
        findings,
    };
}

/**
 * ⛓⛓ THE COMMIT LIST COMES FROM THE `WHAT LANDED` TABLE, NOT FROM THE
 * PREAMBLE'S WORD-NUMBER.
 *
 * ⛔ The preamble says *"four commits, three fast-forwards"* — a number
 * SPELLED OUT, which no derivation can cross-check against anything. The
 * table names the SHAs, so the count is derived from the same rows git is
 * asked about and the two can actually disagree. That is the whole point:
 * §51's table has ELEVEN rows and twelve commits landed.
 */
export function landedIn(lines, section) {
    const esc = String(section).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const head = lines.findIndex((l) => new RegExp(`^### ${esc}\\..*WHAT LANDED`, 'i').test(l));
    if (head < 0) return [];
    const rows = [];
    for (let i = head + 1; i < lines.length; i += 1) {
        if (/^### /.test(lines[i])) break;
        const cells = lines[i].split('|').map((c) => c.trim());
        if (cells.length < 3) continue;
        const m = /^`?\*{0,2}`([0-9a-f]{7,40})`\*{0,2}\*?`?$/.exec(cells[1])
            ?? /`([0-9a-f]{7,40})`/.exec(cells[1]);
        if (m) {
            rows.push({
                sha: m[1],
                what: cells.slice(2).filter(Boolean).join(' | ').replace(/\s+/g, ' '),
                /**
                 * ⛓⛓⛓ **THE ROW ALREADY DECLARES WHEN IT IS NOT THIS REPO'S
                 * COMMIT, AND THE GATE MUST READ THAT RATHER THAN FAIL ON IT.**
                 * Measured over the kickoff: §46.7 names `` `~/CC/seedling`
                 * `d4f1f37` `` and `` submodule `7aaaa0a` `` — two commits in
                 * two OTHER repositories, each labelled in its own cell — and
                 * §49 marks five SHAs `*` under a footnote reading *"pre-rebase
                 * SHAs; the rebase onto `394ced764` was clean"*. A gate that
                 * failed on those would be reporting, as defects, two things
                 * the record states plainly. `gateRoster`'s own law, one file
                 * over: read the declaration.
                 */
                foreign: /(?:^|[\s`])(?:~\/|submodule\b|https?:)/.test(cells[1]) ? cells[1] : null,
                starred: /\*/.test(cells[1].replace(/\*\*/g, '')),
            });
        }
    }
    return rows;
}

/* ══════════════════════════════════════════════════════════════════════
 * DERIVING THE SAME FACTS FROM GIT
 * ══════════════════════════════════════════════════════════════════════ */

const git = (repo, args) => {
    try {
        return execFileSync('git', args,
            { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (e) {
        return { error: String(e.stderr ?? e.message ?? e).trim() };
    }
};
const ok = (v) => typeof v === 'string';

/* ══════════════════════════════════════════════════════════════════════
 * ⛔ CAN THIS CLONE BE ASKED THE QUESTION AT ALL?
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **A DEPTH-1 CHECKOUT CANNOT BE ASKED THE SLICE-RECORDS QUESTION, AND
 * MUST SAY SO INSTEAD OF ANSWERING A DIFFERENT ONE** (S4b (2), ⚖ 72; trap
 * 1058). The model is `check-seedling-full-tier-owed.mjs`, which refuses by
 * name when its baseline commit is not in the clone.
 *
 * ⛔ MEASURED, BOTH SIDES, at `e4bb64900`: `git clone --depth 1` of this
 * repository and `check-slice-records.mjs` in it reads **42 PASS / 24 FAIL**
 * — byte-for-byte the number CI has published at every head — against the
 * box's `73/0/37` at the SAME TREE. Every one of those 66 rows is about the
 * wrong commit:
 *
 *   · the convention's beginning is `min(commit date)` over the headings that
 *     have a queue block, and in a shallow clone `git log -S` resolves EVERY
 *     heading to the graft, i.e. HEAD — so the boundary IS the head under
 *     test, all 33 headings are "at or after" it, and the 24 that legitimately
 *     predate the convention fail;
 *   · ⚖ 22 then reads the graft's `--name-only`, which for a root commit is
 *     the WHOLE TREE — so every heading "carries the docsIndex regen" and 33
 *     rows pass for a reason that has nothing to do with their commits;
 *   · and the trap citations vanish entirely: `git show` of the graft exceeds
 *     the reader's buffer, so `trapsCitedIn` is handed an empty diff and the
 *     check contributes NO rows at all. A silent zero, in the one place this
 *     gate's docblock already refuses one.
 *
 * ⛓ S4's `@ci-shallow` declaration keeps the ROW honest — the bank never
 * quotes a depth-1 answer — and is NOT this. The two layers are both correct
 * and neither replaces the other: the declaration governs what the bank may
 * quote; this governs what the gate may say.
 *
 * ⛔ THE TEST IS THE CLONE'S OWN, not a symptom. `--is-shallow-repository` is
 * the one question whose answer names the cause; inferring shallowness from
 * "the boundary came out equal to HEAD" would be a detector that also fires on
 * a legitimate tree whose oldest block IS the head.
 *
 * @returns {{name: string, detail: string}|null} null when the clone carries
 *   the history — a refusal, with its reason, when it does not.
 */
export function shallowRefusal({ repo = REPO } = {}) {
    if (git(repo, ['rev-parse', '--is-shallow-repository']) !== 'true') return null;
    return {
        name: 'this is a SHALLOW CLONE and every verdict here is about history',
        detail: 'the convention\'s start commit is `min(commit date)` over the headings that '
            + 'have a queue block, and a depth-1 checkout\'s earliest commit is HEAD ITSELF — '
            + 'so the boundary collapses onto the head under test, ⚖ 22 reads the graft\'s '
            + 'whole-tree diff as every heading\'s introducing commit, and the trap citations '
            + 'read an empty diff. ⛓ Measured: `42/24` here against `73/0/37` at the SAME '
            + 'tree on a full clone. ⇒ clone with history (`fetch-depth: 0`) to ask it',
    };
}

/**
 * Everything git can answer about a fold, at `head`.
 *
 * ⛔ EVERY ANSWER IS A MEASUREMENT OR AN EXPLICIT `null`. A git call that
 * fails lands as `null` beside a finding naming the call — never as a zero,
 * because a quiet zero here is how "0 lines of fixture diff" gets published
 * about a range that does not exist.
 */
export function deriveFromGit(parsed, { repo = REPO, head = null } = {}) {
    const findings = [];
    const HEAD = head ?? (ok(git(repo, ['rev-parse', 'HEAD'])) ? git(repo, ['rev-parse', 'HEAD']) : null);
    const short = (s) => (s && ok(git(repo, ['rev-parse', `--short=9`, s]))
        ? git(repo, ['rev-parse', '--short=9', s]) : null);

    /* ── the landed SHAs: do they exist, and are they ON this head? ───── */
    const commits = parsed.landed.map(({ sha, what, foreign, preRebase }) => {
        const type = git(repo, ['cat-file', '-t', sha]);
        const exists = ok(type) && type === 'commit';
        let onHead = false;
        if (exists && HEAD) {
            try {
                execFileSync('git', ['merge-base', '--is-ancestor', sha, HEAD],
                    { cwd: repo, stdio: 'ignore' });
                onHead = true;
            } catch { onHead = false; }
        }
        return {
            sha, what, exists, onHead, foreign: foreign ?? null, preRebase: Boolean(preRebase),
            subject: exists ? git(repo, ['log', '-1', '--format=%s', sha]) : null,
        };
    });
    /** ⛔ A row the record DECLARES foreign or pre-rebase is not stranded. */
    const stranded = commits.filter((c) => !c.onHead && !c.foreign && !c.preRebase);
    const declared = commits.filter((c) => !c.onHead && (c.foreign || c.preRebase));
    if (stranded.length) {
        findings.push(`§${parsed.section}'s WHAT LANDED names ${stranded.length} commit(s) that are `
            + `NOT ancestors of ${HEAD ?? 'HEAD'}: ${stranded.map((c) => c.sha).join(', ')}`
            + `${stranded.every((c) => c.exists) ? ' (they exist as objects — a rewritten range, trap 921)' : ''}`);
    }

    /**
     * ⛓ THE RANGE BASE IS THE FIRST LANDED COMMIT'S PARENT, and the preamble's
     * own first fast-forward range is the CROSS-CHECK, not the source.
     */
    const first = commits.find((c) => c.exists && c.onHead);
    const base = first ? short(`${first.sha}^`) : null;
    const statedBase = parsed.ffRanges[0]?.from ? short(parsed.ffRanges[0].from) : null;
    if (base && statedBase && base !== statedBase) {
        findings.push(`§${parsed.section}'s first fast-forward starts at \`${statedBase}\` but the `
            + `first landed commit's parent is \`${base}\``);
    }

    const diffLines = (path) => {
        if (!base || !HEAD) return null;
        const out = git(repo, ['diff', '--numstat', base, HEAD, '--', path]);
        return ok(out) ? (out ? out.split('\n').length : 0) : null;
    };

    /* ── the two "nothing moved" claims, as line counts ──────────────── */
    const fixtures = diffLines(FIXTURES_DIR);
    const standingValues = diffLines(STANDING_VALUES);

    /* ── the tracked doc entry, and ⚖ 22 as an ASSERTION ─────────────── */
    const headingPrefix = `### R9 slice ${parsed.slice}:`;
    const docPath = join(repo, TRACKED_DOC);
    let tracked = { prefix: headingPrefix, line: null, heading: null, commit: null, docsIndexSameCommit: null };
    if (existsSync(docPath)) {
        const docLines = readFileSync(docPath, 'utf8').split('\n');
        const at = docLines.findIndex((l) => l.startsWith(headingPrefix));
        if (at >= 0) {
            tracked.line = at + 1;
            tracked.heading = docLines[at];
            const introduced = git(repo, ['log', '--format=%h', '-S', headingPrefix, '--', TRACKED_DOC]);
            const sha = ok(introduced) ? introduced.split('\n').filter(Boolean).pop() ?? null : null;
            tracked.commit = sha;
            if (sha) {
                const touched = git(repo, ['show', '--name-only', '--format=', sha]);
                tracked.docsIndexSameCommit = ok(touched) && touched.split('\n').includes(DOCS_INDEX);
                if (tracked.docsIndexSameCommit === false) {
                    findings.push(`⚖ 22: \`${headingPrefix}\` was introduced by \`${sha}\`, which does `
                        + `NOT carry \`${DOCS_INDEX}\` — the reference regen is owed IN THE SAME COMMIT`);
                }
            }
        } else {
            findings.push(`the tracked doc has no \`${headingPrefix}\` heading`);
        }
    }

    /* ── the queue block ─────────────────────────────────────────────── */
    const queuePrefix = `**⇒ ${parsed.slice} CLOSED`;
    const queuePath = join(repo, QUEUE_DOC);
    let queue = { prefix: queuePrefix, line: null };
    if (existsSync(queuePath)) {
        const qLines = readFileSync(queuePath, 'utf8').split('\n');
        const at = qLines.findIndex((l) => l.startsWith(queuePrefix));
        if (at >= 0) queue.line = at + 1;
        else findings.push(`the queue has no \`${queuePrefix}\` block`);
    }

    /* ── the tree, and whether this head is published ────────────────── */
    /**
     * ⛓⛓⛓ **PORCELAIN IS A PROPERTY OF THE WORKING TREE, NEVER OF `--head`**,
     * and calibrating against a PAST fold is exactly when that comes apart:
     * running this at `--head=1c47fff54` from a tree standing at `86f7974d7`
     * read `porcelain 2` and `origin == HEAD no`, both TRUE about the tree and
     * both saying nothing about the fold. ⛔ So the tree fields are reported
     * only when `--head` IS the working tree's head, and are `null` with a
     * named bound otherwise — never a number about the wrong subject.
     */
    const treeHead = git(repo, ['rev-parse', 'HEAD']);
    const atTree = ok(treeHead) && HEAD === treeHead;
    const porcelainOut = atTree ? git(repo, ['status', '--porcelain']) : null;
    const porcelain = ok(porcelainOut) ? (porcelainOut ? porcelainOut.split('\n').length : 0) : null;
    if (!atTree) {
        findings.push(`--head is \`${HEAD}\` but the working tree stands at \`${treeHead}\` — `
            + 'porcelain and the submodule pointers are NOT reported (they would be facts about '
            + 'the tree, not about this fold)');
    }
    /**
     * ⛓ **PUBLISHED, NOT `origin == HEAD`.** "Is this head on the remote" is
     * answerable at any head; "is it the tip" is only interesting at the tip.
     * Both are emitted, so a close line can say the strong thing and a
     * calibration against a past fold still gets a true answer.
     */
    const origin = git(repo, ['rev-parse', 'origin/main']);
    const isTip = ok(origin) && HEAD ? origin === HEAD : null;
    let published = null;
    if (ok(origin) && HEAD) {
        try {
            execFileSync('git', ['merge-base', '--is-ancestor', HEAD, origin],
                { cwd: repo, stdio: 'ignore' });
            published = true;
        } catch { published = false; }
    }

    /* ── the branch §N names: does it still exist, and is it merged? ─── */
    let branch = null;
    if (parsed.branch) {
        const resolved = git(repo, ['rev-parse', '--verify', `refs/heads/${parsed.branch}`]);
        branch = {
            name: parsed.branch,
            exists: ok(resolved),
            merged: ok(resolved) && HEAD
                ? (() => {
                    try {
                        execFileSync('git', ['merge-base', '--is-ancestor', resolved, HEAD],
                            { cwd: repo, stdio: 'ignore' });
                        return true;
                    } catch { return false; }
                })()
                : null,
        };
    }

    /* ── submodule pointers, as a one-line state ─────────────────────── */
    const subOut = atTree ? git(repo, ['submodule', 'status']) : null;
    const submodules = ok(subOut)
        ? subOut.split('\n').filter(Boolean).map((l) => ({
            dirty: /^[+U-]/.test(l), line: l.trim(),
        }))
        : null;
    const dirtySubs = submodules ? submodules.filter((s) => s.dirty).length : null;

    return {
        head: HEAD,
        headShort: short(HEAD),
        base,
        commits,
        stranded,
        declared,
        commitCount: commits.length,
        ffCount: parsed.ffRanges.length,
        fixtures,
        standingValues,
        tracked,
        queue,
        porcelain,
        atTree,
        isTip,
        published,
        branch,
        submodules,
        dirtySubs,
        findings,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE FOUR FACT LINES
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A field with its provenance — `git`, `section`, `both` or `prose`. */
const F = (from, value) => ({ from, value });

/**
 * The fields every fact line is built from, each carrying where it came from.
 * ⛔ ONE derivation, FOUR renderings — the surfaces cannot disagree because
 * there is nothing for them to disagree about.
 */
export function factFields(parsed, derived) {
    const trapsRange = parsed.traps
        ? (parsed.traps.from === parsed.traps.to
            ? String(parsed.traps.from)
            : `${parsed.traps.from}–${parsed.traps.to}`)
        : null;
    return {
        slice: F('section', parsed.slice),
        section: F('section', parsed.section),
        date: F('section', parsed.date),
        author: F('section', parsed.author),
        title: F('section', parsed.title),
        branch: F('section', parsed.branch),
        traps: F('section', trapsRange),
        head: F('git', derived.headShort ?? derived.head),
        base: F(parsed.ffRanges[0]?.from ? 'both' : 'git', derived.base),
        commits: F('both', derived.commitCount),
        ffCount: F('section', derived.ffCount),
        commitList: F('both', derived.commits.map((c) => `\`${c.sha}\` ${c.what}`).join(' · ')),
        fixtures: F('git', derived.fixtures),
        standingValues: F('git', derived.standingValues),
        porcelain: F('git', derived.porcelain),
        isTip: F('git', derived.isTip),
        published: F('git', derived.published),
        atTree: F('git', derived.atTree),
        trackedLine: F('git', derived.tracked.line),
        trackedCommit: F('git', derived.tracked.commit),
        docsIndexSameCommit: F('git', derived.tracked.docsIndexSameCommit),
        queueLine: F('git', derived.queue.line),
        rulings: F('section', parsed.rulings
            .map((r) => `⚖ ${r.n}${r.item ? ` (${r.item})` : ''}${r.verdict ? ` ${r.verdict}` : ''}`)
            .join(', ')),
        claims: F('prose', parsed.claims),
        next: F('section', parsed.next),
    };
}

const yn = (b) => (b === null ? '?' : (b ? 'yes' : 'NO'));

/**
 * ⛓⛓⛓ THE MEMORY CLOSE LINE — the slice's own entry in the R9 project file.
 *
 * The orchestrator's hand-written 12j close line (`project_seedling_bot_r9.md`
 * :2657) is ALREADY a fact checklist of the other four surfaces — §50's
 * subsection count, the tracked doc's line number, the traps range,
 * MEMORY.md's byte count, `origin == HEAD`, porcelain, fixtures lines. Every
 * one of those is derivable and every one of them was typed.
 */
export function memoryCloseLine(f, { session = null } = {}) {
    const parts = [
        `## ⇒ SLICE ${f.slice.value} CLOSED (${f.date.value}, ${f.author.value} session`
        + `${session ? ` \`${session}\`` : ' (unnamed)'}; as-built kickoff **§${f.section.value}**`
        + `${f.traps.value ? `; traps **${f.traps.value}**` : '; traps (none stated)'}).`,
        `\`main\` = **\`${f.head.value}\`**, ${f.commits.value} commit(s)`
        + `${f.ffCount.value ? ` in ${f.ffCount.value} ff merge(s)` : ''}`
        + `${f.commitList.value ? ` (${f.commitList.value})` : ''}.`,
        `⛔ \`fixtures/\` **${f.fixtures.value ?? '?'} line(s)** vs \`${f.base.value ?? '?'}\``
        + ` · \`standing-values.json\` **${f.standingValues.value ?? '?'} line(s)**`
        + ` · on \`origin/main\` **${yn(f.published.value)}**`
        + (f.atTree.value ? ` (== origin **${yn(f.isTip.value)}**) · porcelain **${f.porcelain.value ?? '?'}**.`
            : ' · porcelain not reported (the tree is not at this head).'),
        `Tracked doc \`### R9 slice ${f.slice.value}\` @${f.trackedLine.value ?? '—'}`
        + ` (introduced by \`${f.trackedCommit.value ?? '—'}\`, ⚖ 22 regen same commit:`
        + ` **${yn(f.docsIndexSameCommit.value)}**) · queue block @${f.queueLine.value ?? '—'}.`,
        f.claims.value.length ? `⛔ §${f.section.value} also claims: ${f.claims.value.map((c) => `**${c}**`).join(', ')}.` : null,
        f.next.value ? `NEXT: ${f.next.value}` : null,
    ];
    return parts.filter(Boolean).join(' ');
}

/**
 * ⛓ THE `MEMORY.md` R9 BULLET — a POINTER, and its spine is derived.
 *
 * ⛔ The body is PROSE and this emits §N's own title for it. MEMORY.md is a
 * ~24 KB index read into every session's context: what belongs in it is the
 * shortest thing that gets a reader to the record, which is the id, the
 * section, the head and where to read next.
 */
export function memoryIndexBullet(f) {
    return `- [**Seedling bot R9 — ${f.slice.value} CLOSED ${f.date.value}, as-built §${f.section.value}`
        + ` @\`${f.head.value}\`${f.traps.value ? `; traps ${f.traps.value}` : ''}: ${f.title.value}`
        + `**](${R9_FILE})${f.next.value ? ` — NEXT: ${f.next.value}` : ''}`;
}

/**
 * ⛓ THE `MEMORY.md` TRAP BULLET — *"tail N + recent ranges"*, derived from the
 * frozen ladder and the `traps/` directory rather than re-typed per slice.
 */
export function memoryTrapBullet(census) {
    const recent = census.recent.map((r) => `${r.slice} ${r.range}`).join(' · ');
    return `- [**Seedling-ladder traps — the ladder is FROZEN at ${LADDER_FROZEN_AT}; ${census.files}`
        + ` trap(s) from ${LADDER_FROZEN_AT + 1} live ONE PER FILE in \`${TRAPS_DIR}/\``
        + `**](${LADDER_FILE}) — ⛔ SEARCH both before calling a defect new;`
        + ` \`record-slice.mjs --trap=NNN\` resolves either place. Recent: ${recent || '(none yet)'}.`;
}

/**
 * ⛓ THE QUEUE HEADER LINE — the `**⇒ <id> CLOSED (…)**` opener above a
 * hand-written body. ⛔ The BODY is prose: the queue is written for the next
 * orchestrator and says what to do about the slice, which is not what the
 * as-built says about it.
 */
export function queueHeaderLine(f) {
    return `**⇒ ${f.slice.value} CLOSED (${f.date.value}, \`main\` @\`${f.head.value}\`;`
        + ` ${f.commits.value} commit(s)${f.ffCount.value ? `, ${f.ffCount.value} fast-forward(s)` : ''};`
        + ` as-built kickoff §${f.section.value}${f.rulings.value ? `; ${f.rulings.value}` : ''}).**`;
}

/**
 * ⛓ THE TRACKED-DOC HEADING — the PREFIX is derived and the TITLE is a
 * DEFAULT to be re-voiced. Measured on 12j: §50's title and the tracked doc's
 * are deliberately different sentences about one fact (see this file's
 * docblock). ⛔ So `--write` never places this one; the gate only asserts the
 * prefix resolves.
 */
export function trackedHeading(f) {
    return `### R9 slice ${f.slice.value}: ${f.title.value}`;
}

/** All four, in one object, with the shared field bag beside them. */
export function factLines(parsed, derived, opts = {}) {
    const f = factFields(parsed, derived);
    return {
        fields: f,
        memoryClose: memoryCloseLine(f, opts),
        memoryIndexBullet: memoryIndexBullet(f),
        queueHeader: queueHeaderLine(f),
        trackedHeading: trackedHeading(f),
    };
}
