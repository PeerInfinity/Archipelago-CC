#!/usr/bin/env node
/**
 * record-standing-value — **ONE STANDING VALUE, RECORDED BY THE COMMAND THAT
 * MEASURES IT** (R9 slice 12e, ⚖ ruling 38 item (5)).
 *
 * `standing-values.mjs --write` measures the whole derived list. This records
 * ONE row — for a value the derivation does not produce (a Windows/GPU row a
 * headless session cannot run, a suite run on another machine), or to refresh
 * a single row without paying for the rest.
 *
 * ── Run ───────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/record-standing-value.mjs --key='roster: --tier=full' \
 *        --from='node scripts/procgen/check-seedling-bot-differential.mjs --win --tier=full'
 *
 *   …--kind=gate|identity|suite    how to read the headline (default: guessed
 *                                  from the command — a `check-*` is a gate, a
 *                                  `vitest` is a suite, anything else is an
 *                                  identity digest)
 *   …--quote='<value>' --measured-at=<sha> --why='<one line>' [--channel=win|headless]
 *                                  record a value MEASURED SOMEWHERE ELSE.
 *   …--quote='<value>' --category=<campaign|map-walk|mechanic> --tapes=<n> \
 *        --measured-at=<sha> [--channel=win|headless]
 *                                  quote ONE CATEGORY of the COMPOSITE
 *                                  checkpoint row (R9 slice CAT, ⚖ 70 (c)).
 *                                  The row's own `value` and `why` are then
 *                                  DERIVED from its parts and any hand edit to
 *                                  either is overwritten — ⚖ 17. `--why` is
 *                                  refused here: the derivation writes it.
 *   …--quote='<value>' --category=<name> --reused-run=<run id>
 *                                  ⛓⛓ RE-STAMP a part AT THIS HEAD from a
 *                                  green `seedling-full-tier.yml` run that a
 *                                  later dispatch REUSED (ci-skip-rules rule 3,
 *                                  ⚖ user 2026-10-17: *"Yes, if possible."*).
 *                                  The tier key is recomputed here, at a clean
 *                                  HEAD, for the category's tier and `full`;
 *                                  one must equal the key the run banked. Then
 *                                  `measuredAt` = HEAD and `coveredBy` names
 *                                  the run, its SHA, tier and key. ⛓ Sound
 *                                  because the key covers every population
 *                                  `check-seedling-full-tier-owed` reads
 *                                  (`fullTierKey.js`); `--measured-at=` may be
 *                                  omitted and is refused unless it is HEAD.
 *
 * ⛔⛔ **A QUOTED ROW IS MARKED AS ONE.** The whole point of the file is that a
 * number in it was produced by the command beside it. A row that a human typed
 * — because it was measured on a Windows session, or on another head — is not
 * that, and pretending otherwise would make the file exactly as trustworthy as
 * the handshake it replaces. So `--quote` demands `--measured-at` and `--why`,
 * and stamps `quoted: true`; `standing-values.mjs --check` never re-runs it and
 * always prints it with its own head.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { releaseBoxLock, takeBoxLock } from './boxLock.js';
import { REPO } from './gateRoster.js';
import {
    CHANNELS, CHEAP_MS, FILE, cheapFor, head, readStandingValues, retiredKeyProblem, runRow,
    withCategoryQuote,
} from './standingValues.js';
import { ROSTER_CATEGORIES, rosterCategories } from
    '../../frontend/modules/seedlingDemo/fixtures/tiers.js';
import { fixtureNames } from '../../frontend/modules/seedlingDemo/fixtures/index.js';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};

const KEY = arg('key');
const FROM = arg('from');
const QUOTE = arg('quote');
const WHY = arg('why');
let MEASURED_AT = arg('measured-at');
const CATEGORY = arg('category');
const TAPES = arg('tapes');
let COVERED_BY = arg('covered-by');
/**
 * ⛓ R1 — which BROWSER drove this part (`win` | `headless`), recorded as data
 * on the part rather than inferred from the key. Optional and never defaulted:
 * see `channelSuffix` in `standingValues.js` for why absence must keep meaning
 * "not recorded" rather than "win".
 */
let CHANNEL = arg('channel');
const REUSED_RUN = arg('reused-run');

if (retiredKeyProblem(KEY)) {
    console.log(retiredKeyProblem(KEY));
    process.exit(1);
}
if (!KEY || (!FROM && QUOTE === null)) {
    console.log('FAIL: --key= and one of --from=<command> / --quote=<value> are required');
    process.exit(1);
}

/** ⛓ The KIND decides how the headline is read; guessed from the command, said. */
const guessKind = (cmd) => {
    if (/check-[a-z0-9-]+\.mjs/.test(cmd)) return 'gate';
    if (/\bvitest\b/.test(cmd)) return 'suite';
    return 'identity';
};
const KIND = arg('kind', FROM ? guessKind(FROM) : 'identity');

const file = readStandingValues() ?? { note: null, measuredAt: head(), rows: {} };
file.rows = file.rows ?? {};

/**
 * ⛓⛓⛓ R9 slice CAT (⚖ 70 (c)) — **QUOTING ONE CATEGORY OF THE COMPOSITE ROW.**
 *
 * The checkpoint row is no longer one number: it is one part per derived
 * category, each with its own head, because a tape-moving change owes a drive
 * only to the categories its reach names. Quoting a part therefore has to be a
 * READ-MODIFY-WRITE of the row rather than a replacement of it — and the row's
 * `value` and `why` are DERIVED from the parts afterwards, so neither can be
 * typed and neither can go stale.
 *
 * ⛔ `--why` IS REFUSED WITH `--category`. A hand-written `why` beside a
 * derived one is a second source of truth about the same fact, which is what
 * ⚖ 17 is about; the derivation states every part, its counts and its head.
 */
/**
 * ⛓ R1 — a typo'd channel would become DATA and read as a third channel nobody
 * drives, so the vocabulary is closed at the door rather than in the reader.
 * Omitting it is still legal and still means "not recorded". ⛓ S1 (2026-09-13):
 * checked for EVERY path that writes it — a plain `--quote` gate row now carries
 * `channel` too (the ship row, box headless-pixels).
 */
if (CHANNEL && !CHANNELS.includes(CHANNEL)) {
    console.log(`FAIL: --channel=${CHANNEL} is not a channel (${CHANNELS.join(', ')}). `
        + 'Omit it to record no channel; ⛔ do not omit it to mean `win`.');
    process.exit(1);
}
/**
 * ⛓⛓ `--reused-run=` — the re-stamp's evidence, gathered here and judged by
 * `fullTierKey.reuseVerdict`. ⛔ Refused on a tree whose key inputs differ
 * from HEAD: the key is computed from the files on disk, so a dirty tree
 * would stamp HEAD with a key about something else.
 */
async function reusedAtHead(runId) {
    const { deadFrameFiles, reuseVerdict } = await import('./fullTierKey.js');
    const { githubRepoOf } = await import('./fullTierEstimate.js');
    if (!/^\d+$/.test(runId)) return { ok: false, problem: 'a run id is digits' };
    if (QUOTE === null || !CATEGORY) {
        return { ok: false, problem: 'it re-stamps ONE part: --quote= and --category= are required' };
    }
    if (COVERED_BY) return { ok: false, problem: '--covered-by= is refused with it (it is written)' };
    if (CHANNEL && CHANNEL !== 'headless') {
        return { ok: false, problem: `--channel=${CHANNEL}: a CI tier is headless` };
    }
    const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
    const HEAD = git('rev-parse', 'HEAD');
    if (MEASURED_AT && git('rev-parse', `${MEASURED_AT}^{commit}`) !== HEAD) {
        return { ok: false, problem: `--measured-at=${MEASURED_AT} is not HEAD (${HEAD.slice(0, 10)}); `
            + 'a reused run is stamped at the head its key matched, or quoted plainly at its own SHA' };
    }
    const dirty = git('status', '--porcelain', '--untracked-files=all', '--',
        'frontend/modules/seedlingDemo', 'frontend/modules/flashPanel', 'scripts/procgen',
        '.github/workflows/seedling-full-tier.yml', 'package-lock.json', ...deadFrameFiles(REPO),
        `:!${FILE}`);
    if (dirty) {
        return { ok: false, problem: `the tree differs from HEAD under the key's inputs:\n${dirty}` };
    }
    const repo = githubRepoOf(git('remote', 'get-url', 'origin'));
    const gh = (path) => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${path}`],
        { encoding: 'utf8', maxBuffer: 1 << 26 }));
    let run;
    let artifacts;
    try {
        run = gh(`actions/runs/${runId}`);
        artifacts = gh(`actions/runs/${runId}/artifacts?per_page=100`).artifacts;
    } catch (e) {
        return { ok: false, problem: `the GitHub API did not answer (${String(e.message).split('\n')[0]})` };
    }
    const diff = join(REPO, 'scripts/procgen/check-seedling-bot-differential.mjs');
    const keysAtHead = {};
    for (const tier of [...new Set([CATEGORY, 'full'])]) {
        const out = execFileSync('node', [diff, `--tier=${tier}`, '--tier-key'],
            { cwd: REPO, encoding: 'utf8' });
        keysAtHead[tier] = /^TIER-KEY: ([0-9a-f]{16}) /m.exec(out)?.[1] ?? null;
    }
    const v = reuseVerdict({ run, artifacts, keysAtHead });
    if (!v.ok) return v;
    return { ok: true, head: HEAD,
        coveredBy: `run ${run.id} @${run.head_sha.slice(0, 10)} (tier ${v.tier}, key ${v.key}) — `
            + `REUSED at ${HEAD.slice(0, 10)}: the tier key at this head equals the run's `
            + '(ci-skip-rules rule 3)' };
}

if (QUOTE !== null && CATEGORY) {
    if (!ROSTER_CATEGORIES.includes(CATEGORY)) {
        console.log(`FAIL: --category=${CATEGORY} is not a derived category `
            + `(${ROSTER_CATEGORIES.join(', ')}).`);
        process.exit(1);
    }
    if (REUSED_RUN !== null) {
        const r = await reusedAtHead(REUSED_RUN);
        if (!r.ok) {
            console.log(`FAIL: --reused-run=${REUSED_RUN} cannot be stamped at this head — ${r.problem}`);
            process.exit(1);
        }
        MEASURED_AT = r.head;
        COVERED_BY = r.coveredBy;
        CHANNEL = 'headless';
        console.log(`⛓ REUSED: ${r.coveredBy}`);
    }
    if (!MEASURED_AT) {
        console.log('FAIL: --category= needs --measured-at=<sha>. A part without its own head '
            + 'cannot answer the only question it exists for: has the tree moved under THIS '
            + 'category?');
        process.exit(1);
    }
    if (WHY) {
        console.log('FAIL: --why= is refused with --category=. The composite row\'s `why` is '
            + 'DERIVED from its parts (⚖ 17) — a hand-written one beside it would be a '
            + 'second source of truth about the same fact.');
        process.exit(1);
    }
    const prev = file.rows[KEY];
    if (!prev) {
        console.log(`FAIL: ${FILE} carries no ${JSON.stringify(KEY)} row to quote a category `
            + 'of. Record the whole row first.');
        process.exit(1);
    }
    /** ⛓ Ancestry comes from git here; the module never shells out itself. */
    const isAncestor = (a, b) => {
        try {
            execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: REPO });
            return true;
        } catch { return false; }
    };
    /**
     * ⛓ THE TAPE COUNT IS DERIVED unless it is stated (⚖ 17). A drive selects
     * by category, so the count is whatever the derivation says the category
     * holds — typing it would be a second source of truth about a number the
     * same derivation already answers. `--tapes=` stays for a part measured
     * over a DIFFERENT roster than this tree's, and the line says which was
     * used.
     */
    const derivedTapes = rosterCategories(fixtureNames())[CATEGORY].length;
    const next = withCategoryQuote(prev, {
        category: CATEGORY,
        tapes: TAPES ? Number(TAPES) : derivedTapes,
        value: QUOTE === '' ? null : QUOTE,
        measuredAt: MEASURED_AT,
        coveredBy: COVERED_BY,
        channel: CHANNEL,
    }, { categories: ROSTER_CATEGORIES, isAncestor });
    file.rows[KEY] = next;
    writeFileSync(join(REPO, FILE), `${JSON.stringify(file, null, 2)}\n`);
    console.log(`QUOTED ${KEY} [${CATEGORY}] = ${QUOTE || '(not separately banked)'} `
        + `over ${TAPES ? `${TAPES} tape(s), STATED` : `${derivedTapes} tape(s), DERIVED`}`
        + `  @${MEASURED_AT}`);
    console.log(`  ⛓ the row is now ${next.value}`);
    console.log(`  ⛓ why (DERIVED): ${next.why}`);
    process.exit(0);
}

if (REUSED_RUN !== null) {
    console.log('FAIL: --reused-run= re-stamps ONE part of the checkpoint row: --quote= and '
        + '--category= are required.');
    process.exit(1);
}
if (QUOTE !== null) {
    if (!MEASURED_AT || !WHY) {
        console.log('FAIL: --quote= needs --measured-at=<sha> and --why=<one line>. '
            + 'A value this file did not measure must carry where it came from.');
        process.exit(1);
    }
    file.rows[KEY] = {
        value: QUOTE,
        command: FROM ?? null,
        kind: KIND,
        cheap: false,
        quoted: true,
        why: WHY,
        measuredAt: MEASURED_AT,
        ...(CHANNEL ? { channel: CHANNEL } : {}),
    };
    writeFileSync(join(REPO, FILE), `${JSON.stringify(file, null, 2)}\n`);
    console.log(`QUOTED ${KEY} = ${QUOTE}  @${MEASURED_AT}\n  ⛓ ${WHY}`);
    process.exit(0);
}

/**
 * ⛓ R9 P3b — a `--from=` recording MEASURES, so it takes the box exactly as
 * `standing-values --write` does. ⛔ The `--quote` path above does not and
 * must not: it records a number measured somewhere else and runs nothing.
 */
const lock = takeBoxLock({ name: `record-standing-value --key=${KEY}`, kind: 'measure',
    repo: REPO, waitSec: Number(arg('wait-for-box', '0')) || 0 });
void lock;
const shell = !/^\s*(?:node|npx)\b/.test(FROM);
const r = await runRow({ kind: KIND, command: FROM, shell });
const HEAD = head();
file.rows[KEY] = {
    value: r.value,
    command: FROM,
    kind: KIND,
    exit: r.exit,
    ms: r.ms,
    /** ⛓ R9 P3b — the same hysteresis `--write` uses, one spelling (trap 735). */
    cheap: cheapFor(r.ms, file.rows[KEY]?.cheap).cheap,
    measuredAt: HEAD,
    ...(r.total ? { total: r.total } : {}),
};
writeFileSync(join(REPO, FILE), `${JSON.stringify(file, null, 2)}\n`);
console.log(`${r.exit === 0 ? 'ok' : `EXIT ${r.exit}`}  ${KEY} = ${r.value}  `
    + `(${(r.ms / 1000).toFixed(1)}s${file.rows[KEY].cheap ? ', cheap' : ''}`
    + `${file.rows[KEY].cheap !== (r.ms < CHEAP_MS) ? ', HELD by hysteresis — trap 735' : ''})`
    + `  @${HEAD}`);
releaseBoxLock();
process.exit(r.exit === 0 ? 0 : 1);
