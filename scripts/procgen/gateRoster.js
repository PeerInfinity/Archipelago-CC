/**
 * gateRoster — **WHICH GATES THERE ARE, WHAT EACH ONE NEEDS, AND WHERE IT CAN
 * BE POINTED** — read out of the gates themselves (R9 slice 12e, ⚖ ruling 38
 * item (6); ⚖ ruling 17: derived, never a typed list).
 *
 * ⛔⛔ WHY THIS IS NOT A LIST. Every slice that ran "the gates" rebuilt the
 * command line for each one in its own scratchpad — which `--host=`, which
 * `--root=`, which needs the Pages-SHAPED root rather than the repo root —
 * and threw it away. Slice 12b″ rediscovered the Pages-shaped root the hard
 * way; slice 13 found `check-seedling-editor-phases.mjs` CRASHING, unrun
 * since slice 11 flipped its subject, because nothing made the list runnable
 * in one line. A gate added tomorrow joins this roster by READING ITS FLAG,
 * which is the only membership rule that cannot go stale.
 *
 * ── THE THREE FLAGS, AND THEY MEAN DIFFERENT THINGS ───────────────────
 *
 *   --host=<origin>   a REPO-ROOT shaped server. These gates build their URLs
 *                     as `${HOST}/frontend/modules/…`, so the origin must
 *                     serve the repository, not the published site.
 *   --root=<url>      a PAGES-SHAPED root: the origin under which `frontend/`
 *                     IS the root. Locally that is `<dev server>/frontend`.
 *   --pages=<origin>  the LIVE published site, checked IN ADDITION to a local
 *                     run — these gates take `--host=` as well.
 *
 * ⛔ A GATE CAN BE A BROWSER ROW WITHOUT IMPORTING PLAYWRIGHT.
 * `check-seedling-editor-export.mjs` reads NO flag and imports no browser: it
 * spawns `export-seedling-view.mjs`, which brings its own server and its own
 * browser. A roster keyed on the flag alone would have skipped the one gate
 * this slice was sent to repair. So `browser` is TRANSITIVE — the gate itself,
 * or a `scripts/procgen/*.mjs` it names.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');
export const SCRIPT_DIR = 'scripts/procgen';

/** ⛓ The published home of this tree — the ONE spelling, as the docs index
 *  and the demo catalogue also hold it. */
export const PAGES_ORIGIN = 'https://peerinfinity.github.io/Archipelago-CC';
export const LOCAL_HOST = 'http://localhost:8000';

/** ⛓ A gate is `check-*.mjs` in this directory. Nothing else is asserted. */
export const isGateFile = (f) => /^check-[a-z0-9-]+\.mjs$/.test(f);

const PLAYWRIGHT_RE = /from '(?:@playwright\/test|playwright)'/;
/**
 * ⛓ A WINDOWS ROW — it shells out to the Windows Python driver, so it needs a
 * real Windows session and a real GPU (⚖ ruling 16: announced, and run at
 * once). `check-seedling-wasm-ship.mjs` is one and imports no browser at all;
 * calling it "not a browser row" is true and useless, so the roster says which
 * KIND of world it needs rather than only whether playwright is in it.
 *
 * ⛔ THE DETECTOR IS THE ASSIGNMENT, NOT THE MENTION. A bare search for the
 * driver path matched FIVE gates and one of them —
 * `check-seedling-wasm-element.mjs` — only NAMES it in a docblock sentence
 * about its Windows sibling. A true sentence in a comment, read as a fact
 * about the code (trap 566). A gate drives Windows when it HOLDS the path.
 */
const WINDOWS_RE = /=\s*'\/mnt\/c\/Windows\/py\.exe'/;
/** Any sibling instrument this file names — spawned, imported or quoted. */
const SIBLING_RE = /(?:scripts\/procgen\/|\.\/)([a-z][a-zA-Z0-9-]*\.mjs)/g;

/** ⛓ How a flag is READ, in this directory's one spelling: `arg('host', …)`. */
const readsFlag = (text, name) => new RegExp(`\\barg\\(\\s*'${name}'`).test(text);

/**
 * ⛓⛓⛓ A SECOND ARM OF THE SAME GATE, DECLARED BY THE GATE ITSELF.
 *
 * One gate can be two standing rows. `check-seedling-editor-generate.mjs`
 * BRINGS ITS OWN SERVER when no `--host=` is given, and claim 4 (`?gen=`) is
 * guarded on that — under `--host=` the caller's server has no route to serve
 * the payload at, so the gate prints a NOTE and six rows do not run. Both
 * numbers are correct readings of two DIFFERENT COMMANDS (⚖ editor v3 §26.7a:
 * `--host=` 224/0, own server 230/0). A roster with one row per FILE can only
 * carry one of them, and the other becomes a number somebody re-types.
 *
 * ⛔ SO THE SECOND ARM IS DECLARED WHERE THE FIRST ONE IS — in the gate's own
 * docblock, read the way `readsFlag` reads a flag (⚖ ruling 17: the roster is
 * READ OUT OF THE GATES, never a typed list; a variant in a table here would
 * be exactly the hand-kept list this file exists to refuse):
 *
 *     * @standing-variant <label>: <argv | (none)>
 *
 * `<argv>` is the LITERAL extra flags that arm is run with — `(none)` when the
 * arm IS the absence of a flag, which is this gate's case.
 *
 * ⛔⛔ THE ANCHOR IS LOAD-BEARING. The declaring gate's docblock also SPELLS
 * the syntax out for a reader, so a regex that matched the token anywhere on a
 * line would read that sentence as a second declaration. A declaration is a
 * docblock line that STARTS with the tag, which is the same narrowness
 * `readsFlag` has.
 */
const VARIANT_LINE_RE = /^[ \t]*\*[ \t]*@standing-variant\b(.*)$/gm;
const VARIANT_BODY_RE = /^[ \t]+([^:]+?)[ \t]*:[ \t]*(\S.*?)[ \t]*$/;

/**
 * The variants a gate's docblock declares, refusing a malformed line BY NAME —
 * ⛔ never skipping it. A declaration nobody parsed is a standing row that
 * silently does not exist, which is the failure this whole mechanism is for.
 */
export function variantsIn(text, { file = '(text)' } = {}) {
    const out = [];
    for (const m of text.matchAll(VARIANT_LINE_RE)) {
        const body = VARIANT_BODY_RE.exec(m[1]);
        if (!body) {
            throw new Error(`gateRoster: ${file} has a malformed @standing-variant line `
                + `— expected \`@standing-variant <label>: <argv | (none)>\`, got `
                + `${JSON.stringify(m[0].trim())}`);
        }
        const [, label, rhs] = body;
        const argv = rhs === '(none)' ? [] : rhs.split(/\s+/);
        const bad = argv.find((a) => !a.startsWith('--'));
        if (bad) {
            throw new Error(`gateRoster: ${file} declares variant ${JSON.stringify(label)} with `
                + `${JSON.stringify(bad)}, which is not a flag — the argv is the LITERAL extra `
                + 'flags that arm is run with, or `(none)`');
        }
        out.push({ label, argv });
    }
    return out;
}

/**
 * Every gate in `scripts/procgen/`, with the flags it reads and whether it
 * drives a browser — the gate's own text is the only source.
 */
export function gateRoster({ repo = REPO } = {}) {
    const dir = join(repo, SCRIPT_DIR);
    const files = readdirSync(dir).filter(isGateFile).sort();
    const textOf = new Map();
    const read = (f) => {
        if (!textOf.has(f)) {
            try { textOf.set(f, readFileSync(join(dir, f), 'utf8')); } catch { textOf.set(f, ''); }
        }
        return textOf.get(f);
    };
    return files.map((file) => {
        const text = read(file);
        const flags = ['host', 'root', 'pages'].filter((n) => readsFlag(text, n));
        const siblings = [...new Set([...text.matchAll(SIBLING_RE)].map((m) => m[1]))]
            .filter((s) => s !== file);
        const browser = PLAYWRIGHT_RE.test(text)
            || siblings.some((s) => PLAYWRIGHT_RE.test(read(s)));
        return {
            file,
            path: `${SCRIPT_DIR}/${file}`,
            flags,
            browser,
            windows: WINDOWS_RE.test(text),
            /** ⛓ …and the SECOND ARMS this gate declares — `[]` for every gate
             *  that declares none, which is all of them but one. */
            variants: variantsIn(text, { file }),
            /** ⛓ …and by which sibling, when it is not by itself. */
            browserVia: PLAYWRIGHT_RE.test(text)
                ? null
                : siblings.find((s) => PLAYWRIGHT_RE.test(read(s))) ?? null,
        };
    });
}

/**
 * The argv a gate needs to be pointed at one of the two worlds.
 *
 * ⛔ `local` is TWO different origins and that is the point: `--host=` wants
 * the repo root, `--root=` wants the same server with `/frontend` on the end,
 * because that is what the published site's shape is. Getting this wrong is
 * not a failure — it is a gate that passes against the wrong tree.
 *
 * Returns `null` when the gate cannot address that world at all, so a caller
 * can say so BY NAME instead of silently running it against the wrong thing.
 */
export function argvFor(gate, where, { host = LOCAL_HOST, pages = PAGES_ORIGIN } = {}) {
    const out = [];
    if (where === 'local') {
        if (gate.flags.includes('host')) out.push(`--host=${host}`);
        if (gate.flags.includes('root')) out.push(`--root=${host}/frontend`);
        /* ⛓ a gate with no flag at all still runs — it brings its own world. */
        return out;
    }
    if (where === 'live') {
        if (gate.flags.includes('root')) return [`--root=${pages}`];
        if (gate.flags.includes('pages')) {
            return [`--host=${host}`, `--pages=${pages}`];
        }
        return null;
    }
    throw new Error(`gateRoster: unknown world ${JSON.stringify(where)} — local or live`);
}

/** The gates that can be run in a given world, with their argv. */
export function gatesFor(where, opts = {}) {
    return gateRoster(opts).map((g) => ({ gate: g, argv: argvFor(g, where, opts) }))
        .filter((r) => r.argv !== null);
}
