/**
 * ⛓ FLASH'S MAP-CLICK TELEPORT (mode-toggle design §4.2, slice CA-S4): `flash.teleport` (a REGION click teleports the
 * game there) and `flash.teleportLocation` (a LOCATION click teleports it to the location), in each map panel's
 * "On click" strip.
 *
 * ⚖ user, session 84c8ab35, 2026-11-20T16:29:00Z, *"Per-map option (Recommended)"*: each map's strip gets its own
 * "Teleport in Flash" option; the Region Graph's starts with the current box setting, the Region Map's starts OFF;
 * Flash's "TP on UI click" box keeps working only for clicks outside the two maps.
 *
 * So:
 *   - `initial(panelId)` = the box's state AT THAT MOMENT for the Region Graph, `false` for the Region Map. The strip
 *     writes it once (`seed`), when the action first registers while the panel is loaded (or the panel first loads
 *     while it is registered); from then on the Graph's stored value decides, not the box. ⚠ The box is not a setting
 *     (`flashPanelUI.js`: "the panel's own switch"): every page load builds it unticked, and it is hidden until a
 *     teleport-capable game is up, which is also when these actions register. So on a real first run the Graph's
 *     value is the unticked box: `false`, unless a script ticked the box before the registration.
 *   - Registered while the loaded game can teleport (`gameConfig.teleport`); unregistered on teardown and on a game
 *     that cannot (`flashPanelUI.js` `_setupTeleportUI` / `_unregisterClickActions`).
 *   - The region teleport runs at `ORDER.select` (before the path): the box's `regionGraph:nodeSelected` listener ran
 *     there, because the Graph published that event before any action. The location teleport runs with the panel
 *     actions (after the checks): the box's teleport rode on the check's `user:locationCheck`.
 *
 * `getPanel()` → the FlashPanelUI that owns them (`_teleportToRegion` / `_teleportToLocation`,
 * `teleportOnClickCheckbox`).
 */
import { ORDER, PANEL_ACTION_IDS } from '../regionView/clickActions.js';

/** The Graph's first value: the box as it is now. The Map's (and any other panel's): off. */
function initialFor(getPanel) {
    return (panelId) => (panelId === 'regionGraph' ? !!getPanel()?.teleportOnClickCheckbox?.checked : false);
}

export function makeFlashTeleportActions(getPanel) {
    const ready = () => {
        const p = getPanel();
        return p?.adapter ? p : null;
    };
    return Object.freeze([
        Object.freeze({
            id: PANEL_ACTION_IDS.flashTeleport,
            owner: 'flash',
            label: 'Teleport there in Flash',
            summary: 'Flash TP',
            target: 'region',
            kind: 'toggle',
            order: ORDER.select,
            initial: initialFor(getPanel),
            run: (h, ctx) => {
                const p = ready();
                if (!p) return { ok: false, reason: 'no-game' };
                p._teleportToRegion(ctx.regionName);
                return { ok: true, region: ctx.regionName };
            },
        }),
        Object.freeze({
            id: PANEL_ACTION_IDS.flashTeleportLocation,
            owner: 'flash',
            label: 'Teleport to it in Flash',
            summary: 'Flash TP',
            target: 'location',
            kind: 'toggle',
            order: ORDER.panel,
            initial: initialFor(getPanel),
            run: (h, ctx) => {
                const p = ready();
                if (!p) return { ok: false, reason: 'no-game' };
                p._teleportToLocation(ctx.locationName);
                return { ok: true, location: ctx.locationName };
            },
        }),
    ]);
}
