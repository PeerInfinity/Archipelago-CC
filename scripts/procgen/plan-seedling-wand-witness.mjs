#!/usr/bin/env node
/**
 * plan-seedling-wand-witness — ⛓⛓⛓ SEEDLING FIDELITY WAND: THE TWO TAPES THE WAND WITNESSES EMBED.
 *
 *   wand-l39-wandlock-shot   D1, the NEGATIVE witness. Survey step 60's staging (L39 arrival (144,608), under the
 *                            plug `wandlock@144,592 {tset -1, tag 8}`), the Wand granted. Up for 6 ticks (the facing),
 *                            the Wand's slot at t8, one press at t12, then up from t60. A `WandLock` is a `Lock`: the
 *                            shot dies on it, `{39,8}` is never written, the walk north stays shut. Hand-authored —
 *                            the solver never shoots a wandlock (that is the finding).
 *   wand-l68-magicallock     D3, the POSITIVE witness. Survey step 147's staging (L68@16,64). The SOLVER's own plan,
 *                            `WAND_VERB` on, for two `clear-tag` goals — `bosslock@16,32` {tag 0} (`keylock`) then
 *                            `magicallock@16,32` {tag 1} (`wand`) — then 12 ticks of up into the opened cell.
 *   wand-l34-barhouse-exit   D3, a whole SOLVE through the verb. Sweep-3 leg 354's arrival in L34 (32,128), the
 *                            Wand granted: the solver's plan for the reach-exit whose teleporter `magicallock@128,0`
 *                            {tag 0} stands on — the wand, then the walk onto the teleporter into L12.
 *
 * Both are embedded in `fixtures/wand-witness/<name>.json` with the GAME's samples
 * (`probe-seedling-wand-mobiles.mjs --record`); `fidelityWand.test.js` replays them against the model.
 *
 * THE STAGING (the survey's, written out): `r8-solve-11`'s committed block (`solveStaging`), re-pointed at the step's
 * atlas arrival, with the save keys and seam items the route holds by then, its timed clears stripped.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-wand-witness.mjs --out=<dir>   write both tapes to <dir> (then probe + record)
 *   node scripts/procgen/plan-seedling-wand-witness.mjs --check       exit 1 unless each re-derived tape is the one
 *                                                                     its witness fixture embeds
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
const WITNESS_DIR = join(MODULE, 'fixtures', 'wand-witness');

export const WAND_BASE = 'r8-solve-11';

/** The survey's item names for the two steps' grants (survey run 38075646127's `saveGrant`). */
const STEP60_ITEMS = ['hasFire', 'hasShield', 'hasTorch'];
const STEP147_ITEMS = ['canSwim', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch',
    'hasWand'];

export const WAND_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'wand-l39-wandlock-shot',
        step: 60,
        boot: { level: 39, x: 144, y: 608 },
        keys: [0, 1],
        items: [...STEP60_ITEMS, 'hasWand'],
        hand: { ticks: 120, up: [[0, 6], [60, 120]], equipAt: 8, pressAt: 12 },
        description: 'seedling-fidelity-wand D1 NEGATIVE witness: L39 arrival (144,608) under the plug '
            + '`wandlock@144,592 {tset -1, tag 8}`, the Wand granted; face up, select the wand slot, press, then walk up '
            + 'into the plug. `WandShot.checkEntity` opens only a MagicalLock: the shot dies on the WandLock and the '
            + 'plug stays.',
    }),
    Object.freeze({
        name: 'wand-l68-magicallock',
        step: 147,
        boot: { level: 68, x: 16, y: 64 },
        keys: [0, 1, 2, 3, 4],
        items: STEP147_ITEMS,
        // The route's cleared flags by step 147 (the survey's `stagedFlags`, run 38075646127).
        flags: [[0, 1], [19, 1], [31, 0], [30, 2], [30, 0], [12, 3], [40, 8]],
        goals: [
            { kind: 'clear-tag', tag: { level: 68, tag: 0 }, at: { x: 16, y: 32 }, obstacle: 'bosslock@16,32' },
            { kind: 'clear-tag', tag: { level: 68, tag: 1 }, at: { x: 16, y: 32 }, obstacle: 'magicallock@16,32' },
        ],
        walkUp: 12,
        description: "seedling-fidelity-wand D3 POSITIVE witness: survey step 147 (L68, sphere 7.2), the survey's staging (r8-solve-11 re-pointed at L68@16,64, the route's keys and items incl. hasWand). The solver's own plan (WAND_VERB on) for two clear-tag goals: `keylock` opens `bosslock@16,32` {tag 0}, then `wand` leans up into `magicallock@16,32` {tag 1}, selects the Wand slot, presses at t122; the shot spawns at (24,34) at t130, MagicalLock.hit writes {68,1} at t131 (game readout), the cell opens at t145; then 12 ticks of up walk into the opened cell.",
    }),
    Object.freeze({
        name: 'wand-l34-barhouse-exit',
        step: null,
        // Sweep-3 leg 354's arrival (`in_L12_336_688`: L34 at (32,128)), with the Wand granted.
        boot: { level: 34, x: 32, y: 128 },
        keys: [],
        items: ['hasWand'],
        goals: [{ kind: 'reach-exit', exit: { x: 128, y: 0 } }],
        walkUp: 0,
        description: 'seedling-fidelity-wand D3 SOLVE witness: sweep-3 leg 354\'s arrival in L34 (32,128), the Wand granted '
            + '(r8-solve-11\'s block re-pointed). The solver\'s own plan (WAND_VERB on) for the reach-exit whose teleporter '
            + '`magicallock@128,0` {tag 0} stands on: lean up, the Wand\'s slot, the press, MagicalLock.hit, the open, the '
            + 'walk onto the teleporter into L12.',
    }),
]);

export async function wandStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${WAND_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    for (const [level, tag] of w.flags ?? []) {
        if (!staging.persistence.some((r) => r.level === level && r.tag === tag)) staging.persistence.push({ level, tag });
    }
    return staging;
}

/** The tape (as written: the JSON object `parseTape` reads) for one witness. */
export async function wandWitnessTape(w) {
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { INVENTORY_ITEM_IDS } = await import(join(MODULE, 'tapeFormat.js'));
    const staging = await wandStaging(w);
    const levelSource = atlasLevelSource();
    if (w.hand) {
        const run = createRunForStaging(staging, levelSource);
        const slot = run.progress('inventorySlots').indexOf(INVENTORY_ITEM_IDS.wand);
        const perTick = [];
        for (let t = 0; t < w.hand.ticks; t += 1) {
            const k = new Set();
            if (w.hand.up.some(([a, b]) => t >= a && t < b)) k.add('up');
            if (t === w.hand.pressAt) k.add('primary');
            perTick.push(k);
        }
        const built = buildStagedTape({ staging: { ...staging, equips: [...(staging.equips ?? []),
            { t: w.hand.equipAt, slot }] }, perTick, name: w.name });
        return { tape: { ...built, description: w.description }, records: null };
    }
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { withWandVerb } = await import(join(MODULE, 'wandVerb.js'));
    const solved = await withWandVerb(true, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const perTick = [...solved.out.perTick];
    for (let i = 0; i < w.walkUp; i += 1) perTick.push(new Set(['up']));
    const built = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick, name: w.name,
    });
    const records = solved.out.records.map((r) => ({ strategy: r.strategy, target: r.target,
        pressTick: r.pressTick ?? null, hitTick: r.hitTick ?? null, openTick: r.openTick ?? null }));
    return { tape: { ...built, description: w.description }, records };
}

/** Game-visible equality: everything but the free-text `description`. */
const sameTape = (a, b) => JSON.stringify({ ...a, description: null }) === JSON.stringify({ ...b, description: null });

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const CHECK = process.argv.includes('--check');
    const OUT = arg('out');
    if (!CHECK && !OUT) {
        console.error('plan-seedling-wand-witness: pass --out=<dir> or --check');
        process.exit(2);
    }
    let failures = 0;
    for (const w of WAND_WITNESSES) {
        const { tape, records } = await wandWitnessTape(w);
        if (records) console.log(`${w.name}: records ${JSON.stringify(records)}`);
        if (CHECK) {
            const path = join(WITNESS_DIR, `${w.name}.json`);
            const ok = existsSync(path) && sameTape(JSON.parse(readFileSync(path, 'utf8')).tape, tape);
            if (!ok) failures += 1;
            console.log(`${ok ? 'PASS' : 'FAIL'}: the tape ${w.name}'s witness embeds is what this script derives today`);
        } else {
            const path = join(OUT, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify(tape, null, 4)}\n`);
            console.log(`wrote ${path}`);
        }
    }
    if (failures > 0) process.exit(1);
}

if (isEntryPoint(import.meta.url)) await main();
