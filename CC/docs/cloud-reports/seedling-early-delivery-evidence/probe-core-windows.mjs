/**
 * seedling-early-delivery — THE JS RUNTIME'S "EARLY" WINDOWS, IN NODE: the real panel adapter (`FlashBridgeAdapter`,
 * the shipped `games/seedling.json`) wired to the real core (`createJsRuntime`), the way `jsRuntimePage` wires them
 * (`configure` → `onStateChanged` → `_onStateChanged`; `_buildQueue` → `queueItems`). No browser, no server: the AP
 * inventory is the snapshot the adapter reads. Changes no source.
 *
 *   node probe-core-windows.mjs            → one row per (window, mode), then a table
 *
 * MODES
 *   once     the adapter pushes ONCE when the items arrive, then stops — what the CORE does with one write
 *   adapter  the adapter keeps pushing every 3 ticks (the page's 100 ms at 30 fps) — what the PAGE does
 *
 * WINDOWS (each a fresh page; the five items are put in the AP inventory at that point)
 *   first-frame    before the page's first tick (no run at all)
 *   vanilla        the vanilla first frame runs (L0, `Main.as:51`); the items land in it; THEN the AP load mounts
 *                  its set and teleports to the set's start — the panel's real order (attach → load → mount)
 *   mounted        the set is mounted (no run: `mount` drops the session), the start teleport not yet taken
 *   same-boot      in the same queue as a host `new Game` (the item before the teleport)
 *   after-boot     in the same queue as a host `new Game` (the item after the teleport)
 *   restore        the run is up; the items land, and at the same boundary the RE2 save written BEFORE them is
 *                  restored (`_bindJsSave` on a reload: the save predates what the server re-sends on connect)
 *   restore-held   the RE2 save is written AFTER the items, then restored (a reload: the server re-sends on connect):
 *                  the save and the host name the same items — held ONCE (one seal slot, hitsMax 4), not twice
 *   control        the run is up; the items land (no mount, no boot, no restore)
 */
import { readFileSync } from 'node:fs';

const R = new URL('../../../../frontend/', import.meta.url).pathname;
// `CORE=<file>` swaps the core (the BEFORE table: `git show b09ceca4:frontend/modules/seedlingDemo/jsRuntimeCore.js` saved
// beside it as `jsRuntimeCore.base.js`, an untracked copy, deleted after).
const { createJsRuntime } = await import(R + 'modules/seedlingDemo/' + (process.env.CORE || 'jsRuntimeCore.js'));
const { assembleGeneratedSeedlingSet } = await import(R + 'modules/seedlingDemo/seedlingGeneratedSet.js');
const { planLevelSetChunks } = await import(R + 'modules/seedlingDemo/levelSetValidator.js');
const { FlashBridgeAdapter } = await import(R + 'modules/flashPanel/flashBridgeAdapter.js');
const MAP = JSON.parse(readFileSync(R + 'modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const GAME = JSON.parse(readFileSync(R + 'modules/flashPanel/games/seedling.json', 'utf8'));
const GEN = JSON.parse(readFileSync(R + 'presets/seedling_generated_room/AP_1/AP_1_rules.json', 'utf8'));
const SET = assembleGeneratedSeedlingSet(GEN, { selfPlayer: 1 }).set;
const ITEMS = { 'Progressive Sword': 1, 'Red Key': 1, Seal: 1, 'Totem Shard': 1, Health: 1 };
const tp = (l, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [l, x, y] });

export function makePage(mode) {
    const inventory = {};
    let adapter = null;
    const rt = createJsRuntime({ onStateChanged: (p, v) => adapter?._onStateChanged(p, v), log: () => {} });
    adapter = new FlashBridgeAdapter({
        config: GAME, flashObjectId: `early-${Math.random()}`, stateManager: { getLatestStateSnapshot: () => ({ inventory }) },
        dispatcher: { publish: () => {} }, eventBus: { subscribe: () => () => {} }, log: () => {},
    });
    adapter._getFlash = () => rt.game;
    rt.setVanilla(MAP);
    let pushes = 0;
    let armed = false;
    // `once`: the FIRST push that carries the items, then nothing (the adapter's own gate — `gameReady`, the
    // readouts a method write waits for — may hold the first attempts back: those are not the one push).
    const push = () => {
        const items = adapter._buildQueue();
        if (!items.length) return false;
        rt.queueItems(items);
        pushes += 1;
        return items.some((i) => i.method || (i.property && i.value !== false && i.property !== 'menu'));
    };
    const page = {
        rt, adapter, inventory,
        attach() { adapter.configureBridge(); adapter.attach(); },
        grant() { Object.assign(inventory, ITEMS); armed = true; },
        /** the adapter's push (once per grant in `once` mode, every call in `adapter` mode) */
        push() { if (mode === 'adapter' || armed) { if (push() && mode === 'once') armed = false; } },
        tick(n = 1) {
            for (let i = 0; i < n; i += 1) {
                if (i % 3 === 0 && (mode === 'adapter' || armed)) page.push();
                rt.tick();
            }
        },
        mount() { let r; for (const c of planLevelSetChunks(SET).chunks) r = rt.game.botLoadLevels(JSON.stringify(c)); return r; },
        start() { const { level, x, y } = SET.start; rt.queueItems([tp(level, x, y)]); },
        get pushes() { return pushes; },
    };
    return page;
}

export function liveOf(rt) {
    const run = rt.run;
    return {
        level: run?.level ?? null,
        sword: run?.inventory?.hasSword === true,
        key0: !!run?.keys?.has?.(0),
        seal: run?.finalDoorGate?.sealSlotsFilled ?? 0,
        totem: (run?.saveState?.totem_parts ?? []).filter((v) => v === true).length,
        hitsMax: run?.inventory?.hitsMax ?? null,
    };
}

export function verdictOf(live) {
    const v = (held, twice) => (twice ? 'TWICE' : held ? 'APPLIED' : 'DROPPED');
    return {
        sword: v(live.sword, false), key: v(live.key0, false), seal: v(live.seal >= 1, live.seal > 1),
        totem: v(live.totem >= 1, live.totem > 1), health: v(live.hitsMax >= 4, live.hitsMax > 4),
    };
}

/** The window's sequence; returns the page after loading has finished (+ 120 ticks). */
export function runWindow(window, mode) {
    const p = makePage(mode);
    const settle = () => p.tick(120);
    switch (window) {
    case 'first-frame':
        p.attach(); p.grant(); p.push();
        p.tick(1); p.mount(); p.start(); settle(); break;
    case 'vanilla':
        p.attach(); p.tick(3); p.grant(); p.push(); p.tick(3);
        p.mount(); p.start(); settle(); break;
    case 'mounted':
        p.attach(); p.tick(3); p.mount(); p.grant(); p.push(); p.start(); settle(); break;
    case 'same-boot':
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(3);
        p.grant(); p.push(); p.start(); settle(); break;
    case 'after-boot':
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(3);
        p.start(); p.grant(); p.push(); settle(); break;
    case 'restore': {
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(6);
        const save = p.rt.exportSave();
        p.grant(); p.push(); p.rt.drainItems(); p.rt.restoreSave(save); settle(); break;
    }
    case 'restore-held': {
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(3); p.grant(); p.push(); p.tick(6);
        p.rt.restoreSave(p.rt.exportSave()); settle(); break;
    }
    case 'control':
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(6); p.grant(); p.push(); settle(); break;
    default: throw new Error(window);
    }
    return p;
}

export const WINDOWS = ['first-frame', 'vanilla', 'mounted', 'same-boot', 'after-boot', 'restore', 'restore-held', 'control'];

if (import.meta.url === `file://${process.argv[1]}`) {
    const rows = [];
    for (const mode of ['once', 'adapter']) {
        for (const w of WINDOWS) {
            const p = runWindow(w, mode);
            const live = liveOf(p.rt);
            const notes = p.rt.events.filter((e) => ['delivery', 'mount', 'boot', 'save'].includes(e.type))
                .map((e) => (e.type === 'delivery' ? `delivery:${e.kind}${e.changed ? '' : '(no-op)'}` : e.type === 'boot' ? `boot:L${e.level}` : e.type));
            rows.push({ mode, w, v: verdictOf(live) });
            console.log(`ROW ${mode} ${w} ${JSON.stringify({ live, pushes: p.pushes, notes })}`);
        }
    }
    console.log('\nTABLE (mode | window | sword | key | seal | totem | health)');
    for (const r of rows) console.log(`${r.mode} | ${r.w} | ${r.v.sword} | ${r.v.key} | ${r.v.seal} | ${r.v.totem} | ${r.v.health}`);
}
