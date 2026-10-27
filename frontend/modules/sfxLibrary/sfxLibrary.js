/**
 * sfxLibrary — **SOUND EFFECTS BY KEY, FOR ANY GAME** (Seedling JS sound
 * effects, ⚖ the user 2026-10-26: "a sound effect library, and maybe a
 * separate music library, that work like the graphics library").
 *
 * The `sfx` layer of a content-pack stack (`contentPacks/contentPacks.js`),
 * merged per key (a later pack wins, so a sound pack stacked last replaces
 * only the keys it carries), answering:
 *
 *   · `has(key)`               — does any pack in the stack carry it?
 *   · `clipsOf(key)`           — its VARIANTS, in index order (`[{ clipRef, url, seconds? }]`);
 *                                one clip may sit at several indices, because
 *                                the index is what a game names;
 *   · `clipsInUse()`           — every distinct clip the winning keys play.
 *
 * ⛔ IT NEVER CHOOSES WHEN TO PLAY, OR WHICH VARIANT. A game's cue module
 * decides both (Seedling's is `seedlingDemo/seedlingSoundCues.js`); this is
 * the table and the loader. The output (context, unlock, volume) is
 * `webAudio/webAudio.js`, shared with the music library.
 *
 * `loadSfxClips(library, decode)` decodes the clips with an injected decoder
 * (`fetch` + `decodeAudioData` in a browser, a fake in node). A clip that
 * fails is NAMED in `failed` and its key plays nothing for that variant —
 * never a crash.
 */
import { ContentPackError, mergeKeyed } from '../contentPacks/contentPacks.js';

const fail = (message) => { throw new ContentPackError(`sfx library: ${message}`); };

/**
 * Validate one pack's sfx manifest; refuses by name:
 *
 *     { "schema_version": 1,
 *       "clips":  { "Sword1": { "file": "clips/Sword1.mp3" } },
 *       "sounds": { "seedling:sfx/sword": { "clips": ["Sword1", "Sword2", "Sword3"] } } }
 */
export function parseSfxManifest(json, packId) {
    const where = `pack "${packId}" sfx manifest`;
    if (!json || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this library reads 1)`);
    const clips = json.clips ?? {};
    const sounds = json.sounds ?? {};
    for (const [id, c] of Object.entries(clips)) {
        if (typeof c?.file !== 'string' || !c.file || c.file.startsWith('/') || c.file.includes('..')) {
            fail(`${where}: clip "${id}" needs a relative file inside the pack`);
        }
    }
    for (const [key, s] of Object.entries(sounds)) {
        if (!Array.isArray(s?.clips) || !s.clips.length) fail(`${where}: sound "${key}" has no clips`);
        for (const id of s.clips) {
            if (!clips[id]) fail(`${where}: sound "${key}" names clip ${JSON.stringify(id)}, which the manifest does not declare`);
        }
    }
    return json;
}

/**
 * Build the library from a loaded stack (`loadPackStack`'s result, or any
 * list of `{ id, base, layers: { sfx } }`). Packs without an sfx layer are skipped.
 */
export function createSfxLibrary(stack) {
    const manifests = new Map();
    for (const loaded of stack) {
        if (loaded.layers?.sfx) manifests.set(loaded.id, parseSfxManifest(loaded.layers.sfx, loaded.id));
    }
    const sounds = mergeKeyed(stack.filter((l) => manifests.has(l.id)), (l) => manifests.get(l.id).sounds);
    const bases = new Map(stack.map((l) => [l.id, l.base]));
    const clipUrl = (pack, id) => new URL(manifests.get(pack).clips[id].file, new URL('sfx/', bases.get(pack))).href;

    function clipsOf(key) {
        const hit = sounds.get(key);
        if (!hit) return [];
        const clips = manifests.get(hit.pack).clips;
        return hit.value.clips.map((id) => ({
            clipRef: `${hit.pack}/${id}`, url: clipUrl(hit.pack, id),
            // the manifest's own length, when it states one (a game times a re-trigger by it; this library never does)
            ...(Number.isFinite(clips[id].seconds) ? { seconds: clips[id].seconds } : {}),
        }));
    }

    return Object.freeze({
        has: (key) => sounds.has(key),
        keys: () => [...sounds.keys()],
        packOf: (key) => sounds.get(key)?.pack ?? null,
        clipsOf,
        /** How many variants `key` has (0 = not carried). */
        variantCount: (key) => sounds.get(key)?.value.clips.length ?? 0,
        /** Every distinct clip the stack's WINNING keys play: `[{ clipRef, url }]`. */
        clipsInUse() {
            const out = new Map();
            for (const key of sounds.keys()) for (const c of clipsOf(key)) if (!out.has(c.clipRef)) out.set(c.clipRef, c.url);
            return [...out].map(([clipRef, url]) => ({ clipRef, url }));
        },
    });
}

/**
 * Decode every clip the library plays. `decode(url)` returns a playable
 * buffer. Resolves to `{ buffers: Map(clipRef → buffer), failed: [named] }`
 * and a `bufferFor(key, index)` that returns null for a failed or missing
 * variant (the caller plays nothing for it).
 */
export async function loadSfxClips(library, decode) {
    const buffers = new Map();
    const failed = [];
    await Promise.all(library.clipsInUse().map(async ({ clipRef, url }) => {
        try {
            buffers.set(clipRef, await decode(url));
        } catch (err) {
            failed.push(`${clipRef} (${url}): ${err?.message ?? err}`);
        }
    }));
    failed.sort();
    const bufferFor = (key, index) => {
        const c = library.clipsOf(key)[index];
        return c ? buffers.get(c.clipRef) ?? null : null;
    };
    return { buffers, failed, bufferFor };
}

/** The browser decoder: fetch the clip, decode it through a `webAudio` output (which waits for the unlock). */
export function browserSfxDecoder(audioOut, win = globalThis) {
    return async (url) => {
        const res = await win.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return audioOut.decode(await res.arrayBuffer());
    };
}
