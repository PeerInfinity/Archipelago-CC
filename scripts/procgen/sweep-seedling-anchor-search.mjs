#!/usr/bin/env node
/**
 * sweep-seedling-anchor-search — ⛓ **DOES THE ANCHOR SEARCH RECOVER WHAT THE
 * ONE-ANCHOR BOUND WAS LOSING?** (Seedling GENERATE-mode UI arc, slice 3,
 * track B.)
 *
 * ── THE FINDING THIS SWEEP ANSWERS ────────────────────────────────────
 *
 * Slice 2's wave-1 domain sweep produced it between its two bounds
 * (`procgenPalette`'s `wall-gap-block` docblock; kickoff §9.3):
 *
 *   `--anchors=first` (ONE anchor per seed)   `ori=v` discharges 1–2 of 12
 *   `--anchors=all`   (every legal anchor)    `ori=v` discharges 18–21
 *
 * ⇒ *the vertical door is not worse — the FIRST anchor the shuffle hands it
 * is.* Those two numbers are not comparable (different denominators: SEEDS
 * against ANCHOR-PLACEMENTS), which is exactly why this script exists: it
 * holds the denominator fixed at SEEDS and moves only
 * `anchorTriesPerCandidate`, so the curve from N=1 upward is one measurement
 * of one quantity.
 *
 * ── WHAT IT COUNTS, PER (VALUE, N) ────────────────────────────────────
 *
 * For each seed 1..S, in the DEDICATED geometry (an otherwise empty bordered
 * room with that seed's own goal), the instance is placed ALONE at each of the
 * first `N` legal anchors `model.anchorsFor` offers — ⛔ the SAME list and the
 * SAME order the loop walks, from a stream seeded with that seed — and the
 * walk stops at the first anchor that SOLVES, exactly as the loop does:
 *
 *   `kept`       — some anchor within N solved ⇒ the loop would KEEP this
 *                  template at this seed.
 *   `discharged` — …and that solve carries a `{strategy}` RECORD naming the
 *                  family's own verb. ⚖ §12.1: an obstacle nobody walked into
 *                  cannot produce one, so this is the non-vacuous number.
 *   `noAnchor`   — the model offered no legal cell at all.
 *   `threw`      — an engine error the oracle does not classify. ⛔ The number
 *                  the search must not move: a wider walk that produced MORE
 *                  of these would be buying yield with aborts.
 *
 * ⛔ IT IS A MEASUREMENT, NOT A GATE (⚖ ruling 4's standing law). A value whose
 * curve stays flat is a finding about that value.
 *
 * ⚠ THE SEED DENOMINATOR IS THE BOUND AND IT IS NAMED IN THE TABLE. `kept` is
 * out of S, never out of anchors — the two are the thing §9.3 confused, and
 * `feedback_bounded_sweep_must_name_what_it_bounded` is why this header says so.
 *
 * Run:
 *   node scripts/procgen/sweep-seedling-anchor-search.mjs
 *   node scripts/procgen/sweep-seedling-anchor-search.mjs --only=wall-gap-block --seeds=12
 *   node scripts/procgen/sweep-seedling-anchor-search.mjs --tries=1,2,4,8,16
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const { POST_SWORD_PALETTE, PRE_SWORD_PALETTE, enumerateValues } = await M('procgenPalette.js');
const { seedlingModel, seedlingOracle } = await M('procgenSeedling.js');
const { rngFor } = await M('procgenRng.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const SEEDS = Number(arg('seeds', 12));
const ONLY = arg('only', 'wall-gap-block');
const TRIES = arg('tries', '1,2,3,4,6,8,12,64').split(',').map(Number);

/** ⚖ §12.1: which solver strategy DISCHARGES each clearer family. */
const CLEARER_STRATEGY = Object.freeze({ shove: 'shove', weigh: 'weigh', kill: 'kill' });

const say = (line = '') => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

const preNames = new Set(PRE_SWORD_PALETTE.templates.map((t) => t.name));
const subjects = POST_SWORD_PALETTE.templates.map((t) => ({
    template: t,
    palette: preNames.has(t.name) ? PRE_SWORD_PALETTE : POST_SWORD_PALETTE,
})).filter((s) => !ONLY || s.template.name === ONLY);

say('# ⛓ THE ANCHOR SEARCH — does it recover what one anchor was losing?');
say('');
say(`command: \`node scripts/procgen/sweep-seedling-anchor-search.mjs --seeds=${SEEDS} `
    + `--only=${ONLY} --tries=${TRIES.join(',')}\``);
say(`bound: seeds 1..${SEEDS} (**the denominator is SEEDS**), dedicated geometry (the bare `
    + 'skeleton + that seed\'s goal, the instance ALONE), anchors taken from '
    + '`model.anchorsFor(record, instance, rngFor(seed), N)` — the loop\'s own list, in the '
    + 'loop\'s own order — and the walk stops at the first SOLVE, as the loop does.');
say('');
say('⛔ N=1 IS THE CONTROL: it is what the generator did before this slice, so the N=1 row '
    + 'must reproduce slice 2\'s `--anchors=first` figures. A table whose first row disagreed '
    + 'with the old one would be measuring something else.');
say('');

for (const { template, palette } of subjects) {
    const verb = CLEARER_STRATEGY[template.family] ?? null;
    say(`## \`${template.name}\` — family \`${template.family}\`, biome \`${palette.name}\``);
    say('');
    const keys = template.params.map((p) => p.key);
    say(`| ${keys.join(' | ') || '(none)'} | N | kept/${SEEDS} `
        + `| ${verb ? `discharged (${verb})/${SEEDS} | ` : ''}noAnchor | threw |`);
    say(`|${'---|'.repeat(keys.length || 1)}---|---|${verb ? '---|' : ''}---|---|`);
    for (const values of enumerateValues(template)) {
        const instance = template.instantiate(null, values);
        for (const N of TRIES) {
            const counts = { kept: 0, discharged: 0, noAnchor: 0, threw: 0 };
            for (let seed = 1; seed <= SEEDS; seed += 1) {
                note(`[stderr] ${instance.instance} N=${N} seed ${seed}…`);
                const model = seedlingModel({ seed });
                const skeleton = model.skeleton();
                const anchors = model.anchorsFor(skeleton, instance, rngFor(seed), N);
                if (!anchors.length) { counts.noAnchor += 1; continue; }
                const oracle = seedlingOracle({ model, items: palette.items ?? null });
                for (const at of anchors) {
                    let out = null;
                    try {
                        out = oracle.solve(model.place(skeleton, instance, at),
                            { templates: [instance] });
                    } catch (e) {
                        counts.threw += 1;
                        note(`[stderr]   THREW ${e.name}: ${e.message.slice(0, 120)}`);
                        // ⛔ the LOOP would ABORT here; the sweep records it and
                        // stops walking this seed, so `threw` is never inflated
                        // by anchors a real run would never have reached.
                        break;
                    }
                    if (out.verdict !== 'SOLVED') continue;
                    counts.kept += 1;
                    if (verb && (out.records ?? []).some((r) => r.strategy === verb)) {
                        counts.discharged += 1;
                    }
                    break;
                }
            }
            const cells = keys.length ? keys.map((k) => String(values[k])).join(' | ') : '(none)';
            say(`| ${cells} | ${N} | ${counts.kept} `
                + `| ${verb ? `${counts.discharged} | ` : ''}${counts.noAnchor} `
                + `| ${counts.threw} |`);
        }
    }
    say('');
}
