#!/usr/bin/env node
/**
 * check-slice-records — **A FOLD WHOSE SURFACES DISAGREE IS REFUSED** (R9
 * slice P4b, ⚖ ruling 54 (8)).
 *
 * ── ⛓ WHAT IT ASKS, AND OF WHAT ──────────────────────────────────────
 *
 * The tracked doc's `### R9 slice <id>:` headings are the ROSTER — one per
 * fold that reached an outside reader — and for each of them:
 *
 *   (1) THE QUEUE HAS A BLOCK.   `**⇒ … <id> … CLOSED|SHIPPED …**`. ⛔ The
 *       opener is NOT one spelling and this gate says so instead of failing
 *       on it: 12i and 12j wrote `**⇒ <id> CLOSED (`, P4a wrote
 *       `**⇒ SLICE P4a SHIPPED `. A detector keyed on either reds on the
 *       other, so membership is "an opener naming this id with a close word"
 *       and a non-conforming spelling is a NOTE, never a failure. New entries
 *       are DERIVED by `record-slice`, so the spread stops here.
 *
 *       ⛔⛔ **AND THE CONVENTION HAS A BEGINNING, WHICH IS DERIVED, NOT
 *       TYPED.** Measured at `a0065455e`: of the 28 headings on the roster,
 *       only FOUR have a `**⇒ ` block — the per-fold opener was adopted at
 *       P3b. The 24 before it are recorded in the queue in five other
 *       spellings (`⛓⛓⛓ **SLICE 12f CLOSED …**`, `**⇒ SESSION 8 (cont.): 12g
 *       ✓**`, a bullet inside a session block …), and a loose detector that
 *       found them ALSO matched five unrelated lines, because ids like `8`,
 *       `9` and `12` are substrings of ordinary prose.
 *
 *       ⇒ the boundary is the COMMIT DATE of the earliest heading that has a
 *       block, and a heading OLDER than that is SKIPped by name. A heading at
 *       or after it with no block FAILS. ⚠ THE HOLE, NAMED: deleting the
 *       EARLIEST block moves the boundary by one and forgives exactly that
 *       one fold. Every later fold still reds, which is the direction a live
 *       campaign fails in, and mutant (m1) drives it.
 *
 *   (2) ⚖ 22 IS AN ASSERTION, NOT A SENTENCE. The commit that INTRODUCED the
 *       heading (`git log -S`, the LAST one, i.e. the first in time) must also
 *       carry `frontend/modules/procgenDocs/generated/docsIndex.js`. The
 *       ruling has said "in the same commit" since slice 8; nothing has ever
 *       checked it against a heading.
 *
 *   (3) EVERY `trap NNN` CITED BY THAT COMMIT RESOLVES. Below the frozen
 *       ladder, in the ladder; above it, in `traps/`.
 *
 * ── ⛔⛔ THE BOUND, NAMED: WHAT CI CANNOT ASK ─────────────────────────
 *
 * The kickoff (`NewDocs/`, gitignored) and the memory directory (outside the
 * repository entirely) DO NOT EXIST in a CI checkout. So:
 *
 *   the CI FACE is (1), (2) and the BELOW-FREEZE half of (3) — all three
 *   repo-internal, all three real.
 *   `--local` adds the ABOVE-FREEZE half of (3) (it reads `traps/`) and, with
 *   `--kickoff=<path>`, the fourth check: every heading has an as-built §N
 *   whose WHAT LANDED SHAs are ancestors of HEAD.
 *
 * ⛔ An above-freeze citation in CI is REPORTED AS UNVERIFIABLE BY NAME and
 * never counted as a pass. A quiet skip here is how a citation to a trap
 * nobody wrote becomes green.
 *
 * ⛔ THIS GATE TAKES NO BOX. It reads files and runs `git log`; it drives no
 * browser and no GPU.
 *
 * ⛔⛔ **BUT `git log` IS EXACTLY WHAT A DEPTH-1 CHECKOUT DOES NOT HAVE**
 * (S4, ⚖ 72; trap 1058, measured at S3). The convention's BEGINNING is
 * derived from history — the commit date of the earliest heading that has a
 * block — and in a shallow clone the earliest commit this gate can see IS
 * HEAD. So every heading is "at or after" it, 24 rows fail, and CI publishes
 * `42/24` against a banked `73/0/37` at every head, naming a SHA that is
 * simply the head under test. ⛔ Green on the box at the same tree, which is
 * what makes it dangerous: the number is not a regression, it is an answer to
 * a different question.
 *
 * ⚠ THE DECLARATION IS NOT THE REPAIR, and S4b (2) owes the repair: a gate
 * that cannot ask its question must SAY SO — `check-seedling-full-tier-owed`
 * refuses by name in the same clone and is the model. What the declaration
 * does is keep this row out of the CI-sourced set for a reason that names
 * the cause, where before S4 the only thing excluding it was `cheap` (30.8 s,
 * and it grows with every recorded slice — a band it can cross).
 *
 * @ci-shallow the convention's start commit is derived from `git log`, and a depth-1 checkout's earliest commit is HEAD itself
 *
 * Run:
 *   node scripts/procgen/check-slice-records.mjs
 *   node scripts/procgen/check-slice-records.mjs --local
 *   node scripts/procgen/check-slice-records.mjs --local --kickoff=<path>
 *   node scripts/procgen/check-slice-records.mjs --memory=<dir>
 *   node scripts/procgen/check-slice-records.mjs --json
 *
 * ⛓⛓⛓ **THE BANK IS THIS ROW'S SUBJECT, SO THIS ROW DECLARES IT** (⚖ 72 (c),
 * R9 slice S1). `standing-values.json` was in the DERIVED `data` population of
 * 31 of 34 keyed rows — measured — so banking a write re-armed a near-full
 * re-drive; `rowInputKey.DERIVED_DATA_EXCLUDED` took it out of the derived
 * rules. But `sliceRecords.js` OPENS it (`STANDING_VALUES`, and a record
 * accounts for its line count), so its bytes really are an input HERE, and a
 * derivation-wide exclusion without this line would be exactly the stale green
 * that file's docblock exists to refuse.
 *
 * @key-inputs data: scripts/procgen/standing-values.json
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    DOCS_INDEX, LADDER_FROZEN_AT, QUEUE_DOC, REPO, TRACKED_DOC,
    deriveFromGit, memoryDir, parseSection,
} from './sliceRecords.js';
import { trapFiles, trapsCitedIn } from './sliceTraps.js';

argvHelp(import.meta.url);

/* The gate is a MODULE-SCOPE worker unless guarded: `check-procgen-help`'s
 * import door found it running the whole roster on a bare import (263/1 at
 * 4d8eeb6fa). Body left unindented — it holds multi-line template literals. */
async function main() {
const argv = process.argv.slice(2);
const arg = (n, fallback = null) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit === undefined ? fallback : hit.slice(n.length + 3);
};
const flag = (n) => argv.includes(`--${n}`);

const LOCAL = flag('local');
const JSON_OUT = flag('json');
const KICKOFF = arg('kickoff');
const MEMORY = arg('memory', memoryDir({ repo: REPO }));

const git = (args) => {
    try {
        return execFileSync('git', args,
            { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] })
            .trim();
    } catch { return null; }
};

/** ⛓ The heading form every citation and every gate resolves against. */
const HEADING_RE = /^### R9 slice (\S+?):/;
/** ⛓ A close word — the two spellings the queue actually holds. */
const CLOSE_RE = /\b(CLOSED|SHIPPED)\b/;
/** ⛓ The derived opener `record-slice` writes; anything else is a NOTE. */
const DERIVED_OPENER = (id) => `**⇒ ${id} CLOSED (`;


const rows = [];
const note = (m) => rows.push({ kind: 'NOTE', m });
const pass = (m) => rows.push({ kind: 'PASS', m });
const fail = (m) => rows.push({ kind: 'FAIL', m });
const skip = (m) => rows.push({ kind: 'SKIP', m });

/* ── the roster ──────────────────────────────────────────────────────── */

const docPath = join(REPO, TRACKED_DOC);
if (!existsSync(docPath)) {
    console.log(`FAIL: ${TRACKED_DOC} is not on disk — this gate has no roster`);
    console.log('1 CHECK(S) FAILED');
    process.exit(1);
}
const docLines = readFileSync(docPath, 'utf8').split('\n');
const slices = docLines.flatMap((l, i) => {
    const m = HEADING_RE.exec(l);
    return m ? [{ id: m[1], line: i + 1, heading: l }] : [];
});

const queueLines = existsSync(join(REPO, QUEUE_DOC))
    ? readFileSync(join(REPO, QUEUE_DOC), 'utf8').split('\n') : [];

/** ⛓ The trap numbers a `traps/` file holds — `null` when we cannot look. */
const localTraps = LOCAL
    ? new Set(trapFiles({ memory: MEMORY }).files.map((f) => f.number))
    : null;

/**
 * ⛓⛓⛓ **THE ID IS MATCHED IN THE OPENER'S SUBJECT POSITION, NOT ANYWHERE ON
 * THE LINE — and this gate destroyed itself on its own new entry to find out.**
 *
 * ⛔ MEASURED: the first block `record-slice` wrote reads `**⇒ P4b CLOSED (…;
 * as-built kickoff §52; ⚖ 54 (8) DISCHARGED …)**`. A detector that looked for
 * the id ANYWHERE on a `**⇒ ` line then found id `8` inside `⚖ 54 (8)` — so
 * slice 8 acquired a queue block, the derived convention boundary collapsed to
 * slice 8's commit date, and TWENTY-THREE folds that legitimately predate the
 * convention went red at once. A one-character id is a substring of every
 * parenthesised number a prose line carries.
 *
 * ⇒ the opener is `**⇒ ` then optionally `SLICE `, then the id AS A WORD —
 * which is exactly the two spellings the queue holds and exactly where a block
 * names its subject. ⛔ The prime is an id character (without it `12g` matches
 * inside `12g′`); a close word may then appear anywhere on the line.
 */
const idRe = (id) => new RegExp(
    `^\\*\\*⇒ (?:SLICE )?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9′″‴])`);

const queueAt = (id) => queueLines.findIndex((l) => idRe(id).test(l) && CLOSE_RE.test(l));

/** ⛓ The heading's introducing commit and ITS date, measured once per slice. */
for (const s of slices) {
    const introduced = git(['log', '--format=%h', '-S', `### R9 slice ${s.id}:`, '--', TRACKED_DOC]);
    s.sha = introduced ? introduced.split('\n').filter(Boolean).pop() ?? null : null;
    s.at = queueAt(s.id);
    s.when = s.sha ? Number(git(['log', '-1', '--format=%ct', s.sha])) : null;
}

/**
 * ⛓⛓⛓ THE CONVENTION'S BEGINNING, DERIVED: the earliest commit date among the
 * headings that DO have a `**⇒ ` block. ⛔ Never a typed slice id — that would
 * be exactly the hand-kept list ⚖ 17 refuses, and it would go stale the day
 * somebody back-fills an older fold's block.
 */
const withBlock = slices.filter((s) => s.at >= 0 && s.when);
const conventionFrom = withBlock.length ? Math.min(...withBlock.map((s) => s.when)) : null;
const conventionSlice = withBlock.find((s) => s.when === conventionFrom) ?? null;

for (const s of slices) {
    /* ── (1) the queue block ─────────────────────────────────────────── */
    if (s.at >= 0) {
        pass(`${s.id}: queue block at ${QUEUE_DOC}:${s.at + 1}`);
        if (!queueLines[s.at].startsWith(DERIVED_OPENER(s.id))) {
            note(`${s.id}: the queue opener is not the derived one `
                + `(\`${DERIVED_OPENER(s.id)}…\`) — historical spelling, not a defect`);
        }
    } else if (conventionFrom !== null && s.when !== null && s.when < conventionFrom) {
        skip(`${s.id}: no \`**⇒ \` queue block, and its heading PREDATES the convention `
            + `(which begins at ${conventionSlice.id}, \`${conventionSlice.sha}\`) — the queue `
            + 'records it in one of the older spellings; not claimed green');
    } else {
        fail(`${s.id}: the tracked doc has a heading at :${s.line} and the queue has NO `
            + `\`**⇒ \` block — it is at or after the convention's start`
            + `${conventionSlice ? ` (${conventionSlice.id}, \`${conventionSlice.sha}\`)` : ''}`);
    }

    /* ── (2) ⚖ 22: the regen in the SAME commit as the heading ───────── */
    const sha = s.sha;
    if (!sha) {
        skip(`${s.id}: no commit introduces its heading — a SHALLOW CLONE cannot answer ⚖ 22 `
            + '(trap 896: "cannot be asked" is not "is wrong")');
        continue;
    }
    const touched = (git(['show', '--name-only', '--format=', sha]) ?? '').split('\n');
    if (touched.includes(DOCS_INDEX)) {
        pass(`${s.id}: ⚖ 22 — \`${sha}\` carries the docsIndex regen`);
    } else {
        /**
         * ⛔⛔ **A RULE DOES NOT BIND THE COMMIT THAT CAUSED IT.** ⚖ 22 was
         * written FROM slice 8's CI red on `c4f7b21e4`, where the tracked doc
         * was committed and the index regenerated a commit later. So a
         * heading OLDER than the convention boundary whose regen was REPAIRED
         * by a later commit is a NOTE naming that repair — never a pass, and
         * never a red about a fold that predates the rule. At or after the
         * boundary it is a FAIL: that is the live enforcement, and mutant
         * (m2) drives it.
         */
        const repair = (git(['log', '--format=%h', '--reverse', '--ancestry-path',
            `${sha}..HEAD`, '--', DOCS_INDEX]) ?? '').split('\n').filter(Boolean)[0] ?? null;
        const historical = conventionFrom !== null && s.when !== null && s.when < conventionFrom;
        if (repair && historical) {
            note(`${s.id}: ⚖ 22 — \`${sha}\` does NOT carry ${DOCS_INDEX}; repaired by `
                + `\`${repair}\`. This heading PREDATES the convention boundary, and slice 8's `
                + '`c4f7b21e4` is the very event ⚖ 22 was written from — reported, not claimed green');
        } else {
            fail(`${s.id}: ⚖ 22 — \`${sha}\` introduced the heading and does NOT carry `
                + `${DOCS_INDEX}${repair ? ` (a later \`${repair}\` did, which is not the ruling)` : ''}`);
        }
    }

    /* ── (3) every trap that commit cites resolves ───────────────────── */
    const diff = git(['show', '--format=', '--unified=0', sha]) ?? '';
    for (const n of trapsCitedIn(diff)) {
        if (n <= LADDER_FROZEN_AT) {
            pass(`${s.id}: trap ${n} ≤ the frozen ladder (${LADDER_FROZEN_AT}) — the ladder holds it`);
        } else if (localTraps === null) {
            skip(`${s.id}: trap ${n} is ABOVE the freeze and \`traps/\` is outside the repository `
                + '— UNVERIFIABLE here; run with --local');
        } else if (localTraps.has(n)) {
            pass(`${s.id}: trap ${n} resolves to a \`traps/\` file`);
        } else {
            fail(`${s.id}: trap ${n} is cited by \`${sha}\` and NO file in \`traps/\` holds it`);
        }
    }
}

/* ── (4) --local --kickoff=: the record itself ───────────────────────── */

if (LOCAL && KICKOFF) {
    if (!existsSync(KICKOFF)) fail(`--kickoff=${KICKOFF} is not on disk`);
    else {
        const text = readFileSync(KICKOFF, 'utf8');
        const byId = new Map();
        for (const l of text.split('\n')) {
            const m = /^## (\d+[a-z]?)\. SLICE (\S+)(?: [A-Z][A-Z -]*?)? AS-BUILT — /.exec(l);
            if (m) byId.set(m[2], m[1]);
        }
        for (const s of slices) {
            const n = byId.get(s.id);
            if (n === undefined) {
                fail(`${s.id}: the tracked doc has a heading and the kickoff has NO `
                    + '`## N. SLICE <id> AS-BUILT` section — the RECORD is missing');
                continue;
            }
            const parsed = parseSection(text, n);
            const derived = deriveFromGit(parsed, { repo: REPO });
            /** ⛔ `derived.stranded` — the rows the record does NOT declare foreign
             *  or pre-rebase. `commits.filter(!onHead)` is the whole set and
             *  would report the declarations as defects. */
            const { stranded } = derived;
            if (derived.declared.length) {
                note(`${s.id}: §${n} DECLARES ${derived.declared.length} row(s) that are not this `
                    + `repository's commits (${derived.declared.map((c) => c.sha).join(', ')}) — `
                    + 'a foreign repo or a pre-rebase SHA, labelled in the record itself');
            }
            if (!parsed.landed.length) {
                note(`${s.id}: §${n} has no WHAT LANDED table — nothing to check against git`);
            } else if (stranded.length) {
                fail(`${s.id}: §${n}'s WHAT LANDED names ${stranded.length} of `
                    + `${derived.commitCount} commit(s) that are NOT on HEAD `
                    + `(${stranded.map((c) => c.sha).join(', ')})`);
            } else {
                pass(`${s.id}: §${n}'s ${derived.commitCount} landed commit(s) are all on HEAD`);
            }
        }
    }
}

/* ── the verdict ─────────────────────────────────────────────────────── */

const n = (k) => rows.filter((r) => r.kind === k).length;
if (JSON_OUT) {
    console.log(JSON.stringify({
        slices: slices.map((s) => s.id), local: LOCAL, rows,
        counts: { pass: n('PASS'), fail: n('FAIL'), skip: n('SKIP'), note: n('NOTE') },
    }, null, 2));
    process.exit(n('FAIL') ? 1 : 0);
}
for (const r of rows) console.log(`${r.kind}: ${r.m}`);
console.log('');
console.log(`## ${slices.length} slice(s) on the tracked-doc roster; the CI face is the queue `
    + `block, ⚖ 22 and the below-freeze citations. ${LOCAL ? '`--local`: `traps/` read from '
        + `\`${MEMORY}\`.` : 'The kickoff and the memory directory are NOT readable here.'}`);
console.log('');
if (n('FAIL') === 0) {
    console.log(`ALL PASS — ${n('PASS')} VERIFIED, ${n('SKIP')} UNVERIFIABLE (not claimed green)`
        + `${n('NOTE') ? `, ${n('NOTE')} NOTE(S)` : ''}`);
    process.exit(0);
}
console.log(`${n('FAIL')} CHECK(S) FAILED`);
process.exit(1);

}

if (isEntryPoint(import.meta.url)) await main();
