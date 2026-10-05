# Noiz2sa Substrate

The Noiz2sa substrate (`frontend/modules/noiz2saSubstrate/`, id `noiz2sa`) plays Kenta Cho's BulletML shoot-'em-up from the `frontend/modules/bulletml-dodge/` submodule (`PeerInfinity/bulletml-dodge`, `branch = substrate`) in a same-origin iframe, as a summary loop-mode substrate. One region is one segment of one stage: a span of scenes from a start to an end, where a hit restarts the region and the clear is its one location.

## The rulings

The user's rulings for this substrate (2026-10-04/05):

- The host is Archipelago Loops. "Each region will be one segment of one level. Losing a life should restart the region." A region is one or more scenes and may pass a boss into the next stage.
- "Spending time in a region drains mana. Dying resets to the start of a region, and doesn't restore the mana that was already spent."
- The hitbox is always `centered`. One location per region (its clear), no other location, no offline progress.
- It is an iframe game from a submodule, like the other iframe games, and it is playable outside loop mode (no drain then).

## Files

| File | Role |
|------|------|
| `noiz2saRegion.js` | The pure region model: positions (`parsePosition`, `showPosition`), `checkSpan`, `regionSpanOf`, and `createRegionRun`, the region rules on an injected engine. A copy of the game repo's `src/game/segment-run.js` (see below), plus the run-length input-tape code the test uses. |
| `noiz2saSubstrateLibrary.js` | The registry entry: the payload declaration, `deserializeWorld`, loop support, and the zone table (`NOIZ2SA_ZONES`, `extractZoneRules`). Loads headless. |
| `index.js` | The host module: the panel (flashSubstrate's iframe panel factory, pointed at `game/index.html`) and the panel activation on `noiz2sa:loadRegion`. |
| `game/index.html`, `game/main.js` | The iframe page. It imports the engine and the game's simple drawing (`web/draw.js`) from the submodule; an import map points `@xmldom/xmldom` at the submodule's `web/xmldom-shim.js` (the browser's `DOMParser`). |

## A region

The payload carries `{gameId: 'noiz2sa', start: {stage, scene}, end: {stage, scene}, seed, ap_locations: {clear: '<region>__clear'}}` plus the engine's envelope (`exits`, `fogEnabled`). Positions are the engine's: `stage` 0–9 are the stages 1–10 and 10–13 the endless modes; `scene` 0–8 are the ordinary scenes and 9 is the boss. Players write a position `STAGE:SCENE` with the scene 1–9 or `boss` (`1:boss`).

`createRegionRun` follows `segment-run.js` exactly:

- an attempt starts a game at the span's start (`newGame`'s `startScene`) on the region's seed, with the centered hitbox;
- a hit restarts the region from its start at once;
- an ordinary scene is over when the next one starts; the boss when it is killed (`clear`) or after `BOSS_CAP` frames (3 minutes) without a hit; a boss that is not the end leads into the next stage at scene 0;
- the region is cleared when its end scene is over, and the score counts from its start.

**Why a copy.** `segment-run.js` imports the engine, and the engine imports `@xmldom/xmldom`, which only the page maps. The registry library and vitest must load headless, so the run takes the engine as an argument. The copy was checked against `runSegment` on the real engine (headless, with a Node resolve hook for xmldom) on four spans, 1:1, 1:2–1:3, 2:boss and 1:boss–2:1: the same clear frame and score on each.

## Runtime

Like runner and bounce, the iframe rides `flashSubstrate`'s shared code: the panel factory and the injected `bridge.js`, which speaks the `__swfBridge` contract. The bridge forwards only `params` to the game, so `deserializeWorld` writes the checked span and the exit list into `params`; `serializeWorld` drops it again.

- The page implements `configure`. It calls `sendLocation('clear')` on the region's clear and `sendExit(exitName, null)` when the player leaves.
- The exits are closed until the region is cleared on this visit, or its location was already checked.
- The game steps only while it is being played. A configured region waits for a game key or a click, and the page pauses when it loses focus. Keys: arrows/WASD move, Z fires, X is slow, P pauses, 1–9 leave by that exit.
- Opened directly in a tab, the page plays the region in its URL: `game/index.html?start=1:2&end=1:3&seed=1`.
- Test surface (not the contract): `window.__noiz2saDebug()` reads the state, and `window.__noiz2saTest` plays an injected input tape (`play(tape, {speed})`) and leaves by an exit (`leave(name)`).

## Loop mode

Noiz2sa is a summary substrate (`loopSupport.summaryRecording`) with runner's declarations except the Bot. Record keeps the visit's net result: the drain seconds, the clear check and the departure. Playback applies it instantly, and live play is priced by time through `loopState._timeDrainTick`. A hit costs nothing extra: the time already spent stays spent. There is no `executeVia` and no `getPlaybackController` yet. See [Loop Recording and Block Modes](./loop-recording.md#summary-substrates).

## The test preset and the test

`noiz2sa_substrate_test` is the zone table as a world: 1:1, 1:2–1:3 and 1:boss–2:1, all on seed 1, Victory on the last clear and `Noiz2sa Star` (a filler) on the others. It is written by `scripts/test/generate-noiz2sa-substrate-test-preset.mjs` (Pass A of the pipeline, `loop_costs` stamped), so loop mode auto-enables.

The in-app row `noiz2sa-region-loop-visit` (test-substrates, batch `fast`) parks a Record block on the 1:1 region and drives the page by injected input. Idle fire is hit at frame 240 and the region restarts with nothing checked. The game repo's Ace bot's clearing tape (1002 frames) checks the clear. Leaving saves a summary priced by the drain, and instant Playback spends the repriced summary. The unit tests are `noiz2saRegion.test.js` (the rules on a fake engine) and `noiz2saSubstrateLibrary.test.js` (the entry, the payload round trip, the zone table, the committed preset).

## Related documentation

- [Runner Substrate](./runner.md) — the summary substrate whose declarations this one copies
- [Loop Recording and Block Modes](./loop-recording.md) — summary capture and the time drain
- [Flash Substrate](./flash.md) — the iframe panel and bridge this substrate reuses
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract
