/**
 * seedlingWasmReadme — **THE seedling-wasm README'S BUILD TABLE, GENERATED
 * FROM THE MANIFEST IT DESCRIBES** (SEEDLING ORIGINAL WASM slice W2, ⚖ user
 * 2026-09-07: the build table *"GENERATED from `builds.json` with a check
 * gate"*).
 *
 * ⛓ THE LIBRARY, NOT THE COMMAND. The CLI is
 * `scripts/procgen/seedling-wasm-readme.mjs` (`--write` / `--check`) and the
 * PINS GATE imports the very same `checkReadme` this file exports, so CI's
 * existing step 1 covers the table with no second implementation and no second
 * CI job. ⛔ It is a `.js` and not a second `.mjs` on purpose: `argvHelp` runs
 * at MODULE SCOPE, and ESM imports are hoisted, so a gate importing an
 * instrument would answer `--help` with the WRONG file's help text.
 *
 * ── ⛔ WHY A TABLE IN ANOTHER REPOSITORY IS WORTH A GENERATOR ─────────
 *
 * The README this writes lives in `PeerInfinity/seedling-wasm`, which is a
 * submodule here and a stand-alone repository on GitHub Pages. Its hand-kept
 * table was measurably WRONG for eight days: it said `seedling_bot_ap_p4c` was
 * "THE bot build — every `SEEDLING_PAGE` default, `WASM_PAGE`, the three
 * presets", which EDITOR INTEGRATION slice P2 moved to p4d on 2026-08-30, and
 * it said p4d was "not wired into any page yet" while p4d was what every page
 * loaded. Nothing could red on either sentence, because prose in a submodule
 * is not something a gate reads. ⇒ the facts a gate CAN check move into
 * `builds.json`, and the table becomes their rendering.
 *
 * ── ⛓ WHAT IS DERIVED AND WHAT IS DECLARED ───────────────────────────
 *
 *   DERIVED   every cell of the table — from the manifest entry's `name`,
 *             `summary`, `role` and `source`.
 *   DECLARED  the ROLE VOCABULARY below, which is the one list a manifest
 *             entry's `role` must be in. ⛔ And it is not merely a spelling
 *             check: `roleProblems` asks the TREE whether each label is TRUE
 *             — `default` must be the build `WASM_PAGE` names, `apitem-control`
 *             must be the build row (f)'s control file drives, `demo` must be
 *             the entry that declares `demo: true`, `arm-control` must declare
 *             no `arm`. The manifest and the consuming tree are independent
 *             sources, so this is a check and not a fixed point (trap 769).
 *
 * ⛔ THE ROLE ORDER IS THE TABLE ORDER, and it is declared rather than
 * alphabetical: a visitor wants the playable original first and the build the
 * app actually loads second. The controls are last because nobody opens them
 * on purpose.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findMarkdownRegion, spliceMarkdownRegion } from './reference/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The submodule this table describes, as mounted here. */
export const SUBMODULE_DIR =
    join(HERE, '..', '..', 'frontend', 'modules', 'flashPanel', 'wasm');

/** ⛓ The repository's OWN Pages site — ⚖ the user, 2026-09-07: the canonical
 *  link is this repo's page, not the consuming repo's. */
export const PAGES_BASE = 'https://peerinfinity.github.io/seedling-wasm';
const COMMIT_URL = (repo, sha) => `https://github.com/${repo}/commit/${sha}`;
const RECOMPILER_REPO = 'PeerInfinity/SWFRecomp-CC';

/** The generated region's table name and the writer its markers name. */
export const README_TABLE = 'seedling-wasm-builds';
export const README_BY = 'seedling-wasm-readme.mjs';
const REGION = { what: 'seedling-wasm README.md', by: README_BY };

/**
 * ⛓ THE ROLE VOCABULARY — declared ONCE, in reading order. The value is the
 * legend the generated region prints, so a role cannot be glossed one way in
 * the table and another way in prose.
 */
export const BUILD_ROLES = {
    demo: 'here to be PLAYED, by a person, at a URL — no instrument drives it',
    default: 'what the app and the instruments load — `WASM_PAGE` and the '
        + '`SEEDLING_PAGE` defaults name it',
    'apitem-control': 'the negative half of the `apitem` pair — pinned so a build '
        + 'WITHOUT Archipelago’s placement pickup exists to compare against',
    'arm-control': 'the negative half of the `arm` pair — pinned so the dead-frame '
        + 'corrections have a build that does NOT arm after the swap',
};
const ROLE_ORDER = Object.keys(BUILD_ROLES);

const SHORT = (sha) => sha.slice(0, 7);
const IS_SHA = (s) => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);

/** ⛔ A `|` in a cell would end the cell. Nothing in the manifest carries one
 *  today; a table that silently reshaped itself if one did would be worse. */
const cell = (s) => String(s).replace(/\|/g, '\\|');

/** The play URL a demo link and the table both use — spelled ONCE, because the
 *  pins gate's demo clause matches `<name>/game.html` in this same README. */
export const playUrl = (name) => `${PAGES_BASE}/${name}/game.html`;

/** The manifest entries in the order the table renders them. */
export function orderedBuilds(manifest) {
    return manifest.builds.slice().sort((a, b) => {
        const ra = ROLE_ORDER.indexOf(a.role);
        const rb = ROLE_ORDER.indexOf(b.role);
        return (ra === rb ? 0 : (ra < 0 ? 1 : (rb < 0 ? -1 : ra - rb)))
            || a.name.localeCompare(b.name);
    });
}

/** The generated region's body: the table, then the role legend. */
export function buildsTableMarkdown(manifest) {
    const rows = orderedBuilds(manifest).map((b) => {
        const src = b.source ?? {};
        const as3 = IS_SHA(src.commit) && src.repo && src.branch
            ? `[\`${cell(src.branch)}@${SHORT(src.commit)}\`](${COMMIT_URL(src.repo, src.commit)})`
            : '(no `source`)';
        const rec = IS_SHA(src.recompiler)
            ? `[\`${SHORT(src.recompiler)}\`](${COMMIT_URL(RECOMPILER_REPO, src.recompiler)})`
            : '(no `source.recompiler`)';
        return `| \`${cell(b.name)}\` | ${cell(b.summary ?? '(no `summary`)')} `
            + `| [▶ play](${playUrl(b.name)}) | \`${cell(b.role ?? '(no `role`)')}\` `
            + `| ${as3} | ${rec} |`;
    });
    const legend = ROLE_ORDER.map((r) => `- \`${r}\` — ${BUILD_ROLES[r]}`);
    return [
        '| build | what it is | play | role | AS3 source | SWFRecomp-CC |',
        '|---|---|---|---|---|---|',
        ...rows,
        '',
        ...legend,
    ].join('\n');
}

/** Read the submodule's two inputs. */
export function readSubmodule(sub = SUBMODULE_DIR) {
    return {
        manifest: JSON.parse(readFileSync(join(sub, 'builds.json'), 'utf8')),
        readmePath: join(sub, 'README.md'),
        readmeText: readFileSync(join(sub, 'README.md'), 'utf8'),
    };
}

/**
 * ⛓⛓ THE ONE CHECK, imported by BOTH the CLI's `--check` and the pins gate's
 * row. It returns findings rather than printing or exiting, so the gate can
 * fold them into its own problem list and the CLI can print a diff.
 *
 * A missing / duplicated / inverted marker pair arrives here as the splicer's
 * own NAMED refusal rather than as a stack trace.
 */
export function checkReadme(sub = SUBMODULE_DIR) {
    const { manifest, readmeText } = readSubmodule(sub);
    return checkReadmeText(manifest, readmeText);
}

/**
 * ⛓ THE PURE CORE OF THE CHECK — the manifest and the README's TEXT, no
 * filesystem. `checkReadme` is this function plus two reads, and the pins
 * gate's `--self-test` drives THIS one, so the mutant it runs goes through the
 * same code the row runs rather than a paraphrase of it (the `scannable()`
 * lesson one file over: a detector spelled twice tests itself).
 */
export function checkReadmeText(manifest, readmeText) {
    const want = buildsTableMarkdown(manifest);
    let have;
    try {
        have = findMarkdownRegion(readmeText, README_TABLE, REGION).body;
    } catch (e) {
        return { ok: false, problems: [e.message], want, have: null, diff: [] };
    }
    if (have === want) return { ok: true, problems: [], want, have, diff: [] };
    const a = have.split('\n');
    const b = want.split('\n');
    const diff = [];
    for (let i = 0; i < Math.max(a.length, b.length) && diff.length < 20; i += 1) {
        if (a[i] === b[i]) continue;
        diff.push(`  line ${i + 1}\n    in the README: ${a[i] ?? '(none)'}`
            + `\n    from builds.json: ${b[i] ?? '(none)'}`);
    }
    return {
        ok: false,
        problems: [`the seedling-wasm README's \`${README_TABLE}\` region is STALE — `
            + `${a.length} line(s) there, ${b.length} from builds.json. Run `
            + `\`node scripts/procgen/${README_BY} --write\``],
        want,
        have,
        diff,
    };
}

/** The README with the region rewritten. Returns the text; the CLI writes it. */
export function renderReadme(sub = SUBMODULE_DIR) {
    const { manifest, readmeText, readmePath } = readSubmodule(sub);
    const text = spliceMarkdownRegion(
        readmeText, README_TABLE, buildsTableMarkdown(manifest), REGION,
    );
    return { text, changed: text !== readmeText, readmePath };
}

/**
 * ⛓ THE THREE FIELDS THE TABLE NEEDS, CHECKED FOR SHAPE. ⛔ A short SHA is a
 * problem and not a convenience: `builtFrom` abbreviated p4c's AS3 commit to
 * seven characters, and resolving it needed a clone of another repository that
 * a reader of this table does not have.
 */
export function manifestFieldProblems(manifest) {
    const out = [];
    for (const b of manifest.builds) {
        if (typeof b.summary !== 'string' || !b.summary.trim()) {
            out.push(`${b.name}: no \`summary\` phrase — it is the table's "what it is" cell`);
        }
        if (!Object.hasOwn(BUILD_ROLES, b.role)) {
            out.push(`${b.name}: \`role\` ${JSON.stringify(b.role ?? null)} is not in the `
                + `declared vocabulary [${ROLE_ORDER.join(', ')}]`);
        }
        const s = b.source;
        if (!s || typeof s !== 'object') {
            out.push(`${b.name}: no \`source\` object — {repo, branch, commit, recompiler}`);
            continue;
        }
        if (typeof s.repo !== 'string' || !s.repo.includes('/')) {
            out.push(`${b.name}: \`source.repo\` is not an owner/name`);
        }
        if (typeof s.branch !== 'string' || !s.branch) {
            out.push(`${b.name}: \`source.branch\` is missing`);
        }
        for (const f of ['commit', 'recompiler']) {
            if (!IS_SHA(s[f])) {
                out.push(`${b.name}: \`source.${f}\` is ${JSON.stringify(s[f] ?? null)}, not a `
                    + 'full 40-character SHA — the table LINKS it, and an abbreviation is a '
                    + 'link only the person who wrote it can resolve');
            }
        }
    }
    return out;
}

/**
 * ⛓⛓ IS EACH `role` LABEL TRUE OF THE TREE? The manifest says what a build IS
 * FOR; this asks the consuming repository whether that is so. ⛔ Both readings
 * are already computed by the pins gate's own rows — `defaultBuild` is what
 * `WASM_PAGE` names (h3), `apItemControl` is what row (f)'s control file
 * drives — so no third scan is invented here, and the two sources stay
 * independent of each other.
 */
export function roleProblems(manifest, { defaultBuild, apItemControl, armCapability }) {
    const out = [];
    const withRole = (r) => manifest.builds.filter((b) => b.role === r).map((b) => b.name);
    const one = (role, actual, how) => {
        const got = withRole(role);
        if (actual === null || actual === undefined) return;   // the gate's own row says so
        if (got.length === 1 && got[0] === actual) return;
        out.push(`\`role: ${role}\` is ${got.length ? got.join(', ') : '(nobody)'} in the `
            + `manifest, but ${how} is ${actual} — the label has to be TRUE of the tree, or `
            + 'the table publishes a claim nothing checks');
    };
    one('default', defaultBuild, '`WASM_PAGE`');
    one('apitem-control', apItemControl, "row (f)'s control file");
    for (const b of manifest.builds) {
        if ((b.role === 'demo') !== (b.demo === true)) {
            out.push(`${b.name}: \`role: ${b.role}\` and \`demo: ${b.demo === true}\` disagree — `
                + 'the demo role and the demo flag are the same fact');
        }
        if (b.role === 'arm-control' && (b.capabilities ?? []).includes(armCapability)) {
            out.push(`${b.name}: \`role: arm-control\` but it DECLARES ${armCapability} — the `
                + 'control arm is the build that lacks it');
        }
    }
    return out;
}
