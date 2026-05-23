/**
 * Substrate registry entry for JtA as a loop-mode substrate.
 *
 * v1 scope: each Archipelago region = one JtA zone. The procgen
 * region graph drives transitions; jta:loadRegion tells the panel
 * which zone to render. v1 does not surface AP location checks
 * inside regions and does not contribute build-time procgen hooks —
 * the sidecar carries the per-region `jtaZone` mapping and the
 * substrate just renders the corresponding zone.
 */

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'jta',
    panelComponentType: 'jtaSubstrateWrapperPanel',
    loadRegionEvent: 'jta:loadRegion',

    // v1: no AP location checks inside regions, no logic gates, no
    // spatial topology. The supported-feature set is intentionally
    // minimal — extended in later phases as features are added.
    supportedFeatures: Object.freeze([
        'region_topology_from_source',
    ]),

    // procgenPlayer passes the sidecar entry's `playable_payload` (not
    // the whole sidecar) to this function. The bridge then reads
    // `world.jtaZone` directly. Expected payload shape for a jta
    // region:
    //   { jtaZone: <number>, exits: [...], ... }
    //
    // Exits are converted from the on-disk array form into a Map
    // keyed by exitName — same shape mazeRoom's deserializer uses —
    // because procgenPlayer.handleRegionMove calls
    // sourceWorld.exits.has(exitName) when resolving the targetExitId
    // for a region transition. Leaving exits as an array breaks that
    // lookup with "exits.has is not a function".
    deserializeWorld: (payload) => {
        const p = payload ?? {};
        const exitsArray = Array.isArray(p.exits) ? p.exits : [];
        const exitsMap = new Map();
        for (const e of exitsArray) {
            const key = e?.exitName ?? e?.exit_id;
            if (key) exitsMap.set(key, e);
        }
        return { ...p, exits: exitsMap };
    },

    // Playback bot integration is deferred to a later phase. Until
    // then, the registry's getPlaybackController returns null and the
    // bot no-ops on JtA regions (per the substrate registry contract).
    getPlaybackController: () => null,

    // Build-time hooks (generateRegionCore / placeFromItems / etc.)
    // are omitted in v1 — procgen does not generate JtA-specific
    // region content; it just records `jtaZone` in the sidecar.
});
