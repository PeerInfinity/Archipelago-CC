#!/usr/bin/env node
/**
 * generate-docs-index — writes `frontend/modules/quickLaunch/generated/docsIndex.js`,
 * the documents the Quick Launch panel links to (its Help group, and the `?`
 * link on each panel row).
 *
 * ⛓ THE DOCS TREE DECLARES WHAT IS LISTED — this file names no directory. A
 * directory under `docs/json/` is a Help SECTION iff its `README.md` carries the
 * marker line (HELP_MARKER_RE):
 *
 *     <!-- quick-launch-help: order=<int> audience=<user|developer|panel> -->
 *
 * The section's label is that README's H1; the README itself is the label, not
 * a row. `audience`: `user` sections are always drawn, `developer` ones only
 * when the panel's `showDeveloperDocs` setting is on, `panel` ones never (they
 * are indexed so the per-panel `?` links resolve — docs/json/user/modules). A
 * marker that is present but malformed FAILS the generator, naming the file.
 *
 * A section holds its own `.md` files and, per unmarked sub-directory, one CHILD:
 * `{ dir, label, docs, single }` — the child's docs are its whole subtree (minus
 * any marked directory inside it, which is a section of its own), its label is
 * its README's H1 (the directory name when it has none), and `single` is true
 * when it holds exactly one doc (the panel draws it as one row, not a fold). A
 * marked directory inside a marked one is always its own section.
 *
 * ⛓ A section with no sub-directories may instead be SUB-GROUPED BY ITS README
 * (quick-launch P7 — no file moves: moving the docs would break every inbound
 * link). When the README lists docs of its own directory under `## ` headings —
 * a bullet (`-` or `*`) whose FIRST link targets a `.md` directly in the
 * directory (`./x.md` or `x.md`; `../`, sub-paths and non-docs are ignored) — the
 * section's `docs` is empty and its `children` are one per such heading, in
 * README order, holding the docs in bullet order (a doc listed twice stays under
 * its first heading), with `heading: true`, `single: false` and `dir`
 * `<section dir>/<slug of the heading>` (the panel's group id). A heading that
 * lists none of the directory's docs (a "See Also" of `../` links, prose) is no
 * child. The docs the headings do not list come LAST, in a child labelled
 * UNLISTED_LABEL (slug `unlisted`), in path order. A README without such
 * headings stays flat. ⛔ Sub-directories AND listing headings in one section is
 * refused, naming the README — the two rules would each claim the docs (no
 * section has both; the refusal is the precedence).
 *
 * Output: `DOCS_INDEX`, one row per listed doc — `{ path, title, section, summary }`
 * where `path` is repo-relative, `title` is the file's first `# ` line (the file
 * name when it has none), `section` is its directory relative to `docs/json/`
 * (`user`, `games/apcalc`, …) and `summary` is its first paragraph as plain text
 * (`docSummary`; the cards view shows it); sorted by path. And `HELP_SECTIONS`,
 * the tree above (`buildHelpSections`), sorted by `order`.
 *
 * ⛓ WHEN TO RUN IT: after adding, removing, renaming or retitling any `.md`
 * in a marked directory, or adding / changing a marker. `generated.test.js`
 * beside the output regenerates in memory and fails when the committed file
 * differs, so an edit that skips this step is caught by the unit tests.
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
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DOCS_ROOT = 'docs/json';
export const OUTPUT = 'frontend/modules/quickLaunch/generated/docsIndex.js';
export const MODULES_README = `${DOCS_ROOT}/modules/README.md`;

/**
 * File names the walk skips wherever they sit. `TODO.md` under
 * docs/json/user/modules/ is a working list for developers, not a guide; the
 * Help group listed it as "User Guide TODO" until quick-launch Q2.
 */
export const EXCLUDED_BASENAMES = Object.freeze(['TODO.md']);

const toPosix = (p) => p.split(sep).join('/');

/** The file whose marker line makes its directory a Help section. */
export const SECTION_README = 'README.md';

/** Who a section is drawn for (see the file's docblock). */
export const HELP_AUDIENCES = Object.freeze({ user: 'user', developer: 'developer', panel: 'panel' });

/** A line that claims to be a marker; one that then fails HELP_MARKER_RE is an error, not a miss. */
export const HELP_MARKER_PREFIX = '<!-- quick-launch-help';
export const HELP_MARKER_RE = /^<!-- quick-launch-help: order=(-?\d+) audience=(user|developer|panel) -->$/;

/**
 * The marker in a README's text: `{ order, audience }`, or null when it has
 * none. Throws (naming `file`) on a malformed marker or on two of them.
 */
export function parseHelpMarker(text, file) {
    const claims = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith(HELP_MARKER_PREFIX));
    if (claims.length === 0) return null;
    if (claims.length > 1) throw new Error(`${file}: ${claims.length} quick-launch-help markers (one allowed)`);
    const m = claims[0].match(HELP_MARKER_RE);
    if (!m) {
        throw new Error(`${file}: malformed quick-launch-help marker "${claims[0]}" — expected `
            + '"<!-- quick-launch-help: order=<int> audience=<user|developer|panel> -->"');
    }
    return { order: Number(m[1]), audience: m[2] };
}

const isDoc = (ent) => ent.isFile() && ent.name.endsWith('.md') && !EXCLUDED_BASENAMES.includes(ent.name);
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const readText = (full) => { try { return readFileSync(full, 'utf8'); } catch { return null; } };

/** The marker of `dir`'s README (null when it has no README or no marker). */
function markerOf(repo, dir) {
    const file = `${dir}/${SECTION_README}`;
    const text = readText(join(repo, file));
    return text === null ? null : parseHelpMarker(text, file);
}

/** Repo-relative sub-directories of `dir`, by name. */
function subdirs(repo, dir) {
    return readdirSync(join(repo, dir), { withFileTypes: true })
        .filter((e) => e.isDirectory()).map((e) => `${dir}/${e.name}`).sort(byText);
}

/** The child that holds a README-sub-grouped section's docs its headings do not list (it comes last). */
export const UNLISTED_LABEL = 'Unlisted';

/** A heading's (or category's) id segment: lower case, runs of anything else as one `-`. */
export function headingSlug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** A bullet line (`-` / `*`, any indent) and its first markdown link's target. */
const BULLET_RE = /^\s*[-*]\s/;
const FIRST_LINK_RE = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/;

/**
 * The `## ` headings of a section README that list docs of `dir` itself, in
 * README order: `[{ heading, docs }]`, `docs` repo-relative in bullet order.
 * `ownDocs` is the set of the directory's docs (a link to anything else is
 * ignored); a doc listed under two headings stays under the first. A heading
 * listing none is left out. See the docblock's README sub-grouping rule.
 */
export function readmeHeadingGroups(text, dir, ownDocs) {
    const own = new Set(ownDocs);
    const seen = new Set();
    const groups = [];
    let current = null;
    for (const line of text.split('\n')) {
        if (line.startsWith('## ')) {
            current = { heading: line.slice(3).trim(), docs: [] };
            groups.push(current);
            continue;
        }
        if (!current || !BULLET_RE.test(line)) continue;
        const target = line.match(FIRST_LINK_RE)?.[1].split('#')[0].replace(/^\.\//, '');
        if (!target || target.includes('/')) continue;
        const path = `${dir}/${target}`;
        if (!own.has(path) || seen.has(path)) continue;
        seen.add(path);
        current.docs.push(path);
    }
    return groups.filter((g) => g.docs.length > 0);
}

/** Repo-relative docs directly in `dir`. */
function ownDocs(repo, dir) {
    return readdirSync(join(repo, dir), { withFileTypes: true }).filter(isDoc).map((e) => `${dir}/${e.name}`);
}

/** The docs of `dir`'s subtree, stopping at marked directories (they are sections of their own). */
function subtreeDocs(repo, dir) {
    const out = ownDocs(repo, dir);
    for (const sub of subdirs(repo, dir)) if (!markerOf(repo, sub)) out.push(...subtreeDocs(repo, sub));
    return out.sort(byText);
}

/** Every marked directory under `root` (repo-relative), each with its marker. */
function markedDirs(repo, root) {
    const out = [];
    const visit = (dir) => {
        const marker = markerOf(repo, dir);
        if (marker) out.push({ dir, ...marker });
        for (const sub of subdirs(repo, dir)) visit(sub);
    };
    visit(root);
    return out;
}

/** A directory's label: its README's H1, or its name. */
function dirLabel(repo, dir) {
    const text = readText(join(repo, dir, SECTION_README));
    const h1 = text?.split('\n').find((line) => line.startsWith('# '));
    return h1 ? h1.slice(2).trim() : basename(dir);
}

const docsRel = (dir) => dir.slice(DOCS_ROOT.length + 1);

/**
 * The Help sections read off the tree at `repo` under `root`, by `order` then
 * directory: `[{ dir, label, order, audience, docs, children: [{ dir, label, docs, single }] }]`,
 * `dir` relative to docs/json, `docs` repo-relative paths in path order.
 */
export function buildHelpSections(repo = REPO, root = DOCS_ROOT) {
    return markedDirs(repo, root)
        .map(({ dir, order, audience }) => {
            const docs = ownDocs(repo, dir).filter((p) => basename(p) !== SECTION_README).sort(byText);
            const children = subdirs(repo, dir)
                .filter((sub) => !markerOf(repo, sub))
                .map((sub) => {
                    const subDocs = subtreeDocs(repo, sub);
                    return { dir: docsRel(sub), label: dirLabel(repo, sub), docs: subDocs, single: subDocs.length === 1 };
                })
                .filter((child) => child.docs.length > 0);
            const readme = `${dir}/${SECTION_README}`;
            const headings = readmeHeadingGroups(readText(join(repo, readme)) ?? '', dir, docs);
            const section = { dir: docsRel(dir), label: dirLabel(repo, dir), order, audience };
            if (!headings.length) return { ...section, docs, children };
            if (children.length) {
                throw new Error(`${readme}: lists its docs under ## headings AND has sub-directories `
                    + `(${children.map((c) => c.dir).join(', ')}) — a section is sub-grouped by one or the other`);
            }
            const listed = new Set(headings.flatMap((g) => g.docs));
            const unlisted = docs.filter((p) => !listed.has(p));
            const groups = unlisted.length ? [...headings, { heading: UNLISTED_LABEL, docs: unlisted }] : headings;
            return {
                ...section,
                docs: [],
                children: groups.map((g) => ({
                    dir: `${section.dir}/${headingSlug(g.heading)}`, label: g.heading, heading: true, docs: g.docs, single: false,
                })),
            };
        })
        .sort((a, b) => a.order - b.order || byText(a.dir, b.dir));
}

/** Every doc path a section lists, own and children's. */
export function sectionDocPaths(section) {
    return [...section.docs, ...section.children.flatMap((c) => c.docs)];
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

/** The rows, one per doc a section lists (`sections` from `buildHelpSections`), by path. */
export function buildDocsIndex(repo = REPO, sections = buildHelpSections(repo)) {
    return sections.flatMap(sectionDocPaths)
        .map((path) => {
            const text = readFileSync(join(repo, path), 'utf8');
            return {
                path,
                title: docTitle(text, path),
                section: path.slice(DOCS_ROOT.length + 1, path.lastIndexOf('/')),
                summary: docSummary(text),
            };
        })
        .sort((a, b) => byText(a.path, b.path));
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
export function renderDocsIndexModule(rows, categories, sections) {
    return [
        '// GENERATED by scripts/quicklaunch/generate-docs-index.mjs — do not edit; regenerate.',
        '/**',
        ' * Every doc a Help section lists, one row per .md: { path, title, section, summary }.',
        ' * Read by the Quick Launch panel (its Help group, and to decide which',
        ' * `moduleInfo.docs` paths exist). Pinned by generated.test.js.',
        ' */',
        `export const DOCS_INDEX = Object.freeze(${JSON.stringify(rows, null, 4)}.map(Object.freeze));`,
        '',
        '/**',
        ' * The Help sections: each docs/json directory whose README carries the',
        ' * `quick-launch-help` marker, by `order` — { dir, label, order, audience, docs,',
        ' * children: [{ dir, label, docs, single, heading? }] } (a child per sub-directory, or',
        ' * per README `## ` heading when `heading` is true). See the generator\'s docblock.',
        ' */',
        `export const HELP_SECTIONS = Object.freeze(${JSON.stringify(sections, null, 4)});`,
        '',
        '/**',
        ` * The module categories: the \`## \` headings of ${MODULES_README} that list`,
        ' * modules, in README order. `moduleInfo.category` takes one of these',
        ' * (moduleCategoryPins.test.js); the "All panels" group is split by them.',
        ' */',
        `export const CATEGORY_ORDER = Object.freeze(${JSON.stringify(categories, null, 4)});`,
        '',
        '/** The label of the child holding the docs a README-sub-grouped section\'s headings do not list (last). */',
        `export const UNLISTED_LABEL = ${JSON.stringify(UNLISTED_LABEL)};`,
        '',
    ].join('\n');
}

function main(argv) {
    const sections = buildHelpSections();
    const rows = buildDocsIndex(REPO, sections);
    const categories = buildCategoryOrder();
    const text = renderDocsIndexModule(rows, categories, sections);
    const counts = `${rows.length} docs, ${sections.length} sections, ${categories.length} categories`;
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
