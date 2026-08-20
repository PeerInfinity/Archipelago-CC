#!/usr/bin/env node
/**
 * census-maze-keeps — **THE MAZE'S `solved-only` KEEP CLASS, COUNTED** —
 * PROCGEN ELEMENTS arc 5, slice 5 (D5; ⚖ arc-5 ruling 4).
 *
 * ── ⚖⚖ THE RULING THIS ANSWERS, VERBATIM ─────────────────────────────
 *
 * *"`PREFER_DISCHARGE` ON THE MAZE MAY RETIRE (⚖ user, 2026-08-19: 'we can get
 * rid of it or leave it — as far as I'm aware it was never needed'): slice 5
 * COUNTS the maze's `solved-only` class first (never measured there), then
 * retires `KEEP_POLICY` if the class is empty — 4c's measure-then-retire shape.
 * A non-empty count is a STOP-and-surface, not a retirement."*
 *
 * ⛔⛔ **THE COUNT COMES FIRST AND THE RETIREMENT IS ITS CONSEQUENCE.** This
 * instrument is the count. It is permanent so the number can be re-derived
 * after the retirement it authorises — ⛓ against a build that no longer offers
 * the policy the instrument would need, which is why it reads `KEEP_POLICY`
 * from the loop core rather than naming a string, and says so when the value it
 * asked for is gone.
 *
 * ── ⛓⛓⛓ THE CORPUS, NAMED BEFORE IT IS SWEPT (the bounded-sweep law) ──
 *
 * `KEPT_KIND.SOLVED_ONLY` is produced in EXACTLY ONE place in the whole repo —
 * `levelGenerator.walkAnchors`, and only under `KEEP_POLICY.PREFER_DISCHARGE`.
 * The maze reaches that policy through EXACTLY ONE caller: `mazeLab
 * .applyDirective`, whose `keepPolicy` defaults to `PREFER_DISCHARGE`. The maze
 * GENERATION loop (`generateMazeLevel` → `generateLevel`) never asks for it —
 * `generateLevel` takes no policy at all and `walkAnchors` then runs
 * `FIRST_SOLVED`, where `kind` is `null` by construction.
 *
 * ⇒ **THE POLICY'S OWN SUBJECTS ARE THE MAZE'S DIRECTED ATTEMPTS**, and this
 * sweeps them: every SKELETON KIND × seeds × every ENUMERATED instantiation of
 * every template the palette holds (⚖ ruling 4's "a domain nobody can enumerate
 * is a domain nobody swept" — the same rule `assertMazePalette` walks), at the
 * page's own `DIRECTED_ANCHOR_TRIES` bound, on the step-0 skeleton and on a
 * ladder state, because a directive onto a room that already holds templates is
 * a different anchor list.
 *
 * ⚠ THE YIELD TABLE IS **NOT** THE CORPUS, and saying so is the point. It runs
 * `generateLevel`, which cannot reach the policy — a count taken there would be
 * zero about a question it never asked (trap 452: *"is it reachable" is about
 * the CORPUS you asked*).
 *
 * Run:
 *   node scripts/procgen/census-maze-keeps.mjs
 *   node scripts/procgen/census-maze-keeps.mjs --kinds=empty,rooms --seeds=1-4
 *   node scripts/procgen/census-maze-keeps.mjs --steps=0,2 --json=/tmp/keeps.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const { KEEP_POLICY, KEPT_KIND } = await M('procgenCore/levelGenerator.js');
const {
    DIRECTED_ANCHOR_TRIES, MAZE_BIOME_NAMES, SKELETON_KIND_NAMES,
    applyDirective, generateStep, paletteFor,
} = await M('mazeRoom/mazeLab.js');
const { enumerateValues } = await M('procgenCore/templateContract.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const KINDS = arg('kinds', SKELETON_KIND_NAMES.join(',')).split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '1-6');
    const m = /^(\d+)-(\d+)$/.exec(spec);
    if (m) {
        const out = [];
        for (let s = Number(m[1]); s <= Number(m[2]); s += 1) out.push(s);
        return out;
    }
    return spec.split(',').map(Number).filter(Number.isInteger);
})();
const STEPS = arg('steps', '0,2').split(',').map(Number).filter((n) => Number.isInteger(n));
const JSON_OUT = arg('json', '');
const say = (line) => process.stdout.write(`${line}\n`);

/**
 * ⛓ THE POLICY THIS INSTRUMENT ASKS FOR, READ OFF THE LOOP CORE. When the
 * retirement this census authorises has happened the value is gone, and the
 * census says THAT rather than sweeping under a different policy and printing a
 * zero that means nothing.
 */
const POLICY = KEEP_POLICY.PREFER_DISCHARGE ?? null;
const BIOME = MAZE_BIOME_NAMES[0];

say('# census-maze-keeps — the maze\'s `solved-only` keep class');
say('');
say(`kinds       ${KINDS.join(', ')}`);
say(`seeds       ${SEEDS.join(', ')}`);
say(`steps       ${STEPS.join(', ')}   (0 = the skeleton; k = a ladder run to obstacleTarget=k)`);
say(`biome       ${BIOME}`);
say(`bound       ${DIRECTED_ANCHOR_TRIES}   (\`DIRECTED_ANCHOR_TRIES\`, the page's own)`);
say(`policy      ${POLICY === null ? '⛔ RETIRED — `KEEP_POLICY.PREFER_DISCHARGE` is gone'
    : JSON.stringify(POLICY)}`);
say('');

if (POLICY === null) {
    say('⛔ **`PREFER_DISCHARGE` NO LONGER EXISTS**, so there is no policy under which a maze');
    say('directed attempt could report `solved-only`, and this census has no subject to');
    say('sweep. That is the state arc-5 slice 5 left the maze in, on the strength of the');
    say('table this instrument printed BEFORE the retirement (kickoff §13). ⛓ The row is');
    say('kept runnable so the claim can be re-asked, and it answers by NAME rather than by');
    say('printing a zero that would mean "measured" when it means "unaskable".');
    process.exit(0);
}

/**
 * ⛓ EVERY ENUMERATED INSTANTIATION THE PALETTE OFFERS — `enumerateValues` over
 * each template's declared domains, which is the SAME walk `assertMazePalette`
 * makes. ⛔ A sweep over the BASE rows would measure two subjects where the
 * palette offers eighteen (⚖ ruling 4).
 */
const SUBJECTS = paletteFor(BIOME).templates.flatMap((t) => enumerateValues(t).map((params) => ({
    template: t.name,
    params,
    label: `${t.name}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')})`,
})));

say(`subjects    ${SUBJECTS.length} enumerated instantiation(s): `
    + `${SUBJECTS.map((s) => s.label).join(', ')}`);
say('');

const kinds = {};
let attempts = 0;
let solvedOnly = 0;
const byKind = {};
const rows = [];

for (const kind of KINDS) {
    const tally = { attempts: 0, KEPT: 0, discharged: 0, solvedOnly: 0, noVerb: 0,
        nullKind: 0, other: 0 };
    for (const seed of SEEDS) {
        for (const step of STEPS) {
            let base;
            try {
                base = generateStep({ seed, biome: BIOME, step, skeleton: kind });
            } catch (e) {
                rows.push({ kind, seed, step, error: `${e.name}: ${e.message.slice(0, 120)}` });
                continue;
            }
            SUBJECTS.forEach((subject, i) => {
                let out;
                try {
                    out = applyDirective(base, {
                        template: subject.template, params: subject.params, keepPolicy: POLICY,
                    }, i);
                } catch (e) {
                    rows.push({ kind, seed, step, subject: subject.label,
                        error: `${e.name}: ${e.message.slice(0, 120)}` });
                    return;
                }
                const d = out.directives[out.directives.length - 1];
                tally.attempts += 1;
                attempts += 1;
                if (d.outcome === 'KEPT') tally.KEPT += 1;
                if (d.keptKind === KEPT_KIND.SOLVED_ONLY) { tally.solvedOnly += 1; solvedOnly += 1;
                    rows.push({ kind, seed, step, subject: subject.label,
                        outcome: d.outcome, keptKind: d.keptKind, at: d.at }); }
                else if (d.keptKind === KEPT_KIND.DISCHARGED) tally.discharged += 1;
                else if (d.keptKind === KEPT_KIND.NO_VERB) tally.noVerb += 1;
                else if (d.keptKind === null || d.keptKind === undefined) tally.nullKind += 1;
                else tally.other += 1;
            });
        }
    }
    byKind[kind] = tally;
    kinds[kind] = tally;
}

say('| kind | attempts | KEPT | `discharged` | **`solved-only`** | `no-verb` | null | other |');
say('|---|---|---|---|---|---|---|---|');
for (const kind of KINDS) {
    const t = byKind[kind];
    say(`| \`${kind}\` | ${t.attempts} | ${t.KEPT} | ${t.discharged} | **${t.solvedOnly}** `
        + `| ${t.noVerb} | ${t.nullKind} | ${t.other} |`);
}
const totals = Object.values(byKind).reduce((a, t) => ({
    attempts: a.attempts + t.attempts, KEPT: a.KEPT + t.KEPT,
    discharged: a.discharged + t.discharged, solvedOnly: a.solvedOnly + t.solvedOnly,
    noVerb: a.noVerb + t.noVerb, nullKind: a.nullKind + t.nullKind, other: a.other + t.other,
}), { attempts: 0, KEPT: 0, discharged: 0, solvedOnly: 0, noVerb: 0, nullKind: 0, other: 0 });
say(`| **all** | **${totals.attempts}** | ${totals.KEPT} | ${totals.discharged} `
    + `| **${totals.solvedOnly}** | ${totals.noVerb} | ${totals.nullKind} | ${totals.other} |`);
say('');
const errors = rows.filter((r) => r.error);
say(`errors      ${errors.length}`);
for (const e of errors.slice(0, 10)) {
    say(`  ⛔ ${e.kind} seed ${e.seed} step ${e.step} ${e.subject ?? ''} — ${e.error}`);
}
say('');
say(`⇒ **\`solved-only\` = ${totals.solvedOnly} of ${totals.attempts} directed attempts.**`);
if (totals.solvedOnly === 0) {
    say('⛓ ZERO, and the palette says WHY rather than the luck of the seeds: `applyDirective`');
    say('hands `discharges: () => null` — the maze v1 palette declares NO VERB on either');
    say('template — and `walkAnchors` reads a `null` discharge as `KEPT_KIND.NO_VERB`, never');
    say('as `solved-only`. The class is STRUCTURALLY unreachable here, exactly as S1 §11.9');
    say('measured it on Seedling. ⇒ ⚖ ruling 4\'s retirement condition is MET.');
} else {
    say('⛔⛔ **NON-ZERO — ⚖ ruling 4 says STOP.** The retirement does not execute; the rows');
    say('above go to the orchestrator and to the user. A policy with a reachable second');
    say('outcome is a policy somebody is using.');
}

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({
        kinds: KINDS, seeds: SEEDS, steps: STEPS, biome: BIOME, policy: POLICY,
        bound: DIRECTED_ANCHOR_TRIES, subjects: SUBJECTS.map((s) => s.label),
        byKind, totals, rows,
    }, null, 2)}\n`);
    say(`json        ${JSON_OUT}`);
}
