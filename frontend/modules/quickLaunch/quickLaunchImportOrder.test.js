/**
 * The Quick Launch files evaluate in EITHER import order (slice P9).
 *
 * The module loader imports `index.js` first, but test discovery imports
 * `tests/testCases/quickLaunchTests.js` → `quickLaunchUI.js` whether or not the
 * module is enabled — in `test-spoilers` mode (quickLaunch `enabled: false`) the
 * UI file is the FIRST of the pair to be imported. While `quickLaunchUI.js`
 * imported `./index.js`, that order evaluated index.js before the UI's
 * `MODULE_ID` existed and threw `ReferenceError: Cannot access 'MODULE_ID'
 * before initialization`.
 *
 * Two instruments, because they disagree on the old code: vitest's module
 * runner does not reproduce the temporal dead zone (the read gives `undefined`,
 * so `moduleInfo.name` was undefined), while a native Node ESM import throws the
 * browser's ReferenceError. Each vitest case gets a fresh module graph; each
 * native case a fresh process.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const UI_URL = new URL('./quickLaunchUI.js', import.meta.url).href;
const INDEX_URL = new URL('./index.js', import.meta.url).href;

/** Import `first` then `second` in a fresh Node process; its report line (the rest of stdout/stderr is page-module noise). */
function nativeImport(first, second) {
    const script = `
        try {
            await import(${JSON.stringify(first)});
            await import(${JSON.stringify(second)});
            const { moduleInfo } = await import(${JSON.stringify(INDEX_URL)});
            const { MODULE_ID } = await import(${JSON.stringify(UI_URL)});
            console.log('IMPORT-ORDER ' + JSON.stringify({ ok: true, name: moduleInfo.name, MODULE_ID }));
        } catch (e) {
            console.log('IMPORT-ORDER ' + JSON.stringify({ ok: false, error: e.constructor.name + ': ' + e.message }));
        }
        process.exit(0);
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000,
    });
    const line = out.split('\n').find((l) => l.startsWith('IMPORT-ORDER '));
    return JSON.parse(line.slice('IMPORT-ORDER '.length));
}

describe('quickLaunch import order', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('evaluates with the UI imported first (test discovery order)', async () => {
        const ui = await import('./quickLaunchUI.js');
        const index = await import('./index.js');
        expect(ui.MODULE_ID).toBe('quickLaunch');
        expect(index.moduleInfo.name).toBe(ui.MODULE_ID);
    });

    it('evaluates with index.js imported first (module loader order)', async () => {
        const index = await import('./index.js');
        const ui = await import('./quickLaunchUI.js');
        expect(ui.MODULE_ID).toBe('quickLaunch');
        expect(index.moduleInfo.name).toBe(ui.MODULE_ID);
    });

    it('native ESM: the UI imported first does not throw', () => {
        expect(nativeImport(UI_URL, INDEX_URL)).toEqual({ ok: true, name: 'quickLaunch', MODULE_ID: 'quickLaunch' });
    });

    it('native ESM: index.js imported first does not throw', () => {
        expect(nativeImport(INDEX_URL, UI_URL)).toEqual({ ok: true, name: 'quickLaunch', MODULE_ID: 'quickLaunch' });
    });

    it('the UI never imports its own index.js (the cycle stays broken)', () => {
        const source = readFileSync(fileURLToPath(UI_URL), 'utf8');
        expect(source).not.toMatch(/from\s+['"]\.\/index\.js['"]/);
    });
});
