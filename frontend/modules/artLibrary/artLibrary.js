/**
 * artLibrary — **SPRITES AND ANIMATIONS BY KEY, FOR ANY RENDERER** (Seedling JS
 * graphics G0, ⚖ the user 2026-10-16).
 *
 * The art layer of a content-pack stack (`contentPacks/contentPacks.js`),
 * merged per key (a later pack wins), answering three questions:
 *
 *   · `has(key)`                        — does any pack in the stack draw it?
 *   · `frameRect(key, frame)`           — which sheet, which rectangle?
 *   · `frameAt(key, anim, tick, phase)` — which frame is showing at this GAME TICK?
 *
 * ⛔ RENDERER-AGNOSTIC. It knows sheets, frame sizes, origins and animations.
 * It never knows how Seedling (or the maze) chooses a frame — the autotiler, a
 * tree's neighbour frame and Y-sort live in the renderer that asks.
 *
 * ⛔ ANIMATION RUNS ON THE GAME TICK, NEVER WALL TIME (⚖ ruling 3). Two clocks:
 *
 *   · `world` — `Game.worldFrame(n, loops)` (`Game.as:1962`): with
 *     `P = clocks.world.ticksPerFrame` (`Game.timePerFrame`, 45),
 *     `index = floor((tick mod (P·loops)) / (P·loops / n))`;
 *   · `fps` — a FlashPunk `Spritemap` animation at `fps` frames per second,
 *     advanced by the JS sim's clamped `FP.elapsed` per tick
 *     (`FP_ELAPSED_PER_TICK`, `Engine.as:270`'s 0.0333):
 *     `index = floor(tick · fps · 0.0333)`, wrapped when it loops, held on
 *     the last frame when it does not.
 *
 * `phase` shifts the index (the original's per-tile random phase); a caller
 * draws it from its OWN PRNG, never the sim's (⚖ never model the cosmetic RNG).
 *
 * Images are not this module's business either: `loadSheetImages` turns a
 * stack's sheets into bitmaps with an injected decoder (`createImageBitmap` in
 * a browser) and the painter looks them up by `sheetRef`. Node tests use the
 * manifests only.
 *
 * ⛓ SHAPES (content sets R2b, ⚖ the user 2026-11-11: "support both shape
 * libraries and images"). A manifest may also carry `shapes`: an entry drawn
 * from basic shapes (`rect`, `circle`, `line`, `polygon`, each with `fill`
 * and/or `stroke` + `width`) instead of an image file, so a theme needs no
 * image at all. A shape entry is RASTERISED ONCE at load (`loadSheetImages`'s
 * injected `rasterise`, `browserRasteriser` in a browser) into a one-frame
 * "sheet" of its own, and from then on the library answers for it exactly as
 * for a one-frame sprite (`has`, `resolve`, `frameRect`, `sheetRef`), so every
 * existing consumer draws it unchanged. A key is a sprite OR a shape across the
 * merged stack: the later pack wins whichever kind it is (`mergeKeyed`).
 */
import { ContentPackError, mergeKeyed } from '../contentPacks/contentPacks.js';

/** `Engine.as:270` MAX_ELAPSED — the JS sim treats every tick as this `FP.elapsed`. */
export const FP_ELAPSED_PER_TICK = 0.0333;

const fail = (message) => { throw new ContentPackError(`art library: ${message}`); };

/** The shape primitives, each `[numbers]` (polygon: `[[x, y], …]`). */
export const SHAPE_PRIMITIVES = Object.freeze(['rect', 'circle', 'line', 'polygon']);
/** A shape colour: `#rrggbb` or `#rrggbbaa`. */
export const SHAPE_COLOUR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const SHAPE_OP_FIELDS = new Set([...SHAPE_PRIMITIVES, 'fill', 'stroke', 'width']);
const SHAPE_FIELDS = new Set(['w', 'h', 'draw', 'origin', 'note']);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Validate one shape entry; refuses by name. */
function parseShape(where, key, sh) {
    const at = `${where}: shape "${key}"`;
    if (!sh || typeof sh !== 'object' || Array.isArray(sh)) fail(`${at} is not an object`);
    for (const f of Object.keys(sh)) if (!SHAPE_FIELDS.has(f)) fail(`${at}: field "${f}" is not one a shape takes (${[...SHAPE_FIELDS].join(', ')})`);
    if (!Number.isInteger(sh.w) || sh.w <= 0 || !Number.isInteger(sh.h) || sh.h <= 0) fail(`${at} needs integer w, h > 0`);
    if (sh.origin !== undefined && !(Array.isArray(sh.origin) && sh.origin.length === 2 && sh.origin.every(finite))) {
        fail(`${at}: origin must be [x, y]`);
    }
    if (!Array.isArray(sh.draw) || !sh.draw.length) fail(`${at} has no draw list`);
    sh.draw.forEach((op, i) => {
        const opAt = `${at} draw[${i}]`;
        if (!op || typeof op !== 'object' || Array.isArray(op)) fail(`${opAt} is not an object`);
        for (const f of Object.keys(op)) if (!SHAPE_OP_FIELDS.has(f)) fail(`${opAt}: "${f}" is not a shape primitive or paint (${[...SHAPE_OP_FIELDS].join(', ')})`);
        const prims = SHAPE_PRIMITIVES.filter((p) => p in op);
        if (prims.length !== 1) fail(`${opAt} needs exactly one primitive (${SHAPE_PRIMITIVES.join(' | ')}), got ${prims.length ? prims.join(' + ') : 'none'}`);
        const [prim] = prims;
        const g = op[prim];
        const nums = (n) => Array.isArray(g) && g.length === n && g.every(finite);
        if (prim === 'rect' && !(nums(4) && g[2] > 0 && g[3] > 0)) fail(`${opAt}: rect is [x, y, w, h] with w, h > 0`);
        if (prim === 'circle' && !(nums(3) && g[2] > 0)) fail(`${opAt}: circle is [cx, cy, r] with r > 0`);
        if (prim === 'line' && !nums(4)) fail(`${opAt}: line is [x1, y1, x2, y2]`);
        if (prim === 'polygon' && !(Array.isArray(g) && g.length >= 3 && g.every((pt) => Array.isArray(pt) && pt.length === 2 && pt.every(finite)))) {
            fail(`${opAt}: polygon is [[x, y], …] with at least 3 points`);
        }
        for (const paint of ['fill', 'stroke']) {
            if (paint in op && !(typeof op[paint] === 'string' && SHAPE_COLOUR.test(op[paint]))) fail(`${opAt}: ${paint} ${JSON.stringify(op[paint])} is not #rrggbb or #rrggbbaa`);
        }
        if (!('fill' in op) && !('stroke' in op)) fail(`${opAt} paints nothing (it needs fill and/or stroke)`);
        if (prim === 'line' && 'fill' in op) fail(`${opAt}: a line has no inside to fill (use stroke)`);
        if ('width' in op && !(finite(op.width) && op.width > 0)) fail(`${opAt}: width must be > 0`);
        if ('width' in op && !('stroke' in op)) fail(`${opAt}: width without a stroke`);
    });
}

/** Validate one pack's art manifest; refuses by name. */
export function parseArtManifest(json, packId) {
    const where = `pack "${packId}" art manifest`;
    if (!json || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this library reads 1)`);
    const sheets = json.sheets ?? {};
    const sprites = json.sprites ?? {};
    const shapes = json.shapes ?? {};
    if (typeof shapes !== 'object' || Array.isArray(shapes)) fail(`${where}: shapes must be an object of key → shape`);
    for (const [key, sh] of Object.entries(shapes)) {
        if (key in sprites) fail(`${where}: "${key}" is both a sprite and a shape (one pack draws a key one way)`);
        parseShape(where, key, sh);
    }
    for (const [id, s] of Object.entries(sheets)) {
        if (typeof s?.file !== 'string' || !(s.w > 0) || !(s.h > 0)) fail(`${where}: sheet "${id}" needs file, w, h`);
    }
    for (const [key, sp] of Object.entries(sprites)) {
        const sheet = sheets[sp?.sheet];
        if (!sheet) fail(`${where}: sprite "${key}" names sheet ${JSON.stringify(sp?.sheet)}, which the manifest does not declare`);
        if (!(sp.fw > 0) || !(sp.fh > 0) || sp.fw > sheet.w || sp.fh > sheet.h) fail(`${where}: sprite "${key}" frame ${sp.fw}x${sp.fh} does not fit sheet "${sp.sheet}" (${sheet.w}x${sheet.h})`);
        for (const [name, a] of Object.entries(sp.anims ?? {})) {
            if (!Array.isArray(a?.frames) || !a.frames.length) fail(`${where}: sprite "${key}" anim "${name}" has no frames`);
            if (a.clock === 'world') {
                if (!(json.clocks?.world?.ticksPerFrame > 0)) fail(`${where}: sprite "${key}" anim "${name}" uses the world clock, which the manifest does not define`);
            } else if (a.clock === 'fps') {
                if (!(a.fps > 0)) fail(`${where}: sprite "${key}" anim "${name}" needs fps > 0`);
            } else {
                fail(`${where}: sprite "${key}" anim "${name}" clock ${JSON.stringify(a.clock)} (world | fps)`);
            }
        }
    }
    return json;
}

/**
 * Build the library from a loaded stack (`loadPackStack`'s result, or any list
 * of `{ id, base, layers: { art } }`). Packs without an art layer are skipped.
 */
export function createArtLibrary(stack) {
    const manifests = new Map();
    for (const loaded of stack) {
        if (loaded.layers?.art) manifests.set(loaded.id, parseArtManifest(loaded.layers.art, loaded.id));
    }
    // ⛓ ONE merge over both kinds: a key is a sprite OR a shape, and the later pack wins whichever it is.
    const entries = mergeKeyed(stack.filter((l) => manifests.has(l.id)), (l) => {
        const m = manifests.get(l.id);
        const out = {};
        for (const [key, value] of Object.entries(m.sprites ?? {})) out[key] = { kind: 'sprite', value };
        for (const [key, value] of Object.entries(m.shapes ?? {})) out[key] = { kind: 'shape', value };
        return out;
    });
    const bases = new Map(stack.map((l) => [l.id, l.base]));

    /** The resolved sprite for `key`, or null (the caller's fallback). A shape resolves as a one-frame sprite. */
    function resolve(key) {
        const hit = entries.get(key);
        if (!hit) return null;
        const manifest = manifests.get(hit.pack);
        if (hit.value.kind === 'shape') {
            const sh = hit.value.value;
            return {
                key,
                pack: hit.pack,
                sheetRef: shapeSheetRef(hit.pack, key),
                sheet: { w: sh.w, h: sh.h, shape: true },
                sprite: { fw: sh.w, fh: sh.h, frames: 1, ...(sh.origin ? { origin: sh.origin } : {}) },
                shape: sh,
                cols: 1,
                frameCount: 1,
                clocks: manifest.clocks ?? {},
            };
        }
        const sp = hit.value.value;
        const sheet = manifest.sheets[sp.sheet];
        const cols = Math.floor(sheet.w / sp.fw);
        return {
            key,
            pack: hit.pack,
            sheetRef: `${hit.pack}/${sp.sheet}`,
            sheet,
            sprite: sp,
            cols,
            frameCount: cols * Math.floor(sheet.h / sp.fh),
            clocks: manifest.clocks ?? {},
        };
    }

    /**
     * FlashPunk `Spritemap`'s frame → rectangle (`Spritemap.as:57-62`): column
     * `frame mod cols`, row `floor(frame / cols)`, after `set frame` wraps the
     * index into `[0, frameCount)` (`Spritemap.as:182-190`). A sprite with `only`
     * (one frame of a shared sheet, e.g. `Statues.png`) maps frame 0 to its pick.
     */
    function frameRect(key, frame = 0) {
        const r = resolve(key);
        if (!r) return null;
        let f = r.sprite.only ? r.sprite.only[((frame % r.sprite.only.length) + r.sprite.only.length) % r.sprite.only.length] : frame;
        f = ((Math.trunc(f) % r.frameCount) + r.frameCount) % r.frameCount;
        const [ox, oy] = r.sprite.origin ?? [0, 0];
        return {
            sheetRef: r.sheetRef,
            sx: (f % r.cols) * r.sprite.fw,
            sy: Math.floor(f / r.cols) * r.sprite.fh,
            sw: r.sprite.fw,
            sh: r.sprite.fh,
            ox,
            oy,
            frame: f,
        };
    }

    /** The frame an animation shows at game tick `tick` (an index into the sheet), or null. */
    function frameAt(key, anim, tick, phase = 0) {
        const r = resolve(key);
        const a = r?.sprite.anims?.[anim];
        if (!a) return null;
        const n = a.frames.length;
        let idx;
        if (a.clock === 'world') {
            const span = r.clocks.world.ticksPerFrame * (a.loops ?? 1);
            idx = Math.floor((((tick % span) + span) % span) / (span / Math.max(n, 1)));
        } else {
            const raw = Math.floor(Math.max(0, tick) * a.fps * FP_ELAPSED_PER_TICK);
            idx = a.loop === false ? Math.min(raw, n - 1) : raw;
        }
        return a.frames[(((idx + phase) % n) + n) % n];
    }

    return Object.freeze({
        has: (key) => entries.has(key),
        keys: () => [...entries.keys()],
        packOf: (key) => entries.get(key)?.pack ?? null,
        /** `'sprite'`, `'shape'`, or null when no pack carries `key`. */
        kindOf: (key) => entries.get(key)?.value.kind ?? null,
        resolve,
        frameRect,
        frameAt,
        /**
         * Every sheet the stack's WINNING entries draw from: `[{ sheetRef, url }]` for an image sheet, and
         * `{ sheetRef, url: null, shape }` for a winning shape entry (its own one-frame sheet, rasterised by
         * `loadSheetImages`).
         */
        sheetsInUse() {
            const out = new Map();
            for (const key of entries.keys()) {
                const r = resolve(key);
                if (out.has(r.sheetRef)) continue;
                out.set(r.sheetRef, r.shape
                    ? { sheetRef: r.sheetRef, url: null, shape: r.shape }
                    : { sheetRef: r.sheetRef, url: new URL(r.sheet.file, new URL('art/', bases.get(r.pack))).href });
            }
            return [...out.values()];
        },
    });
}

/** A shape entry's own sheet: one per (pack, key). `#` never appears in a pack id. */
export function shapeSheetRef(pack, key) {
    return `${pack}#${key}`;
}

/**
 * Decode every sheet the library draws from. `decode(url)` returns an image
 * (`fetch` + `createImageBitmap` in a browser); `rasterise(shape)` returns an
 * image of a shape entry (`browserRasteriser` in a browser) — optional: with
 * none, each shape is named in `failed` and its key falls back. Resolves to a
 * `Map(sheetRef → image)` and the list of sheets that FAILED, each by name — a
 * failed sheet is drawn by the fallback, never a crash.
 */
export async function loadSheetImages(library, decode, rasterise = null) {
    const images = new Map();
    const failed = [];
    await Promise.all(library.sheetsInUse().map(async ({ sheetRef, url, shape }) => {
        try {
            if (shape) {
                if (typeof rasterise !== 'function') throw new Error('no rasteriser was given for a shape entry');
                images.set(sheetRef, await rasterise(shape));
            } else {
                images.set(sheetRef, await decode(url));
            }
        } catch (err) {
            failed.push(`${sheetRef} (${url ?? 'shape'}): ${err?.message ?? err}`);
        }
    }));
    return { images, failed };
}

/**
 * Paint a shape entry's draw list onto a 2D context at (0, 0), in its own pixels. DOM-free (any context with the
 * path API): the rasteriser below calls it on a fresh canvas, and a node test on a recording context.
 */
export function paintShape(ctx, shape) {
    for (const op of shape.draw) {
        ctx.beginPath();
        if (op.rect) {
            ctx.rect(...op.rect);
        } else if (op.circle) {
            const [cx, cy, r] = op.circle;
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
        } else if (op.line) {
            const [x1, y1, x2, y2] = op.line;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        } else {
            const [first, ...rest] = op.polygon;
            ctx.moveTo(...first);
            for (const pt of rest) ctx.lineTo(...pt);
            ctx.closePath();
        }
        if (op.fill) {
            ctx.fillStyle = op.fill;
            ctx.fill();
        }
        if (op.stroke) {
            ctx.strokeStyle = op.stroke;
            ctx.lineWidth = op.width ?? 1;
            ctx.stroke();
        }
    }
}

/** The browser rasteriser: a `w × h` canvas (an `OffscreenCanvas` where there is one) with `paintShape` on it. */
export function browserRasteriser(win = globalThis) {
    return async (shape) => {
        let canvas;
        if (typeof win.OffscreenCanvas === 'function') {
            canvas = new win.OffscreenCanvas(shape.w, shape.h);
        } else {
            canvas = win.document.createElement('canvas');
            canvas.width = shape.w;
            canvas.height = shape.h;
        }
        paintShape(canvas.getContext('2d'), shape);
        return canvas;
    };
}

/** The browser decoder: fetch the PNG, `createImageBitmap` it. */
export function browserDecoder(win = globalThis) {
    return async (url) => {
        const res = await win.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return win.createImageBitmap(await res.blob());
    };
}
