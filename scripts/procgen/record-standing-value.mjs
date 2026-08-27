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
 *
 * ⛔⛔ **A QUOTED ROW IS MARKED AS ONE.** The whole point of the file is that a
 * number in it was produced by the command beside it. A row that a human typed
 * — because it was measured on a Windows session, or on another head — is not
 * that, and pretending otherwise would make the file exactly as trustworthy as
 * the handshake it replaces. So `--quote` demands `--measured-at` and `--why`,
 * and stamps `quoted: true`; `standing-values.mjs --check` never re-runs it and
 * always prints it with its own head.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { releaseBoxLock, takeBoxLock } from './boxLock.js';
import { REPO } from './gateRoster.js';
import { CHEAP_MS, FILE, cheapFor, head, readStandingValues, runRow } from './standingValues.js';

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
