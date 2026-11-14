/**
 * mazeRoom/mazeTileArt — **A PACK CAN SUPPLY THE MAZE'S TILES** (content sets R2b, ⚖ the user 2026-11-11).
 *
 * Three parts, the maze's half of a tileset:
 *
 *   · `MAZE_ART_KEYS` — THE KEY TABLE: every thing the plain maze painter draws in a `COLORS` colour that NAMES A
 *     THING (a floor, a wall, the player, a block…) → an art key in the `maze` namespace. It is the maze's
 *     declaration of what art it can show. The state signals and UI colours (a blocked exit, a blocked location,
 *     the grid, the lanes, a pull's live/inert tint, its mouth, a block's edge) are not things and get no key: they
 *     stay `COLORS`, whatever the theme.
 *   · `drawTileArt` — THE DRAW SEAM: the painter asks it once per thing. When the loaded art has the key AND its
 *     sheet decoded, it draws the key's frame 0 scaled to the cell and answers true; otherwise it draws NOTHING and
 *     answers false, and the painter does exactly what it did before this file existed (the `COLORS` fill). "Not
 *     available" is every case — no art loaded, the key absent from the stack, the sheet failed to decode — and none
 *     of them is a refusal or a blank tile (⚖ the user: "If an image isn't available, then it should fall back to
 *     the behavior if there is no library").
 *   · `drawConceptArt` — A CONCEPT GATE'S OR ITEM'S ART (content sets R5, ⚖ the user 2026-11-14): a gate or item row
 *     names the mechanic it realises (`"concept": "water"`); at play the stack's `concepts` layer says which pack
 *     concept presents that mechanic for the row's role and carries an `art` key (`conceptArtKeys`), and the seam
 *     draws that key — or nothing, and the painter draws the row's baked colour and symbol, as before. Nothing is
 *     baked (⚖ Q8: art resolves by key at play), so no world document moves.
 *   · `loadMazeTileArt` — THE PLAY-TIME LOAD: the ART layer of a world's content stack (`loadPackStack(ids,
 *     { only: ['art'] })`, as `mazeSeedlingSkin.loadSeedlingArt` loads `graphics.seedling`), the library, the
 *     decoded sheets. A later pack in the stack overriding `maze:tile/wall` wins: that is `mergeKeyed`, the pack
 *     stack's own rule — ⛔ no second merge lives here (⚖ "If there is an existing system for this, I want to use
 *     that instead of making a new one").
 *
 * ⛔ PRESENTATION ONLY, AND OUTSIDE THE MAZE ENGINE'S IMPORT CLOSURE. Nothing in
 * `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure` imports this file, and this file imports
 * nothing from it (`mazeTileArt.test.js` pins both). A content set changes how the maze looks, never its logic.
 *
 * ⛔ DOM-FREE. The decoder and the shape rasteriser are injected (`artLibrary.browserDecoder` /
 * `browserRasteriser` in a browser, stubs in node), as the art library's own `loadSheetImages` takes them; the seam draws with whatever `ctx.drawImage` the caller's context has.
 *
 * Beside the Seedling skin, not instead of it: a Seedling-atlas world (`mazeSeedlingSkin.seedlingSkinFor`) draws its
 * level's own art and the panel passes no tile art at all.
 */
import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary, loadSheetImages } from '../artLibrary/artLibrary.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';

/** The art keys' namespace: the maze's own, like `seedling:*` is the Seedling pack's. */
export const MAZE_ART_NAMESPACE = 'maze';

/**
 * ⛓ THE KEY TABLE — maze thing → art key. One row per `COLORS` entry that names a thing (R2's measurement, §8 of
 * its report: 22 keys, of which these name things). Two things the colour table spells as one state are split here
 * because each has its own picture: a button UP and DOWN (`COLORS.button` filled or not). `COLORS` keys with no row:
 * `exitBlocked`, `locationBlocked`, `grid`, `laneArmed`, `laneSilent`, `pullLive`, `pullInert`, `pullMouth`,
 * `blockEdge` — state signals and edges, drawn as today over or instead of nothing.
 *
 * `colors` names the `COLORS` keys the row's fallback paints with, so the table can be checked against the
 * painter's colour table rather than trusted.
 */
export const MAZE_ART_KEYS = Object.freeze({
    floor: Object.freeze({ key: 'maze:tile/floor', colors: ['floor'], what: 'an open floor cell (the base layer)' }),
    wall: Object.freeze({ key: 'maze:tile/wall', colors: ['wall'], what: 'a wall cell (the base layer)' }),
    exit: Object.freeze({ key: 'maze:tile/exit', colors: ['exit'], what: 'an exit cell whose gate is open (a closed one stays the `exitBlocked` fill)' }),
    entrance: Object.freeze({ key: 'maze:tile/entrance', colors: ['entrance'], what: 'the entrance cell (today a green border)' }),
    manaTile: Object.freeze({ key: 'maze:tile/mana', colors: ['manaTile'], what: 'a mana-refill tile (today a diamond labelled M; faded once collected)' }),
    player: Object.freeze({ key: 'maze:character/player', colors: ['player'], what: 'the player (today a disc; the facing tick is drawn over it either way)' }),
    trap: Object.freeze({ key: 'maze:object/trap', colors: ['trap'], what: 'an arrow trap\'s own cell (its lane stays the armed/silent tint)' }),
    block: Object.freeze({ key: 'maze:object/block', colors: ['block', 'blockEdge'], what: 'a pushable block (the walked kind)' }),
    blockStruck: Object.freeze({ key: 'maze:object/block-struck', colors: ['blockStruck', 'blockEdge'], what: 'a struck block kind (fire, spear, a woken corpse)' }),
    blockDormant: Object.freeze({ key: 'maze:object/block-dormant', colors: ['blockDormant', 'blockEdge'], what: 'a dormant block kind (a turret)' }),
    button: Object.freeze({ key: 'maze:object/button', colors: ['button'], what: 'a button, UP' }),
    buttonDown: Object.freeze({ key: 'maze:object/button-down', colors: ['button'], what: 'a button, DOWN (held by the player, a block or a latch)' }),
    pulser: Object.freeze({ key: 'maze:object/pulser', colors: ['pulser'], what: 'a pulser\'s body on its wall cell (its ring stays the armed/silent signal)' }),
    pull: Object.freeze({ key: 'maze:object/pull', colors: ['pullTrap', 'pullMouth'], what: 'a pull\'s trap cell (its disc stays the live/inert tint)' }),
});

/** The thing names (`MAZE_ART_KEYS`' own keys) — what `drawTileArt` accepts. */
export const MAZE_ART_THINGS = Object.freeze(Object.keys(MAZE_ART_KEYS));

export class MazeTileArtError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeTileArtError';
    }
}

/**
 * The view field's value: `{ art, images }` with `art` an art library (`createArtLibrary`) and `images` its decoded
 * sheets (`Map(sheetRef → image)`), or null. Refuses a malformed one by name (a typo in a caller must not read as
 * "no art").
 */
export function tileArtRefusal(tileArt) {
    if (tileArt === null) return null;
    if (!tileArt || typeof tileArt !== 'object') return `tileArt must be null or {art, images}, got ${JSON.stringify(tileArt)}`;
    if (typeof tileArt.art?.has !== 'function' || typeof tileArt.art?.frameRect !== 'function') {
        return 'tileArt.art must be an art library (artLibrary.createArtLibrary)';
    }
    if (!(tileArt.images instanceof Map)) return 'tileArt.images must be a Map of sheetRef → decoded image (artLibrary.loadSheetImages)';
    if (tileArt.conceptArt !== undefined && (!tileArt.conceptArt || typeof tileArt.conceptArt !== 'object' || Array.isArray(tileArt.conceptArt))) {
        return 'tileArt.conceptArt must be { role: { mechanic: { key } } } (mazeTileArt.conceptArtKeys)';
    }
    return null;
}

/**
 * The frame the seam would draw for `thing`, or null when art is not available for it (no art, the key absent from
 * the stack, the sheet not decoded). `{ key, image, sx, sy, sw, sh, pack }`.
 */
export function tileArtFrame(tileArt, thing) {
    const row = MAZE_ART_KEYS[thing];
    if (!row) throw new MazeTileArtError(`mazeTileArt: no thing "${thing}" in the key table (${MAZE_ART_THINGS.join(', ')})`);
    if (!tileArt || !tileArt.art.has(row.key)) return null;
    const r = tileArt.art.frameRect(row.key, 0);
    const image = r ? tileArt.images.get(r.sheetRef) : null;
    if (!image) return null;
    return { key: row.key, image, sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh, pack: tileArt.art.packOf(row.key) };
}

/**
 * ⛓ THE SEAM. Draw `thing`'s frame 0 into the rectangle `(dx, dy, dw, dh)` and answer true — or draw nothing and
 * answer false, and the caller paints its `COLORS` fallback. The frame is scaled to the rectangle; the art's
 * `origin` is not used (a tile fills its cell).
 */
export function drawTileArt(ctx, tileArt, thing, dx, dy, dw, dh) {
    const f = tileArtFrame(tileArt, thing);
    if (!f) return false;
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, dx, dy, dw, dh);
    return true;
}

/** Which of the key table's keys a library carries: `{ thing: pack }` for each, the rest absent. */
export function keyedThings(art) {
    const out = {};
    if (!art) return out;
    for (const [thing, row] of Object.entries(MAZE_ART_KEYS)) {
        if (art.has(row.key)) out[thing] = art.packOf(row.key);
    }
    return out;
}

/**
 * ⛓ CONTENT SETS R5 — **WHICH ART KEY A CONCEPT GATE OR ITEM DRAWS, PER ROLE AND MECHANIC.** For each role of
 * `contentRoles` (the maze entry's, `mazeContent.MAZE_CONTENT_ROLES`) and each mechanic it accepts (`accepts.presents`):
 * the pack concepts that present that mechanic AND carry an `art` key, the LATEST pack in `ids` first — the same
 * ranking `mazeContent.presentedLook` uses for the baked look. A role's `needs` are NOT asked: they say what a concept
 * must carry to be BAKED (a `look`), and art is not baked, so a theme can give a mechanic a picture without a look of
 * its own (its colour and symbol then still come from an earlier pack, as before).
 *
 * ⚠ The filter is written here, not `contentRoles.candidatesForRole`: that module imports `procgenCore/concepts.js`,
 * which is in the engine closure, and this file must import nothing from it (`mazeTileArt.test.js`).
 *
 * Returns `{ role: { mechanic: { key, concept, pack } } }` (frozen): `key` the art key, `concept` the pack concept
 * that named it, `pack` that concept's pack. A mechanic no pack gives art is absent. The key is NOT checked against
 * the art library here: one the stack's art does not resolve draws the default way (`conceptArtFrame`).
 */
export function conceptArtKeys(contentRoles, packConcepts, ids) {
    const out = {};
    const all = packConcepts.keys().map((k) => packConcepts.get(k));
    const rank = (c) => ids.indexOf(c.pack);
    for (const [roleId, role] of Object.entries(contentRoles ?? {})) {
        const byMechanic = {};
        for (const mechanic of role?.accepts?.presents ?? []) {
            const best = all.filter((c) => c.presents === mechanic && typeof c.art === 'string')
                .sort((a, b) => rank(b) - rank(a))[0];
            if (best) byMechanic[mechanic] = Object.freeze({ key: best.art, concept: best.key, pack: best.pack });
        }
        if (Object.keys(byMechanic).length) out[roleId] = Object.freeze(byMechanic);
    }
    return Object.freeze(out);
}

/**
 * The frame a concept gate or item of mechanic `conceptId` draws in role `roleId`, or null when it draws the default
 * way: no art loaded, no pack concept gives the mechanic an art key, or the stack's art does not resolve that key (or
 * its sheet did not decode). `{ key, image, sx, sy, sw, sh, pack }`, `pack` the ART's pack.
 */
export function conceptArtFrame(tileArt, roleId, conceptId) {
    const entry = tileArt?.conceptArt?.[roleId]?.[conceptId];
    if (!entry || !tileArt.art.has(entry.key)) return null;
    const r = tileArt.art.frameRect(entry.key, 0);
    const image = r ? tileArt.images.get(r.sheetRef) : null;
    if (!image) return null;
    return { key: entry.key, image, sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh, pack: tileArt.art.packOf(entry.key) };
}

/** ⛓ THE SEAM for a concept gate or item: as `drawTileArt`, by role and mechanic instead of by thing. */
export function drawConceptArt(ctx, tileArt, roleId, conceptId, dx, dy, dw, dh) {
    const f = conceptArtFrame(tileArt, roleId, conceptId);
    if (!f) return false;
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, dx, dy, dw, dh);
    return true;
}

/**
 * ⛓ THE PLAY-TIME LOAD. `ids` is the world's effective content stack (`worldContent.effectiveContentStack`), in
 * override order; `io` is `{ base, readJson }` (`worldContent.browserPackIo()` in a browser); `decode(url)` turns a
 * sheet into an image (`artLibrary.browserDecoder()`) and `rasterise(shape)` a SHAPE entry
 * (`artLibrary.browserRasteriser()`; without one a shape key falls back, named in `failed`). A key is drawn the same
 * way whichever kind it is: a shape is rasterised once here into a one-frame sheet of its own.
 *
 * `contentRoles` (optional; the maze entry's `contentRoles`) also loads the stack's `concepts` layer and resolves each
 * concept gate's and item's art key (`conceptArtKeys`, R5). Without it only the `art` layer is read, as before.
 *
 * Resolves `{ ids, tileArt, failed, keyed, conceptArt }` (`conceptArt` as `conceptArtKeys`, `{}` without roles): `tileArt` is the seam's `{ art, images }`, or null when no pack in
 * the stack carries a key of the table (nothing is decoded then, and the maze draws as it always has); `failed`
 * lists the sheets that did not decode, by name (their keys fall back); `keyed` is `keyedThings`. An empty stack
 * reads nothing. A pack that cannot be read is refused by name (`ContentPackError`): the caller catches it and draws
 * without art.
 */
export async function loadMazeTileArt(ids, { base, readJson, decode, rasterise = null, contentRoles = null }) {
    if (!Array.isArray(ids) || ids.length === 0) return { ids: [], tileArt: null, failed: [], keyed: {}, conceptArt: {} };
    const stack = await loadPackStack(ids, { base, readJson, only: contentRoles ? ['art', 'concepts'] : ['art'] });
    const art = createArtLibrary(stack);
    const keyed = keyedThings(art);
    const conceptArt = contentRoles ? conceptArtKeys(contentRoles, createPackConcepts(stack), ids) : Object.freeze({});
    const conceptKeys = Object.values(conceptArt).flatMap((m) => Object.values(m).map((e) => e.key)).filter((k) => art.has(k));
    if (Object.keys(keyed).length === 0 && conceptKeys.length === 0) return { ids: [...ids], tileArt: null, failed: [], keyed, conceptArt };
    // Decode only the sheets the maze's keys draw from: a stack may also carry another substrate's art (the whole
    // Seedling pack), which the maze would never draw.
    const wanted = new Set([...Object.values(MAZE_ART_KEYS).map((row) => row.key), ...conceptKeys]
        .filter((key) => art.has(key)).map((key) => art.resolve(key).sheetRef));
    const sheets = art.sheetsInUse().filter((s) => wanted.has(s.sheetRef));
    const { images, failed } = await loadSheetImages({ sheetsInUse: () => sheets }, decode, rasterise);
    return { ids: [...ids], tileArt: Object.freeze({ art, images, conceptArt }), failed, keyed, conceptArt };
}
