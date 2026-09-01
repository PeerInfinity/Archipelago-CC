/**
 * rowInputKey — **THE BYTES A STANDING GATE ROW IS AN ANSWER ABOUT** (SEEDLING
 * BOT R9, slice SG2; ⚖ ruling 71 (a), second stage).
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * ⚖ 69 (d)'s census: four gate rows are 2305 s = 68 % of a 56.8-minute
 * battery, and a `standing-values --write` pays all four EVERY TIME, whether
 * or not anything they measure has moved. ⚖ 70 already settled the shape of
 * the answer for tape categories — *"re-drive what the reach names, quote the
 * rest, SAYING SO"* — and ⚖ 71 (a) extends it from categories to gate rows:
 *
 *   a row carries an INPUT KEY over its enumerated input populations;
 *   `--write` re-runs the row iff that key MOVED since the banked one;
 *   an unchanged key carries the banked value forward, saying so.
 *
 * ⛔⛔ THE RISK, STATED WHERE IT BITES: **A KEY THAT MISSES AN INPUT IS A
 * STALE GREEN RIDING FOREVER.** A row whose real subject moved under a key
 * that could not see it will be quoted, and quoted again, and nothing on disk
 * will ever disagree. That is a worse failure than paying 2305 s. There are
 * exactly three mitigations and all three are built:
 *
 *   1. **THE POPULATIONS ARE PRINTED** — every key computation reports, per
 *      population, a COUNT and a stable digest, so *"what did this key
 *      cover?"* is answerable from the log rather than from this docblock.
 *      (A bounded sweep must NAME what it bounded — trap 771.)
 *   2. **THE DETECTOR** — `--redrive-unchanged` re-runs rows at an UNCHANGED
 *      key on purpose; a verdict that moved is a NAMED nondeterminism finding
 *      in the output and in the row's `why`, never a silent re-bank (trap
 *      866: a byte-keyed cache is a nondeterminism detector you already own).
 *   3. **`--rekey` / `--force-row=` / the user's word** re-measure regardless.
 *
 * ── THE FOUR POPULATIONS ──────────────────────────────────────────────
 *
 * The census's own checklist, and it is a checklist because traps 940, 901
 * and 827 are each *"a sweep missed a population"*:
 *
 *   1 **CODE**  the forward import closure from the row's entry file
 *               (`reachClosure.buildGraph`, which already resolves dynamic
 *               imports, path bindings and `<script src=>`), plus any seed the
 *               gate DECLARES. ⛓ The driven pages ride here and are counted
 *               separately in the report: `addPageDriveEdges` puts a
 *               `watch.html` a gate merely NAMES into the closure, and
 *               `HTML_SRC_RE` puts that page's own scripts in behind it — so
 *               "a URL is DATA, not an import" is answered by seeding, not by
 *               a second population.
 *   2 **DATA**  the fixtures, tapes, baselines and JSON the closure reads:
 *               every `fixtures/**.json` whose STEM the closure names as a
 *               delimited token (`dataReach`'s own law, run FORWARD), plus
 *               every path literal in the closure that resolves to a tracked
 *               non-code file, plus what the gate declares. ⛔ MINUS exactly
 *               one file — `standing-values.json`, the writer's OWN OUTPUT;
 *               see `DERIVED_DATA_EXCLUDED` for the measurement that forced
 *               it and for why a row whose subject IS the bank declares it
 *               back rather than inheriting it.
 *   3 **SPAWN** the shell-out targets and their closures. **An `execFileSync`
 *               reach is invisible to an import sweep (trap 901)** — this
 *               population exists so that it is not. `check-procgen-demos`
 *               drives sibling gates out of the catalogue's `cli` fields;
 *               `check-seedling-wasm-ship` drives a Windows `.py`.
 *   4 **BUILD** the SUBMODULE GITLINKS — the one input whose bytes no import
 *               and no path literal can reach. `frontend/modules/flashPanel/
 *               wasm` is 40 MB of compiled Seedling that every wasm row's
 *               verdict is an answer about, and the superproject's recorded
 *               gitlink SHA is its byte proxy.
 *
 * ⛔ MINIMIZE HARDCODING (⚖ 17). Every population above is DERIVED. What
 * derivation cannot see, a gate DECLARES in its own docblock, read exactly the
 * way `gateRoster` reads `@ci-face`:
 *
 *     * @key-inputs <population>: <repo-relative path or glob> …
 *     * @key-inputs unkeyable: <the reason>
 *
 * At this head there are THREE declarers: `check-procgen-help.mjs` (its
 * CLOSURE is six files but its SUBJECT is all 265 instruments), and — since
 * ⚖ 72 (c) — `check-seedling-full-tier-owed.mjs` and `check-slice-records.mjs`,
 * each declaring the one file the derived rules now refuse to see.
 *
 * ── ⚠ WHAT A KEY STILL CANNOT SEE, stated rather than implied ─────────
 *
 * · A gitlink is what the SUPERPROJECT RECORDS. An uncommitted edit inside a
 *   submodule's working tree moves no gitlink and no key. (The tracked `.js`
 *   of a submodule under a root IS hashed by content — `trackedFiles`
 *   descends — so this gap is the BINARY blobs only.)
 * · A row whose command names a remote origin (`--pages=`) is an answer about
 *   bytes this repo does not hold. Such a row is UNKEYABLE, derived from its
 *   own command, and always re-runs. At this head that selects ZERO rows and
 *   the writer says so out loud.
 * · A key is comparable only against a key taken in a tree with the SAME
 *   SUBMODULE CHECKOUT STATE. A tree with no checkouts sees fewer CODE members
 *   and can reach a submodule only by NAMING, so its key differs — which makes
 *   the row RE-RUN, the conservative direction, never a quote.
 * · An UNTRACKED file is invisible: every population is derived from `git
 *   ls-files`, so a new instrument that has not been added yet moves no key.
 *   That is the right default (a key must be reproducible from a commit) and
 *   it is why a slice banks its rows AFTER committing, not before.
 * · Wall-clock, machine load and a GPU driver are not bytes. The key is about
 *   INPUTS; the detector arm is about everything else.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO, buildGraph } from './reachClosure.js';
import { cliTargetsIn } from './gateDedup.js';
import { SCRIPT_DIR } from './gateRoster.js';
import { FILE as STANDING_VALUES } from './standingValues.js';

/** ⛓ The order is the report's order and the key's order — one spelling. */
export const POPULATIONS = Object.freeze(['code', 'data', 'spawn', 'build']);

/** ⛓ …and the one non-population word a declaration may name. */
export const UNKEYABLE = 'unkeyable';

const md5 = (s) => createHash('md5').update(s).digest('hex');

/**
 * ⛓⛓⛓ **THE WRITER'S OWN OUTPUT IS NOT ONE OF ITS INPUTS — ⚖ 72 (c), R9
 * slice S1.** `standing-values.json` is the file `--write` PRODUCES, and it
 * was a member of the DERIVED `data` population of **31 of the 34 keyed rows**
 * (measured at `2f46ba941`, by touching it and diffing every row's key).
 *
 * ⛔⛔ THAT IS A CACHE WHOSE KEY COVERS THE CACHE. Banking a write moved 31
 * keys, so the commit that recorded a measurement re-armed the next full
 * re-drive, and ⚖ 71 (a)'s promised ≈2/34 steady state never once
 * materialised: `--keys` at `d51a0e409` — two docs commits and a one-row
 * re-bank past the last write — read **31 MOVED, 3 unmoved**.
 *
 * ⛓ HOW IT GOT IN, since a grep exonerates the wrong suspect: for 29 of those
 * rows NO file in the closure spells the path at all. It arrives through the
 * DIRECTORY rule below — `gateRoster.js` spells `'scripts/procgen'`, and the
 * bank is a `.json` directly under it. (For the two rows that DO spell it —
 * `standingValues.js`'s own `FILE`, `sliceRecords.js`'s `STANDING_VALUES` —
 * the path literal rule found it, which is why those two are exactly the rows
 * that must declare it back.)
 *
 * ⇒ the derived rules do not see this one file. ⛔ IT IS AN EXCLUSION OF ONE
 * IMPORTED CONSTANT, NOT A LIST (⚖ 17): the only file exempt is the one this
 * mechanism's own writer emits, named by the module that emits it, so it
 * cannot drift from what `--write` actually writes.
 *
 * ⛔⛔ AND IT IS AN EXCLUSION FROM THE **DERIVED** RULES ONLY. A row whose
 * SUBJECT is the bank still keys on it — by DECLARING it, through the
 * `@key-inputs data:` mechanism that already exists, which is the same law
 * this file states everywhere else: *what derivation cannot see, a gate says*.
 * At this head that is `check-seedling-full-tier-owed` (the composite row it
 * reads back) and `check-slice-records` (the bank is one of the artifacts a
 * slice record accounts for). ⛓ The declaration is what makes the exclusion
 * SAFE rather than a stale green: the two rows the bank can actually falsify
 * are the two that still re-run when it moves.
 */
export const DERIVED_DATA_EXCLUDED = STANDING_VALUES;

/* ══════════════════════════════════════════════════════════════════════
 * THE DECLARATION — what derivation cannot see, said by the gate itself
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛔ THE ANCHOR IS LOAD-BEARING, for the reason `VARIANT_LINE_RE` gives one
 * file over: the declaring gate's docblock also SPELLS THE SYNTAX OUT, so a
 * regex matching the token anywhere on a line would read the explanation as a
 * second declaration. A declaration is a docblock line that STARTS with it.
 */
const KEY_INPUTS_LINE_RE = /^[ \t]*\*[ \t]*@key-inputs\b(.*)$/gm;
const KEY_INPUTS_BODY_RE = /^[ \t]+([^:]+?)[ \t]*:[ \t]*(\S.*?)[ \t]*$/;

/**
 * The key-input declarations in one gate's text.
 *
 * ⛔ A MALFORMED LINE IS A REFUSAL BY NAME, never a skip — the same law
 * `variantsIn` and `ciFaceIn` state. A declaration nobody parsed is an input
 * population that silently does not exist, which is precisely the stale green
 * this whole mechanism is built to refuse.
 *
 * @returns {{code: string[], data: string[], spawn: string[], build: string[],
 *            unkeyable: string|null}}
 */
export function keyInputsIn(text, { file = '(text)' } = {}) {
    const out = { unkeyable: null };
    for (const p of POPULATIONS) out[p] = [];
    for (const m of String(text).matchAll(KEY_INPUTS_LINE_RE)) {
        const body = KEY_INPUTS_BODY_RE.exec(m[1]);
        if (!body) {
            throw new Error(`rowInputKey: ${file} has a malformed @key-inputs line — expected `
                + '`@key-inputs <population>: <path|glob> …` or `@key-inputs unkeyable: '
                + `<reason>\`, got ${JSON.stringify(m[0].trim())}`);
        }
        const [, name, rhs] = body;
        if (name === UNKEYABLE) {
            if (out.unkeyable !== null) {
                throw new Error(`rowInputKey: ${file} declares ${UNKEYABLE} twice — a row is `
                    + 'unkeyable for one stated reason or it is keyed');
            }
            out.unkeyable = rhs;
            continue;
        }
        if (!POPULATIONS.includes(name)) {
            throw new Error(`rowInputKey: ${file} declares @key-inputs ${JSON.stringify(name)}, `
                + `which is not a population — the four are ${POPULATIONS.join(', ')} (or `
                + `\`${UNKEYABLE}\`)`);
        }
        /**
         * ⛔ A DECLARED PATH IS A PATH, not a sentence. A prose right-hand side
         * would hash nothing and report a population of zero — a stale green
         * wearing a declaration, which is worse than no declaration at all.
         */
        const paths = rhs.split(/\s+/).filter(Boolean);
        /** ⛓ A PATH HAS A SEPARATOR OR AN EXTENSION. Without that clause a
         *  prose right-hand side parses as a list of one-word "paths", each of
         *  which matches nothing — a declared population of ZERO, which is the
         *  stale green this file exists to refuse, arriving through the
         *  declaration meant to prevent it. */
        const bad = paths.find((p) => !/^[A-Za-z0-9_.*/-]+$/.test(p)
            || !(p.includes('/') || p.includes('.')));
        if (bad) {
            throw new Error(`rowInputKey: ${file} declares @key-inputs ${name} with `
                + `${JSON.stringify(bad)}, which is not a repo-relative path or glob`);
        }
        out[name].push(...paths);
    }
    return out;
}

/**
 * A repo-relative glob: `*` spans one path segment, `**` spans any. Nothing
 * else is a metacharacter, because nothing else is needed and every extra one
 * is a way for a declaration to silently match less than its author meant.
 */
export function globToRe(pattern) {
    const src = pattern.split('/').map((seg) => (seg === '**'
        ? '[^\\0]*'
        : seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')))
        .join('/')
        .replace(/\[\^\\0\]\*\//g, '(?:[^\\0]*/)?');
    return new RegExp(`^${src}$`);
}

/** The tracked paths a declaration selects — REFUSING a pattern that selects
 *  nothing, for the same reason `--key=` refuses a typo: a declaration that
 *  matches no file is an input population somebody believes exists. */
export function expandDeclared(patterns, tracked, { file = '(gate)', population = '' } = {}) {
    const out = new Set();
    for (const p of patterns) {
        const re = globToRe(p);
        const hits = [...tracked].filter((t) => re.test(t));
        if (!hits.length) {
            throw new Error(`rowInputKey: ${file}'s @key-inputs ${population} names `
                + `${JSON.stringify(p)}, which matches NO tracked file`);
        }
        for (const h of hits) out.add(h);
    }
    return out;
}

/* ══════════════════════════════════════════════════════════════════════
 * THE CONTEXT — built once for a whole battery, not once per row
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A DATA path a file spells. The extension list is the set of things that
 *  are INPUTS but are not graph nodes: fixtures, baselines, blobs. ⛔ Drivers
 *  (`.py`, `.sh`) are NOT here — they are spawn targets and `spawnTargetsIn`
 *  applies the stricter reference test to them. */
const PATH_LITERAL_RE =
    /['"`]([A-Za-z0-9_./-]+\.(?:json|jsonl|ndjson|txt|csv|wasm|swf|ogmo|oel))['"`]/g;

/**
 * ⛓⛓ **MARKDOWN IS AN INPUT OF AN INSTRUMENT AND A CITATION OF EVERYTHING
 * ELSE.** `reference/campaignChain.mjs` holds `CAMPAIGN_DOC =
 * 'docs/json/developer/procgen/seedling-bot.md'` and the generator's `--check`
 * compares GENERATED REGIONS inside it — a real input of
 * `gate: procgen-reference`. `procgenDocs/glossary.js` holds the same shape of
 * literal as a CITATION, and measured, counting it pulled all 30 `*.md` into
 * TWENTY-SEVEN rows: a docs-only commit would have re-run 1709 s of wasm
 * playback that cannot read a word of it. So `.md` counts only where a file
 * can actually open one — inside the instrument directory.
 */
const MD_LITERAL_RE = /['"`]([A-Za-z0-9_./-]+\.md)['"`]/g;

/**
 * ⛓⛓⛓ **A LITERAL THAT NAMES A DIRECTORY, BECAUSE A GATE CAN ENUMERATE ONE.**
 *
 * ⛔⛔ THE NEGATIVE CONTROL FOUND THIS, WHICH IS WHAT A NEGATIVE CONTROL IS
 * FOR. Mutant N1 appended a line to `docs/json/developer/procgen/
 * architecture.md` and moved 0 of 34 keys — the answer the economy WANTS, and
 * it was WRONG: `reference/docsIndex.mjs` reads every `*.md` in that directory
 * (`DOC_DIR = 'docs/json/developer/procgen'`, `readdirSync`), and
 * `check-procgen-reference.mjs` runs the generator's `--check`. So that
 * markdown file IS an input of a gate row, and the row would have been quoted
 * forever across every edit to it. A stale green, found by the mutant that was
 * supposed to prove there wasn't one.
 *
 * ⇒ a string literal that NAMES A TRACKED DIRECTORY contributes the data files
 * DIRECTLY UNDER it. ⛓ One level, not recursive, because `readdirSync` is one
 * level and because a recursive rule on a literal like `'frontend/modules'`
 * would swallow the tree. ⛓ Data extensions only: a `.js` under a named
 * directory is population 1's business and arrives there or not on its own
 * merits.
 */
const DIR_LITERAL_RE = /['"`]([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+)['"`]/g;

/** ⛓ Every string literal in a source, content only. */
const STRING_LITERAL_RE = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;

/**
 * ⛓⛓ THE CALLS THAT TURN A STRING INTO A PATH. A bare filename in a source is
 * a path only when something USES it as one; everywhere else it is a name.
 */
const PATH_CALL_RE =
    /\b(?:join|resolve|execFile|execFileSync|spawn|spawnSync|execSync|exec|import)\s*\(/g;

/** Read a balanced `(…)` argument list starting at `open` (the `(`), quotes
 *  respected — the same scan `reachClosure.balancedArgs` makes, and for the
 *  same reason: `[^)]*` stops at the first `)` and `join(REPO, f(x))` has two. */
function balancedArgs(text, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < text.length; i += 1) {
        const ch = text[i];
        if (quote) {
            if (ch === '\\') { i += 1; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '(') depth += 1;
        else if (ch === ')') {
            depth -= 1;
            if (depth === 0) return text.slice(open + 1, i);
        }
    }
    return null;
}

/**
 * ⛓⛓⛓ **THE MENTION, STRIPPED — the law `gateRoster.js` states for
 * `SIBLING_RE` and R9 slice 12j paid for twice.** `CLI_TARGET_RE` reads a
 * command line, and a docblock in this directory is FULL of command lines:
 * measured, `check-slice-records.mjs`'s seven-file closure named **231**
 * distinct `scripts/procgen/*.mjs`, essentially all of them out of prose. Left
 * alone that makes every row's SPAWN population "most of procgen", every key
 * moves on every change, and the whole economy of ⚖ 71 (a) evaporates while
 * still looking derived.
 *
 * ⛔ AND THE ASYMMETRY IS WHY THIS IS APPLIED TO SPAWN AND NOT TO DATA: a
 * spurious DATA member costs one file's bytes, a spurious SPAWN member drags
 * its WHOLE IMPORT CLOSURE in behind it. The data scan stays as generous as
 * `dataReach`'s own; the spawn scan reads code only.
 *
 * ⛓ Docblock lines and `//` lines go, and so does an inline block comment.
 * survives is what a shell could actually be handed — including a usage line
 * living inside a `console.log` template (12j's third costume), which is the
 * one over-count this leaves in and which the printed populations expose.
 */
export function stripComments(text) {
    return String(text)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n')
        .map((l) => (/^\s*(?:\*|\/\/)/.test(l) ? '' : l))
        .join('\n');
}

/** ⛓ A shell-out target lives INSIDE the instrument directory — the same
 *  narrowness `SIBLING_RE` states. `Generate.py`, `worlds/seedling/Rules.py`
 *  and `test/…` are named in procgen docblocks by the dozen and spawned by
 *  none of them; measured, the loose form pulled nine such files into
 *  `check-seedling-wasm-ship`'s population alone. */
const isSpawnable = (rel) =>
    new RegExp(`^${SCRIPT_DIR}/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\\.(?:mjs|js|py|sh)$`)
        .test(rel);

/**
 * ⛓⛓⛓ **THE SPAWN TARGETS ONE FILE REFERENCES — and the whole difficulty is
 * telling a reference from a usage line.** Measured, the naive form (every
 * `scripts/procgen/*.mjs` anywhere in the text) gave a FIVE-file gate a
 * 226-member spawn population: `reference/lib.mjs` EMITS a generated header
 * that quotes `node scripts/procgen/generate-procgen-reference.mjs`, and that
 * one mention dragged a 225-file closure in behind it.
 *
 * ⇒ two spellings count, and both are how a spawn is actually written here:
 *
 *   · the literal IS USED AS A PATH — it sits inside a `join`/`resolve`/
 *     `execFile*`/`spawn*`/`import` call: `join(HERE, 'driver.py')`,
 *     `join(REPO, 'scripts/procgen/x.mjs')`, `execFileSync('node',
 *     [join(HERE, 'rerecord-seedling-campaign.mjs'), …])`;
 *   · the literal IS a command line for it — `'node scripts/procgen/x.mjs
 *     --seed=2'`, which is exactly the shape of the demo catalogue's `cli`
 *     fields, parsed by SG1's own `cliTargetsIn` rather than a second reader.
 *
 * ⛔⛔ **THE CALL CONTEXT IS THE TEST, AND SPELLING ALONE WAS NOT ENOUGH —
 * MEASURED, ON THIS SLICE'S OWN FIRST CUT.** `check-seedling-wasm-element`
 * spawns NOTHING (playwright, in-process) and came back with 253 spawn
 * members. The bare-filename rule had picked up three costumes none of which
 * is a spawn: `boxLock.js`'s `BOX_LOCK_HOLDERS`/`BOX_LOCK_EXEMPT` — a NAME
 * LIST in a frozen array, which is data ABOUT instruments; the gate's own lock
 * label `takeBoxLockOrExit({ name: 'check-seedling-wasm-element.mjs' })`; and
 * `glossary.js`'s prose, where a markdown backtick pair inside a single-quoted
 * sentence reads to a lexer as a TEMPLATE LITERAL that happens to be exactly a
 * path. A bare filename in a source is a path only when something USES it as
 * one.
 *
 * ⛔ A `./`-PREFIXED LITERAL IS AN IMPORT AND IS EXCLUDED. `'./boxLock.js'`
 * is population 1's business; counting it here would make SPAWN a superset of
 * CODE and the two digests would stop being able to disagree.
 *
 * ⚠ WHAT IT STILL OVER-COUNTS, stated rather than implied: a closure that
 * merely IMPORTS the demo catalogue inherits the `cli` targets of every row in
 * it, because "this module imports the catalogue" and "this gate runs the
 * catalogue's command lines" are not separable from the outside. That is the
 * conservative direction — a spurious re-measure, never a stale green — and
 * the printed population is where a reader sees it.
 */
export function spawnTargetsIn(text, { tracked, fromFile }) {
    const out = new Set();
    const code = stripComments(text);
    const add = (rel) => { if (tracked.has(rel) && isSpawnable(rel)) out.add(rel); };
    const dir = fromFile.split('/').slice(0, -1).join('/');
    /* ⛓ (1) a literal USED AS A PATH — only inside a path-shaped call. */
    PATH_CALL_RE.lastIndex = 0;
    let call = PATH_CALL_RE.exec(code);
    while (call !== null) {
        const args = balancedArgs(code, call.index + call[0].length - 1);
        if (args) {
            STRING_LITERAL_RE.lastIndex = 0;
            let a = STRING_LITERAL_RE.exec(args);
            while (a !== null) {
                const lit = a[2];
                if (!lit.startsWith('.') && /^[A-Za-z0-9_./-]+\.(?:mjs|js|py|sh)$/.test(lit)) {
                    add(lit);
                    if (dir) add(`${dir}/${lit}`);
                }
                a = STRING_LITERAL_RE.exec(args);
            }
        }
        call = PATH_CALL_RE.exec(code);
    }
    /* ⛓ (2) a literal that IS a command line — the catalogue's `cli` shape. */
    STRING_LITERAL_RE.lastIndex = 0;
    let m = STRING_LITERAL_RE.exec(code);
    while (m !== null) {
        if (/^\s*node\s/.test(m[2])) {
            for (const f of cliTargetsIn(m[2])) add(`${SCRIPT_DIR}/${f}`);
        }
        m = STRING_LITERAL_RE.exec(code);
    }
    return out;
}

/**
 * Everything a key computation needs, read ONCE. The graph costs ~2.5 s and
 * the file reads dominate after that, so a battery that built this per row
 * would pay both thirty-three times.
 */
export function keyContext({ repo = REPO, graph } = {}) {
    const tracked = new Set(execFileSync('git', ['ls-files'], {
        cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28,
    }).split('\n').filter(Boolean));
    const g = graph ?? buildGraph({ repo });

    /**
     * ⛓⛓ `dataReach`'s LAW, RUN FORWARD. That function asks *"which consumers
     * name this changed fixture"*; a key asks the mirror question, *"which
     * fixtures does this closure name"*. The law is the same and is not
     * re-spelled: a DELIMITED TOKEN over the STEM, with the generated tape
     * index excluded because its stem is `index` and matching it turned the
     * first run of that function into 166 files.
     */
    const stems = new Map();
    for (const p of tracked) {
        if (!/(^|\/)fixtures\//.test(p) || !p.endsWith('.json')) continue;
        const stem = p.split('/').pop().slice(0, -'.json'.length).replace(/\.trace$/, '');
        if (stem === 'index') continue;
        if (!stems.has(stem)) stems.set(stem, []);
        stems.get(stem).push(p);
    }
    /**
     * ⛔ ONE ALTERNATION, NOT 349 PASSES. The bound is per-file text, and a
     * regex per stem per file is 349 × 700 scans on the help row alone.
     */
    const names = [...stems.keys()].sort();
    const stemRe = names.length
        ? new RegExp(`(?<![A-Za-z0-9_-])(${names
            .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9_-])`, 'g')
        : null;

    /**
     * ⛓ The submodules, from `.gitmodules` — never a list here (CLAUDE.md's
     * own list said three where there are six, which is exactly why).
     */
    let submodules = [];
    try {
        submodules = execFileSync('git',
            ['config', '--file', '.gitmodules', '--get-regexp', 'path'],
            { cwd: repo, encoding: 'utf8' })
            .split('\n').filter(Boolean).map((l) => l.split(/\s+/)[1]).filter(Boolean).sort();
    } catch { submodules = []; }

    const textCache = new Map();
    const read = (rel) => {
        if (!textCache.has(rel)) {
            /**
             * ⛔ `readFileSync`, NEVER a shell `grep`. Tracked files in this
             * tree hold stray NUL bytes and plain `grep` skips such a file in
             * SILENCE — a whole file dropping out of a population that claims
             * to be complete (trap 764).
             */
            try { textCache.set(rel, readFileSync(join(repo, rel), 'utf8')); }
            catch { textCache.set(rel, ''); }
        }
        return textCache.get(rel);
    };

    const hashCache = new Map();
    /** ⛓ The BYTES, not the mtime. A key that moved because a checkout
     *  restamped a file would re-run every slow row for nothing, and one that
     *  did not move on a rewritten byte is the stale green. */
    const hash = (rel) => {
        if (!hashCache.has(rel)) {
            try { hashCache.set(rel, md5(readFileSync(join(repo, rel)))); }
            catch { hashCache.set(rel, 'ABSENT'); }
        }
        return hashCache.get(rel);
    };

    /** ⛓ The gitlink the SUPERPROJECT records, which is the byte proxy for a
     *  submodule's whole tree — 40 MB of compiled wasm included. */
    const gitlinkCache = new Map();
    const gitlink = (path) => {
        if (!gitlinkCache.has(path)) {
            let sha = 'ABSENT';
            try {
                const line = execFileSync('git', ['ls-tree', 'HEAD', '--', path],
                    { cwd: repo, encoding: 'utf8' }).trim();
                const m = /^\d+\s+commit\s+([0-9a-f]{40})\s/.exec(line);
                if (m) sha = m[1];
            } catch { /* not a gitlink at this head */ }
            gitlinkCache.set(path, sha);
        }
        return gitlinkCache.get(path);
    };

    /** Everything the graph reaches FORWARD from a set of seeds, seeds
     *  included — the mirror of `reachFrom`, which walks the reverse map. */
    const forwardFrom = (seeds) => {
        const out = new Set();
        const queue = [...seeds].filter((s) => g.nodes.has(s));
        for (const s of queue) out.add(s);
        while (queue.length > 0) {
            const cur = queue.pop();
            for (const dep of g.forward.get(cur) ?? []) {
                if (out.has(dep)) continue;
                out.add(dep);
                queue.push(dep);
            }
        }
        return out;
    };

    /**
     * ⛓ The DATA files directly under a tracked directory — the answer to a
     * `readdirSync(SOME_DIR)` a gate performs at run time. Indexed once,
     * because the alternative is a scan of the tracked set per literal per
     * file.
     */
    const DATA_EXT = /\.(?:json|jsonl|ndjson|md|txt|csv|wasm|swf|ogmo|oel)$/;
    const byDir = new Map();
    for (const p of tracked) {
        if (!DATA_EXT.test(p)) continue;
        const dir = p.split('/').slice(0, -1).join('/');
        if (!dir) continue;
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push(p);
    }
    const filesDirectlyUnder = (dir) => byDir.get(dir) ?? [];

    return { repo, graph: g, tracked, stems, stemRe, submodules, read, hash, gitlink,
        forwardFrom, filesDirectlyUnder };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE POPULATIONS
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ Resolve a path literal against the file that spells it AND against the
 *  repo root — the two forms this directory actually uses (`join(HERE, 'x')`
 *  and `'scripts/procgen/x'`), and nothing is invented when neither is
 *  tracked. */
function resolveLiteral(lit, fromFile, tracked) {
    const bare = lit.replace(/^\.\//, '');
    const dir = fromFile.split('/').slice(0, -1).join('/');
    const sibling = dir ? `${dir}/${bare}` : bare;
    return [bare, sibling].filter((p) => tracked.has(p));
}

/**
 * The four input populations of ONE row, each as a sorted member list.
 *
 * @param {{entry: string, declared: object, ctx: object}} o
 *   `entry` the repo-relative script the row's command runs;
 *   `declared` the gate's own `keyInputsIn` answer (or `null`).
 */
export function inputPopulations({ entry, declared = null, ctx }) {
    const decl = declared ?? { code: [], data: [], spawn: [], build: [], unkeyable: null };
    const seeds = new Set([entry, ...expandDeclared(decl.code, ctx.tracked,
        { file: entry, population: 'code' })]);
    const code = ctx.forwardFrom(seeds);

    const data = new Set(expandDeclared(decl.data, ctx.tracked,
        { file: entry, population: 'data' }));
    /**
     * ⛔ THE ONE GATE THE DERIVED RULES PASS THROUGH — see
     * `DERIVED_DATA_EXCLUDED`. It is deliberately NOT applied to the declared
     * set above: a row whose SUBJECT is the bank says so, and its declaration
     * must survive the exclusion or the two rows the bank can falsify would be
     * quoted forever.
     */
    const addData = (p) => { if (p !== DERIVED_DATA_EXCLUDED) data.add(p); };
    const spawnTargets = new Set(expandDeclared(decl.spawn, ctx.tracked,
        { file: entry, population: 'spawn' }));

    for (const rel of code) {
        const text = ctx.read(rel);
        if (!text) continue;
        if (ctx.stemRe) {
            ctx.stemRe.lastIndex = 0;
            let m = ctx.stemRe.exec(text);
            while (m !== null) {
                for (const p of ctx.stems.get(m[1]) ?? []) addData(p);
                m = ctx.stemRe.exec(text);
            }
        }
        PATH_LITERAL_RE.lastIndex = 0;
        let lit = PATH_LITERAL_RE.exec(text);
        while (lit !== null) {
            for (const p of resolveLiteral(lit[1], rel, ctx.tracked)) {
                if (!code.has(p)) addData(p);
            }
            lit = PATH_LITERAL_RE.exec(text);
        }
        /**
         * ⛔ …AND ONLY AN INSTRUMENT ENUMERATES A DIRECTORY. Measured: applied
         * to the whole closure, one frontend module naming the docs directory
         * pulled all 30 `*.md` into TWENTY-SEVEN rows, so a docs-only commit
         * re-ran 1709 s of wasm playback that cannot read a word of it — the
         * economy destroyed by a rule meant to fix a stale green. A
         * `readdirSync` at run time happens in `scripts/procgen/`; a frontend
         * module is SERVED, not run, and its mention of a doc path is a
         * citation.
         */
        if (rel.startsWith(`${SCRIPT_DIR}/`)) {
            const bare = stripComments(text);
            MD_LITERAL_RE.lastIndex = 0;
            let md = MD_LITERAL_RE.exec(bare);
            while (md !== null) {
                for (const p of resolveLiteral(md[1], rel, ctx.tracked)) addData(p);
                md = MD_LITERAL_RE.exec(bare);
            }
            DIR_LITERAL_RE.lastIndex = 0;
            let dl = DIR_LITERAL_RE.exec(bare);
            while (dl !== null) {
                for (const p of ctx.filesDirectlyUnder(dl[1])) if (!code.has(p)) addData(p);
                dl = DIR_LITERAL_RE.exec(bare);
            }
        }
        for (const t of spawnTargetsIn(text, { tracked: ctx.tracked, fromFile: rel })) {
            spawnTargets.add(t);
        }
    }

    /** ⛔ AND THEIR CLOSURES. A spawned gate's own imports are inputs of THIS
     *  row's verdict exactly as its entry file is; stopping at the target
     *  would be the depth-1 grep `reachClosure` exists to refuse. */
    const spawn = new Set(spawnTargets);
    for (const f of ctx.forwardFrom([...spawnTargets])) spawn.add(f);

    /**
     * ⛓⛓⛓ A SUBMODULE IS IN THE BUILD POPULATION WHEN THIS ROW REACHES INTO
     * IT — so `check-procgen-demos` (which reaches no wasm file) does not
     * re-measure on a wasm bump and every wasm row does.
     *
     * ⛔⛔ AND REACH IS **CONTAINMENT *OR* NAMING**, WHICH THE BUILD MUTANT
     * TAUGHT. Containment alone asks whether a population member's PATH lies
     * under the submodule — and a submodule's files are only tracked-and-
     * present when it has been CHECKED OUT. In a throwaway worktree (no
     * `submodule update --init`) the wasm page is not a node, nothing is
     * contained, the BUILD population is EMPTY, and a gitlink move moved
     * **0 of 34 keys**: the mutant that was supposed to prove population 4
     * proved instead that population 4 could vanish with a checkout state.
     *
     * ⇒ a submodule is ALSO reached when a file in the CODE population NAMES
     * its path (`watchWasm.js` spells `frontend/modules/flashPanel/wasm`).
     * That reading survives a tree the submodule is not checked out in, which
     * is the only kind of tree where the question is hard.
     */
    const reached = [...code, ...data, ...spawn];
    /** ⛓ A PATH **INTO** IT, IN CODE — `${s}/`, not the bare directory name,
     *  and comments stripped. "Loads a file from this submodule" is the claim;
     *  a prose sentence about a sibling submodule is not it, and the loose
     *  form measurably pulled `journey-to-ascension` into the wasm rows. */
    const namesIt = (s) => [...code].some((f) => stripComments(ctx.read(f)).includes(`${s}/`));
    const build = ctx.submodules.filter((s) =>
        reached.some((p) => p.startsWith(`${s}/`)) || namesIt(s));
    for (const s of decl.build) if (!build.includes(s)) build.push(s);

    return {
        code: [...code].sort(),
        data: [...data].sort(),
        spawn: [...spawn].sort(),
        build: build.sort(),
    };
}

/**
 * One population's digest — over `path\0<content md5>` lines, sorted.
 *
 * ⛔ THE PATH IS IN THE DIGEST, not only the content. Without it a RENAME that
 * moved no byte would leave the digest unmoved, and a rename is exactly the
 * kind of move that changes what a gate enumerates.
 */
export function digestOf(members, { ctx, kind }) {
    const value = kind === 'build' ? ctx.gitlink : ctx.hash;
    return md5(members.map((p) => `${p}\0${value(p)}`).join('\n'));
}

/**
 * ⛓⛓⛓ THE ROW'S KEY, and the report that says what it covered.
 *
 * @returns {{key: string|null, unkeyable: string|null,
 *            populations: {name, count, digest, members}[]}}
 */
export function rowInputKey({ entry, declared = null, ctx }) {
    const unkeyable = declared?.unkeyable ?? null;
    const pops = inputPopulations({ entry, declared, ctx });
    const populations = POPULATIONS.map((name) => ({
        name,
        count: pops[name].length,
        digest: digestOf(pops[name], { ctx, kind: name }),
        members: pops[name],
    }));
    const key = md5(populations.map((p) => `${p.name}:${p.count}:${p.digest}`).join('\n'));
    return { key, unkeyable, populations, entry };
}

/* ══════════════════════════════════════════════════════════════════════
 * THE DECISION — pure, so that the edges are testable without a box
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **WHETHER A ROW RUNS, AND WHY — AS A PURE FUNCTION.** The same move
 * `gateDedup.js` made for SG1's licence and `boxLock.js` for its rules: the
 * writer TAKES THE BOX, so a rule that lived only inside it could be
 * interrogated by nothing cheaper than a 56-minute battery, and the edges of a
 * skip rule are exactly what a slice needs to be able to ask about.
 *
 * ⛔ `reason` IS PART OF THE ANSWER, not a log flourish. A row that did not
 * run is the whole economy of ⚖ 71 (a) and also its whole risk; "skipped" with
 * no attributable cause is the shape a stale green hides in.
 *
 * @returns {{run: boolean, unmoved: boolean, reason: string}}
 */
export function rowRunDecision({ keyRep, banked, forced = false, redriveUnchanged = false }) {
    if (!keyRep?.key) {
        return { run: true, unmoved: false, reason: `UNKEYED — ${keyRep?.unkeyable ?? 'no key'}` };
    }
    if (!banked) return { run: true, unmoved: false, reason: 'nothing banked for this row' };
    if (banked !== keyRep.key) {
        return { run: true, unmoved: false, reason: `key MOVED (was ${banked})` };
    }
    if (forced) return { run: true, unmoved: true, reason: 'key unmoved, FORCED' };
    if (redriveUnchanged) {
        return { run: true, unmoved: true, reason: 'key unmoved, RE-DRIVEN by --redrive-unchanged' };
    }
    return { run: false, unmoved: true, reason: 'key unmoved' };
}

/**
 * ⛓⛓⛓ **THE DETECTOR** (trap 866: a byte-keyed cache is a nondeterminism
 * detector you already own). A re-run at an UNCHANGED key whose verdict moved
 * says one of exactly two things, and both are findings: the key MISSED an
 * input, or the gate is not a function of its inputs.
 *
 * ⛔ IT IS NEVER A SILENT RE-BANK. Overwriting the banked value here would
 * destroy the only evidence that the two readings disagreed — and would do it
 * on the run best placed to notice.
 *
 * @returns {null|{at, was, now, exit, ms}}
 */
export function nondeterminismFinding({ unmoved, prev, result, at }) {
    if (!unmoved || !prev || result?.value === prev.value) return null;
    return { at, was: prev.value, now: result.value, exit: result.exit, ms: result.ms };
}

/**
 * ⛓ What a row BANKS about its key: counts and digests, never the member
 * lists. The members are ~700 paths on the help row and the artifact is read
 * by humans; the digest is what a comparison needs, and `--keys` prints the
 * rest on demand. ⛓ One spelling, because the writer and the reporter must
 * bank and print the same thing.
 */
export const bankedPopulations = (report) => Object.fromEntries(report.populations
    .map((p) => [p.name, { count: p.count, digest: p.digest }]));

/**
 * ⛓ ONE LINE PER POPULATION — the first of the three mitigations, and the
 * reason it is a function rather than a `console.log` in the writer: the CLI
 * printer, the writer's own log and the tests must all say the same thing.
 *
 * ⛓ `pages` is called out inside the CODE line because "does the driven page
 * ride population 1?" is the question the design flagged as a trap, and a
 * count is the only form of that answer a reader can act on.
 */
export function keyReportLines(report) {
    return report.populations.map((p) => {
        const extra = p.name === 'code'
            ? ` (${p.members.filter((f) => f.endsWith('.html')).length} driven page(s))`
            : '';
        const build = p.name === 'build' && p.count
            ? ` — ${p.members.join(', ')}` : '';
        return `    ${p.name.padEnd(6)} ${String(p.count).padStart(5)} member(s)  `
            + `${p.digest}${extra}${build}`;
    });
}
