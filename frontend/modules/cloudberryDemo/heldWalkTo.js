/**
 * The bot's walk while the game page is not up yet (cloudberry P4a).
 *
 * The Cloudberry panel shows a small waiting page until the first Cloudberry region, then swaps in
 * the game page (index.js `activate`). The waiting page runs the flash bridge too, so a `walkTo`
 * the Playback Bot sends in that window reaches the WAITING page's bridge, which holds it until a
 * `configure` that never comes, and is gone when the iframe is replaced. Measured: the tutorial walk
 * pressed Play 0.1 s after loading the world on a cold page, and the bot waited on its first coin for
 * 60 s (`tutorial-walk-procgen-cloudberry`, cold, both the local copy and the Pages path).
 *
 * The region has the same gap and procgenPlayer closes it by re-publishing the active region when the
 * game page's bridge announces appReady. This is the bot channel's twin: the panel's proxy remembers
 * the LATEST walkTo sent while the game page is not up (a stop or reset forgets it; last write wins),
 * and the module re-sends it on the game page's appReady. Once the page is up nothing is held.
 *
 * Pure: no DOM, no event bus.
 */
export function createHeldWalkTo() {
    let pageUp = false;
    let held = null;   // the walkTo args, or null

    return {
        /** A control message the proxy sent. */
        sent(method, args) {
            if (method === 'stop' || method === 'reset') held = null;
            else if (method === 'walkTo' && !pageUp) held = Array.isArray(args) && args[0] ? [...args] : null;
        },
        /** The game page is going away or being replaced (a site change). */
        pageGone() {
            pageUp = false;
        },
        /** The game page's bridge announced appReady: the walk to send again, or null. */
        pageReady() {
            pageUp = true;
            const w = held;
            held = null;
            return w;
        },
        isPageUp: () => pageUp,
        held: () => (held ? [...held] : null),
    };
}
