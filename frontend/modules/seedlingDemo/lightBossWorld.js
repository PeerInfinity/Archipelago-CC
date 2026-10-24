/**
 * seedlingDemo/lightBossWorld — ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20, D2): what the L69 controller adds to the WORLD
 * BUILD — the `LightBossTotem` Solid while its tag holds, `endState()`'s exit Teleporter once it is cleared.
 *
 * ⛔ A LEAF MODULE ON PURPOSE: `levelWorld.js` imports it, and `lightBoss.js` (the fight) imports the step helpers
 * that themselves import `levelWorld.js` — so the world half lives here, with no imports at all, and `lightBoss.js`
 * re-exports it. Only reached while `CONTACT_FIDELITY.lightsBossFight` is ON (`levelWorld`'s per-entity hook).
 */

/** `{x, y, w, h, right, bottom}` — `levelWorld.rect`'s shape, spelled here so this module imports nothing. */
const box = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });

export const LIGHT_BOSS_WORLD = Object.freeze({
    totem: Object.freeze({
        /** `setHitbox(16, 16)` at the controller's `(x, y)`, `type = "Solid"` (`LightBossTotem.as:22,26`). */
        w: 16,
        h: 16,
        src: 'Scenery/LightBossTotem.as:20-28 (ctor), :30-46 (render: `type = ""` once `die`)',
    }),
    exit: Object.freeze({
        /** `new Teleporter(x, y, namedLevel("light_boss_exit"), namedX, namedY, true)` — `VanillaSet.as:140`. */
        level: 36,
        x: 112,
        y: 96,
        /** `Teleporter`'s `setHitbox(16, 16, 0, 0)` (`Teleporter.as:44`). */
        w: 16,
        h: 16,
        /** `new Player(playerx, playery)` plus the ctor's half tile (`Player.as:357`), as every teleporter row. */
        arrivalOffset: 8,
        src: 'Enemies/LightBossController.as:102-107; VanillaSet.as:139-140; Teleporter.as:39-62',
    }),
});

/** The exit teleporter's box at the controller's `(x, y)` (and the totem's: both are 16x16 there). */
export function lightsExitRect(x, y) {
    return box(x, y, LIGHT_BOSS_WORLD.exit.w, LIGHT_BOSS_WORLD.exit.h);
}

/**
 * What `buildLevelWorld` adds for one `lightbosscontroller` placement:
 *   · `controller` — the run's roster row `{id, x, y, tag, flierNum, cleared}`;
 *   · `totem` — while the tag HOLDS, `check()` adds `LightBossTotem(x, y)`: a 16x16 `"Solid"` (a `solids` row whose
 *     `lightTotemId` the run's live map opens once the totem's `die` render ran);
 *   · `exit` — once the tag is CLEARED, `check()` runs `endState()` (`LightBossController.as:58-62`), whose
 *     `Teleporter(x, y, 36, 112, 96, true)` is a `teleporters` row in `levelWorld`'s own shape (untagged: never
 *     deactivated).
 * ⚠ In the game both are ADDED inside the first frame's `check()` pass, so they exist from the second update; the
 * world has them from the first. No arrival in L69 stands on (72,72) (the pit landing is (48,128)), so nothing reads
 * the one-frame difference; it is stated, not modelled.
 */
export function lightsWorldRows(e, x, y, tag, clearedTags) {
    const flierNum = Number(e.attrs?.fliernum);
    const cleared = Boolean(clearedTags && tag >= 0 && clearedTags.has(tag));
    const id = `lightbosscontroller@${x},${y}`;
    const controller = Object.freeze({ id, x, y, tag, flierNum, cleared });
    if (!cleared) {
        return {
            controller,
            totem: { rect: box(x, y, LIGHT_BOSS_WORLD.totem.w, LIGHT_BOSS_WORLD.totem.h), cls: null,
                tag: 'lightbosstotem', x, y, lightTotemId: id },
            exit: null,
        };
    }
    const ex = LIGHT_BOSS_WORLD.exit;
    return {
        controller,
        totem: null,
        exit: {
            tag: -1, invert: false, deactivated: false, isStairs: false,
            x, y,
            rect: lightsExitRect(x, y),
            to: ex.level,
            playerx: ex.x,
            playery: ex.y,
            arrival: { x: ex.x + ex.arrivalOffset, y: ex.y + ex.arrivalOffset },
            lightsExit: true,
        },
    };
}
