#!/usr/bin/env node
/**
 * census-seedling-stepoff — **EVERY LATCHED ARRIVAL, SOLVED FOR THE DOOR IT
 * STANDS ON** (Seedling fidelity STEPOFF2, D4).
 *
 * A boot whose player box overlaps a door's 16x16 rect is LATCHED on it
 * (`Teleporter.check()`, `playerPhysicsV2.initialLatch`); the door fires only
 * after one update with the box off its rect. This census boots every
 * candidate fresh (`fidelityStepOff.stepOffStagingAt`: no items, or the Sword
 * with `--sword`), and for each door the boot is latched on asks `solveSegment`
 * for `reach-exit` on that door. One row per (boot, door):
 *
 *   SOLVES  <ticks> t -> L<to>, the step-off's axis and ticks
 *   REFUSES <name>  the refusal's `obstacle.kind` (`closed`, `hazard-floor`,
 *                   `inside-solid`, `danger`, …) or, when the error carries
 *                   none, the first words of its message
 *
 * ── THE BOOTS (named in the printed header) ────────────────────────────
 *   · every GAME landing: each door's `(to, playerx, playery)` in the map;
 *   · every committed Seedling preset arrival the region binding resolves
 *     (`resolveArrivalSpawn` over each preset's sidecars, as
 *     `jsRuntimeArrivalOnDoor.test.js` derives them);
 *   · `--on-doors`: a boot ON every door of the map (its own x, y) — a STAGED
 *     boot, not a landing the game makes, which is how a door no arrival
 *     lands on is asked at all (the binding's `entrance_spawn` fallback puts a
 *     player there).
 * Only latched boots are rows; the rest are counted in the header.
 *
 * ⛔ A MEASUREMENT, NOT A GATE: exit 0 whatever it finds. Node only; it
 * takes no box (no browser, no wasm). `fidelityStepOff.test.js` pins the rows
 * the slice's claims rest on.
 *
 * Run:
 *   node scripts/procgen/census-seedling-stepoff.mjs [--on-doors] [--sword] [--json=<path>]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const M = (p) => import(join(REPO, p));
    const { atlasLevelSource } = await M('frontend/modules/seedlingDemo/levelSource.js');
    const { createRunForStaging } = await M('frontend/modules/seedlingDemo/tapeRunner.js');
    const { stepOffStagingAt } = await M('frontend/modules/seedlingDemo/fidelityStepOff.js');
    const { solveSegment } = await M('frontend/modules/seedlingDemo/solverBot.js');
    const { returnSpawnTable } = await M('frontend/modules/flashPanel/seedlingReturnSpawns.js');
    const { resolveArrivalSpawn } = await M('frontend/modules/flashPanel/seedlingRegionBinding.js');

    const ON_DOORS = process.argv.includes('--on-doors');
    const SWORD = process.argv.includes('--sword');
    const JSON_OUT = process.argv.find((a) => a.startsWith('--json='))?.slice('--json='.length) ?? '';
    const SRC = atlasLevelSource();
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const RETURNS = returnSpawnTable(MAP);

    /** `level|x|y` -> the sources that boot there. */
    const boots = new Map();
    const add = (level, x, y, why) => {
        const k = `${level}|${x}|${y}`;
        if (!boots.has(k)) boots.set(k, []);
        boots.get(k).push(why);
    };
    const isLink = (e) => Number.isInteger(Number(e.attrs?.to)) && e.attrs?.playerx !== undefined;
    for (const L of MAP.levels) {
        for (const e of L.entities ?? []) {
            if (!isLink(e)) continue;
            add(Number(e.attrs.to), Number(e.attrs.playerx), Number(e.attrs.playery), `landing L${L.level}:${e.type}@${e.x},${e.y}`);
            if (ON_DOORS) add(L.level, e.x, e.y, `on-door ${e.type}`);
        }
    }
    const presets = join(REPO, 'frontend/presets');
    for (const preset of readdirSync(presets)) {
        const f = join(presets, preset, 'AP_1/AP_1_rules.json');
        if (!existsSync(f)) continue;
        const side = JSON.parse(readFileSync(f, 'utf8')).preset_sidecars?.['1'] ?? {};
        for (const [region, v] of Object.entries(side)) {
            const pl = v?.playable_payload;
            if (!pl || pl.gameId !== 'seedling' || pl.generated) continue;
            for (const ex of pl.exits ?? []) {
                const s = resolveArrivalSpawn(pl, { exit_id: ex.exit_id }, RETURNS);
                if (s) add(s.level, s.x, s.y, `preset ${preset}:${region}:${ex.exit_id}`);
            }
        }
    }

    const staging = (b) => stepOffStagingAt(b, SWORD ? ['hasSword'] : []);
    const rows = [];
    let unlatched = 0;
    let unbootable = 0;
    for (const [k, via] of [...boots].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const [level, x, y] = k.split('|').map(Number);
        let latched;
        try {
            latched = [...(createRunForStaging(staging({ level, x, y }), SRC).state.latched ?? [])];
        } catch {
            unbootable += 1;
            continue;
        }
        if (latched.length === 0) { unlatched += 1; continue; }
        for (const index of latched) {
            const run = createRunForStaging(staging({ level, x, y }), SRC);
            const tp = run.world.teleporters[index];
            const row = { boot: k, door: `${tp.isStairs ? 'stairs' : 'teleporter'}@${tp.x},${tp.y}`, to: tp.to, via: via.slice(0, 3) };
            try {
                const out = solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }],
                    name: `census-stepoff-${k}`, boot: { level, x, y } });
                const stepOff = out.records.find((r) => r.stepOff)?.stepOff ?? null;
                Object.assign(row, { verdict: 'SOLVES', ticks: out.perTick.length, level: run.level,
                    deaths: run.ledger('playerDeaths').length, stepOff,
                    verbs: out.trace.rows.map((r) => r.strategy?.verb).filter(Boolean) });
            } catch (e) {
                Object.assign(row, { verdict: 'REFUSES',
                    name: e.obstacle?.kind ?? String(e.message).replace(/\s+/g, ' ').slice(0, 60),
                    why: String(e.message).replace(/\s+/g, ' ').slice(0, 400) });
            }
            rows.push(row);
        }
    }

    console.log(`census-seedling-stepoff — ${boots.size} boots (game landings + preset arrivals`
        + `${ON_DOORS ? ' + one ON every door' : ''}), items: ${SWORD ? 'the Sword' : 'none'}; `
        + `${rows.length} latched (boot, door) rows; ${unlatched} boots not latched, ${unbootable} unbootable`);
    for (const r of rows) {
        console.log(`${r.boot.padEnd(14)} ${r.door.padEnd(20)} -> L${String(r.to).padEnd(4)} `
            + (r.verdict === 'SOLVES'
                ? `SOLVES ${r.ticks} t${r.stepOff ? ` (step-off ${r.stepOff.dir ?? 'to a cell'} ${r.stepOff.ticks} t)` : ''}`
                    + `${r.deaths ? ` DEATHS ${r.deaths}` : ''} [${r.verbs.join(',')}]`
                : `REFUSES ${r.name}`));
    }
    const tally = {};
    for (const r of rows) {
        const key = r.verdict === 'SOLVES' ? 'SOLVES' : `REFUSES ${r.name}`;
        tally[key] = (tally[key] ?? 0) + 1;
    }
    const solved = rows.filter((r) => r.verdict === 'SOLVES').map((r) => r.ticks);
    console.log(`TALLY ${JSON.stringify(tally)}`);
    if (solved.length) {
        console.log(`TICKS solved: mean ${(solved.reduce((a, b) => a + b, 0) / solved.length).toFixed(1)}, `
            + `max ${Math.max(...solved)}`);
    }
    if (JSON_OUT) {
        writeFileSync(JSON_OUT, `${JSON.stringify(rows, null, 1)}\n`);
        console.log(`WROTE ${JSON_OUT}`);
    }
}
