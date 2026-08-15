#!/usr/bin/env node
/**
 * sweep-seedling-directed-bound — ⛓ **HOW FAR DOWN THE ANCHOR LIST IS THE
 * FIRST ANCHOR THAT DISCHARGES?** (Seedling GENERATE-mode UI arc, slice 5,
 * verb 2 — the directed attempt.)
 *
 * ── THE QUESTION THIS EXISTS TO ANSWER, AND WHY IT IS A NEW ONE ───────
 *
 * ⚖ The user's ruling (kickoff, stamped after §10): *verb 2 PREFERS
 * DISCHARGE; the free loop keeps FIRST-SOLVED.* A preference needs a BOUND —
 * how many legal anchors may one directed attempt be solved at before it
 * settles for the first that merely solved — and §10.4.2 cannot supply it:
 * that sweep measured a FIRST-SOLVED walk, whose whole finding was that it
 * **stops before it ever reaches a discharging anchor** (the first legal
 * anchor solves at 23 of 24 rows). Its N-curve is therefore flat by
 * construction and says nothing about how deep a CHOOSIER walk must go.
 *
 * ⛔ So the quantity here is different and it is stated plainly: for each
 * (template, seed), walk EVERY legal anchor and record
 *   · `firstSolved`     — the 1-based index of the first anchor that SOLVES
 *   · `firstDischarged` — the 1-based index of the first anchor whose solve
 *                         carries a `{strategy}` RECORD naming this family's
 *                         own verb (⚖ §12.1's evidence standard), or `—`
 *   · `legal`           — how many legal anchors the model offered at all
 *
 * From those three, a bound N is scored directly: a directed attempt at bound
 * N DISCHARGES iff `firstDischarged <= N`, and keeps SOLVED-ONLY iff not but
 * `firstSolved <= N`.
 *
 * ── ⛔ THE SUBJECT IS THE RECORD VERB 2 ACTUALLY ACTS ON ──────────────
 *
 * `--on=ladder` (the default) places the instance on a MID-LADDER record —
 * the room the page is showing when the button is pressed — because that is
 * the question the user asked. `--on=skeleton` is the CONTROL: the same
 * measurement in the empty bordered room, which is the geometry §9.3/§10.4.2
 * used, so their figures and these are comparable at all.
 *
 * ⚠ A fuller room has FEWER legal anchors, so the two arms differ in their
 * denominator as well as their answer — which is why both are printed and why
 * `legal` is a column rather than a footnote
 * (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * ⛔ IT IS A MEASUREMENT, NOT A GATE (⚖ ruling 4's standing law): a template
 * whose discharge index never lands inside a practical bound is a FINDING
 * about that template.
 *
 * Run:
 *   node scripts/procgen/sweep-seedling-directed-bound.mjs
 *   node scripts/procgen/sweep-seedling-directed-bound.mjs --on=skeleton
 *   node scripts/procgen/sweep-seedling-directed-bound.mjs --seeds=24 --step=3
 *   node scripts/procgen/sweep-seedling-directed-bound.mjs --subjects   # per-seed rows
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, verbOf,
} = await M('procgenPalette.js');
const { seedlingModel, seedlingOracle } = await M('procgenSeedling.js');
const { generateStep } = await M('watchGenerate.js');
const { rngFor } = await M('procgenRng.js');

const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
};
const SEEDS = Number(arg('seeds', '12'));
const STEP = Number(arg('step', '3'));
const ON = arg('on', 'ladder');
const ONLY = arg('only', null);
const PER_SEED = process.argv.includes('--subjects');
const TRIES = (arg('tries', '1,2,4,8,12,16,24,32,64')).split(',').map(Number);

if (ON !== 'ladder' && ON !== 'skeleton') {
    process.stderr.write(`--on must be "ladder" or "skeleton", got ${JSON.stringify(ON)}\n`);
    process.exit(2);
}

const say = (l = '') => process.stdout.write(`${l}\n`);
const note = (l) => process.stderr.write(`${l}\n`);

/**
 * ⛔ ONLY THE TEMPLATES THAT HAVE A VERB TO DISCHARGE. A wall, a pool or a
 * pit CANNOT discharge anything — first-SOLVED is their whole criterion — so
 * including them would put a column of `—` in the table and invite a reader
 * to read "never discharges" as a failure rather than as "no verb"
 * (the same distinction `verbOf` returns `null` for).
 */
const subjects = [];
for (const palette of [PRE_SWORD_PALETTE, POST_SWORD_PALETTE]) {
    for (const t of palette.templates) {
        if (!verbOf(t.family)) continue;
        if (ONLY && t.name !== ONLY) continue;
        if (subjects.some((s) => s.template.name === t.name)) continue;
        subjects.push({ template: t, palette });
    }
}

say('# The DIRECTED attempt\'s bound — how deep is the first DISCHARGING anchor?');
say('');
say(`Command: \`node scripts/procgen/sweep-seedling-directed-bound.mjs --on=${ON} `
    + `--seeds=${SEEDS}${ON === 'ladder' ? ` --step=${STEP}` : ''}\``);
say('');
say(ON === 'ladder'
    ? `Subject record: the LADDER at step ${STEP} — the room the page is showing when the `
        + 'ATTEMPT button is pressed. This is the question verb 2 asks.'
    : 'Subject record: the SKELETON — the empty bordered room. ⛔ THE CONTROL: this is '
        + '§9.3 / §10.4.2\'s own geometry, so those figures and these are comparable.');
say('');
say('⛔ Every legal anchor is walked (no bound), so the INDEX columns are facts about the '
    + 'anchor list itself and a bound is scored against them afterwards rather than baked in.');
say('');

const rows = [];
for (const { template, palette } of subjects) {
    const verb = verbOf(template.family);
    // ⛔ The DEFAULT instance of each base — one instantiation, named, so the
    // table is about a bound and not about a domain (⚖ slice 2 swept the
    // domains; this sweeps the anchor list).
    const values = Object.fromEntries(template.params.map((p) => [p.key, p.default]));
    const instance = template.instantiate(null, values);
    for (let seed = 1; seed <= SEEDS; seed += 1) {
        note(`[stderr] ${instance.instance} seed ${seed}…`);
        const model = seedlingModel({ seed });
        let record = model.skeleton();
        let kept = [];
        if (ON === 'ladder') {
            let st;
            try {
                st = generateStep({ seed, biome: palette.name, step: STEP });
            } catch (e) {
                rows.push({ template: template.name, verb, seed, legal: null,
                    firstSolved: null, firstDischarged: null, note: `LADDER ${e.name}` });
                continue;
            }
            record = st.record;
            kept = st.keptTemplates;
        }
        // ⛔ EVERY legal anchor: the limit is the interior's own size, so the
        // walk is bounded by the ROOM and the bound is not a hidden parameter.
        const anchors = model.anchorsFor(record, instance, rngFor(seed),
            record.width * record.height);
        if (!anchors.length) {
            rows.push({ template: template.name, verb, seed, legal: 0,
                firstSolved: null, firstDischarged: null, note: 'NO_ANCHOR' });
            continue;
        }
        const oracle = seedlingOracle({ model, items: palette.items ?? null });
        let firstSolved = null;
        let firstDischarged = null;
        let threw = null;
        for (let i = 0; i < anchors.length; i += 1) {
            let out;
            try {
                out = oracle.solve(model.place(record, instance, anchors[i]),
                    { templates: [...kept, instance] });
            } catch (e) {
                // ⛔ The LOOP would ABORT here; the sweep records it and stops
                // walking this seed, so no index is inflated by an anchor a real
                // run would never have reached.
                threw = e.name;
                break;
            }
            if (out.verdict !== 'SOLVED') continue;
            if (firstSolved === null) firstSolved = i + 1;
            if ((out.records ?? []).some((r) => r.strategy === verb)) {
                firstDischarged = i + 1;
                break;
            }
        }
        rows.push({ template: template.name, verb, seed, legal: anchors.length,
            firstSolved, firstDischarged, note: threw ? `THREW ${threw}` : null });
    }
}

// ── per-seed rows, for choosing a gate subject by measurement ─────────
if (PER_SEED) {
    say('## Per-seed indices (⚠ this is where a gate subject is CHOSEN, trap 235)');
    say('');
    say('| template | verb | seed | legal anchors | first SOLVED | first DISCHARGED | note |');
    say('|---|---|---|---|---|---|---|');
    for (const r of rows) {
        say(`| ${r.template} | ${r.verb} | ${r.seed} | ${r.legal ?? '—'} `
            + `| ${r.firstSolved ?? '—'} | ${r.firstDischarged ?? '—'} | ${r.note ?? ''} |`);
    }
    say('');
}

// ── the bound table ──────────────────────────────────────────────────
say('## What a bound N buys, per template');
say('');
say(`⚠ The denominator is SEEDS (${SEEDS}), never anchors — the two are what §9.3 confused.`);
say('');
say(`| template | verb | N | discharged/${SEEDS} | solved-only/${SEEDS} | no keep/${SEEDS} |`);
say('|---|---|---|---|---|---|');
for (const { template } of subjects) {
    const mine = rows.filter((r) => r.template === template.name);
    if (!mine.length) continue;
    for (const N of TRIES) {
        let discharged = 0; let solvedOnly = 0; let none = 0;
        for (const r of mine) {
            if (r.firstDischarged !== null && r.firstDischarged <= N) discharged += 1;
            else if (r.firstSolved !== null && r.firstSolved <= N) solvedOnly += 1;
            else none += 1;
        }
        say(`| ${template.name} | ${mine[0].verb} | ${N} | ${discharged} | ${solvedOnly} `
            + `| ${none} |`);
    }
}
say('');

// ── the summary a bound is chosen from ───────────────────────────────
const withDischarge = rows.filter((r) => r.firstDischarged !== null);
const idx = withDischarge.map((r) => r.firstDischarged).sort((a, b) => a - b);
const pct = (p) => (idx.length ? idx[Math.min(idx.length - 1,
    Math.ceil((p / 100) * idx.length) - 1)] : null);
say('## The distribution the bound is chosen from');
say('');
say(`rows measured: ${rows.length} · rows with SOME discharging anchor: ${idx.length} `
    + `· rows with none: ${rows.length - idx.length}`);
if (idx.length) {
    say('');
    say(`first-DISCHARGING index — median ${pct(50)}, 75th ${pct(75)}, 90th ${pct(90)}, `
        + `max ${idx[idx.length - 1]}`);
}
const legals = rows.map((r) => r.legal).filter((n) => Number.isInteger(n));
if (legals.length) {
    say(`legal anchors offered — min ${Math.min(...legals)}, max ${Math.max(...legals)} `
        + `(the CEILING a bound can ever be worth)`);
}
say('');
say('⛔ A bound is a COST as well as a yield: one directed attempt spends up to N solves, '
    + 'each synchronous and uninterruptible. The number chosen is stated in the as-built '
    + 'WITH the row of this table it was read off.');
