/**
 * Read every module's `moduleInfo.storage` declarations from SOURCE (node only),
 * the way the Quick Launch pins read `docs` / `category`: importing the modules
 * would need a DOM. Used by storageDeclarationPins.test.js (shape) and
 * storageCensus.test.js (coverage).
 *
 * The format it reads is the one storageKinds.js documents: a `storage: [` line
 * inside the `export const moduleInfo = {…}` block, then one entry object per
 * line, closed by `],`. `STORAGE_KINDS.<name>` resolves through the real
 * constant. A line in the block that is not an entry, a comment or the closer is
 * reported as a problem, never skipped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';

export const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function evalEntry(text) {
    // The entry is a literal object of strings, arrays of strings and STORAGE_KINDS.<x>.
    // eslint-disable-next-line no-new-func
    return new Function('STORAGE_KINDS', `"use strict"; return (${text});`)(STORAGE_KINDS);
}

/**
 * [{ moduleId, owner, storage: [...] | undefined, problems: [...] }] for every
 * `modules/<dir>/index.js` with a moduleInfo block.
 */
export function readSourceDeclarations(modulesDir = MODULES_DIR) {
    const out = [];
    for (const dir of readdirSync(modulesDir, { withFileTypes: true })) {
        const file = join(modulesDir, dir.name, 'index.js');
        if (!dir.isDirectory() || !existsSync(file)) continue;
        const text = readFileSync(file, 'utf8');
        const start = text.indexOf('export const moduleInfo');
        if (start === -1) continue;
        const end = text.indexOf('\n};', start);
        const block = text.slice(start, end === -1 ? undefined : end);
        const name = block.match(/^\s*name\s*:\s*['"]([^'"]+)['"]/m)?.[1] ?? dir.name;
        const title = block.match(/^\s*title\s*:\s*['"]([^'"]+)['"]/m)?.[1] ?? null;
        const entry = { moduleId: name, dir: dir.name, owner: title || name, storage: undefined, problems: [] };
        const lines = block.split('\n');
        const at = lines.findIndex((l) => /^\s*storage\s*:/.test(l));
        if (at !== -1) {
            if (!/^\s*storage\s*:\s*\[\s*$/.test(lines[at])) {
                entry.problems.push(`${dir.name}: "storage:" must open a list on its own line ("storage: [")`);
            } else {
                entry.storage = [];
                let closed = false;
                for (let i = at + 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line === '],' || line === ']') { closed = true; break; }
                    if (line === '' || line.startsWith('//')) continue;
                    if (!line.startsWith('{') || !/},?$/.test(line)) {
                        entry.problems.push(`${dir.name}: line ${i + 1} of moduleInfo is not a one-line entry: ${line}`);
                        continue;
                    }
                    try {
                        entry.storage.push(evalEntry(line.replace(/,$/, '')));
                    } catch (e) {
                        entry.problems.push(`${dir.name}: entry does not parse (${e.message}): ${line}`);
                    }
                }
                if (!closed) entry.problems.push(`${dir.name}: the storage list is not closed with "],"`);
            }
        }
        out.push(entry);
    }
    return out;
}
