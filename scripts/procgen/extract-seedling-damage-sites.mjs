#!/usr/bin/env node
// Seedling damage-site extractor — every class in a Seedling source checkout
// that can damage, displace or kill the PLAYER, read off the call sites, into
// the ONE committed module `seedlingDemo/seedlingDamageSites.js`.
//
// Region-atlas Phase 8, subtractive ladder rung R5, slice 2. Brief:
// `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.4, §4 slice 2.
//
// ── ⚠⚠ WHY THIS EXISTS AT ALL: THE §14 LESSON, PAID FORWARD ───────────
//
// Slice 2's headline is "the combat census as a CONSULTED role — the
// Puzzlements damage family is IN it or the builder throws". A census is a
// claim about an ABSENCE ("nothing else on this map can hurt you"), and R4
// §14's lesson is that a check sharing its subject's derivation verifies
// nothing: `combat.js`'s two tables were written by READING the classes a
// human already believed were dangerous, so a table-vs-table assertion would
// agree with the omission that produced it. Thirty-two mutations agreed with
// the R4 bug for exactly that reason.
//
// So the list of dangerous classes is derived a SECOND, INDEPENDENT way: from
// the CALL SITES. A class is dangerous iff somewhere in the checkout it calls
// `hit()` / `drown()` / `die()` on a `Player`-typed expression, or writes a
// Player's position. That derivation knows nothing about which classes are
// "enemies" and nothing about `combat.js`; it is a grep over the game's own
// text. `combat.assertDamageFamilyCovered` then requires the two to agree,
// and every disagreement is either a missing row or a declared exclusion with
// a citation.
//
// ── WHAT IT FOUND ON ITS FIRST RUN ────────────────────────────────────
//
// Three classes the two combat tables did not carry, none of them an enemy:
// `Scenery/RockFall` (⚠ RNG-SIZED HITBOX — see the module's own header),
// `Scenery/Pod` and `Enemies/Tentacle`. All three are R6's by construction —
// the first two are spawned only by `FinalBoss`, `Pod` is L112's — which is
// the point: "R5 has no gameplay RNG in scope" is now a CHECKED fact with a
// named reason rather than a lucky one.
//
// ── Why a JS module and not JSON ──────────────────────────────────────
// Same reason as the pixelmask extractor: `combat.js` and `levelWorld.js` are
// browser-usable and import-free of anything node-shaped, and a generated JS
// module imports from both sides with no loader
// (`feedback_browser_safe_export_node_module`).
//
// Usage:
//   node scripts/procgen/extract-seedling-damage-sites.mjs --source ~/CC/seedling
//   node scripts/procgen/extract-seedling-damage-sites.mjs --source <path> --check
//
// --check re-extracts and compares against the committed module WITHOUT
// writing, exiting 1 on any difference. The module holds no timestamp so the
// check is exact: same checkout in, same bytes out.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_OUT = join(REPO_ROOT, 'frontend/modules/seedlingDemo/seedlingDamageSites.js');

/**
 * Directories that are the RUNTIME, not the game.
 *
 * `net/flashpunk` is FlashPunk itself: `World.as`'s `p.x = toX` lines are the
 * MOVE SWEEP writing back a resolved position, which is the physics this arc
 * transcribed at R0 and not a hazard. Excluding it is a declared decision,
 * not a filter that happens to be quiet.
 */
const EXCLUDED_DIRS = ['net'];

/**
 * `Player.as` is the player's own body.
 *
 * Its `hit(null, 0, null, 0)` calls ARE damage sites — lava, drowning, the
 * fall — but they are the PLAYER's, transcribed since R0 and driven by the
 * terrain resolver rather than by any placed entity. A census of "what else
 * on this map can hurt you" that listed the player would be listing the
 * question.
 */
const EXCLUDED_FILES = ['Player.as'];

const args = process.argv.slice(2);
const optOf = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
    const eq = args.find((a) => a.startsWith(`--${name}=`));
    return eq === undefined ? fallback : eq.slice(name.length + 3);
};
const CHECK = args.includes('--check');
const SOURCE = resolve((optOf('source') ?? join(process.env.HOME ?? '/home/robert', 'CC/seedling'))
    .replace(/^~/, process.env.HOME ?? '/home/robert'));
const OUT = resolve(optOf('out') ?? DEFAULT_OUT);

function walk(dir, out = []) {
    for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (EXCLUDED_DIRS.includes(name)) continue;
            walk(full, out);
        } else if (name.endsWith('.as') && !EXCLUDED_FILES.includes(name)) {
            out.push(full);
        }
    }
    return out;
}

/**
 * The four ways one class reaches the player, in the order of how loud they
 * are. `hit` is the damage family §2.4 is about; the other three are why a
 * "damage census" is not enough on its own — `Whirlpool` never calls `hit`
 * and drowns you anyway, and `LavaTrap`'s tongue calls `die()` outright.
 */
const KINDS = Object.freeze({
    hit: 'calls Player.hit — the damage family',
    drown: 'calls Player.drown() — no hit(), no noDamage guard',
    die: 'calls Player.die() — lethal at any hitsMax',
    move: 'writes the player\'s position — displacement, not damage',
});

/**
 * Read one `.as` file and return the sites it holds.
 *
 * ⚠ THE RECEIVER IS RESOLVED, NOT PATTERN-MATCHED ON A NAME. A grep for
 * `p.hit(` would miss `hitPlayer.hit(...)` (`BobSoldier.as:169`) and would
 * match any local called `p` of any type. So the declared `Player` locals are
 * collected first — `var p:Player`, `var hitPlayer:Player`, a `Player`
 * parameter — and a call counts only when its receiver is one of them or an
 * inline `as Player` cast.
 */
function sitesIn(text, file) {
    const players = new Set(['player']);
    for (const m of text.matchAll(/(?:var|const)\s+(\w+)\s*:\s*Player\b/g)) players.add(m[1]);
    for (const m of text.matchAll(/\(\s*(\w+)\s*:\s*Player\b/g)) players.add(m[1]);
    for (const m of text.matchAll(/,\s*(\w+)\s*:\s*Player\b/g)) players.add(m[1]);
    const names = [...players].sort();
    const sites = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        // A commented-out call is not a call. The game has plenty of them —
        // `dropCoins()` is dead at every call site for exactly this reason —
        // and a census that counted them would price a hazard that cannot
        // fire.
        const code = line.replace(/\/\/.*$/, '').trim();
        if (code === '' || code.startsWith('*') || code.startsWith('/*')) continue;
        const cast = /\(\s*[\w[\]]+\s+as\s+Player\s*\)\s*\.(\w+)\s*\(/g;
        for (const m of code.matchAll(cast)) {
            if (m[1] === 'hit') sites.push({ kind: 'hit', line: i + 1, text: code });
            else if (m[1] === 'drown') sites.push({ kind: 'drown', line: i + 1, text: code });
            else if (m[1] === 'die') sites.push({ kind: 'die', line: i + 1, text: code });
        }
        for (const name of names) {
            const call = new RegExp(`(^|[^\\w.])${name}\\.(hit|drown|die)\\s*\\(`);
            const hitM = call.exec(code);
            if (hitM) sites.push({ kind: hitM[2], line: i + 1, text: code });
            const move = new RegExp(`(^|[^\\w.])${name}\\.(x|y)\\s*=[^=]`);
            if (move.test(code)) sites.push({ kind: 'move', line: i + 1, text: code });
        }
    }
    // A line can match twice (`p.x = x; p.y = y;` on one line); collapse to
    // one row per (kind, line) so the artifact is a set of SITES.
    const seen = new Set();
    return sites.filter((s) => {
        const k = `${s.kind}:${s.line}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    }).map((s) => ({ ...s, file }));
}

function extract() {
    const src = join(SOURCE, 'src');
    if (!existsSync(src)) {
        console.error(`no Seedling source at ${src} — pass --source <checkout>`);
        process.exit(2);
    }
    const byClass = new Map();
    for (const full of walk(src)) {
        const rel = relative(src, full).split('\\').join('/');
        const cls = rel.replace(/\.as$/, '').split('/').pop();
        const sites = sitesIn(readFileSync(full, 'utf8'), rel);
        if (sites.length > 0) byClass.set(cls, sites);
    }
    return byClass;
}

/** The generated module, deterministic to the byte. */
function render(byClass) {
    const rows = [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const body = rows.map(([cls, sites]) => {
        const lines = sites.map((s) => `        { kind: '${s.kind}', file: '${s.file}', `
            + `line: ${s.line} },`).join('\n');
        return `    ${cls}: [\n${lines}\n    ],`;
    }).join('\n');
    return `/**
 * seedlingDemo/seedlingDamageSites — GENERATED. Do not edit by hand.
 *
 * Every class in the Seedling checkout that calls \`hit()\`, \`drown()\` or
 * \`die()\` on a \`Player\`, or writes a Player's position — read off the CALL
 * SITES by \`scripts/procgen/extract-seedling-damage-sites.mjs\`, which knows
 * nothing about which classes anybody thinks are enemies.
 *
 * ⚠⚠ THIS IS THE INDEPENDENT STRATUM FOR THE COMBAT CENSUS. \`combat.js\`'s
 * two tables were written by reading the classes a human already believed
 * were dangerous; a table-vs-table assertion would agree with the omission
 * that produced it (R4 §14: thirty-two mutations agreed with the bug).
 * \`combat.assertDamageFamilyCovered\` requires this list and those tables to
 * agree, and every disagreement is a missing row or a declared exclusion.
 *
 * Regenerate + verify:
 *   node scripts/procgen/extract-seedling-damage-sites.mjs --source ~/CC/seedling
 *   node scripts/procgen/extract-seedling-damage-sites.mjs --source ~/CC/seedling --check
 *
 * \`net/flashpunk\` (the runtime's own move sweep) and \`Player.as\` (the
 * player's own body — lava, drowning, the fall) are declared exclusions, not
 * quiet ones; see the extractor's header.
 */

/** What each \`kind\` means. */
export const DAMAGE_SITE_KINDS = Object.freeze({
${Object.entries(KINDS).map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`).join('\n')}
});

/** class name → the sites it holds, in file order. */
export const DAMAGE_SITES = Object.freeze({
${body}
});

/** Every class with at least one \`hit\`/\`drown\`/\`die\` site — the LETHAL set. */
export const HARMFUL_CLASSES = Object.freeze(
    Object.entries(DAMAGE_SITES)
        .filter(([, sites]) => sites.some((s) => s.kind !== 'move'))
        .map(([cls]) => cls),
);

/** Every class that only DISPLACES the player. */
export const DISPLACING_CLASSES = Object.freeze(
    Object.entries(DAMAGE_SITES)
        .filter(([, sites]) => sites.every((s) => s.kind === 'move'))
        .map(([cls]) => cls),
);
`;
}

const rendered = render(extract());
if (CHECK) {
    if (!existsSync(OUT)) {
        console.error(`--check: ${OUT} does not exist yet`);
        process.exit(1);
    }
    const have = readFileSync(OUT, 'utf8');
    if (have === rendered) {
        console.log(`✓ ${relative(REPO_ROOT, OUT)} is byte-identical to a re-extraction `
            + `from ${SOURCE}`);
    } else {
        console.error(`⛔ ${relative(REPO_ROOT, OUT)} DIFFERS from a re-extraction — `
            + 'the checkout moved, or the module was hand-edited');
        process.exit(1);
    }
} else {
    writeFileSync(OUT, rendered);
    console.log(`wrote ${relative(REPO_ROOT, OUT)}`);
}
