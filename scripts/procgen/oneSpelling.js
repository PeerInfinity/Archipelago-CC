/**
 * oneSpelling — **THE MODEL HAS ONE TRANSCRIPTION OF `Point.length`, AND
 * NOTHING IN ITS REACH SPELLS THE QUANTITY A SECOND WAY.** R9 slice P3 (E),
 * trap 729, ⚖ ruling 17.
 *
 * ── ⛔⛔⛔ WHY A COMMENT WAS NOT ENOUGH ────────────────────────────────
 *
 * `docs/json/developer/procgen/seedling-bot.md` records the finding twice:
 *
 *   > **`Point.length` is `sqrt(x*x + y*y)` and `normalize` is
 *   > `x *= t / length`.** A model computing the same quantity more accurately
 *   > diverges from the runtime; one ulp decided a walk/coast arm sitting
 *   > exactly on `moveSpeed`, and cost a DRAW rather than a pixel.
 *
 * `finalBossFight.js`'s own docblock says it harder — *"every length, normalize
 * and distance the Owl's fight computes goes through these two"* — and forty
 * lines below it, `finalBossCoast` computed a step distance with `Math.hypot`.
 * A true sentence in a header is not a check ([[feedback_header_warning_is_not_a_check]]);
 * this module is the check. R9 slice 12e⁗ paid for the same class twice more,
 * in two roundings of one AS3 line.
 *
 * ── THE SUBJECT, DERIVED ─────────────────────────────────────────────
 *
 * ⛔ NOT "the tree", and not a hand list. The subject is the files that DEFINE
 * or IMPORT the transcription — an IMPORT GRAPH question, answered by reading
 * `import` statements. That matters: `r6Acceptance.js` MENTIONS `pointLength`
 * in a comment and is not a member, and a lint that had grepped for the name
 * would have made prose decide its own subject, which is the very thing
 * ⚖ ruling 17 forbids.
 *
 * ── ⛔⛔ THE BOUND, AND WHAT IT EXCLUDES ─────────────────────────────
 *
 * `Math.hypot` is not wrong everywhere — it is wrong where the answer must be
 * the RUNTIME's double. `solverBot.js` spells it 32 times for PLANNING
 * distances that never reach a tape; `playerPhysicsV2.js:1311` uses it for a
 * `> 0` zero-test, where every monotone length function gives the same
 * boolean; `spinner.js`, `pushables.js`, `fireVerb.js`, `levelRun.js` and the
 * rest are outside the transcription's import reach. **None of them is visited
 * by this law, and that is stated rather than implied** — a "0 findings" line
 * that did not name its bound would read as a claim about the whole tree
 * ([[feedback_bounded_sweep_must_name_what_it_bounded]]).
 *
 * ── ⛔ THE ALLOW-LIST IS EMPTY, AND STAYS EMPTY ──────────────────────
 *
 * A new spelling inside the subject is a RED LINE, never an allow entry: the
 * whole point is that the subject is the set where the last bit is the answer.
 * If a site genuinely needs the accurate function, it does not belong in a
 * transcription module — move the site, not the law.
 * [[feedback_deriving_a_roster_arms_a_dormant_lint]]
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, '..', '..');
const MODEL_DIR = 'frontend/modules/seedlingDemo';

export class OneSpellingError extends Error {
    constructor(message) { super(message); this.name = 'OneSpellingError'; }
}
const fail = (m) => { throw new OneSpellingError(m); };

/**
 * The transcriptions the tracked doc names. ⛓ The NAMES are this repository's
 * spelling of the runtime primitives; the doc names the PRIMITIVES.
 */
export const TRANSCRIPTIONS = Object.freeze(['pointLength', 'pointNormalize']);

/** The second spelling the law forbids inside the subject. */
export const FORBIDDEN = Object.freeze(['Math.hypot']);

/**
 * ⛔ THE ALLOW-LIST. It is empty and a new entry is a design decision, not a
 * repair — see the header. It exists as a named constant so that "there is no
 * allow-list" is a readable fact rather than an absence.
 */
export const ALLOWED_SITES = Object.freeze([]);

/**
 * Strip comments and string/template literals, keeping the byte OFFSETS so a
 * finding can still name a line.
 *
 * ⛔ THIS IS THE WHOLE DIFFERENCE BETWEEN A LINT AND A GREP. `Math.hypot`
 * appears SIX times in the subject today and every one of them is inside a
 * docblock explaining why it must not be used. A grep would report six
 * violations, a reader would learn to ignore the lint, and the seventh — a
 * real one — would ride in behind them.
 */
export function stripInert(text) {
    const out = Array.from(text);
    let i = 0;
    const blank = (from, to) => {
        for (let k = from; k < to && k < out.length; k += 1) {
            if (out[k] !== '\n') out[k] = ' ';
        }
    };
    while (i < text.length) {
        const two = text.slice(i, i + 2);
        if (two === '//') {
            const end = text.indexOf('\n', i);
            blank(i, end === -1 ? text.length : end);
            i = end === -1 ? text.length : end;
            continue;
        }
        if (two === '/*') {
            const end = text.indexOf('*/', i + 2);
            blank(i, end === -1 ? text.length : end + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        const ch = text[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            let k = i + 1;
            while (k < text.length) {
                if (text[k] === '\\') { k += 2; continue; }
                if (text[k] === ch) break;
                k += 1;
            }
            blank(i + 1, k);
            i = k + 1;
            continue;
        }
        /**
         * ⛓ A REGEX LITERAL IS NOT SCANNED FOR. It cannot contain `Math.hypot`
         * as an identifier reference, so treating one as code costs nothing —
         * and telling a regex from a division needs a parser. The bound is
         * named rather than guessed at.
         */
        i += 1;
    }
    return out.join('');
}

/** Every live occurrence of a forbidden spelling, with its 1-based line. */
export function liveSites(text, { forbidden = FORBIDDEN } = {}) {
    const code = stripInert(text);
    const rows = [];
    for (const token of forbidden) {
        let at = code.indexOf(token);
        while (at !== -1) {
            rows.push({ token, line: code.slice(0, at).split('\n').length });
            at = code.indexOf(token, at + token.length);
        }
    }
    return rows.sort((a, b) => a.line - b.line);
}

const modelFiles = (repo) => {
    const dir = join(repo, MODEL_DIR);
    if (!existsSync(dir)) fail(`oneSpelling: ${MODEL_DIR} is not in ${repo}`);
    return readdirSync(dir)
        .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
        .sort()
        .map((f) => `${MODEL_DIR}/${f}`);
};

/**
 * Where each transcription is DEFINED. More than one definition of the same
 * name is the law's first finding — two spellings of one runtime primitive
 * agree until one moves.
 *
 * @returns {Map<string, string[]>} transcription name -> defining file(s)
 */
export function definitionsOf({ repo = REPO_DEFAULT } = {}) {
    const out = new Map(TRANSCRIPTIONS.map((n) => [n, []]));
    for (const rel of modelFiles(repo)) {
        const code = stripInert(readFileSync(join(repo, rel), 'utf8'));
        for (const name of TRANSCRIPTIONS) {
            const re = new RegExp(`export\\s+(?:function|const|let)\\s+${name}\\b`);
            if (re.test(code)) out.get(name).push(rel);
        }
    }
    return out;
}

/**
 * The SUBJECT — files that define a transcription, or import one by a real
 * `import` statement. ⛔ A comment that mentions the name is not a member.
 */
export function transcriptionSubject({ repo = REPO_DEFAULT } = {}) {
    const defs = definitionsOf({ repo });
    const subject = new Set([...defs.values()].flat());
    const names = TRANSCRIPTIONS.join('|');
    for (const rel of modelFiles(repo)) {
        const code = stripInert(readFileSync(join(repo, rel), 'utf8'));
        for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
            if (!new RegExp(`\\b(?:${names})\\b`).test(m[1])) continue;
            subject.add(rel);
        }
    }
    return [...subject].sort();
}

/**
 * The law, as findings. Empty is the only passing answer.
 *
 * @returns {{file: string, line: number, token: string}[]}
 */
export function secondSpellings({ repo = REPO_DEFAULT } = {}) {
    const rows = [];
    for (const rel of transcriptionSubject({ repo })) {
        for (const site of liveSites(readFileSync(join(repo, rel), 'utf8'))) {
            const id = `${rel}:${site.line}`;
            if (ALLOWED_SITES.includes(id)) continue;
            rows.push({ file: rel, line: site.line, token: site.token });
        }
    }
    return rows;
}

/**
 * ⛓ WHAT THE LAW DOES **NOT** VISIT — the model files outside the subject that
 * spell a forbidden token, so the bound is printed beside the finding count
 * rather than left to a reader's assumption.
 */
export function outsideTheBound({ repo = REPO_DEFAULT } = {}) {
    const subject = new Set(transcriptionSubject({ repo }));
    const rows = [];
    for (const rel of modelFiles(repo)) {
        if (subject.has(rel)) continue;
        const n = liveSites(readFileSync(join(repo, rel), 'utf8')).length;
        if (n) rows.push({ file: rel, sites: n });
    }
    return rows.sort((a, b) => b.sites - a.sites || a.file.localeCompare(b.file));
}
