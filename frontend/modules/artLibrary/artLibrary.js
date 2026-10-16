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
 */
import { ContentPackError, mergeKeyed } from '../contentPacks/contentPacks.js';

/** `Engine.as:270` MAX_ELAPSED — the JS sim treats every tick as this `FP.elapsed`. */
export const FP_ELAPSED_PER_TICK = 0.0333;

const fail = (message) => { throw new ContentPackError(`art library: ${message}`); };

/** Validate one pack's art manifest; refuses by name. */
export function parseArtManifest(json, packId) {
    const where = `pack "${packId}" art manifest`;
    if (!json || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this library reads 1)`);
    const sheets = json.sheets ?? {};
    const sprites = json.sprites ?? {};
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
    const sprites = mergeKeyed(stack.filter((l) => manifests.has(l.id)), (l) => manifests.get(l.id).sprites);
    const bases = new Map(stack.map((l) => [l.id, l.base]));

    /** The resolved sprite for `key`, or null (the caller's fallback). */
    function resolve(key) {
        const hit = sprites.get(key);
        if (!hit) return null;
        const manifest = manifests.get(hit.pack);
        const sp = hit.value;
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
        has: (key) => sprites.has(key),
        keys: () => [...sprites.keys()],
        packOf: (key) => sprites.get(key)?.pack ?? null,
        resolve,
        frameRect,
        frameAt,
        /** Every sheet the stack's WINNING sprites draw from: `[{ sheetRef, url }]`. */
        sheetsInUse() {
            const out = new Map();
            for (const key of sprites.keys()) {
                const r = resolve(key);
                if (!out.has(r.sheetRef)) out.set(r.sheetRef, new URL(r.sheet.file, new URL('art/', bases.get(r.pack))).href);
            }
            return [...out].map(([sheetRef, url]) => ({ sheetRef, url }));
        },
    });
}

/**
 * Decode every sheet the library draws from. `decode(url)` returns an image
 * (`fetch` + `createImageBitmap` in a browser). Resolves to a `Map(sheetRef →
 * image)` and the list of sheets that FAILED, each by name — a failed sheet is
 * drawn by the fallback, never a crash.
 */
export async function loadSheetImages(library, decode) {
    const images = new Map();
    const failed = [];
    await Promise.all(library.sheetsInUse().map(async ({ sheetRef, url }) => {
        try {
            images.set(sheetRef, await decode(url));
        } catch (err) {
            failed.push(`${sheetRef} (${url}): ${err?.message ?? err}`);
        }
    }));
    return { images, failed };
}

/** The browser decoder: fetch the PNG, `createImageBitmap` it. */
export function browserDecoder(win = globalThis) {
    return async (url) => {
        const res = await win.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return win.createImageBitmap(await res.blob());
    };
}
