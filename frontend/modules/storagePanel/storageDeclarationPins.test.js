/**
 * `moduleInfo.storage` pins: every module's declarations are well formed, no two
 * modules claim the same key, and every declared literal key is written
 * somewhere in the tree (a declaration whose writer is gone is a stale claim —
 * it would hide an orphan from the Storage panel's Unknown section).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declarationError } from './storageModel.js';
import { MODULES_DIR, readSourceDeclarations } from './sourceDeclarations.js';

const FRONTEND_DIR = join(MODULES_DIR, '..');

/** The text with any `storage: [ … ],` declaration list cut out, so a declaration is not its own writer. */
function withoutStorageBlock(text) {
    return text.replace(/^\s*storage\s*:\s*\[\s*\n[\s\S]*?^\s*\],?\s*$/m, '');
}

/** Every .js/.ts/.html file under frontend/ except libs, tests and the index.js declarations themselves. */
function sourceTexts() {
    const texts = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (['node_modules', 'libs', 'dist', '.git'].includes(name)) continue;
            const st = statSync(p);
            if (st.isDirectory()) { walk(p); continue; }
            if (!/\.(m?js|ts|html)$/.test(name) || /\.test\.m?js$/.test(name)) continue;
            // NUL-bearing files are read as bytes → latin1, so a literal is still found.
            texts.push({ path: relative(FRONTEND_DIR, p), text: withoutStorageBlock(readFileSync(p, 'latin1')) });
        }
    };
    walk(FRONTEND_DIR);
    return texts;
}

describe('moduleInfo.storage declarations', () => {
    const modules = readSourceDeclarations();
    const declaring = modules.filter((m) => m.storage !== undefined || m.problems.length);

    it('some modules declare storage (the scan is not reading nothing)', () => {
        expect(declaring.length).toBeGreaterThan(10);
    });

    it('every storage block reads as one-line entries', () => {
        expect(modules.flatMap((m) => m.problems)).toEqual([]);
    });

    it('every entry is well formed', () => {
        const errors = declaring.flatMap((m) => (m.storage ?? [])
            .map((d, i) => declarationError(d, `${m.dir}.storage[${i}]`)).filter(Boolean));
        expect(errors).toEqual([]);
    });

    it('no key, prefix or pattern is declared twice', () => {
        const seen = new Map();
        const dupes = [];
        for (const m of declaring) {
            for (const d of m.storage ?? []) {
                const id = `${d.key !== undefined ? 'key' : d.prefix !== undefined ? 'prefix' : 'pattern'}:${d.key ?? d.prefix ?? d.pattern}`;
                if (seen.has(id)) dupes.push(`${id} (${seen.get(id)} and ${m.dir})`);
                else seen.set(id, m.dir);
            }
        }
        expect(dupes).toEqual([]);
    });

    it('every declared key / prefix / clearsWith key appears as a literal in some source file', () => {
        const texts = sourceTexts();
        const missing = [];
        for (const m of declaring) {
            for (const d of m.storage ?? []) {
                const literals = [d.key ?? d.prefix, ...(d.clearsWith ?? [])].filter(Boolean);
                for (const lit of literals) {
                    const found = texts.some((t) => t.text.includes(`'${lit}`) || t.text.includes(`"${lit}`)
                        || t.text.includes(`\`${lit}`));
                    if (!found) missing.push(`${m.dir}: ${lit}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});
