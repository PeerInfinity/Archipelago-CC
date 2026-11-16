#!/usr/bin/env node
/**
 * set-map-frame-dump — **WHAT THE SET MAPS DRAW, AS CANONICAL JSON** (region-map (0,0)-origin follow-up).
 *
 * The follow-up drops `setMapLayout.canonicalLayout`'s min-shift: positions become signed, with the start room at
 * (0,0). Nothing a user sees may move. This dumps, per fixture, everything that is DRAWN or PICKED or derived from
 * the doors — and deliberately NOT the raw positions (those are the values that are licensed to move):
 *
 *   · `doors`   — every map link with its direction (`dir`) and how it was read: the door directions
 *                 (`seedlingDoorDirection.dirOfExit` / `mazeSetMap.dirOfMazeExit`), which feed the layout graph;
 *   · `census`  — `layoutCensus` of the canonical layout (cols/rows, honoured, consistent, adjacent, meanLength);
 *   · `frame@z` — `frameOf(canonicalLayout, sizes, z)` at zooms 0.5 / 1 / 2: width, height, every cell rect + still;
 *   · `shapes@z`— `mapLinkShapes` for selected = null / 0 / last (points, heads, labels, link endpoints);
 *   · `provider`— the provider's own frame/shapes at zoom 1, 200 picks (room, link, door marker), and its state
 *                 MINUS `positions` through connect-style sticky re-use, a RE-LAYOUT and a second record.
 *
 * Fixtures: the editor's vanilla 116 (`editorVanillaSet`, the page's), the bare vanilla 116 (`patches: []`, the
 * lift pin's), a generated Seedling set (`seedling_generated_chestdoor`), and the maze world map's: the committed
 * demo pack bare and with its ring, and generated libraries from `procgen_maze/AP_3` and `procgen_topdown/AP_4`.
 *
 * Usage: `node scripts/dev/set-map-frame-dump.mjs <out-dir>` → one `<fixture>.json` per fixture + `index.json`
 * (sha256 per file). Compare two dumps with `diff -r`.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const M = (p) => import(pathToFileURL(join(ROOT, 'frontend/modules', p)).href);
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

/** Keys sorted, numbers as JSON prints them: the dump is of the VALUE. */
const canonical = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x), 1);

const out = process.argv[2];
if (!out) { console.error('usage: set-map-frame-dump.mjs <out-dir>'); process.exit(2); }
mkdirSync(out, { recursive: true });

const L = await M('procgenCore/setMapLayout.js');
const SM = await M('seedlingDemo/seedlingSetMap.js');
const { tileTypeForPlacement, SEEDLING_TILE_SIZE } = await M('flashPanel/seedlingSemantics.js');
const { loadRulesSchema } = await M('procgenCore/jsonSchemaFiles.js');
const { vanillaRecordSet } = await M('seedlingDemo/levelSetExporter.js');
const { parseOelLevel } = await M('seedlingDemo/procgenLevelOel.js');
const { emptyOverlay } = await M('seedlingDemo/seedlingSetOverlay.js');
const { setRecord } = await M('seedlingDemo/seedlingSetAdapter.js');
const { assembleGeneratedSeedlingSet } = await M('seedlingDemo/seedlingGeneratedSet.js');
const { editorVanillaSet } = await M('seedlingDemo/watchSetEditor.js');
const MZ = await M('mazeRoom/mazeSetMap.js');
const { emptyMazeOverlay } = await M('mazeRoom/mazeAtlasDerivation.js');
const MA = await M('mazeRoom/mazeSetAdapter.js');
const { generatedMazeLibrary } = await M('mazeRoom/mazeSetMap.fixtures.js');

const DEPS = Object.freeze({
    parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
    atlas: { game: 'set-map-frame-dump', mapDocument: 'set-map-frame-dump.json' },
});

/** The shape as drawn: the picking-only `link` is reduced to its endpoints. */
const drawn = (s) => ({ ...s, link: s.link ? { kind: s.link.kind, a: s.link.a, b: s.link.b, from: s.link.from, to: s.link.to } : undefined });
const stateSansPositions = (st) => { const { positions, ...rest } = st; return { ...rest, positionCount: positions.length }; };

function dump({ linksOf, graphOf, linkShapes, provider, rec, rec2 }) {
    const o = {};
    const ml = linksOf(rec);
    o.doors = { links: ml.links, sizes: ml.sizes, unreadable: ml.unreadable };
    const g = graphOf(rec, ml.links);
    o.graphKey = g.key;
    const pos = L.canonicalLayout(g);
    o.census = L.layoutCensus(g, pos);
    const n = pos.length;
    for (const z of [0.5, 1, 2]) {
        const f = L.frameOf(pos, ml.sizes, z);
        o[`frame@${z}`] = f;
        for (const sel of [null, 0, n - 1]) o[`shapes@${z}_sel${sel}`] = linkShapes(ml.links, f, { selected: sel }).map(drawn);
    }
    const map = provider();
    const f = map.frame(rec);
    o.provider = { frame: f, shapes: map.shapes(rec, f, { selected: 0 }).map(drawn) };
    const picks = [];
    for (let i = 0; i < 200; i++) {
        const p = { x: (i * 37.3) % f.width, y: (i * 53.7) % f.height };
        const l = map.linkAt(rec, f, p, { selected: i % 3 ? null : 0 });
        picks.push([map.roomAt(rec, f, p), l ? { ...drawn({ link: l.link }).link, nearRoom: l.nearRoom } : null,
            map.markerAt(rec, f, p, 0)]);
    }
    o.provider.picks = picks;
    o.provider.state0 = stateSansPositions(map.state(rec));
    if (rec2) {
        o.provider.state2 = stateSansPositions(map.state(rec2));
        o.provider.stateBack = stateSansPositions(map.state(rec));
    }
    map.reset();
    o.provider.stateReset = stateSansPositions(map.state(rec));
    return o;
}

const seedling = (rec, rec2) => dump({
    linksOf: (r) => SM.mapLinksOf(r, DEPS), graphOf: SM.layoutGraphOf, linkShapes: SM.mapLinkShapes,
    provider: () => SM.createSetMap(DEPS), rec, rec2,
});
const maze = (rec, rec2) => dump({
    linksOf: MZ.mazeMapLinksOf, graphOf: MZ.mazeLayoutGraphOf,
    linkShapes: (links, f, o) => L.mapLinkShapes(links, f, o), provider: () => MZ.createMazeSetMap(), rec, rec2,
});

const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
const ATLAS = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const editorVanilla = setRecord(editorVanillaSet(EMBED, ATLAS).set, emptyOverlay());
const bareVanilla = setRecord(vanillaRecordSet(EMBED, ATLAS, { patches: [] }).set, emptyOverlay());
const gen = setRecord(assembleGeneratedSeedlingSet(readJson('frontend/presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json')).set,
    emptyOverlay());

const PACK = readJson('frontend/region-libraries/demo-maze-pack.json');
const n = PACK.entries.length;
const exitOn = (entry, side) => entry.payload.exits.find((e) => e.side === side).exit_id;
const RING = PACK.entries.map((e, i) => ({ from: [i, exitOn(e, 'E')], to: [(i + 1) % n, exitOn(PACK.entries[(i + 1) % n], 'W')] }));
const mazeRec = (links, extra = {}) => MA.setRecord(PACK, { ...emptyMazeOverlay(), links, ...extra });
const genMaze = (p) => { const g = generatedMazeLibrary(readJson(p)); return MA.setRecord(g.library, g.overlay); };
const adapter = MA.createMazeSetAdapter({});
const chain = mazeRec(RING.slice(0, 2));
const closed = adapter.apply(chain, { op: 'connect', from: RING[3].from, to: RING[3].to, one_way: false });
const reordered = adapter.apply(chain, { op: 'reorder', order: [3, 2, 1, 0] });

const FIXTURES = {
    'seedling-vanilla-editor': () => seedling(editorVanilla, bareVanilla),
    'seedling-vanilla-bare': () => seedling(bareVanilla),
    'seedling-generated-chestdoor': () => seedling(gen, editorVanilla),
    'maze-pack-bare': () => maze(mazeRec([])),
    'maze-pack-ring': () => maze(mazeRec(RING)),
    'maze-pack-chain-closed': () => maze(chain, closed.ok ? closed.record : null),
    'maze-pack-chain-reordered': () => maze(chain, reordered.ok ? reordered.record : null),
    'maze-generated-procgen_maze-AP_3': () => maze(genMaze('frontend/presets/procgen_maze/AP_3/AP_3_rules.json')),
    'maze-generated-procgen_topdown-AP_4': () => maze(genMaze('frontend/presets/procgen_topdown/AP_4/AP_4_rules.json')),
};

const index = {};
for (const [name, fn] of Object.entries(FIXTURES)) {
    const text = `${canonical(fn())}\n`;
    writeFileSync(join(out, `${name}.json`), text);
    index[name] = createHash('sha256').update(text).digest('hex');
}
writeFileSync(join(out, 'index.json'), `${canonical(index)}\n`);
for (const [k, v] of Object.entries(index)) console.log(`${v}  ${k}`);
