/**
 * `probe-seedling-wasm-er-retarget.mjs` — the witness's runtime arm, pinned in node.
 *
 * The probe plays ER E5's retargeted stairs on the wasm runtime or, with `--runtime=js`, on the Seedling JS
 * runtime. What makes the two arms ONE witness is that both walk the same world: the load made for either
 * transport delivers the same set, and the data-driven picker reads the same pairs off it. That is pinned here
 * over the committed preset; the played legs are the probe's own run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BOTH, RULES_PATH, RUNTIMES, armPrefix, armsOf, keyReleaseOf, pickRetargetPairs, runtimeOf } from './probe-seedling-wasm-er-retarget.mjs';
import { loadSeedlingRandomizer } from '../../frontend/modules/flashPanel/seedlingRandomizerWiring.js';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend');
const readJson = (rel) => JSON.parse(readFileSync(join(FRONTEND, rel), 'utf8'));
const PRESET = readJson(RULES_PATH);
const SLOT = Object.keys(PRESET.player_names)[0];

/** The probe's own construction of the world, for one transport. */
async function worldFor(transport) {
    const locations = new Map();
    for (const [regionName, region] of Object.entries(PRESET.regions[SLOT])) {
        for (const loc of region.locations ?? []) locations.set(loc.name, { ...loc, region: regionName });
    }
    return loadSeedlingRandomizer({
        flashPanel: PRESET.flash_panel[SLOT],
        transport,
        manifest: transport === 'js' ? null : readJson('modules/flashPanel/wasm/builds.json'),
        rawRules: PRESET,
        locations,
        playerId: SLOT,
        gameConfig: readJson('modules/flashPanel/games/seedling.json'),
        baseUrl: pathToFileURL(`${FRONTEND}/`).href,
        fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
        importModule: (u) => import(u),
    });
}
const pairNames = (world) => pickRetargetPairs(PRESET, world.entrances.moved)
    .map((p) => `${p.out.row.exit} <> ${p.back.row.exit}`);

describe('probe-seedling-wasm-er-retarget: the runtime arm', () => {
    it('--runtime= picks a listed runtime, defaults to the first, and refuses anything else', () => {
        expect(RUNTIMES).toContain('wasm');
        expect(RUNTIMES).toContain('js');
        expect(runtimeOf([])).toBe(RUNTIMES[0]);
        expect(runtimeOf(['--pairs=0'])).toBe('wasm');
        for (const runtime of RUNTIMES) expect(runtimeOf(['node', 'probe', `--runtime=${runtime}`])).toBe(runtime);
        expect(runtimeOf(['--runtime=flash'])).toBeNull();
        expect(runtimeOf(['--runtime='])).toBeNull();
    });

    it('--runtime=both plays every runtime in one invocation, the wasm session first, and names each arm on its lines', () => {
        expect(RUNTIMES).not.toContain(BOTH);
        const both = armsOf(['node', 'probe', `--runtime=${BOTH}`, '--pairs=0']);
        expect(both).toEqual([...RUNTIMES]);
        // the wasm arm prints the channel line the log is graded on: it runs first
        expect(both[0]).toBe('wasm');
        expect(both.at(-1)).toBe('js');
        // one arm alone is the invocation it always was: that runtime, and no prefix on its lines
        expect(armsOf([])).toEqual([RUNTIMES[0]]);
        for (const runtime of RUNTIMES) {
            const one = armsOf([`--runtime=${runtime}`]);
            expect(one).toEqual([runtime]);
            expect(armPrefix(one, runtime)).toBe('');
            expect(armPrefix(both, runtime)).toBe(`[${runtime}] `);
        }
        expect(new Set(both.map((runtime) => armPrefix(both, runtime))).size).toBe(both.length);
        // the single-runtime parse does not take it, and nothing else is an arm
        expect(runtimeOf([`--runtime=${BOTH}`])).toBeNull();
        expect(armsOf(['--runtime=flash'])).toBeNull();
        expect(armsOf(['--runtime='])).toBeNull();
        expect(armsOf([`--runtime=${BOTH},js`])).toBeNull();
    });

    it('the release dispatched on the door report names the arrow the way both runtimes read it', () => {
        const arrows = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
        const releases = arrows.map(keyReleaseOf);
        // the JS runtime reads `code`, the wasm build `keyCode`: both are the key's own
        for (const [i, r] of releases.entries()) expect(r).toEqual({ key: arrows[i], code: arrows[i], keyCode: 37 + i });
        expect(new Set(releases.map((r) => r.keyCode)).size).toBe(arrows.length);
        expect(keyReleaseOf('KeyX')).toBeNull();
    });

    it('both arms walk the same world: one delivered set, the same coupled pairs, every moved stairs in one', async () => {
        const [wasm, js] = await Promise.all(RUNTIMES.map(worldFor));
        expect(wasm.verdict).toBe('eligible');
        expect(js.verdict).toBe('eligible');
        expect(js.set.set_id).toBe(wasm.set.set_id);
        expect(js.entrances.moved.length).toBeGreaterThan(0);
        expect(js.entrances.moved).toEqual(wasm.entrances.moved);
        const pairs = pairNames(js);
        expect(pairs).toEqual(pairNames(wasm));
        // two legs a pair, and no moved stairs left out of the witness
        expect(pairs.length * 2).toBe(js.entrances.moved.length);
    });
});
