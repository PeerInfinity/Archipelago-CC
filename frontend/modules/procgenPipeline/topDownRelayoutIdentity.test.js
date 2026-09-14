// PIPELINE RELAYOUT R1 — a layout edit and its inverse leave a top-down world
// exactly as the seed produced it.
//
// The world is the one the defect was measured on, live (the Procgen Pipeline
// panel's defaults otherwise): the APCalc preset + its sphere log, top-down,
// seed 4, a 10×10 grid, 8×6 rooms, no substrate mix (the engine's maze). It
// holds 81 regions and 51 forward teleporter exits, 16 regions with two or more
// of them on one side. The gesture is the panel's own recorded edit through the
// top-down binding, then ④ Compile re-run — what "Move Region" + "Run 4 Compile"
// does. When `Grid.teleporters` was keyed `cell:side`, moving `Region 1`
// (4,5)→(2,0) and back re-targeted 28 forward exits on 16 regions.
//
// ⛓ PIPELINE RELAYOUT C1 — the compiled rules.json is compared as ONE STRING
// (less `procgen_metadata.edits`, which records the two edits by design). R1
// compared `preset_sidecars` record by record because a move re-inserted the
// moved region at the end of the grid's cell Map, so the key ORDER of
// `preset_sidecars[1]` moved (measured at `bf739e9df9`: move and back put
// `Region 1` last, 80 of 81 positions shifted; swap and back put `Region 1`, `C`
// last, 81 of 81). The Grid now keeps each region's place in that Map.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import '../mazeRoom/mazeRoomLibrary.js';
import { getRegionExits } from './procgenPipelineEngine.js';
import {
    buildTopDownEnvelope, runTopDownToStep, runTopDownStep, TD_EDIT_BINDING,
} from './topDownSteps.js';
import { pushLayoutEdit } from './layoutEdits.js';

const SRC = new URL(
    '../../presets/apcalc/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    import.meta.url,
);
const LOG = new URL(String(SRC).replace('_rules.json', '_sphere_log.jsonl'));

async function seedFourWorld() {
    const source = JSON.parse(readFileSync(SRC, 'utf8'));
    const sphereLog = readFileSync(LOG, 'utf8').split('\n')
        .filter((l) => l.trim()).map((l) => JSON.parse(l));
    const env = buildTopDownEnvelope({
        source, seed: 4, gridDims: { width: 10, height: 10 },
        regionSizeBase: { width: 8, height: 6 }, sphereLog,
    });
    await runTopDownToStep(env, 'compile');
    return env;
}

// Every exit of every region on the grid: target + teleporter flag.
function exitTable(env) {
    const out = new Map();
    for (const region of env.finalize.grid.allRegions()) {
        for (const [id, e] of getRegionExits(region)) {
            out.set(`${region.region_id} / ${id}`, `${e.targetRegion} ${e.isTeleporter ? 'T' : '-'}`);
        }
    }
    return out;
}

const forwardTeleporterExits = (env) => [...exitTable(env).keys()].filter((k) => {
    const [name, id] = k.split(' / ');
    const region = env.finalize.grid.allRegions().find((r) => r.region_id === name);
    const e = getRegionExits(region).get(id);
    return e.isTeleporter && !e.isBackExit;
}).length;

async function editAndRecompile(env, edit) {
    const r = pushLayoutEdit(env, edit, TD_EDIT_BINDING);
    expect(r.ok, r.error).toBe(true);
    env.compile = null;
    env.completed = 2;
    await runTopDownStep('compile', env);
}

// The whole compiled document as one string, less the edit record itself.
function documentString(rulesJson) {
    const { edits: _edits, ...metadata } = rulesJson.procgen_metadata ?? {};
    return JSON.stringify({ ...rulesJson, procgen_metadata: metadata });
}

function expectSameWorld(before, env) {
    const after = exitTable(env);
    const changed = [...before.exits].filter(([k, v]) => after.get(k) !== v)
        .map(([k, v]) => `${k}: ${v} → ${after.get(k)}`);
    expect(changed.length, `exits changed:\n${changed.join('\n')}`).toBe(0);
    const rj = env.compile.rulesJson;
    expect(JSON.stringify(rj.regions)).toBe(before.regions);
    expect(Object.keys(rj.preset_sidecars['1'])).toEqual(before.sidecarOrder);
    expect(documentString(rj)).toBe(before.document);
    expect(env.finalize.grid.teleporters.size).toBe(forwardTeleporterExits(env));
}

describe('top-down relayout: an edit and its inverse are the identity', () => {
    let before;
    beforeAll(async () => {
        const env = await seedFourWorld();
        const rj = env.compile.rulesJson;
        before = {
            exits: exitTable(env),
            regions: JSON.stringify(rj.regions),
            sidecarOrder: Object.keys(rj.preset_sidecars['1']),
            document: documentString(rj),
            forwardTeleporters: forwardTeleporterExits(env),
            tableSize: env.finalize.grid.teleporters.size,
        };
    });

    it('the never-edited world holds one teleporter entry per forward teleporter exit', () => {
        expect(before.tableSize).toBe(before.forwardTeleporters);
    });

    it('move-region (4,5)→(2,0) then back', async () => {
        const env = await seedFourWorld();
        await editAndRecompile(env, { op: 'move-region', from: { gx: 4, gy: 5 }, to: { gx: 2, gy: 0 } });
        await editAndRecompile(env, { op: 'move-region', from: { gx: 2, gy: 0 }, to: { gx: 4, gy: 5 } });
        expectSameWorld(before, env);
    });

    it('swap-regions (4,5)↔(5,5) then swap back', async () => {
        const env = await seedFourWorld();
        await editAndRecompile(env, { op: 'swap-regions', a: { gx: 4, gy: 5 }, b: { gx: 5, gy: 5 } });
        await editAndRecompile(env, { op: 'swap-regions', a: { gx: 4, gy: 5 }, b: { gx: 5, gy: 5 } });
        expectSameWorld(before, env);
    });
});
