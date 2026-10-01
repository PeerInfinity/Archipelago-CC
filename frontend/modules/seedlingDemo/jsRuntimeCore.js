/**
 * seedlingDemo/jsRuntimeCore — **THE SEEDLING JS RUNTIME, SPEAKING THE WASM
 * PAGE'S CONTRACT** (Seedling JS runtime arc, slice J1; plan
 * `NewDocs/plans/seedling-js-substrate-plan.md`).
 *
 * The flash panel talks to a recompiled Seedling page through
 * `WasmBridgeAdapter`: a same-origin iframe exposing `window.__swfBridge`
 * (`flashPanel/wasm/<build>/swf_bridge_avm2.js`) whose `game` table holds the
 * BridgeGeneric verbs (`wireCheck`, `configure`, `readState`) and the Bot.as
 * verbs the generated arm calls (`botStatus`, `botMobiles`, `botLoadLevels`,
 * `botLevelSet`). This module is that page's GAME, played by the JavaScript
 * model (`createManualSession` over `levelRun`) instead of the recompiled
 * binary, so the host glue — the region binding, the check binding, the
 * level-set delivery — runs UNCHANGED against either runtime.
 *
 * ⛔ DOM-FREE, like `watchManual.js`: the page (`jsRuntimePage.js`) owns the
 * canvas, the keys and the clock; this file owns the contract and is driven
 * tick by tick, so every row of it runs in node.
 *
 * ── WHAT EACH WASM-SIDE FACT BECOMES HERE ──────────────────────────────────
 *
 *  · `BridgeGeneric` reports a declared property ONLY WHEN IT CHANGED, in
 *    DECLARATION order (`games/seedling.json` `$comment_m1_seams`) →
 *    `flush()`: one pass over the configured `state_properties`, after every
 *    tick and every host call that can move one. The first pass after
 *    `configure` reports everything (the baseline burst).
 *  · `Main.playerPositionX/Y` are the GAME CONSTRUCTOR'S args, written by
 *    `new Game(level, x, y)` — not the live position → `run.worldCtor`.
 *  · `Game.pendingCheck = "<seq>|<level>|<tag>|0"` is written by
 *    `APItem.removed()` → `Game.setPersistence(tag, false)` on CONTACT
 *    (`APItem` never sets `special`, so `Pickup.pick_up()` takes the
 *    `removeSelf()` arm: no freeze, no text) → `apItemContact()` below, over
 *    the `apitem` class row's `apItem` box (`levelWorld.ENTITY_CLASSES`).
 *  · `Game.pendingExit = "<seq>|<from>|teleporter|<x>|<y>|<to>"` is written by
 *    `Teleporter.update()` in the frame its `new Game` is built (x, y are the
 *    TELEPORTER'S `.oel` position) → the run's `transitions` ledger, joined
 *    to the teleporter the player stood in on the tick before (a teleporter
 *    tests the position the previous tick left, `levelRun.pickupUnderfoot`'s
 *    note). A PIT FALL through a `control` block is a transition too, and the
 *    game writes no `pendingExit` for it; neither does this.
 *  · `queueItems` items are drained once per tick (`getItemQueue`'s cadence):
 *    `{class, property, value}` flag writes, `{class:'game', property:'menu'}`
 *    (accepted, nothing to do), and the teleport recipe
 *    `{invocation:'new_instance', className:'Game', args:[level, x, y]}`
 *    → a fresh run booted at those constructor args.
 *  · `botLoadLevels` answers `'pending'` per chunk and `'ok'` on the last;
 *    `botLevelSet` reads back `{active, table_levels, start_level}`
 *    (`levelSetDisagreement.READBACK_FIELDS`).
 *
 * ── ⚖ THE TWO APPROVED LIBERTIES (user, 2026-10-01) ───────────────────────
 *
 *  1. DEATH = RESPAWN AT THE ROOM'S ARRIVAL. The model REFUSES a terrain death
 *     by design (a pit with no `control` block, a drowning, lava) — it throws a
 *     `PhysicsV2Error`. The page catches exactly those (`isDeathRefusal`) and
 *     boots a fresh run at the arrival the dead run was constructed with,
 *     carrying the room's earned clears. The model is not changed. ⛔ A pit
 *     WITH a `control` block is a TRANSITION, not a throw, so it never reaches
 *     the catch; every other refusal HALTS the page by name.
 *  2. The `apitem` class row (see above).
 *
 * ── ⛔ WHAT IS NOT MODELLED, BY NAME ──────────────────────────────────────
 *
 *  · An item flag that changes MID-ROOM re-boots the run where the player
 *    stands (the run's inventory is fixed at boot). The room's earned clears
 *    are carried; its per-visit state (enemy positions, velocity) is not.
 *  · Only a MOUNTED level set is playable. The vanilla 116 (the `flash_seedling`
 *    atlas rooms) are slice J3's; before a set is delivered the page reports
 *    level −1, the game's own "no game" sentinel.
 */

import { createManualSession } from './watchManual.js';
import { bootStaging } from './procgenOracle.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { assembleLevelSetChunks } from './levelSetValidator.js';
import { ENTITY_CLASSES, entityRect } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';
import { createRuntimeWalker, WALK_STATES } from './jsRuntimeWalker.js';

/**
 * The pins every JS-runtime run carries. ⛔ `sound` is not optional: without
 * it the first wet tick throws (J0(a)), and `dead_frames` is the census pin.
 */
export const JS_RUNTIME_PINS = Object.freeze(['dead_frames', 'sound']);

/**
 * What this runtime declares, in `builds.json`'s capability vocabulary — the
 * eligibility module OWNS the list (it is in the panel bundle and imports
 * nothing; this direction, seedlingDemo → flashPanel, is free).
 */
export { JS_RUNTIME_CAPABILITIES } from '../flashPanel/seedlingRandomizerEligibility.js';

/**
 * ⛓ The refusals that ARE deaths. Both are thrown by `playerPhysicsV2` as a
 * `PhysicsV2Error`: `fallDestination` (a pit in a room with no `control`
 * block — `checkFallingInPit` calls `die()`) and the drown step (water without
 * the conch, lava without the dark suit — the same `drownTimer`).
 */
export const DEATH_REFUSALS = Object.freeze([
    Object.freeze({ kind: 'pit', pattern: /fell into a pit in level -?\d+, which has NO control block/ }),
    Object.freeze({ kind: 'drown', pattern: /DROWNED in level -?\d+/ }),
]);

/** The death kind a thrown refusal names, or null when it is not a death. */
export function isDeathRefusal(err) {
    if (!err || err.name !== 'PhysicsV2Error') return null;
    const hit = DEATH_REFUSALS.find((d) => d.pattern.test(String(err.message)));
    return hit ? hit.kind : null;
}

/** The `Main.*` flag every item property names, with its empty value. */
const ITEM_FLAGS = Object.freeze(Object.fromEntries(Object.values(ITEM_PROPERTIES)
    .map((spec) => [spec.property, spec.kind === 'add' ? spec.base : false])));

/** The class aliases `games/seedling.json` declares, by the AS3 name they resolve to. */
const MAIN = 'Main';
const GAME = 'Game';

const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

/**
 * A mounted room's record, the `level` the model addresses it by stamped on.
 * ⛔ `planLevelSetChunks` renders a `record` room to `{xml}` before it
 * crosses, so the page parses the SAME document the wasm game reads.
 */
export function recordOfRoom(room) {
    const src = room?.source ?? {};
    let record;
    if (typeof src.xml === 'string') record = parseOelLevel(src.xml, `room ${room.id} (${room.name ?? ''})`);
    else if (src.record) record = structuredClone(src.record);
    else throw new Error(`jsRuntimeCore: room ${room?.id} carries neither {xml} nor {record} — `
        + 'an `embed` room names a vanilla level, which is slice J3\'s');
    return { ...record, level: room.id };
}

/** The apitems a record holds, with the contact box the class row declares. */
export function apItemsOf(record) {
    const cls = ENTITY_CLASSES.apitem.apItem;
    return (record.entities ?? []).filter((e) => e.type === 'apitem').map((e) => ({
        x: e.x,
        y: e.y,
        tag: Number(e.attrs?.tag ?? -1),
        look: e.attrs?.look ?? 'ap',
        rect: entityRect(cls, e.x, e.y),
    }));
}

/**
 * @param {object} [opts]
 * @param {(prop: string, value: any) => void} [opts.onStateChanged] the host's
 *   report hook — the page forwards it to `__swfBridge.onStateChanged`.
 * @param {(msg: string) => void} [opts.log]
 */
export function createJsRuntime({ onStateChanged = null, log = () => {} } = {}) {
    let config = null;
    /** alias -> AS3 class name, from `configure`'s `classes`. */
    let aliases = new Map();
    let reported = new Map();
    let baselineOwed = false;

    const flags = { ...ITEM_FLAGS };
    let menu = true;
    let queue = [];

    let staged = null;          // { set_id, count, chunks: Map(index -> chunk) }
    let mounted = null;         // { set, records: Map(level -> record), source, apItems: Map(level -> [...]) }
    let levelSetError = null;

    let session = null;
    /** The constructor args the CURRENT room was entered with — the respawn point. */
    let arrival = null;
    /** "level:tag" persistence slots earned by previous runs, carried into the next. */
    const carried = new Map();
    /** "level:tag" apitems collected (their slot is cleared). */
    const collected = new Set();
    let deferredReboot = false;

    let pendingExit = '';
    let pendingExitSeq = 0;
    let pendingCheck = '';
    let pendingCheckSeq = 0;
    let ticks = 0;
    let halted = null;
    const deaths = [];
    const events = [];

    const note = (e) => { events.push({ t: ticks, ...e }); log(e.message ?? JSON.stringify(e)); };

    /**
     * ⛓ J2 — the Playback Bot's walker. It is asked for this tick's keys
     * INSIDE `tick`, so the walk runs on the page's one clock; while it holds
     * no goal (or is paused) the keyboard drives, exactly as in J1.
     */
    const walkListeners = new Set();
    const walker = createRuntimeWalker({
        apItemOf: (level, tag) => (mounted?.apItems.get(level) ?? []).find((a) => a.tag === tag) ?? null,
        isCollected: (level, tag) => collected.has(`${level}:${tag}`),
        onEvent: (e) => {
            note({ type: 'walk', state: e.state, message: `[js runtime] ${walker.describe()}` });
            for (const fn of walkListeners) { try { fn(e); } catch (err) { log(`[js runtime] a walk listener threw: ${err.message}`); } }
        },
    });

    // ── the run ────────────────────────────────────────────────────────────

    function bankClears() {
        if (!session) return;
        for (const c of session.run.earnedClears ?? []) carried.set(`${c.level}:${c.tag}`, { level: c.level, tag: c.tag });
    }

    function boot({ level, x, y }, why) {
        if (!mounted) throw new Error('jsRuntimeCore: no level set is mounted — nothing to boot');
        if (!mounted.records.has(level)) {
            throw new Error(`jsRuntimeCore: the mounted set has no level ${level} `
                + `(it has ${mounted.records.size} rooms)`);
        }
        bankClears();
        const staging = bootStaging({ boot: { level, x, y }, items: { ...flags }, pins: [...JS_RUNTIME_PINS] });
        staging.persistence = [...carried.values()].map((c) => ({ ...c }));
        session = createManualSession({ levelSource: mounted.source, staging, name: 'js-runtime', scratchPersistence: true });
        halted = null;
        deferredReboot = false;
        note({ type: 'boot', level, x, y, why, message: `[js runtime] boot level ${level} at (${x}, ${y}) — ${why}` });
        return session;
    }

    function teleport(args) {
        const [rawLevel, rawX, rawY] = Array.isArray(args) ? args : [];
        let level = Number(rawLevel);
        let x = Number(rawX);
        let y = Number(rawY);
        if (!mounted) {
            note({ type: 'refused', message: '[js runtime] teleport refused — no level set is mounted (the vanilla '
                + 'rooms are slice J3\'s)' });
            return;
        }
        if (!Number.isInteger(level) || level < 0) {
            // The game's own new-game arm: `level < 0` starts at the set's start.
            ({ level, x, y } = mounted.set.start);
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            note({ type: 'refused', message: `[js runtime] teleport refused — no position in ${JSON.stringify(args)}` });
            return;
        }
        arrival = { level, x, y };
        boot(arrival, 'teleport (new Game)');
    }

    /** The teleporter of `world` the box stood in, preferring one that goes to `to`. */
    function firedTeleporter(world, box, to) {
        const tps = world?.teleporters ?? [];
        return tps.find((tp) => !tp.deactivated && tp.to === to && overlaps(tp.rect, box))
            ?? tps.find((tp) => !tp.deactivated && overlaps(tp.rect, box))
            ?? null;
    }

    function apItemContact(level, box) {
        for (const a of mounted?.apItems.get(level) ?? []) {
            const key = `${level}:${a.tag}`;
            if (a.tag >= 0 && collected.has(key)) continue;
            if (!overlaps(a.rect, box)) continue;
            if (a.tag >= 0) collected.add(key);
            pendingCheck = `${++pendingCheckSeq}|${level}|${a.tag}|0`;
            note({ type: 'check', level, tag: a.tag, message: `[js runtime] apitem collected — level ${level} tag ${a.tag}` });
            return a;
        }
        return null;
    }

    /** One movement tick. `held` is a Set of tape key names. */
    function tick(held = new Set()) {
        drainQueue();
        if (!session || halted) { flush(); return { stepped: false }; }
        if (deferredReboot && !session.run.inCeremony) rebootInPlace('an item flag changed');
        const run = session.run;
        const level0 = run.level;
        const world0 = run.world;
        const box0 = playerBoxAt(run.state.x, run.state.y);
        const n0 = run.transitions.length;
        const inCeremony0 = Boolean(run.inCeremony);
        const walkHeld = walker.heldFor(run);
        const { held: drive } = session.heldFor(walkHeld ?? held);
        try {
            session.step(drive);
        } catch (err) {
            const kind = isDeathRefusal(err);
            if (!kind) {
                halted = { tick: ticks, message: err.message };
                note({ type: 'halt', message: `[js runtime] HALTED — the model refused: ${err.message.split('\n')[0]}` });
                flush();
                return { stepped: false, halted };
            }
            deaths.push({ t: ticks, level: level0, kind, arrival: { ...arrival } });
            note({ type: 'death', kind, level: level0, message: `[js runtime] death (${kind}) in level ${level0} — `
                + `respawn at the arrival (${arrival.x}, ${arrival.y})` });
            boot(arrival, `respawn after a ${kind} death`);
            ticks += 1;
            walker.observe({ death: kind });
            flush();
            return { stepped: true, death: kind };
        }
        ticks += 1;
        let crossing = null;
        if (run.transitions.length > n0) {
            const tr = run.transitions[run.transitions.length - 1];
            const tp = firedTeleporter(world0, box0, tr.to_level);
            if (tp) {
                pendingExit = `${++pendingExitSeq}|${tr.from_level}|teleporter|${Math.trunc(tp.x)}|${Math.trunc(tp.y)}|${tr.to_level}`;
                crossing = { from: tr.from_level, to: tr.to_level, x: tp.x, y: tp.y };
            }
            arrival = { level: run.level, ...run.worldCtor };
            note({ type: 'transition', from: tr.from_level, to: tr.to_level, teleporter: !!tp,
                message: `[js runtime] level ${tr.from_level} → ${tr.to_level}${tp ? ` through the teleporter at (${tp.x}, ${tp.y})` : ' (no teleporter — a fall)'}` });
        } else if (!inCeremony0 && run.level === level0) {
            // `Pickup.update` collides against the position the previous tick
            // left (`World.addUpdate` prepends; the Player is added first).
            apItemContact(level0, box0);
        }
        walker.observe({ crossing });
        flush();
        return { stepped: true, crossing };
    }

    function rebootInPlace(why) {
        const run = session.run;
        // The player's tick-0 state is the ctor args plus the half tile.
        const half = 8;
        const keep = arrival;
        boot({ level: run.level, x: run.state.x - half, y: run.state.y - half }, why);
        arrival = keep;
    }

    // ── the host's verbs ───────────────────────────────────────────────────

    function aliasClass(alias) { return aliases.get(alias) ?? alias; }

    function applyItem(item) {
        if (item?.invocation === 'new_instance') {
            if (item.className === GAME) teleport(item.args);
            else note({ type: 'ignored', message: `[js runtime] new_instance ${item.className} is not modelled` });
            return;
        }
        if (item && typeof item.property === 'string' && 'value' in item) {
            const cls = aliasClass(item.class);
            if (cls === GAME && item.property === 'menu') { menu = Boolean(item.value); return; }
            if (cls === MAIN && item.property in flags) {
                const value = typeof ITEM_FLAGS[item.property] === 'number' ? Number(item.value) : Boolean(item.value);
                if (flags[item.property] !== value) {
                    flags[item.property] = value;
                    if (session) deferredReboot = true;
                }
                return;
            }
        }
        note({ type: 'ignored', message: `[js runtime] queue item not modelled: ${JSON.stringify(item)}` });
    }

    function drainQueue() {
        const items = queue;
        queue = [];
        for (const item of items) applyItem(item);
        if (deferredReboot && session && !session.run.inCeremony && !halted) rebootInPlace('an item flag changed');
    }

    function valueOf(cls, property) {
        const run = session?.run ?? null;
        if (cls === MAIN) {
            if (property === 'level') return run ? run.level : -1;
            if (property === 'playerPositionX') return run ? run.worldCtor.x : 0;
            if (property === 'playerPositionY') return run ? run.worldCtor.y : 0;
            if (property in flags) return flags[property];
        }
        if (cls === GAME) {
            if (property === 'pendingExit') return pendingExit;
            if (property === 'pendingCheck') return pendingCheck;
            if (property === 'keyMask') {
                let mask = 0;
                for (const k of run?.keys ?? []) mask |= (1 << k);
                return mask;
            }
            if (property === 'totemCount') return (run?.saveState?.totem_parts ?? []).filter(Boolean).length;
            if (property === 'menu') return menu;
        }
        return undefined;
    }

    function readAll() {
        const out = {};
        for (const p of config?.state_properties ?? []) {
            const v = valueOf(aliasClass(p.class), p.property);
            if (v !== undefined) out[p.property] = v;
        }
        return out;
    }

    /** Report every declared property that changed, in declaration order. */
    function flush() {
        if (!config) return [];
        const out = [];
        for (const p of config.state_properties ?? []) {
            const v = valueOf(aliasClass(p.class), p.property);
            if (v === undefined) continue;
            if (!baselineOwed && reported.has(p.property) && reported.get(p.property) === v) continue;
            reported.set(p.property, v);
            out.push([p.property, v]);
        }
        baselineOwed = false;
        for (const [prop, v] of out) {
            try { onStateChanged?.(prop, v); } catch (e) { log(`[js runtime] onStateChanged threw: ${e.message}`); }
        }
        return out;
    }

    function configure(json) {
        let parsed;
        try { parsed = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return `error:${e.message}`; }
        if (!parsed || !Array.isArray(parsed.state_properties)) return 'error:configure needs state_properties';
        config = parsed;
        aliases = new Map(Object.entries(parsed.classes ?? {}).map(([alias, c]) => [alias, c?.name ?? alias]));
        reported = new Map();
        baselineOwed = true;
        return 'ok';
    }

    function botLoadLevels(json) {
        let chunk;
        try { chunk = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) {
            staged = null;
            return `error:chunk is not JSON (${e.message})`;
        }
        if (!chunk || typeof chunk.set_id !== 'string' || !Number.isInteger(chunk.chunk_index)
            || !Number.isInteger(chunk.chunk_count)) {
            staged = null;
            return 'error:a chunk needs set_id, chunk_index and chunk_count';
        }
        if (!staged || staged.set_id !== chunk.set_id) staged = { set_id: chunk.set_id, count: chunk.chunk_count, chunks: new Map() };
        staged.chunks.set(chunk.chunk_index, chunk);
        if (staged.chunks.size < staged.count) return 'pending';
        const all = [...staged.chunks.values()].sort((a, b) => a.chunk_index - b.chunk_index);
        staged = null;
        const res = assembleLevelSetChunks(all);
        if (!res.ok) {
            levelSetError = res.errors.join('; ');
            return `error:${levelSetError}`;
        }
        try {
            mount(res.set);
        } catch (e) {
            levelSetError = e.message;
            return `error:${e.message}`;
        }
        return 'ok';
    }

    function mount(set) {
        const records = new Map();
        const apItems = new Map();
        for (const room of set.rooms) {
            const record = recordOfRoom(room);
            records.set(room.id, record);
            apItems.set(room.id, apItemsOf(record));
        }
        bankClears();
        mounted = { set, records, apItems, source: levelSourceFromAtlas(records) };
        // A new set is a new save: what the old one cleared means nothing here.
        carried.clear();
        collected.clear();
        session = null;
        arrival = null;
        halted = null;
        levelSetError = null;
        walker.setGoal(null);
        note({ type: 'mount', message: `[js runtime] level set ${set.set_id} mounted — ${set.rooms.length} room(s)` });
        flush();
    }

    /**
     * ⛓ J2 — a goal the host controller resolved, checked against the MOUNTED
     * set before it is accepted: `{ok:true}` or `{ok:false, reason}`. The
     * level must be a mounted room; a location must be one of its apitems; an
     * exit must be one of its teleporters (by `.oel` cell).
     */
    function validateGoal(goal) {
        if (!mounted) return { ok: false, reason: 'no level set is mounted' };
        if (!goal || !['location', 'exit', 'tile'].includes(goal.kind)) {
            return { ok: false, reason: `not a walk goal: ${JSON.stringify(goal)}` };
        }
        const record = mounted.records.get(goal.level);
        if (!record) return { ok: false, reason: `the mounted set has no level ${goal.level}` };
        if (goal.kind === 'location') {
            if (!(mounted.apItems.get(goal.level) ?? []).some((a) => a.tag === goal.tag)) {
                return { ok: false, reason: `level ${goal.level} has no apitem with tag ${goal.tag}` };
            }
            return { ok: true };
        }
        const [tx, ty] = Array.isArray(goal.tile) ? goal.tile : [];
        if (!Number.isInteger(tx) || !Number.isInteger(ty)) return { ok: false, reason: `no tile in ${JSON.stringify(goal)}` };
        if (goal.kind === 'exit' && !(record.entities ?? []).some((e) => e.type === 'teleporter'
            && Math.floor(e.x / 16) === tx && Math.floor(e.y / 16) === ty)) {
            return { ok: false, reason: `level ${goal.level} has no teleporter on tile (${tx}, ${ty})` };
        }
        return { ok: true };
    }

    const playback = {
        walkTo(goal) {
            const v = validateGoal(goal);
            if (!v.ok) {
                note({ type: 'walk-refused', message: `[js runtime] walkTo refused — ${v.reason}` });
                return v;
            }
            walker.setGoal(goal);
            return v;
        },
        play() { walker.play(); },
        stop() { walker.stop(); },
        step() { walker.step(); },
        reset() { walker.reset(); },
        get state() { return walker.state; },
        get reason() { return walker.reason; },
        get goal() { return walker.goal; },
        get playing() { return walker.playing; },
        get stats() { return walker.stats; },
        describe: () => walker.describe(),
        /** `fn(event)` on every walk state change; returns the unsubscribe. */
        onWalk(fn) { walkListeners.add(fn); return () => walkListeners.delete(fn); },
        STATES: WALK_STATES,
    };

    const game = {
        wireCheck: () => 'ok:seedling-js',
        configure: (json) => { const r = configure(json); flush(); return r; },
        readState: () => (config ? JSON.stringify(readAll()) : 'error:not configured'),
        botStatus: () => JSON.stringify({
            runtime: 'js',
            level: session ? session.run.level : -1,
            time: ticks,
            ticks,
            x: session ? session.run.state.x : null,
            y: session ? session.run.state.y : null,
            deaths: deaths.length,
            halted: halted ? halted.message : null,
        }),
        botMobiles: () => JSON.stringify({
            mobiles: session ? [{ cls: 'Player', x: session.run.state.x, y: session.run.state.y }] : [],
        }),
        botLoadLevels: (json) => botLoadLevels(json),
        botLevelSet: () => JSON.stringify({
            active: mounted?.set.set_id ?? null,
            mounted: mounted?.set.set_id ?? null,
            table_levels: mounted ? mounted.set.rooms.length : 0,
            rooms: mounted ? mounted.set.rooms.length : 0,
            start_level: mounted?.set.start?.level ?? null,
            error: levelSetError,
        }),
    };

    return {
        game,
        /** ⛓ J2 — the Playback Bot's verbs (the host controller calls these). */
        playback,
        /** `__swfBridge.queueItems` — drained on the next tick, like `getItemQueue`. */
        queueItems(items) {
            if (items == null) return;
            for (const it of Array.isArray(items) ? items : [items]) queue.push(it);
        },
        tick,
        flush,
        get session() { return session; },
        get run() { return session?.run ?? null; },
        get mounted() { return mounted; },
        get arrival() { return arrival ? { ...arrival } : null; },
        get flags() { return { ...flags }; },
        get collected() { return new Set(collected); },
        get deaths() { return deaths.map((d) => ({ ...d })); },
        get events() { return events.slice(); },
        get halted() { return halted; },
        get ticks() { return ticks; },
        get configured() { return config !== null; },
        /** The current room's record and its uncollected apitems, for the painter. */
        view() {
            if (!session) return null;
            const level = session.run.level;
            return {
                level,
                world: session.run.world,
                state: session.run.state,
                apItems: (mounted.apItems.get(level) ?? []).filter((a) => !collected.has(`${level}:${a.tag}`)),
            };
        },
    };
}
