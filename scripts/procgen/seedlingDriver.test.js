/**
 * seedlingDriver — the rows (slice seedling-headless-H2).
 *
 * ⛓ What the channel object promises its four gates, each a way the headless
 * arm could quietly become a different run:
 *   1. the headless argv carries `--headless` and EXACTLY the switches the gate
 *      handed in, as one `--chromium-args=` JSON array — never a list of its own;
 *   2. an empty switch list is refused, not launched with the driver's defaults;
 *   3. an interpreter that cannot import Playwright is a refusal that names the
 *      requirements file (the ladder itself: `repoPython.test.js`);
 *   4. (C2) that refusal, met by a gate's `driverChannel`, exits 2 with the
 *      message and no stack — `generatePythonOrExit`'s convention.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { HEADLESS_REQUIREMENTS, driverChannel, headlessPython } from './seedlingDriver.js';

/** A fake tree carrying `HEADLESS_REQUIREMENTS` with `playwright==<version>`. */
function pinRepo(version) {
    const repo = mkdtempSync(join(tmpdir(), 'driver-pin-'));
    mkdirSync(dirname(join(repo, HEADLESS_REQUIREMENTS)), { recursive: true });
    writeFileSync(join(repo, HEADLESS_REQUIREMENTS), `# fake\nplaywright==${version}\n`);
    return { repo };
}

describe('driverChannel — the headless channel', () => {
    it('stages in a temp dir and spells the driver path, not a Windows one', () => {
        // ⛓ An explicit interpreter: the channel resolves (and PROBES) it at
        // construction, and a CI vitest job has no Python with Playwright —
        // measured red at b10503b90f without this.
        const ch = driverChannel({ win: false, winPy: '/nonexistent/py.exe',
            driver: '/x/d.py', chromiumArgs: HEADLESS_LOGIC_ONLY_ARGS, python: 'python3' });
        expect(ch.name).toBe('headless');
        expect(ch.path('plan.json').startsWith(tmpdir())).toBe(true);
        expect(ch.path('plan.json')).toBe(ch.local('plan.json'));
        ch.write('plan.json', '{}');
        expect(ch.read('plan.json')).toBe('{}');
        ch.clear('plan.json');
        expect(existsSync(ch.local('plan.json'))).toBe(false);
    });

    it('runs the driver with --headless and EXACTLY the switches it was handed', () => {
        // ⛓ `echo` as the interpreter: the argv comes back as the output, so
        // the row reads what would have been launched without a browser.
        const ch = driverChannel({ win: false, winPy: 'unused',
            driver: '/x/d.py', chromiumArgs: HEADLESS_LOGIC_ONLY_ARGS, python: 'echo' });
        const out = ch.run(['--plan', 'p.json']).trim();
        expect(out).toBe(['/x/d.py', '--headless',
            `--chromium-args=${JSON.stringify(HEADLESS_LOGIC_ONLY_ARGS)}`,
            '--plan', 'p.json'].join(' '));
    });

    it('refuses an empty switch list rather than launching on defaults', () => {
        expect(() => driverChannel({ win: false, winPy: 'x', driver: '/x/d.py', chromiumArgs: [] }))
            .toThrow(/headlessChromium\.js/);
    });

    it('an interpreter that cannot import playwright is a refusal that names the requirements file', () => {
        const repo = join(tmpdir(), 'no-such-repo');
        expect(() => headlessPython({ env: {}, repo, probe: () => false }))
            .toThrow(new RegExp(HEADLESS_REQUIREMENTS.replace(/[.]/g, '\\.')));
        expect(() => headlessPython({ env: {}, repo, probe: () => false }))
            .toThrow(/import playwright/);
        // ⛓ C1: the admitted case now also asks the pin, so it runs on a fake
        // tree's requirements file with the version injected.
        expect(headlessPython({ env: { SEEDLING_PYTHON: '/p' }, ...pinRepo('9.9.9'), probe: () => true,
            version: () => '9.9.9' })).toBe('/p');
    });

    it('C1: the interpreter must carry EXACTLY the playwright the requirements file pins (a fake tree, never the real pin)', () => {
        const at = pinRepo('9.9.9');
        const env = { SEEDLING_PYTHON: '/p' };
        expect(headlessPython({ env, ...at, probe: () => true, version: () => '9.9.9' })).toBe('/p');
        const e = (() => {
            try { return headlessPython({ env, ...at, probe: () => true, version: () => '1.0.0' }); } catch (x) { return x; }
        })();
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toContain(`/p has playwright 1.0.0, the pin is 9.9.9`);
        expect(e.message).toContain(`/p -m pip install -r ${join(at.repo, HEADLESS_REQUIREMENTS)}`);
    });

    /**
     * ⛓ C2 — the four gates' default resolution, on a REAL child process (the
     * mechanism `repoPython.test.js` proves `generatePythonOrExit` with). Rung 1
     * is `/bin/false`: present, cannot import, never skipped — a deterministic
     * refusal that touches no real venv. Before C2 this was an uncaught throw:
     * a Node stack trace and exit 1, the code for "measured and failed".
     */
    it('C2: a refusal in the default resolution prints the message and exits 2 — no stack, no PASS, no temp dir', () => {
        const dir = mkdtempSync(join(tmpdir(), 'driver-exit-'));
        const tmp = join(dir, 'tmp');
        mkdirSync(tmp);
        const f = join(dir, 'check-fixture-driver.mjs');
        const helper = pathToFileURL(join(import.meta.dirname, 'seedlingDriver.js')).href;
        writeFileSync(f, `import { driverChannel } from '${helper}';\n`
            + "driverChannel({ win: false, winPy: 'x', driver: '/x/d.py', chromiumArgs: ['--x'] });\n"
            + "console.log('PASS: channel built');\n");
        const r = spawnSync(process.execPath, [f], { encoding: 'utf8',
            env: { PATH: process.env.PATH, SEEDLING_PYTHON: '/bin/false', TMPDIR: tmp } });
        expect(r.status).toBe(2);
        expect(r.stdout).toMatch(/^REFUSED: seedlingDriver: the headless channel needs a Python that can `import playwright`.*: \/bin\/false$/m);
        expect(r.stdout).toContain(HEADLESS_REQUIREMENTS);
        expect(r.stdout).not.toMatch(/^PASS:/m);
        expect(`${r.stdout}\n${r.stderr}`).not.toMatch(/^\s+at /m);
        expect(readdirSync(tmp)).toEqual([]);
    });
});
