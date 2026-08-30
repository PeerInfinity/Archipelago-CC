/**
 * sliceRecords — **THE FOUR SURFACES ARE ONE DERIVATION** (R9 slice P4b,
 * ⚖ ruling 54 (8)).
 *
 * ⛓ THE FIXTURE IS A SYNTHETIC `## 99.` SECTION IN A TEMP FILE, never the
 * real kickoff: the kickoff is gitignored, is not in a linked worktree at
 * all, and is the very artifact these rows must not depend on the current
 * state of. What the REAL kickoff is for is the CALIBRATION, which lives in
 * `record-slice.mjs --calibrate` and is a run, not a row.
 *
 * ⛔ THE COUNTS HERE ARE INTERPOLATED FROM THE FIXTURE, NEVER TYPED — a typed
 * cardinality in a test name reds the label lint by itself (trap 902).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { afterAll, describe, expect, it } from 'vitest';

import {
    HEADER_RE, LADDER_FROZEN_AT, bareTitle, deriveFromGit, factLines, landedIn, memoryDir,
    parseSection, rulingsIn, sectionText, REPO,
} from './sliceRecords.js';
import { insertionPoint, replaceRegion } from './record-slice.mjs';

const DIR = mkdtempSync(join(tmpdir(), 'slice-records-'));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

/**
 * ⛓⛓ A THROWAWAY REPOSITORY WITH THREE COMMITS, NOT THIS REPOSITORY'S LAST
 * TWO. The first cut read `git log -2` off the real tree: green here, and
 * **7 rows red in CI** at d61ee802e, because `actions/checkout` clones at
 * depth 1 — the parent of HEAD, `merge-base --is-ancestor`, and the
 * `fixtures/` numstat against the range base cannot be asked of a shallow
 * clone (trap 896's shape: "cannot be asked" read as "is wrong"). A history
 * the test BUILDS is one it can always ask; the real tree's history is not a
 * fixture. `TREPO` answers the git rows; `REPO` still answers `memoryDir`.
 */
const TREPO = join(DIR, 'repo');
const tgit = (...args) => execFileSync('git', args, {
    cwd: TREPO, encoding: 'utf8', env: {
        ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    },
}).trim();
mkdirSync(TREPO);
tgit('init', '-q', '-b', 'main');
const tcommit = (rel, body, msg) => {
    mkdirSync(join(TREPO, dirname(rel)), { recursive: true });
    writeFileSync(join(TREPO, rel), body);
    tgit('add', rel);
    tgit('commit', '-q', '-m', msg);
    return tgit('rev-parse', '--short=9', 'HEAD');
};
tcommit('README', 'base\n', 'the base');
const PREV_SHA = tcommit('frontend/modules/seedlingDemo/fixtures/tapes/x.json', '1\n2\n', 'the first thing');
const HEAD_SHA = tcommit('frontend/modules/seedlingDemo/fixtures/tapes/x.json', '1\n2\n3\n', 'the second thing');
/** ⛓ …and one that is not a commit at all, for the "stranded SHA" row. */
const GHOST = 'deadbee12';

const FIXTURE = `# a kickoff

## 98. SOMETHING ELSE

filler

## 99. SLICE X9 SECOND RUN AS-BUILT — ⛓⛓⛓ **A FIXTURE TITLE, IN CAPITALS** · Opus, 2026-08-28

**Branch \`r9/fixture-branch\`, two commits, one fast-forward:
\`${PREV_SHA}..${HEAD_SHA}\`.** ⚖ 99 (i) *"a thing the user said"*.
⛔ **NOTHING MOVED**

### 99.0 THE HEADLINE

A paragraph. It quotes *"a sentence that is not the user's"* and cites ⚖ 17.

### 99.1 WHAT LANDED

| commit | what |
|---|---|
| \`${PREV_SHA}\` | the first thing |
| \`${HEAD_SHA}\` | the second thing |
| \`${GHOST}\` | a row about a commit that is not on this head |

**TRAPS 922–924.**

NEXT: the slice after this one

## 100. AFTER
`;
const FIXTURE_PATH = join(DIR, 'fixture-kickoff.md');
writeFileSync(FIXTURE_PATH, FIXTURE);

const parsed = parseSection(FIXTURE, 99);
const derived = deriveFromGit(parsed, { repo: TREPO, head: HEAD_SHA });
const lines = factLines(parsed, derived, { session: 'a-session-name' });

describe('⛓ §N is READ, and every field says where it came from', () => {
    it('the header yields id, qualifier, title, author and date', () => {
        expect(parsed.slice).toBe('X9');
        expect(parsed.qualifier).toBe('SECOND RUN');
        expect(parsed.title).toBe('A FIXTURE TITLE, IN CAPITALS');
        expect(parsed.author).toBe('Opus');
        expect(parsed.date).toBe('2026-08-28');
    });

    it('a section whose heading is not an as-built header is REFUSED BY NAME', () => {
        expect(() => parseSection(FIXTURE, 98)).toThrow(/not an as-built header/);
    });

    it('a section that is not there is REFUSED BY NAME, never an empty parse', () => {
        expect(() => parseSection(FIXTURE, 97)).toThrow(/no `## 97\. ` section/);
    });

    it('the section stops at the next `## `', () => {
        const t = sectionText(FIXTURE, 99);
        expect(t.text).toContain('WHAT LANDED');
        expect(t.text).not.toContain('## 100. AFTER');
    });

    it('the subsection count is the `### N.x` headings, interpolated from the fixture', () => {
        expect(parsed.subsections).toBe((FIXTURE.match(/^### 99\./gm) ?? []).length);
    });

    it('the branch, the fast-forward range and the traps range come off the preamble', () => {
        expect(parsed.branch).toBe('r9/fixture-branch');
        expect(parsed.ffRanges).toEqual([{ from: PREV_SHA, to: HEAD_SHA }]);
        expect(parsed.traps).toEqual({ from: 922, to: 924 });
    });

    it('⛔ the user\'s words come from the OPENING — a quote in the narrative is not the user\'s', () => {
        expect(parsed.quotes).toEqual(['a thing the user said']);
    });

    it('⛔ a bare ruling mention in the NARRATIVE is not one of the slice\'s rulings', () => {
        expect(parsed.rulings.map((r) => r.n)).toEqual(['99']);
        expect(rulingsIn('⚖ 62 DISCHARGED', '')).toEqual([{ n: '62', item: null, verdict: 'DISCHARGED' }]);
    });

    it('the preamble\'s ⛔ claims are carried VERBATIM as prose', () => {
        expect(parsed.claims).toEqual(['NOTHING MOVED']);
        expect(lines.fields.claims.from).toBe('prose');
    });

    /**
     * ⛓ THE THREE SHAPES THE REAL KICKOFF'S 44 AS-BUILT HEADERS ACTUALLY
     * TAKE, each of which the first cut of `HEADER_RE` got wrong: a PRIME in
     * the id, a HYPHENATED qualifier (`RE-RUN` — `-` is not `[A-Z ]`), and a
     * TWO-DAY date (`2026-08-21/22`, which refused §18, §22 and §23).
     */
    it('a prime in the id, a hyphenated qualifier, and no qualifier at all', () => {
        const m = HEADER_RE.exec('## 35. SLICE 12e′ RE-RUN AS-BUILT — **T** · Opus, 2026-08-25');
        expect(m?.[2]).toBe('12e′');
        expect(m?.[3]).toBe('RE-RUN');
        expect(HEADER_RE.exec('## 42. SLICE 12e′ FOURTH RUN AS-BUILT — **T** · Opus, 2026-08-26')?.[3])
            .toBe('FOURTH RUN');
        expect(HEADER_RE.exec('## 50. SLICE 12j AS-BUILT — **T** · Opus, 2026-08-28')?.[3])
            .toBeUndefined();
    });

    it('⛔ a TWO-DAY date is a date — three real headers spell one', () => {
        const m = HEADER_RE.exec('## 18. SLICE 9 AS-BUILT — **T** · Opus, 2026-08-21/22');
        expect(m?.[6]).toBe('2026-08-21/22');
    });

    /**
     * ⛔ A SECTION NUMBER IS A STRING. Three folds live at `21b.`, `23b.` and
     * `23c.` — a fold inserted between two already written. The gate found
     * them by reporting that three tracked-doc headings had NO as-built
     * section; they had one, numbered in a shape `\d+` could not see.
     */
    it('⛔ a LETTERED section number parses, and stays a string', () => {
        const t = FIXTURE.replace('## 99. SLICE X9', '## 99b. SLICE X9')
            .replace(/^### 99\./gm, '### 99b.');
        const p = parseSection(t, '99b');
        expect(p.section).toBe('99b');
        expect(p.subsections).toBe(2);
        expect(p.landed.map((c) => c.sha)).toEqual([PREV_SHA, HEAD_SHA, GHOST]);
    });

    /**
     * ⛔⛔ THE ROW DECLARES WHEN IT IS NOT THIS REPOSITORY'S COMMIT, and the
     * gate reads that instead of failing on it — §46.7 names a commit in
     * `~/CC/seedling` and one in a submodule; §49 marks five SHAs `*` under a
     * `\* pre-rebase SHAs` footnote.
     */
    it('a FOREIGN row and a PRE-REBASE row are declared, not stranded', () => {
        const t = FIXTURE
            .replace(`| \`${GHOST}\` | a row about a commit that is not on this head |`,
                [`| \`~/CC/elsewhere\` \`${GHOST}\` | in another repository |`,
                    `| submodule \`${GHOST}\` | in a submodule |`,
                    `| \`${GHOST}\`* | a pre-rebase sha |`,
                    '', '\\* pre-rebase SHAs; the rebase was clean.'].join('\n'));
        const pp = parseSection(t, 99);
        expect(pp.preRebaseFootnote).toBe(true);
        expect(pp.landed.filter((r) => r.foreign)).toHaveLength(2);
        expect(pp.landed.filter((r) => r.preRebase)).toHaveLength(1);
        const d = deriveFromGit(pp, { repo: TREPO, head: HEAD_SHA });
        expect(d.stranded).toEqual([]);
        expect(d.declared).toHaveLength(3);
    });

    it('the decoration comes off a title and nothing else does', () => {
        expect(bareTitle('⛓⛓⛓ **A TITLE — WITH AN EM DASH**')).toBe('A TITLE — WITH AN EM DASH');
    });
});

describe('⛔ the WHAT LANDED table is the SHA list, and git is asked about it', () => {
    it('every table row with a SHA span becomes a commit', () => {
        expect(parsed.landed.map((c) => c.sha)).toEqual([PREV_SHA, HEAD_SHA, GHOST]);
        expect(parsed.landed[0].what).toBe('the first thing');
    });

    it('⛔ a SHA the table names that is NOT an ancestor of --head is a FINDING', () => {
        expect(derived.commits.find((c) => c.sha === GHOST).onHead).toBe(false);
        expect(derived.findings.join('\n')).toMatch(new RegExp(`NOT ancestors of ${HEAD_SHA}`));
        expect(derived.findings.join('\n')).toContain(GHOST);
    });

    it('the two real ones ARE on the head', () => {
        expect(derived.commits.filter((c) => c.onHead).map((c) => c.sha))
            .toEqual([PREV_SHA, HEAD_SHA]);
    });

    it('the range base is the first landed commit\'s PARENT, cross-checked against the preamble', () => {
        const parent = tgit('rev-parse', '--short=9', `${PREV_SHA}^`);
        expect(derived.base).toBe(parent);
    });

    it('a table with no SHA rows yields no commits rather than throwing', () => {
        expect(landedIn(['### 9.1 WHAT LANDED', '| a | b |', '| c | d |'], 9)).toEqual([]);
    });
});

describe('⛓⛓ the four fact lines are ONE derivation, rendered four ways', () => {
    it('all four name the same slice id', () => {
        for (const l of [lines.memoryClose, lines.memoryIndexBullet, lines.queueHeader,
            lines.trackedHeading]) {
            expect(l).toContain(parsed.slice);
        }
    });

    it('the three that carry a head carry the SAME head', () => {
        for (const l of [lines.memoryClose, lines.memoryIndexBullet, lines.queueHeader]) {
            expect(l).toContain(derived.headShort);
        }
    });

    it('the tracked heading is the derived PREFIX plus §N\'s title as a default', () => {
        expect(lines.trackedHeading).toBe(`### R9 slice ${parsed.slice}: ${parsed.title}`);
    });

    it('⛔ the close line reports the derived numbers, not the section\'s sentences', () => {
        expect(lines.memoryClose).toContain(`§${parsed.section}`);
        expect(lines.memoryClose).toContain(`${derived.commitCount} commit(s)`);
        expect(lines.memoryClose).toMatch(/`fixtures\/` \*\*\d+ line\(s\)\*\*/);
    });

    it('⛔ a --head that is not the working tree\'s head reports NO porcelain, and says why', () => {
        const past = deriveFromGit(parsed, { repo: TREPO, head: PREV_SHA });
        expect(past.atTree).toBe(false);
        expect(past.porcelain).toBeNull();
        expect(past.findings.join('\n')).toMatch(/porcelain and the submodule pointers are NOT reported/);
    });

    it('every field declares one of the four provenances', () => {
        const froms = new Set(Object.values(lines.fields).map((f) => f.from));
        for (const f of froms) expect(['git', 'section', 'both', 'prose']).toContain(f);
    });
});

describe('⛔ a marked region is replaced only when its markers are UNIQUE', () => {
    const body = 'A\n<!-- r9-status -->\nold\n<!-- /r9-status -->\nB';
    it('a unique pair is replaced in place', () => {
        expect(replaceRegion(body, 'r9-status', 'new'))
            .toBe('A\n<!-- r9-status -->\nnew\n<!-- /r9-status -->\nB');
    });
    it('a DUPLICATED opener is refused BY NAME rather than matching the first', () => {
        expect(() => replaceRegion(`${body}\n<!-- r9-status -->`, 'r9-status', 'x'))
            .toThrow(/holds 2 .* and 1 /);
    });
    it('a MISSING marker is refused BY NAME rather than appending', () => {
        expect(() => replaceRegion('A\nB', 'r9-status', 'x')).toThrow(/holds 0 /);
    });
});

/**
 * ⛔⛔ **THE END OF THE FILE IS NOT THE END OF THE LOG.** The first real
 * `--only=queue` appended the header BELOW a closing code fence, at the bottom
 * of an ASCII diagram, two sections past where every slice entry lives.
 */
describe('⛔ a new queue block goes after the LAST one, never at EOF', () => {
    const doc = [
        '# queue', '',
        '**⇒ A CLOSED (…).**',
        'the A body.',
        'still the A body.', '',
        '**⇒ B CLOSED (…).**',
        'the B body.', '',
        '## 6. An appendix',
        'prose.', '',
        '```',
        'a diagram',
        '```', '',
    ];
    it('the point is the end of the LAST block\'s paragraph, before the appendix', () => {
        const at = insertionPoint(doc);
        expect(doc[at - 1]).toBe('the B body.');
        expect(doc[at + 1]).toBe('## 6. An appendix');
    });
    it('⛔ …and it is NOT the end of the file', () => {
        expect(insertionPoint(doc)).toBeLessThan(doc.length - 1);
    });
    it('a document with no block at all falls back to EOF, and says so by its value', () => {
        expect(insertionPoint(['# queue', 'prose'])).toBe(2);
    });
});

describe('⛓ the memory directory is DERIVED from the primary worktree', () => {
    it('an explicit override wins', () => {
        expect(memoryDir({ repo: REPO, env: { CLAUDE_MEMORY_DIR: '/x/y' } })).toBe('/x/y');
    });
    it('otherwise it is the PRIMARY tree\'s path with every `/` replaced by `-`', () => {
        const common = execFileSync('git',
            ['rev-parse', '--path-format=absolute', '--git-common-dir'],
            { cwd: REPO, encoding: 'utf8' }).trim().replace(/\/\.git\/?$/, '');
        expect(memoryDir({ repo: REPO, env: {} }))
            .toBe(`${process.env.HOME}/.claude/projects/${common.split('/').join('-')}/memory`);
    });
});

describe('⛔ the trap ladder is FROZEN, and the boundary is declared with its provenance', () => {
    it('the frozen boundary is a number the docblock explains', () => {
        expect(LADDER_FROZEN_AT).toBeTypeOf('number');
        expect(LADDER_FROZEN_AT).toBeGreaterThan(0);
    });
});
