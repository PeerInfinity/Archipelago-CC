/**
 * ⛓⛓ **THE PLAYBACK BOT'S CONTROLLER FOR GENERATED SEEDLING ROOMS** (Seedling
 * JS runtime J2; plan `NewDocs/plans/seedling-js-substrate-plan.md`).
 *
 * The registry entry `flash_seedling_gen` returns this from
 * `getPlaybackController()`. It is a HOST-SIDE object that answers the
 * contract (`docs/json/developer/procgen/substrate-registry.md#playback`) and
 * walks nothing itself: the walk is the JS runtime page's own
 * (`seedlingDemo/jsRuntimeWalker.js`, asked once per tick INSIDE the page's
 * clock — no second clock), reached through the page's same-origin handle
 * `window.__seedlingJsRuntime.playback`.
 *
 * ── ⛓ WHY A DIRECT HANDLE AND NOT AN EVENT-BUS PROXY (W0 decision) ───────
 *
 * Bounce's controller is a `PlaybackProxy`: fire-and-forget over the event
 * bus, so `walkTo` returns nothing. This one must be able to say NO
 * synchronously — the bot turns `walkTo(...) === false` into a terminal, named
 * status (`playbackBotUI._publishWalkTo`), and a Seedling region under the wasm
 * runtime, or an AP name the generated rooms do not hold, must reach that
 * status rather than a silent wait. The flash panel's iframe is same-origin
 * and `WasmBridgeAdapter` already calls into its window synchronously, so the
 * controller does the same. ⛔ Nothing here imports the model: the panel's
 * static import closure is unchanged (the model is the PAGE's closure).
 *
 * ── WHAT `walkTo` ANSWERS ───────────────────────────────────────────────
 *
 *   false  + `lastRefusal`  the panel runs another runtime (wasm / flash):
 *                           only the JS runtime has feet; the name is not a
 *                           location / exit of the generated rooms; the page
 *                           refused the resolved goal.
 *   true                    accepted — handed to the page, or HELD until the
 *                           page and the generated arm's report are up (the
 *                           bot's first walkTo can outrun both). A held goal
 *                           is retried on a timer.
 *
 * ⛔ AN ACCEPTED GOAL THAT FAILS LATER IS NOT SILENT EITHER: a held goal whose
 * panel comes up on another runtime, one never handed over within
 * `PENDING_GIVE_UP_MS`, and a live walk the page gives up on
 * (`jsRuntimeWalker`'s FAILED) all go out through `onWalkFailed` — which
 * `flashPanel/index.js` publishes as `playback:walkFailed`, the bot's terminal
 * named status (`PlaybackBotUI.onWalkFailed`).
 *
 * Name → cell maps come from the generated arm's assembly REPORT
 * (`assembleGeneratedSeedlingSet(...).report`: `apitems` and `doors`), which
 * the panel keeps from its load. Exit names arrive in either spelling the
 * graph uses — bare `exit_0` or `{regionId}__{exitName}` — as
 * `flashSubstrate/bridge.js` `_translateWalkTo` accepts them; a bare name is
 * read against the room the player is IN (the live level), the one fact that
 * cannot lag a region move.
 *
 * `play`/`stop`/`step`/`reset` pass through to the page's walker; `instant` is
 * `play` (the game has one 30 tick/s clock, and a burst of ticks off it would
 * be a second one); `setRate` is a no-op (bounce's answer: no scriptable clock).
 *
 * ⛓ SOLVER-WALK S1 — the surface's `solverWalk` (`flashPanel.seedlingSolverWalk`,
 * default OFF) is handed to the page with every goal (`playback.setSolverWalk`):
 * on, the page's walk asks the REAL solver for the room's plan first
 * (`seedlingDemo/jsRuntimeSolver.js`). With it on, `instant` asks the page to
 * play a solved plan in one burst (`playback.instant`) — still one page tick
 * per key set, so the checks and crossings report exactly as on the clock.
 *
 * ── ⛓ J3 — THE SAME CLASS WALKS THE ATLAS ROOMS (`flash_seedling`) ───────
 *
 * One page, one walker, two name → cell maps: a second instance is built with
 * `substrate: 'flash_seedling'`, `resolve: resolveSeedlingAtlasGoal` and
 * `mapOf: (surface) => surface.atlas`. The atlas map is the atlas arm's BOUND
 * entries (`seedlingAtlasCheckTable`: location → `{level, tag, entityType}`)
 * plus the rules' own `flash_seedling` sidecars (an exit → its `exit_tiles` in
 * its level). A location the arm REFUSED is refused here by the same name and
 * reason — a check that cannot fire is never walked to.
 *
 * ── ⛓ W2 — THE ATLAS INSTANCE ALSO WALKS ON THE WASM RUNTIME ────────────
 *
 * Built with `wasm: true` (the atlas instance only), a `walkTo` under the wasm
 * runtime no longer refuses: it goes to the wasm playback ENGINE
 * (`seedlingWasmPlayback.js`) — solve the room at an ARRIVAL in the S2 worker,
 * ship ONE host tape, the game plays it. The engine is loaded by a
 * COMPUTED-URL dynamic import on the first wasm goal (`loadWasmEngine`), so
 * this file still imports no model; until it is up (and its map document in)
 * the goal is HELD on the same retry timer a not-yet-mounted JS page uses.
 * The engine's notes and late failures come back through `onWalkNote` /
 * `onWalkFailed`, exactly as the JS page's do.
 *
 * ── ⛓ WG — THE GENERATED INSTANCE WALKS ON WASM TOO ────────────────────
 *
 * Built with `wasm: true` and `wasmLevelSetOf` (the surface's
 * `wasm.levelSet`, the set the generated arm delivered), the engine stages
 * that MOUNTED set — not a map document — and its tapes come from the J2
 * walker (`seedlingDemo/wasmWalkTape.js`), since the solver has no goal kind
 * for an apitem. A location and an exit are served; a `tile` target is
 * refused on wasm BY NAME (no producer serves it), as is a goal the walker
 * cannot reach (the engine's named failure). A new delivered set (a new
 * object) is a new engine, like a new game.
 */

// ⛓ VANILLA MAP — both import-free, so the controller still imports no model.
import { RANDOMIZER_ARMS } from './seedlingRandomizerEligibility.js';
import { ATLAS_CHECK_PLAYER, atlasRoomRegions } from '../seedlingDemo/seedlingAtlasCheckTable.js';

/** The substrate this controller walks (the default instance; J3 builds a second for the atlas rooms). */
export const SEEDLING_PLAYBACK_SUBSTRATE = 'flash_seedling_gen';
/** ⛓ J3 — the atlas rooms' substrate, the second instance's. */
export const SEEDLING_ATLAS_PLAYBACK_SUBSTRATE = 'flash_seedling';
/** How often a held goal is retried, and when one is given up on (logged). */
export const PENDING_RETRY_MS = 250;
export const PENDING_GIVE_UP_MS = 60000;

/**
 * Map an AP-vocabulary target to a goal in the generated set's own terms.
 *
 * @param {{kind:string, name?:string, x?:number, y?:number}} target
 * @param {{apitems:Array, doors:Array}} report  the assembly report
 * @param {{liveLevel?:number|null, region?:string|null}} [where]
 * @returns {{goal:object}|{refused:string}}
 */
export function resolveSeedlingGoal(target, report, { liveLevel = null, region = null } = {}) {
    const name = target?.name;
    if (target?.kind === 'location') {
        const a = (report?.apitems ?? []).find((x) => x.location === name);
        if (!a) return { refused: `"${name}" is not an AP location of the generated Seedling rooms` };
        return { goal: { kind: 'location', level: a.room, tag: a.tag, name } };
    }
    if (target?.kind === 'exit') {
        const doors = report?.doors ?? [];
        const door = doors.find((d) => name === `${d.region}__${d.exitName}` || name === `${d.region}__${d.exit_id}`)
            ?? (Number.isInteger(liveLevel) ? doors.find((d) => d.room === liveLevel
                && (d.exitName === name || d.exit_id === name)) : null)
            ?? (region ? doors.find((d) => d.region === region && (d.exitName === name || d.exit_id === name)) : null);
        if (!door) {
            return { refused: `"${name}" is not an exit of ${Number.isInteger(liveLevel)
                ? `the generated room the player is in (level ${liveLevel})` : 'the generated Seedling rooms'}` };
        }
        return { goal: { kind: 'exit', level: door.room, tile: [door.cell.tx, door.cell.ty], name } };
    }
    if (target?.kind === 'tile') {
        if (!Number.isInteger(liveLevel)) return { refused: 'a tile target needs the player in a generated room' };
        return { goal: { kind: 'tile', level: liveLevel, tile: [target.x, target.y] } };
    }
    return { refused: `not a walk target: ${JSON.stringify(target)}` };
}

/**
 * ⛓ J3 — map an AP-vocabulary target to a goal in a REAL room: `atlas` is the
 * panel's `{entries, refused, regions}` (the atlas arm's bound table, its
 * refusals, and `regionId → flash_seedling payload`).
 *
 * @returns {{goal:object}|{refused:string}}
 */
export function resolveSeedlingAtlasGoal(target, atlas, { liveLevel = null, region = null } = {}) {
    const name = target?.name;
    if (target?.kind === 'location') {
        const e = (atlas?.entries ?? []).find((x) => x.location === name);
        if (!e) {
            const why = (atlas?.refused ?? []).find((r) => r.location === name)?.why ?? null;
            // ⛓ VANILLA MAP — the map names its arm (absent = the atlas arm's map, J3's shape).
            const arm = atlas?.arm ?? 'atlas';
            return { refused: why ? `"${name}" is a location the ${arm} arm's map did NOT bind — ${why}`
                : `"${name}" is not a bound AP location of the atlas rooms` };
        }
        return { goal: { kind: 'location', level: e.level, tag: e.tag, entityType: e.entityType ?? null, name } };
    }
    if (target?.kind === 'exit') {
        const regions = atlas?.regions instanceof Map ? atlas.regions : new Map(Object.entries(atlas?.regions ?? {}));
        const order = [...(region && regions.has(region) ? [[region, regions.get(region)]] : []), ...regions];
        for (const [, payload] of order) {
            const exit = (payload?.exits ?? []).find((x) => x.exitName === name || x.exit_id === name);
            if (!exit) continue;
            if (!Array.isArray(exit.exit_tiles) || exit.exit_tiles.length === 0) {
                return { refused: `the atlas exit "${name}" marks no exit tiles to walk onto` };
            }
            return { goal: { kind: 'exit', level: payload.level, tiles: exit.exit_tiles, name } };
        }
        // ⛓ VANILLA MAP — a rules exit between two sub-regions of ONE level is a LOGICAL link (it carries a
        // rule, not a door): no sidecar marks a tile for it, and the region binding is level-granular
        // (`seedlingRegionBinding.js`, ruling 1, 2026-07-27), so no crossing would ever report it.
        const link = (atlas?.links ?? []).find((l) => l.name === name);
        if (link) return { refused: SUB_REGION_LINK_REFUSAL(link) };
        return { refused: `"${name}" is not an exit of the atlas rooms` };
    }
    if (target?.kind === 'tile') {
        if (!Number.isInteger(liveLevel)) return { refused: 'a tile target needs the player in an atlas room' };
        return { goal: { kind: 'tile', level: liveLevel, tile: [target.x, target.y] } };
    }
    return { refused: `not a walk target: ${JSON.stringify(target)}` };
}

/** ⛓ VANILLA MAP — why a logical sub-region link has no cell (`resolveSeedlingAtlasGoal`). */
export const SUB_REGION_LINK_REFUSAL = (link) => `the exit "${link.name}" links two sub-regions of level `
    + `${link.level} (${link.from} → ${link.to}): a LOGICAL link that carries a rule, not a door — no sidecar `
    + 'marks a tile for it, and the region binding is level-granular (ruling 1, 2026-07-27), so no crossing '
    + 'would ever report it';

/**
 * ⛓ VANILLA MAP — the rules' LOGICAL links between real-room regions: every rules exit whose two ends
 * are `flash_seedling` regions of the SAME level and that no sidecar names (a sidecar exit is a door
 * with tiles). Read off the rules alone: `regions` (the exits) and `preset_sidecars` (region → level).
 *
 * @param {object} rules  the raw rules.json
 * @param {Map<string, object>|object} regions  regionId → `flash_seedling` payload
 * @returns {Array<{name:string, from:string, to:string, level:number}>}
 */
export function realRoomLinks(rules, regions) {
    const payloads = regions instanceof Map ? regions : new Map(Object.entries(regions ?? {}));
    const doors = new Set([...payloads.values()].flatMap((p) => (p?.exits ?? []).map((x) => x.exitName)).filter(Boolean));
    const out = [];
    for (const slot of Object.values(rules?.regions ?? {})) {
        for (const [from, region] of Object.entries(slot ?? {})) {
            const level = payloads.get(from)?.level;
            if (!Number.isInteger(level)) continue;
            for (const exit of region?.exits ?? []) {
                const to = exit.connected_region;
                if (doors.has(exit.name) || payloads.get(to)?.level !== level) continue;
                out.push({ name: exit.name, from, to, level });
            }
        }
    }
    return out;
}

/** ⛓ VANILLA MAP — why the vanilla arm's encounter rows have no cell. */
export const ENCOUNTER_REFUSAL = (e) => `"${e.location}" is an ENCOUNTER (a ${e.entityType} in level ${e.level}): `
    + 'the vanilla arm does not rewrite it (it grants through a fight or a trade, not a pickup) and its check '
    + 'comes from the property path — there is no entity to walk onto';

/**
 * ⛓⛓ VANILLA MAP — the Playback Bot's name → cell map for the VANILLA randomizer arm
 * (`seedling_playthrough`), in the atlas map's shape (`{entries, refused, regions, links}`), so
 * `resolveSeedlingAtlasGoal` serves both arms unchanged. Nothing is typed by hand:
 *
 *   locations  the arm's own placement table (`loaded.entries`: location → `{level, tag, entity}`),
 *              each entry's `entityType` read off the DELIVERED set — the room the game plays holds the
 *              rewrite's entity at that tag and position, not the vanilla one. An entry the delivered room
 *              does not hold, and every `encounters` row, is REFUSED by name.
 *   exits      the rules' own `flash_seedling` sidecars (`regions`), as on the atlas arm, plus the logical
 *              sub-region links (`realRoomLinks`), each refused by name.
 *
 * @param {object} o
 * @param {Array} o.entries      the vanilla arm's placement entries
 * @param {Array} [o.encounters] the vanilla arm's encounter rows
 * @param {object} o.set         the delivered (rewritten) level set: `rooms[]` of `{id, source:{record}}`
 * @param {Map<string, object>} o.regions  regionId → `flash_seedling` payload
 * @param {object} o.rules       the raw rules.json (for the links)
 */
export function vanillaArmPlaybackMap({ entries = [], encounters = [], set = null, regions, rules = null }) {
    const rooms = new Map((set?.rooms ?? []).map((r) => [r.id, r]));
    const bound = [];
    const refused = encounters.map((e) => ({ location: e.location, why: ENCOUNTER_REFUSAL(e) }));
    for (const e of entries) {
        const record = rooms.get(e.level)?.source?.record ?? null;
        const held = (record?.entities ?? []).find((x) => x.x === e.entity?.x && x.y === e.entity?.y
            && Number(x.attrs?.tag) === e.tag);
        if (!held) {
            refused.push({ location: e.location, why: `the delivered level ${e.level} holds no entity with tag ${e.tag} `
                + `at (${e.entity?.x}, ${e.entity?.y}) — ${record ? 'the rewrite did not land there' : 'the set carries no record of that room'}` });
            continue;
        }
        bound.push({ location: e.location, level: e.level, tag: e.tag, entityType: held.type });
    }
    return { arm: RANDOMIZER_ARMS.VANILLA, entries: bound, refused, regions, links: realRoomLinks(rules, regions) };
}

/**
 * ⛓⛓ VANILLA MAP — the `flash_seedling` instance's name → cell map for a finished AP placement load
 * (`loadSeedlingRandomizer`'s result), or null. ONE decision for every arm, so the panel holds no
 * per-arm recipe:
 *   atlas      J3's map — the arm's bound table and refusals, the rules' sidecars (+ the links);
 *   vanilla    `vanillaArmPlaybackMap` over the table it built and the set it DELIVERED;
 *   generated  null (that arm's map is its assembly report, the other instance's).
 *
 * @param {object} loaded    the load's result (`arm`, `entries`, `refused`, `encounters`, `set`)
 * @param {object} rawRules  the raw rules.json
 */
export function realRoomPlaybackMap(loaded, rawRules) {
    if (!loaded?.eligibility?.eligible || loaded.arm === RANDOMIZER_ARMS.GENERATED) return null;
    const regions = new Map(atlasRoomRegions(rawRules).map(({ region }) => [region,
        rawRules.preset_sidecars[ATLAS_CHECK_PLAYER][region].playable_payload]));
    if (loaded.arm === RANDOMIZER_ARMS.ATLAS) {
        return { arm: RANDOMIZER_ARMS.ATLAS, entries: loaded.entries ?? [], refused: loaded.refused ?? [],
            regions, links: realRoomLinks(rawRules, regions) };
    }
    // The vanilla arm's result carries no `arm` field (its shape predates the other two): it is the arm
    // whose load DELIVERED a rewritten set.
    if (!loaded.set) return null;
    return vanillaArmPlaybackMap({ entries: loaded.entries ?? [], encounters: loaded.encounters ?? [],
        set: loaded.set, regions, rules: rawRules });
}

const ROOMS_OF = Object.freeze({ flash_seedling_gen: 'generated rooms', flash_seedling: 'atlas rooms' });

/**
 * ⛓ W2 — the default engine loader: the engine module by a COMPUTED URL (so
 * no bundler follows it and the panel's static closure stays model-free —
 * the `seedlingRandomizerWiring` precedent in `flashPanelUI.js`).
 */
export async function defaultLoadWasmEngine(deps) {
    const url = new URL('modules/flashPanel/seedlingWasmPlayback.js', document.baseURI).href;
    const mod = await import(/* @vite-ignore */ url);
    return mod.loadWasmPlaybackEngine({ ...deps, baseUrl: document.baseURI });
}

/**
 * The refusal for a panel that is not running a runtime this instance walks:
 * the JS runtime, and ⛓ W2/WG (`wasm` true) the wasm runtime too.
 */
export function notJsRuntimeRefusal(transport, setting, substrate = SEEDLING_PLAYBACK_SUBSTRATE, wasm = false) {
    return `${substrate} regions are walked only on the Seedling JS${wasm ? ' or wasm' : ''} runtime — the Flash Panel `
        + `is running the ${transport ?? 'unknown'} runtime (setting '${setting ?? 'auto'}'); set Flash Panel → `
        + `Runtime to 'js'${wasm ? " or 'wasm'" : ''} to let the Playback Bot walk ${ROOMS_OF[substrate] ?? 'these rooms'}`;
}

export class SeedlingPlaybackController {
    /**
     * @param {object} deps
     * @param {() => object|null} deps.getSurface  the panel's
     *   `seedlingPlaybackSurface()` — `{transport, setting, report, jsRuntime}`
     *   — or null when no panel is mounted
     * @param {(msg:string, level?:string) => void} [deps.log]
     * @param {(e:{substrate:string, target:object, reason:string}) => void} [deps.onWalkFailed]
     * @param {(e:{substrate:string, target:object, note:string|null}) => void} [deps.onWalkNote]  ⛓ S2 —
     *   the page's solver-mode notes ("solving…", a decline, a retry; null clears)
     * @param {object} [deps.timers] `{setInterval, clearInterval}` (tests)
     * @param {() => number} [deps.now]
     * @param {string} [deps.substrate]  ⛓ J3 — which substrate this instance walks
     * @param {function} [deps.resolve]  `(target, map, where) → {goal}|{refused}`
     * @param {(surface:object) => object|null} [deps.mapOf]  the name → cell map off the surface
     * @param {boolean} [deps.wasm]  ⛓ W2 — this instance walks under the wasm runtime too
     * @param {(surface:object) => object|null} [deps.wasmLevelSetOf]  ⛓ WG — the MOUNTED level set the
 *   engine stages (the generated instance); absent = the preset's map document (`wasm.mapPath`)
 * @param {(surface:object) => object|null} [deps.wasmDeliveredSetOf]  ⛓ VANILLA MAP — the REAL-room set
 *   an arm delivered (the vanilla arm's rewrite; an atlas arm's retag): the engine stages it, solver flow
 * @param {(deps:object) => Promise<object>} [deps.loadWasmEngine]  ⛓ W2 — builds the engine
     *   (`seedlingWasmPlayback.loadWasmPlaybackEngine`'s shape); tests inject a fake
     */
    constructor({
        getSurface, log = () => {}, onWalkFailed = () => {}, onWalkNote = () => {}, now = () => Date.now(),
        timers = { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (h) => clearInterval(h) },
        substrate = SEEDLING_PLAYBACK_SUBSTRATE, resolve = resolveSeedlingGoal, mapOf = (surface) => surface?.report ?? null,
        wasm = false, loadWasmEngine = defaultLoadWasmEngine, wasmLevelSetOf = null, wasmDeliveredSetOf = null,
    } = {}) {
        this.wasm = wasm;
        this._wasmLevelSetOf = wasmLevelSetOf;
        this._wasmDeliveredSetOf = wasmDeliveredSetOf;
        /** ⛓ VANILLA MAP — the delivered real-room set the current engine stages (null = the map document). */
        this._wasmDelivered = null;
        /** ⛓ WG — the level set the current engine was built from (null = the map document). */
        this._wasmSet = null;
        this._loadWasmEngine = loadWasmEngine;
        /** ⛓ W2 — the engine, the game it was built for, and a load in flight / its failure. */
        this._wasmEngine = null;
        this._wasmGame = null;
        this._wasmLoading = null;
        this._wasmLoadError = null;
        this._wasmLoadErrorGame = null;
        this.substrate = substrate;
        this._resolve = resolve;
        this._mapOf = mapOf;
        this._getSurface = getSurface;
        this._log = log;
        this._onWalkFailed = onWalkFailed;
        this._onWalkNote = onWalkNote;
        /** ⛓ S2 — the last note relayed (null = none). */
        this.lastNote = null;
        this._now = now;
        this._watched = null;
        this._unwatch = null;
        this._lastTarget = null;
        this._timers = timers;
        this._pending = null;
        this._playing = false;
        this._instant = false;
        this._retry = null;
        this.lastRefusal = null;
        this.lastGoal = null;
    }

    walkTo(target) {
        this.lastRefusal = null;
        const s = this._getSurface?.() ?? null;
        if (s && s.transport && !this._walks(s.transport)) return this._refuse(notJsRuntimeRefusal(s.transport, s.setting, this.substrate, this.wasm));
        const out = this._apply(target, s);
        if (out === 'pending') {
            this._hold(target);
            return true;
        }
        this._clearPending();
        return out;
    }

    play() { this._playing = true; this._instant = false; this._page()?.play(); }
    stop() { this._playing = false; this._instant = false; this._clearPending(); this._page()?.stop(); this._wasmEngine?.stop(); }
    step() { this._page()?.step(); }
    instant() {
        this._playing = true;
        this._instant = true;
        this._go(this._page());
    }
    reset() { this._playing = false; this._instant = false; this._clearPending(); this._page()?.reset(); this._wasmEngine?.stop(); }
    setRate() { /* the game's own 30 tick/s clock is the only clock */ }

    /** The page's walk state, for readouts and rows: `{state, reason, goal}` or null. */
    status() {
        const p = this._page();
        if (!p && this._wasmEngine) {
            const w = this._wasmEngine.status();
            return { state: w.phase, reason: this.lastNote, goal: w.goal, pending: this._pending?.target ?? null, wasm: w };
        }
        return p ? { state: p.state, reason: p.reason, goal: p.goal, pending: this._pending?.target ?? null } : null;
    }

    // ── internals ─────────────────────────────────────────────────────────

    /** Does this instance walk under `transport`? 'js' always; ⛓ W2 'wasm' when built with `wasm: true`. */
    _walks(transport) {
        return transport === 'js' || (this.wasm && transport === 'wasm');
    }

    /**
     * ⛓ W2 — the engine for the panel's CURRENT game, or null while it loads
     * (a load is started). A different game object (a preset switch, a
     * remount) is a new engine: the old one is stopped, never reused.
     */
    _engineFor(s) {
        const game = s.wasm?.getGame?.() ?? null;
        if (!game) return null;
        const levelSet = this._wasmLevelSetOf ? (this._wasmLevelSetOf(s) ?? null) : null;
        if (this._wasmLevelSetOf && !levelSet) return null;
        // ⛓ VANILLA MAP — the game plays the DELIVERED rooms (an apitem where the map document has a chest):
        // the engine stages those, and a new delivered set is a new engine, like a new game.
        const deliveredSet = this._wasmDeliveredSetOf ? (this._wasmDeliveredSetOf(s) ?? null) : null;
        if (this._wasmEngine && this._wasmGame === game && this._wasmSet === levelSet
            && this._wasmDelivered === deliveredSet) return this._wasmEngine;
        if (this._wasmEngine) { try { this._wasmEngine.dispose(); } catch { /* gone */ } this._wasmEngine = null; }
        if (this._wasmLoading?.game === game && this._wasmLoading.levelSet === levelSet
            && this._wasmLoading.deliveredSet === deliveredSet) return null;
        // ⛔ A load that FAILED for this game is not retried: `_applyWasm` turns it into a named refusal.
        if (this._wasmLoadError && this._wasmLoadErrorGame === game) return null;
        const loading = { game, levelSet, deliveredSet };
        this._wasmLoading = loading;
        this._wasmLoadError = null;
        this._wasmLoadErrorGame = null;
        const deps = {
            mapPath: s.wasm.mapPath,
            ...(levelSet ? { levelSet } : {}),
            ...(deliveredSet ? { deliveredSet } : {}),
            getGame: () => this._getSurface?.()?.wasm?.getGame?.() ?? null,
            getWin: () => this._getSurface?.()?.wasm?.getWin?.() ?? null,
            teleport: (p) => this._getSurface?.()?.wasm?.teleport?.(p) ?? false,
            getCheckBinding: () => this._getSurface?.()?.checkBinding ?? null,
            // ⛓ W7 — the glue query: may the engine hold the arrival it just saw (no redirect in flight)?
            getSwapState: () => this._getSurface?.()?.swapState?.() ?? null,
            log: this._log,
            onNote: (n) => this._relayNote(n),
            onFailed: (reason) => this._fail(this._lastTarget, `the wasm playback failed: ${reason}`),
        };
        Promise.resolve().then(() => this._loadWasmEngine(deps)).then((engine) => {
            if (this._wasmLoading !== loading) { try { engine?.dispose?.(); } catch { /* gone */ } return; }
            this._wasmLoading = null;
            this._wasmEngine = engine;
            this._wasmGame = game;
            this._wasmSet = levelSet;
            this._wasmDelivered = deliveredSet;
        }, (err) => {
            if (this._wasmLoading !== loading) return;
            this._wasmLoading = null;
            this._wasmLoadError = String(err?.message ?? err);
            this._wasmLoadErrorGame = game;
        });
        return null;
    }

    _relayNote(note) {
        this.lastNote = note ?? null;
        try { this._onWalkNote({ substrate: this.substrate, target: this._lastTarget, note: this.lastNote }); } catch { /* a listener's bug */ }
    }

    /** ⛓ W2 — `_apply` under the wasm runtime: true / false (refused) / 'pending'. */
    _applyWasm(target, s) {
        // ⛓ WG — refused before anything loads: no producer turns a tile into a tape (the walker
        // producer serves a location or an exit), so waiting for the game would only delay the NO.
        if (this._wasmLevelSetOf && target?.kind !== 'location' && target?.kind !== 'exit') {
            return this._refuse(`a ${target?.kind ?? 'missing'} target is not walked in the ${ROOMS_OF[this.substrate] ?? this.substrate} `
                + 'on the wasm runtime — their tapes come from the walker producer, which serves a location or an exit');
        }
        const map = this._mapOf(s);
        if (!map) return this._noMap(s);
        const engine = this._engineFor(s);
        if (!engine) {
            if (this._wasmLoadError && this._wasmLoadErrorGame === (s.wasm?.getGame?.() ?? null)) {
                const why = this._wasmLoadError;
                // Cleared, so the NEXT walkTo tries a fresh load (a fixed server, a new page).
                this._wasmLoadError = null;
                this._wasmLoadErrorGame = null;
                return this._refuse(`the wasm playback engine did not load: ${why}`);
            }
            return 'pending';
        }
        const liveLevel = engine.liveLevel();
        const r = this._resolve(target, map, { liveLevel, region: s.region ?? null });
        if (r.refused) return this._refuse(r.refused);
        this._lastTarget = target;
        const answer = engine.walkTo(r.goal);
        if (!answer?.ok) return this._refuse(`the wasm runtime refused ${JSON.stringify(r.goal)}: ${answer?.reason ?? 'no answer'}`);
        this.lastGoal = r.goal;
        return true;
    }

    /**
     * ⛓ VANILLA MAP — no name → cell map: 'pending' while the AP placement load may still bind one, or a
     * refusal BY THE LOAD'S OWN REASON once it bound none (an ineligible load) — never
     * a silent hold until `PENDING_GIVE_UP_MS`.
     */
    _noMap(s) {
        if (!s?.apRefusal) return 'pending';
        return this._refuse(`no name → cell map for the ${ROOMS_OF[this.substrate] ?? this.substrate}: the AP placement load `
            + `bound none — ${s.apRefusal}`);
    }

    _page(surface = this._getSurface?.()) {
        return surface?.transport === 'js' ? (surface.jsRuntime?.playback ?? null) : null;
    }

    _refuse(reason) {
        this.lastRefusal = reason;
        this._log(`[playback] walkTo refused — ${reason}`, 'warn');
        return false;
    }

    /** true / false (refused) / 'pending' (not resolvable YET). */
    _apply(target, s) {
        if (s?.transport === 'wasm' && this.wasm) return this._applyWasm(target, s);
        const page = this._page(s);
        const map = this._mapOf(s);
        if (s?.transport && !map) return this._noMap(s);
        if (!s || !s.transport || !page || !map) return 'pending';
        const liveLevel = s.jsRuntime?.run?.level ?? null;
        const r = this._resolve(target, map, { liveLevel, region: s.region ?? null });
        if (r.refused) return this._refuse(r.refused);
        // ⛓ S1 — the solver mode travels with the goal (the page may be newer than the setting's last push).
        page.setSolverWalk?.(s.solverWalk === true);
        const answer = page.walkTo(r.goal);
        if (!answer?.ok) return this._refuse(`the JS runtime refused ${JSON.stringify(r.goal)}: ${answer?.reason ?? 'no answer'}`);
        this.lastGoal = r.goal;
        this._lastTarget = target;
        this._watch(page);
        if (this._playing) this._go(page);
        return true;
    }

    /** Start the page's walk: `instant` (a solved plan in one burst) when asked and offered, else `play`. */
    _go(page) {
        if (!page) return;
        if (this._instant && typeof page.instant === 'function') page.instant();
        else page.play();
    }

    /** Relay the page's FAILED walks and ⛓ S2 its solver notes (one subscription per page; a remount is a new page). */
    _watch(page) {
        if (this._watched === page) return;
        this._unwatch?.();
        this._watched = page;
        this._unwatch = typeof page.onWalk === 'function' ? page.onWalk((e) => {
            if (e?.type === 'solver') {
                this.lastNote = e.message ?? null;
                try { this._onWalkNote({ substrate: this.substrate, target: this._lastTarget, note: this.lastNote }); } catch { /* a listener's bug */ }
                return;
            }
            if (e?.state !== 'failed') return;
            this._fail(this._lastTarget, `the JS runtime's walk failed: ${e.message ?? page.reason ?? 'no reason given'}`);
        }) : null;
    }

    _fail(target, reason) {
        this.lastRefusal = reason;
        this._log(`[playback] ${reason}`, 'warn');
        try { this._onWalkFailed({ substrate: this.substrate, target, reason }); } catch { /* a listener's bug */ }
    }

    _hold(target) {
        this._pending = { target, since: this._now() };
        if (this._retry) return;
        this._retry = this._timers.setInterval(() => this._retryPending(), PENDING_RETRY_MS);
    }

    _retryPending() {
        if (!this._pending) { this._clearPending(); return; }
        const s = this._getSurface?.() ?? null;
        if (s && s.transport && !this._walks(s.transport)) {
            const { target } = this._pending;
            this._clearPending();
            this._fail(target, notJsRuntimeRefusal(s.transport, s.setting, this.substrate, this.wasm));
            return;
        }
        const { target } = this._pending;
        const out = this._apply(target, s);
        if (out !== 'pending') {
            this._clearPending();
            if (out === false) this._fail(target, this.lastRefusal);
            return;
        }
        if (this._now() - this._pending.since > PENDING_GIVE_UP_MS) {
            this._clearPending();
            this._fail(target, `the walkTo was never handed to the JS runtime — no `
                + `${!s ? 'flash panel' : !this._mapOf(s) ? `name → cell map for the ${ROOMS_OF[this.substrate] ?? this.substrate} (the AP placement load)`
                    : s.transport === 'wasm' ? 'started wasm game / playback engine' : 'JS runtime page'} `
                + `within ${PENDING_GIVE_UP_MS / 1000} s`);
        }
    }

    _clearPending() {
        this._pending = null;
        if (this._retry) { this._timers.clearInterval(this._retry); this._retry = null; }
    }
}
