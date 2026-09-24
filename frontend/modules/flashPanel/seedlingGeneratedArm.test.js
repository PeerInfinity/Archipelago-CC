/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G2 task 2 — **THE FIFTH FACT AND THE GENERATED
 * ARM**, in node with the importer injected. The world is G1's headless spiral
 * (`SEEDLING_GENERATED_ROOM_STATE`); the vanilla fixtures are the three shipped
 * presets. The vanilla arm's own rows live in `seedlingRandomizerWiring.test.js`
 * and `seedlingRandomizerEligibility.test.js`, unmoved.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import { generatedRoomCensus } from '../seedlingDemo/seedlingGenRoomPayload.js';
import { assembleGeneratedSeedlingSet } from '../seedlingDemo/seedlingGeneratedSet.js';
import {
    AP_ITEM_CAPABILITY, DIVERTING_CHECK_IDS, ELIGIBILITY_CHECK_IDS, RANDOMIZER_ARMS,
    seedlingRandomizerEligibility,
} from './seedlingRandomizerEligibility.js';
import {
    AP_GENERATED_MODULE_PATHS, loadSeedlingGenerated, loadSeedlingRandomizer, runSeedlingRandomizerLoad,
} from './seedlingRandomizerWiring.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const BASE = pathToFileURL(join(ROOT, 'frontend/')).href;
const MANIFEST = readJson('frontend/modules/flashPanel/wasm/builds.json');
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const VANILLA = {
    seedling: readJson('frontend/presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json'),
    seedling_atlas: readJson('frontend/presets/seedling_atlas/AP_1/AP_1_rules.json'),
    seedling_playthrough: readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'),
};
const REAL_ROOM = readJson('frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json');

/** `getStaticData().locations`, built by the production rule (as the vanilla wiring rows do). */
const locationsMapOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [regionName, region] of Object.entries(rules.regions[slot])) {
            for (const loc of region.locations ?? []) out.set(loc.name, { ...loc, region: regionName });
        }
    }
    return out;
};

const WASM = { cheap: {
    flashPanel: { config: 'seedling.json', wasm: 'seedling_bot_ap_p4d/game.html' },
    transport: 'wasm',
    manifest: { builds: [{ name: 'seedling_bot_ap_p4d', capabilities: [AP_ITEM_CAPABILITY] }] },
} };
const ROOMS = { rooms: ['region_0_0', 'region_0_1'], mixed: [] };

describe('the fifth fact — `generated`, a DIVERTING check', () => {
    it('is declared between the capability and the placement, and is the only diverting one', () => {
        expect(ELIGIBILITY_CHECK_IDS).toEqual(['transport', 'capability', 'generated', 'placement', 'assets']);
        expect(DIVERTING_CHECK_IDS).toEqual(['generated']);
    });

    it('generated rooms DECIDE the verdict at the CHEAP call: eligible, the generated arm, the rest skipped', () => {
        const v = seedlingRandomizerEligibility({ ...WASM.cheap, generated: ROOMS });
        expect(v).toMatchObject({ eligible: true, verdict: 'eligible', arm: RANDOMIZER_ARMS.GENERATED, failed: null });
        expect(v.checks.map((c) => [c.id, c.status])).toEqual([
            ['transport', 'pass'], ['capability', 'pass'], ['generated', 'divert'],
            ['placement', 'skipped'], ['assets', 'skipped']]);
        expect(v.why).toMatch(/^transport: .* · capability: .* · generated: the rules carry 2 generated Seedling room\(s\) \(region_0_0, region_0_1\)/);
        expect(v.why).not.toMatch(/placement: |assets: /);
    });

    it('no generated room (or no census) PASSES and the vanilla facts decide, on the vanilla arm', () => {
        const none = seedlingRandomizerEligibility({ ...WASM.cheap, generated: { rooms: [], mixed: [] } });
        expect(none).toMatchObject({ verdict: 'undecided', arm: null });
        expect(none.why).toMatch(/^placement: /);
        const full = seedlingRandomizerEligibility({ ...WASM.cheap, generated: { rooms: [], mixed: [] },
            placement: { resolved: 41, total: 41 },
            assets: { recordSet: { url: '/a', ok: true }, map: { url: '/b', ok: true, source: 'x' } } });
        expect(full).toMatchObject({ verdict: 'eligible', arm: RANDOMIZER_ARMS.VANILLA });
        expect(full.checks.find((c) => c.id === 'generated').why).toBe('the rules carry no generated Seedling rooms');
    });

    it('a MIXED world is refused BY NAME at the generated check', () => {
        const v = seedlingRandomizerEligibility({ ...WASM.cheap, generated: { rooms: ['a'], mixed: ['r'] } });
        expect(v).toMatchObject({ verdict: 'ineligible', failed: 'generated', arm: null });
        expect(v.why).toMatch(/^generated: the rules carry 1 generated Seedling room\(s\) \(a\) AND 1 real one\(s\) \(r\) — a mixed world is not delivered yet/);
    });

    it('the cheap facts still gate the generated arm: a flash transport fails, an unread manifest is undecided', () => {
        expect(seedlingRandomizerEligibility({ ...WASM.cheap, transport: 'flash', generated: ROOMS }).failed)
            .toBe('transport');
        const u = seedlingRandomizerEligibility({ ...WASM.cheap, manifest: undefined, generated: ROOMS });
        expect(u).toMatchObject({ verdict: 'undecided', arm: null });
        expect(u.why).toMatch(/^capability: /);
    });

    it('the census: the three vanilla presets and the real-room spiral carry NO generated room', () => {
        for (const [name, rules] of Object.entries({ ...VANILLA, seedling_spiral_room: REAL_ROOM })) {
            expect(generatedRoomCensus(rules), name).toMatchObject({ rooms: [], mixed: [] });
        }
    });
});

describe('loadSeedlingGenerated over the headless spiral world', () => {
    let rules;
    beforeAll(async () => {
        for (const rel of REGISTRY_LIBRARIES) {
            // eslint-disable-next-line no-await-in-loop
            await import(join(ROOT, rel));
        }
        ({ rulesJson: rules } = await runPresetHeadless(buildRunFromState(structuredClone(SEEDLING_GENERATED_ROOM_STATE))));
    }, 60000);
    afterEach(() => { vi.unstubAllGlobals(); });

    const load = (over = {}) => loadSeedlingGenerated({
        flashPanel: rules.flash_panel,
        manifest: MANIFEST,
        rawRules: rules,
        locations: locationsMapOf(rules),
        playerId: '1',
        baseUrl: BASE,
        importModule: (u) => import(/* @vite-ignore */ u),
        ...over,
    });

    it('the census names the world\'s two generated rooms', () => {
        expect(generatedRoomCensus(rules)).toEqual({ ...ROOMS, gameIds: ['seedling'] });
    });

    it('imports ONLY its own modules, by the computed specifier, and fetches NOTHING', async () => {
        const seen = [];
        vi.stubGlobal('fetch', () => { throw new Error('the generated arm fetched'); });
        const r = await load({ importModule: (u) => { seen.push(u); return import(/* @vite-ignore */ u); } });
        expect(r.verdict, r.why).toBe('eligible');
        expect(seen.map((u) => u.slice(BASE.length)).sort())
            .toEqual(Object.values(AP_GENERATED_MODULE_PATHS).sort());
    });

    it('returns loadSeedlingRandomizer\'s SHAPE — every key the vanilla arm returns', async () => {
        const vanilla = await loadSeedlingRandomizer({
            flashPanel: VANILLA.seedling_playthrough.flash_panel, manifest: MANIFEST,
            rawRules: VANILLA.seedling_playthrough, locations: locationsMapOf(VANILLA.seedling_playthrough),
            playerId: '1', gameConfig: GAME_CONFIG, baseUrl: BASE,
            fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
            importModule: (u) => import(/* @vite-ignore */ u),
        });
        expect(vanilla.verdict, vanilla.why).toBe('eligible');
        const r = await load();
        const missing = Object.keys(vanilla).filter((k) => !(k in r));
        expect(missing.filter((k) => !['entries', 'encounters'].includes(k))).toEqual([]);
        expect(r).toMatchObject({ arm: RANDOMIZER_ARMS.GENERATED, selfPlayer: 1, tileSize: 16, replaced: 1 });
    });

    it('the set, the table and the delivery ARE the assembler\'s over the same rules and join', async () => {
        const r = await load();
        const byName = locationsMapOf(rules);
        const want = assembleGeneratedSeedlingSet(rules, {
            locationItemOf: (n) => ({ name: byName.get(n).item.name, player: byName.get(n).item.player }),
            selfPlayer: 1 });
        expect(JSON.stringify(r.set)).toBe(JSON.stringify(want.set));
        expect([...r.table]).toEqual([...want.table]);
        expect(r.delivery.state).toBe('armed');
        expect(r.delivery.set).toBe(r.set);
        expect(r.invalidation).toEqual(want.invalidation);
        expect(r.census).toMatchObject({ rooms: 2, apitems: 1, unjoined: [], parkingLevel: 2 });
    });

    it('the check binding turns the goal cell\'s pendingCheck into the AP check and "found key_blue for you"', async () => {
        const r = await load();
        const [key, entry] = [...r.table][0];
        const [level, tag] = key.split('|');
        const fx = r.checkBinding.onStateReport('pendingCheck', `1|${level}|${tag}|0`);
        expect(fx).toEqual([
            { type: 'locationCheck', location: 'region_0_0__key_blue_pickup', ledgerId: 'region_0_0__key_blue_pickup',
                level: 0, tag: entry.tag },
            { type: 'apItemFound', location: 'region_0_0__key_blue_pickup', item: 'key_blue', player: 1,
                forSelf: true, look: 'ap', ledgerId: 'region_0_0__key_blue_pickup' }]);
        expect([...r.checkBinding.hostOwnedLocations()]).toEqual(['region_0_0__key_blue_pickup']);
    });

    it('runSeedlingRandomizerLoad runs it UNCHANGED: deliver, then the EXPLICIT start on room 0\'s first approach', async () => {
        const r = await load();
        const order = [];
        const sent = [];
        const bot = (name, arg) => {
            if (name === 'botLoadLevels') { sent.push(arg); const c = JSON.parse(arg); return c.chunk_index === c.chunk_count - 1 ? 'ok' : 'pending'; }
            if (name === 'botLevelSet') {
                return JSON.stringify({ active: r.set.set_id, table_levels: r.set.rooms.length, start_level: 0 });
            }
            if (name === 'botStatus') return '{"level":0}';
            return '{"mobiles":[{"cls":"Player","x":136,"y":40}]}';
        };
        const teleports = [];
        const overlay = { show() {}, hide() {}, setText() {}, remove() {} };
        const glue = { binding: null, setDelivery: (d) => { order.push('setDelivery'); glue.d = d; },
            setCheckBinding: (b) => { order.push('setCheckBinding'); glue.b = b; } };
        const out = await runSeedlingRandomizerLoad({ loaded: r, glue, overlay, bot,
            teleport: (t) => { order.push('teleport'); teleports.push(t); },
            waitFrame: async () => {}, sleep: async () => {} });
        expect(out.ok, out.why).toBe(true);
        expect(out.delivered).toMatchObject({ ok: true, chunks: sent.length });
        const first = rules.preset_sidecars['1'].region_0_0.playable_payload.exits[0].entrance_spawn;
        expect(teleports).toEqual([{ level: 0, x: first.x, y: first.y }]);
        expect(out.reset).toMatchObject({ mode: 'explicit-start', landed: true });
        expect(order).toEqual(['setDelivery', 'teleport', 'setCheckBinding']);
        expect(glue.b).toBe(r.checkBinding);
    });

    it('REFUSES a vanilla world, a mixed world and a blank slot — by name, with nothing armed', async () => {
        const vanilla = await load({ rawRules: VANILLA.seedling_playthrough });
        expect(vanilla).toMatchObject({ verdict: 'ineligible', delivery: null, set: null });
        expect(vanilla.why).toMatch(/^generated: the rules carry no generated Seedling rooms/);

        const mixed = structuredClone(rules);
        mixed.preset_sidecars['1'].real = REAL_ROOM.preset_sidecars['1'].region_0_0;
        const m = await load({ rawRules: mixed });
        expect(m).toMatchObject({ verdict: 'ineligible', delivery: null });
        expect(m.why).toMatch(/^generated: .* AND 1 real one\(s\) \(real\)/);

        const blank = await load({ playerId: '' });
        expect(blank).toMatchObject({ verdict: 'ineligible', delivery: null });
        expect(blank.why).toMatch(/not an integer player id/);
    });
});
