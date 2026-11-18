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
import { PACK_TILE_BASES, createPackConcepts } from '../packConcepts/packConcepts.js';

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
    floor: Object.freeze({ key: 'maze:tile/floor', colors: ['floor'], base: 'floor', what: 'an open floor cell (the base layer)' }),
    wall: Object.freeze({ key: 'maze:tile/wall', colors: ['wall'], base: 'wall', what: 'a wall cell (the base layer)' }),
    exit: Object.freeze({ key: 'maze:tile/exit', colors: ['exit'], base: 'floor', what: 'an exit cell whose gate is open (a closed one stays the `exitBlocked` fill)' }),
    entrance: Object.freeze({ key: 'maze:tile/entrance', colors: ['entrance'], base: 'floor', what: 'the entrance cell (today a green border)' }),
    manaTile: Object.freeze({ key: 'maze:tile/mana', colors: ['manaTile'], base: 'marker', what: 'a mana-refill tile (today a diamond labelled M; faded once collected)' }),
    player: Object.freeze({ key: 'maze:character/player', colors: ['player'], base: 'character', what: 'the player (today a disc; the facing tick is drawn over it either way)' }),
    trap: Object.freeze({ key: 'maze:object/trap', colors: ['trap'], base: 'marker', what: 'an arrow trap\'s own cell (its lane stays the armed/silent tint)' }),
    block: Object.freeze({ key: 'maze:object/block', colors: ['block', 'blockEdge'], base: 'marker', what: 'a pushable block (the walked kind)' }),
    blockStruck: Object.freeze({ key: 'maze:object/block-struck', colors: ['blockStruck', 'blockEdge'], base: 'marker', what: 'a struck block kind (fire, spear, a woken corpse)' }),
    blockDormant: Object.freeze({ key: 'maze:object/block-dormant', colors: ['blockDormant', 'blockEdge'], base: 'marker', what: 'a dormant block kind (a turret)' }),
    button: Object.freeze({ key: 'maze:object/button', colors: ['button'], base: 'marker', what: 'a button, UP' }),
    buttonDown: Object.freeze({ key: 'maze:object/button-down', colors: ['button'], base: 'marker', what: 'a button, DOWN (held by the player, a block or a latch)' }),
    pulser: Object.freeze({ key: 'maze:object/pulser', colors: ['pulser'], base: 'marker', what: 'a pulser\'s body on its wall cell (its ring stays the armed/silent signal)' }),
    pull: Object.freeze({ key: 'maze:object/pull', colors: ['pullTrap', 'pullMouth'], base: 'marker', what: 'a pull\'s trap cell (its disc stays the live/inert tint)' }),
    // ⛓ CONTENT SETS S2 — a region's thing (`mazeThings.js`) that is a piece of information no character or object
    // holds; drawn by `mazeThingOverlay.js`, beside `drawWorld`.
    sign: Object.freeze({ key: 'maze:object/sign', colors: ['sign'], base: 'marker', what: 'a piece of information on a floor cell that no character or object holds (a sign)' }),
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
    if (tileArt.thingArt !== undefined && (!tileArt.thingArt || typeof tileArt.thingArt !== 'object' || Array.isArray(tileArt.thingArt))) {
        return 'tileArt.thingArt must be { conceptKey: { key } } (mazeTileArt.thingArtKeys)';
    }
    if (tileArt.tileKinds !== undefined && (!tileArt.tileKinds || typeof tileArt.tileKinds !== 'object' || Array.isArray(tileArt.tileKinds))) {
        return 'tileArt.tileKinds must be { conceptKey: { artKey, base } } (mazeTileArt.tileKindKeys)';
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ CONTENT SETS TILE-1 — THE ONE FALLBACK CHAIN (⚖ the user 2026-11-15: "I don't want adding a new custom tile type
 * in the library to require updating the default graphics.")
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE BASES — a small CLOSED set of what a tile kind IS, each with ONE default draw. Every `MAZE_ART_KEYS` row
 * declares its `base`; a kind the table does not know (one a pack names) needs only a base to be drawn, never a
 * default graphic of its own. A base's draw is plain and deliberately generic: it says "an object is here", not which.
 *
 * `floor`/`wall` paint with the painter's own `COLORS.floor`/`COLORS.wall` values (`mazeTileArt.test.js` holds them
 * equal; they are spelled here because `mazeRoomRender.js` imports this file). `marker`/`character` have colours of
 * their own that no kind uses, so a base draw is never mistaken for a kind's own.
 */
export const MAZE_TILE_BASES = Object.freeze({
    floor: Object.freeze({ color: '#2a2a2a', what: 'a cell the player can stand on: the whole cell filled' }),
    wall: Object.freeze({ color: '#000000', what: 'a cell nothing stands on: the whole cell filled' }),
    marker: Object.freeze({ color: '#9aa0b4', what: 'an object on a cell: an inset square, ink-edged' }),
    character: Object.freeze({ color: '#e6e6f0', what: 'someone on a cell: a disc, ink-edged' }),
});

// ⛓ TILE-2: the NAMES are the concept parser's (`packConcepts.PACK_TILE_BASES`, which refuses any other `base` at
// load); this table holds one draw per name. A drift between the two is refused here, at import, by name.
if (Object.keys(MAZE_TILE_BASES).join() !== PACK_TILE_BASES.join()) {
    throw new MazeTileArtError(`mazeTileArt: MAZE_TILE_BASES [${Object.keys(MAZE_TILE_BASES).join(', ')}] differs from `
        + `packConcepts.PACK_TILE_BASES [${PACK_TILE_BASES.join(', ')}]`);
}

/** ⛓ THE PLACEHOLDER — a kind with no art, no own draw and no base: a labelled box in a colour no kind or base uses. */
export const MAZE_TILE_PLACEHOLDER = Object.freeze({ color: '#ff00ff', ink: '#000000' });

/** The kinds the placeholder has been drawn for, so each is logged once. */
const placeholderLogged = new Set();

/** TEST SEAM: forget which kinds the placeholder has logged. */
export function resetMazeTilePlaceholderLogForTests() {
    placeholderLogged.clear();
}

/** The base a kind resolves to: its row's, else the caller's declared one; null when neither names a known base. */
export function mazeTileBaseOf(kind, declaredBase = null) {
    const base = MAZE_ART_KEYS[kind]?.base ?? declaredBase ?? null;
    return base !== null && Object.prototype.hasOwnProperty.call(MAZE_TILE_BASES, base) ? base : null;
}

function artFrameFor(tileArt, kind, artKey) {
    if (!tileArt) return null;
    if (Object.prototype.hasOwnProperty.call(MAZE_ART_KEYS, kind)) return tileArtFrame(tileArt, kind);
    if (typeof artKey !== 'string' || !tileArt.art.has(artKey)) return null;
    const r = tileArt.art.frameRect(artKey, 0);
    const image = r ? tileArt.images.get(r.sheetRef) : null;
    return image ? { key: artKey, image, sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh } : null;
}

/**
 * Which step of the chain would draw `kind`, without drawing it: `'art'`, `'default'`, `'base'` or `'placeholder'`
 * (`drawMazeTile`'s answers). `hasOwn` says whether the caller has an own draw for it.
 */
export function mazeTileStep(tileArt, kind, { hasOwn = false, base = null, artKey = null } = {}) {
    if (artFrameFor(tileArt, kind, artKey)) return 'art';
    if (hasOwn) return 'default';
    return mazeTileBaseOf(kind, base) ? 'base' : 'placeholder';
}

/** A base's one default draw into the cell `(x0, y0, px)`. */
export function paintMazeTileBase(ctx, base, x0, y0, px) {
    const { color } = MAZE_TILE_BASES[base];
    if (base === 'floor' || base === 'wall') {
        ctx.fillStyle = color;
        ctx.fillRect(x0, y0, px, px);
        return;
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = MAZE_TILE_PLACEHOLDER.ink;
    ctx.lineWidth = 1.5;
    if (base === 'character') {
        ctx.beginPath();
        ctx.arc(x0 + px / 2, y0 + px / 2, px * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillRect(x0 + px * 0.2, y0 + px * 0.2, px * 0.6, px * 0.6);
        ctx.strokeRect(x0 + px * 0.2, y0 + px * 0.2, px * 0.6, px * 0.6);
    }
    ctx.restore();
}

/** The placeholder: the cell in `MAZE_TILE_PLACEHOLDER.color`, ink-edged, the kind's first two letters on it. */
export function paintMazeTilePlaceholder(ctx, kind, x0, y0, px) {
    ctx.save();
    ctx.fillStyle = MAZE_TILE_PLACEHOLDER.color;
    ctx.fillRect(x0 + 1, y0 + 1, px - 2, px - 2);
    ctx.strokeStyle = MAZE_TILE_PLACEHOLDER.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 1.5, y0 + 1.5, px - 3, px - 3);
    ctx.fillStyle = MAZE_TILE_PLACEHOLDER.ink;
    ctx.font = `bold ${Math.floor(px * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(kind ?? '?').slice(0, 2), x0 + px / 2, y0 + px / 2);
    ctx.restore();
}

/**
 * ⛓⛓ THE CHAIN — "how do I draw kind K" into the cell `(x0, y0, px)`, first that applies:
 *   1. the theme's ART for K (`tileArtFrame` for a `MAZE_ART_KEYS` row; the declared `artKey` for a kind the table
 *      does not know);
 *   2. K's OWN default draw, `own()` — for a row, the painter's existing `COLORS` shape (both views pass it);
 *   3. K's BASE (`MAZE_ART_KEYS[K].base`, else the declared `base`): that base's one draw (`paintMazeTileBase`);
 *   4. the PLACEHOLDER (`paintMazeTilePlaceholder`), logged once per kind. ⛔ It never throws.
 * Answers the step that drew. A row's painter always passes `own`, so for every existing kind steps 1–2 are exactly
 * the draw it made before the chain existed (⛔ the one-region view is op-identical: `mazeTileFallback.test.js`).
 * A kind the table does not know resolves through 1, 3 and 4: it needs a base, not a default graphic.
 */
export function drawMazeTile(ctx, tileArt, kind, x0, y0, px, { own = null, base = null, artKey = null } = {}) {
    const f = artFrameFor(tileArt, kind, artKey);
    if (f) {
        ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, x0, y0, px, px);
        return 'art';
    }
    if (typeof own === 'function') {
        own();
        return 'default';
    }
    const b = mazeTileBaseOf(kind, base);
    if (b) {
        paintMazeTileBase(ctx, b, x0, y0, px);
        return 'base';
    }
    if (!placeholderLogged.has(kind)) {
        placeholderLogged.add(kind);
        console.warn(`[mazeTileArt] tile kind "${kind}" has no art, no default draw and no base: drawn as the placeholder`);
    }
    paintMazeTilePlaceholder(ctx, kind, x0, y0, px);
    return 'placeholder';
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ CONTENT SETS TILE-2 — A PACK DECLARES A TILE KIND: its concept row carries `base` beside its `art` key.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE PACK-DECLARED KINDS of a world's stack: every pack concept that carries a `base`
 * (`packConcepts.PACK_TILE_BASES`; the parser refused any other at load), by its concept key →
 * `{ artKey, base, pack }` (frozen). `artKey` is the concept's `art` key, or null. As `thingArtKeys`, the key is
 * not checked against the art library here: one the stack's art does not resolve falls through to the base.
 * A concept with no `base` is not a declared kind; asked for by its key, it resolves with no base
 * (`mazeTileKind`), and the chain draws the placeholder.
 */
export function tileKindKeys(packConcepts) {
    const out = {};
    for (const key of packConcepts?.keys() ?? []) {
        const c = packConcepts.get(key);
        if (typeof c.base === 'string') {
            out[key] = Object.freeze({ artKey: typeof c.art === 'string' ? c.art : null, base: c.base, pack: c.pack });
        }
    }
    return Object.freeze(out);
}

/**
 * ⛓⛓ THE LOOKUP — tile kind → `{ artKey, base }`, what `drawMazeTile` takes beside the kind.
 *   · a `MAZE_ART_KEYS` kind: its row's key and base, exactly as the chain resolves it today (pinned:
 *     `mazeTileKind.test.js`; a pack cannot re-declare a row, because a concept key is namespaced and a row's
 *     name is not);
 *   · a pack concept key: from `packConcepts` (the world's stack, `createPackConcepts`): its `art` and `base`,
 *     each null when the row has none;
 *   · `tileKinds` (a `tileKindKeys` result, e.g. `tileArt.tileKinds`) may stand in for `packConcepts`;
 *   · anything else: `{ artKey: null, base: null }` — the placeholder, never a throw.
 */
export function mazeTileKind(kind, { packConcepts = null, tileKinds = null } = {}) {
    const row = Object.prototype.hasOwnProperty.call(MAZE_ART_KEYS, kind) ? MAZE_ART_KEYS[kind] : null;
    if (row) return Object.freeze({ artKey: row.key, base: row.base });
    const declared = tileKinds && Object.prototype.hasOwnProperty.call(tileKinds, kind) ? tileKinds[kind] : null;
    if (declared) return Object.freeze({ artKey: declared.artKey, base: declared.base });
    const c = packConcepts?.get(kind) ?? null;
    return Object.freeze({
        artKey: typeof c?.art === 'string' ? c.art : null,
        base: typeof c?.base === 'string' ? c.base : null,
    });
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
 * ⛓ CONTENT SETS S2 — **WHICH ART KEY A REGION'S THING DRAWS, BY ITS PACK CONCEPT.** A thing names its pack concept
 * (`concept`); for each role of `contentRoles` that accepts KINDS (the maze's `character`, `object`, `info`), every
 * pack concept of an accepted kind that presents no mechanic (the contract's rule: a presenter fills no kind role) and
 * carries an `art` key. Returns `{ conceptKey: { key, pack } }` (frozen). As `conceptArtKeys`, the role's `needs` are
 * not asked and the key is not checked against the art library here (one that does not resolve draws the baked way).
 * ⚠ Written here, not with `contentRoles`, for the same reason as `conceptArtKeys`.
 */
export function thingArtKeys(contentRoles, packConcepts) {
    const kinds = new Set(Object.values(contentRoles ?? {}).flatMap((role) => role?.accepts?.kinds ?? []));
    const out = {};
    for (const key of packConcepts.keys()) {
        const c = packConcepts.get(key);
        if (kinds.has(c.kind) && (c.presents === undefined || c.presents === null) && typeof c.art === 'string') {
            out[key] = Object.freeze({ key: c.art, pack: c.pack });
        }
    }
    return Object.freeze(out);
}

/** The frame a thing of pack concept `conceptKey` draws, or null (draw it the baked way). As `conceptArtFrame`. */
export function thingArtFrame(tileArt, conceptKey) {
    const entry = tileArt?.thingArt?.[conceptKey];
    if (!entry || !tileArt.art.has(entry.key)) return null;
    const r = tileArt.art.frameRect(entry.key, 0);
    const image = r ? tileArt.images.get(r.sheetRef) : null;
    if (!image) return null;
    return { key: entry.key, image, sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh, pack: tileArt.art.packOf(entry.key) };
}

/** ⛓ THE SEAM for a thing: as `drawTileArt`, by the thing's pack concept. */
export function drawThingArt(ctx, tileArt, conceptKey, dx, dy, dw, dh) {
    const f = thingArtFrame(tileArt, conceptKey);
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
 * Resolves `{ ids, tileArt, failed, keyed, conceptArt, thingArt, tileKinds }` (`conceptArt` as `conceptArtKeys`,
 * `thingArt` as `thingArtKeys` (S2), `tileKinds` as `tileKindKeys` (TILE-2), each `{}` without roles): `tileArt` is the seam's `{ art, images }`, or null when no pack in
 * the stack carries a key of the table (nothing is decoded then, and the maze draws as it always has); `failed`
 * lists the sheets that did not decode, by name (their keys fall back); `keyed` is `keyedThings`. An empty stack
 * reads nothing. A pack that cannot be read is refused by name (`ContentPackError`): the caller catches it and draws
 * without art.
 */
export async function loadMazeTileArt(ids, { base, readJson, decode, rasterise = null, contentRoles = null }) {
    if (!Array.isArray(ids) || ids.length === 0) return { ids: [], tileArt: null, failed: [], keyed: {}, conceptArt: {}, thingArt: {}, tileKinds: {} };
    const stack = await loadPackStack(ids, { base, readJson, only: contentRoles ? ['art', 'concepts'] : ['art'] });
    const art = createArtLibrary(stack);
    const keyed = keyedThings(art);
    const packConcepts = contentRoles ? createPackConcepts(stack) : null;
    const conceptArt = contentRoles ? conceptArtKeys(contentRoles, packConcepts, ids) : Object.freeze({});
    // ⛓ S2: and each region thing's art key, by its pack concept.
    const thingArt = contentRoles ? thingArtKeys(contentRoles, packConcepts) : Object.freeze({});
    // ⛓ TILE-2: and each pack-declared tile kind's art key and base (`tileKindKeys`; `mazeTileKind` reads it).
    const tileKinds = contentRoles ? tileKindKeys(packConcepts) : Object.freeze({});
    const conceptKeys = [
        ...Object.values(conceptArt).flatMap((m) => Object.values(m).map((e) => e.key)),
        ...Object.values(thingArt).map((e) => e.key),
        ...Object.values(tileKinds).map((e) => e.artKey).filter((k) => k !== null),
    ].filter((k) => art.has(k));
    if (Object.keys(keyed).length === 0 && conceptKeys.length === 0) return { ids: [...ids], tileArt: null, failed: [], keyed, conceptArt, thingArt, tileKinds };
    // Decode only the sheets the maze's keys draw from: a stack may also carry another substrate's art (the whole
    // Seedling pack), which the maze would never draw.
    const wanted = new Set([...Object.values(MAZE_ART_KEYS).map((row) => row.key), ...conceptKeys]
        .filter((key) => art.has(key)).map((key) => art.resolve(key).sheetRef));
    const sheets = art.sheetsInUse().filter((s) => wanted.has(s.sheetRef));
    const { images, failed } = await loadSheetImages({ sheetsInUse: () => sheets }, decode, rasterise);
    return { ids: [...ids], tileArt: Object.freeze({ art, images, conceptArt, thingArt, tileKinds }), failed, keyed, conceptArt, thingArt, tileKinds };
}
