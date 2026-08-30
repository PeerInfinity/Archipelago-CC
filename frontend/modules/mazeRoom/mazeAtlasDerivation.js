/**
 * mazeRoom/mazeAtlasDerivation — **A REGION ATLAS, DERIVED FROM A REGION
 * LIBRARY PLUS AN AUTHORED OVERLAY — and the FIRST maze-owned compile.**
 *
 * EDITOR v3 arc, slice E2a (`NewDocs/plans/seedling-editor-v3.md` §22.1 #6,
 * §22.3, §22.6 Q2 — RULED; as-built §26).
 *
 * ── ⛓⛓⛓ WHY THE LINKS ARE AUTHORED AND EVERYTHING ELSE IS DERIVED ────────
 *
 * §16.3 ruled that a set session's document is `{set, overlay}` and that the
 * atlas is a FUNCTION of the set plus a small authored overlay. For Seedling
 * the links are IN the set — an OEL teleporter carries `@to`. For the maze they
 * cannot be: `regionLibraryValidator.js:22-33` makes every entry's
 * `targetRegion`/`targetExitId` **null BY CONTRACT**, because a library entry is
 * INTERCHANGEABLE content that `stitchGrid` wires at instantiate time, and
 * `:169-177` makes `carried_rules` null for the same reason. A region library
 * therefore holds ROOMS and no wiring at all.
 *
 * ⇒ the maze's overlay carries `links` beside the locations, the rules and the
 * start, and the atlas is still DERIVED: bounds ← the payload's size, `map_ref`
 * ← the entry INDEX, boundary exits ← `payload.exits[]`, locations ←
 * `payload.items[]` the overlay has MARKED, connections ← `overlay.links[]`.
 *
 * ⚠ **THE ATLAS POOL IS NOT REPRODUCED, AND THAT IS NOT A GAP.**
 * `frontend/atlas-pools/seedling-atlas-pool.json` is the OUTPUT of compiling
 * the SEEDLING atlas with the maze flavour (`regionAtlasPool.js:290`), so its
 * input contract is a real game map and not a library of interchangeable rooms.
 * There is no byte gate to be had between the two and this slice does not fake
 * one (§22.3's cross-check clause).
 *
 * ── ⛔⛔ THE TWO THINGS THE BRIEF SPECIFIED THAT THE FORMAT REFUSES ────────
 *
 *  1. **`kind: 'crossing'` IS NOT AN ATLAS EXIT KIND.** `region-atlas.schema.json`
 *     declares `kind` as the CLOSED enum `edge | teleporter`, and
 *     `regionAtlasValidator` enforces it — an atlas carrying `'crossing'` fails
 *     the structural pass, so the REPORT would refuse every maze export. A
 *     boundary exit is therefore an **`edge`**, and its `side` is DERIVED by
 *     `atlasOps.deriveEdgeSide` from the tiles and the bounds rather than
 *     carried: the payload's own `side` is used as a CROSS-CHECK and a
 *     disagreement refuses BY NAME.
 *  2. **`rules_source` IS THE CLOSED ENUM `analyzer | manual | mixed`**, so it
 *     cannot name this module. A maze region's rules come from the AUTHORED
 *     overlay, which is `'manual'` — the honest value of the three.
 *
 * ── ⛔ NO SUBGRAPH, AND THE REFUSAL THAT REPLACES IT ──────────────────────
 *
 * `regionAtlasMazeProjection.projectRegionToMaze` recomputes a region's
 * components from the grid and THROWS when they disagree with the declared
 * `subgraph` (`:344-356`). A single-component room needs no subgraph at all
 * (`bindingsFor` handles its absence, `:92-97`), and a maze room built by the
 * generator is one component by construction. ⇒ this derivation emits NO
 * subgraph and instead FLOODS the payload from its entrance: a payload whose
 * floor splits into two blobs is refused HERE, by name, rather than compiled
 * into an atlas the projection would reject with a sentence about staleness.
 */

import { AtlasSession, createEmptyAtlas } from '../regionMarkingTool/atlasSession.js';
import { TILE_FLOOR, TILE_WALL } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { reachableFrom } from '../procgenCore/gridFlood.js';
import {
    BASE_LOCATION_FIELDS, OVERLAY_SCHEMA_VERSION, ROOM_OVERLAY_FIELDS, RULE_TARGET_PREFIXES,
    applyOverlayRules, createSetOverlay, exitRuleKey, locationRuleKey,
} from '../procgenCore/setOverlay.js';

export class MazeAtlasDerivationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeAtlasDerivationError';
    }
}

const fail = (message) => { throw new MazeAtlasDerivationError(message); };

/**
 * ⛓⛓ **THE SUBSTRATE THIS DERIVATION CAN READ**, and the one spelling of it in
 * this file (EDITOR INTEGRATION W1).
 *
 * ⛔ It is a LOCAL constant only because all three importable homes are shut:
 * `shared/procgen/substrateRegistry.js` is reached through `mazeRoomLibrary.js`,
 * which drags `./index.js` — the PANEL — into a node-only module and registers a
 * substrate as a side effect of opening an editor session (`mazeSetAdapter.js`
 * documents the same refusal for the same reason); `mazeSetAdapter.js`'s own
 * `MAZE_CAPTURE_DEPS.substrate` imports THIS module, so reading it back is a
 * cycle; and `procgenPipeline/regionAtlasMazeProjection.js`'s `MAZE_SUBSTRATE`
 * is a PIPELINE dependency, which this module deliberately names none of —
 * that is why `rulesJsonOf` takes `compileRegionAtlas` injected.
 *
 * ⛓ So the second spelling is GATED instead of avoided: a row in
 * `mazeAtlasDerivation.test.js` asserts this equals both `MAZE_SUBSTRATE` and
 * `MAZE_CAPTURE_DEPS.substrate`, which a test file can import and this one
 * cannot. A drift is a red row, not a silent disagreement.
 */
export const READS_SUBSTRATE = 'maze';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE MAZE'S OVERLAY — the toolkit's shape, two fields of its own
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The default a link takes when the author does not say. */
export const LINK_ONE_WAY_DEFAULT = false;

/** A link's endpoint, canonically — the key a duplicate is detected on. */
const endpointKey = (endpoint) => `${endpoint?.[0]}/${endpoint?.[1]}`;

const isEndpoint = (v, roomCount) => Array.isArray(v) && v.length === 2
    && Number.isInteger(v[0]) && v[0] >= 0 && (roomCount === null || v[0] < roomCount)
    && typeof v[1] === 'string' && v[1].length > 0;

const exitIdsOf = (entry) => (entry?.payload?.exits ?? []).map((e) => e.exit_id);

/**
 * ⛓⛓ **THE LINK CHECK, AND THE ONE PLACE THE DEFAULT IS STATED.**
 *
 * ⛔⛔ **`one_way` DEFAULTS TO `false` — THE OPPOSITE OF SEEDLING'S.** Seedling's
 * one transition primitive is a one-way JUMP (a teleporter fires and the player
 * lands; nothing comes back unless a second teleporter is placed), so
 * `seedlingAtlasDerivation` emits `{one_way: true}` on every connection. A maze
 * crossing is a TILE the player walks onto and can walk back off — the region
 * pair is symmetric by construction — so the maze's default is two-way, and a
 * `one_way: true` link is the author saying something extra.
 *
 * ⚠ The consequence is visible in the REPORT: `setEditorCore.gateabilityOf`
 * calls the ARRIVAL side of a one-way connection ungateable, so a maze author
 * who marks a link one-way loses the ability to gate its far end — which is
 * exactly what the compiler will do (`regionAtlasCompiler.js:341`, `arrivalOnly`).
 */
function linkErrors(links, { roomCount, entries = null }) {
    if (!Array.isArray(links)) return ['overlay.links must be an array'];
    const errors = [];
    const seen = new Map();
    links.forEach((link, i) => {
        const label = `overlay.links[${i}]`;
        if (!isPlainObject(link)) { errors.push(`${label} must be an object`); return; }
        for (const key of Object.keys(link)) {
            if (!['from', 'to', 'one_way'].includes(key)) {
                errors.push(`${label}.${key} is not a declared field — a link carries from, to `
                    + 'and one_way');
            }
        }
        for (const side of ['from', 'to']) {
            if (!isEndpoint(link[side], roomCount)) {
                errors.push(`${label}.${side} must be [roomIndex, exit_id]`
                    + (roomCount === null ? '' : ` with the room inside 0..${roomCount - 1}`)
                    + `, got ${JSON.stringify(link[side])}`);
                continue;
            }
            // ⛔ THE EXIT ID IS CHECKED AGAINST THE ENTRY'S OWN PAYLOAD when the
            // caller hands the entries in. `exit_id === exitName` is load-bearing
            // downstream (`regionAtlasMazeProjection.js:54-66`), so a link naming
            // an exit the room does not have would produce an atlas the compiler
            // silently leaves unwired — a door the author believes is joined.
            const entry = entries?.[link[side][0]];
            if (entry === undefined) continue;
            const ids = exitIdsOf(entry);
            if (!ids.includes(link[side][1])) {
                errors.push(`${label}.${side} names exit "${link[side][1]}", which entry `
                    + `"${entry.entry_id}" (room ${link[side][0]}) does not have. Its exits are `
                    + `${ids.join(', ') || '(none)'}.`);
            }
        }
        if (link.one_way !== undefined && typeof link.one_way !== 'boolean') {
            errors.push(`${label}.one_way must be a boolean when present (it defaults to `
                + `${LINK_ONE_WAY_DEFAULT} — a maze crossing is walkable both ways)`);
        }
        // ⛔ ONE ENDPOINT, ONE LINK. `atlasOps.connect` refuses a second
        // connection on an exit that already has one, so a duplicate caught here
        // names the pair instead of dying inside the derivation.
        for (const side of ['from', 'to']) {
            if (!Array.isArray(link[side])) continue;
            const key = endpointKey(link[side]);
            if (seen.has(key)) {
                errors.push(`${label}.${side} names ${key}, which overlay.links[${seen.get(key)}] `
                    + 'already joins — an exit crosses to exactly one place');
            } else {
                seen.set(key, i);
            }
        }
    });
    return errors;
}

/** ⛓ A link under a room renumbering; one touching a DEAD room is dropped. */
const renumberLinks = (links, mapping) => links
    .map((link) => ({
        ...link,
        from: [mapping.get(link.from[0]), link.from[1]],
        to: [mapping.get(link.to[0]), link.to[1]],
    }))
    .filter((l) => l.from[0] !== null && l.from[0] !== undefined
        && l.to[0] !== null && l.to[0] !== undefined);

const MAZE_OVERLAY = createSetOverlay({
    moduleName: 'mazeSetOverlay',
    ErrorClass: MazeAtlasDerivationError,
    schemaVersion: OVERLAY_SCHEMA_VERSION,

    /**
     * ⛓ `item` is an INDEX into the entry's `payload.items[]`. A maze location
     * is a captured slot POSITION (`mazeLibraryEntry.js:52-60` reduces every
     * placed item to `{x, y, id: 'slot_<i>'}`), so the ordinal is the address a
     * person clicking a room can produce — the maze's answer to the question
     * Seedling answers with `{type, x, y}` pixels.
     */
    locationFields: ['item', ...BASE_LOCATION_FIELDS],
    locationRowErrors: (row, label) => (Number.isInteger(row.item) && row.item >= 0
        ? []
        : [`${label}.item must be a non-negative INDEX into the entry's payload.items[] — a maze `
            + 'location is a captured slot position, and the ordinal is what addresses it']),

    exitIdHint: 'A maze exit id is the payload\'s own (`exit_0`, `exit_1`, …), and `exit_id === '
        + 'exitName` is load-bearing downstream; a location is named by the `mark-location` '
        + 'op\'s `name`.',

    extraFields: {
        links: { errors: linkErrors, renumber: renumberLinks },
        start: {
            errors: (start, { roomCount }) => (
                Number.isInteger(start) && start >= 0
                    && (roomCount === null || start < roomCount)
                    ? []
                    : [`overlay.start must be a room index${roomCount === null ? ''
                        : ` inside 0..${roomCount - 1}`}, got ${JSON.stringify(start)}`]),
            // ⛔ A start whose room is GONE becomes ABSENT, not 0: the derivation
            // then falls back to entry 0 and SAYS SO through `note`, which is a
            // reader telling the difference between "nobody chose" and "the
            // choice was silently rewritten".
            renumber: (start, mapping) => mapping.get(start) ?? undefined,
        },
    },
});

export const {
    LOCATION_FIELDS, assertOverlay, emptyOverlay, exitRulesByRoom, overlayErrors,
    overlayLocationNames, overlayRoomIndices, parseRuleTarget, renumberOverlay,
} = MAZE_OVERLAY;

export {
    BASE_LOCATION_FIELDS, OVERLAY_SCHEMA_VERSION, ROOM_OVERLAY_FIELDS, RULE_TARGET_PREFIXES,
    exitRuleKey, locationRuleKey,
};

/** ⛓ An EMPTY maze overlay carries the two extra fields' own empties. */
export const emptyMazeOverlay = () => ({ ...emptyOverlay(), links: [] });

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ THE GRID — the ONE thing the compiler says is the GAME's
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **`gridFor` FOR A MAZE PAYLOAD, AND WHY THERE WAS NONE TO REUSE.**
 *
 * `compileRegionAtlas(..., {sidecarFlavor: 'maze'})` refuses without
 * `mazeProjection.gridFor` because *"the cell grid and the condition vocabulary
 * are the GAME's, not the compiler's"* (`regionAtlasCompiler.js:483`). Every
 * `gridFor` in the repo today is **`seedlingMazeProjectionDeps`'**
 * (`flashPanel/seedlingAtlasAnalysis.js:113`), which indexes SEEDLING levels out
 * of the map extract and runs them through `buildSeedlingRegionGrid` — a
 * semantics table over tile placements and entity boxes. None of that exists for
 * a maze payload, whose tiles ARE the grid, so this slice writes the maze's own
 * and it is nearly the identity.
 *
 * ⛓ The cell shape is the analyzer's (`regionAtlasAnalyzer.js:27`): `kind` plus
 * the four annotation lists. A maze payload declares no conditions, no faces and
 * no directional tiles — its geometry is exactly wall-or-floor — so every cell
 * carries the empty ones, and the components the projection recomputes are the
 * connected blobs of floor.
 */
export function mazeGridFor(payload) {
    const { width, height, tiles } = payload ?? {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        fail('mazeAtlasDerivation: a payload needs integer width/height, got '
            + `${JSON.stringify({ width, height })}`);
    }
    if (!Array.isArray(tiles) || tiles.length !== width * height) {
        fail(`mazeAtlasDerivation: a ${width}x${height} payload needs ${width * height} tiles, `
            + `got ${Array.isArray(tiles) ? tiles.length : JSON.stringify(tiles)}`);
    }
    return {
        width,
        height,
        cells: tiles.map((t) => ({
            kind: t === TILE_WALL ? 'wall' : 'open',
            conditions: [],
            faces: {},
            dirs: {},
            manual: [],
            labels: [],
        })),
        origin: { x: 0, y: 0 },
        unclassified: [],
        review: [],
        sinks: [],
    };
}

/**
 * ⛔⛔ **ONE COMPONENT, ASSERTED — the refusal that stands in for a subgraph.**
 *
 * @returns {null|string} why the payload is not one component, or null
 */
function multiComponentReason(payload, label) {
    const { width, height, tiles, entrance } = payload;
    const floors = [];
    tiles.forEach((t, i) => { if (t !== TILE_WALL) floors.push(i); });
    if (floors.length === 0) return `${label} has no floor tile at all`;
    if (!isPlainObject(entrance) || !Number.isInteger(entrance.x) || !Number.isInteger(entrance.y)) {
        return `${label} carries no integer \`entrance\` to flood from`;
    }
    const isWalkable = (x, y) => tiles[y * width + x] !== TILE_WALL;
    if (!isWalkable(entrance.x, entrance.y)) {
        return `${label}'s entrance [${entrance.x},${entrance.y}] stands on a WALL`;
    }
    // ⛓ `reachableFrom` answers in `"x,y"` KEYS, not indices — the spelling
    //   both substrates' overlays already use.
    const reached = reachableFrom(width, height, isWalkable, entrance);
    const stranded = floors.filter((i) => !reached.has(`${i % width},${Math.floor(i / width)}`));
    if (stranded.length === 0) return null;
    const [first] = stranded;
    return `${label}'s floor splits into more than one component — ${stranded.length} tile(s) `
        + `cannot be reached from the entrance [${entrance.x},${entrance.y}] (the first is `
        + `[${first % width},${Math.floor(first / width)}]). ⛔ REFUSED here rather than emitted `
        + 'as a `subgraph`: `regionAtlasMazeProjection` recomputes the components and THROWS a '
        + 'sentence about a stale atlas when they disagree, and a room whose two halves are '
        + 'separate is a room the author has not finished, not a sub-region.';
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE DERIVATION
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ A region's id is the ENTRY's own id — author-chosen, unique within the
 * library (`regionLibraryValidator.js`) and STABLE across a restamp, so a
 * reorder moves `map_ref` and leaves every AP region name where it was.
 * `map_ref` is the INDEX, because that is what addresses the room.
 */
const regionIdFor = (entry, index) => {
    if (typeof entry?.entry_id !== 'string' || entry.entry_id.length === 0) {
        fail(`mazeAtlasDerivation: entries[${index}] carries no \`entry_id\`. ⛔ REFUSED rather `
            + 'than numbered: the entry id is what the AP region is named after and what a '
            + 'reorder must NOT move, and inventing one here would give two libraries the same '
            + 'region names.');
    }
    return entry.entry_id;
};

/**
 * Build a region atlas from a region LIBRARY's entries plus an authored overlay.
 *
 * @param {object[]} entries  a region library's `entries[]` (substrate 'maze')
 * @param {object} overlay    `{rooms, links, start}` — the AUTHORED half
 * @param {object} [deps]
 * @param {number} [deps.tileSize]  a maze payload's coordinates ARE tiles, so 1
 * @param {Function} [deps.note]
 * @param {object} [deps.atlas]     the envelope for `createEmptyAtlas`
 * @returns {{atlas: object, dropped: string[], stats: object}} UNSTAMPED — the
 *   caller owns identity, exactly as the Seedling derivation leaves it.
 */
export function deriveAtlas(entries, overlay = {}, deps = {}) {
    const { note } = deps;
    const tileSize = deps.tileSize ?? 1;
    if (!Array.isArray(entries) || entries.length === 0) {
        fail('mazeAtlasDerivation: deriveAtlas needs a non-empty `entries` array — a region '
            + 'library with no entries is not a set anybody can edit');
    }
    /**
     * ⛔⛔ **THE MAP DOCUMENT IS REQUIRED, AND THE VALIDATOR IS WHY.** Every
     * region here names a `map_ref`, and `regionAtlasValidator` refuses an atlas
     * that names one without saying which document those ids live in — *"a
     * region names a map_ref, so the document those level ids live in has to be
     * identified"*. For the maze that document is the LIBRARY the entries came
     * from, which this function is not handed; `deriveAtlasOf` supplies it from
     * `library_id`. ⛔ REFUSED rather than defaulted: an atlas that named some
     * other library's id would compile and be traceable to the wrong rooms.
     */
    if (typeof deps.atlas?.mapDocument !== 'string' || deps.atlas.mapDocument.length === 0) {
        fail('mazeAtlasDerivation: deriveAtlas needs `deps.atlas.mapDocument` — the region '
            + 'LIBRARY these entries came from. Every region carries a `map_ref` (its entry '
            + 'INDEX) and the atlas validator refuses a map_ref whose document is unnamed.');
    }
    /**
     * ⛓⛓ **THE REFUSAL IS PER ENTRY NOW, AND THAT IS THE WHOLE POINT** (EDITOR
     * INTEGRATION W1, plan §2.2 #1).
     *
     * It used to be per DOCUMENT: `[...new Set(entries.map(e => e.substrate))]`
     * had to be exactly one id, and a library mixing maze with anything else
     * was refused whole — while the refusal's own text conceded *"a region
     * library may legally mix them"*. That was the honest thing to say when
     * nothing downstream could carry a per-room substrate. Now the atlas region
     * can (`region.substrate`) and `compileRegionAtlas` dispatches on it, so the
     * document-level refusal is the last thing standing between a mixed library
     * and a mixed world.
     *
     * ⛔ WHAT DOES NOT CHANGE: an entry this derivation cannot READ is still
     * refused. `mazeGridFor` reads a tile-grid maze payload and a bounce entry's
     * `{size, platforms[], springs[]}` is not one — it would be mis-read, not
     * merely mis-labelled. So the refusal survives at the ENTRY, naming which
     * one and what it declared, which is what lets a library mixing maze with a
     * substrate W2 teaches this about fail at the row rather than at the
     * document.
     */
    entries.forEach((entry, index) => {
        const declared = entry?.substrate;
        if (declared === READS_SUBSTRATE) return;
        fail(`mazeAtlasDerivation: entry ${index} (\`${entry?.entry_id ?? '?'}\`) declares `
            + `${JSON.stringify(declared)}; this derivation reads \`${READS_SUBSTRATE}\` payloads `
            + '(a tile grid) and would silently mis-read any other kind. ⛓ A region library may '
            + 'legally mix substrates and the ATLAS can now carry one per region — so this is a '
            + 'refusal about what THIS derivation can read, not about the library.');
    });

    /**
     * ⛓⛓ **`game` IS A GAME, NOT A SUBSTRATE** (EDITOR INTEGRATION W1, plan §1).
     *
     * This used to put the ENTRIES' substrate in the `game` slot — a category
     * error that only looked right while a maze library's substrate and its
     * identity were the same word. They are different questions: `game` says
     * WHAT THIS DOCUMENT IS OF (it reaches `rules.region_atlas.game`, the
     * compiler's `substrateIdFor(atlas.game)` and, unstamped, `atlas_id`),
     * while the substrate says WHAT PLAYS IT — and that now lives on the
     * regions, one per entry, where it belongs.
     *
     * ⛓ The LIBRARY is what this atlas is of, so `deriveAtlasOf` supplies its
     * `name ?? library_id`. A caller holding only a bare `entries[]` array —
     * which is what `deriveAtlas` takes — names no library at all, and the
     * readable substrate is the only true thing left to say about the document;
     * that is what this fallback is, and `deriveAtlasOf` overrides it through
     * the same `deps.atlas` seam every other envelope field travels on.
     * ⛔ `createEmptyAtlas` REFUSES a nameless `game` (it used to default to
     * `'seedling'`), so there is no silent mislabelling either way.
     */
    const session = new AtlasSession(createEmptyAtlas({
        game: READS_SUBSTRATE, tileSize, ...(deps.atlas ?? {}),
    }));

    // Regions first, so a link can name any of them.
    entries.forEach((entry, index) => {
        const regionId = regionIdFor(entry, index);
        const payload = entry.payload ?? {};
        // ⛔ THE GRID IS BUILT HERE TOO, so a payload the COMPILE would choke on
        // is refused while the reader is still looking at the derivation.
        mazeGridFor(payload);
        const why = multiComponentReason(payload, `entry "${regionId}" (room ${index})`);
        if (why) fail(`mazeAtlasDerivation: ${why}`);
        session.addRegion({
            region_id: regionId,
            name: entry.name ?? regionId,
            bounds: { x: 0, y: 0, w: payload.width, h: payload.height },
            map_ref: index,
            // ⛓⛓ THE ENTRY'S OWN SUBSTRATE, WRITTEN ON ITS OWN REGION — never
            //   the DOCUMENT's. Today the per-entry refusal above means every
            //   entry that gets here declares the same id, so the two readings
            //   agree; the moment W2 teaches this derivation a second payload
            //   kind they stop agreeing, and a document-wide value would then
            //   label every region with whatever the first entry happened to be.
            //   Read it off the entry now, while the two are still the same, so
            //   the change that separates them is not also the change that has
            //   to notice this line.
            substrate: entry.substrate,
            // ⛓ `manual`: a maze region's access rules come from the AUTHORED
            //   overlay. The enum is analyzer|manual|mixed and nothing else.
            rules_source: 'manual',
        });
    });

    // Boundary exits: one per payload exit, `exit_id` VERBATIM.
    entries.forEach((entry, index) => {
        const regionId = regionIdFor(entry, index);
        for (const exit of entry.payload?.exits ?? []) {
            if (typeof exit?.exit_id !== 'string' || exit.exit_id.length === 0) {
                fail(`mazeAtlasDerivation: entry "${regionId}" has an exit with no \`exit_id\``);
            }
            const tile = [exit.x, exit.y];
            const added = session.addExit(regionId, {
                exit_id: exit.exit_id,
                tiles: [tile],
                // ⛓ A TELEPORTER SAYS SO; anything else is an EDGE whose side
                //   `deriveEdgeSide` reads off the bounds. ⛔ `kind` is a CLOSED
                //   enum (edge|teleporter) — 'crossing' would fail the atlas's
                //   own structural pass.
                ...(exit.isTeleporter === true ? { kind: 'teleporter' } : {}),
            });
            // ⛔ THE PAYLOAD'S `side` IS A CROSS-CHECK, NOT A CARRIED VALUE. The
            // atlas derives the side from the tile and the bounds; if the two
            // disagree the payload's geometry and its metadata have drifted, and
            // an atlas that trusted the metadata would place the door on the
            // wrong wall of the projected world.
            if (added.kind === 'edge' && exit.side && added.side !== exit.side) {
                fail(`mazeAtlasDerivation: entry "${regionId}" exit "${exit.exit_id}" says side `
                    + `"${exit.side}" but its tile [${tile}] is on the "${added.side}" bounds `
                    + `line of the ${entry.payload.width}x${entry.payload.height} room. ⛔ The `
                    + 'side is DERIVED from the geometry and the payload\'s own label disagrees '
                    + '— the entry is stale against its tiles.');
            }
        }
    });

    // Connections: the AUTHORED links, and nothing else knows them.
    for (const [i, link] of (overlay.links ?? []).entries()) {
        const from = [regionIdFor(entries[link.from[0]], link.from[0]), link.from[1]];
        const to = [regionIdFor(entries[link.to[0]], link.to[0]), link.to[1]];
        try {
            session.connect(from, to, { one_way: link.one_way ?? LINK_ONE_WAY_DEFAULT });
        } catch (e) {
            fail(`mazeAtlasDerivation: overlay.links[${i}] (${endpointKey(link.from)} → `
                + `${endpointKey(link.to)}) could not be wired — ${e.message}`);
        }
    }

    // Locations: a payload item the overlay has MARKED, and only those.
    entries.forEach((entry, index) => {
        const regionId = regionIdFor(entry, index);
        const items = entry.payload?.items ?? [];
        for (const row of overlay.rooms?.[String(index)]?.locations ?? []) {
            const item = items[row.item];
            if (item === undefined) {
                fail(`mazeAtlasDerivation: the overlay marks item ${row.item} of room ${index} `
                    + `("${row.name}"), but entry "${regionId}" holds ${items.length} item slot(s)`);
            }
            session.addLocation(regionId, {
                name: row.name,
                tile: [item.x, item.y],
                vanilla_item: row.vanilla_item,
            });
        }
    });

    /**
     * ⛓ THE START. `overlay.start` is a room INDEX; absent, entry 0 is the
     * start and the note SAYS so — a reader can then tell "nobody chose" from
     * "the choice was applied".
     */
    const startRoom = Number.isInteger(overlay.start) ? overlay.start : 0;
    if (!Number.isInteger(overlay.start)) {
        note?.('the overlay names no `start`, so entry 0 is the start region');
    }
    if (entries[startRoom] === undefined) {
        fail(`mazeAtlasDerivation: overlay.start names room ${startRoom}, and the library has `
            + `${entries.length}`);
    }
    session.setStart(regionIdFor(entries[startRoom], startRoom));

    /**
     * ⛔ A ROOM WITH NO DOOR AT ALL IS **KEPT**, and that is the opposite of the
     * Seedling derivation's ruling — deliberately. Seedling DROPS a doorless
     * region because a vanilla room with no link is a trap room or an orphan
     * that no link in the whole map reaches (`seedlingAtlasDerivation.js:405-418`).
     * A maze library entry with no link yet is a room the author has ADDED and
     * not wired, which is the normal state of an editor mid-edit; dropping it
     * would make it vanish from the strip. The REPORT names it instead — an
     * unwired exit is a `warn` and an unreachable region REFUSES the export.
     */
    const atlas = session.atlas;
    return {
        atlas,
        dropped: [],
        stats: {
            rooms: entries.length,
            regions: atlas.regions.length,
            exits: atlas.regions.reduce((n, r) => n + r.exits.length, 0),
            locations: atlas.regions.reduce((n, r) => n + r.locations.length, 0),
            connections: atlas.vanilla_layout.connections.length,
        },
    };
}

/**
 * ⛓ The derivation a SESSION's record goes through: derive, then hang the
 * overlay's authored EXIT rules on it.
 *
 * ⛓ `applyOverlayRules` comes from `procgenCore/setOverlay.js` — E3b moved it
 * there, which is what §26.5 asked for. It is a pure function of an atlas and a
 * `Map<room, Map<exit_id, rule>>` with nothing Seedling in it, and its refusal
 * (*"a rule that vanished would leave the author believing a door is gated and
 * the compiler treating it as free"*) is exactly the refusal the maze wants.
 * ⛓ Until E3b this import reached across into `seedlingDemo/`, which is the
 * cross-substrate reach the move retires.
 */
export function deriveAtlasOf(record, deps = {}) {
    const library = record?.library ?? {};
    const derived = deriveAtlas(library.entries ?? [], record?.overlay ?? {}, {
        ...deps,
        // ⛓ THE ENVELOPE IS THE LIBRARY'S OWN — its id is the map document,
        //   its name and description travel, and a caller may still override.
        atlas: {
            mapDocument: library.library_id,
            // ⛓⛓ THE LIBRARY IS WHAT THIS ATLAS IS *OF* — its `game` (W1).
            //   Not the entries' substrate: that answers "what plays it" and
            //   rides on the regions now. `name` first because it is what a
            //   reader sees in `rules.region_atlas.game`; `library_id` when the
            //   pack is unnamed, so the slot is never empty and never a literal.
            //   ⚠ Both are the library's own — every committed pack carries a
            //   `name` (demo-maze/bounce/runner, measured), so the fallback is
            //   for hand-assembled and in-editor libraries.
            ...(library.name || library.library_id
                ? { game: library.name || library.library_id } : {}),
            ...(library.name ? { name: library.name } : {}),
            ...(library.description ? { description: library.description } : {}),
            ...(deps.atlas ?? {}),
        },
    });
    const { atlas, applied } = applyOverlayRules(derived.atlas, exitRulesByRoom(record?.overlay));
    return { ...derived, atlas, applied };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE FIRST MAZE-OWNED `compileRegionAtlas` CALLER
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ The condition vocabulary. An EDITOR's author has already typed the rule
 * tree, so `resolveCondition` is the IDENTITY and `conditionKey` is the tree's
 * canonical text — the same ruling D1 made for the Seedling overlay's
 * `locationGuard` (§20.2: *"a second indirection would name a thing already in
 * hand"*). ⚠ A maze payload declares no cell conditions at all, so neither is
 * reached by the projection today; they are supplied because the compiler
 * refuses without them and a caller that passed `undefined` would be relying on
 * that.
 */
export const MAZE_CONDITION_DEPS = Object.freeze({
    resolveCondition: (condition) => condition ?? null,
    conditionKey: (condition) => JSON.stringify(condition),
});

/**
 * ⛓⛓ **`rules.json` FOR A MAZE LIBRARY** — the same signature Seedling's
 * `rulesJsonOf` has, so `setEditorCore.reportOver` binds either one.
 *
 * ⛔ `gridFor` reads the ENTRY the region's `map_ref` names. A region without an
 * integer `map_ref` gets no grid and the projection reports it as
 * `regions_without_map_ref` — this derivation gives every region one, so that
 * list is empty and the REPORT would say so if it ever were not.
 */
export function rulesJsonOf(session, deps = {}, { compileRegionAtlas, gameName = 'Maze Library' } = {}) {
    if (typeof compileRegionAtlas !== 'function') {
        fail('mazeAtlasDerivation: rulesJsonOf needs `compileRegionAtlas` injected — it lives in '
            + '`procgenPipeline/` and this module names no pipeline dependency of its own');
    }
    const record = session.record();
    const entries = record?.library?.entries ?? [];
    const derived = deriveAtlasOf(record, deps);
    const { rules, report } = compileRegionAtlas(derived.atlas, {
        gameName,
        sidecarFlavor: 'maze',
        mazeProjection: {
            ...MAZE_CONDITION_DEPS,
            gridFor: (region) => {
                const entry = entries[region.map_ref];
                return entry ? mazeGridFor(entry.payload) : null;
            },
        },
    });
    return { rules, report, atlas: derived.atlas, stats: derived.stats, dropped: derived.dropped };
}

/** ⛓ Re-exported so the tile vocabulary has ONE spelling here too. */
export { TILE_FLOOR, TILE_WALL };
