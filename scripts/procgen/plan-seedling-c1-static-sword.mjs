#!/usr/bin/env node
/**
 * plan-seedling-c1-static-sword — ⛓⛓ SEEDLING HAMMER-PHASE C1: THE STATIC SWORD ARM'S GAME WITNESSES, PLANNED BY THE
 * SOLVER WITH `CHOOSER_HIT_SOURCES` AND `STATIC_SWORD_ARM` ON.
 *
 *   c1-l62-turret      sweep leg 551's room: L62 from (240,288) to `teleporter@96,304` → L61, `turret@232,248` on the
 *                      one-tile path. The staging is the route survey's step-113 block (`r8-solve-11` re-pointed, the
 *                      sword, shield, fire, conch and torch, keys 0–3, seven earned clears) re-pointed at the leg's
 *                      arrival. OFF it refuses at t0 (*"not a body this run can watch die"*, the sweep's text); ON the
 *                      chooser admits the probe's hit, the static sword arm kills the turret (three presses, the
 *                      spit priced) and the walk crosses.
 *   c1-l36-sandtraps   survey step 31's staging (L36 from (32,112), goal the chest (64,48)). OFF it refuses at t0 on
 *                      `sandtrap@48,80` + `@64,80`; ON the arm kills both from ONE stance (one swing reaches both,
 *                      as on the game, C1 D1), then `sandtrap@64,64`. The solve then refuses on the chest's own stance
 *                      walk (residue, not this arm's), so the witness is the keys it drove, CUT two ticks after the
 *                      third body leaves the census — before the walk that enters the chest's volume.
 *
 * The staging is `crusherStaging`'s construction (`plan-seedling-crusher-witness`), as `plan-seedling-bobsoldier2`'s.
 * `--check` re-derives both tapes and compares them with the committed ones byte for byte, asserts the switches-OFF
 * solve still refuses with the survey's / sweep's words, and asserts the model's replay of each.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-c1-static-sword.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-c1-static-sword.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { crusherStaging } from './plan-seedling-crusher-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
// ⛔ NOT the roster: both tapes replay only with `STATIC_SWORD_ARM` ON (OFF the turret walk is a refused contact),
// so they sit beside their game samples, K2's and STATICLADDER's shape (`fidelityStaticSword.test.js`).
const WITNESS_DIR = join(MODULE, 'fixtures', 'static-sword-witness');

const CHECK = process.argv.includes('--check');

/** The two stagings (the survey's own views, written out: `crusherStaging` plus each step's deltas). */
export const C1_WITNESSES = Object.freeze({
    'c1-l62-turret': Object.freeze({
        name: 'c1-l62-turret',
        boot: { level: 62, x: 240, y: 288 },
        keys: [0, 1, 2, 3],
        items: ['hasShield', 'hasFire', 'canSwim', 'hasTorch'],
        earned: [{ level: 0, tag: 1 }, { level: 12, tag: 3 }, { level: 19, tag: 1 }, { level: 30, tag: 0 },
            { level: 30, tag: 2 }, { level: 31, tag: 0 }, { level: 40, tag: 8 }],
        goals: [{ kind: 'reach-exit', exit: { x: 96, y: 304 } }],
        bodies: ['turret@232,248'],
        offRefusal: /reach-exit \(96,304\)->L61: the combat ladder is EXHAUSTED\. The corridor passes through danger at \(248\.0,264\.6\) — enemy:turret@232,248[\s\S]*kill: the danger on this corridor is not a body this run can watch die/,
        cut: null,
    }),
    'c1-l36-sandtraps': Object.freeze({
        name: 'c1-l36-sandtraps',
        boot: { level: 36, x: 32, y: 112 },
        keys: [0],
        items: [],
        earned: [{ level: 0, tag: 1 }],
        goals: [{ kind: 'collect-placement', placement: { x: 64, y: 48 } }, { kind: 'reach-exit', exit: { x: 32, y: 128 } }],
        bodies: ['sandtrap@48,80', 'sandtrap@64,80', 'sandtrap@64,64'],
        offRefusal: /chest \(64,48\) stance: the combat ladder is EXHAUSTED\. The corridor passes through danger at \(63\.2,96\.8\) — enemy:sandtrap@48,80[\s\S]*enemy:sandtrap@64,80[\s\S]*kill: the danger on this corridor is not a body this run can watch die/,
        cut: 2,
    }),
});

/** The staging: `crusherStaging`'s construction with the witness's grants, plus its earned clears. */
export async function c1Staging(w) {
    const staging = await crusherStaging(w);
    staging.persistence = [...staging.persistence, ...w.earned.map((r) => ({ ...r }))];
    return staging;
}

/**
 * The solver on that staging with both C1 switches set to `enabled`. Every run the solve builds is a RECORDING view
 * (`plan-seedling-bobsoldier2`'s shape), so a refusal still hands back the keys the last pass drove, and the run.
 * Resolves `{staging, solved, refusal, driven, run}`.
 */
export async function c1Plan(w, enabled) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withChooserHitSources } = await import(join(MODULE, 'solverBot.js'));
    const { withStaticSwordArm } = await import(join(MODULE, 'enemyDamage.js'));
    const staging = await c1Staging(w);
    const levelSource = atlasLevelSource();
    let driven = null;
    let lastRun = null;
    const makeRun = (p) => {
        const run = createRunForStaging({ ...staging, persistence: p }, levelSource);
        const keys = [];
        driven = keys;
        lastRun = run;
        const view = Object.create(run);
        view.advance = (held) => { keys.push(new Set(held)); return run.advance(held); };
        return view;
    };
    let solved = null;
    let refusal = null;
    try {
        solved = await withChooserHitSources(enabled, () => withStaticSwordArm(enabled, () => twoPassSolve({
            makeRun, goals: w.goals.map((g) => JSON.parse(JSON.stringify(g))), name: w.name,
            boot: staging.boot, persistence: staging.persistence, log: () => {},
        })));
    } catch (e) {
        refusal = e;
    }
    return { staging, solved, refusal, driven, run: lastRun };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape, serializeTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { withStaticSwordArm } = await import(join(MODULE, 'enemyDamage.js'));
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    /** The model's replay of a tape, `STATIC_SWORD_ARM` as given: hits, the end, the static deaths. */
    const replay = (tape, on) => withStaticSwordArm(on, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        let last = null;
        while (!r.done) { last = r.value.observation; r = st.next(); }
        return { out: r.value, last, deaths: run?.ledger('staticBodyDeaths') ?? [], run };
    });
    const emit = (name, json) => {
        const path = join(WITNESS_DIR, `${name}.tape.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    };

    for (const w of Object.values(C1_WITNESSES)) {
        const off = await c1Plan(w, false);
        check(`${w.name}: both switches OFF — the staging REFUSES (the survey's / sweep's words)`,
            off.solved === null && w.offRefusal.test(off.refusal?.message ?? ''),
            (off.refusal?.message ?? 'it solved').split('\n')[0].slice(0, 200));
        const on = await c1Plan(w, true);
        let perTick;
        let staging = on.staging;
        if (w.cut === null) {
            check(`${w.name}: both switches ON — the staging SOLVES`, on.solved !== null,
                (on.refusal?.message ?? '').slice(0, 200));
            if (!on.solved) continue;
            perTick = on.solved.out.perTick;
            staging = { ...on.staging, persistence: on.solved.persistence,
                equips: [...(on.staging.equips ?? []), ...(on.solved.out.equips ?? [])] };
        } else {
            // the keys driven up to the census removal of the last body, plus `cut` ticks
            const deaths = on.run?.ledger('staticBodyDeaths') ?? [];
            const ids = new Set(deaths.map((d) => d.id));
            check(`${w.name}: both switches ON — the arm kills ${w.bodies.join(', ')} before the solve stops`,
                w.bodies.every((b) => ids.has(b)), `deaths [${deaths.map((d) => `${d.id} ${d.killedAt}->${d.removedAt}`).join(', ')}]; `
                    + `${(on.refusal?.message ?? 'it solved').split('\n')[0].slice(0, 160)}`);
            const end = Math.max(...deaths.filter((d) => w.bodies.includes(d.id)).map((d) => d.removedAt)) + 1 + w.cut;
            perTick = (on.driven ?? []).slice(0, end);
        }
        const built = buildStagedTape({ staging, perTick, name: w.name });
        const description = `⛓⛓ SEEDLING HAMMER-PHASE C1 — the static sword arm's game witness: ${w.name === 'c1-l62-turret'
            ? 'sweep leg 551\'s room (L62 from (240,288) to teleporter@96,304 → L61), the route survey\'s step-113 block '
                + 're-pointed at the arrival. Solved with `CHOOSER_HIT_SOURCES` and `STATIC_SWORD_ARM` ON: the chooser admits '
                + 'the probe\'s hit, the arm kills turret@232,248 from its stance (three presses, the spit priced) and the '
                + 'walk crosses'
            : 'survey step 31\'s staging (L36 from (32,112), goal the chest (64,48)). Solved with `CHOOSER_HIT_SOURCES` and '
                + '`STATIC_SWORD_ARM` ON: one stance\'s three presses kill sandtrap@48,80 AND sandtrap@64,80 (one swing reaches '
                + 'both), then sandtrap@64,64. The solve then refuses on the chest\'s own stance walk; these are the keys it '
                + `drove, cut ${w.cut} ticks after the third body leaves the census`}: ${perTick.length} t. `
            + 'Authored by scripts/procgen/plan-seedling-c1-static-sword.mjs.';
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const tape = parseTape(JSON.parse(json));
        const onR = replay(tape, true);
        const killed = new Set(onR.deaths.map((d) => d.id));
        check(`${w.name}: the model replays it ON — zero hits, ${w.bodies.join(' + ')} killed and removed`
            + (w.cut === null ? ', the crossing into L61' : ''),
            (onR.out.playerHits?.length ?? 0) === 0 && w.bodies.every((b) => killed.has(b))
                && (w.cut !== null || onR.last?.level === 61),
            `hits ${onR.out.playerHits?.length ?? '?'}, ends ${JSON.stringify({ level: onR.last?.level, x: onR.last?.x, y: onR.last?.y })}, `
                + `deaths [${onR.deaths.map((d) => `${d.id} ${d.killedAt}->${d.removedAt}`).join(', ')}]`);
        // OFF the model never removes the body: the same keys kill nothing, and a walk through its cell refuses
        let offR = null;
        let offThrew = null;
        try { offR = replay(tape, false); } catch (e) { offThrew = e; }
        check(`${w.name}: the model OFF replays the same keys and kills NOTHING (the divergence C1 D1 measured) — `
            + 'or refuses by name where the walk crosses the body it never removed',
        offThrew ? new RegExp(`standing inside (${w.bodies.join('|')})`).test(offThrew.message)
            : offR.deaths.length === 0,
        offThrew ? offThrew.message.split('\n')[0].slice(0, 160) : `deaths [${offR.deaths.map((d) => d.id).join(', ')}]`);
        check(`${w.name}: the tape round-trips through the tape format`, Boolean(serializeTape(tape)));
        emit(w.name, json);
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
