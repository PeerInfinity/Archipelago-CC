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
/**
 * ⛓⛓⛓ A SIBLING INSTRUMENT THIS FILE ACTUALLY REFERENCES — spelled as a
 * MODULE PATH, which is the only spelling a spawn or an import can use.
 *
 * ⛔⛔ AND THAT NARROWNESS IS THE SAME LAW `WINDOWS_RE` STATES ONE COMMENT
 * DOWN: **THE DETECTOR IS THE REFERENCE, NOT THE MENTION.** Until R9 slice
 * 12j this matched `scripts/procgen/<name>.mjs` as well — the spelling a
 * USAGE LINE uses. Over the 31 gates that cost nothing, because a gate that
 * quotes a browser instrument in its header generally spawns it too. Over
 * ALL 260 instruments in this directory (which is the population `boxLock`'s
 * taker set is derived from since 12j) it was catastrophic: of the twenty
 * files it pulled in transitively, exactly ONE reached a browser by a real
 * reference and NINETEEN merely printed
 * `node scripts/procgen/check-seedling-bot-differential.mjs --win --record`
 * in a docblock. Four of those nineteen are the headless `solve-seedling-*`
 * producers, whose 2-second `--check` would have been made to queue behind a
 * 142-minute drive — the exact failure `boxLock`'s two-directional lint
 * exists to prevent, arriving through the front door.
 *
 * ⛓ AND IT HAS A THIRD COSTUME: comment-stripping is NOT enough. Two of the
 * three survivors of that were `console.log`/template-literal strings that
 * PRINT a suggested command line (`plan-seedling-r5-bobboss.mjs:160`,
 * `probe-seedling-r5-spinner.mjs:262`) — a usage line living in code. What
 * separates a reference from a mention is not where it sits, it is how it is
 * SPELLED: `'./name.mjs'` resolves, `scripts/procgen/name.mjs` reads.
 *
 * ⛓ MEASURED BOTH WAYS AT 12j: over the gate roster `browser` is 23 before
 * and 23 after — this narrowing moves NO gate, so `gates.mjs`, the standing
 * rows and the 27 pre-12j takers are untouched by it.
 */
const SIBLING_RE = /['"`]\.\/([a-z][a-zA-Z0-9-]*\.mjs)['"`]/g;

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
 * ⛓⛓⛓ R9 P3b (g) — **A GATE WHOSE VALUE CI CANNOT ANSWER SAYS SO ITSELF.**
 *
 *     * @ci-face <key prefix>: <argv | (none)>
 *
 * ⛔⛔ WHY IT IS DECLARED AND NOT DETECTED. The first cut asked whether a
 * gate's source holds a `/mnt/c/` path, and got trap 566 for the second time
 * in this slice: `check-seedling-rerecord-rehearsal.mjs` names that directory
 * ONLY IN ORDER TO MEASURE THAT IT NEVER TOUCHES IT (it fingerprints the
 * listing around its child and handles `ABSENT` explicitly), so a
 * mention-detector filed a gate whose value is perfectly CI-answerable under
 * a structure key. **Whether a value survives a fresh checkout is a fact only
 * the gate knows**, and the gate is where `@standing-variant` already lives.
 *
 * The `<key prefix>` REPLACES `gate:` for the CI row, which is what keeps a
 * structure number from ever being read as the value: they are different
 * keys, not two readings of one.
 */
const CI_FACE_LINE_RE = /^[ \t]*\*[ \t]*@ci-face\b(.*)$/gm;

/**
 * ⛓⛓⛓ S4 (⚖ 72) — **A GATE WHOSE QUESTION CI'S CHECKOUT CANNOT ASK SAYS SO
 * ITSELF.**
 *
 *     * @ci-shallow <why a depth-1 checkout cannot answer this gate>
 *
 * ⛔⛔ THE DEFECT IT NAMES, MEASURED AT S3 AND CALLED TRAP 1058. `actions/
 * checkout` clones at DEPTH 1, so a gate whose subject is the repository's
 * HISTORY is asked its question against a tree that carries one commit.
 * `check-seedling-full-tier-owed` reads `2/0/1` there and REFUSES BY NAME in
 * its own printed line; `check-slice-records` reads `42/24` and does not —
 * it derives "where the `**⇒ ` convention starts" from `git log`, and in a
 * shallow clone the earliest commit it can see IS HEAD. Both disagree with
 * the bank in CI at EVERY head and always will.
 *
 * ⛔⛔ AND THIS IS WHY THE DECLARATION EXISTS RATHER THAN A TIMING BAND. Until
 * S4 the ONLY thing keeping those two rows out of the CI-sourced set was
 * `¬cheap` — both are under the 60 s ± 10 % hysteresis band today. `cheap` is
 * a MEASURED field about how long a row takes; a row that crossed the band
 * (`slice-records` is 30.8 s and grows with every recorded slice) would have
 * become CI-sourced silently and started banking the shallow clone's answer
 * as this tree's truth. ⇒ a row that must never be CI-sourced is excluded by
 * a clause that names the REASON, and the reason is a fact only the gate
 * knows — the same argument `@ci-face` is declared and not detected by
 * (trap 566: a mention-detector filed the wrong gate).
 *
 * ⛓ THE FREE TEXT IS THE REASON, not a key prefix and not argv: unlike a CI
 * face, a shallow gate publishes NO second claim under a second key. Its CI
 * line is evidence for whoever is repairing the gate (S4b (2) owes
 * `slice-records` a refusal-by-name), never a value.
 *
 * ⛓ AND IT IS ONE LINE TO DELETE. If a later slice gives CI the history the
 * gate needs (`fetch-depth: 0`, priced against every job's clone time), the
 * declaration is what that slice removes — in the gate that knows, not in a
 * rule three files away.
 */
const CI_SHALLOW_LINE_RE = /^[ \t]*\*[ \t]*@ci-shallow\b(.*)$/gm;

/**
 * ⛓⛓⛓ S5 (⚖ 72) — **A GATE WHOSE CI RUN NEEDS A FLAG THE BOX DOES NOT, AND
 * WHOSE CLAIM DOES NOT MOVE WITH IT.**
 *
 *     * @ci-argv <flags>: <why these flags do not move the claim>
 *
 * ⛔⛔ IT IS NOT A SECOND `@ci-face`, AND THE DIFFERENCE IS THE WHOLE SLICE.
 * A face says *"the number CI can produce for me is a DIFFERENT CLAIM"*, and
 * takes its own key prefix so a bounded number can never be read as the
 * standing one — which is also why a faced gate is NEVER CI-sourced (P4b
 * (D)). This declaration says the opposite: *"the claim is the SAME one, and
 * CI needs one flag to ask it inside a checkout"*. So its line is published
 * under the STANDING key, the row is CI-sourced like any other, and not one
 * clause of `ciSourced` moves.
 *
 * ⛓ THE ONE DECLARER TODAY, and it is the case the distinction was measured
 * on. `check-procgen-help.mjs` drives a throwaway `git worktree` on the box,
 * because a run that lets 252 module-scope workers write is a run that
 * dirties the primary tree (SG1 W2, ⚖ 71 (b)). A RUNNER'S CHECKOUT ALREADY
 * IS THAT THROWAWAY — and a linked worktree there does not inherit
 * `submodules: recursive`, so it would pay a network re-clone of six
 * submodules per push for no containment at all, or hand back the false green
 * an uninitialised submodule produces. `--in-place` is therefore a fact about
 * WHERE the children run and not about WHAT is asked, and SG1 measured
 * exactly that: at one head the worktree arm and the `--in-place` arm agree
 * on ALL 265 rows, verdict and both door marks.
 *
 * ⛔⛔ THE HAZARD IT OPENS, NAMED HERE RATHER THAN DISCOVERED LATER. A flag
 * that NARROWS the question (`--only=`, `--doors=ci`, a mutant flag) would
 * publish a bounded number under the standing key — which is the exact defect
 * `@ci-face` exists to prevent, wearing this declaration as a costume. Two
 * things hold it shut and neither is a promise: the reason is MANDATORY,
 * because this is the only place that argument can be made; and
 * `ciGatePlan.test.js` asserts the structural half — a standing-keyed arm's
 * argv is the LOCAL argv PLUS the declared flags, never a replacement — so a
 * face's substitution can never arrive through this door.
 */
const CI_ARGV_LINE_RE = /^[ \t]*\*[ \t]*@ci-argv\b(.*)$/gm;

/**
 * ⛓⛓⛓ V3b (⚖ user, 2026-09-05) — **A GATE THE BOX MUST ANSWER, BECAUSE A
 * RUNNER CANNOT — AND IT SAYS SO ITSELF.**
 *
 *     * @ci-box <why the box must answer this gate>
 *
 * ⛔⛔ THE DEFECT IT NAMES, MEASURED BEFORE IT EXISTED. V3b renamed the 49
 * `verify-*` scripts that print a verdict and can fail to `check-*`, which is
 * the ONE membership rule all three gate mechanisms key on. `ciRunnable` was
 * `!gate.windows` — the whole predicate — so the rename alone would have
 * enrolled every non-Windows one of them in CI, and `planCiShards` prices an
 * arm the runner has never measured AT THE WHOLE BUDGET (its own docblock:
 * *"pricing an unknown at zero is how one shard silently becomes the slow
 * one"*). Measured in a mirrored repo root with the naked rename applied:
 * browser **25 arms / 3 shards → 52 / 30**, headless **31 / 1 → 51 / 21** —
 * **4 → 51 procgen gate jobs on every push**, 47 of them unpriced at 600 s
 * each, and an unknown number of them RED (an uncommitted fixture, a
 * `Generate.py` and a Python venv, the omsi submodule, 171 s of wall clock).
 *
 * ⛔⛔ AND IT IS A DECLARATION FOR THE REASON `@ci-shallow` IS ONE, WORD FOR
 * WORD: *"a row that must never be CI-sourced is excluded by a clause that
 * names the REASON, and the reason is a fact only the gate knows"*. A timing
 * band would have been the alternative and it is the shape this file already
 * refuses — `feedback_exclusion_by_a_timing_band_names_no_reason`: a gate that
 * got faster would join CI silently, and a gate that got slower would leave it
 * silently, in both cases without anyone deciding.
 *
 * ⛓ THE FREE TEXT IS THE REASON, like `@ci-shallow` and unlike `@ci-face`: a
 * box-only gate publishes NO claim in CI at all, so there is no second key to
 * name and no argv to declare. It is what `ci-gates` prints beside the SKIP
 * and what `ci-summary` refuses with.
 *
 * ⛓ AND IT IS ONE LINE TO DELETE. Adopting a gate into CI is removing its
 * declaration — in the gate that knows, not in a rule three files away — and
 * the shard plan moving is then a DECISION somebody made, visible in a diff.
 */
const CI_BOX_LINE_RE = /^[ \t]*\*[ \t]*@ci-box\b(.*)$/gm;

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
 * The CI face a gate declares, or `null`. ⛔ A malformed line is a refusal BY
 * NAME for the same reason `variantsIn` refuses one: a declaration nobody
 * parsed is a CI row that silently does not exist.
 */
export function ciFaceIn(text, { file = '(text)' } = {}) {
    const hits = [...text.matchAll(CI_FACE_LINE_RE)];
    if (!hits.length) return null;
    if (hits.length > 1) {
        throw new Error(`gateRoster: ${file} declares ${hits.length} @ci-face lines — a gate `
            + 'has one CI face or none; two would be two keys for one run');
    }
    const body = VARIANT_BODY_RE.exec(hits[0][1]);
    if (!body) {
        throw new Error(`gateRoster: ${file} has a malformed @ci-face line — expected `
            + '`@ci-face <key prefix>: <argv | (none)>`, got '
            + `${JSON.stringify(hits[0][0].trim())}`);
    }
    const [, prefix, rhs] = body;
    const argv = rhs === '(none)' ? [] : rhs.split(/\s+/);
    const bad = argv.find((a) => !a.startsWith('--'));
    if (bad) {
        throw new Error(`gateRoster: ${file} declares a @ci-face with ${JSON.stringify(bad)}, `
            + 'which is not a flag — the argv is the LITERAL extra flags that face is run '
            + 'with, or `(none)`');
    }
    return { prefix, argv };
}

/**
 * The shallow-clone refusal a gate declares, or `null`. ⛔ A line with no
 * reason on it is refused BY NAME: the reason is the whole content of the
 * declaration (it is what `ci-summary` prints when it refuses the key and
 * what a reader of `--gates` is owed), so an empty one would arm a silent
 * exclusion — the shape this declaration exists to replace.
 */
export function ciShallowIn(text, { file = '(text)' } = {}) {
    const hits = [...text.matchAll(CI_SHALLOW_LINE_RE)];
    if (!hits.length) return null;
    if (hits.length > 1) {
        throw new Error(`gateRoster: ${file} declares ${hits.length} @ci-shallow lines — a gate `
            + 'is answerable in a depth-1 checkout or it is not, and two reasons for one '
            + 'exclusion is two rules');
    }
    const reason = hits[0][1].trim();
    if (!reason) {
        throw new Error(`gateRoster: ${file} has a malformed @ci-shallow line — expected `
            + '`@ci-shallow <why a depth-1 checkout cannot answer this gate>`, got '
            + `${JSON.stringify(hits[0][0].trim())}`);
    }
    return { reason };
}

/**
 * The box-only refusal a gate declares, or `null`. ⛔ Same refusals as
 * `ciShallowIn`, and for the same reason: an empty reason would arm a SILENT
 * exclusion from CI, which is the exact shape this declaration replaces.
 */
export function ciBoxIn(text, { file = '(text)' } = {}) {
    const hits = [...text.matchAll(CI_BOX_LINE_RE)];
    if (!hits.length) return null;
    if (hits.length > 1) {
        throw new Error(`gateRoster: ${file} declares ${hits.length} @ci-box lines — a gate is `
            + 'answerable on a runner or it is not, and two reasons for one exclusion is two '
            + 'rules');
    }
    const reason = hits[0][1].trim();
    if (!reason) {
        throw new Error(`gateRoster: ${file} has a malformed @ci-box line — expected `
            + '`@ci-box <why the box must answer this gate>`, got '
            + `${JSON.stringify(hits[0][0].trim())}`);
    }
    return { reason };
}

/**
 * The CI-only flags a gate declares, or `null`. ⛔ A malformed line, an empty
 * reason and a second declaration are all refusals BY NAME, for the reason
 * `ciShallowIn` states one function up: a declaration nobody parsed is a CI
 * run that silently asks a different question under the standing key.
 *
 * ⛓ THE LEFT SIDE IS FLAGS AND THE RIGHT SIDE IS THE ARGUMENT. `(none)` is
 * not accepted — a `@ci-argv` with no flags declares nothing — and it is
 * refused by the same clause that refuses any non-flag token.
 */
export function ciArgvIn(text, { file = '(text)' } = {}) {
    const hits = [...text.matchAll(CI_ARGV_LINE_RE)];
    if (!hits.length) return null;
    if (hits.length > 1) {
        throw new Error(`gateRoster: ${file} declares ${hits.length} @ci-argv lines — a gate `
            + 'runs ONE way in CI, and two declarations would be two argv for one run');
    }
    const body = VARIANT_BODY_RE.exec(hits[0][1]);
    if (!body) {
        throw new Error(`gateRoster: ${file} has a malformed @ci-argv line — expected `
            + '`@ci-argv <flags>: <why these flags do not move the claim>`, got '
            + `${JSON.stringify(hits[0][0].trim())}`);
    }
    const [, lhs, reason] = body;
    const argv = lhs.trim().split(/\s+/);
    const bad = argv.find((a) => !a.startsWith('--'));
    if (bad) {
        throw new Error(`gateRoster: ${file} declares a @ci-argv with ${JSON.stringify(bad)}, `
            + 'which is not a flag — the left side is the LITERAL extra flags CI adds to this '
            + "gate's local argv, and the right side is why they do not move the claim");
    }
    return { argv, reason };
}

/**
 * Every gate in `scripts/procgen/`, with the flags it reads and whether it
 * drives a browser — the gate's own text is the only source.
 */
/**
 * ⛓⛓⛓ THE INSTRUMENT DIRECTORY, READ ONCE — and the ONE place a file is
 * classified `browser` or `windows`.
 *
 * ⛔ THERE IS ONE CLASSIFIER BECAUSE THERE IS ONE QUESTION. `gateRoster`
 * asks it of the 31 `check-*.mjs`; `machineDrivers` (R9 slice 12j, ⚖ ruling
 * 62) asks it of all 260. A second copy of the two regexes would be a second
 * answer to "does this thing drive the machine", and the box lock's whole
 * correctness is that the answer is one.
 */
function instrumentDir(repo) {
    const dir = join(repo, SCRIPT_DIR);
    const textOf = new Map();
    const read = (f) => {
        if (!textOf.has(f)) {
            try { textOf.set(f, readFileSync(join(dir, f), 'utf8')); } catch { textOf.set(f, ''); }
        }
        return textOf.get(f);
    };
    /**
     * ⛓ ONE HOP, AND THAT BOUND IS NAMED. `browser` is "this file, or a
     * sibling it references". A full transitive closure was MEASURED at 12j
     * over all 260 instruments and adds NOTHING at this head (77 either way),
     * so the hop count is not currently load-bearing — but a chain of three
     * would be invisible here, and this sentence is where the next reader
     * finds that out instead of assuming.
     */
    const siblings = (f) => [...new Set([...read(f).matchAll(SIBLING_RE)].map((m) => m[1]))]
        .filter((s) => s !== f);
    const browserVia = (f) => (PLAYWRIGHT_RE.test(read(f))
        ? null
        : siblings(f).find((s) => PLAYWRIGHT_RE.test(read(s))) ?? null);
    const browser = (f) => PLAYWRIGHT_RE.test(read(f)) || browserVia(f) !== null;
    const windows = (f) => WINDOWS_RE.test(read(f));
    const all = () => readdirSync(dir).filter((f) => /\.mjs$/.test(f)).sort();
    return { read, all, browser, browserVia, windows };
}

/**
 * ⛓⛓⛓ R9 SLICE 12j, ⚖ RULING 62 — **EVERY INSTRUMENT IN THIS DIRECTORY THAT
 * DRIVES THE MACHINE, not only the ones whose name begins `check-`.**
 *
 * ⛔⛔ THE DEFECT THIS CLOSES, MEASURED. P3b derived the box lock's takers
 * from `gateRoster`, i.e. from `check-*.mjs`. So the instruments that hold
 * the GPU LONGEST took no lock at all: a 142-minute
 * `check-seedling-bot-differential --win --tier=full` ran with no
 * `lock.json` on disk while three sessions worked beside it. A lock whose
 * population is "the files somebody named `check-`" is a lock over a naming
 * convention, not over a box.
 *
 * ⛓ `kind` is `windows` when the file holds the Windows driver path,
 * `browser` otherwise — the same two-kind answer the gates have always
 * carried, over the wider population.
 *
 * @returns {{file: string, path: string, kind: string, browserVia: string|null}[]}
 */
export function machineDrivers({ repo = REPO } = {}) {
    const D = instrumentDir(repo);
    return D.all()
        .filter((f) => D.browser(f) || D.windows(f))
        .map((f) => ({
            file: f,
            path: `${SCRIPT_DIR}/${f}`,
            kind: D.windows(f) ? 'windows' : 'browser',
            browserVia: D.browserVia(f),
        }));
}

export function gateRoster({ repo = REPO } = {}) {
    const D = instrumentDir(repo);
    const files = D.all().filter(isGateFile);
    return files.map((file) => {
        const text = D.read(file);
        const flags = ['host', 'root', 'pages'].filter((n) => readsFlag(text, n));
        const ciFace = ciFaceIn(text, { file });
        const ciArgv = ciArgvIn(text, { file });
        const ciBox = ciBoxIn(text, { file });
        /**
         * ⛔⛔ S5 — **THE TWO CI DECLARATIONS DO NOT COMPOSE, AND THE ROSTER
         * SAYS SO BY NAME.** A face already carries the argv CI runs it with
         * AND replaces the key it publishes under; a `@ci-argv` says the run
         * is the SAME claim under the SAME key. A gate declaring both would
         * publish one run under two contradictory readings, and whichever of
         * them a consumer happened to check first would decide silently.
         * ⛓ This is the same refusal shape as the duplicate-line ones, one
         * level up: the pair, not the line.
         */
        /**
         * ⛔⛔ V3b — **A BOX-ONLY GATE HAS NO CI RUN, SO IT CANNOT ALSO
         * DECLARE HOW ONE GOES.** `@ci-face` says *"the number CI can produce
         * for me is a different claim"* and `@ci-argv` says *"CI needs one
         * flag to ask my claim inside a checkout"* — both are statements about
         * a run that `@ci-box` says does not happen. A gate declaring the pair
         * would leave whichever consumer read which declaration first to
         * decide silently, which is the refusal one clause down, one level up.
         */
        if (ciBox && (ciFace || ciArgv)) {
            throw new Error(`gateRoster: ${file} declares \`@ci-box\` AND `
                + `\`${ciFace ? `@ci-face ${ciFace.prefix}` : `@ci-argv ${ciArgv.argv.join(' ')}`}\``
                + ' — a box-only gate has no CI run for a face to re-key or for argv to point,'
                + ' so one of the two is not true of this gate.');
        }
        if (ciFace && ciArgv) {
            throw new Error(`gateRoster: ${file} declares BOTH \`@ci-face `
                + `${ciFace.prefix}\` and \`@ci-argv ${ciArgv.argv.join(' ')}\` — a face is a `
                + 'DIFFERENT claim under its own key and already carries its own argv, while '
                + '@ci-argv is the SAME claim under the standing key. One run cannot be both.');
        }
        return {
            file,
            path: `${SCRIPT_DIR}/${file}`,
            flags,
            browser: D.browser(file),
            windows: D.windows(file),
            /** ⛓ …and the SECOND ARMS this gate declares — `[]` for every gate
             *  that declares none, which is all of them but one. */
            variants: variantsIn(text, { file }),
            /** ⛓ …and the CI face it declares, or `null` (R9 P3b (g)). */
            ciFace,
            /** ⛓ …and the CI-ONLY FLAGS it declares, or `null` (S5, ⚖ 72) —
             *  the same claim, run the way a checkout can run it. */
            ciArgv,
            /** ⛓ …and the depth-1 refusal it declares, or `null` (S4, ⚖ 72). */
            ciShallow: ciShallowIn(text, { file }),
            /** ⛓ …and the BOX-ONLY refusal it declares, or `null` (V3b) —
             *  `ciRunnable` reads this, so a gate with one gets no CI arm. */
            ciBox,
            /** ⛓ …and by which sibling, when it is not by itself. */
            browserVia: D.browserVia(file),
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
