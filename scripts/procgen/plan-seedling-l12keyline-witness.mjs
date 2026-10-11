#!/usr/bin/env node
/**
 * plan-seedling-l12keyline-witness — ⛓⛓⛓ SEEDLING FIDELITY L12KEYLINE: THE
 * GAME WITNESS FOR THE WAY ROUND L12'S SEALED LOCK.
 *
 * Authors (and with `--check` re-derives, byte for byte) the committed tape the
 * slice records on the GAME and the model then reproduces:
 *
 *   l12keyline-134-round   route step 134 (L12 → L95): the arrival (592,16) is
 *                          NORTH of `bosslock@416,240`, whose key line is the
 *                          row under it (y 257) and whose flag {12,4} the save
 *                          still holds — SEALED BEHIND ITSELF. AP's own region
 *                          chain goes ROUND it, r0c37 →[Fire]→ r42c29
 *                          →[Progressive Swim]→ r0c19: down the east shaft,
 *                          burn `burnabletree@480,640`, swim the row-48 water
 *                          west, and walk north to `teleporter@0,352`. The
 *                          solver's own plan since L12KEYLINE D2 (the frontier
 *                          passes the sealed lock to the next door).
 *
 * The staging is the survey's (`r8-solve-11`'s committed block re-pointed at
 * the atlas arrival, the route's keys, items and cleared flags at that step —
 * survey run 38075646127's `views/step-134-boot.json`), so the witness IS the
 * survey step's plan.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-l12keyline-witness.mjs           # write the tape
 *   node scripts/procgen/plan-seedling-l12keyline-witness.mjs --check   # re-derive; exit 1 on drift
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

const CHECK = process.argv.includes('--check');

/** The staged base every witness boots from (the survey's `staged` boot). */
export const L12KEYLINE_BASE = 'r8-solve-11';

/** L12's sealed lock (north of it is the arrival) and the door round it. */
export const L12_LOCK = Object.freeze({ id: 'bosslock@416,240', twin: 'bosslock@432,240',
    keyLineY: 257, flag: Object.freeze({ level: 12, tag: 4 }) });
export const L12_TREE = Object.freeze({ id: 'burnabletree@480,640', flag: Object.freeze({ level: 12, tag: 2 }) });

/**
 * The route's cleared flags at step 134 (the survey's `deriveRoute` persistence,
 * run 38075646127) beyond the base block's own.
 */
const ROUTE_CLEARS_134 = Object.freeze([
    [0, 1], [19, 1], [31, 0], [30, 2], [30, 0], [12, 3], [40, 8],
].map(([level, tag]) => Object.freeze({ level, tag })));

export const L12KEYLINE_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'l12keyline-134-round',
        step: 134,
        boot: { level: 12, x: 592, y: 16 },
        keys: [0, 1, 2, 3],
        items: ['canSwim', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'],
        clears: ROUTE_CLEARS_134,
        goals: [{ kind: 'reach-exit', exit: { x: 0, y: 352 } }],
        to: 95,
        what: 'route step 134 (L12 → L95) in the SHUT state of `bosslock@416,240` (flag {12,4} held, its key line '
            + 'y 257 on the far side from the arrival): the solver goes ROUND it — down the east shaft, burns '
            + '`burnabletree@480,640` (Fire), swims the row-48 water west (Progressive Swim) and walks north to '
            + '`teleporter@0,352` (L95). The lock is never touched',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function l12keylineStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${L12KEYLINE_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    const kept = (staging.persistence ?? []).filter((r) => r.at === undefined);
    staging.persistence = [
        ...kept,
        ...w.clears.filter((c) => !kept.some((r) => r.level === c.level && r.tag === c.tag))
            .map((c) => ({ level: c.level, tag: c.tag })),
    ];
    return staging;
}

/** The solver's plan for one witness, from that staging. */
export async function l12keylinePlan(w) {
    const staging = await l12keylineStaging(w);
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    const solved = await twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
    return { staging, solved };
}

/** The run, advanced through a tape's own keys; `each` sees the run after every tick. */
export async function replayL12Run(tape, levelSource, each = null) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, levelSource);
    for (let i = 0; i < tape.tick_count; i += 1) {
        run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
        if (each) each(run, i);
    }
    return run;
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of L12KEYLINE_WITNESSES) {
        const { staging, solved } = await l12keylinePlan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY L12KEYLINE — ${w.what}. The survey's staging `
            + `(\`${L12KEYLINE_BASE}\`'s committed block re-pointed at L${w.boot.level} `
            + `(${w.boot.x},${w.boot.y}), keys [${w.keys.join(', ')}], items [${w.items.join(', ')}], `
            + `the route's cleared flags ${w.clears.map((c) => `{${c.level},${c.tag}}`).join(' ')}). `
            + `The solver's own plan: ${solved.out.perTick.length} t, equips ${JSON.stringify(solved.out.equips)}. `
            + 'Authored by scripts/procgen/plan-seedling-l12keyline-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const verbs = (solved.out.records ?? []).map((r) => r.strategy).filter(Boolean);
        check(`${w.name}: the plan burns ${L12_TREE.id} and applies no \`keylock\``,
            (solved.out.records ?? []).some((r) => r.strategy === 'burn' && (r.target ?? r.tree) === L12_TREE.id)
                && !verbs.includes('keylock'), JSON.stringify(verbs));
        let lockOpened = false;
        let swum = 0;
        let lockRowSouth = false;
        const run = await replayL12Run(tape, levelSource, (r) => {
            if (r.level !== 12) return;
            if (r.entities('openActivators').has(L12_LOCK.id)
                || r.entities('openActivators').has(L12_LOCK.twin)) lockOpened = true;
            if (r.state.hazard?.inWater) swum += 1;
            if (r.state.y > L12_LOCK.keyLineY + 200) lockRowSouth = true;
        });
        check(`${w.name}: ${L12_LOCK.id} and its twin stay SHUT (never in openActivators)`, !lockOpened,
            'the flag {12,4} is held and the walk never stands on its key line');
        check(`${w.name}: the walk SWIMS (ticks in water with canSwim)`, swum > 0, `${swum} tick(s) in water`);
        check(`${w.name}: the walk goes south of the lock row, round it`, lockRowSouth, '');
        check(`${w.name}: the tree is burned in the replay`,
            (run.ledger('treeBurns') ?? []).some((b) => b.id === L12_TREE.id),
            JSON.stringify((run.ledger('treeBurns') ?? []).map((b) => [b.id, b.t, b.goneAt])));
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const path = join(TAPES, `${w.name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else if (!process.argv.includes('--dry')) {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
