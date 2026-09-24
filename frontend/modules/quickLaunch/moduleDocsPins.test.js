/**
 * `moduleInfo.docs` pins: every guide path a module declares is a path the
 * generated index lists. Found by READING each `frontend/modules/*\/index.js`
 * (its `export const moduleInfo = {…}` block), not by importing modules that
 * need a DOM.
 *
 * A guide under docs/json/user/modules/ that no module claims is a warning,
 * not a failure: some describe a family of modules, or a page to be written.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOCS_INDEX } from './generated/docsIndex.js';

const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PER_PANEL_SECTION = 'user/modules';

/** { moduleDir → declared docs path } for every module index.js that declares one. */
function declaredDocs() {
    const out = new Map();
    for (const dir of readdirSync(MODULES_DIR, { withFileTypes: true })) {
        const file = join(MODULES_DIR, dir.name, 'index.js');
        if (!dir.isDirectory() || !existsSync(file)) continue;
        const text = readFileSync(file, 'utf8');
        const start = text.indexOf('export const moduleInfo');
        if (start === -1) continue;
        const end = text.indexOf('\n};', start);
        const block = text.slice(start, end === -1 ? undefined : end);
        const m = block.match(/^\s*docs\s*:\s*['"]([^'"]+)['"]/m);
        if (m) out.set(dir.name, m[1]);
    }
    return out;
}

describe('moduleInfo.docs', () => {
    const declared = declaredDocs();
    const indexed = new Set(DOCS_INDEX.map((d) => d.path));

    it('some module declares one (the scan is not reading nothing)', () => {
        expect(declared.size).toBeGreaterThan(0);
    });

    it('every declared path is in the generated docs index', () => {
        const missing = [...declared].filter(([, path]) => !indexed.has(path)).map(([dir, path]) => `${dir}: ${path}`);
        expect(missing).toEqual([]);
    });

    it('reports (warning only) the per-panel guides no module claims', () => {
        const claimed = new Set(declared.values());
        const unclaimed = DOCS_INDEX
            .filter((d) => d.section === PER_PANEL_SECTION && !claimed.has(d.path))
            .map((d) => d.path);
        if (unclaimed.length) console.warn(`WARNING: guides no moduleInfo.docs claims: ${unclaimed.join(', ')}`);
        expect(Array.isArray(unclaimed)).toBe(true);
    });
});
