/**
 * ⛓⛓ LOGICAL SUB-REGION LINKS (walk plan §5.17; ⚖ the user, 2026-10-03: the controller and the region
 * binding learn a region move INSIDE a level).
 *
 * ⛔ THE FIXTURE IS THE SHIPPED DATA: the playthrough's and the starter atlas's rules, and the committed
 * partition (`atlases/seedling-subregion-partition.json`). Tiles and links are read off them, never typed,
 * except the ONE route this slice is about (`level_0__r8c0 -> level_0__r1c6`, the Sword's), named.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SeedlingRegionBinding } from './seedlingRegionBinding.js';
import { SeedlingRegionGlue } from './seedlingRegionGlue.js';
import {
    LINK_CREDIT_REFUSAL, SUB_REGION_LINK_REFUSAL, SeedlingPlaybackController, realRoomLinks, resolveSeedlingAtlasGoal,
} from './seedlingPlaybackController.js';
import { NO_PARTITION, buildSubRegionMap, linkPath, subRegionAt } from './seedlingSubRegions.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const PARTITION = readJson('./atlases/seedling-subregion-partition.json');
const PT = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const STARTER = readJson('../../presets/seedling_atlas/AP_1/AP_1_rules.json');
const { map: MAP } = buildSubRegionMap({ rules: PT, partition: PARTITION });
const SIDECARS = PT.preset_sidecars['1'];
const world = (region) => SIDECARS[region].playable_payload;
const TS = MAP.tileSize;

/** The Sword's route opens with this link (plan §5.16 D). */
const SWORD_LINK = 'level_0__r8c0 -> level_0__r1c6';

/** A gate that evaluates the rule against `inv` (True_/Has/Or/And), the door gate's verdict shape. */
const evalRule = (rule, inv) => {
    if (!rule || rule.rule === 'True_') return true;
    if (rule.rule === 'Has') return (inv[rule.args.item_name] ?? 0) >= (rule.args.count ?? 1);
    if (rule.rule === 'Or') return rule.children.some((c) => evalRule(c, inv));
    if (rule.rule === 'And') return rule.children.every((c) => evalRule(c, inv));
    throw new Error(`rule ${rule.rule} not modelled by the test gate`);
};
const gate = (inv) => (exit) => ({ pass: evalRule(exit.access_rule, inv), gated: true, needs: [], missing: [] });

/** Every tile centre of `region`'s sub-region in the partition (pixels), in row order. */
function tilesOf(region) {
    const [parent, sub] = region.split('__');
    const e = MAP.levels.get(world(region).level).find((x) => x.region === parent);
    const ch = MAP.alphabet[e.subs.indexOf(sub)];
    const out = [];
    e.rows.forEach((row, y) => [...row].forEach((c, x) => {
        if (c === ch) out.push({ x: (x + e.origin[0]) * TS + TS / 2, y: (y + e.origin[1]) * TS + TS / 2 });
    }));
    return out;
}
/** A tile centre of `level` in NO sub-region ('.'). */
function seamOf(level) {
    const e = MAP.levels.get(level)[0];
    const y = e.rows.findIndex((r) => r.includes('.'));
    return { x: (e.rows[y].indexOf('.') + e.origin[0]) * TS + TS / 2, y: (y + e.origin[1]) * TS + TS / 2 };
}

let clock = 0;
/** A binding standing in `region` (loaded, booted, the arrival landed), with the playthrough's map. */
function standing(region, inv = {}) {
    const b = new SeedlingRegionBinding({ now: () => clock, canPass: gate(inv) });
    b.setSubRegions(MAP);
    b.onStateReport('level', world(region).level);
    b.onLoadRegion({ region_id: region, world: world(region) });
    return b;
}
const moves = (effects) => effects.filter((e) => e.type === 'regionMove');
const walk = (b, points) => points.flatMap((p) => b.onPlayerPosition({ level: b.lastLevel, ...p }));

describe('the sub-region map is DERIVED from the rules and the committed partition', () => {
    it('the playthrough: every partitioned sub-region is a rules region, and the links are the controller\'s', () => {
        expect(MAP).not.toBeNull();
        expect(MAP.atlasId).toBe(PT.region_atlas.atlas_id);
        const regions = new Map(Object.entries(SIDECARS).filter(([, s]) => s.substrate === 'flash_seedling')
            .map(([r, s]) => [r, s.playable_payload]));
        const fromController = realRoomLinks(PT, regions);
        expect([...MAP.links.values()].flat().map((l) => l.name).sort()).toEqual(fromController.map((l) => l.name).sort());
        for (const entries of MAP.levels.values()) {
            for (const e of entries) for (const s of e.subs) if (s) expect(SIDECARS[`${e.region}__${s}`]).toBeTruthy();
        }
        // Every sub-region region of the rules has tiles in the partition.
        const subRegions = Object.keys(SIDECARS).filter((r) => r.includes('__') && SIDECARS[r].substrate === 'flash_seedling');
        for (const r of subRegions) expect(tilesOf(r).length, r).toBeGreaterThan(0);
    });

    it('the starter atlas has its own entry (its links = the controller\'s), and an unknown atlas is refused BY NAME', () => {
        const starter = buildSubRegionMap({ rules: STARTER, partition: PARTITION });
        expect(starter.map.atlasId).toBe(STARTER.region_atlas.atlas_id);
        // ⚠ 16 at this slice (§5.16 said 17): derived, never typed.
        const starterRegions = new Map(Object.entries(STARTER.preset_sidecars['1'])
            .filter(([, s]) => s.substrate === 'flash_seedling').map(([r, s]) => [r, s.playable_payload]));
        expect([...starter.map.links.values()].flat().map((l) => l.name).sort())
            .toEqual(realRoomLinks(STARTER, starterRegions).map((l) => l.name).sort());
        const stale = { ...PT, region_atlas: { ...PT.region_atlas, atlas_id: 'seedling-00000000' } };
        expect(buildSubRegionMap({ rules: stale, partition: PARTITION })).toEqual({ map: null, why: NO_PARTITION('seedling-00000000') });
        // A preset with no sub-regions needs no partition, and says nothing.
        expect(buildSubRegionMap({ rules: { preset_sidecars: {} }, partition: PARTITION })).toEqual({ map: null, why: null });
    });

    it('subRegionAt: a sub-region tile names its compound region; a seam tile is no news', () => {
        for (const r of ['level_0__r8c0', 'level_0__r1c6', 'level_0__r14c0']) {
            for (const p of tilesOf(r)) expect(subRegionAt(MAP, 0, p.x, p.y)).toBe(r);
        }
        expect(subRegionAt(MAP, 0, seamOf(0).x, seamOf(0).y)).toBeNull();
        expect(subRegionAt(MAP, 86, 40, 40)).toBeNull();
    });

    it('linkPath walks only links the gate opens', () => {
        const closed = linkPath(MAP, 'level_0__r8c0', 'level_0__r14c0', gate({}));
        expect(closed.path).toBeNull();
        expect(closed.refused.map((r) => r.link.name)).toContain('level_0__r8c0 -> level_0__r14c0');
        const open = linkPath(MAP, 'level_0__r8c0', 'level_0__r14c0', gate({ 'Progressive Swim': 1 }));
        expect(open.path.map((h) => h.link.name)).toEqual(['level_0__r8c0 -> level_0__r14c0']);
    });
});

describe('a HUMAN walk across a link (position reads; no bot)', () => {
    const IN = 'level_0__r8c0';
    const OUT = 'level_0__r14c0';

    it('moves the AP region ONCE per crossing, and the seam never flickers', () => {
        const b = standing(IN, { 'Progressive Swim': 1 });
        const here = tilesOf(IN);
        const there = tilesOf(OUT);
        const seam = seamOf(0);
        // Walking about inside the start sub-region: nothing.
        expect(walk(b, here.slice(0, 5))).toEqual([]);
        // Across: seam tiles in between say nothing; the first tile of the other side moves ONCE.
        const out = moves(walk(b, [seam, there[0], seam, there[1], seam, there[0], there[2] ?? there[0]]));
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ sourceRegion: IN, targetRegion: OUT, exitName: `${IN} -> ${OUT}`, logical: true,
            fromLevel: 0, toLevel: 0 });
        expect(b.region).toBe(OUT);
        expect(b.world).toBe(world(OUT));
        // The region load that move causes is NOT an arrival: no teleport.
        const loaded = b.onLoadRegion({ region_id: OUT, world: world(OUT), arrivedFrom: { exit_id: `${IN} -> ${OUT}` } });
        expect(loaded.filter((e) => e.type === 'teleport')).toEqual([]);
        // And back: once.
        const back = moves(walk(b, [seam, here[0], here[1], seam, here[2]]));
        expect(back.map((m) => [m.sourceRegion, m.targetRegion])).toEqual([[OUT, IN]]);
    });

    it('⛔ never credits a move the logic does not allow: no item → WARNED once, the region stays', () => {
        const b = standing(IN, {});
        const there = tilesOf(OUT);
        const effects = walk(b, [there[0], there[1], there[0]]);
        expect(moves(effects)).toEqual([]);
        expect(b.region).toBe(IN);
        const warns = effects.filter((e) => e.type === 'warn');
        expect(warns).toHaveLength(1);
        expect(warns[0].message).toContain(`no OPEN logical link leads there from ${IN}`);
        expect(warns[0].message).toContain('Progressive Swim');
    });

    it('a refused move stays ARMED: the item arriving while the player stands there moves the region then', () => {
        const inv = {};
        const b = standing(IN, inv);
        const there = tilesOf(OUT);
        expect(moves(walk(b, [there[0]]))).toEqual([]);
        inv['Progressive Swim'] = 1;
        expect(moves(walk(b, [there[0]])).map((m) => m.targetRegion)).toEqual([OUT]);
    });

    it('a BASELINE read records where the player stands and moves nothing (the first read after a bot walk)', () => {
        const b = standing(IN, { 'Progressive Swim': 1 });
        const there = tilesOf(OUT);
        expect(b.onPlayerPosition({ level: 0, ...there[0] }, { baseline: true })).toEqual([]);
        expect(b.region).toBe(IN);
        expect(b.physicalSub).toBe(OUT);
        // Edge-triggered: standing on, nothing; only a NEW sub-region is news.
        expect(walk(b, [there[1]])).toEqual([]);
    });

    it('reads nothing while a swap of ours is in flight, parked, or on a level with no sub-regions', () => {
        const b = standing(IN, { 'Progressive Swim': 1 });
        b.pendingArrival = { level: 0, at: clock };
        expect(b.wantsPosition()).toBe(false);
        b.pendingArrival = null;
        expect(b.wantsPosition()).toBe(true);
        b.setActive(false);
        expect(b.wantsPosition()).toBe(false);
        expect(b.onPlayerPosition({ level: 0, ...tilesOf(OUT)[0] })).toEqual([]);
        const house = standing('level_86');
        expect(house.wantsPosition()).toBe(false);
    });
});

describe('the Playback Bot\'s route CREDITS a link (no walk), and the next door resolves from it', () => {
    it('the Sword\'s link: credited at once, no teleport, no bounce back from the player\'s tiles, then the stairs', () => {
        const b = standing('level_0__r8c0', {});
        const out = b.creditLink(SWORD_LINK);
        expect(out.ok).toBe(true);
        expect(moves(out.effects)).toEqual([expect.objectContaining({ sourceRegion: 'level_0__r8c0',
            targetRegion: 'level_0__r1c6', exitName: SWORD_LINK, logical: true })]);
        expect(b.onLoadRegion({ region_id: 'level_0__r1c6', world: world('level_0__r1c6') })
            .filter((e) => e.type === 'teleport')).toEqual([]);
        // The player still stands in r8c0's tiles (the link is walked as part of the next door's plan).
        expect(walk(b, tilesOf('level_0__r8c0').slice(0, 3))).toEqual([]);
        expect(b.region).toBe('level_0__r1c6');
        // The stairs to L2 fire: resolved against the CURRENT sub-region's sidecar.
        const crossing = moves(b.onStateReport('level', 2));
        expect(crossing).toEqual([expect.objectContaining({ sourceRegion: 'level_0__r1c6', targetRegion: 'level_2',
            exitName: 'level_0__r1c6 -> level_2', toLevel: 2 })]);
    });

    it('refuses a link out of another region, and a link the gate keeps closed — by name', () => {
        const b = standing('level_0__r8c0', {});
        expect(b.creditLink('level_0__r1c6 -> level_0__r2c13')).toMatchObject({ ok: false,
            reason: expect.stringContaining('leaves level_0__r1c6, but the AP region is level_0__r8c0') });
        const closed = b.creditLink('level_0__r8c0 -> level_0__r11c19');
        expect(closed.ok).toBe(false);
        expect(closed.reason).toContain('is closed');
        expect(b.region).toBe('level_0__r8c0');
        expect(b.creditLink('nope')).toMatchObject({ ok: false });
    });
});

describe('a door fired from a SIBLING sub-region (no position read saw the seam)', () => {
    it('the human walks from the start straight to the L2 stairs: the open link is credited, then the crossing', () => {
        const b = standing('level_0__r8c0', {});
        const effects = moves(b.onStateReport('level', 2));
        expect(effects.map((m) => [m.sourceRegion, m.targetRegion, !!m.logical])).toEqual([
            ['level_0__r8c0', 'level_0__r1c6', true],
            ['level_0__r1c6', 'level_2', false],
        ]);
    });

    it('⛔ a sibling behind a CLOSED link is not credited: no logical hop, no move to the sibling\'s door', () => {
        // r11c19's teleporter goes to L12; r8c0 reaches r11c19 only by Sword / Ghost Spear.
        const b = standing('level_0__r8c0', {});
        const effects = b.onStateReport('level', 12);
        expect(moves(effects)).toEqual([]);
        expect(effects.map((e) => e.type)).toEqual(['warn']);
        expect(b.region).toBe('level_0__r8c0');
        // r8c0's sidecar carries L2's ARRIVAL row (`in_L2_…`, no target region): with the way to the stairs'
        // sub-region closed, that row is not a way out — a warn, never a move to `null` (which would park).
        const shut = new SeedlingRegionBinding({ now: () => clock, canPass: () => ({ pass: false, gated: true }) });
        shut.setSubRegions(MAP);
        shut.onStateReport('level', 0);
        shut.onLoadRegion({ region_id: 'level_0__r8c0', world: world('level_0__r8c0') });
        expect(world('level_0__r8c0').exits.some((e) => e.target_level === 2 && !e.targetRegion)).toBe(true);
        const toL2 = shut.onStateReport('level', 2);
        expect(moves(toL2)).toEqual([]);
        expect(toL2.map((e) => e.type)).toEqual(['warn']);
        const armed = standing('level_0__r8c0', { 'Progressive Sword': 1 });
        expect(moves(armed.onStateReport('level', 12)).map((m) => m.targetRegion))
            .toEqual(['level_0__r11c19', 'level_12__r0c19']);
    });
});

describe('⛔ a departure beats an arrival row (measured live: the bot stalled in L3 after L11)', () => {
    it('level_11 → level 3: the door, not `in_L3_…` (same target spawn, listed first)', () => {
        const rows = world('level_11').exits.filter((e) => e.target_level === 3);
        expect(rows.some((e) => !e.targetRegion)).toBe(true);
        expect(rows.some((e) => e.targetRegion)).toBe(true);
        const b = standing('level_11');
        b.onStateReport('playerPositionX', rows[0].target_spawn.x);
        b.onStateReport('playerPositionY', rows[0].target_spawn.y);
        expect(moves(b.onStateReport('level', 3))).toEqual([expect.objectContaining({ sourceRegion: 'level_11',
            targetRegion: 'level_3__r8c6', exitName: 'level_11 -> level_3__r8c6' })]);
    });
});

describe('the glue reads the position, and stands down while the bot walks', () => {
    function rig({ walking = false, status = null } = {}) {
        const published = [];
        const ticks = [];
        const glue = new SeedlingRegionGlue({
            eventBus: { subscribe: () => () => {}, publish: () => {} },
            getDispatcher: () => ({ publish: (event, data) => published.push({ event, data }) }),
            loadRegionEvent: 'flashSeedling:loadRegion',
            canPass: gate({ 'Progressive Swim': 1 }),
            isBotWalking: () => walking,
            timers: { setInterval: (fn) => { ticks.push(fn); return 1; }, clearInterval: () => {} },
            now: () => clock,
        });
        const game = { botStatus: () => JSON.stringify(status()) };
        glue.attachAdapter({ _getFlash: () => game, teleport: () => {} });
        glue.setSubRegions(MAP);
        glue.binding.onStateReport('level', 0);
        glue.handleLoadRegion({ region_id: 'level_0__r8c0', world: world('level_0__r8c0') });
        return { glue, published, ticks, setWalking: (w) => { walking = w; } };
    }

    it('a read in another sub-region publishes ONE user:regionMove carrying `logical: true`', () => {
        let at = tilesOf('level_0__r8c0')[0];
        const r = rig({ status: () => ({ level: 0, x: at.x, y: at.y }) });
        r.glue.start();
        expect(r.ticks).toHaveLength(1);
        r.ticks[0]();
        at = tilesOf('level_0__r14c0')[0];
        r.ticks[0]();
        r.ticks[0]();
        const moved = r.published.filter((p) => p.event === 'user:regionMove');
        expect(moved).toHaveLength(1);
        expect(moved[0].data).toMatchObject({ sourceRegion: 'level_0__r8c0', targetRegion: 'level_0__r14c0', logical: true });
        expect(r.glue.stats).toMatchObject({ logicalMoves: 1, positionReads: 3 });
    });

    it('no read while the bot walks; the first read after it is a BASELINE (its route already credited)', () => {
        let at = tilesOf('level_0__r14c0')[0];
        const r = rig({ walking: true, status: () => ({ level: 0, x: at.x, y: at.y }) });
        r.glue.readPosition();
        expect(r.glue.stats.positionReads).toBe(0);
        r.setWalking(false);
        r.glue.readPosition();
        expect(r.published.filter((p) => p.event === 'user:regionMove')).toEqual([]);
        expect(r.glue.binding.physicalSub).toBe('level_0__r14c0');
        at = tilesOf('level_0__r8c0')[0];
        r.glue.readPosition();
        expect(r.published.filter((p) => p.event === 'user:regionMove')).toEqual([]);
        at = tilesOf('level_0__r14c0')[1];
        r.glue.readPosition();
        expect(r.published.filter((p) => p.event === 'user:regionMove')).toHaveLength(1);
    });

    it('creditLogicalLink answers at once and PUBLISHES on the next turn (the bot\'s walkTo is on the stack)', async () => {
        const r = rig({ status: () => ({ level: 0, x: 0, y: 0 }) });
        expect(r.glue.creditLogicalLink(SWORD_LINK)).toEqual({ ok: true });
        expect(r.published.filter((p) => p.event === 'user:regionMove')).toEqual([]);
        await Promise.resolve();
        expect(r.published.filter((p) => p.event === 'user:regionMove').map((p) => p.data.targetRegion)).toEqual(['level_0__r1c6']);
        expect(r.glue.creditLogicalLink('level_0__r8c0 -> level_0__r1c6').ok).toBe(false);
    });
});

describe('the controller hands a route\'s link to the binding (wasm and JS alike)', () => {
    const link = MAP.links.get('level_0__r8c0').find((l) => l.name === SWORD_LINK);
    const atlas = { arm: 'vanilla', entries: [], refused: [], regions: new Map(), links: [link] };

    it('the resolver answers a link, not a goal', () => {
        expect(resolveSeedlingAtlasGoal({ kind: 'exit', name: SWORD_LINK }, atlas)).toEqual({ link });
    });

    function controller(surface) {
        const engine = { liveLevel: () => 0, walkTo: () => ({ ok: true }), status: () => ({ phase: 'idle' }), dispose() {} };
        const c = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'wasm', wasm: { getGame: () => ({}), mapPath: 'x' }, atlas, ...surface }),
            substrate: 'flash_seedling', resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true,
            loadWasmEngine: async () => engine,
        });
        c._wasmEngine = engine;
        c._wasmGame = c._getSurface().wasm.getGame();
        return c;
    }

    it('credited → walkTo true, nothing handed to the engine; refused by the binding → refused by name', () => {
        let asked = null;
        const game = {};
        const c = controller({ wasm: { getGame: () => game, mapPath: 'x' }, creditLink: (n) => { asked = n; return { ok: true }; } });
        c._wasmGame = game;
        expect(c.walkTo({ kind: 'exit', name: SWORD_LINK })).toBe(true);
        expect(asked).toBe(SWORD_LINK);
        expect(c.lastGoal).toMatchObject({ kind: 'link', name: SWORD_LINK });
        const d = controller({ wasm: { getGame: () => game, mapPath: 'x' }, creditLink: () => ({ ok: false, reason: 'closed' }) });
        d._wasmGame = game;
        expect(d.walkTo({ kind: 'exit', name: SWORD_LINK })).toBe(false);
        expect(d.lastRefusal).toBe(LINK_CREDIT_REFUSAL(link, 'closed'));
        const e = controller({ wasm: { getGame: () => game, mapPath: 'x' } });
        e._wasmGame = game;
        expect(e.walkTo({ kind: 'exit', name: SWORD_LINK })).toBe(false);
        expect(e.lastRefusal).toBe(SUB_REGION_LINK_REFUSAL(link));
    });

    it('busy(): a wasm engine not idle (held counts), a JS walk walking or waiting', () => {
        const c = controller({});
        expect(c.busy()).toBe(false);
        c._wasmEngine = { status: () => ({ phase: 'held' }) };
        expect(c.busy()).toBe(true);
        const js = new SeedlingPlaybackController({ getSurface: () => ({ transport: 'js', jsRuntime: { playback: { state: 'waiting' } } }) });
        expect(js.busy()).toBe(true);
    });
});

describe('the committed partition is the atlases\' own analysis (the generator\'s --check, in the suite)', () => {
    it('a fresh build is byte-identical, and a partition that disagrees with its atlas is refused by name', async () => {
        const gen = await import('../../../scripts/procgen/make-seedling-subregion-partition.mjs');
        const { compactJsonFile } = await import('../procgenPipeline/compactJson.js');
        const { doc } = await gen.buildSubRegionPartition();
        expect(compactJsonFile(doc)).toBe(readFileSync(abs('./atlases/seedling-subregion-partition.json'), 'utf8'));
        // Every region checked: a location's tile moved into another sub-region is a named problem.
        const atlas = readJson('./atlases/seedling-playthrough.json');
        const region = atlas.regions.find((r) => r.region_id === 'level_0');
        const entry = PARTITION.atlases[atlas.atlas_id].regions.level_0;
        expect(gen.partitionProblems(region, entry)).toEqual([]);
        // An exit standing on a walkable tile, re-bound to a sub-region it is not in.
        const exit = region.exits.find((e) => entry.rows[e.entrance_tile[1]][e.entrance_tile[0]] !== '.'
            && e.sub_region !== 'r14c0');
        const wrong = { ...region, exits: region.exits.map((e) => (e === exit ? { ...e, sub_region: 'r14c0' } : e)) };
        expect(gen.partitionProblems(wrong, entry).join('\n')).toContain(`"${exit.exit_id}"`);
    }, 30000);
});
