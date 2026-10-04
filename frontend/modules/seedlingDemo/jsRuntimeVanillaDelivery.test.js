/**
 * ⛓ solver-walk §5.18 — THE JS RUNTIME TAKES THE VANILLA DELIVERY, AND THE
 * SOLVER DRIVES ITS REAL ROOMS (⚖ the user, 2026-10-03: "YES … WITH THE
 * SOLVER, not walker-only").
 *
 * ⛔ THE FIXTURE IS THE PRODUCTION LOAD: `loadSeedlingRandomizer` on the JS
 * transport over the shipped `seedling_playthrough` rules, map document and
 * record set (the `seedlingVanillaArmMap.test.js` arrangement), chunked by the
 * repo's one planner and delivered to the page's `botLoadLevels` — exactly
 * what `runSeedlingRandomizerLoad` hands the page. Goals are the vanilla arm's
 * own map (`realRoomPlaybackMap`), resolved as the host controller resolves
 * them.
 *
 * The split (`jsRuntimeCore.mountedKindOf`): a set whose provenance names the
 * vanilla record set it rewrote is REAL rooms — every S1–S5 arm the vanilla
 * map has; anything else keeps the GENERATED path (the J2 walker, teleporter
 * exits only). Mutants this file kills (measured, §5.18):
 *   m1 the split off — every mounted set GENERATED → the witness walks (0 solves), the pit is refused
 *   m2 an apitem location via the walker (no placement handed to the solver) → the witness's location leg
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsRuntime, MOUNTED_KINDS, mountedKindOf } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { VANILLA_RECORD_SET_ID_BASE } from './levelSetExporter.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { loadSeedlingRandomizer } from '../flashPanel/seedlingRandomizerWiring.js';
import { realRoomPlaybackMap, resolveSeedlingAtlasGoal } from '../flashPanel/seedlingPlaybackController.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const BRIDGE_CONFIG = JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties });
const MAP_DOC = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const PT = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

const locationsOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [region, r] of Object.entries(rules.regions[slot])) {
            for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
        }
    }
    return out;
};
const LOADED = await loadSeedlingRandomizer({
    flashPanel: PT.flash_panel, manifest: null, transport: 'js', rawRules: PT, locations: locationsOf(PT),
    playerId: Object.keys(PT.regions)[0], gameConfig: GAME, baseUrl: pathToFileURL(join(ROOT, 'frontend/')).href,
    fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
    importModule: (u) => import(/* @vite-ignore */ u),
});
const MAP = realRoomPlaybackMap(LOADED, PT);
const goalOf = (q) => {
    const r = resolveSeedlingAtlasGoal(q, MAP, {});
    expect(r.goal, r.refused).toBeTruthy();
    return r.goal;
};
/** The map's door from `from` to `to` (the sidecars' own exit), as the controller resolves it. */
const doorGoal = (from, to) => {
    const names = [...MAP.regions.values()].filter((p) => p.level === from)
        .flatMap((p) => (p.exits ?? []).filter((e) => e.target_level === to && e.exitName).map((e) => e.exitName));
    expect(names).toHaveLength(1);
    return goalOf({ kind: 'exit', name: names[0] });
};

/** A runtime over the vanilla map with `set` delivered (the host's chunks), started where `at` says. */
function delivered(set, at) {
    const reports = [];
    const rt = createJsRuntime({ onStateChanged: (p, v) => reports.push([p, v]) });
    expect(rt.game.configure(BRIDGE_CONFIG)).toBe('ok');
    rt.setVanilla(MAP_DOC);
    const answers = planLevelSetChunks(set).chunks.map((c) => rt.game.botLoadLevels(JSON.stringify(c)));
    expect(answers.at(-1)).toBe('ok');
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [at.level, at.x, at.y] }]);
    rt.tick();
    rt.playback.setSolverWalk(true);
    reports.length = 0;
    return { rt, reports };
}
function walk(rt, goal, { maxTicks = 3000 } = {}) {
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    const crossings = [];
    for (let t = 0; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        const out = rt.tick();
        expect(out.halted ?? null).toBeNull();
        if (out.crossing) crossings.push(out.crossing);
    }
    return crossings;
}
/** The same rooms with no provenance — a set that says nothing about its rooms. */
const unlabelled = (set) => ({ ...set, provenance: undefined });
/** The game's own new-game boot position (`Main.as:51`); the reset's explicit start sends it (skip-intro). */
const START = { level: 0, x: 80, y: 128 };

describe('§5.18 — the split: what a mounted set\'s rooms ARE, read off its own provenance', () => {
    it('the vanilla arm\'s delivered set is REAL rooms; a generated set, and a set that says nothing, are GENERATED', () => {
        expect(LOADED.verdict, LOADED.why).toBe('eligible');
        expect(LOADED.set.provenance.derived_from.set_id.startsWith(`${VANILLA_RECORD_SET_ID_BASE}-`)).toBe(true);
        expect(mountedKindOf(LOADED.set)).toBe(MOUNTED_KINDS.REAL);
        const gen = assembleGeneratedSeedlingSet(readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'),
            { selfPlayer: 1 }).set;
        expect(mountedKindOf(gen)).toBe(MOUNTED_KINDS.GENERATED);
        expect(mountedKindOf(unlabelled(LOADED.set))).toBe(MOUNTED_KINDS.GENERATED);
        expect(mountedKindOf({ provenance: { derived_from: { set_id: 'seedling-gen-x' } } })).toBe(MOUNTED_KINDS.GENERATED);
    });

    it('the page mounts all of the delivered rooms through the chunks, and reads the kind back', () => {
        const { rt } = delivered(LOADED.set, START);
        expect(JSON.parse(rt.game.botLevelSet())).toMatchObject({
            active: LOADED.set.set_id, kind: MOUNTED_KINDS.REAL, rooms: LOADED.set.rooms.length, start_level: 0, error: null,
        });
        // The skip-intro reset's explicit start boots the delivered level 0 (not the vanilla map's).
        expect(rt.run.level).toBe(0);
        expect(rt.mounted.records.get(0)).toBeDefined();
        expect(rt.events.find((e) => e.type === 'mount').message).toMatch(new RegExp(`${LOADED.set.rooms.length} real room`));
    });
});

describe('§5.18 — WITNESS: seedling_playthrough on the JS runtime, the solver driving its real rooms', () => {
    it('L0 → the starting house (L86): reach-exit SOLVED; its chest\'s APITEM: collect-placement solved as `apitem`, checked once', () => {
        const { rt, reports } = delivered(LOADED.set, START);
        const crossings = walk(rt, doorGoal(0, 86));
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(crossings).toEqual([expect.objectContaining({ from: 0, to: 86, type: 'teleporter' })]);
        let s = rt.playback.solverStats;
        expect(s).toMatchObject({ solves: 1, declines: 0, refutations: 0 });
        expect(s.lastSolve.goal.kind).toBe('reach-exit');
        expect(s.lastSolve.end.level).toBe(86);

        const entry = LOADED.entries.find((e) => e.level === 86);
        const goal = goalOf({ kind: 'location', name: entry.location });
        expect(goal).toMatchObject({ level: 86, tag: entry.tag, entityType: 'apitem' });
        walk(rt, goal);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        s = rt.playback.solverStats;
        expect(s).toMatchObject({ solves: 2, declines: 0, refutations: 0 });
        expect(s.lastSolve.goal.kind).toBe('collect-placement');
        expect(s.lastSolve.verbs).toEqual(['apitem']);
        const checks = reports.filter(([p]) => p === 'pendingCheck').map(([, v]) => v);
        expect(checks).toEqual([`1|86|${entry.tag}|0`]);
        // The host's own binding (the load's) credits it — the location the map resolved.
        const effects = LOADED.checkBinding.onStateReport('pendingCheck', checks[0]);
        expect(effects[0]).toMatchObject({ type: 'locationCheck', location: entry.location });
        expect(rt.deaths).toEqual([]);
        expect(rt.halted).toBeNull();
    });

    it('… and walks on, solver-driven, L86 → L0 → L13 → L14; the FIRST refusal is the solver\'s decline at L14 (the chaser bob)', () => {
        const { rt } = delivered(LOADED.set, START);
        for (const [from, to] of [[0, 86], [86, 0], [0, 13], [13, 14]]) {
            const before = rt.playback.solverStats.solves;
            walk(rt, doorGoal(from, to));
            expect(rt.playback.state, `${from} → ${to}`).toBe(WALK_STATES.DONE);
            expect(rt.run.level).toBe(to);
            expect(rt.playback.solverStats.solves).toBe(before + 1);
        }
        expect(rt.playback.solverStats).toMatchObject({ declines: 0, refutations: 0 });
        expect(rt.deaths).toEqual([]);
        // The next door: the solver declines BY NAME (the same decline the wasm runtime's session D met).
        expect(rt.playback.walkTo(doorGoal(14, 15))).toEqual({ ok: true });
        rt.playback.play();
        for (let t = 0; t < 400 && rt.playback.solverStats.declines === 0; t += 1) rt.tick();
        expect(rt.playback.solverStats.lastDecline).toMatch(/the combat ladder is EXHAUSTED.*chaser:bob/);
    });
});

describe('§5.18 — the real rooms keep the S4 pit arm; a GENERATED set does not', () => {
    // L48's `out_pit_2_2` (S4's bare pit witness), arrived at its payload's first entrance spawn.
    const pl = PT.preset_sidecars['1']['level_48__r2c10'].playable_payload;
    const spawn = pl.exits.find((e) => e.entrance_spawn).entrance_spawn;
    const pit = { kind: 'exit', level: 48, tiles: pl.exits.find((e) => e.exit_id === 'out_pit_2_2').exit_tiles };

    it('delivered REAL rooms: the pit exit is admitted and reach-pit is SOLVED and fallen through to L49', () => {
        const { rt } = delivered(LOADED.set, { level: 48, ...spawn });
        const crossings = walk(rt, pit);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(crossings).toEqual([{ from: 48, to: 49, type: 'pit' }]);
        expect(rt.playback.solverStats.lastSolve.goal.kind).toBe('reach-pit');
    });

    it('the SAME rooms mounted as a set that names no provenance: the generated path — no pit, the walker for a door', () => {
        const { rt } = delivered(unlabelled(LOADED.set), { level: 48, ...spawn });
        expect(rt.mounted.kind).toBe(MOUNTED_KINDS.GENERATED);
        expect(rt.playback.walkTo(pit)).toEqual({ ok: false,
            reason: `level 48 has no teleporter on tile (${pit.tiles[0][0]}, ${pit.tiles[0][1]})` });
        const { rt: rt0 } = delivered(unlabelled(LOADED.set), START);
        walk(rt0, doorGoal(0, 86));
        expect(rt0.run.level).toBe(86);
        expect(rt0.playback.solverStats.solves).toBe(0);
    });
});
