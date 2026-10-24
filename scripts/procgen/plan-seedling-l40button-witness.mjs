#!/usr/bin/env node
/**
 * plan-seedling-l40button-witness — Seedling fidelity L40BUTTON (wave 12), D3: the solver's own plan for
 * `Level 040 - Totem Part 64,144` from L40's two NORTH arrivals (sweep-4 legs 378 and 381), written as roster tapes
 * for `check-seedling-bot-differential --record` to record on the game (p4f) and for the model to reproduce.
 *
 * ⛓ THE ROUTE (D1, `probe-seedling-l40button.mjs`): from either arrival the part needs only L40's NW cluster —
 * `buttonroom@272,208` {t 0} latches group 0, the three `breakablerock`s {22,23,24} come down, `buttonroom@160,128`
 * {t 1} latches group 1 — the order the R5 tape `r5-l40-part0` recorded on the game from a boot INSIDE the cluster.
 * `button@480,384`/`wandlock@448,432` (group 2), which the refusal named, are in no arm's way.
 *
 * ⚠ THE PLAN NEEDS `STANCE_ROCKS` ON (the switch ships OFF): with it OFF both arrivals refuse, which is the sweep's
 * refusal. This script turns it on for its own solves only (`withStanceRocks`), so a committed tape is the ON
 * solver's walk and the default solver is untouched. The staging is the survey's construction (`r8-solve-11`'s
 * committed block re-pointed at the atlas arrival) with the leg's sphere-5.3 items and keys.
 *
 * ⚠ SLOW: each arrival is a ~16-minute solve on a cloud box (the walk's chaser previews: L40's bobs), so `--check`
 * costs two of them. The vitest rows replay the committed tapes; they do not re-solve.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-l40button-witness.mjs [--check] [--only=<name>]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

export const L40BUTTON_BASE = 'r8-solve-11';

/** Sphere 5.3's held items (the legs' `after.has`, the sword already latched by the base block) and its keys. */
const SPHERE_5_3_ITEMS = Object.freeze(['canSwim', 'hasFire', 'hasShield', 'hasTorch']);
const SPHERE_5_3_KEYS = Object.freeze([0, 1, 2]);

export const L40BUTTON_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'l40button-l41-part0',
        leg: 378,
        key: 'level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144',
        boot: Object.freeze({ level: 40, x: 928, y: 96 }),
        from: 'L41 teleporter@0,160',
    }),
    Object.freeze({
        name: 'l40button-l42-part0',
        leg: 381,
        key: 'level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144',
        boot: Object.freeze({ level: 40, x: 848, y: 16 }),
        from: 'L42 teleporter@240,336',
    }),
]);

/**
 * ⛔⛔ THE DAMAGE-ON WALK IS GAME-REFUTED, AND NOT BY ANYTHING THIS SLICE CHANGED. Recorded on p4f with `noDamage`
 * false (`CC/docs/cloud-reports/seedling-fidelity-l40button-evidence/bomb-refuted-*`): while the player stands on
 * `buttonroom@272,208` waiting out group 0's 101-tick fade, `bombpusher@112,128` (157 px away; `maxDistance` 256,
 * `activeOffScreen`) lobs a `Bomb` at the player's position; it flies 30 updates and its `Explosion` (r 24) lands on
 * the player — leg 381: `hits` 0 → 1 and a westward knockback (vx −3.71) at t1064, the stream parting at t1065;
 * leg 378: the stream parts the same way (dx −3.40) at t1154. The model
 * steps no `BombPusher` emitter (its `Explosion` arm serves the boss shots only), so model and solver both see a
 * quiet room. That is a model-coverage work order of its own (an enemy projectile + its danger pricing), handed over;
 * these witnesses record the same inputs with the hit path off so they prove the ROUTE at 0 px.
 */
export const BOMB_REFUTED = Object.freeze({
    source: 'bombpusher@112,128',
    projectile: 'Projectiles/Bomb.as (30 updates, Explosion r 24 at removal)',
    firstDivergence: Object.freeze({ 'l40button-l41-part0': 1154, 'l40button-l42-part0': 1065 }),
    sentence: '⛔ noDamage TRUE: the same inputs with damage on are game-refuted by `bombpusher@112,128`\'s lobbed '
        + 'Bomb (an unmodelled enemy projectile) while the player waits on buttonroom@272,208 — evidence in '
        + 'CC/docs/cloud-reports/seedling-fidelity-l40button-evidence/.',
});

export const L40BUTTON_GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 64, y: 144 }) });

/** The survey-style staging for one witness boot. */
export async function l40buttonStaging(boot) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${L40BUTTON_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...SPHERE_5_3_KEYS])].sort((a, b) => a - b) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(SPHERE_5_3_ITEMS.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** The ON solver's plan from `boot` (default solver behaviour restored after). */
export async function l40buttonPlan(boot, name) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withStanceRocks } = await import(join(MODULE, 'solverBot.js'));
    const staging = await l40buttonStaging(boot);
    const levelSource = atlasLevelSource();
    const solved = await withStanceRocks(true, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [L40BUTTON_GOAL], name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    return { staging, solved };
}

/**
 * ⚖ PINNED `bombPusherLive` and `strikeIframeLapse` OFF — an INTERIM (seedling-fidelity-producers, 2026-10-16). Both
 * tapes were recorded on the game under the pre-flip model. Two flips moved this producer and neither re-pin list named
 * it (no CI job runs it): the wave-13 flip (`3e6f048cd3`, ⚖ user 2026-10-11 "ON at harvest") turned `bombPusherLive`
 * ON, and with the lobber live the cluster's hold inside its reach is refused by name (`lobberHoldRefusal` THROWS from
 * `l40button-l41-part0`'s solve) — `fidelityL40Button` pinned its solve rows OFF for exactly that; the lapse flip
 * (`19aaa5cce4`) then moved both plans again (with only the lobber pinned, `l41-part0` drifts and `l42-part0` throws a
 * `BotDriverV2Error` on its collect stance). With both OFF at d1fbfeffc2 `--check` is green. ⛔ RETIRE THIS PIN with
 * the modelling the ON refusal names (a moving wait, or a priced bomb hit: `movingWait` / `forcedHits`) and a re-record
 * on the game — a roster move, so the user's licence.
 */
const PINNED_FIDELITY = Object.freeze({ bombPusherLive: false, strikeIframeLapse: false });

async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const CHECK = process.argv.includes('--check');
    const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? null;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of L40BUTTON_WITNESSES) {
        if (only && w.name !== only) continue;
        const t0 = Date.now();
        const { staging, solved } = await l40buttonPlan(w.boot, w.name);
        const verbs = solved.out.records.map((r) => r.strategy);
        const cluster = verbs.filter((v) => v === 'hold' || v === 'break' || v === 'collect');
        const group2 = solved.out.records.filter((r) => /448,432|512,480|480,384/.test(JSON.stringify(r)));
        check(`${w.name}: the ON plan latches t0, breaks, latches t1, collects — and never touches group 2`,
            JSON.stringify(cluster) === JSON.stringify(['hold', 'break', 'hold', 'collect']) && group2.length === 0,
            `${JSON.stringify(verbs)}, ${solved.out.perTick.length} t, ${Math.round((Date.now() - t0) / 1000)} s`);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY L40BUTTON — sweep-4 leg ${w.leg} (\`${w.key}\`): L40 from `
            + `${w.from}, arrival (${w.boot.x},${w.boot.y}), to \`Totem Part 64,144\`. The solver's own plan with `
            + '`STANCE_ROCKS` ON: `hold` buttonroom@272,208 (group 0 latches), `break` the NW cluster\'s rocks '
            + '{22,23,24}, `hold` buttonroom@160,128 (group 1 latches), collect — the order `r5-l40-part0` recorded from '
            + 'inside the cluster, here from the arrival. Group 2 (`button@480,384`, `wandlock@448,432`), which the '
            + `OFF refusal named, is never touched. ${solved.out.perTick.length} t. The survey's staging `
            + `(\`${L40BUTTON_BASE}\` re-pointed at the arrival; items [${SPHERE_5_3_ITEMS.join(', ')}], keys `
            + `[${SPHERE_5_3_KEYS.join(', ')}]). Authored by scripts/procgen/plan-seedling-l40button-witness.mjs.`;
        // ⛔ noDamage: the damage-on recording of these exact inputs is REFUTED by an unmodelled hazard — see
        // `BOMB_REFUTED` — so the witness of the ROUTE is recorded with the hit path off (the R5 cluster tape's own
        // choice). The inputs are the solver's, unchanged.
        const witness = { ...built, noDamage: true, description: `${description} ${BOMB_REFUTED.sentence}` };
        const tape = parseTape(witness);
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it to the part`, last?.level === 40
            && Math.abs(last.x - 64) < 24 && Math.abs(last.y - 144) < 24,
        `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const json = `${JSON.stringify(witness, null, 4)}\n`;
        const path = join(TAPES, `${w.name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    if (failures) {
        console.log(`${failures} FAILED`);
        process.exit(1);
    }
    console.log('all checks green');
}

if (isEntryPoint(import.meta.url)) {
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    await withContactFidelity(PINNED_FIDELITY, main);
}
