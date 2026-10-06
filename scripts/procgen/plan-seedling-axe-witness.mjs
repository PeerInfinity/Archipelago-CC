#!/usr/bin/env node
/**
 * plan-seedling-axe-witness — ⛓⛓⛓ SEEDLING FIDELITY AXE: THE SOLVER CROSSES A
 * SPINNING AXE BY ITS PHASE, AND THE GAME LETS IT THROUGH.
 *
 * The route survey (`survey-seedling-route.mjs --through=end`) refused ten steps
 * on `hazard:spinningaxe` with *"the combat ladder is EXHAUSTED"*: the danger map
 * priced each axe as the 32 px disc it sweeps, AVOID routes round rects only,
 * and no other rung applies to a hazard. The axe is now priced at its own update
 * count in TRANSIT (`dangerMap.hazardDanger`, measured on the game by
 * `probe-seedling-axe-phase.mjs`), and the DODGE rung's AXE arm stalls at the
 * doorstep of the blade's reach — or bends the corridor (`deriveChaserDetour`)
 * to one a stall can time — and walks the rest of that corridor.
 *
 * These tapes are the solver's own plans for four of those steps, staged as the
 * survey stages them, so the GAME can be recorded against them
 * (`check-seedling-bot-differential --record --only=…`). Each plan is required
 * to ENTER the old disc (a box centre within 32 px of the hub: what the old
 * pricing refused) and to cross; the recording must equal the model's replay at
 * 0 px — a blade that reached the player would knock it, and the model bills no
 * axe contact, so any hit is a divergence.
 *
 *   axe-l61-reach-l62   route step 128 (L61 → L62): from the L60 door, past
 *                       `spinningaxe@64,144` (rate 5) to `teleporter@112,0`.
 *   axe-l61-reach-l63   route step 160 (L61 → L63): from the L60 door, past both
 *                       axes to `teleporter@224,96`.
 *   axe-l48-reach-l49   route step 78 (L48 → L49): past `spinningaxe@208,224`
 *                       (rate 6) into `pit@176,48`.
 *   axe-l71-reach-l76   route step 178 (L71 → L76): past `spinningaxe@256,144`
 *                       (rate 7) to `teleporter@304,256`. No rung: the exact
 *                       pricing alone certifies the planner's own corridor.
 *
 * THE STAGING (the survey's, written out): `r8-solve-11`'s committed block
 * (`solveStaging`), re-pointed at the step's atlas arrival, with the save keys
 * and seam items the route holds by then, its timed clears stripped. `--check`
 * re-derives every plan and compares it with the committed tape byte for byte.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-axe-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-axe-witness.mjs --check    # exit 1 on drift
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

/** The staged base every witness boots from (the survey's `staged` boot). */
export const AXE_BASE = 'r8-solve-11';

/** The witnesses: the survey step, its boot, its grant, its goal, the axes it passes. */
export const AXE_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'axe-l61-reach-l62',
        step: 128,
        boot: { level: 61, x: 16, y: 160 },
        keys: [0, 1, 2, 3],
        items: ['canSwim', 'hasFire', 'hasShield', 'hasTorch'],
        goal: { kind: 'reach-exit', exit: { x: 112, y: 0 } },
        to: 62,
        axes: [{ id: 'spinningaxe@64,144', cx: 72, cy: 152, rate: 5 }],
        what: 'route step 128 (L61 → L62): from the L60 door past `spinningaxe@64,144` (rate 5) '
            + 'to `teleporter@112,0`',
    }),
    Object.freeze({
        name: 'axe-l61-reach-l63',
        step: 160,
        boot: { level: 61, x: 16, y: 160 },
        keys: [0, 1, 2, 3, 4],
        items: ['canSwim', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear',
            'hasTorch', 'hasWand'],
        goal: { kind: 'reach-exit', exit: { x: 224, y: 96 } },
        to: 63,
        axes: [{ id: 'spinningaxe@64,144', cx: 72, cy: 152, rate: 5 },
            { id: 'spinningaxe@160,80', cx: 168, cy: 88, rate: 7 }],
        what: 'route step 160 (L61 → L63): from the L60 door past `spinningaxe@64,144` and '
            + '`spinningaxe@160,80` to `teleporter@224,96`',
    }),
    Object.freeze({
        name: 'axe-l48-reach-l49',
        step: 78,
        boot: { level: 48, x: 112, y: 288 },
        keys: [0, 1, 2],
        items: ['hasFire', 'hasShield', 'hasTorch'],
        goal: { kind: 'reach-pit', pit: { tx: 11, ty: 3, x: 176, y: 48 } },
        to: 49,
        axes: [{ id: 'spinningaxe@208,224', cx: 216, cy: 232, rate: 6 }],
        what: 'route step 78 (L48 → L49): past `spinningaxe@208,224` (rate 6) into `pit@176,48`',
    }),
    Object.freeze({
        name: 'axe-l71-reach-l76',
        step: 178,
        boot: { level: 71, x: 96, y: 16 },
        keys: [0, 1, 2, 3, 4],
        items: ['canSwim', 'hasDarkShield', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield',
            'hasSpear', 'hasTorch', 'hasWand'],
        goal: { kind: 'reach-exit', exit: { x: 304, y: 256 } },
        to: 76,
        axes: [{ id: 'spinningaxe@256,144', cx: 264, cy: 152, rate: 7 }],
        // ⛓ No rung: the exact pricing ALONE certifies the planner's own corridor,
        // which passes 31.8 px from the hub — inside the old disc's centre test.
        exactOnly: true,
        what: 'route step 178 (L71 → L76): past `spinningaxe@256,144` (rate 7) to '
            + '`teleporter@304,256`',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function axeStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${AXE_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** The solver's plan for one witness, from that staging. */
export async function axePlan(w) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = await axeStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [w.goal], name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
    return { staging, solved };
}

/**
 * The walk against each axe: the closest box centre to the hub (the old disc
 * tested the centre against 32 px), how many observations were inside the disc,
 * and the closest the blade came (the fewest px between the box and the blade
 * line at the update that tests it, over every observation inside the reach).
 */
export async function axeVisit(ticks, w, V = 0) {
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const { axeHitsPlayer } = await import(join(MODULE, 'hazards.js'));
    return w.axes.map((axe) => {
        let min = Infinity;
        let inside = 0;
        let hits = 0;
        for (let f = 1; f < ticks.length; f += 1) {
            const o = ticks[f - 1];
            if (o.level !== w.boot.level) continue;
            const b = playerBoxAt(o.x, o.y);
            const d = Math.hypot((b.x + b.right) / 2 - axe.cx, (b.y + b.bottom) / 2 - axe.cy);
            if (d < min) min = d;
            if (d <= 32) inside += 1;
            if (axeHitsPlayer(axe, f - V, b)) hits += 1;
        }
        return { id: axe.id, min, inside, hits };
    });
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const CHECK = process.argv.includes('--check');
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
    for (const w of AXE_WITNESSES) {
        const { staging, solved } = await axePlan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const dodges = solved.out.trace.rows.filter((r) => r.strategy?.rung === 'dodge');
        const how = dodges.map((r) => (r.strategy.stall
            ? `stall ${r.strategy.stall.ticks} t at walk-offset ${r.strategy.stall.at}` : 'no stall')
            + (r.strategy.vias ? ` on a corridor bent through ${r.strategy.vias.map((v) => `(${v.x},${v.y})`).join(' ')}` : ''))
            .join('; ') || 'no DODGE row';
        const description = `⛓⛓⛓ SEEDLING FIDELITY AXE — ${w.what}. The survey's staging `
            + `(\`${AXE_BASE}\`'s committed block re-pointed at the atlas arrival, keys `
            + `[${w.keys.join(', ')}], items [${w.items.join(', ')}]). The solver's own plan: `
            + `${solved.out.perTick.length} t, equips ${JSON.stringify(solved.out.equips)}; the `
            + `DODGE rung's AXE arm: ${how}. `
            + 'Authored by scripts/procgen/plan-seedling-axe-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        check(w.exactOnly
            ? `${w.name}: the plan needs NO rung — the exact pricing alone certifies its corridor`
            : `${w.name}: the plan is the DODGE rung's AXE arm (${how})`,
        w.exactOnly ? dodges.length === 0 : dodges.length > 0);
        for (const v of await axeVisit(out.ticks, w)) {
            check(`${w.name}: the walk enters ${v.id}'s old 32 px disc and the blade never reaches it`,
                v.inside > 0 && v.hits === 0,
                `closest box centre ${v.min.toFixed(2)} px, ${v.inside} observation(s) inside, ${v.hits} blade/hub contact(s)`);
        }
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
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
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
