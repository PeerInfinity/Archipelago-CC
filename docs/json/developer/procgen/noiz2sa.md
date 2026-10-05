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
- N4b (2026-10-05): "In loop mode, clearing the level should be counted as part of the "move" action. In this substrate, there is no explore or check location action." "Also, a first clear should have the effects that fully exploring the region would have in other substrates." The same day the user changed the second half: "The Noiz2sa regions should count as fully explored when they are first entered, not when they are first cleared. The move command can be queued through the Loops panel. But if there isn't already a move queued, then the Noiz2sa panel should display a list of available exits, and when the player chooses one of the exits, that's when the game starts. When the level is cleared, the move to the exit that the player chose is performed." A new bot seed per visit, recorded with the visit. A key in Manual and Record visits that lets the bot play at the current tracks, and hands the controls back.

## Files

| File | Role |
|------|------|
| `noiz2saRegion.js` | The pure region model: positions (`parsePosition`, `showPosition`), `checkSpan`, `regionSpanOf`, and `createRegionRun`, the region rules on an injected engine. A copy of the game repo's `src/game/segment-run.js` (see below), plus the run-length input-tape code the test uses. |
| `noiz2saSubstrateLibrary.js` | The registry entry: the payload declaration, `deserializeWorld`, loop support, and the zone table (`NOIZ2SA_ZONES`, `extractZoneRules`). Loads headless. |
| `index.js` | The host module: the panel (flashSubstrate's iframe panel factory, pointed at `game/index.html`, plus the training section), the panel activation on `noiz2sa:loadRegion`, the settings, the trainer's feeds, the bot proxy's injection, the visit's bot seed, the page's host state and the first-clear explores. |
| `noiz2saFirstEntry.js` | The first-entry watcher, how many explores explore a region fully, and the queued move out of a region (`queuedMoveFrom`). Pure. |
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

- The page implements `configure`. It calls `sendLocation('clear')` on the region's clear and `sendExit(exitName, null)` when the region is left (in loop mode, by the clear itself: [Loop mode](#loop-mode)).
- The exits are closed until the region is cleared on this visit. Outside loop mode they also open at once when its location was already checked; in loop mode they do not (the move is the clear, [Loop mode](#loop-mode)).
- The host module tells the page its state through the bridge's `hostState` command (`__swfBridge.setHostState({loopMode, bot, move})`): whether loop mode is on, the bot's options for this visit (the visit's bot seed, the knobs at the current tracks, the speed and the cap), and the move the loops queue holds out of the region (`{region, exit}`, or null; `noiz2saFirstEntry.js` `queuedMoveFrom`: from the cursor, past the move into the region, the next move, if it leaves the region). It sends it on every region load and on every change of loop mode, the tracks, the settings or the queue (`gameState:pathUpdated`, `loopState:manualEntered` and the other queue events), in either order with `configure`.
- The page asks its host through the bridge's `requestHost` (`substrate:hostRequest {region, request}`): `{kind: 'chooseExit', exitName}` when the player chose an exit with no move queued ([Loop mode](#loop-mode)). A refused request comes back in the host state as `refused: {kind, exitName, why}`.
- R plays the region again from its start on the same visit (the exits stay open if it was cleared). The next clear is sent again; the bridge dispatches it only if the host did not accept the earlier one (the action gate refuses a clear made while the queue is not parked on the region). See [Flash Substrate](./flash.md).
- The game steps only while it is being played. A configured region waits for a game key or a click, and the page pauses when it loses focus. Keys: arrows/WASD move, Z fires, X is slow, P pauses, R plays again, B lets the bot play (and takes the controls back), 1–9 leave by that exit.
- The page reports its play clock (`setPlayClock(running, {gameSeconds, score, botFrames, botSeed})`) on every state change and about every game second (63 frames): running only while `playing`. Waiting for the first key, paused, and cleared-and-waiting-to-leave are all stopped (the game does not step in any of them), and an injected tape that ran out returns the page to waiting. The stats are the visit's so far: the game seconds of every frame stepped, the score of every attempt from the region's start (a hit keeps the failed attempt's score), the frames the bot played, and the visit's bot seed.
- Opened directly in a tab, the page plays the region in its URL: `game/index.html?start=1:2&end=1:3&seed=1`.
- Test surface (not the contract): `window.__noiz2saDebug()` reads the state (including `visitSeconds`, `visitScore`, `configures`, `loopMode`, `visitBotSeed`, `botFrames`, the bot's walk and `lastBot`, the last walk's settings and outcome), and `window.__noiz2saTest` plays an injected input tape (`play(tape, {speed})`), leaves by an exit (`leave(name)`), plays the region again (`again()`) and presses B (`assist()`).

## The bot

A Bot block hands each queued action to the walkTo solver. The registry entry declares `loopSupport.executeVia: 'solver'`, and `getPlaybackController` returns `Noiz2saBotProxy`, injected by `index.js` (null headless, so a Bot block there parks for live play). Its `walkTo(target)` publishes `noiz2sa:playbackControl` with a second argument, the bot's settings from `noiz2saTraining.js` `botWalkOptions`: the knobs at the trainer's current tracks (`tracks.js` `trainerKnobs`), the tracks, the visit's bot seed, the speed and the retry cap. The flash bridge passes it on as `__swfBridge.botWalkTo(goal, options)`. A location target becomes `{kind: 'pickup', id: 'clear'}`. An exit becomes `{kind: 'portal', id: exitName}`, because `deserializeWorld` sets `params.walkToExits: 'byName'`.

The page plays the region from where it is:

- The bot is `human.js` `botOptions({perception: 'observed', knobs})`, run by `game/bot-worker.js`. The worker plays its own copy of the attempt (`noiz2saRegion.js` `createRegionRun`, replaying the attempt's frames so far) and posts its inputs up to 180 frames ahead. The page plays them and waits, never guesses, when one is late. The budget is the counted `BROWSER_BUDGET`, so the page plays exactly what the headless `runSegment` plays. A boss into the next stage gets a new bot, as `runSegment` makes one per game.
- Every visit has its own bot seed: `index.js` draws one (`noiz2saTraining.js` `drawBotSeed`, 1 to 2³²−1) on every region load, so a region at given tracks plays differently from visit to visit. The page reports it in its play-clock stats, so a Record summary carries it (`playStats.botSeed`); Playback stays instant and does not use it. `pinBotSeed(n)` in `index.js` pins the seed of every visit from the next region load on (`null` unpins), which tests use and which replays a recorded visit exactly.
- A hit restarts the region. The bot plays the next attempt with `segment-run.js` `attemptBotSeed(visit seed, attempt − 1)`, so retries differ. It goes on until the clear or, with a retry cap N > 0, until N attempts failed. Then it gives up: the page waits for a key (its clock stopped) and the Bot block stays parked until the player plays the region or the queue resets.
- A portal goal leaves by the exit after the clear, or at once when the exits are already open (in loop mode only after a clear on this visit). A pickup goal ends at the clear; loops sends none since N4b, because the check is no queue action.
- It plays at the speed setting: 1, 2 or 4 game frames per 16 ms. The game does not pause when the page loses focus while the bot plays.
- A walk for the same goal sent again (the proxy re-sends it when the tracks or the bot settings change while the bot drives) applies its knobs from the next attempt on and its speed at once.
- `botStop` (a loop reset, a pause) hands the region back to the player. R plays the region again and stops the bot.

### The B key

In a Manual or Record visit, B hands the controls to the bot at the current tracks: the bot from the host state (the visit's seed, the knobs at the current tracks, the speed and the cap) plays toward the clear from where the region is, restarting on a hit like a walk. In loop mode the clear then performs the queued move; outside it the bot stays at the clear and the player leaves. B again hands the controls back: the game pauses until the player's next game key. Nothing else changes: the play clock runs while the game steps, whoever drives it, the drain charges per game second, and the visit trains the bot like any visit. The Record summary holds the bot's play (`playStats.botFrames`). While a Bot block's walk drives the region, B does nothing (the walk is the queue's).

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

**The move is the clear (N4b).** Noiz2sa has no explore or check action in the queue: `queueActions` is `['regionMove']`, and `loopSupport.moveIncludesCheck` tells loops the region's check rides on the move (it stays out of a Record block's interior and out of click-to-queue; see [loop-recording.md](./loop-recording.md#a-check-that-rides-on-the-move)). In loop mode the page opens a region's exits only after a clear on THIS visit, cleared before or not, and the clear PERFORMS the queued move: the page leaves by its exit at once. So every queued move out of a Noiz2sa region is played to a clear: by the player in a Manual or Record block (who may press B), by the bot in a Bot block (its portal goal), and Playback applies a summary of such a visit. A Bot block on a region cleared before therefore plays it again, costs its game seconds and trains the bot. Outside loop mode an already-checked region opens its exits at once and the player leaves by hand, as before (nothing is spent there).

**No move queued: the player chooses the exit.** In loop mode, when the loops queue holds no move out of the region the player is in (an empty queue, or one that ends here), the page waits in `choosing`: its exit buttons (and 1–9) are the choice, game keys and B do nothing, and its clock is stopped. Choosing an exit sends `chooseExit` to the host module, which queues the move as the Loops panel does (gameState `updatePath`) and runs the queue when it can run from here: a queue that ran to its end resumes from the new move, a queue never started starts (the move is its first), a paused queue stays paused. The new block parks (its default mode, Record unless set otherwise), the host state reports the move, and the game starts at once; the clear performs the chosen move. A move queued in the Loops panel instead ends `choosing` the same way, waiting for a game key as usual.

**A first entry explores the region fully.** Elsewhere a full explore is explore actions ending in `loop:exploreCompleted {regionName}`, each answered by the discovery module with the region and one random undiscovered location or exit of it (an exit also reveals its connected region under the `onExitDiscovered` trigger); a region is fully explored when every location and exit of it is discovered (`loopState._isRegionFullyExplored`, which drops the queued explores of such a region). So on a Noiz2sa region's first load since the last rules load (`noiz2sa:loadRegion`: the player arrived), `index.js` publishes as many `loop:exploreCompleted` as the region has locations and exits (`noiz2saFirstEntry.js`). They carry `fromLoop: true` and `source: 'noiz2sa:firstEntry'`: an arrival is no player action, and loops must not gate or capture an explore this substrate does not have. The discovery panel, path finding (which follows discovered exits) and queue building then see a fully explored region. Nothing is checked: the location is discovered, and checked by the clear.

Noiz2sa is a summary substrate (`loopSupport.summaryRecording`) with runner's declarations, the Bot included (`executeVia: 'solver'`; no Bot × Instant, as for every summary substrate). Record keeps the visit's net result: the drain seconds, the clear check, the departure and the visit's `playStats`. Playback applies it instantly, and live play is priced by time through `loopState._timeDrainTick`. A hit costs nothing extra: the time already spent stays spent. It declares `loopSupport.playClock`, so only time the game plays is charged and recorded: a region waiting for its first key, paused, or cleared and waiting for the player to leave costs nothing. The page's reports carry `gameSeconds`, so the drain charges per game second: the bot at 2× or 4× costs the same mana per region as at 1×, and a visit costs `floor(its game seconds)` times the region's rate (see [the play clock](./loop-recording.md#the-play-clock)). See [Loop Recording and Block Modes](./loop-recording.md#summary-substrates).

## The test preset and the test

`noiz2sa_substrate_test` is the zone table as a world: 1:1, 1:2–1:3 and 1:boss–2:1, all on seed 1, Victory on the last clear and `Noiz2sa Star` (a filler) on the others. It is written by `scripts/test/generate-noiz2sa-substrate-test-preset.mjs` (Pass A of the pipeline, `loop_costs` stamped), so loop mode auto-enables.

The in-app row `noiz2sa-region-loop-visit` (test-substrates, batch `fast`) parks a Record block on the 1:1 region and drives the page by injected input. Idle fire is hit at frame 240 and the region restarts with nothing checked. Waiting for the first key, and P pressed partway through the clearing tape, each report the clock stopped and drain nothing for 2.5 s (no mana, no recorded second, no frame); P again resumes the tape. The game repo's Ace bot's clearing tape (1002 frames) checks the clear. Leaving saves a summary priced by the drain, and instant Playback spends the repriced summary. The row `noiz2sa-refused-clear-resent` (same batch) parks a Record block on 1:1 and clears it with the queue paused, so the gate refuses the check; unpaused, on the same visit, it plays again and clears: the location is checked. A third clear dispatches nothing. The visit row also checks the summary's `playStats` (1242 frames of game time and the visit's score) and that instant Playback earns exactly the summary's points.

The row `noiz2sa-bot-block-trains` (same batch) runs Bot blocks on 1:1, each on a fresh load. With a fresh trainer (tracks 0, Even) the bot clears deathless in 1002 frames with score 17330, the same as the headless `runSegment` at tracks 0. The clear is checked, the visit costs 16 mana (floor(16.032) game seconds at 1 per second), the bot earns the visit's points, and the tracks rise to 2/2/2/1/1. The visit runs once at 1× and once at 2×: the same frames and the same mana in half the wall clock. At tracks 20 and 4×, the bot is hit three times and clears on attempt 4 (2942 frames, as headless). With a retry cap of 2 it gives up after 1198 frames and the region waits.

The N4b rows (same batch) are `noiz2sa-bot-replays-cleared-region` (a Bot block clears 1:1 at bot seed 1, tracks 0 By hand, 4×; back on the region, cleared before, the page keeps its exits closed and the same Bot block plays it again in 1002 frames, costs floor(16.032) game seconds of drain and earns the visit's points), `noiz2sa-first-entry-explores` (the second region is fogged and the player moved into it: on that first entry it reads fully explored, every exit discovered through `discovery:exitDiscovered`, nothing checked), `noiz2sa-choose-exit` (an empty queue in loop mode: the page waits in `choosing` and a game key does nothing; choosing the exit queues the move, the queue parks a Record block and the game starts; B lets the bot clear it and the clear performs the chosen move, the summary departing by that exit), `noiz2sa-bot-seed-per-visit` (three Record visits played to a clear with B at 4×: the first two drew different seeds, each in its summary's `playStats.botSeed`; the third, pinned to the first's seed, plays it exactly again) and `noiz2sa-assist-key` (B gives the bot the controls, B takes them back and nothing steps or drains, a game key resumes, B again and the bot plays to the clear, which performs the queued move; the summary counts the bot's frames, the block interior holds no check, the visit cost its game seconds and trained the bot). The older rows now see the clear perform the queued move instead of leaving by hand; `noiz2sa-refused-clear-resent` lost its third clear with it (the accepted clear leaves the region), and the ledger's never-twice rule stays pinned by `locationReportLedger.test.js`. The N4 Bot row pins bot seed 1, where its numbers were measured.

The unit tests are `noiz2saRegion.test.js` (the rules on a fake engine), `noiz2saSubstrateLibrary.test.js` (the entry, the Bot declaration, the payload round trip, the zone table, the committed preset) and `noiz2saTraining.test.js` (the settings, the stored trainer, the visit meter, Playback's earnings, the trainer service, the walk options, the bot seed per visit, the proxy) and `noiz2saFirstEntry.test.js` (the explore count, the first-entry watcher, the queued move out of a region).

## Related documentation

- [Runner Substrate](./runner.md) — the summary substrate whose declarations this one copies
- [Loop Recording and Block Modes](./loop-recording.md) — summary capture and the time drain
- [Flash Substrate](./flash.md) — the iframe panel and bridge this substrate reuses
- [Substrate Registry Reference](./substrate-registry.md) — the entry contract
