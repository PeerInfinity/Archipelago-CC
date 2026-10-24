/**
 * `moduleInfo.category` pins: every category a module declares is one of
 * CATEGORY_ORDER — the `## ` headings of docs/json/modules/README.md that list
 * modules, as the generator read them (generated.test.js pins that list to the
 * README). Found by READING each `frontend/modules/*\/index.js` (its
 * `export const moduleInfo = {…}` block), as moduleDocsPins.test.js does.
 *
 * The declaring set is every module whose moduleInfo has a non-null
 * `componentType` (a panel). One that declares no category is a warning, not a failure: the
 * panel shows it under "Other".
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER } from './generated/docsIndex.js';

const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** [{ dir, category|null }] for every module index.js whose moduleInfo declares a componentType. */
function panelModules() {
    const out = [];
    for (const dir of readdirSync(MODULES_DIR, { withFileTypes: true })) {
        const file = join(MODULES_DIR, dir.name, 'index.js');
        if (!dir.isDirectory() || !existsSync(file)) continue;
        const text = readFileSync(file, 'utf8');
        const start = text.indexOf('export const moduleInfo');
        if (start === -1) continue;
        const end = text.indexOf('\n};', start);
        const block = text.slice(start, end === -1 ? undefined : end);
        // `componentType: null` (jtaArchipelago) is a module with no panel.
        if (!/^\s*componentType\s*:\s*(?!null\b)\S/m.test(block)) continue;
        const m = block.match(/^\s*category\s*:\s*(['"])(.+?)\1/m);
        out.push({ dir: dir.name, category: m ? m[2] : null });
    }
    return out;
}

describe('moduleInfo.category', () => {
    const modules = panelModules();

    it('the scan finds panel modules (it is not reading nothing)', () => {
        expect(modules.length).toBeGreaterThan(0);
    });

    it('every declared category is a README module section (CATEGORY_ORDER)', () => {
        const bad = modules.filter((m) => m.category !== null && !CATEGORY_ORDER.includes(m.category))
            .map((m) => `${m.dir}: ${m.category}`);
        expect(bad).toEqual([]);
    });

    it('reports (warning only) the panel modules that declare no category', () => {
        const undeclared = modules.filter((m) => m.category === null).map((m) => m.dir);
        if (undeclared.length) console.warn(`WARNING: panel modules with no moduleInfo.category: ${undeclared.join(', ')}`);
        expect(Array.isArray(undeclared)).toBe(true);
    });
});
