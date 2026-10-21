/**
 * producerFixtureBytes — **A PRODUCER'S `--check` COMPARES BYTES** (slice
 * seedling-js-producer-checks-r1r6).
 *
 * Twenty-five `plan-seedling-r1..r6-*` producers had `--write` and no
 * `--check`, so `ci-producer-checks.mjs` ran them as plain dry runs — green on
 * any bytes. Ten of them no longer reproduced their committed files, and
 * nothing said so. This is the regenerate-r*-tapes form (and
 * `plan-seedling-r5-conch`'s): `same <name>: N bytes`, or `DIFFERS <name>: …`,
 * which `ci-producer-checks` reads as the row's failing line.
 *
 * ⛔ Each producer still parses its OWN `--write` / `--check` (the instruments
 * index reads the flags out of the producer's file); this module only owns the
 * comparison and the write, so the twenty-five cannot disagree on the form.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

/**
 * Compare `text` with the committed file at `path`. Prints one verdict line;
 * returns whether the bytes are identical. `name` defaults to the file's
 * basename without `.json`.
 */
export function checkFixtureBytes(path, text, name = basename(path).replace(/\.json$/, '')) {
    const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (have === text) {
        console.log(`same ${name}: ${text.length} bytes`);
        return true;
    }
    console.log(`DIFFERS ${name}: ${have === null ? 'the file does not exist'
        : `${have.length} bytes committed vs ${text.length} derived`} — re-run with --write`);
    return false;
}

/**
 * The tail every producer shares: `outputs` is `[{path, text}]`. With `write`
 * each is written; with `check` each is compared, and ANY difference exits 1
 * after all of them have printed. Returns false when neither flag is set, so the
 * caller prints its own dry-run line.
 */
export function emitFixtures(outputs, { write = false, check = false } = {}) {
    if (check) {
        console.log('');
        let ok = true;
        for (const { path, text } of outputs) ok = checkFixtureBytes(path, text) && ok;
        if (!ok) process.exit(1);
        return true;
    }
    if (write) {
        for (const { path, text } of outputs) {
            writeFileSync(path, text);
            console.log(`   wrote ${path}`);
        }
        return true;
    }
    return false;
}
