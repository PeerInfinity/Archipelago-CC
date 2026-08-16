#!/usr/bin/env node
/**
 * sweep-seedling-wave1-domains — ⚖ RULING 4's LIGHT SWEEP, one table per
 * parameterized family.
 *
 * Seedling GENERATE-mode UI arc, slice 2 (kickoff §3.1's last bullet). A
 * declared domain is a claim that every value in it is one the generator can
 * use; ⚖ the user ruled the certification form: *"Let's try the light sweep
 * first"* — the `SPINNER_OFFSET` table's shape, which is
 * **discharged / refused counts per value, with the command line recorded**.
 *
 * ── WHAT IT MEASURES, AND WHAT IT DELIBERATELY DOES NOT ───────────────
 *
 * For each declared value combination of each base template, in the DEDICATED
 * geometry (an otherwise empty bordered room with that seed's own goal):
 *
 *   · `noAnchor` — the model found no legal cell for this shape at all.
 *   · `solved`   — placed alone, the room still certifies its collect.
 *   · `refused`  — the oracle classified a refusal. A candidate the
 *                  keep-or-revert loop would REVERT, which is a working loop
 *                  and not a broken value.
 *   · `threw`    — an engine error the oracle does not classify. ⛔ THIS is
 *                  the one that would make a value unusable: `levelGenerator`
 *                  turns it into `GenerationAborted` and it kills a RUN rather
 *                  than a candidate (traps 171/173 — the catch is not widened).
 *   · `discharged` (clearer families only) — a `{strategy}` RECORD in the
 *                  solve naming this family's own verb. ⚖ §12.1's standard:
 *                  an obstacle nobody walked into cannot produce one, so this
 *                  is the only non-vacuous evidence that a value is USEFUL
 *                  rather than merely legal.
 *
 * ⛔ IT IS A MEASUREMENT, NOT A GATE. ⚖ Ruling 4: *"the sweep is about domain
 * yield, not level validity"* — the oracle still certifies every generated
 * level individually. **A low-yield value is a FINDING, not a defect**; it is
 * recorded next to the domain declaration rather than pruned silently.
 *
 * ── ⚠⚠ THE ANCHOR BOUND, AND IT HAS TO BE TWO BOUNDS ──────────────────
 *
 * `SPINNER_OFFSET`'s own table swept EVERY LEGAL ANCHOR over four seeds. That
 * is affordable for a door (a full-span wall has a handful of legal anchors)
 * and it is not for a 2-cell pit (fifty-odd per seed, times a nine-value
 * domain). So this script offers both and the tables say which they are:
 *
 *   `--anchors=first` (default) — ONE anchor per (value, seed): the cell
 *      `anchorsFor(…, 1)` itself draws from a stream seeded with that seed, which is
 *      the anchor the LOOP would really use. Cheap, and it is what the
 *      non-clearer families are swept at.
 *   `--anchors=all` — every legal anchor in the room, which is
 *      `SPINNER_OFFSET`'s own bound. Used for the three CLEARER families,
 *      where the interesting number is `discharged` and one anchor per seed is
 *      too thin a sample to say anything about a verb.
 *
 * ⛔ THE TWO ARE NOT COMPARABLE and the tables are labelled, because a
 * `discharged` count means something different per-anchor than per-seed
 * (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * Run:
 *   node scripts/procgen/sweep-seedling-wave1-domains.mjs
 *   node scripts/procgen/sweep-seedling-wave1-domains.mjs --anchors=all --only=wall-gap-block
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, dischargesVerb, enumerateValues, verbOf,
} = await M('procgenPalette.js');
const { seedlingModel, seedlingOracle } = await M('procgenSeedling.js');
const { rngFor } = await M('procgenRng.js');
const { parseSkeleton } = await import(join(REPO, 'frontend/modules/procgenCore/skeletonKinds.js'));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const SEEDS = Number(arg('seeds', 12));
const ONLY = arg('only', '');
const ANCHORS = arg('anchors', 'first');
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 2 — **THE SKELETON KIND IS AN AXIS NOW.**
 *
 * This sweep certified a domain in the DEDICATED geometry, which was the open
 * bordered room and nothing else, and that was the whole world when it was
 * written. It is not any more: slice 2 gives the door families a `span` whose
 * whole point is the values a CORRIDOR can use, and a domain swept only on
 * `empty` would certify span 8 and refuse to see span 1 — the `empty` room's own
 * geometry deciding a knob that exists for the other kinds.
 *
 * ⛔ THE KINDS ARE A LIST AND THE TABLE IS PER (VALUE, KIND), never summed
 * across them: `feedback_bounded_sweep_must_name_what_it_bounded`. A value that
 * discharges on `winding` and NO_ANCHORs on `empty` is two facts, and one column
 * would print their sum as if it were one.
 */
const KINDS = arg('kinds', 'empty').split(',').map((k) => k.trim()).filter(Boolean);
if (ANCHORS !== 'first' && ANCHORS !== 'all') {
    process.stderr.write('sweep-seedling-wave1-domains: --anchors= must be `first` or `all`.\n');
    process.exit(2);
}

// ⛓ SLICE 5: ⚖ §12.1's discharge test is `procgenPalette`'s now — this file
// carried one of THREE identical copies, and verb 2 needed the same test in a
// browser module, where a script cannot be imported.

const say = (line = '') => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

/**
 * ⛔ EACH TEMPLATE IS SWEPT UNDER THE BIOME THAT OFFERS IT. The kill family is
 * sword-gated — swept under a pre-sword boot the press is a SILENT NO-OP and
 * the table would be measuring the boot, not the domain.
 */
const preNames = new Set(PRE_SWORD_PALETTE.templates.map((t) => t.name));
const subjects = POST_SWORD_PALETTE.templates.map((t) => ({
    template: t,
    palette: preNames.has(t.name) ? PRE_SWORD_PALETTE : POST_SWORD_PALETTE,
})).filter((s) => !ONLY || s.template.name === ONLY);

say('# ⚖ RULING 4 — THE WAVE-1 DOMAIN SWEEPS (Seedling GENERATE-mode UI arc, slice 2)');
say('');
say(`command: \`node scripts/procgen/sweep-seedling-wave1-domains.mjs --seeds=${SEEDS} `
    + `--anchors=${ANCHORS} --kinds=${KINDS.join(',')}`
    + `${ONLY ? ` --only=${ONLY}` : ''}\``);
say(`kinds: ${KINDS.join(', ')}`);
say(`bound: seeds 1..${SEEDS}, ${ANCHORS === 'all'
    ? 'EVERY LEGAL ANCHOR in the room (`SPINNER_OFFSET`\'s own bound)'
    : 'ONE anchor per (value, seed) — the cell `anchorsFor(…, 1)` itself draws from a stream '
        + 'seeded with that seed, which is the anchor the loop would use'}. `
    + 'The dedicated geometry is the bare skeleton (bordered room + that seed\'s goal) with '
    + 'the instance placed ALONE.');
say('');

for (const { template, palette } of subjects) {
    const combos = enumerateValues(template);
    const verb = verbOf(template.family);
    say(`## \`${template.name}\` — family \`${template.family}\`, biome \`${palette.name}\``
        + `, ${combos.length} declared value combination(s)`);
    say('');
    if (!template.params.length) {
        say('(no declared parameters — the degenerate case; one instantiation, swept as a '
            + 'control so the table is built FROM the roster rather than from a list of '
            + 'the families somebody remembered.)');
        say('');
    }
    const head = `| kind | ${template.params.map((p) => p.key).join(' | ') || '(none)'} `
        + `| noAnchor | solved | refused | threw${verb ? ` | discharged (${verb})` : ''} |`;
    say(head);
    say(`|---|${'---|'.repeat(template.params.length || 1)}---|---|---|---|${verb ? '---|' : ''}`);
    for (const values of combos) {
    for (const kindSpec of KINDS) {
        const skeletonSpec = parseSkeleton(kindSpec,
            { simulator: false, substrate: 'this sweep' });
        const instance = template.instantiate(null, values);
        const counts = { noAnchor: 0, solved: 0, refused: 0, threw: 0, discharged: 0 };
        for (let seed = 1; seed <= SEEDS; seed += 1) {
            note(`[stderr] ${kindSpec} ${instance.instance} seed ${seed}…`);
            const model = seedlingModel({ seed, skeleton: skeletonSpec });
            const skeleton = model.skeleton();
            const anchors = ANCHORS === 'all'
                // ⛔ THE MODEL'S OWN `legalAt`, never a second copy of the rule.
                ? model.interiorCells(skeleton)
                    .filter((c) => model.legalAt(skeleton, instance, c.tx, c.ty))
                // ⛓ SLICE 3: `anchorsFor(…, 1)` IS the old `anchorFor` — one
                // shuffle, the first legal cell — so this table's `first` bound
                // is unchanged in meaning and in value.
                : model.anchorsFor(skeleton, instance, rngFor(seed), 1);
            if (!anchors.length) { counts.noAnchor += 1; continue; }
            const oracle = seedlingOracle({ model, items: palette.items ?? null });
            for (const at of anchors) {
                try {
                    const out = oracle.solve(model.place(skeleton, instance, at),
                        { templates: [instance] });
                    if (out.verdict === 'SOLVED') {
                        counts.solved += 1;
                        // ⛓ ONE discharge test — `null`, not `false`, for a
                        // family that has no verb to discharge.
                        if (dischargesVerb(template.family, out.records)) {
                            counts.discharged += 1;
                        }
                    } else counts.refused += 1;
                } catch (e) {
                    counts.threw += 1;
                    note(`[stderr]   THREW ${e.name}: ${e.message.slice(0, 120)}`);
                }
            }
        }
        const cells = template.params.length
            ? template.params.map((p) => String(values[p.key])).join(' | ')
            : '(none)';
        say(`| ${kindSpec} | ${cells} | ${counts.noAnchor} | ${counts.solved} | ${counts.refused} `
            + `| ${counts.threw}${verb ? ` | ${counts.discharged}` : ''} |`);
    }
    }
    say('');
}
