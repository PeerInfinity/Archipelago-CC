/**
 * ⛓ RETURN TO MENU — a world whose runtime's Restart warps the player to the start says so with ONE per-player
 * flag, `exporter["<p>"].return_to_menu: true`, and the logic stays edge-for-edge what the game's doors are.
 *
 * ⚖ The user, 2026-10-05: *"I don't want to add new edges that lead to menu. I want the logic to be aware that
 * returning to the menu at any point is always possible."* (An earlier cut emitted a `<region> -> Menu` exit per
 * region; it was ruled out before it shipped.)
 *
 * WHO SAYS IT. A substrate whose runtime answers the Menu panel's Restart by warping the player to the start
 * declares `restartWarp` (= `RESTART_WARP` below) on its registry entry — Seedling's two do: the glue re-takes the
 * start hop and the binding teleports to `seedlingStartSpawn`. A producer writes the flag only when such a
 * substrate plays its rooms (`buildRulesJson` asks the substrates that realised a region; the atlas compiler is
 * told by its caller, which asks the same declaration). Absent = false: the world keeps real soft-lock detection.
 *
 * WHO READS IT. Position-aware consumers only — AP's own reachability is from the start and never needs a way
 * back. A walk that would otherwise be stranded may Restart (`returnToMenu(rules, p)`), and a soft-lock census
 * lists such places as Restart-only (a diagnostic) instead of reporting them as soft-locks.
 */

/** What a substrate declares when its Restart warps the player to the start region. */
export const RESTART_WARP = Object.freeze({
    target: 'Menu',
    label: 'Restart',
    cite: 'menuPanel Restart (world mode) -> Menu -> GameStart; flashPanel/seedlingRegionGlue.js re-takes the '
        + 'start hop, seedlingRegionBinding teleports to seedlingStartSpawn',
});

/** The per-player key, in `exporter["<p>"]` beside `assume_bidirectional_exits`. */
export const RETURN_TO_MENU_KEY = 'return_to_menu';

/** Does `rules`' slot `playerId` declare that returning to the menu is always possible? Absent = false. */
export function returnToMenu(rules, playerId = '1') {
    return rules?.exporter?.[String(playerId)]?.[RETURN_TO_MENU_KEY] === true;
}

/** Write the flag into `rules.exporter[playerId]` (creating the block), leaving every other key as it was. */
export function declareReturnToMenu(rules, playerId = '1') {
    const p = String(playerId);
    rules.exporter = rules.exporter ?? {};
    rules.exporter[p] = { ...(rules.exporter[p] ?? {}), [RETURN_TO_MENU_KEY]: true };
    return rules;
}
