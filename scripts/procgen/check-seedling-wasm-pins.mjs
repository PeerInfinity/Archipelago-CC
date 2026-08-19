#!/usr/bin/env node
/**
 * check-seedling-wasm-pins — the gate on the seedling-wasm SUBMODULE's
 * contents. Node only, no browser, no dev server: it reads git and files.
 *
 * ── THE LAW IT ENFORCES ──────────────────────────────────────────────
 *
 *   A build is in the submodule iff a TRACKED file of THIS repository
 *   names it.
 *
 * Four independent views of "which builds are pinned" have to agree, and
 * the gate names the difference in whichever direction they don't:
 *
 *   REFERENCED  the build names this repo's tracked files actually spell
 *   WHITELIST   the `!/<name>/` lines in the submodule's .gitignore
 *   TRACKED     the directories git actually tracks in the submodule
 *   MANIFEST    the entries in the submodule's builds.json
 *
 * They are four views because each can rot on its own: a whitelist line
 * with no directory adds nothing, a directory with no whitelist line is
 * invisible, a manifest entry with neither is a lie, and a reference to
 * a build nobody shipped is a 404 on the live site — which is the exact
 * failure this whole submodule exists to retire.
 *
 * ── HOW "REFERENCED" IS ENUMERATED (a bounded sweep must say so) ──────
 *
 * Over TRACKED files under `frontend/`, `scripts/` and `docs/` only —
 * ⛔ NOT `CC/`, which is planning prose: a kickoff doc mentioning an old
 * build's path is not a claim that the site must serve it. Three
 * spellings, because all three occur here and a scan that knew only the
 * first missed a real pin once already:
 *
 *   1. the literal path      .../wasm/<name>
 *   2. a preset's wiring     "wasm": "<name>/game.html"
 *   3. a script's DEFAULT    process.env.SEEDLING_PAGE || '<name>'
 *
 * ⛔ Spelling 3 reads the DEFAULT, never the environment. The default is
 * the pin; SEEDLING_PAGE is only an override. Three check rows and one
 * probe pin their build this way and no other.
 *
 * ⛔ A build's payload filename is NOT its directory name. Alone among
 * the pinned builds, seedling_bot_ap_phase3/ carries seedling_bot_ap.js
 * and .wasm — the directory was renamed and the build was not. So the
 * gate reads the js name out of game.html's own <script src>, the way
 * the browser resolves it, and cross-checks builds.json against that.
 *
 * Run: node scripts/procgen/check-seedling-wasm-pins.mjs
 * Exit 0 all agree · 1 a named difference · 2 the submodule is absent.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SUB = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm');
const SCAN_ROOTS = ['frontend', 'scripts', 'docs'];
const TOP_LEVEL_FILES = ['.gitignore', 'LICENSE', 'README.md', 'builds.json'];

const problems = [];
const fail = (m) => problems.push(m);
const git = (args, cwd = REPO) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });

if (!existsSync(join(SUB, 'builds.json'))) {
    console.log(`SKIP: the seedling-wasm submodule is not checked out at ${SUB}`
        + ' — run `git submodule update --init frontend/modules/flashPanel/wasm`');
    process.exit(2);
}

const set = (xs) => new Set(xs);
const sorted = (s) => [...s].sort();
const diff = (a, b) => sorted(a).filter((x) => !b.has(x));

// ── view 1: REFERENCED ──────────────────────────────────────────────
// Read the tracked blobs through git so an untracked scratch file in the
// working tree can never create or remove a pin.
const referenced = new Map();   // name -> Set(spelling)
function note(name, how) {
    if (!referenced.has(name)) referenced.set(name, new Set());
    referenced.get(name).add(how);
}
const SPELLINGS = [
    [/(?:^|[^\w/])wasm\/(seedling_[a-z0-9_]+)/g, 'literal wasm/<name> path'],
    [/"wasm"\s*:\s*"(seedling_[a-z0-9_]+)\/game\.html"/g, 'preset flash_panel.wasm'],
    [/process\.env\.SEEDLING_PAGE\s*\|\|\s*'(seedling_[a-z0-9_]+)'/g, 'SEEDLING_PAGE default'],
];
const trackedFiles = git(['ls-files', '-z', '--', ...SCAN_ROOTS]).split('\0').filter(Boolean);
for (const rel of trackedFiles) {
    // The submodule is a gitlink, not a tree of blobs, so its own files are
    // not in this list — its README naming a build could never self-pin.
    let text;
    try { text = readFileSync(join(REPO, rel), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;   // binary
    for (const [re, how] of SPELLINGS) {
        re.lastIndex = 0;
        for (let m; (m = re.exec(text));) note(m[1], `${how} — ${rel}`);
    }
}
const REFERENCED = set(referenced.keys());

// ── view 2: WHITELIST ───────────────────────────────────────────────
const ignoreText = readFileSync(join(SUB, '.gitignore'), 'utf8');
const WHITELIST = set([...ignoreText.matchAll(/^!\/(seedling_[a-z0-9_]+)\/$/gm)].map((m) => m[1]));

// ── view 3: TRACKED (in the submodule) ──────────────────────────────
const subTracked = git(['ls-files', '-z'], SUB).split('\0').filter(Boolean);
const TRACKED = set(subTracked.filter((p) => p.includes('/')).map((p) => p.split('/')[0]));

// ── view 4: MANIFEST ────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(SUB, 'builds.json'), 'utf8'));
const MANIFEST = set(manifest.builds.map((b) => b.name));

// ── (a) the four views must agree ───────────────────────────────────
const VIEWS = [['REFERENCED', REFERENCED], ['WHITELIST', WHITELIST],
    ['TRACKED', TRACKED], ['MANIFEST', MANIFEST]];
console.log('# the four views');
for (const [label, s] of VIEWS) console.log(`  ${label.padEnd(11)} ${sorted(s).join(', ') || '(empty)'}`);

for (const [aL, a] of VIEWS) {
    for (const [bL, b] of VIEWS) {
        if (aL === bL) continue;
        for (const name of diff(a, b)) {
            if (aL === 'REFERENCED') {
                fail(`${name}: named by the tree, absent from ${bL} — `
                    + `${sorted(referenced.get(name)).join('; ')}`);
            } else if (bL === 'REFERENCED') {
                fail(`${name}: in ${aL}, but NO tracked file of this repo names it — retire it`);
            } else {
                fail(`${name}: in ${aL}, absent from ${bL}`);
            }
        }
    }
}

// ── (b)+(c) each pinned build's four files, and their md5s ──────────
const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
console.log('\n# per-build files and hashes');
for (const b of manifest.builds) {
    const d = join(SUB, b.name);
    if (!existsSync(d)) { fail(`${b.name}: manifest entry has no directory`); continue; }

    if (!existsSync(join(d, 'game.html'))) { fail(`${b.name}: no game.html`); continue; }
    const html = readFileSync(join(d, 'game.html'), 'utf8');
    const srcs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
    const glue = srcs.find((s) => s !== 'swf_bridge_avm2.js' && s.endsWith('.js'));
    if (!glue) { fail(`${b.name}: game.html names no emscripten glue script`); continue; }

    // ⛔ the AUTHORITY on the payload name is game.html, not the directory.
    if (b.js !== glue) {
        fail(`${b.name}: builds.json says js="${b.js}" but game.html loads "${glue}"`);
    }
    const wasmOfGlue = `${glue.slice(0, -3)}.wasm`;
    if (b.wasm !== wasmOfGlue) {
        fail(`${b.name}: builds.json says wasm="${b.wasm}" but the glue is "${glue}" (=> ${wasmOfGlue})`);
    }

    const want = ['game.html', 'swf_bridge_avm2.js', b.js, b.wasm];
    for (const f of want) {
        if (!existsSync(join(d, f))) fail(`${b.name}: missing ${f}`);
    }
    // exactly these four are TRACKED (extras on disk are fine and expected)
    const trackedHere = subTracked.filter((p) => p.startsWith(`${b.name}/`))
        .map((p) => p.slice(b.name.length + 1));
    for (const extra of trackedHere.filter((f) => !want.includes(f))) {
        fail(`${b.name}: tracks ${extra}, which is not one of the four files`);
    }
    for (const f of want.filter((f) => !trackedHere.includes(f))) {
        // A file that is simply absent is already reported above; this
        // branch is for the one on disk that git cannot see — a whitelist
        // gap, which is exactly how a build ships half-published.
        if (existsSync(join(d, f))) {
            fail(`${b.name}: ${f} is on disk but NOT tracked (whitelist gap?)`);
        }
    }

    const HASHES = [['gameHtmlMd5', 'game.html'], ['bridgeMd5', 'swf_bridge_avm2.js'],
        ['jsMd5', b.js], ['wasmMd5', b.wasm]];
    const line = [];
    for (const [key, f] of HASHES) {
        const p = join(d, f);
        if (!existsSync(p)) continue;
        const got = md5(p);
        if (b[key] !== got) fail(`${b.name}/${f}: md5 ${got} != manifest ${b[key]}`);
        if (key === 'wasmMd5') line.push(`${f} ${got}`);
    }
    for (const [f, n] of Object.entries(b.bytes ?? {})) {
        const p = join(d, f);
        if (!existsSync(p)) continue;
        const got = readFileSync(p).length;
        if (got !== n) fail(`${b.name}/${f}: ${got} bytes != manifest ${n}`);
    }
    if (!b.namedBy?.length) fail(`${b.name}: manifest entry names nobody in namedBy`);
    console.log(`  ${b.name.padEnd(24)} ${line.join('')}`);
}

// ── (d) nothing else is tracked in the submodule ────────────────────
const strays = subTracked.filter((p) => !p.includes('/') && !TOP_LEVEL_FILES.includes(p));
for (const s of strays) fail(`the submodule tracks an unexpected top-level file: ${s}`);
for (const f of TOP_LEVEL_FILES) {
    if (!subTracked.includes(f)) fail(`the submodule does not track ${f}`);
}

// ── verdict ─────────────────────────────────────────────────────────
console.log('');
if (problems.length === 0) {
    console.log(`ALL PASS — ${MANIFEST.size} pinned builds, four views in agreement`);
    process.exit(0);
}
console.log(`${problems.length} PROBLEM(S):`);
for (const p of problems) console.log(`  FAIL: ${p}`);
process.exit(1);
