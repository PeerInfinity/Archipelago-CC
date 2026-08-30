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
 * `PRESET_ID = 'seedling_atlas_maze'` in verify-seedling-atlas-maze.mjs,
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
 * ⛓ THE CAPABILITY VOCABULARY, IMPORTED FROM ITS ONE CONSUMER — never a
 * second copy spelled here. A gate spelled differently from the code it
 * gates tests itself; this file already learned that with `scannable()`,
 * whose duplicate inside `--self-test` left a mutant green.
 */
import { AP_ITEM_CAPABILITY, WASM_BUILD_CAPABILITIES }
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
 * And exactly one does matter. `verify-seedling-ap-placement.mjs` is built on
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
const CONTROL_FILE = 'scripts/procgen/verify-seedling-ap-placement.mjs';
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
