# Noiz2sa Substrate

The Noiz2sa substrate (`frontend/modules/noiz2saSubstrate/`, id `noiz2sa`) plays Kenta Cho's BulletML shoot-'em-up from the `frontend/modules/bulletml-dodge/` submodule (`PeerInfinity/bulletml-dodge`, `branch = substrate`) in a same-origin iframe, as a summary loop-mode substrate. One region is one segment of one stage: a span of scenes from a start to an end, where a hit restarts the region and the clear is its one location.

## The rulings

The user's rulings for this substrate (2026-10-04/05):

- The host is Archipelago Loops. "Each region will be one segment of one level. Losing a life should restart the region." A region is one or more scenes and may pass a boss into the next stage.
- "Spending time in a region drains mana. Dying resets to the start of a region, and doesn't restore the mana that was already spent."
- The hitbox is always `centered`. One location per region (its clear), no other location, no offline progress.
- It is an iframe game from a submodule, like the other iframe games, and it is playable outside loop mode (no drain then).
- The bot plays; the player optionally. The bot is the humanlike bot at the player's current TRACKS. In incremental mode the personalities are replaced by spending strategies.
- Training: points come from the seconds spent in Noiz2sa regions plus the score from the region's start; only Noiz2sa regions train the bot. "Instant playback should still accumulate resources." Points are spent by hand or by a strategy ("Even" the default, or one track first); "The player can switch at any time"; "respecs free in the first version". At the ceiling, "Surplus mana and points can be used to boost region XP."
- "For some of your questions, I think I want the answer to be a user configurable setting": the training rates and prices, the bot's retry cap (default none: the bot retries until the mana runs out), the bot speed (1×, with 2× and 4×). The drain charges per game second, so a faster bot costs the same mana per region.
- The training screen is a section of the host-side Noiz2sa panel, outside the iframe.

## Files

| File | Role |
|------|------|
| `noiz2saRegion.js` | The pure region model: positions (`parsePosition`, `showPosition`), `checkSpan`, `regionSpanOf`, and `createRegionRun`, the region rules on an injected engine. A copy of the game repo's `src/game/segment-run.js` (see below), plus the run-length input-tape code the test uses. |
| `noiz2saSubstrateLibrary.js` | The registry entry: the payload declaration, `deserializeWorld`, loop support, and the zone table (`NOIZ2SA_ZONES`, `extractZoneRules`). Loads headless. |
| `index.js` | The host module: the panel (flashSubstrate's iframe panel factory, pointed at `game/index.html`, plus the training section), the panel activation on `noiz2sa:loadRegion`, the settings, the trainer's feeds and the bot proxy's injection. |
| `noiz2saTraining.js` | The host-side training glue around the game repo's `src/game/tracks.js`: the settings and their schema, the stored trainer, the visit meter, what Playback earns, the bot's walk options, and `createTrainerService`. Pure. |
| `noiz2saBotProxy.js` | `Noiz2saBotProxy`, the bot's playback controller: the shared `PlaybackProxy` whose `walkTo` also carries the bot's settings. |
| `noiz2saTrainingSection.js`, `noiz2saSubstrate.css` | The training section of the host panel. |
| `game/index.html`, `game/main.js` | The iframe page. It imports the engine and the game's simple drawing (`web/draw.js`) from the submodule; an import map points `@xmldom/xmldom` at the submodule's `web/xmldom-shim.js` (the browser's `DOMParser`). |
| `game/bot-worker.js` | The page's bot in a Web Worker: one attempt of the region, as `segment-run.js` plays it. |

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
- R plays the region again from its start on the same visit (the exits stay open if it was cleared). The next clear is sent again; the bridge dispatches it only if the host did not accept the earlier one (the action gate refuses a clear made while the queue is not parked on the region). See [Flash Substrate](./flash.md).
- The game steps only while it is being played. A configured region waits for a game key or a click, and the page pauses when it loses focus. Keys: arrows/WASD move, Z fires, X is slow, P pauses, R plays again, 1–9 leave by that exit.
- The page reports its play clock (`setPlayClock(running, {gameSeconds, score})`) on every state change and about every game second (63 frames): running only while `playing`. Waiting for the first key, paused, and cleared-and-waiting-to-leave are all stopped (the game does not step in any of them), and an injected tape that ran out returns the page to waiting. The stats are the visit's so far: the game seconds of every frame stepped, and the score of every attempt from the region's start (a hit keeps the failed attempt's score).
- Opened directly in a tab, the page plays the region in its URL: `game/index.html?start=1:2&end=1:3&seed=1`.
- Test surface (not the contract): `window.__noiz2saDebug()` reads the state (including `visitSeconds`, `visitScore`, `configures`, the bot's walk and `lastBot`, the last walk's settings and outcome), and `window.__noiz2saTest` plays an injected input tape (`play(tape, {speed})`), leaves by an exit (`leave(name)`) and plays the region again (`again()`).

## The bot

A Bot block hands each queued action to the walkTo solver. The registry entry declares `loopSupport.executeVia: 'solver'`, and `getPlaybackController` returns `Noiz2saBotProxy`, injected by `index.js` (null headless, so a Bot block there parks for live play). Its `walkTo(target)` publishes `noiz2sa:playbackControl` with a second argument, the bot's settings from `noiz2saTraining.js` `botWalkOptions`: the knobs at the trainer's current tracks (`tracks.js` `trainerKnobs`), the tracks, bot seed 1, the speed and the retry cap. The flash bridge passes it on as `__swfBridge.botWalkTo(goal, options)`. A location target becomes `{kind: 'pickup', id: 'clear'}`. An exit becomes `{kind: 'portal', id: exitName}`, because `deserializeWorld` sets `params.walkToExits: 'byName'`.

The page plays the region from where it is:

- The bot is `human.js` `botOptions({perception: 'observed', knobs})`, run by `game/bot-worker.js`. The worker plays its own copy of the attempt (`noiz2saRegion.js` `createRegionRun`, replaying the attempt's frames so far) and posts its inputs up to 180 frames ahead. The page plays them and waits, never guesses, when one is late. The budget is the counted `BROWSER_BUDGET`, so the page plays exactly what the headless `runSegment` plays. A boss into the next stage gets a new bot, as `runSegment` makes one per game.
- A hit restarts the region. The bot plays the next attempt with `segment-run.js` `attemptBotSeed(1, attempt − 1)`, so retries differ. It goes on until the clear or, with a retry cap N > 0, until N attempts failed. Then it gives up: the page waits for a key (its clock stopped) and the Bot block stays parked until the player plays the region or the queue resets.
- A pickup goal ends at the clear (the check completes the action). A portal goal also leaves by the exit after the clear, or at once when the exits are already open.
- It plays at the speed setting: 1, 2 or 4 game frames per 16 ms. The game does not pause when the page loses focus while the bot plays.
- A walk for the same goal sent again (the proxy re-sends it when the tracks or the bot settings change while the bot drives) applies its knobs from the next attempt on and its speed at once.
- `botStop` (a loop reset, a pause) hands the region back to the player. R plays the region again and stops the bot.

## The bot's training

The trainer is the game repo's `src/game/tracks.js`: five tracks (seeing, thinking, hands, focus, panic) from 0 to 100 (all 100 is the Expert), points earned per second and per score point, steps bought by a strategy or by hand, a free respec, and the surplus at the ceiling. `noiz2saTraining.js` keeps it on the host side, as plain JSON in localStorage under `noiz2sa:trainer:v1` (declared in `moduleInfo.storage`), so it survives loop resets and reloads.

It earns from two feeds, only for Noiz2sa regions (the regions `noiz2sa:loadRegion` loaded):

- **Live play and the Bot block**: every `substrate:playClock` report of a Noiz2sa region. The page reports the visit's cumulative `{gameSeconds, score}`, and the visit meter earns the difference since the last report. A counter that goes back is a new visit.
- **Instant Playback**: every `loops:summaryApplied` of a Noiz2sa summary earns the summary's `playStats` (the recorded visit's game seconds and score), the same points the live visit earned. A summary recorded before N4 has no `playStats` and earns its drain seconds.

Every attempt's score counts, not only the clearing one's. The training section of the host panel (`noiz2saTrainingSection.js`, under the iframe) shows the five tracks with the next step's price, the unspent and earned points, the strategy select (Even, one track first, or By hand), a buy button per track (enabled for By hand), Respec, and the surplus button. The surplus goes to the region XP of the last Noiz2sa region loaded, through gameState's `addRegionXP` public function, at `surplusXpPerPoint` XP per point.

### Settings

`moduleSettings.noiz2saSubstrate.*`, declared with the schema in `noiz2saTraining.js`:

| Key | Default | Meaning |
|---|---|---|
| `pointsPerSecond` | 1 | Points per game second in a Noiz2sa region |
| `pointsPerScore` | 0.0001 | Points per score point from the region's start |
| `stepBase` | 2 | The price of a track's first step |
| `stepGrowth` | 1.04 | Each step costs this many times the one before |
| `botRetryCap` | 0 | The bot gives up after this many failed attempts; 0 is no cap |
| `botSpeed` | 1 | 1, 2 or 4 game frames per 16 ms while the bot plays |
| `surplusXpPerPoint` | 1 | Region XP per surplus point |

The first four are `tracks.js` `DEFAULT_TRAINING`, placeholders until the segment sweep prices them.

## Loop mode

Noiz2sa is a summary substrate (`loopSupport.summaryRecording`) with runner's declarations, the Bot included (`executeVia: 'solver'`; no Bot × Instant, as for every summary substrate). Record keeps the visit's net result: the drain seconds, the clear check, the departure and the visit's `playStats`. Playback applies it instantly, and live play is priced by time through `loopState._timeDrainTick`. A hit costs nothing extra: the time already spent stays spent. It declares `loopSupport.playClock`, so only time the game plays is charged and recorded: a region waiting for its first key, paused, or cleared and waiting for the player to leave costs nothing. The page's reports carry `gameSeconds`, so the drain charges per game second: the bot at 2× or 4× costs the same mana per region as at 1×, and a visit costs `floor(its game seconds)` times the region's rate (see [the play clock](./loop-recording.md#the-play-clock)). See [Loop Recording and Block Modes](./loop-recording.md#summary-substrates).

## The test preset and the test

`noiz2sa_substrate_test` is the zone table as a world: 1:1, 1:2–1:3 and 1:boss–2:1, all on seed 1, Victory on the last clear and `Noiz2sa Star` (a filler) on the others. It is written by `scripts/test/generate-noiz2sa-substrate-test-preset.mjs` (Pass A of the pipeline, `loop_costs` stamped), so loop mode auto-enables.

The in-app row `noiz2sa-region-loop-visit` (test-substrates, batch `fast`) parks a Record block on the 1:1 region and drives the page by injected input. Idle fire is hit at frame 240 and the region restarts with nothing checked. Waiting for the first key, and P pressed partway through the clearing tape, each report the clock stopped and drain nothing for 2.5 s (no mana, no recorded second, no frame); P again resumes the tape. The game repo's Ace bot's clearing tape (1002 frames) checks the clear. Leaving saves a summary priced by the drain, and instant Playback spends the repriced summary. The row `noiz2sa-refused-clear-resent` (same batch) parks a Record block on 1:1 and clears it with the queue paused, so the gate refuses the check; unpaused, on the same visit, it plays again and clears: the location is checked. A third clear dispatches nothing. The visit row also checks the summary's `playStats` (1242 frames of game time and the visit's score) and that instant Playback earns exactly the summary's points.

The row `noiz2sa-bot-block-trains` (same batch) runs Bot blocks on 1:1, each on a fresh load. With a fresh trainer (tracks 0, Even) the bot clears deathless in 1002 frames with score 17330, the same as the headless `runSegment` at tracks 0. The clear is checked, the visit costs 16 mana (floor(16.032) game seconds at 1 per second), the bot earns the visit's points, and the tracks rise to 2/2/2/1/1. The visit runs once at 1× and once at 2×: the same frames and the same mana in half the wall clock. At tracks 20 and 4×, the bot is hit three times and clears on attempt 4 (2942 frames, as headless). With a retry cap of 2 it gives up after 1198 frames and the region waits.

The unit tests are `noiz2saRegion.test.js` (the rules on a fake engine), `noiz2saSubstrateLibrary.test.js` (the entry, the Bot declaration, the payload round trip, the zone table, the committed preset) and `noiz2saTraining.test.js` (the settings, the stored trainer, the visit meter, Playback's earnings, the trainer service, the walk options, the proxy).

## Related documentation

- [Runner Substrate](./runner.md) — the summary substrate whose declarations this one copies
- [Loop Recording and Block Modes](./loop-recording.md) — summary capture and the time drain
- [Flash Substrate](./flash.md) — the iframe panel and bridge this substrate reuses
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract
