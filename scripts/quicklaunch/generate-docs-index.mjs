#!/usr/bin/env node
/**
 * generate-docs-index — writes `frontend/modules/quickLaunch/generated/docsIndex.js`,
 * the list of user guides the Quick Launch panel links to (its Help group).
 *
 * One row per `docs/json/user/**\/*.md` (minus EXCLUDED_BASENAMES): `{ path, title, section, summary }`
 * where `path` is repo-relative, `title` is the file's first `# ` line (the file
 * name when it has none), `section` is the directory under `docs/json/` it sits
 * in (`user` or `user/modules`) and `summary` is its first paragraph as plain
 * text (`docSummary`; the Quick Launch cards view shows it). Rows are sorted by path.
 *
 * ⛓ WHEN TO RUN IT: after adding, removing, renaming or retitling any `.md`
 * under `docs/json/user/`. `generated.test.js` beside the output regenerates in
 * memory and fails when the committed file differs, so a guide edit that skips
 * this step is caught by the unit tests.
 *
 *     node scripts/quicklaunch/generate-docs-index.mjs          # write
 *     node scripts/quicklaunch/generate-docs-index.mjs --check  # exit 1 on drift
 *
 * It also writes `CATEGORY_ORDER`: the `## ` headings of docs/json/modules/README.md
 * that list modules, in README order — the vocabulary of `moduleInfo.category`
 * and the order of the Quick Launch "All panels" sub-groups. A heading whose
 * every bullet names a directory (`name/`) is excluded (see `isDirectoryBullet`).
 * ⛓ Also rerun after editing that README's `## ` headings.
 *
 * The browser never walks the directory: GitHub Pages serves no listing, and
 * the panel must work there too.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DOCS_ROOT = 'docs/json';
export const USER_DOCS_DIR = `${DOCS_ROOT}/user`;
export const OUTPUT = 'frontend/modules/quickLaunch/generated/docsIndex.js';
export const MODULES_README = `${DOCS_ROOT}/modules/README.md`;

/**
 * File names the walk skips wherever they sit. `TODO.md` under
 * docs/json/user/modules/ is a working list for developers, not a guide; the
 * Help group listed it as "User Guide TODO" until quick-launch Q2.
 */
export const EXCLUDED_BASENAMES = Object.freeze(['TODO.md']);

const toPosix = (p) => p.split(sep).join('/');

function walk(dir) {
    const out = [];
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(full));
        else if (ent.isFile() && ent.name.endsWith('.md') && !EXCLUDED_BASENAMES.includes(ent.name)) out.push(full);
    }
    return out;
}

/** The first `# ` heading, or the file's base name when it has none. */
export function docTitle(text, path) {
    const h1 = text.split('\n').find((line) => line.startsWith('# '));
    return h1 ? h1.slice(2).trim() : path.split('/').pop().replace(/\.md$/, '');
}

/** The longest `summary`, in characters; a longer first paragraph is cut at a word and ends in `…`. */
export const SUMMARY_MAX_LENGTH = 200;

/**
 * The first paragraph that is not a heading, as plain text: inline links keep
 * their text, `**` / `__` / `` ` `` are dropped, whitespace is collapsed, and
 * the result is capped at SUMMARY_MAX_LENGTH. '' when the file has none.
 */
export function docSummary(text) {
    const paragraph = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#')) ?? '';
    const plain = paragraph
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*|__|`/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (plain.length <= SUMMARY_MAX_LENGTH) return plain;
    const cut = plain.slice(0, SUMMARY_MAX_LENGTH - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.—-]+$/, '')}…`;
}

/** The rows, read off the tree at `repo`. */
export function buildDocsIndex(repo = REPO) {
    return walk(join(repo, USER_DOCS_DIR))
        .map((full) => {
            const path = toPosix(relative(repo, full));
            const text = readFileSync(full, 'utf8');
            return {
                path,
                title: docTitle(text, path),
                section: path.slice(DOCS_ROOT.length + 1, path.lastIndexOf('/')),
                summary: docSummary(text),
            };
        })
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * A README bullet that names a directory rather than a module: it opens with a
 * code span ending in `/`, bold or not (`- **\`shared/\`** — …`). The section
 * "Submodules and Non-Module Directories" is made only of these; no module
 * section has one.
 */
export function isDirectoryBullet(line) {
    return /^- (\*\*)?`[^`]+\/`/.test(line);
}

/** The `## ` headings of `text` whose bullets name modules, in order (see `isDirectoryBullet`). */
export function readmeCategories(text) {
    const sections = [];
    let current = null;
    for (const line of text.split('\n')) {
        if (line.startsWith('## ')) {
            current = { heading: line.slice(3).trim(), bullets: [] };
            sections.push(current);
        } else if (current && line.startsWith('- ')) {
            current.bullets.push(line);
        }
    }
    return sections
        .filter((s) => s.bullets.length > 0 && !s.bullets.every(isDirectoryBullet))
        .map((s) => s.heading);
}

/** The category vocabulary, read off the modules README at `repo`. */
export function buildCategoryOrder(repo = REPO) {
    return readmeCategories(readFileSync(join(repo, MODULES_README), 'utf8'));
}

/** The module text — no timestamp, so an unchanged tree is an unchanged file. */
export function renderDocsIndexModule(rows, categories) {
    return [
        '// GENERATED by scripts/quicklaunch/generate-docs-index.mjs — do not edit; regenerate.',
        '/**',
        ' * The user guides under docs/json/user/, one row per .md: { path, title, section, summary }.',
        ' * Read by the Quick Launch panel (its Help group, and to decide which',
        ' * `moduleInfo.docs` paths exist). Pinned by generated.test.js.',
        ' */',
        `export const DOCS_INDEX = Object.freeze(${JSON.stringify(rows, null, 4)}.map(Object.freeze));`,
        '',
        '/**',
        ` * The module categories: the \`## \` headings of ${MODULES_README} that list`,
        ' * modules, in README order. `moduleInfo.category` takes one of these',
        ' * (moduleCategoryPins.test.js); the "All panels" group is split by them.',
        ' */',
        `export const CATEGORY_ORDER = Object.freeze(${JSON.stringify(categories, null, 4)});`,
        '',
    ].join('\n');
}

function main(argv) {
    const rows = buildDocsIndex();
    const categories = buildCategoryOrder();
    const text = renderDocsIndexModule(rows, categories);
    const counts = `${rows.length} guides, ${categories.length} categories`;
    const outPath = join(REPO, OUTPUT);
    if (argv.includes('--check')) {
        let onDisk = null;
        try { onDisk = readFileSync(outPath, 'utf8'); } catch { /* missing = drift */ }
        if (onDisk !== text) {
            console.error(`DRIFT: ${OUTPUT} differs from what the generator writes — run it without --check.`);
            process.exit(1);
        }
        console.log(`OK: ${OUTPUT} is current (${counts}).`);
        return;
    }
    writeFileSync(outPath, text);
    console.log(`wrote ${OUTPUT} (${counts}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
