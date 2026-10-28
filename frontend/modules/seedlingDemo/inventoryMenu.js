/**
 * seedlingDemo/inventoryMenu — the V inventory menu's OWN state, without the DOM:
 * `Inventory.update`'s input block and its slide, transcribed (`Inventory.as:161-289`).
 *
 * ⛓ WHY THIS IS NOT IN `levelRun.js`. `Inventory.set open` IS `Game.freezeObjects = _open`
 * (`Inventory.as:151-153`), and `Bot.update` treats a freezeObjects frame as a DEAD frame: no
 * tick, no dispatch (`Bot.as` dead-frame gate). So a menu session is ZERO tape ticks between
 * two live ones, and the only thing it leaves on the run is a `Main.primary` / `Main.secondary`
 * write. The page core HOLDS the room while the menu is open (the run does not step, as the
 * game's dead frames do not) and hands the writes to the run; this module decides them.
 *
 * ⚠ BOT-WORLD, AS THE MODEL IS. The Bot sets `Inventory.help = false` (`Bot.as` `botStart`), so
 * the first-use / extended tutorials (`drawFirstUseHelp`, `drawExtendedHelp`, `Help(0)`) never
 * appear and `extended` never opens the menu on its own. `firstUse` therefore only GATES the
 * toggle (`:193`), and the help-text stepping on a V press (`:218-240`) never has text to step.
 *
 * ⛔ THE ORDER WITHIN ONE FRAME IS THE GAME'S, and it is load-bearing:
 *   1. the TOGGLE, on a (V or I) RELEASE, if `firstUse` (`:193-196`);
 *   2. THEN, only if open: Up / Down / X / C RELEASES (`:197-217`).
 * So the frame that OPENS the menu also reads that frame's arrow/X/C releases, and the frame
 * that CLOSES it does not.
 *
 * The gate on the whole block is `p && (!Game.freezeObjects || open)` (`:191`), and `Game.update`
 * calls `inventory.update()` only while `canInventory()` (`Game.as:1044-1051`, `:1549-1553`:
 * not talking, a live player with `receiveInput`); otherwise it forces `open = false`. The caller
 * answers both as `openable` (the run's state at a live frame's tail).
 */

/** `Inventory.as:38` — the slide divides the remaining distance by this, every frame. */
export const MOVEMENT_DIVISOR = 5;
/** `FP.screen` is 160 × 160 (`Main.as:36`, `super(160, 160, FPS)`); the panel is 66 × 148. */
export const SCREEN = Object.freeze({ w: 160, h: 160 });
export const PANEL = Object.freeze({ w: 66, h: 148 });
/** `Inventory.as:39-40` — closed off-screen left; open at x 0, or -23 before `extended` (`:336`). */
export const OFFSET_MIN = Object.freeze({ x: -70, y: SCREEN.h / 2 - PANEL.h / 2 });
export const offsetMaxFor = (extended) => ({ x: extended ? 0 : -23, y: OFFSET_MIN.y });
/** `Inventory.as:53-61` — the selection pulse and the X/C letter pulse. */
export const SCALE = Object.freeze({ min: 1, max: 1.5, rate: 0.1 });
export const TEXT_SCALE = Object.freeze({ min: 1, max: 2, rate: 0.2 });

/** The keys the menu reads, by tape name (`Player.keys`, `Player.as:59`: 1 up, 3 down, 4 X, 5 C, 7 V, 8 I). */
export const MENU_KEYS = Object.freeze({ up: 'up', down: 'down', primary: 'primary', secondary: 'secondary' });
export const TOGGLE_KEYS = Object.freeze(['inventory', 'inventory2']);

export function createInventoryMenu() {
    return {
        open: false,
        // `Game.inventory` is STATIC (`Game.as:459`, built once at `:687-690`), so `selected`
        // persists across rooms for the page's life.
        selected: 0,
        offset: { x: OFFSET_MIN.x, y: OFFSET_MIN.y },
        scale: SCALE.min,
        textScale: [TEXT_SCALE.min, TEXT_SCALE.min],
    };
}

/** `Inventory.moveToward` (`:443-453`), Point.length and all. */
function moveToward(from, to) {
    from.x += (to.x - from.x) / MOVEMENT_DIVISOR;
    from.y += (to.y - from.y) / MOVEMENT_DIVISOR;
    if (Math.abs(Math.hypot(from.x, from.y) - Math.hypot(to.x, to.y)) <= 0.1) {
        from.x = to.x;
        from.y = to.y;
    }
}

/**
 * One frame of `Inventory.update`, in place. Returns what the frame did:
 * `{ toggled, writes: [{ kind: 'primary' | 'secondary', slot }] }`.
 *
 * @param menu      from `createInventoryMenu`
 * @param released  Set of tape key names RELEASED this frame
 * @param ctx       `{ openable, firstUse, slotCount, extended }`:
 *                  `openable` = `canInventory() && (!Game.freezeObjects || open)` without the
 *                  menu's own freeze; `slotCount` = `Inventory.items.length`.
 */
export function inventoryMenuFrame(menu, released, { openable, firstUse, slotCount, extended = false }) {
    const writes = [];
    let toggled = false;
    if (!openable) {
        // `Game.update`'s else-arm: `inventory.open = false` — and no `update()`, so no slide either.
        if (menu.open) { menu.open = false; toggled = true; }
        return { toggled, writes };
    }
    if (TOGGLE_KEYS.some((k) => released.has(k)) && firstUse) {
        menu.open = !menu.open;
        toggled = true;
    }
    if (menu.open && slotCount > 0) {
        const before = menu.selected;
        if (released.has(MENU_KEYS.up)) menu.selected = (menu.selected - 1 + slotCount) % slotCount;
        if (released.has(MENU_KEYS.down)) menu.selected = (menu.selected + 1) % slotCount;
        if (released.has(MENU_KEYS.primary)) {
            writes.push({ kind: 'primary', slot: menu.selected });
            menu.textScale[0] = TEXT_SCALE.max;
        }
        if (released.has(MENU_KEYS.secondary)) {
            writes.push({ kind: 'secondary', slot: menu.selected });
            menu.textScale[1] = TEXT_SCALE.max;
        }
        if (menu.selected !== before) menu.scale = SCALE.max;
    }
    moveToward(menu.offset, menu.open ? offsetMaxFor(extended) : OFFSET_MIN);
    if (menu.scale > SCALE.min) menu.scale = Math.max(menu.scale - SCALE.rate, SCALE.min);
    for (let i = 0; i < menu.textScale.length; i++) {
        menu.textScale[i] = menu.textScale[i] > TEXT_SCALE.min ? menu.textScale[i] - TEXT_SCALE.rate : TEXT_SCALE.min;
    }
    return { toggled, writes };
}

/** Whether the panel is anywhere on screen (closed and fully slid out draws nothing). */
export const inventoryMenuVisible = (menu) => menu.offset.x + PANEL.w > 0;
