/**
 * seedlingDriver — the rows (slice seedling-headless-H2).
 *
 * ⛓ What the channel object promises its four gates, each a way the headless
 * arm could quietly become a different run:
 *   1. the headless argv carries `--headless` and EXACTLY the switches the gate
 *      handed in, as one `--chromium-args=` JSON array — never a list of its own;
 *   2. an empty switch list is refused, not launched with the driver's defaults;
 *   3. an interpreter that cannot import Playwright is a refusal that names the
 *      requirements file (the ladder itself: `repoPython.test.js`).
 */
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

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
});
