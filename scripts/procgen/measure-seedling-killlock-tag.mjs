#!/usr/bin/env node
/**
 * ⛔⛔⛔ **RETIRED — PROCGEN ELEMENTS arc 3, slice 4c (2026-08-17).** ⚖ The
 * user retired the three door TEMPLATES into the room-aware ELEMENTS, and this
 * instrument's SUBJECT went with them: it measures the BLAST RADIUS of the kill lock's literal `tag:'1'` — a literal that was converted to the per-placement slot in GENERATE-UI slice 3 track C, on a template that retired in slice 4c (arc-3 §13.2). Two removals deep.
 *
 * ⛓ ITS LAST MEASUREMENT LIVES IN arc-3 kickoff §13.2, and `procgenPalette.test.js`'s slot-fixture rows, which kept the mechanism's regression coverage when its subject left.
 *
 * ⛔ IT REFUSES TO RUN rather than printing a table of zeros. A sweep whose
 * subject no longer exists still produces a well-formed table, and a reader
 * who found that table in an as-built would read the zeros as a FINDING. The
 * body below is kept verbatim — it is the record of how the measurement was
 * made, and the day a comparable subject ships it is what a new instrument
 * should be written against.
 */
process.stderr.write(
    'measure-seedling-killlock-tag: RETIRED in PROCGEN ELEMENTS arc 3 slice 4c — its subject '
    + 'retired with the three door TEMPLATES. See this file\'s header for where its '
    + 'last measurement lives. ⛔ It refuses rather than printing a table of zeros.\n',
);
process.exit(2);
/* eslint-disable */
/**
 * measure-seedling-killlock-tag — ⚖ THE KILL-LOCK LITERAL `tag:'1'` BLAST
 * RADIUS, MEASURED (Seedling GENERATE-mode UI arc, slice 3 TRACK C).
 *
 * ── WHY THIS SCRIPT EXISTS ────────────────────────────────────────────
 *
 * `KILL_LOCK_TEMPLATES` writes a LITERAL `tag: '1'` on its lock, where every
 * other tag-bearing row in the palette carries `PLACEMENT_TAG` and lets
 * `procgenSeedling.placementTagId` allocate a private slot. Slice 2's own
 * comment used to call the collision LATENT — *"the post-sword sweep keeps a
 * kill template in ONE seed and never two"* — and slice 2 measured that this
 * is no longer true: under the parameterized roster, post-sword **seed 12 at
 * target 6 keeps TWO kill locks**, both on tag 1.
 *
 * ⚖ The conversion was DEFERRED by the user on 2026-08-13 pending a
 * blast-radius measurement, and ⚖ approved CONDITIONALLY on 2026-08-14: convert
 * if this measurement is clean, ship the report and escalate if it is not.
 * ⛔ THIS SCRIPT CHANGES NOTHING. It is the measurement.
 *
 * ── WHAT IT ASKS, AND WHY EACH QUESTION IS SEPARATE ───────────────────
 *
 *  1. **THE COLLISION EXISTS** — the final record really holds two `lock`
 *     entities carrying the same `tag`. Asserted from the RECORD, not from the
 *     summary, because the summary counts templates and the collision is
 *     between ENTITIES.
 *  2. **DOES LOCK 2 OPEN ON SPINNER 1's DEATH?** The brief's question. The
 *     mechanism that would do it is the shared persistence flag: the scratch
 *     layer writes `{level, tag}` and a second lock reading the same slot
 *     would be opened by somebody else's kill — which would make the second
 *     spinner an obstacle that obstructs nothing. Answered from the run's own
 *     `scratchClears` rows and the solve's `records`, never from the argument.
 *  3. **THE SCRATCH LAYER'S ROWS UNDER THE COLLISION** — `{level, tag, at,
 *     declaredAt, by, lock}`, printed whole. Two rows naming ONE slot is the
 *     shape a reader has to see rather than be told about.
 *  4. **THE v9 `at` DECLARATIONS** — does any path emit them for a generated
 *     level? (`botDriverV1`'s docblock says the FORMAT refuses: `tapeFormat`
 *     bounds `persistence[].level` to 0..115 and a generated level is 900.)
 *     Driven rather than quoted.
 *  5. **THE GOAL TAG** — `SEEDLING_DEFAULTS.goalTag` is `'0'`, and the
 *     two-lock case must never touch it. The whole reason `PLACEMENT_TAG`
 *     exists is that the weigh rows were doing exactly that.
 *  6. **WHAT WOULD MOVE IF THE CONVERSION LANDED** — the rng draw sequence is
 *     the load-bearing one (`placementTagId` allocates from the RECORD, not
 *     from the stream), so the trace's `rngStateBefore`/`drawsBefore` columns
 *     are printed as a FINGERPRINT this script can be re-run against after a
 *     conversion and diffed. ⛓ That is the honest form of "verify: no" — a
 *     before/after comparison of the same printed column, not an argument
 *     about which allocator reads what.
 *
 * Run:
 *   node scripts/procgen/measure-seedling-killlock-tag.mjs
 *   node scripts/procgen/measure-seedling-killlock-tag.mjs --seed=12 --count=6
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const { POST_SWORD_PALETTE } = await M('procgenPalette.js');
const { SEEDLING_DEFAULTS, generateSeedlingLevel, seedlingOracle } = await M('procgenSeedling.js');
const { keptTemplatesOf } = await M('watchGenerate.js');
const { tagOf } = await M('levelWorld.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const SEED = Number(arg('seed', 12));
const COUNT = Number(arg('count', 6));

const say = (line = '') => process.stdout.write(`${line}\n`);

say('# ⚖ TRACK C — THE KILL-LOCK TAG BLAST RADIUS (report-only)');
say('');
say(`command: \`node scripts/procgen/measure-seedling-killlock-tag.mjs --seed=${SEED} `
    + `--count=${COUNT}\``);
say(`subject: post-sword seed ${SEED} at target ${COUNT} — slice 2 §9.5(b)'s measured `
    + 'two-kill-lock level.');
say('');

const out = generateSeedlingLevel({
    seed: SEED, palette: POST_SWORD_PALETTE, bounds: { obstacleTarget: COUNT },
});

// ── 1. the collision, from the RECORD ────────────────────────────────
const byTag = new Map();
for (const e of out.record.entities) {
    const t = tagOf(e.type, e.attrs);
    if (t < 0) continue;
    if (!byTag.has(t)) byTag.set(t, []);
    byTag.get(t).push(`${e.type}@${e.x},${e.y}`);
}
say('## 1. the record\'s tag census');
say('');
say('| tag | entities |');
say('|---|---|');
for (const t of [...byTag.keys()].sort((a, b) => a - b)) {
    say(`| ${t} | ${byTag.get(t).join(' · ')} |`);
}
say('');
const shared = [...byTag.entries()].filter(([, v]) => v.length > 1);
say(shared.length
    ? `⛔ **${shared.length} SHARED TAG(S)**: `
        + shared.map(([t, v]) => `tag ${t} → ${v.length} entities`).join('; ')
    : '✔ every tag in this record is private to one entity.');
say('');
say(`kept: ${out.summary.kept.map((k) => k.instance).join(', ')}`);
say(`goalTag (SEEDLING_DEFAULTS): ${JSON.stringify(SEEDLING_DEFAULTS.goalTag)}`);
say('');

// ── 2–3. the driven solve: scratch rows, kill records ────────────────
const oracle = seedlingOracle({ model: out.model, items: POST_SWORD_PALETTE.items ?? null });
const solved = oracle.solve(out.record, {
    templates: keptTemplatesOf(out.summary, POST_SWORD_PALETTE),
});
say('## 2–3. the final solve, driven');
say('');
say(`verdict: **${solved.verdict}** in ${solved.ticks} tick(s)`);
say('');
say('### the scratch persistence layer\'s rows (`run.scratchClears`)');
say('');
if (!(solved.scratchClears ?? []).length) say('(none)');
for (const c of solved.scratchClears ?? []) {
    say(`- \`${JSON.stringify(c)}\``);
}
say('');
const clearTags = (solved.scratchClears ?? []).map((c) => c.tag);
const dupTags = clearTags.filter((t, i) => clearTags.indexOf(t) !== i);
say(dupTags.length
    ? `⛔ **${dupTags.length} DUPLICATE scratch row(s)** — slot(s) `
        + `[${[...new Set(dupTags)].join(', ')}] written more than once in ONE run.`
    : '✔ every scratch row names a distinct slot.');
say('');
say('### the solve\'s own collect records, by strategy');
say('');
const strategies = {};
for (const r of solved.records ?? []) {
    strategies[r.strategy ?? '(none)'] = (strategies[r.strategy ?? '(none)'] ?? 0) + 1;
}
say(`\`${JSON.stringify(strategies)}\``);
say('');
say('### ⛓ THE BRIEF\'S QUESTION — does lock 2 open on the FIRST spinner\'s death?');
say('');
const spinners = out.record.entities.filter((e) => e.type === 'spinner');
const locks = out.record.entities.filter((e) => e.type === 'lock');
const openers = [...new Set((solved.scratchClears ?? []).map((c) => c.by))];
const removalTicks = [...new Set((solved.scratchClears ?? []).map((c) => c.removedAt))];
say(`the record holds **${spinners.length} spinner(s)** and **${locks.length} lock(s)**.`);
say(`every scratch row names the SAME opener (${openers.length} distinct \`by\`: `
    + `${openers.join(', ')}) at the SAME removal tick (${removalTicks.join(', ')}), and the `
    + 'ledger\'s own `why` is:');
say('');
for (const w of [...new Set((solved.scratchClears ?? []).map((c) => c.why))]) {
    say(`> ${w}`);
}
say('');
say('⇒ **NO.** A `tset == -1` lock opens on `totalEnemies()` reaching ZERO, which is a '
    + 'GLOBAL condition — not on "its own" spinner. The count cannot reach zero while the '
    + 'other spinner is alive, so the first death opens NOTHING — ⛓ MEASURED as an ABSENCE: '
    + 'the other spinner appears in NO scratch row, and the one row-pair that exists is '
    + 'stamped with the LAST removal — and BOTH locks open on that one event. ⇒ the second '
    + 'spinner is NOT an '
    + 'obstacle that obstructs nothing: the walk has to kill it too, and the `why` above is '
    + 'the run saying the count went to zero at that removal.');
say('');
say('⚠ WHAT THE COLLISION DOES PRODUCE is visible one line up: **two scratch rows for ONE '
    + 'slot**, because `p.flags` carries the tag of each opened lock and both locks name '
    + 'tag 1. The write is idempotent so the RUN is unaffected — but `levelRun`\'s own '
    + 'docblock for `assertScratchSlotIsFree` says *"two writers of one persistence slot is '
    + 'the exact thing it must not become"*, and that guard is scoped to '
    + 'DECLARED-vs-scratch, so it cannot see scratch-vs-scratch. The v9 parser WOULD have '
    + 'refused the pair (section 4).');
say('');

// ── 4. the v9 `at` question, driven ──────────────────────────────────
say('## 4. does any path emit a v9 `at` declaration for this level?');
say('');
say(`the level id is ${out.record.level}; \`tapeFormat.parsePersistence\` bounds `
    + '`persistence[].level` to the real game\'s 0..115. `botDriverV1.buildStagedTape`\'s '
    + 'own docblock records the residue: the fold emits NO persistence row for a scratch '
    + 'run\'s kill-lock clears, because the emitted tape would stop parsing.');
{
    const { parseTape } = await M('tapeFormat.js');
    /**
     * ⛓ A MINIMAL v9 TAPE, so the refusal is the PARSER's and not a
     * paraphrase of it. `parsePersistence` is module-private; `parseTape` is
     * the one door and it is the door `buildStagedTape`'s output goes through.
     */
    const v9 = (persistence) => ({
        tape_version: 9,
        game: 'seedling',
        boot: { level: 0, x: 80, y: 128 },
        noclip: true,
        noDamage: true,
        noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
        grants: [],
        equips: [],
        pins: [],
        inputs: [{ key: 'right', from: 0, to: 5 }],
        persistence,
    });
    const drive = (label, persistence) => {
        let refusal = null;
        try { parseTape(v9(persistence)); } catch (e) { refusal = e.message; }
        say(`- ${label}: ${refusal
            ? `REFUSED — ${JSON.stringify(refusal.slice(0, 220))}`
            : '⛔ **ACCEPTED**'}`);
        return refusal;
    };
    say('');
    const outOfRange = drive(`one row for the generated level ({level:${out.record.level}, tag:1})`,
        [{ level: out.record.level, tag: 1 }]);
    const dup = drive('two rows for ONE slot ({level:3, tag:1} twice) — the shape the '
        + 'collision would produce if the level id were in range',
        [{ level: 3, tag: 1 }, { level: 3, tag: 1 }]);
    say('');
    say(outOfRange && dup
        ? '✔ BOTH refused. The residue\'s stated cause holds (the level id is out of the '
            + 'format\'s range) AND the collision would ALSO have been refused as a '
            + 'duplicate slot — two independent reasons no v9 `at` row reaches a tape for '
            + 'this level, so the collision cannot travel through the tape channel at all.'
        : '⛔ at least one arm ACCEPTED — the v9 question is OPEN again and this report is '
            + 'the escalation.');
}
say('');

// ── 5. the goal tag ──────────────────────────────────────────────────
const goalTagNum = Number.parseInt(SEEDLING_DEFAULTS.goalTag, 10);
say('## 5. the goal tag');
say('');
const goalHolders = byTag.get(goalTagNum) ?? [];
say(`tag ${goalTagNum} is held by: ${goalHolders.join(' · ') || '(nobody)'}`);
say(goalHolders.length === 1 && goalHolders[0].startsWith('torchpickup')
    ? '✔ the GOAL alone holds its own flag — no lock, no button, no spinner.'
    : '⛔ the goal\'s flag is SHARED (or absent) — this is the defect `PLACEMENT_TAG` exists '
        + 'to end, arriving on a different row.');
say((solved.scratchClears ?? []).some((c) => c.tag === goalTagNum)
    ? '⛔ a scratch clear WROTE the goal\'s slot.'
    : '✔ no scratch clear touched the goal\'s slot.');
say('');

// ── 6. the fingerprint a conversion would (or would not) move ────────
say('## 6. the draw-sequence fingerprint (re-run after a conversion and diff)');
say('');
say(`drawsSpent: **${out.summary.drawsSpent}** · final rngState: **${out.summary.rngState}**`);
say('');
say('| step.try | template | drawsBefore | rngStateBefore | outcome | at |');
say('|---|---|---|---|---|---|');
for (const r of out.trace) {
    say(`| ${r.step}.${r.try} | ${r.instance ?? '(skeleton)'} | ${r.drawsBefore} `
        + `| ${r.rngStateBefore} | ${r.outcome} | ${r.at ? `${r.at.tx},${r.at.ty}` : '—'} |`);
}
say('');
say('⛓ `placementTagId` allocates from the RECORD (the lowest free slot below '
    + '`TAGS_PER_LEVEL`), and `placementGroupId` from the ANCHOR — neither touches the '
    + 'stream. So a conversion should leave every cell of this table unchanged and move '
    + 'ONLY the `tag` attribute in the emitted entities. That is the claim; the diff of '
    + 'two runs of this script is the measurement.');
say('');
say('### the lock entities, verbatim');
say('');
for (const e of out.record.entities) {
    if (e.type !== 'lock' && e.type !== 'spinner') continue;
    say(`- \`${e.type}@${e.x},${e.y}\` attrs \`${JSON.stringify(e.attrs ?? {})}\``);
}
say('');
