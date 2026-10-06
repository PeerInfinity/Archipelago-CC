#!/usr/bin/env node
/**
 * plan-seedling-ladder2-witness — ⛓⛓⛓ SEEDLING FIDELITY LADDER2: THE SOLVER
 * CROSSES A PLACED GRENADE, A LAVA CHAIN AND A BEAM TOWER, AND THE GAME LETS IT
 * THROUGH.
 *
 * The route survey refused these steps "the combat ladder is EXHAUSTED" on
 * `enemy:grenade`, `hazard:lavachain` and `hazard:beamtower`: the grenade was
 * priced as a contact it does not have, the chain and the beam as the volumes
 * they sweep over every phase. Each is now priced at its own clock (measured on
 * the game by `probe-seedling-ladder2-phase.mjs`), the grenade's blast off the
 * walk's own forecast, and the DODGE rung's PHASE arm stalls a walk past a
 * chain or a beam.
 *
 * These tapes are the solver's own plans, staged as the survey stages them
 * (`plan-seedling-axe-witness.axeStaging`), so the GAME can be recorded against
 * them (`check-seedling-bot-differential --record --only=…`). Each plan must
 * ENTER what the old pricing refused (the grenade's 32 px trigger disc — it
 * ARMS it — or the chain's / beam's census volume) and must cross with no
 * contact the model computes: no blast within 20 px, no chain arm or beam rect
 * touching the pre-move box on the update that tests it. The model bills the
 * blast (`levelRun.stepPlacedGrenadesNow`) and not the chain or the beam, so a
 * recording at 0 px is the game agreeing on all three.
 *
 *   ladder2-l59-grenade   route step 137 (L59 → L67): from (144,288) past
 *                         `grenade@112,112` — whose fall column is a wall — to
 *                         `teleporter@0,128`. It ARMS the grenade (update 68) and
 *                         leaves before the blast; no rung.
 *   ladder2-l104-beam     route step 206 (L104 → L105): past the rate-1
 *                         `beamtower@16,56`, which turns through all four sides,
 *                         to `teleporter@0,16`. The PHASE arm's stall.
 *
 * ⛔ `LADDER2_REFUTED` keeps the plans the GAME refuted, with the reason, and
 * `--refuted` writes them so they can be recorded as evidence and removed: L75's
 * chain crossing (0 px through t160, then an unstepped LavaRunner) and L103's
 * beam (the plan of a beam that ended at x 160; the game's beam did not).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-ladder2-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-ladder2-witness.mjs --check    # exit 1 on drift
 *   node scripts/procgen/plan-seedling-ladder2-witness.mjs --refuted  # write the refuted plans (evidence)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { AXE_BASE, axeStaging } from './plan-seedling-axe-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const ALL_ITEMS = ['canSwim', 'hasDarkShield', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield',
    'hasSpear', 'hasTorch', 'hasWand'];

/** The witnesses: the survey step, its boot, its grant, its goal, the class rows it passes. */
export const LADDER2_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'ladder2-l59-grenade',
        step: 137,
        boot: { level: 59, x: 144, y: 288 },
        keys: [0, 1, 2, 3],
        items: ['canSwim', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'],
        goal: { kind: 'reach-exit', exit: { x: 0, y: 128 } },
        to: 67,
        grenades: [{ id: 'grenade@112,112', cx: 120, cy: 120 }],
        phase: [],
        what: 'route step 137 (L59 → L67): past `grenade@112,112` (its fall column is a wall) '
            + 'to `teleporter@0,128`',
    }),
    Object.freeze({
        name: 'ladder2-l104-beam',
        step: 206,
        boot: { level: 104, x: 128, y: 128 },
        keys: [0, 1, 2, 3, 4],
        items: [...ALL_ITEMS, 'hasDarkSuit'].sort(),
        goal: { kind: 'reach-exit', exit: { x: 0, y: 16 } },
        to: 105,
        grenades: [],
        phase: [{ tag: 'beamtower', x: 16, y: 56, cx: 24, cy: 72, attrs: { direction: '0', rate: '1', speed: '1' } }],
        dodge: true,
        what: 'route step 206 (L104 → L105): past the rate-1 `beamtower@16,56` to `teleporter@0,16`',
    }),
]);

/**
 * ⛔ PLANS THE GAME REFUTED, kept with their reason and NOT written as fixtures
 * (`main` plans them only with `--refuted`, into the tape directory, so they can
 * be recorded as evidence and removed): a recording whose model is wrong is not
 * a witness. Each is refuted by a class this slice does not step.
 */
export const LADDER2_REFUTED = Object.freeze([
    Object.freeze({
        name: 'ladder2-l75-chain',
        step: 162,
        boot: { level: 75, x: 64, y: 16 },
        keys: [0, 1, 2, 3, 4],
        items: ALL_ITEMS,
        goal: { kind: 'reach-exit', exit: { x: 64, y: 224 } },
        to: 71,
        grenades: [{ id: 'grenade@72,168', cx: 80, cy: 176 }],
        phase: [
            { tag: 'lavachain', x: 96, y: 32, cx: 104, cy: 40, attrs: { dir: '2' } },
            { tag: 'lavachain', x: 96, y: 48, cx: 104, cy: 56, attrs: { dir: '2' } },
            { tag: 'lavachain', x: 80, y: 80, cx: 88, cy: 88, attrs: { dir: '2' } },
        ],
        dodge: true,
        refutedBy: 'the game matches the model at 0 px through t160, past all three chains, and at t161 '
            + '`LavaRunner` #2 — at (52.8,127), directly above the player — knocks it south (`botMobiles`). '
            + 'The model steps no LavaRunner; the recording is kept as evidence (`ladder2-l75-chain-game.json`).',
        what: 'route step 162 (L75 → L71): down past three chains on one phase, then '
            + '`spinningaxe@80,144`, to `teleporter@64,224`',
    }),
    Object.freeze({
        name: 'ladder2-l103-beam',
        step: 205,
        boot: { level: 103, x: 288, y: 144 },
        keys: [0, 1, 2, 3, 4],
        items: [...ALL_ITEMS, 'hasDarkSuit'].sort(),
        goal: { kind: 'reach-exit', exit: { x: 0, y: 64 } },
        to: 104,
        grenades: [],
        phase: [
            { tag: 'beamtower', x: 208, y: 248, cx: 216, cy: 264, attrs: { direction: '2', rate: '4', speed: '0.25' } },
            { tag: 'beamtower', x: 144, y: 200, cx: 152, cy: 216, attrs: { direction: '0', rate: '2', speed: '0.5' } },
        ],
        dodge: true,
        refutedBy: 'with the beam ending at the LEVEL\'s edge (`FP.width` = 320) the solver no longer '
            + 'solves this step: a first cut ended it at 160, and the game knocked that cut\'s walk at t112 '
            + '— the refutation that found the error. Route step 205 is residue.',
        what: 'route step 205 (L103 → L104): past `beamtower@208,248` and `beamtower@144,200`, '
            + 'then `spinningaxe@112,144`, to `teleporter@0,64`',
    }),
]);

/** The solver's plan for one witness, from the survey's staging. */
export async function ladder2Plan(w) {
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
 * The walk against each class row, from the model's replay: for a grenade, the
 * update it armed and blasted and the player's distance at the blast; for a
 * chain or beam, how many observations its census volume held (what the old
 * pricing refused) and how many its exact rect touched on the update that tests
 * them (frame f tests observation f − 1 at update f − V).
 */
export async function ladder2Visit(ticks, w, gameTimeAt1) {
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const H = await import(join(MODULE, 'hazards.js'));
    const G = await import(join(MODULE, 'placedGrenade.js'));
    const { buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const world = buildLevelWorld(atlasLevelSource()(w.boot.level));
    const out = [];
    for (const gr of w.grenades) {
        const g = G.createPlacedGrenade(gr.cx, gr.cy, { id: gr.id });
        let blast = null;
        for (let f = 1; f < ticks.length && !g.removed; f += 1) {
            const o = ticks[f - 1];
            if (o.level !== w.boot.level) break;
            if (G.stepPlacedGrenade(g, o.x, o.y, { solidAt: (b) => !!world.collidesSolid(b) }) === 'blast') {
                blast = { f, dist: Math.hypot(o.x - g.x, o.y - g.endY), reaches: G.blastReaches(g, o.x, o.y) };
            }
        }
        out.push({ id: gr.id, kind: 'grenade', armedAt: g.armedAt, blast });
    }
    for (const h of w.phase) {
        const vol = H.hazardVolume(h, world.world);
        const state = h.tag === 'lavachain' ? H.createLavaChainState() : H.createBeamTower(h, world.world);
        let inside = 0;
        let hits = 0;
        for (let f = 1; f < ticks.length; f += 1) {
            const o = ticks[f - 1];
            if (o.level !== w.boot.level) break;
            const b = playerBoxAt(o.x, o.y);
            if (H.volumeHitsBox(vol, b)) inside += 1;
            const time = gameTimeAt1 + f - 1;
            const r = h.tag === 'lavachain'
                ? (H.stepLavaChain(state, time) ? H.lavaChainRect(h.cx, h.cy, h.attrs.dir) : null)
                : H.stepBeamTower(state, time);
            if (r && H.rectTouchesBox(r, b)) hits += 1;
        }
        out.push({ id: `${h.tag}@${h.x},${h.y}`, kind: h.tag, inside, hits });
    }
    return out;
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const CHECK = process.argv.includes('--check');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape, createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    const only = process.env.LADDER2_WITNESSES ? process.env.LADDER2_WITNESSES.split(',') : null;
    const REFUTED = process.argv.includes('--refuted');
    for (const w of REFUTED ? LADDER2_REFUTED : LADDER2_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const { staging, solved } = await ladder2Plan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const dodges = solved.out.trace.rows.filter((r) => r.strategy?.rung === 'dodge');
        const how = dodges.map((r) => `${r.strategy.phase ? 'PHASE' : r.strategy.axe ? 'AXE' : 'spit'} arm: `
            + (r.strategy.stall ? `stall ${r.strategy.stall.ticks} t at walk-offset ${r.strategy.stall.at}` : 'no stall')
            + (r.strategy.vias ? ` on a corridor bent through ${r.strategy.vias.map((v) => `(${v.x},${v.y})`).join(' ')}` : '')
            + (r.strategy.partial ? ` (partial: the walk then meets ${r.strategy.partial.join(', ')})` : ''))
            .join('; ') || 'no DODGE row';
        const description = `⛓⛓⛓ SEEDLING FIDELITY LADDER2 — ${w.what}. The survey's staging `
            + `(\`${AXE_BASE}\`'s committed block re-pointed at the atlas arrival, keys `
            + `[${w.keys.join(', ')}], items [${w.items.join(', ')}]). The solver's own plan: `
            + `${solved.out.perTick.length} t, equips ${JSON.stringify(solved.out.equips)}; `
            + `the DODGE rung: ${how}. Authored by scripts/procgen/plan-seedling-ladder2-witness.mjs.`;
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        check(w.dodge ? `${w.name}: the plan is the DODGE rung's PHASE arm (${how})`
            : `${w.name}: the plan needs no DODGE row — the exact pricing alone certifies it (${how})`,
        w.dodge ? dodges.some((r) => r.strategy.phase) : dodges.length === 0);
        const T1 = createRunForStaging(staging, levelSource).gameTime;
        for (const v of await ladder2Visit(out.ticks, w, T1)) {
            if (v.kind === 'grenade') {
                check(`${w.name}: the walk ARMS ${v.id} and is not inside its blast`,
                    v.armedAt !== null && (v.blast === null || !v.blast.reaches),
                    `armed on update ${v.armedAt}; ${v.blast ? `blast on frame ${v.blast.f} at ${v.blast.dist.toFixed(1)} px`
                        : 'the walk leaves before the blast'}`);
            } else {
                check(`${w.name}: the walk enters ${v.id}'s census volume and the ${v.kind === 'lavachain' ? 'arm' : 'beam'} `
                    + 'never touches it', v.inside > 0 && v.hits === 0,
                `${v.inside} observation(s) inside the volume, ${v.hits} contact(s)`);
            }
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
