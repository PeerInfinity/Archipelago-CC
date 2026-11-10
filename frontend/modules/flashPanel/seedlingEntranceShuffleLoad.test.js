/**
 * ER E5 IN THE LEVEL DATA — the randomized LOAD of an entrance-randomized world, in node with the fetch and the
 * importer injected (`seedlingRandomizerWiring.js`). The mapping's own rows are `seedlingDemo/
 * entranceRetarget.test.js`; these rows are about WHERE it runs and what every arm does with such a world:
 *
 *   vanilla arm    `seedling_er`: the delivered set is the AP-rewritten set with the moved stairs retargeted;
 *                  a world that places no entrance is delivered exactly as before;
 *   atlas arm      a world of real rooms that places entrances is DELIVERED retargeted (this arm otherwise
 *                  only binds the game's own vanilla rooms), or refused by name when it cannot be;
 *   generated arm  refused by name;
 *   the load       a refused delivery of a shuffled world says so on the sticky overlay;
 *   the panel      `entranceShuffleRefusal` is the sentence every non-delivering path of a shuffled world shows.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { rewriteRecordSet } from '../seedlingDemo/apPlacementRewriter.js';
import { exitsOfRecordSet, planEntranceRetarget } from '../seedlingDemo/entranceRetarget.js';
import { vanillaRecordSet } from '../seedlingDemo/levelSetExporter.js';
import {
    ENTRANCE_SHUFFLE_NOT_PLAYABLE, RANDOMIZER_ARMS, entranceShufflePlaces, entranceShuffleRefusal,
} from './seedlingRandomizerEligibility.js';
import {
    AP_ASSET_PATHS, AP_MODULE_PATHS, loadSeedlingAtlas, loadSeedlingGenerated, loadSeedlingRandomizer,
    runSeedlingRandomizerLoad,
} from './seedlingRandomizerWiring.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const BASE = pathToFileURL(join(ROOT, 'frontend/')).href;
const MANIFEST = readJson('frontend/modules/flashPanel/wasm/builds.json');
const GAME_CONFIG = readJson('frontend/modules/flashPanel/games/seedling.json');
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const EMBED = readJson(`frontend/${AP_ASSET_PATHS.recordSet}`);
const rulesOf = (id) => readJson(`frontend/presets/${id}/AP_1/AP_1_rules.json`);
const SLOT = '1';

const locationsMapOf = (rules) => {
    const out = new Map();
    for (const [regionName, region] of Object.entries(rules.regions[SLOT])) {
        for (const loc of region.locations ?? []) out.set(loc.name, { ...loc, region: regionName });
    }
    return out;
};
const diskFetch = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));
const load = (rules, over = {}) => {
    const logs = [];
    return loadSeedlingRandomizer({
        flashPanel: rules.flash_panel[SLOT],
        manifest: MANIFEST,
        rawRules: rules,
        locations: locationsMapOf(rules),
        playerId: SLOT,
        gameConfig: GAME_CONFIG,
        baseUrl: BASE,
        fetchJson: diskFetch,
        importModule: (u) => import(/* @vite-ignore */ u),
        log: (m, cls) => logs.push([m, cls ?? null]),
        ...over,
    }).then((r) => ({ r, logs }));
};
const exitsOf = (set) => exitsOfRecordSet(set).exits;
const { set: VANILLA } = vanillaRecordSet(EMBED, MAP);

describe('the vanilla arm delivers an entrance-randomized world RETARGETED', () => {
    const ER = rulesOf('seedling_er');

    it('seedling_er: eligible, the armed delivery\'s set is the item rewrite WITH the moved stairs retargeted', async () => {
        const { r, logs } = await load(ER);
        expect(r.verdict, r.why).toBe('eligible');
        expect(r.eligibility.arm).toBe(RANDOMIZER_ARMS.VANILLA);
        expect(r.delivery.state).toBe('armed');
        // the plan, made independently over the item-rewritten set
        const placed = rewriteRecordSet(VANILLA, r.table).set;
        const plan = planEntranceRetarget({ rules: ER, slot: SLOT, set: placed });
        expect(plan.moved.length).toBeGreaterThan(0);
        expect(r.entrances.retargeted).toBe(plan.moved.length);
        expect(r.entrances.moved.map((m) => m.exit)).toEqual(plan.moved.map((m) => m.exit));
        const delivered = new Map(exitsOf(r.set).map((ex) => [`${ex.level}|${ex.index}`, ex]));
        for (const m of plan.moved) {
            const ex = delivered.get(`${m.level}|${m.index}`);
            expect([ex.to, ex.playerx, ex.playery, ex.sign], m.exit).toEqual([m.to.to, m.to.playerx, m.to.playery, m.to.sign]);
        }
        // ... and nothing else of the exits moved
        const planned = new Set(plan.moved.map((m) => `${m.level}|${m.index}`));
        const before = new Map(exitsOf(placed).map((ex) => [`${ex.level}|${ex.index}`, ex]));
        for (const [key, ex] of delivered) if (!planned.has(key)) expect(ex, key).toEqual(before.get(key));
        // the items are still placed, the companion names THIS set, and the load said what it did
        expect(r.replaced).toBeGreaterThan(0);
        expect(r.set.rooms.flatMap((room) => room.source.record.entities).filter((e) => e.type === 'apitem')).toHaveLength(r.replaced);
        expect(r.invalidation.set_id).toBe(r.set.set_id);
        expect(r.set.set_id).not.toBe(placed.set_id);
        expect(logs.some(([m]) => m.startsWith(`[entrance shuffle] ${plan.moved.length} stairs exit(s)`))).toBe(true);
    });

    it('a world that places no entrance is delivered exactly as before: the rewriter\'s own set, no log line', async () => {
        const rules = rulesOf('seedling_playthrough');
        const { r, logs } = await load(rules);
        expect(r.verdict, r.why).toBe('eligible');
        expect(r.entrances).toBe(null);
        expect(r.set.set_id).toBe(rewriteRecordSet(VANILLA, r.table).set.set_id);
        expect(logs.filter(([m]) => m.includes('entrance shuffle'))).toEqual([]);
    });

    it('the retarget module is reached through the injected importer, like every heavy module', async () => {
        const seen = [];
        await load(rulesOf('seedling_playthrough'), { importModule: (u) => { seen.push(u); return import(/* @vite-ignore */ u); } });
        expect(seen.some((u) => u.endsWith(AP_MODULE_PATHS.entrances))).toBe(true);
    });

    it('a plan that cannot be made THROWS by name (the panel refuses the load with it): nothing half-shuffled is delivered', async () => {
        const rules = structuredClone(ER);
        rules.entrance_randomization[SLOT].placements.push({ exit: 'nowhere -> nothing', target: 'nothing -> nowhere' });
        await expect(load(rules)).rejects.toThrow(/nowhere -> nothing.*names no departure/);
    });

    it('the JS runtime takes the same delivery (transport js): the retargeted set', async () => {
        const wasm = (await load(ER)).r;
        const { r } = await load(ER, { transport: 'js', manifest: null });
        expect(r.verdict, r.why).toBe('eligible');
        expect(r.eligibility.arm).toBe(RANDOMIZER_ARMS.VANILLA);
        expect(r.entrances.retargeted).toBe(wasm.entrances.retargeted);
        expect(r.set.set_id).toBe(wasm.set.set_id);
    });
});

describe('the atlas arm: a world of real rooms that places entrances', () => {
    /** `seedling_atlas` with an entrance block over its own stairs; `move` re-points the placed stairs' sidecar. */
    const shuffledAtlas = ({ move }) => {
        const rules = rulesOf('seedling_atlas');
        const departures = Object.entries(rules.preset_sidecars[SLOT]).flatMap(([region, s]) => (s.playable_payload?.exits ?? [])
            .filter((e) => e.exitName && e.targetRegion).map((exit) => ({ region, level: s.playable_payload.level, exit })));
        const rows = exitsOf(VANILLA);
        // a departure that is a STAIRS of the vanilla set (found by its tile: this atlas names its doors by hand)
        const rowOf = ({ level, exit }) => rows.find((ex) => ex.level === level && ex.element !== 'teleporter'
            && (exit.exit_tiles ?? []).some(([tx, ty]) => tx === Math.floor(ex.x / MAP.tile_size) && ty === Math.floor(ex.y / MAP.tile_size)));
        const stairs = departures.find(rowOf);
        // this hand-authored atlas spells its own arrival spawns; a DERIVED one (the kind a shuffle is made over)
        // states the game's, so the sidecar is first put on the room's own data
        const own = rowOf(stairs);
        stairs.exit.target_level = own.to;
        stairs.exit.target_spawn = { x: own.playerx, y: own.playery };
        rules.entrance_randomization = { [SLOT]: { algorithm: 'test', coupled: true, seed: 0,
            placements: [{ exit: stairs.exit.exitName, target: stairs.exit.exitName }] } };
        if (move) {
            // re-point it at another vanilla stairs' landing, in another room
            const other = rows.find((ex) => ex.element !== 'teleporter' && ex.to !== stairs.exit.target_level && ex.to !== stairs.level);
            stairs.exit.target_level = other.to;
            stairs.exit.target_spawn = { x: other.playerx, y: other.playery };
            return { rules, stairs, other };
        }
        return { rules, stairs, other: null };
    };

    it('a moved stairs: the vanilla record set is DELIVERED with it retargeted (this arm otherwise delivers nothing)', async () => {
        const { rules, stairs, other } = shuffledAtlas({ move: true });
        const { r, logs } = await load(rules);
        expect(r.verdict, r.why).toBe('eligible');
        expect(r.arm).toBe(RANDOMIZER_ARMS.ATLAS);
        expect(r.delivery?.state).toBe('armed');
        expect(r.entrances.retargeted).toBe(1);
        const [m] = r.entrances.moved;
        expect(m.exit).toBe(stairs.exit.exitName);
        const ex = exitsOf(r.set).find((e) => e.level === m.level && e.index === m.index);
        expect([ex.to, ex.playerx, ex.playery]).toEqual([other.to, other.playerx, other.playery]);
        expect(r.invalidation.set_id).toBe(r.set.set_id);
        expect(logs.some(([msg]) => msg.startsWith('[entrance shuffle] atlas arm: 1 stairs exit(s)'))).toBe(true);
    });

    it('an identity shuffle changes no room: nothing delivered, the arm as it was', async () => {
        const { rules } = shuffledAtlas({ move: false });
        const { r } = await load(rules);
        expect(r.verdict, r.why).toBe('eligible');
        expect(r).toMatchObject({ arm: RANDOMIZER_ARMS.ATLAS, delivery: null, set: null });
        expect(r.entrances).toMatchObject({ retargeted: 0, moved: [] });
    });

    it('REFUSED BY NAME when the rooms cannot be delivered (no record set handed in): never bound over vanilla stairs', async () => {
        const { rules } = shuffledAtlas({ move: true });
        const r = await loadSeedlingAtlas({ eligibility: { eligible: true, arm: RANDOMIZER_ARMS.ATLAS }, rawRules: rules,
            locations: locationsMapOf(rules), playerId: SLOT, gameConfig: GAME_CONFIG, mapDoc: MAP, baseUrl: BASE,
            fetchJson: diskFetch, importModule: (u) => import(/* @vite-ignore */ u),
            modules: { rewriter: await import('../seedlingDemo/apPlacementRewriter.js'),
                derivation: await import('../seedlingDemo/seedlingAtlasDerivation.js') } });
        expect(r).toMatchObject({ verdict: 'ineligible', checkBinding: null, delivery: null });
        expect(r.why).toMatch(/^atlas: these rules place entrances \(entrance randomization\)/);
    });
});

describe('the generated arm refuses a world that places entrances, by name', () => {
    it('before anything is assembled', async () => {
        const rules = rulesOf('seedling_generated_room');
        const args = { flashPanel: rules.flash_panel[SLOT], manifest: MANIFEST, rawRules: rules, locations: locationsMapOf(rules),
            playerId: SLOT, baseUrl: BASE, importModule: (u) => import(/* @vite-ignore */ u) };
        const plain = await loadSeedlingGenerated(args);
        expect(plain.verdict, plain.why).toBe('eligible');
        const shuffled = structuredClone(rules);
        shuffled.entrance_randomization = { [SLOT]: { placements: [{ exit: 'a -> b', target: 'b -> a' }] } };
        const imports = [];
        const r = await loadSeedlingGenerated({ ...args, rawRules: shuffled,
            importModule: (u) => { imports.push(u); return import(/* @vite-ignore */ u); } });
        expect(r).toMatchObject({ verdict: 'ineligible', arm: RANDOMIZER_ARMS.GENERATED, delivery: null, set: null });
        expect(r.why).toMatch(/^generated: these rules place entrances \(entrance randomization\)/);
        expect(imports).toEqual([]);
    });
});

describe('the sentence a shuffled world left on vanilla rooms is told', () => {
    const ER = rulesOf('seedling_er');

    it('`entranceShufflePlaces` reads the slot\'s placements, and nothing else', () => {
        expect(entranceShufflePlaces(ER, SLOT)).toBe(true);
        expect(entranceShufflePlaces(ER, Number(SLOT))).toBe(true);
        expect(entranceShufflePlaces(ER, '2')).toBe(false);
        expect(entranceShufflePlaces(rulesOf('seedling_playthrough'), SLOT)).toBe(false);
        expect(entranceShufflePlaces({ entrance_randomization: { [SLOT]: { placements: [] } } }, SLOT)).toBe(false);
        expect(entranceShufflePlaces(null, SLOT)).toBe(false);
    });

    it('`entranceShuffleRefusal` names the randomization and the reason; null for an unshuffled world', () => {
        const why = 'capability: the build does not declare `apitem`';
        const refusal = entranceShuffleRefusal(ER, SLOT, why);
        expect(refusal.startsWith(ENTRANCE_SHUFFLE_NOT_PLAYABLE)).toBe(true);
        expect(refusal).toContain(why);
        expect(ENTRANCE_SHUFFLE_NOT_PLAYABLE).toMatch(/^ENTRANCE RANDOMIZATION/);
        expect(entranceShuffleRefusal(rulesOf('seedling_playthrough'), SLOT, why)).toBe(null);
    });

    it('every ineligible load of the shuffled world still carries a reason for that sentence (a build without the capability)', async () => {
        const lacking = MANIFEST.builds.filter((b) => !(b.capabilities ?? []).includes('bossreport') || !(b.capabilities ?? []).includes('apitem'));
        expect(lacking.length).toBeGreaterThan(0);
        for (const build of lacking) {
            // eslint-disable-next-line no-await-in-loop
            const { r } = await load(ER, { flashPanel: { ...ER.flash_panel[SLOT], wasm: `${build.name}/game.html` } });
            expect(r.verdict, build.name).toBe('ineligible');
            expect(r.delivery, build.name).toBe(null);
            expect(entranceShuffleRefusal(ER, SLOT, r.why), build.name).toContain(r.why);
        }
    });

    it('a REFUSED delivery of a shuffled world says so on the sticky overlay; an unshuffled one says what it always said', async () => {
        const run = async (entrances) => {
            const overlay = { text: null, cls: null, show() {}, hide() { this.hidden = true; },
                setText(t, c) { this.text = t; this.cls = c ?? null; } };
            const glue = { setDelivery() {}, setCheckBinding() { this.bound = true; }, holdPositionWatch() {}, releasePositionWatch() {} };
            const loaded = { tileSize: 16, set: { rooms: [], start: { level: 0 } }, checkBinding: {}, replaced: 0, entrances,
                delivery: { attachBot() {}, deliver: () => ({ ok: false, chunks: 0, why: 'botLoadLevels answered "error:x"' }) } };
            const r = await runSeedlingRandomizerLoad({ loaded, glue, overlay, teleport: () => {}, bot: () => '{}',
                waitFrame: async () => {}, sleep: async () => {} });
            return { r, overlay, glue };
        };
        const shuffled = await run({ retargeted: 3, moved: [], unmoved: [] });
        expect(shuffled.r.ok).toBe(false);
        expect(shuffled.overlay.cls).toBe('error');
        expect(shuffled.overlay.text).toContain(ENTRANCE_SHUFFLE_NOT_PLAYABLE);
        expect(shuffled.overlay.hidden).toBeUndefined();
        expect(shuffled.glue.bound).toBeUndefined();
        const plain = await run(null);
        expect(plain.overlay.text).toMatch(/vanilla rooms\.$/);
        expect(plain.overlay.text).not.toContain('ENTRANCE RANDOMIZATION');
    });
});
