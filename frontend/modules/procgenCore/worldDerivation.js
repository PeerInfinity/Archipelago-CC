// frontend/modules/procgenCore/worldDerivation.js
/**
 * ⛓⛓⛓ **THE WORLD'S ATLAS — TWO PARTS' OWN ATLASES, NAMESPACED, MERGED, AND
 * THE CROSSINGS BETWEEN THEM WIRED.**
 *
 * EDITOR INTEGRATION slice W2 (`NewDocs/plans/editor-integration.md` §2.2 #3).
 * W1 taught the atlas a per-region `substrate` and `compileRegionAtlas` a
 * per-region dispatch; this is what puts regions of two substrates into ONE
 * atlas for it to dispatch over.
 *
 * ── ⛔ EVERY SUBSTRATE HALF ARRIVES INJECTED ──────────────────────────
 *
 * `procgenCore/` may not import `seedlingDemo/`, `mazeRoom/` or `flashPanel/`
 * (`bindingContract.test.js` reads the directory and refuses it), so a part
 * arrives as `{id, atlas}` — its atlas ALREADY DERIVED by its own derivation,
 * already carrying `region.substrate`. This module knows only what an atlas is.
 *
 * ── ⛓⛓ WHAT IT DOES, IN ORDER ─────────────────────────────────────────
 *
 * 1. Every part's regions are RENAMED `<partId>.<region_id>` through
 *    `atlasOps`' own `rename-region`, which rewrites the part's connections and
 *    its start with them. ⛔ Not by hand: the op already refuses a collision
 *    and already knows every place an id is referenced, and a second spelling
 *    would be a second answer.
 * 2. The regions and the connections are CONCATENATED in part order. Each
 *    region object travels VERBATIM — its `map_ref`, its `substrate`, its
 *    exits, its locations and its key ORDER — because a region is already
 *    schema-shaped and rebuilding it through `add-region` would drop everything
 *    that op does not enumerate ([[reference_seedling_arc_traps]] 823).
 * 3. Each `world.links[]` becomes ONE `atlasOps.connect`.
 *
 * ── ⛔⛔ `map_ref` IS CARRIED VERBATIM, AND `tile_space.map_document` NAMES
 *        THE WORLD — MEASURED, AND IT IS A RESIDUE ─────────────────────
 *
 * W2 measurement 3. `regionAtlasValidator` requires `tile_space.map_document`
 * as soon as ANY region names a `map_ref` — *"the document those level ids live
 * in has to be identified"* — and resolves the ids against real levels ONLY
 * when the caller injects a parsed `mapDoc`. A merged atlas's `map_ref`s live
 * in TWO documents (a Seedling room INDEX in the set, a library entry INDEX in
 * the pack), so no single document can be named truthfully. ⇒ the field names
 * the WORLD, which is the thing that knows which part each region came from,
 * and a world atlas can never be handed a `mapDoc` for resolution. ⛔ SAID
 * OUT LOUD rather than left silent: the resolution pass is not available here,
 * and the compensating check is that each part's own derivation already
 * resolved its half before the merge. `map_ref` itself is carried VERBATIM
 * because it is meaningful only to the part's own sidecar builder — the flash
 * row reads it as `level`, the maze row as the entry index its `gridFor`
 * indexes with.
 *
 * ── ⛔⛔ `tile_space.tile_size` IS THE START PART'S, AND A DISAGREEMENT IS
 *        A NOTE, NOT A SILENCE ────────────────────────────────────────
 *
 * Measured: a Seedling set derives `tile_size: 16` (its coordinates are
 * PIXELS ÷ 16) and a maze library derives `1` (a maze payload's coordinates ARE
 * tiles). One atlas has one `tile_space`. What the value actually reaches,
 * measured over the compiler: `buildFlashRegionSidecars` uses it to turn an
 * entrance TILE into a spawn in PIXELS (`entrance_spawn`, `target_spawn`) and
 * to advertise `tile_size` in the payload; `projectAtlasToMaze` uses it for
 * NOTHING BUT the advertised `tile_size` field, and no reader in the tree reads
 * that field back (grepped: two hits, one a writer and one a docblock). ⇒ the
 * start part's value is the one that has to be right, the other part's regions
 * are unaffected, and a disagreement is reported through `note` so the choice
 * is visible rather than invented.
 *
 * ── ⛔⛔ A WORLD LINK DISPLACES A PART-INTERNAL CONNECTION, AND SAYS SO ─
 *
 * MEASURED, and it is the whole reason this is not a refusal: a generated
 * Seedling set has NO spare exit. Every exit its derivation emits comes from a
 * transition entity that already names a room, so every one is wired — measured
 * over 2-, 3- and 4-room linked sets: 0 unwired exits in each. And Seedling's
 * only way to free an exit is to DELETE it (§20.5 — an unwired exit IS a
 * deleted exit, because `int("")` warps the player to room 0), which leaves no
 * door to cross through. So *"refuse a world link on an exit the part already
 * wired"* would make a Seedling→maze door impossible to author at all.
 *
 * ⇒ **the world's link is the MORE SPECIFIC statement**: the part-internal
 * connection claiming either endpoint is UNWIRED first, and each displacement
 * is reported by name. The part's own document still says that teleporter leads
 * to its own room 0 — it must, to be a valid level set — and the world says the
 * door actually crosses to the other part. The freed far endpoint becomes an
 * UNWIRED exit, which the compiler's `report.unwired_exits` and the set
 * editor's REPORT both already name.
 */

import { applyAtlasOp } from './atlasOps.js';
import {
    assertWorld, namespacedRegionId, partIdsOf, splitNamespacedRegionId,
} from './worldDocument.js';

export class WorldDerivationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WorldDerivationError';
    }
}

const fail = (message) => { throw new WorldDerivationError(`worldDerivation: ${message}`); };

export const isWorldDerivationRefusal = (e) => e?.name === 'WorldDerivationError';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** ⛓ ONE seam onto `atlasOps` — it returns `{ok, error}` and this throws. */
const op = (atlas, spec, where) => {
    const result = applyAtlasOp(atlas, spec);
    if (!result.ok) fail(`${where} — ${result.error}`);
    return result.atlas;
};

/**
 * ⛓⛓ **WHICH REGION OF A PART IS ROOM `n`** — `map_ref`, because that is what
 * BOTH derivations write it as (Seedling's is the room index, the maze's the
 * entry index) and neither has any other addressable link back to the set.
 * ⛔ REFUSES BY NAME, listing the rooms the part's atlas does hold: a Seedling
 * region can be DROPPED by its own derivation (a room no link reaches), so
 * "room 4 of part seed" really can name nothing.
 */
export function regionIdOfRoom(atlas, room, partId) {
    const region = (atlas.regions ?? []).find((r) => r.map_ref === room);
    if (region === undefined) {
        const held = (atlas.regions ?? [])
            .map((r) => r.map_ref).filter((m) => m !== undefined);
        fail(`part "${partId}" has no region for room ${JSON.stringify(room)} — its atlas holds `
            + `map_ref ${held.length ? held.join(', ') : '(none)'}. ⛓ A part's own derivation may `
            + 'DROP a room (Seedling drops one no link in the whole set reaches), so a link into '
            + 'one names a region that was never built.');
    }
    return region.region_id;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE MERGE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} input
 * @param {Array<{id: string, atlas: object, regionIdOfRoom?: Function}>} input.parts
 *   each part's ALREADY-DERIVED atlas, in the world's declaration order. ⛓ Part
 *   0 is the world's START part and the one whose `game` and `tile_size` the
 *   merged atlas takes — one rule serving both, because `substrateIdFor(atlas.game)`
 *   is what keys the compiler's FLASH sidecar row, so the atlas's `game` has to
 *   be the game whose flash rooms are in it, and the start is where play begins.
 * @param {Array<object>} [input.links]  `world.links` — see `worldDocument`
 * @param {object} [input.world]         the world document, for its naming
 * @param {object} [deps]
 * @param {Function} [deps.note]         `(sentence) => void`
 * @param {object} [deps.atlas]          envelope overrides `{id, game, name, description,
 *                                       tileSize, mapDocument}`
 * @returns {{atlas, notes: string[], displaced: object[], stats: object}} UNSTAMPED —
 *   the caller owns identity, exactly as both part derivations leave it.
 */
export function deriveWorldAtlas({ parts = [], links = [], world = null } = {}, deps = {}) {
    if (!Array.isArray(parts) || parts.length === 0) {
        fail('deriveWorldAtlas needs a non-empty `parts` array of {id, atlas} — a world with no '
            + 'parts has no regions and is not an atlas anybody can compile');
    }
    const notes = [];
    const note = (sentence) => { notes.push(sentence); deps.note?.(sentence); };
    const seen = new Set();
    const namespaced = parts.map(({ id, atlas }) => {
        if (!isPlainObject(atlas) || !Array.isArray(atlas.regions)) {
            fail(`part "${id}" was given ${JSON.stringify(atlas)} for an atlas — each part's OWN `
                + 'derivation runs first and hands its result in; this module derives nothing');
        }
        if (seen.has(id)) fail(`two parts are called "${id}"`);
        seen.add(id);
        let next = atlas;
        /**
         * ⛔ THE RENAME IS THE OP'S, not a hand rewrite: it refuses a collision,
         * rewrites `vanilla_layout.connections` and `start_region` with the id,
         * and post-checks the location names the AP allocator dedupes. Reading
         * the ORIGINAL region list is what makes renaming to a name that is
         * about to be freed impossible to get wrong.
         */
        for (const region of atlas.regions) {
            next = op(next, {
                op: 'rename-region',
                from: region.region_id,
                to: namespacedRegionId(id, region.region_id),
            }, `part "${id}"`);
        }
        return { id, atlas: next, original: atlas };
    });

    const head = namespaced[0];
    const ids = namespaced.map((p) => p.id);
    const worldId = deps.atlas?.id ?? world?.world_id ?? world?.name
        ?? `world-of-${ids.join('+')}`;
    const tileSizes = namespaced.map((p) => p.atlas.tile_space?.tile_size ?? 1);
    const tileSize = deps.atlas?.tileSize ?? tileSizes[0];
    if (new Set(tileSizes).size > 1) {
        note(`the parts disagree about \`tile_space.tile_size\` (${ids
            .map((id, i) => `${id}: ${tileSizes[i]}`).join(', ')}) and one atlas has ONE tile `
            + `space — the START part "${head.id}"'s ${tileSize} is what the merged atlas says. `
            + '⛓ It reaches the FLASH sidecar builder, which turns an entrance tile into a spawn '
            + 'in PIXELS; the maze projection uses it only to advertise `tile_size` in a payload, '
            + 'and nothing reads that field back.');
    }

    const regions = namespaced.flatMap((p) => p.atlas.regions);
    const connections = namespaced.flatMap((p) => p.atlas.vanilla_layout?.connections ?? []);
    const startRegion = deps.atlas?.startRegion ?? head.atlas.vanilla_layout?.start_region ?? '';

    // Built in the order the schema documents, exactly as `createEmptyAtlas` does.
    let atlas = {
        schema_version: head.atlas.schema_version,
        atlas_id: worldId,
        game: deps.atlas?.game ?? head.atlas.game,
    };
    const name = deps.atlas?.name ?? world?.name;
    const description = deps.atlas?.description ?? world?.description;
    if (name) atlas.name = name;
    if (description) atlas.description = description;
    atlas.provenance = { generator: 'world-derivation' };
    atlas.tile_space = { tile_size: tileSize };
    /**
     * ⛓ NAMED FOR THE WORLD — the docblock's measurement. Every region here
     * carries a `map_ref` and the validator requires the field; no single
     * document holds both parts' ids, so the only true answer is the document
     * that knows which part each region came from.
     */
    atlas.tile_space.map_document = deps.atlas?.mapDocument ?? worldId;
    atlas.regions = regions;
    atlas.vanilla_layout = { start_region: startRegion, connections };
    if (head.atlas.vanilla_layout?.start_sub_region !== undefined) {
        atlas.vanilla_layout.start_sub_region = head.atlas.vanilla_layout.start_sub_region;
    }

    /* ── the crossings ────────────────────────────────────────────── */
    const byId = new Map(namespaced.map((p) => [p.id, p]));
    const displaced = [];
    (links ?? []).forEach((link, i) => {
        const label = `world.links[${i}]`;
        const endpoint = (side) => {
            const e = link?.[side];
            const part = byId.get(e?.part);
            if (part === undefined) {
                fail(`${label}.${side} names part ${JSON.stringify(e?.part)}, and this world's `
                    + `parts are ${ids.join(', ')}`);
            }
            const resolve = parts.find((p) => p.id === e.part)?.regionIdOfRoom ?? regionIdOfRoom;
            const localId = resolve(part.original, e.room, e.part);
            const regionId = namespacedRegionId(e.part, localId);
            const region = atlas.regions.find((r) => r.region_id === regionId);
            if (!region?.exits?.some((x) => x.exit_id === e.exit)) {
                fail(`${label}.${side} names exit ${JSON.stringify(e.exit)} of room ${e.room} in `
                    + `part "${e.part}" (region "${regionId}"), which the part's derivation did `
                    + `not build. Its exits are ${(region?.exits ?? []).map((x) => x.exit_id)
                        .join(', ') || '(none)'}.`);
            }
            return { key: [regionId, e.exit], part: e.part, room: e.room };
        };
        const from = endpoint('from');
        const to = endpoint('to');
        /**
         * ⛔ DISPLACE FIRST, AND NAME IT. See the file docblock: a generated
         * Seedling set has no spare exit, so a world link is always landing on
         * a door the part already wired, and refusing would make a cross-part
         * door unauthorable rather than safe.
         */
        for (const side of [from, to]) {
            const [regionId, exitId] = side.key;
            const held = atlas.vanilla_layout.connections.find(
                (c) => (c.from[0] === regionId && c.from[1] === exitId)
                    || (c.to[0] === regionId && c.to[1] === exitId),
            );
            if (held === undefined) continue;
            /**
             * ⛔⛔ **DISPLACEMENT IS FOR A PART-INTERNAL CONNECTION ONLY.** A
             * connection whose two endpoints are in DIFFERENT parts was put
             * there by an EARLIER world link, and unwiring it would let the
             * second link silently steal the first's endpoint — the exact
             * opposite of `world.links`' own "an exit crosses to exactly one
             * place" law. Left alone, `atlasOps.connect` refuses it below with
             * its each-endpoint-once sentence, and the wrapper names the link.
             */
            if (partOfRegion(held.from[0]) !== partOfRegion(held.to[0])) continue;
            atlas = op(atlas, { op: 'unwire', region: regionId, exit: exitId }, label);
            const far = held.from[0] === regionId && held.from[1] === exitId ? held.to : held.from;
            displaced.push({ link: i, region: regionId, exit: exitId, was: far });
            note(`${label} DISPLACED the part-internal connection ${regionId}/${exitId} → `
                + `${far[0]}/${far[1]} — part "${side.part}"'s own document still says that door `
                + `leads there, and the WORLD says it crosses to the other part. ${far[0]}/${far[1]} `
                + 'is UNWIRED now and the report names it.');
        }
        atlas = op(atlas, {
            op: 'connect', from: from.key, to: to.key, one_way: link.one_way,
        }, label);
    });

    return {
        atlas,
        notes,
        displaced,
        dropped: [],
        stats: {
            parts: ids.length,
            regions: atlas.regions.length,
            exits: atlas.regions.reduce((n, r) => n + (r.exits?.length ?? 0), 0),
            locations: atlas.regions.reduce((n, r) => n + (r.locations?.length ?? 0), 0),
            connections: atlas.vanilla_layout.connections.length,
            links: (links ?? []).length,
            displaced: displaced.length,
            substrates: atlas.regions.reduce((counts, r) => {
                if (r.substrate === undefined) return counts;
                return { ...counts, [r.substrate]: (counts[r.substrate] ?? 0) + 1 };
            }, {}),
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ FROM A RECORD — each part's own derivation first, then the merge
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ The derivation a world SESSION's record goes through.
 *
 * @param {object} record  `{world, parts: {<id>: doc}}`
 * @param {object} o
 * @param {Array<{id, deriveAtlasOf, recordOf, regionIdOfRoom?}>} o.parts  the
 *   injected substrate halves, in the world's own declaration order
 * @param {object} [o.deps]  `{<partId>: <that part's derivation deps>}`
 */
export function deriveWorldAtlasOf(record, { parts = [], deps = {} } = {}) {
    const world = record?.world;
    assertWorld(world, { docs: record?.parts ?? {} });
    const declared = partIdsOf(world);
    const given = parts.map((p) => p.id);
    if (declared.join('|') !== given.join('|')) {
        fail(`this world declares parts ${declared.join(', ')} and the adapter was built over `
            + `${given.join(', ') || '(none)'} — a part with no injected derivation cannot be `
            + 'merged, and one injected but not declared would derive a document the world does '
            + 'not hold. The ORDER matters too: part 0 is the start.');
    }
    const derivedParts = parts.map((part) => {
        if (typeof part.deriveAtlasOf !== 'function' || typeof part.recordOf !== 'function') {
            fail(`part "${part.id}" was injected without a \`deriveAtlasOf\` and a \`recordOf\` — `
                + 'both are the SUBSTRATE\'s and `procgenCore/` may import neither');
        }
        const partRecord = part.recordOf(record.parts[part.id], world.overlays[part.id]);
        return {
            id: part.id,
            atlas: part.deriveAtlasOf(partRecord, deps[part.id] ?? {}).atlas,
            regionIdOfRoom: part.regionIdOfRoom,
        };
    });
    /**
     * ⛓⛓⛓ DEDUP M10 — **THE PER-PART ATLASES COME BACK BESIDE THE MERGE.**
     * They were derived here and DISCARDED, and the world REPORT then derived
     * every one of them again to say its per-part rows (the merge renames every
     * region and the local `map_ref` is what those rows join on, so a slice of
     * the merged atlas cannot answer them). ⛔ Returned rather than cached: a
     * caller that already has this object has the answer, and one that does not
     * derives for itself exactly as before.
     */
    return {
        ...deriveWorldAtlas({ parts: derivedParts, links: world.links, world }, deps.world ?? {}),
        parts: derivedParts.map(({ id, atlas }) => ({ id, atlas })),
    };
}

/**
 * ⛓⛓ **`rules.json` FOR A WORLD** — the same signature `setEditorCore.reportOver`
 * binds for either single-substrate adapter, so a world is a set session like
 * any other as far as the REPORT is concerned.
 *
 * ⛔ `compileOptions` is where the MAZE row's `gridFor` and any injected
 * `sidecarBuilders` arrive. This module names no substrate and no pipeline
 * dependency: `compileRegionAtlas` itself is injected for exactly the reason
 * the maze's own `rulesJsonOf` injects it.
 */
export function worldRulesJsonOf(session, deps = {}, {
    compileRegionAtlas, parts = [], gameName = 'World', compileOptions = {},
    projectRegions = null,
} = {}) {
    if (typeof compileRegionAtlas !== 'function') {
        fail('worldRulesJsonOf needs `compileRegionAtlas` injected — it lives in '
            + '`procgenPipeline/` and this module names no pipeline dependency of its own');
    }
    const record = typeof session?.record === 'function' ? session.record() : session;
    const derived = deriveWorldAtlasOf(record, { parts, deps });
    /**
     * ⛓⛓⛓ DEDUP M9 — **THE ONE HOOK A SECOND `rules.json` PATH NEEDED.** The
     * maze lab's ALL-MAZE download was a second copy of this function whose one
     * real step is projecting each region before the compile (it strips the
     * authored `substrate` so the compiler's built-in maze row runs everywhere)
     * — and, being a copy, it dropped `stats` and `dropped` from its return, so
     * one page had two `rules.json` paths with two shapes.
     *
     * ⛔ **A `projectRegions` HOOK AND NOT A `compileOptions` FLAVOUR**, for a
     * reason the return value states: the projected atlas is what this function
     * HANDS BACK (`atlas:` below), and the maze's own row reads it to assert
     * nothing was written back. A compile-time flag could only tell the
     * compiler; it could not answer *"which atlas was compiled"*.
     *
     * ⛓ It DEFAULTS TO NULL and the no-hook path returns `derived.atlas`
     * ITSELF, unchanged and un-copied — which is why `worldDerivation.test.js`'s
     * existing rows did not have to move.
     */
    const atlas = projectRegions === null ? derived.atlas : {
        ...derived.atlas,
        regions: (derived.atlas.regions ?? []).map((region) => projectRegions(region)),
    };
    const { rules, report } = compileRegionAtlas(atlas, { gameName, ...compileOptions });
    return {
        rules,
        report,
        atlas,
        notes: derived.notes,
        displaced: derived.displaced,
        stats: derived.stats,
        dropped: derived.dropped,
    };
}

/** ⛓ Which part a merged region came from — the split, for a readout. */
export function partOfRegion(regionId) {
    return splitNamespacedRegionId(regionId)?.part ?? null;
}
