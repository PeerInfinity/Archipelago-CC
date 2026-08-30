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
 *   node scripts/procgen/record-standing-value.mjs --key='roster: --win --tier=full' \
 *        --from='node scripts/procgen/verify-seedling-bot-differential.mjs --win --tier=full'
 *
 *   …--kind=gate|identity|suite    how to read the headline (default: guessed
 *                                  from the command — a `check-*` is a gate, a
 *                                  `vitest` is a suite, anything else is an
 *                                  identity digest)
 *   …--quote='<value>' --measured-at=<sha> --why='<one line>'
 *                                  record a value MEASURED SOMEWHERE ELSE.
 *   …--quote='<value>' --category=<campaign|map-walk|mechanic> --tapes=<n> \
 *        --measured-at=<sha>        quote ONE CATEGORY of the COMPOSITE
 *                                  checkpoint row (R9 slice CAT, ⚖ 70 (c)).
 *                                  The row's own `value` and `why` are then
 *                                  DERIVED from its parts and any hand edit to
 *                                  either is overwritten — ⚖ 17. `--why` is
 *                                  refused here: the derivation writes it.
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
    CHEAP_MS, FILE, cheapFor, head, readStandingValues, runRow, withCategoryQuote,
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
const MEASURED_AT = arg('measured-at');
const CATEGORY = arg('category');
const TAPES = arg('tapes');
const COVERED_BY = arg('covered-by');

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
if (QUOTE !== null && CATEGORY) {
    if (!ROSTER_CATEGORIES.includes(CATEGORY)) {
        console.log(`FAIL: --category=${CATEGORY} is not a derived category `
            + `(${ROSTER_CATEGORIES.join(', ')}).`);
        process.exit(1);
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
