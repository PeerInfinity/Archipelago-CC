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
 * ⛓ AND EACH MANIFEST ENTRY DECLARES ITS `capabilities` (slice P1-a): a
 * mandatory array whose names are ⊆ the vocabulary the CONSUMER declares
 * (`frontend/modules/flashPanel/seedlingRandomizerEligibility.js`), imported
 * here rather than restated. See the row's own note for why absence and a
 * typo are the same silent failure.
 *
 * ⛓⛓ AND TWO ROWS ARE KEYED ON A CAPABILITY'S *ABSENCE* — (f) for `apitem`
 * and (g) for `arm`. Both exist because the four-way law above answers *does
 * SOMEBODY name this build*, never *does the RIGHT somebody*. A control build
 * is pinned in order to be the negative half of a pair, and it stops being one
 * silently: every view stays in agreement, every row goes green, and the pair
 * has quietly become two copies of the same arm.
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
 *   4. a BARE constant       PAGE_NAME = '<name>'
 *
 * …over a text in which ADJACENT STRING LITERALS HAVE BEEN JOINED FIRST.
 * That is not a fifth spelling, it is the repair of a blind spot in the
 * first: seven probes write the URL as
 *
 *     const PAGE_URL = 'http://localhost:8000/…/flashPanel/wasm/'
 *         + '<name>/game.html';
 *
 * and the line break falls EXACTLY on the `wasm/` boundary, so spelling 1 —
 * which needs `wasm/` and the name adjacent — matched none of them. Seven
 * tracked files loaded a build and the gate could not see one of them. The
 * scan now collapses `' + '` (and `" + "`) before matching, so a reference
 * assembled from adjacent literals reads the same as one written whole.
 *
 * ⛔ Spelling 3 reads the DEFAULT, never the environment. The default is
 * the pin; SEEDLING_PAGE is only an override.
 *
 * ⛓ SPELLING 4 WAS A HOLE, FOUND BY THE SLICE THAT RETIRED A BUILD.
 * Twenty-three probes and solvers wrote `const PAGE_NAME = '<name>';` — no
 * `wasm/` path, no `process.env`, nothing spellings 1-3 can see. They are all
 * on the composed form now, so spelling 3 covers them today; the spelling
 * stays anyway, because the failure it enables is the bad kind. The
 * three literal path references could be removed while 23 files went on
 * loading that build, and the gate would have reported it UNREFERENCED and
 * cleared it for retirement. (⚠ This paragraph cannot SPELL the example, and
 * finding that out was the joke's punchline: written with the path in it,
 * this docblock matched spelling 1 and pinned a retired build from inside the
 * gate that reads it.) Same lesson as the `_phase3`
 * miss (§18.13): a reference is a reference however it is spelled.
 *
 * ⚠ SCOPED TO `PAGE_NAME`, deliberately, and that is measured rather than
 * cautious. The general form — any quoted `'seedling_*'` — matches
 * `PRESET_ID = 'seedling_atlas_maze'` in check-seedling-atlas-maze.mjs,
 * which is a PRESET, not a build directory, and would invent a pin for a
 * build that does not exist. Scoped to `PAGE_NAME` the sweep over the tracked
 * tree returns exactly the 23 files and exactly one build name.
 *
 * ⛔ A build's payload filename is NOT its directory name. Alone among
 * the pinned builds, seedling_bot_ap_phase3/ carries seedling_bot_ap.js
 * and .wasm — the directory was renamed and the build was not. So the
 * gate reads the js name out of game.html's own <script src>, the way
 * the browser resolves it, and cross-checks builds.json against that.
 *
 * ── WHAT DERIVATION CANNOT SEE, THIS GATE SAYS ───────────────────────
 *
 * ⛓ ROW (h2) READS EVERY GATE'S SOURCE AND NEVER IMPORTS ONE, so no rule in
 * `rowInputKey.js` can find them: a `.mjs` named by a literal is population
 * 1's business and arrives there only by being IMPORTED, and (h2)'s list is
 * built at run time from the tracked tree rather than spelled. MEASURED at
 * this head, before the declaration below: `check-seedling-wasm-pages.mjs`
 * and `check-seedling-bot-differential.mjs` were in NO population of this
 * row's key — so the exact edit (h2) exists to catch would not have re-run it.
 *
 * ⛔ DECLARED `data`, NOT `code`: what this row reads is their BYTES. Pulling
 * their import closures in would key this gate on most of the tree to answer
 * a question about two string literals.
 *
 * @key-inputs data: scripts/procgen/check-*.mjs
 * @key-inputs data: scripts/procgen/check-seedling-bot-differential.mjs
 *
 * Run: node scripts/procgen/check-seedling-wasm-pins.mjs
 * Exit 0 all agree · 1 a named difference · 2 the submodule is absent.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


import { argvHelp } from './argvHelp.js';
/**
 * ⛓ THE GATE MEMBERSHIP RULE, IMPORTED — row (h2) sweeps "every gate of this
 * repo", and `isGateFile` is where that sentence is already defined. A second
 * copy of `check-*.mjs` spelled here is the `scannable()` mistake again.
 * ⛔ The predicate only, never `gateRoster()`: this gate must not start
 * throwing because some other gate's CI header is malformed.
 */
import { SCRIPT_DIR, isGateFile } from './gateRoster.js';
/**
 * ⛓ THE CAPABILITY VOCABULARY, IMPORTED FROM ITS ONE CONSUMER — never a
 * second copy spelled here. A gate spelled differently from the code it
 * gates tests itself; this file already learned that with `scannable()`,
 * whose duplicate inside `--self-test` left a mutant green.
 */
import { AP_ITEM_CAPABILITY, ARM_CAPABILITY, WASM_BUILD_CAPABILITIES }
    from '../../frontend/modules/flashPanel/seedlingRandomizerEligibility.js';

argvHelp(import.meta.url);
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
    // ⛔ THE LOOKBEHIND IS THE FIX FOR A GATE THAT MATCHED ALMOST NOTHING.
    // This was `(?:^|[^\w/])wasm\/…`, and the `/` inside that negative class
    // excluded the one character that ALWAYS precedes this path in real code:
    // the separator. Measured — `'../flashPanel/wasm/<name>/game.html'`,
    // `frontend/modules/flashPanel/wasm/<name>/` and the localhost URL all
    // failed it; the only thing it ever matched was prose writing `wasm/<name>`
    // with nothing in front. `-` stays excluded so a hypothetical `not-wasm/`
    // directory cannot pass as this one.
    [/(?<![\w-])wasm\/(seedling_[a-z0-9_]+)/g, 'literal wasm/<name> path'],
    [/"wasm"\s*:\s*"(seedling_[a-z0-9_]+)\/game\.html"/g, 'preset flash_panel.wasm'],
    [/process\.env\.SEEDLING_PAGE\s*\|\|\s*'(seedling_[a-z0-9_]+)'/g, 'SEEDLING_PAGE default'],
    [/PAGE_NAME\s*=\s*'(seedling_[a-z0-9_]+)'/g, 'bare PAGE_NAME constant'],
];
/**
 * ⛓⛓ ONE SEEN/NOT-SEEN CASE PER SPELLING — `--self-test`.
 *
 * ⛔ THE SCAN NEEDS THIS BECAUSE THE SCAN IS WHERE THE BUGS WERE. Every view
 * but REFERENCED reads a list: the whitelist's lines, `git ls-tree`, the
 * manifest's names. REFERENCED reads PROSE AND CODE with regexes, and it was
 * wrong three times in two slices — the `_phase3` composed default (§18.13),
 * then the `/` in spelling 1's negative class and the concatenated URL, both
 * found only because a build was being retired and someone asked which files
 * actually named it. A blind scan does not red; it QUIETLY SHRINKS the
 * referenced set, which reads as "this build is free to retire".
 *
 * Each case is a string lifted from real code, with the build name replaced
 * by a probe name that exists nowhere else, so a case cannot pass by
 * accidentally matching the tree. The NOT-SEEN cases are the other half: a
 * spelling that matched everything would satisfy every SEEN case.
 *
 * Run: node scripts/procgen/check-seedling-wasm-pins.mjs --self-test
 */
/**
 * ⛓ ONE normaliser, used by the scan AND by `--self-test`.
 *
 * ⛔ It was two — the self-test carried its own copy of the `' + '` join, so
 * a mutant that disabled the production one left the self-test GREEN. A
 * detector spelled differently from the path it is meant to detect tests
 * itself; caught by running that very mutant and finding it inert.
 */
function scannable(text) {
    return text.replace(/'\s*\+\s*'/g, '').replace(/"\s*\+\s*"/g, '');
}

const SELF_TEST = [
    // spelling 1 — the forms that were ALL invisible until 2026-08-19
    ["const WASM_PAGE = '../flashPanel/wasm/seedling_probe_x/game.html';", 'seedling_probe_x'],
    [' *     frontend/modules/flashPanel/wasm/seedling_probe_x/', 'seedling_probe_x'],
    ['http://localhost:8000/frontend/modules/flashPanel/wasm/seedling_probe_x/game.html', 'seedling_probe_x'],
    ['`wasm/seedling_probe_x/game.html`', 'seedling_probe_x'],
    // spelling 1, assembled from adjacent literals across a line break —
    // seven probes write it exactly this way
    ["const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'\n    + 'seedling_probe_x/game.html';", 'seedling_probe_x'],
    ['const U = "…/flashPanel/wasm/" + "seedling_probe_x/game.html";', 'seedling_probe_x'],
    // spelling 2 — a preset's wiring
    ['      "wasm": "seedling_probe_x/game.html",', 'seedling_probe_x'],
    // spelling 3 — the composed default
    ["const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_probe_x';", 'seedling_probe_x'],
    // spelling 4 — the bare constant
    ["const PAGE_NAME = 'seedling_probe_x';", 'seedling_probe_x'],
];
const SELF_TEST_NOT_SEEN = [
    // `-` must stay excluded, or a differently-named directory passes as this one
    ['some/not-wasm/seedling_probe_x/game.html', 'a not-wasm/ directory'],
    ['somewasm/seedling_probe_x/', 'a name merely ENDING in wasm'],
    // ⛔ THE RULE THAT KEEPS THE HISTORICAL BUILDS OUT: an env EXAMPLE in a
    // docblock is not a pin. Only a DEFAULT is. Widening spelling 4 to any
    // quoted name would break this, and would also match PRESET_ID.
    [' *   SEEDLING_PAGE=seedling_probe_x node scripts/procgen/…', 'an env example in prose'],
    ["const PRESET_ID = 'seedling_probe_x';", 'a PRESET id, which is not a build'],
];
if (process.argv.includes('--self-test')) {
    let bad = 0;
    const scan = (text) => {
        const t = scannable(text);
        const hits = new Set();
        for (const [re, how] of SPELLINGS) {
            re.lastIndex = 0;
            for (let m; (m = re.exec(t));) hits.add(`${m[1]}|${how}`);
        }
        return hits;
    };
    for (const [text, want] of SELF_TEST) {
        const hit = [...scan(text)].some((h) => h.startsWith(`${want}|`));
        console.log(`${hit ? 'PASS' : 'FAIL'}: SEEN — ${text.replace(/\n/g, ' ⏎ ').slice(0, 92)}`);
        if (!hit) bad++;
    }
    for (const [text, why] of SELF_TEST_NOT_SEEN) {
        const hit = scan(text).size > 0;
        console.log(`${hit ? 'FAIL' : 'PASS'}: NOT SEEN (${why}) — ${text.slice(0, 76)}`);
        if (hit) bad++;
    }
    console.log(bad === 0
        ? `\nSELF-TEST ALL PASS — ${SELF_TEST.length} seen, ${SELF_TEST_NOT_SEEN.length} not seen`
        : `\n${bad} SELF-TEST FAILURE(S)`);
    process.exit(bad === 0 ? 0 : 1);
}

const trackedFiles = git(['ls-files', '-z', '--', ...SCAN_ROOTS]).split('\0').filter(Boolean);
for (const rel of trackedFiles) {
    /**
     * ⛔ THIS FILE IS EXCLUDED FROM ITS OWN SCAN, and that is not tidiness —
     * it is a defect this slice hit THREE TIMES before naming it.
     *
     * A gate that documents four spellings has to SPELL them, and the
     * `--self-test` fixtures above have to spell them in the exact forms the
     * scan must SEE. Both are documentation, neither loads anything, and both
     * read as references: twice a docblock example pinned a build that had
     * just been retired, and then the self-test fixtures pinned
     * `seedling_probe_x`, a build that has never existed — measured, the gate
     * failed on itself. A check script is not a consumer of a build; the
     * question this view asks is "what does the APP load", and the answer can
     * never be "the thing that asks the question".
     *
     * (The submodule needs no such exclusion: it is a gitlink, not a tree of
     * blobs, so its own files never appear in this list at all.)
     */
    if (rel === 'scripts/procgen/check-seedling-wasm-pins.mjs') continue;
    let text;
    try { text = readFileSync(join(REPO, rel), 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;   // binary
    // ⛓ JOIN ADJACENT STRING LITERALS BEFORE MATCHING. See the docblock:
    // a URL broken across a line at the `wasm/` boundary is the same
    // reference as one written on one line, and seven files wrote it that
    // way. This can only ever CREATE a match by making a build name
    // adjacent to the path that precedes it, which is exactly the case.
    text = scannable(text);
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

    /**
     * ── (e) ⚖ THE CAPABILITY DECLARATION (EDITOR INTEGRATION slice P1-a) ─
     *
     * ⚖ USER, 2026-08-29: a frontend feature detects from DATA whether it
     * applies, and the BUILD's half of that datum is this list. Two ways it
     * can rot, and both are silent at the consumer:
     *
     *   - a MISSING array reads as "this build has no capabilities", which is
     *     indistinguishable from a manifest that simply predates the field.
     *     The panel would quietly stop offering a feature a build really has,
     *     with no error anywhere. ⇒ the array is MANDATORY, and `[]` is the
     *     way a build says "measured, none".
     *   - a TYPO (`apitm`) is not a name the consumer looks for, so it means
     *     exactly what absence means. ⇒ every name must be in the vocabulary
     *     the consumer itself declares.
     */
    if (!Array.isArray(b.capabilities)) {
        fail(`${b.name}: no \`capabilities\` ARRAY — it is mandatory, and \`[]\` is how a `
            + 'build says "measured, none". An absent field is indistinguishable from that '
            + 'at the consumer, so the feature would vanish with no error');
    } else {
        for (const cap of b.capabilities.filter((c) => !WASM_BUILD_CAPABILITIES.includes(c))) {
            fail(`${b.name}: capability ${JSON.stringify(cap)} is not in the declared `
                + `vocabulary [${WASM_BUILD_CAPABILITIES.join(', ')}] — a name the consumer `
                + 'does not look for means exactly what absence means');
        }
        const dupes = b.capabilities.filter((c, i) => b.capabilities.indexOf(c) !== i);
        for (const d of new Set(dupes)) fail(`${b.name}: capability ${JSON.stringify(d)} twice`);
    }
    console.log(`  ${b.name.padEnd(24)} ${line.join('')}`
        + `  capabilities=[${(b.capabilities ?? []).join(', ')}]`);
}

/**
 * ── (f) ⚖ THE `apitem` CONTROL ARM MUST DRIVE A BUILD THAT LACKS `apitem` ──
 *   (EDITOR INTEGRATION slice P2, ⚖ user 2026-08-30 — "make p4d the default")
 *
 * ⛔ A DEFAULT MOVE IS NOT A RETIREMENT, AND VIEW (a) CANNOT TELL THEM APART.
 * P2 moved every remaining default onto the build that DECLARES `apitem`. The
 * four views stay in agreement while that happens — some other tracked file
 * still spells the older build somewhere — so nothing above notices when the
 * one reference that MATTERS goes.
 *
 * And exactly one does matter. `check-seedling-ap-placement.mjs` is built on
 * a PAIR: `Game.as`'s XML loop enumerates known element names, so on a build
 * with no `APItem` class an `<apitem>` element is IGNORED and the AP tile
 * reads EMPTY — that absence is the H7 discriminator, and P1-e's
 * `panel-control-p4c` arm is the same trick at the panel (the identical preset
 * with `flash_panel.wasm` moved back to a build declaring nothing: a lookup
 * that ignored `capabilities` would read *eligible* there and every row below
 * it would move). ⇒ point that file's page at a build carrying `apitem` and
 * both claims invert silently: every arm agrees, and the rows go green
 * BECAUSE the control stopped being one.
 *
 * ⛓ SO THE LAW IS KEYED ON THE CAPABILITY, NOT ON A BUILD NAME. p4c satisfies
 * it today; whoever retires p4c satisfies it by moving this default to another
 * build that declares no `apitem`, and the row says so rather than pinning a
 * name that would then have to be edited in two places. Same rule p4b's README
 * cell states in prose for the `arm` capability, which `builds.json` does not
 * declare and this gate therefore cannot check.
 *
 * ⚠ READ OFF THE TRACKED BLOB in the same spelling view (a) uses, so the
 * `SEEDLING_PAGE` default is the subject and an `SEEDLING_PAGE=` override at
 * run time is not — the default is the pin. Two independent sources: the
 * verifier's SOURCE and the submodule's MANIFEST. Neither reads the other, so
 * this is not a fixed point (trap 769).
 */
const CONTROL_FILE = 'scripts/procgen/check-seedling-ap-placement.mjs';
const CONTROL_SPELLING = /process\.env\.SEEDLING_PAGE\s*\|\|\s*'(seedling_[a-z0-9_]+)'/;
{
    let controlText = null;
    try { controlText = scannable(readFileSync(join(REPO, CONTROL_FILE), 'utf8')); } catch { /* below */ }
    const capsOf = (n) => manifest.builds.find((b) => b.name === n)?.capabilities ?? null;
    const named = controlText?.match(CONTROL_SPELLING)?.[1] ?? null;
    if (!trackedFiles.includes(CONTROL_FILE)) {
        fail(`${CONTROL_FILE} is not tracked — it is the ${AP_ITEM_CAPABILITY} CONTROL, `
            + 'and the H7 pair plus P1-e\'s panel control are the whole reason a build '
            + `declaring no ${AP_ITEM_CAPABILITY} stays pinned`);
    } else if (named === null) {
        fail(`${CONTROL_FILE} names no build in the SEEDLING_PAGE-default spelling — `
            + `the ${AP_ITEM_CAPABILITY} control arm has no subject, and its rows would go `
            + 'green by agreeing with themselves');
    } else if (capsOf(named) === null) {
        fail(`${CONTROL_FILE} drives ${named}, which is not in the manifest`);
    } else if (capsOf(named).includes(AP_ITEM_CAPABILITY)) {
        fail(`${CONTROL_FILE} drives ${named}, which DECLARES ${AP_ITEM_CAPABILITY} — `
            + `the control arm must drive a build that LACKS it (the H7 rows read the AP `
            + 'tile EMPTY, and P1-e\'s panel control asserts INELIGIBLE). Retiring the '
            + `build it used to drive means MOVING this default to another ${AP_ITEM_CAPABILITY}-less `
            + 'build, not deleting it');
    } else {
        console.log(`\n# the ${AP_ITEM_CAPABILITY} control`);
        console.log(`  ${CONTROL_FILE}`);
        console.log(`  drives ${named}, capabilities=[${capsOf(named).join(', ')}] `
            + `— no ${AP_ITEM_CAPABILITY}, so the ABSENT/PRESENT pair is still a pair`);
    }
}

/**
 * ── (g) ⚖ THE `arm` CONTROL — A BUILD THAT LACKS `arm` MUST STAY PINNED ──
 *   (EDITOR INTEGRATION slice P4, closing the residue §17.6.8 names)
 *
 * ⛔ THIS IS ROW (f)'s SHAPE WITHOUT ROW (f)'s DATUM, AND THE DIFFERENCE IS
 * WHY IT IS SHAPED DIFFERENTLY. `apitem` has a CONTROL FILE whose
 * `SEEDLING_PAGE` default names the build the control arm drives, so (f) can
 * read a default out of SOURCE and ask what the MANIFEST says about it. `arm`
 * has no such file: its two consumers are dead-frame corrections that read the
 * RUNTIME field off whatever build they happen to be driving —
 *
 *   `check-seedling-wasm-ship.mjs`  CLAIM 6, `wins[0]?.arm != null`
 *   `seedlingDemo/r5Acceptance.js`  `preSwapCorrection`,
 *                                   `walk?.status?.arm != null`
 *
 * — which is deliberate and is the RIGHT design (keying on a build NAME breaks
 * at the next rebuild; ⛓ R9 12g′ learned that one file over, where a driver's
 * `--arm-bound` asserted in prose that it could not fire on p4c and then
 * refused it four times out of four, because the code had no way to see which
 * build it was driving). But it means the thing that can rot is not a
 * spelling — it is the EXISTENCE of a build to drive.
 *
 * ⛔⛔ AND THE ROT IS SILENT AND FAVOURS GREEN. Both corrections are ternaries
 * on that read. Take the last `arm`-less build away and the FALSE branch is
 * unreachable: `armsAfterSwap ? 0 : BOOT_PRESWAP_FRAMES` is `0` forever,
 * `preSwapCorrection` is `BOOT_PRESWAP_FRAMES` forever, and both degrade to
 * "always subtract one" — which is EXACTLY the inversion `preSwapCorrection`'s
 * own docblock records its mutant going GREEN on, *because "always subtract
 * one" is accidentally correct on p4c*. Nothing reds. The whitelist admits the
 * directory it always did; the four views agree; a correction that used to be
 * proved is now merely assumed.
 *
 * ⇒ TWO CHECKS, and they read two independent sources so this is not a fixed
 * point (trap 769):
 *
 *   (g1) THE SITES STILL KEY ON THE FIELD. Read off the tracked blobs. A
 *        rewrite onto a build name, or a deletion, reds here — the regression
 *        this family keeps producing.
 *   (g2) THE MANIFEST STILL DECLARES A BUILD WITHOUT `arm`, and at least one
 *        such build is REFERENCED, i.e. actually available to drive. ⛓ View
 *        (a) cannot answer this: retiring the last `arm`-less build entirely —
 *        manifest, whitelist and directory together — leaves all four views in
 *        perfect agreement.
 *
 * ⚠ (g2) DOES NOT PIN A NAME. p4b satisfies it today; whoever retires p4b
 * satisfies it by leaving some other build without `arm`, and the row says so.
 */
const ARM_CORRECTIONS = [
    ['scripts/procgen/check-seedling-wasm-ship.mjs',
        /\?\.arm\s*!=\s*null/, 'CLAIM 6\'s `armsAfterSwap`'],
    ['frontend/modules/seedlingDemo/r5Acceptance.js',
        /\?\.arm\s*!=\s*null/, '`preSwapCorrection`'],
];
/**
 * ⛔ COMMENTS ARE STRIPPED BEFORE (g1) MATCHES, AND THAT IS THE DIFFERENCE
 * BETWEEN A REFERENCE AND A MENTION. Both files DOCUMENT the read at length —
 * `r5Acceptance.js` writes ``(`arm != null`)`` in the very docblock that
 * explains the direction — so a scan over raw text would go on passing after
 * the code under it was rewritten onto a build name, kept green by the prose
 * describing what the code used to do. MEASURED: with the read moved into a
 * docblock and the function keyed on a name, the raw-text form is GREEN and
 * this form REDS.
 *
 * ⚠ Deliberately conservative — block comments, and lines whose first non-space
 * is `//` or `*`. Nothing that could eat a `//` inside a string or a regex
 * literal, because a false STRIP here would red a correct file.
 */
function codeOnly(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !/^\s*(?:\/\/|\*)/.test(l)).join('\n');
}
{
    console.log(`\n# the ${ARM_CAPABILITY} control`);
    // (g1) the two correction sites still read the CAPABILITY, not a name.
    for (const [rel, re, what] of ARM_CORRECTIONS) {
        if (!trackedFiles.includes(rel)) {
            fail(`${rel} is not tracked — it carries one of the two ${ARM_CAPABILITY} `
                + 'corrections, whose negative arm is the whole reason a build declaring '
                + `no ${ARM_CAPABILITY} stays pinned`);
            continue;
        }
        let text = null;
        try { text = codeOnly(readFileSync(join(REPO, rel), 'utf8')); } catch { /* below */ }
        if (text === null || !re.test(text)) {
            fail(`${rel}: ${what} no longer reads the runtime \`${ARM_CAPABILITY}\` field `
                + `(${re}) — a correction keyed on a build NAME breaks at the next `
                + 'rebuild, and one that reads nothing is not a correction at all');
        } else {
            console.log(`  ${rel}\n    ${what} keys on the runtime `
                + `\`${ARM_CAPABILITY}\` field`);
        }
    }
    // (g2) …and the manifest still offers a build for that arm to be driven on.
    const without = manifest.builds
        .filter((b) => Array.isArray(b.capabilities)
            && !b.capabilities.includes(ARM_CAPABILITY))
        .map((b) => b.name);
    const drivable = without.filter((n) => REFERENCED.has(n));
    if (without.length === 0) {
        fail(`NO manifest build declares an absence of ${ARM_CAPABILITY} — the two `
            + 'corrections above are ternaries on that read, so their FALSE branch is now '
            + 'unreachable and both silently degrade to "always subtract one". That is the '
            + 'inversion `preSwapCorrection`\'s own mutant went GREEN on. Keep one build '
            + `without ${ARM_CAPABILITY}, or retire both corrections`);
    } else if (drivable.length === 0) {
        fail(`${without.join(', ')} declare${without.length === 1 ? 's' : ''} no `
            + `${ARM_CAPABILITY} but no tracked file of this repo names `
            + `${without.length === 1 ? 'it' : 'any of them'} — the negative arm exists in `
            + 'the manifest and cannot be driven');
    } else {
        console.log(`  ${drivable.join(', ')} declare${drivable.length === 1 ? 's' : ''} no `
            + `${ARM_CAPABILITY}, and ${drivable.length === 1 ? 'is' : 'are'} referenced `
            + '— so both corrections still have a negative arm to be proved on');
    }
}

/**
 * ── (h) ⚖ THE LAB'S BUILD LITERAL, MADE A *GATED* FIXED POINT ────────
 *   (maze-lab arms slice F-d, §17.1 row F8; ⚖ user 2026-09-02)
 *
 * ⛔ THE LITERAL STAYS A LITERAL. `watchWasm.js`'s `WASM_PAGE` is a hard-coded
 * path ON PURPOSE — its own docblock says why, and row (f)'s neighbourhood
 * says it again: a name composed from a variable is invisible to the
 * REFERENCED scan above and could clear a build for retirement while the lab
 * page still loaded it (trap 411). Importing it from `builds.json` would fix
 * the drift by deleting the pin. ⇒ this row does the other thing: it leaves
 * the literal alone and makes something CHECK it (trap 769 — a fixed point
 * tests self-consistency; a gate over two independent sources does not).
 *
 * ⛓ WHAT VIEW (a) CANNOT ANSWER, AGAIN. The four-way law asks *does SOMEBODY
 * name this build*. It cannot ask *does the LAB name the build its gates
 * certify*: 63 tracked files outside the submodule name the current build
 * (`git grep -l <name> -- ':!frontend/modules/flashPanel/wasm' | wc -l`, at
 * 086391b53), they agree only because EDITOR INTEGRATION slice P2 hand-edited
 * them in one pass, and if the lab's literal and a certifying gate's default
 * drifted apart every view would stay in perfect agreement. Rows (f) and (g)
 * exist for that same shape of hole keyed on a CAPABILITY's absence; this one
 * is keyed on the AGREEMENT of two sources neither of which reads the other.
 *
 * ── (h1) THE LITERAL NAMES A MANIFEST BUILD ──────────────────────────
 * Parsed off the tracked file with the gate's OWN `SPELLINGS[0]` — reused,
 * never restated (`scannable()` learned that lesson one screen up: a detector
 * spelled twice tests itself). So (h1) also asserts the literal is still
 * written in the one spelling the REFERENCED scan can SEE, which is the whole
 * reason it is a literal. Then: the name is in the MANIFEST, and the file the
 * path actually resolves to exists. ⛔ Not the bytes — (b)/(c) own those.
 * This row owns the JOIN.
 *
 * ── (h2) THE LAB'S BUILD IS THE BUILD ITS CERTIFIERS DRIVE ───────────
 * ⛓ THE SUBJECT SET IS DERIVED, WITH ONE NAMED ADDITION.
 *
 *   DERIVED — every gate of this repo (`isGateFile`, imported: the ONE
 *   membership rule, `check-*.mjs` under `scripts/procgen/`) whose CODE spells
 *   a MANIFEST build name. Comments are stripped first, with (g1)'s
 *   `codeOnly`, and that is load-bearing rather than tidy: the ONE build name
 *   in `check-seedling-wasm-ship.mjs` is a sentence in a docblock about a
 *   reading taken on another build years ago, and historical prose is not a
 *   pin. Bounded to the manifest's own names, so this sweep can never invent
 *   a build the way a general `'seedling_*'` would (`PRESET_ID =
 *   'seedling_atlas_maze'`, the docblock above records it).
 *
 *   NAMED — `check-seedling-bot-differential.mjs`. It is a `verify-`, so the
 *   membership rule cannot see it, and it is the one instrument that drives
 *   the lab's build tick for tick against the JS model. A named subject that
 *   stops being tracked `fail()`s here rather than vanishing, exactly as (f)'s
 *   control file and (g1)'s two correction sites do.
 *
 * ⛔ EXCLUDED, AND WHY — A GATE THAT GOES *THROUGH* THE LITERAL IS NOT A
 * SUBJECT. `check-seedling-wasm-ship.mjs` and `check-seedling-wasm-element.mjs`
 * boot `watch.html` and inherit whatever `WASM_PAGE` says; the ~17
 * `check-seedling-editor-*.mjs` do the same. They cannot DISAGREE with the
 * lab, so asserting they agree would be the fixed point this row exists to
 * avoid. Measured at 086391b53: 4 of the 33 roster gates spell a build in
 * code — this gate is excluded from its own sweep for the reason the
 * REFERENCED scan excludes it, and the other three are the `windows` gates
 * that drive the build directly. The panel's preset default
 * (`procgenPipeline/regionAtlasCompiler.js`, `wasm: '<name>/game.html'`) is
 * NOT a subject either, in the other direction: the panel is DATA-driven and
 * capability-gated at run time by `seedlingRandomizerEligibility.js`, so its
 * wiring default is a preset's datum, not a claim about the lab.
 *
 * ⛔ THE DEFAULT IS THE PIN. `SEEDLING_PAGE=` at run time is an override and
 * is not the subject — row (f)'s rule, and the same reason it is spelled
 * there.
 *
 * ── (h3) THE CAPABILITIES THE LAB'S BUILD MUST DECLARE — MEASURED ─────
 * ⛓ NONE, AND THAT IS A MEASUREMENT, NOT AN OMISSION. The lab's own source
 * keys on no capability BY NAME (`grep -n '\.arm\b\|armed_at\|apitem'
 * frontend/modules/seedlingDemo/*.js` minus tests: `r5Acceptance.js`'s
 * `preSwapCorrection` reads the RUNTIME `status.arm` field and tolerates its
 * absence — which is row (g1)'s subject, not this one). So whether the lab
 * NEEDS a capability is a question about its GATES' rows, and F-d answered it
 * by running them: `WASM_PAGE` pointed at the manifest build declaring `[]`
 * and `check-seedling-wasm-pages.mjs --root=…/frontend` run once, against a
 * control run of the same gate on the current build.
 *
 *     control (build declaring [arm, apitem])   20 PASS / 0 FAIL
 *     arm     (build declaring [])              19 PASS / 1 FAIL
 *
 * The one row that moved is `watch.html pointed its iframe at the game page`
 * — the pages gate comparing the iframe src against its OWN `BUILD` literal,
 * i.e. (h2)'s disagreement showing up in a browser, in the only row that can
 * see it and phrased as *the page pointed somewhere else*. Every
 * capability-bearing row — the three ▶ ship arms, the drain, the per-tick
 * wasm verdict — stayed GREEN on a build declaring nothing. ⇒ (h3) ASSERTS
 * NOTHING and prints what it measured. Whoever gives the lab a capability
 * dependency turns this paragraph into a check and names the rows that moved.
 *
 * ⛓ WHAT THIS BUYS, STATED SO IT CAN BE ARGUED WITH: the 3.5-minute browser
 * row above sees the disagreement only for the gate that boots the lab page,
 * and reports it as a page fault. (h2) answers the same question in 2.5 s off
 * the source, names BOTH files, and covers the certifiers no browser row
 * reaches at all.
 */
const LAB_FILE = 'frontend/modules/seedlingDemo/watchWasm.js';
const LAB_SPELLING = /export const WASM_PAGE\s*=\s*'([^']*)'/;
/** ⛓ Certifiers the `check-*.mjs` membership rule cannot see. Named, with the
 *  reason, the way (f) names its control file. */
const NAMED_CERTIFIERS = [
    ['scripts/procgen/check-seedling-bot-differential.mjs',
        'it opens the build\'s game page itself and drives it tick for tick '
        + 'against the JS model'],
];
{
    console.log('\n# the lab\'s build');
    // (h1) ── the literal, off the tracked file, in the scan's own spelling.
    let labBuild = null;
    if (!trackedFiles.includes(LAB_FILE)) {
        fail(`${LAB_FILE} is not tracked — it carries \`WASM_PAGE\`, the build the `
            + 'lab page loads, and this row has no subject without it');
    } else {
        let labText = null;
        try { labText = scannable(readFileSync(join(REPO, LAB_FILE), 'utf8')); } catch { /* below */ }
        const literal = labText?.match(LAB_SPELLING)?.[1] ?? null;
        const [spelling1] = SPELLINGS[0];
        spelling1.lastIndex = 0;
        const named = literal === null ? null : spelling1.exec(literal)?.[1] ?? null;
        if (literal === null) {
            fail(`${LAB_FILE} exports no \`WASM_PAGE\` string literal — the lab's build `
                + 'is spelled as a literal ON PURPOSE (trap 411): a path composed from a '
                + 'variable is invisible to the REFERENCED view above, which would then '
                + 'clear a build for retirement while this page still loaded it');
        } else if (named === null) {
            fail(`${LAB_FILE}: \`WASM_PAGE\` = ${JSON.stringify(literal)} is not written in `
                + 'the `wasm/<name>` spelling the REFERENCED view scans for, so the lab '
                + 'no longer pins the build it loads');
        } else if (!MANIFEST.has(named)) {
            fail(`${LAB_FILE}: \`WASM_PAGE\` names ${named}, which is not in the manifest — `
                + 'the lab page would load a 404, which is the failure this submodule exists '
                + 'to retire');
        } else if (!existsSync(join(SUB, named, 'game.html'))) {
            fail(`${LAB_FILE}: \`WASM_PAGE\` resolves to ${named}/game.html, which is not `
                + 'on disk');
        } else {
            labBuild = named;
        }
    }

    // (h2) ── every certifier that spells a build of its own names THAT one.
    const GATE_DIR = `${SCRIPT_DIR}/`;
    const SELF = `${GATE_DIR}check-seedling-wasm-pins.mjs`;
    const rosterGates = trackedFiles.filter((rel) => rel.startsWith(GATE_DIR)
        && !rel.slice(GATE_DIR.length).includes('/')
        && isGateFile(rel.slice(GATE_DIR.length))
        && rel !== SELF);
    const buildsNamedIn = (rel) => {
        let text = null;
        try { text = codeOnly(readFileSync(join(REPO, rel), 'utf8')); } catch { return null; }
        return sorted(set([...MANIFEST].filter((n) => text.includes(n))));
    };
    const certifiers = [];
    for (const rel of rosterGates) {
        const names = buildsNamedIn(rel);
        if (names?.length) certifiers.push([rel, names, 'a gate that spells its own build']);
    }
    for (const [rel, why] of NAMED_CERTIFIERS) {
        if (!trackedFiles.includes(rel)) {
            fail(`${rel} is not tracked — it is a named certifier of the lab's build `
                + `(${why}), and dropping it drops the check that it drives the same build `
                + 'the lab does');
            continue;
        }
        const names = buildsNamedIn(rel);
        if (!names?.length) {
            fail(`${rel} names NO manifest build in code — it is a named certifier of the `
                + `lab's build (${why}), so a default it no longer spells is a pin that `
                + 'stopped existing rather than a subject that agrees');
            continue;
        }
        certifiers.push([rel, names, why]);
    }
    const agreeing = [];
    for (const [rel, names, why] of certifiers) {
        const wrong = labBuild === null ? [] : names.filter((n) => n !== labBuild);
        if (labBuild === null) continue;   // (h1) already said what is wrong
        if (wrong.length) {
            fail(`${rel} drives ${wrong.join(', ')} but ${LAB_FILE}'s \`WASM_PAGE\` names `
                + `${labBuild} — ${why}, so it would certify a build the lab does not load. `
                + 'These two are spelled separately ON PURPOSE (a `BUILD` imported from the '
                + 'lab would compare the page against its own source and pass for any '
                + 'value); the duplication is the discriminator, and this row is what makes '
                + 'it one. Move BOTH, or say here why this one is a control');
        } else {
            agreeing.push(rel);
        }
    }

    // (h3) ── measured, asserts nothing. See the docblock for the two runs.
    if (labBuild !== null) {
        const caps = manifest.builds.find((b) => b.name === labBuild)?.capabilities ?? [];
        console.log(`  ${LAB_FILE}`);
        console.log(`  WASM_PAGE → ${labBuild}, capabilities=[${caps.join(', ')}]; certified by`
            + ` ${agreeing.length} gate(s) naming it: ${agreeing.join(', ')}`);
        console.log('  the lab keys on no capability by name — measured on the build declaring '
            + '[]: check-seedling-wasm-pages 19/20 green, the one red being (h2) seen through '
            + 'a browser, so (h3) asserts nothing');
    }
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
    // ⚠ The pin set reached ONE on 2026-08-19, and the sentence had never had
    // to be singular before. Nothing keys on this string (grepped), so the
    // plural is a reading fix and not a behaviour change (trap 337).
    console.log(`ALL PASS — ${MANIFEST.size} pinned build${MANIFEST.size === 1 ? '' : 's'}, `
        + 'four views in agreement');
    process.exit(0);
}
console.log(`${problems.length} PROBLEM(S):`);
for (const p of problems) console.log(`  FAIL: ${p}`);
process.exit(1);
