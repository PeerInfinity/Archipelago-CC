/**
 * seedlingDemo/crossSwapStatics — everything that survives `new Game` and
 * what it can reach, classified.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5 step 0(b).
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §18.
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * Slice 5 paid for this twice. `Game.time` was pinned at slice 3 because
 * it advances on frames the tape does not count. The swim channel cost a
 * whole recording at slice 5 step 1 for the same reason and one more:
 * `arriveIn` builds a new `Player` and `Music`'s channels are STATICS, so
 * the world swap dropped state the game keeps
 * (`feedback_a_static_survives_the_reconstruction`).
 *
 * Two found members and one known-inert is not an audit. This is the
 * audit: every candidate the brief enumerated, with the mechanism that
 * decides it and **every read site cited**. An entry with no reader in
 * physics' reach is inert — and it says WHY, because "I could not find a
 * reader" and "there is no reader" print the same in a summary.
 *
 * ── THE MECHANISM: THREE WAYS A STATIC FAILS TO SURVIVE ───────────────
 *
 * Most of the candidates are not cross-swap state at all, and the reason
 * is mechanical rather than incidental:
 *
 * 1. **`Game`'s CONSTRUCTOR CALLS `end()`** (Game.as:632). `end()`
 *    (Game.as:644-671) clears `underwater`, `talking`, `talkingText`
 *    (whose setter also zeroes `currentCharacter`), `talkingPic`,
 *    `fallthroughLevel`, `fallthroughSign`, `fallthroughOffset`, and runs
 *    `resetCamera()` + `resetCameraSpeed()`. So all of those are back at
 *    their defaults BEFORE the new world's first frame.
 * 2. **`begin()` CALLS `loadlevel()`**, which re-derives `snowing`,
 *    `raining`, `blackAndWhite`, `blurRegion`, `blurRegion2`, `dayNight`
 *    and `lightAlpha` from the level XML (Game.as:1910-1920). A per-level
 *    re-derivation is not a carry.
 * 3. **Some candidates are INSTANCE vars, not statics** — `todaysTime`
 *    (Game.as:463), `cTextIndex`, `textTimer`, `proceedText`
 *    (Game.as:604-612). They die with the world by construction. Reading
 *    `public static` off the wrong line is the easiest way to invent a
 *    carrier that does not exist, so the declaration line is cited for
 *    every entry.
 *
 * What is left after those three is the real list, and it is short.
 *
 * ── ⛔ AND THERE ARE TWO KINDS OF DEAD FRAME ──────────────────────────
 *
 * `Bot.as:1305` counts a frame dead when
 * `game.blackCover > 0 || Game.freezeObjects`. Those two are NOT the same
 * frame, and the difference decides half of this table:
 *
 * ```
 *   Game.as:813-816    if (blackCover <= 0) { super.update(); }
 * ```
 *
 * - **A FADE frame (`blackCover > 0`)**: `super.update()` is SKIPPED, so
 *   no entity's `update()` runs at all. Everything BELOW that gate still
 *   runs — `view()`, `time += timeRate`, the cutscene block, the rain
 *   spawner, the inventory — and `render()` runs in full.
 * - **A FROZEN frame (`Game.freezeObjects`, e.g. a 150-frame pickup
 *   ceremony)**: `super.update()` DOES run. Every entity is updated and
 *   the per-class freeze gate decides — `Bob.update` returns,
 *   `Jellyfish.update` does not test it at all (slice 2's census column).
 *
 * ⇒ "the tape did not count it" says nothing about whether the world
 * moved. A transcription that treats the two alike will freeze a
 * jellyfish through a ceremony the game lets it swim through.
 */

export class CrossSwapStaticsError extends Error {
    constructor(message) { super(message); this.name = 'CrossSwapStaticsError'; }
}
const fail = (m) => { throw new CrossSwapStaticsError(m); };

/** The two dead-frame kinds, and the one line that separates them. */
export const DEAD_FRAME_KINDS = Object.freeze({
    fade: Object.freeze({
        test: 'game.blackCover > 0',
        superUpdateRuns: false,
        as3: 'Game.as:813-816 — `if (blackCover <= 0) super.update()`',
        note: '20 frames per room load (`blackCover` 1 at -0.05, the twentieth landing '
            + 'at -3.19e-16 in doubles) — `swimSoundClock.LOAD_DEAD_FRAMES`',
    }),
    frozen: Object.freeze({
        test: 'Game.freezeObjects',
        superUpdateRuns: true,
        as3: 'Bot.as:1305 counts it dead; nothing in `Game.update` gates on it',
        note: '150 frames per pickup ceremony (`Pickup.specialTimer`), and the enemy '
            + 'classes WITHOUT a freeze gate keep updating through all of them',
    }),
});

/**
 * The audit. One entry per candidate, `verdict` one of:
 *
 * - `pinned`    — the bot holds it still (an AS3 pin, shipped slice 3).
 * - `modelled`  — the JS model reproduces it.
 * - `inert`     — it cannot reach anything the model observes, WITH the
 *                 reason, and with `readSites` naming every read.
 * - `refused`   — the model throws rather than guess (the honest arm).
 *
 * `survives` is how it fares across `new Game`: `yes`, `reset-at-ctor`
 * (`end()`), `reset-at-load` (`loadlevel`), or `instance` (not a static).
 */
export const CROSS_SWAP_STATICS = Object.freeze({

    // ── THE TWO FOUND MEMBERS ─────────────────────────────────────────

    'Game.time': Object.freeze({
        decl: 'Game.as:490-497 `static set/get time` -> `Main.time`; the storage is '
            + '`Main.as`, which is why slice 0 recorded "`Game.time` IS `Main.time`"',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'pinned',
        readSites: Object.freeze([
            'Game.as:826-828 — `time += timeRate`, BELOW the blackCover gate, so a fade '
                + 'frame advances it',
            'Game.as:1828 `worldFrame(n, loops)` — every animation phase in the game',
            'Bot.as botStatus — reported, which is how the pin is checked against the game',
        ]),
        why: 'the arc\'s first found member. `worldFrame` is read by enemy animation '
            + 'phases the census calls timing-class ANIM, so a clock that drifted by one '
            + 'frame across a door would move a beam tower\'s firing frame.',
    }),
    'Music.<swim channel>': Object.freeze({
        decl: 'Music.as:83-86 + `soundsO` — `Sfx` channels are STATICS on `Music`',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Player.as:548 — `moveSpeed = moveSpeeds[state] + 0.25 * int('
                + 'Music.soundPosition("Swim") < 0.1)`, the swim boost',
            'Player.as:549-551 — `if (v.length > 0 && !Music.soundIsPlaying("Swim")) '
                + 'playSound("Swim")`, the RECURRENCE',
            'Bot.as:1023 — `sound_pin: Music.pinReadout("Swim")`',
        ]),
        why: 'slice 5 step 1\'s payment. `Bot.update` steps `Music.pinStep()` ABOVE both '
            + 'the armed check and the dead-frame gate, so the channel advances 20 frames '
            + 'per room load and 150 per ceremony. `swimSoundClock.js` + `levelRun`\'s '
            + 'carry-from-`next`. The game confirmed both constants by arithmetic: '
            + '231 = 21 + 3x20 + 150.',
    }),

    // ── THE KNOWN-INERT ONE, AND THE NUMBER THAT MAKES IT INERT ───────

    'Game.shake': Object.freeze({
        decl: 'Game.as:538 `public static var shake:Number = 0`',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'refused',
        readSites: Object.freeze([
            'Game.as:1868-1872 `view()` — `FP.camera.x += shake * Math.random() - shake/2` '
                + 'on BOTH axes, then `shake = Math.max(shake - 1, 0)`. `view()` is BELOW '
                + 'the blackCover gate, so the decay runs on dead frames too',
            'and the camera is read back by `Enemy.update`\'s off-screen return, so this '
                + 'is NOT a render-only path — a jittered camera can flip an enemy\'s '
                + 'active/inactive edge',
        ]),
        why: '⚠ NOT inert by nature — inert by a NUMBER. `camera.stepCamera` already '
            + 'THROWS on a non-zero shake rather than guessing (the honest arm). Every '
            + 'setter on the R5 route is bounded: `Player.as:1389` `Game.shake += 5` sits '
            + 'below `if (Bot.noDamage) return`; `TentacleBeast` (5) and `BossTotem` '
            + '(60 / laserHitTimeMax*2) are off route; and a landing `FallRock` / '
            + '`FallRockLarge` sets **30** while holding `Game.freezeObjects` for '
            + '`cameraTimerMax` = **90** more frames (FallRock.as:27,105-108; '
            + 'FallRockLarge.as:32,97-100). The freeze OUTLASTS the shake by 60 frames, '
            + 'so it has always decayed to 0 before a live frame returns. '
            + '⚠⚠ That bound holds only while the room has no freeze-gate-LESS enemy '
            + 'class in it (a `Jellyfish` keeps updating through a freeze and reads the '
            + 'camera). Slice 5 step 4 fires THREE `t = 0` fallrocks in L43 — re-check '
            + 'the L43 census against this line before claiming it there.',
    }),

    // ── CLEARED BY `end()` AT THE CONSTRUCTOR ─────────────────────────

    'Game.underwater': Object.freeze({
        decl: 'Game.as:509 `public static var underwater:Boolean`',
        survives: 'reset-at-ctor',
        advancesOnDeadFrames: false,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1490 `bufferTransforms()` — `FP.buffer.colorTransform(...)`. '
                + 'RENDER ONLY: it tints the frame buffer and touches no entity',
        ]),
        why: 'inert TWICE OVER, and either alone would do: `end()` (Game.as:647) sets it '
            + 'false and the constructor calls `end()`, so it cannot cross a swap; and '
            + 'its single read is a colour transform on `FP.buffer`.',
    }),
    'Game.cameraSpeedDivisor': Object.freeze({
        decl: 'Game.as:570 `public static var cameraSpeedDivisor:int = cameraSpeedDivisorDef`',
        survives: 'reset-at-ctor',
        advancesOnDeadFrames: false,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Game.as:1848-1849 `view()` — the camera lerp divisor, on both axes',
        ]),
        why: '`end()` calls `resetCameraSpeed()` (Game.as:657), so the swap restores the '
            + 'default. Its only non-default assignment is `Game.as:919`, inside '
            + '`cutscene[0]` — the intro pan, which no bot tape enters (see '
            + '`Game.cutscene`). `camera.js` models the divisor as a constant for '
            + 'precisely that reason, and `stepCamera` takes it as a parameter so a '
            + 'future cutscene arm is a value, not a rewrite.',
    }),
    'Game._cameraTarget': Object.freeze({
        decl: 'Game.as:568 `public static var _cameraTarget:Point = new Point(-1, -1)`',
        survives: 'reset-at-ctor',
        advancesOnDeadFrames: false,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Game.as:1885 `get cameraTarget()`',
            'Game.as:1845-1847 `view()` — `if (cameraTarget.x != -1 || cameraTarget.y != -1) '
                + 'targetPosition = cameraTarget.clone()`, which REPLACES the player-follow',
        ]),
        why: '`end()` calls `resetCamera()` (Game.as:656). ⚠ WITHIN a room it is live and '
            + 'load-bearing: `FallRock`/`FallRockLarge` set it while a rock falls '
            + '(FallRock.as:66) and `Game.resetCamera()` clears it when the camera timer '
            + 'expires. `camera.stepCamera` takes `cameraTarget` as an option for that '
            + 'window.',
    }),
    'Game.fallthroughSign': Object.freeze({
        decl: 'Game.as:578 `public static var fallthroughSign:int = -1`',
        survives: 'reset-at-ctor',
        advancesOnDeadFrames: false,
        verdict: 'inert',
        readSites: Object.freeze([
            'Player.as:763 — `Game.sign = Game.fallthroughSign` on the fall-through '
                + '(pit) path, which is a WRITE of `Game.sign` and the only read of this',
        ]),
        why: '`end()` sets it -1 (Game.as:652) and `loadlevel` re-derives it from the '
            + 'level XML (`Game.as:2106`, `int(o.@sign) - 1`, so an absent attribute is '
            + '-1). It is a per-level constant wearing a static\'s clothes; its only '
            + 'effect is through `Game.sign`, below.',
    }),
    'Game.talking / talkingText / talkingPic': Object.freeze({
        decl: 'Game.as:513-515 — `talking`, `_talkingText`, `talkingPic`',
        survives: 'reset-at-ctor',
        advancesOnDeadFrames: true,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Game.as:1612 `talk()` — `if (talking && talkingText)` gates the whole '
                + 'text machine. ⚠ `talk()` is called from `render()` (Game.as:1006), '
                + 'NOT from `update()`, so it runs on both kinds of dead frame',
            'Game.as:1656 — `fullString = talkingText.substr(0, currentCharacter)`',
            'Game.as:1684 — the `<X>` prompt gate',
            'NPC.as / BobBossNPC.as — the dismissal path (`dialogue.js`)',
        ]),
        why: '`end()` clears all three (Game.as:648-650), and `set talkingText` zeroes '
            + '`currentCharacter` on any change — so a dialogue cannot leak across a '
            + 'door. WITHIN a room they are the dialogue model (`dialogue.js`), and the '
            + 'frames they page on are FROZEN frames, which is why `Bot.autoAdvance` is '
            + 'called from inside the dead-frame branch and nowhere else.',
    }),

    // ── CLEARED BY `loadlevel()` IN `begin()` ─────────────────────────

    'Game.raining': Object.freeze({
        decl: 'Game.as:544 `public static var raining:Boolean = false`',
        survives: 'reset-at-load',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:967-976 `update()` — BELOW the blackCover gate, so it runs on fade '
                + 'frames: `if (!Math.floor(Math.random() * (100 - rainingHeaviness))) '
                + 'FP.world.add(new Droplet(...))`, with two more `Math.random()` draws '
                + 'for the position',
        ]),
        why: 'three reasons, and the third is a MEASUREMENT rather than an argument. '
            + '(1) `loadlevel` sets it false and re-derives it from the level XML '
            + '(Game.as:1917, 2108-2115), so it is per-level, not a carry. '
            + '(2) `Droplet extends Entity` and assigns no `type`, so it is in no '
            + 'collide list the model consults — not "Solid", not "Enemy", not "Player". '
            + '(3) ⛓ ITS `Math.random()` DRAWS CANNOT MOVE THE ONE RANDOM CONSUMER IN '
            + 'PHYSICS\' REACH. `playSound(strInd, -1)` draws '
            + '`Math.floor(Math.random() * sounds[strInd].length)`; the only set any '
            + 'physics term reads is "Swim", and `soundSwim` (Music.as:91) has exactly '
            + 'ONE sound — so the draw is forced to 0 and the do-while cannot re-draw. '
            + '⛓ AND THERE IS A WITNESS: 13 levels carry `<droplet>`, among them '
            + 'Dungeon6/1 = **L60**, where `r5-l60-kill` and its control are byte-'
            + 'identical to the model for 359 observations with no rain in the model at '
            + 'all.',
    }),
    'Game.snowing / blizzardOffset': Object.freeze({
        decl: 'Game.as:479-480',
        survives: 'reset-at-load',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1519-1544 `bufferTransforms()` — the blizzard scroll, RENDER',
            'Tile.as:273, 288 — inside `render()`\'s tile-type switch (cases 23/24, the '
                + 'ice walls), a `Draw.setTarget(nightBmp)` lighting pass. RENDER, and '
                + 'note it is the TILE\'s render, not its terrain: the terrain switch '
                + '`Enemy.update` and `Player` read is the RAW tile type and never '
                + 'consults `snowing`',
        ]),
        why: '`loadlevel` sets `snowing = false` and re-derives it from `<snow>` '
            + '(Game.as:1915, 1930-1934). `blizzardOffset` is a scroll offset advanced '
            + 'only under `snowing` and read only by `sprBlizzard.render`. The Tile read '
            + 'is the one that could have looked like terrain and is not.',
    }),

    // ── INSTANCE VARS THE BRIEF LISTED AS STATICS ─────────────────────

    'Game.todaysTime': Object.freeze({
        decl: 'Game.as:463 `public var todaysTime:int` — ⚠ INSTANCE, not static',
        survives: 'instance',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1178-1188 `musicUpdate()` — the day/night song crossfade',
            'Game.as:1500-1510 `bufferTransforms()` — `currentLightAlpha`, RENDER',
        ]),
        why: 'it cannot carry: it is an instance var AND it is recomputed from scratch '
            + 'every frame (`todaysTime = time % (dayLength + nightLength)`, '
            + 'Game.as:828). A pure function of the pinned clock is not separate state.',
    }),
    'Game.cTextIndex / textTimer / proceedText': Object.freeze({
        decl: 'Game.as:604, 607, 612 — ⚠ all INSTANCE vars',
        survives: 'instance',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1633-1646 `talk()` — the page-advance timer, and it is per-WORLD',
            'Game.as:909-943 — the cutscene[0] text walk',
        ]),
        why: 'they die with the world. `cTextIndex` is additionally forced to 0 every '
            + 'frame by `update()`\'s no-cutscene else branch (Game.as:962-965), so even '
            + 'within a world it is not a carrier outside a cutscene.',
    }),

    // ── SURVIVES, AND THE READER IS WHAT DECIDES IT ───────────────────

    'Game.currentCharacter': Object.freeze({
        decl: 'Game.as:600 `public static var currentCharacter:int = 0`',
        survives: 'reset-at-ctor',
        advancesOnDeadFrames: true,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Game.as:1630-1656 `talk()` — incremented once per `framesPerCharacter` '
                + 'frames, and `talkingText.substr(0, currentCharacter)` is the visible '
                + 'string',
            'Game.as:1684 — `currentCharacter > talkingText.length` raises the `<X>`',
            'NPC.as:199-205 and BobBossNPC.as:38-44 — the SKIP arm, which clamps it to '
                + '`length - 1` when a press arrives mid-page',
        ]),
        why: 'reset across a swap, but INDIRECTLY and it is worth saying how: `end()` '
            + 'does not name it — `end()` sets `talkingText = ""`, and `set talkingText` '
            + 'zeroes `currentCharacter` whenever the string changes (Game.as:1709-1715). '
            + '⚠ Within a room it is live on FROZEN frames, which is exactly where a '
            + 'ceremony\'s dialogue pages, so `dialogue.js` and `Bot.autoAdvance` both '
            + 'depend on its rate.',
    }),
    'Game.framesPerCharacter': Object.freeze({
        decl: 'Game.as:602 `public static var framesPerCharacter:int = framesPerCharacterDefault`',
        survives: 'yes',
        advancesOnDeadFrames: false,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Game.as:1629 `talk()` — `framesThisCharacter = framesPerCharacter`, the '
                + 'per-character frame budget',
        ]),
        why: '⚠ THE ONE `end()` DOES NOT CLEAR. It genuinely survives the swap holding '
            + 'the last talker\'s speed — and it is harmless because every talk WRITES '
            + 'it before it reads it: `NPC.as:269` sets it to that NPC\'s '
            + '`talkingSpeed` when the talk starts and `NPC.as:259` restores the default '
            + 'when it ends. A ceremony\'s own NPC is built with `DEF_TEXT_SPEED` = 6 '
            + '(`Pickup.as:100`). So the carry exists and is overwritten before use — '
            + 'stated as a fact rather than assumed away, because "nothing reads it '
            + 'stale" is the claim, not "it does not carry".',
    }),
    'Game.daysPassed': Object.freeze({
        decl: 'Game.as:466 `public static var daysPassed:int = 0`',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([]),
        noReaderConfirmedBy: 'grep -rn "\\bdaysPassed\\b" --include=*.as . over all 210 '
            + 'sources returns exactly TWO lines: the declaration (Game.as:466) and the '
            + 'increment (Game.as:826). Nothing anywhere reads it — not the music, not '
            + 'the render, not an entity.',
        why: 'a write-only counter. It does advance on dead frames (the increment is '
            + 'below the blackCover gate) and it does survive the swap; both are '
            + 'irrelevant because the value is never consulted. This is the entry the '
            + 'audit exists to be able to say "inert" about honestly.',
    }),
    'Game.healthc / healths': Object.freeze({
        decl: 'Game.as:550-551',
        survives: 'yes',
        advancesOnDeadFrames: false,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1475-1477 `drawHealth()` — `for (i = 0; i < healths; i++) '
                + 'sprHealth.frame = int(i > healthc)`. The HUD, and nothing else',
        ]),
        why: 'they survive and they are never stale: `Game.health(hits, hitsMax)` '
            + '(Game.as:1464-1468) rewrites BOTH from the player\'s own fields, and its '
            + 'only caller is `Player.as:1403`, once per player update. So the carried '
            + 'value is overwritten before the only reader runs, and that reader draws '
            + 'hearts. ⚠ `hits`/`hitsMax` themselves are `Player` fields reported by the '
            + 'bot and asserted (R4\'s `hitsMax == 4` positive) — these two are the HUD '
            + 'MIRROR of them, not a second copy of the truth.',
    }),
    'Game.sign': Object.freeze({
        decl: 'Game.as:577 `public static var sign:int = -1`',
        survives: 'yes',
        advancesOnDeadFrames: false,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:780-784 `begin()` — `if (sign >= 0) { add(new Message(...)); '
                + 'sign = -1; }`. The ONLY read, and it is in the NEW world\'s begin',
        ]),
        why: '⛓ THE ONE DELIBERATE CROSS-SWAP MAILBOX IN THE LIST. `Teleporter.as:93` '
            + 'and `Player.as:763` (the fall-through path) write it in the OLD world and '
            + 'the NEW world\'s `begin()` consumes it and resets it to -1 — a carry by '
            + 'design, not by accident. It is inert anyway, and the reason is `Message` '
            + 'itself (Message.as): it `extends Entity`, assigns NO `type`, sets '
            + '`visible = false`, has NO `update()` at all, and decays its own alpha '
            + 'inside `render()` before removing itself. It cannot collide, cannot be '
            + 'counted by `totalEnemies()`, and cannot freeze anything. ⚠ It IS one more '
            + 'entity in the world list for ~250 frames, which is worth naming because '
            + 'the rock-despawn +/-1 (`HIT_TO_GONE_TICKS`) is an add-order effect — but '
            + 'a `Message` has no graphic in the update pass and no collision, so it '
            + 'cannot move that either.',
    }),
    'Game.levelMusics': Object.freeze({
        decl: 'Game.as:199 `public static var levelMusics:Array`',
        survives: 'yes',
        advancesOnDeadFrames: false,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1152-1170 `musicUpdate()` — picks the background song for the level '
                + 'and calls `Music.fadeToLoop(Music.songs[levelMusics[level]], 0.05)`',
        ]),
        why: '⚠ THE ENTRY A WALK ACTUALLY MUTATES, so the reason has to be the READER '
            + 'and not "nothing writes it". `BobBoss.as:45` writes '
            + '`levelMusics[level] = bossMusic` on activation and `:195` writes -1 on '
            + 'death — slice 4\'s own fight did this, permanently, to a shared array. '
            + 'It is inert because `musicUpdate` reaches only `Music.songs[]`, which are '
            + 'BACKGROUND `Sfx` objects played through `fadeToLoop`, while every '
            + 'physics-reaching read goes through `soundIsPlaying` / `soundPosition` / '
            + '`soundPercentage`, and all three iterate `sounds`/`soundsO` — a '
            + 'DIFFERENT collection that `songs` is not in. The background mixer and the '
            + 'pinned mixer do not meet.',
    }),
    'Game.cutscene': Object.freeze({
        decl: 'Game.as:606 `public static var cutscene:Array = new Array(false x4)`',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'modelled',
        readSites: Object.freeze([
            'Game.as:889-965 `update()` — BELOW the blackCover gate. `cutscene[0]` '
                + 'forces `freezeObjects`, `receiveInput = false`, `directionFace = 3` '
                + 'and DECAYS `timeRate`; `cutscene[1]` writes `p.v.y = -1` DIRECTLY on '
                + 'the player; `cutscene[2]` sets `active = false`',
            'Game.as:1684 `talk()` — suppresses the `<X>` prompt during cutscene[0]',
            'Bot.as:951 — `cutscene: Game.cutscene` in `botStatus`',
        ]),
        why: 'the only entry here that can write the PLAYER on a dead frame, so it is '
            + 'classified by OBSERVATION rather than by argument: the bot reports the '
            + 'whole array every tick and every R5 tape reports it all-false. The '
            + 'setters agree — `cutscene[0]` is set only at `Game.as:771`, inside '
            + '`if (level < 0)`, the fresh-start intro no bot tape boots into, and '
            + '`cutscene[1]` only on `Seed.as`\'s ending path. ⛓ A readout beats a '
            + 'proof here: `timeRate` decaying under `cutscene[0]` would silently '
            + 'change `Game.time`\'s RATE, which is the pinned clock.',
    }),
    'Music.currentSet / currentIndex': Object.freeze({
        decl: 'Music.as:83-84 `private static var currentSet:String / currentIndex:int`',
        survives: 'yes',
        advancesOnDeadFrames: false,
        verdict: 'inert',
        readSites: Object.freeze([
            'Music.as:673-676 `playSound` — the do-while that re-draws while '
                + '`cplayIndex == currentIndex && sounds[strInd].length > 1 && '
                + 'currentSet == strInd`, i.e. "do not repeat the last sound"',
        ]),
        why: 'they steer how many `Math.random()` draws a `playSound(set, -1)` makes, and '
            + 'they survive the swap holding the last sound played anywhere. Inert for '
            + 'TWO independent reasons. (1) The re-draw needs '
            + '`sounds[strInd].length > 1`, and the only set a physics term plays with '
            + '`intInd == -1` is "Swim" (Player.as:551), whose array is ONE element '
            + '(Music.as:91) — so the loop cannot spin and the index is forced to 0. '
            + '(2) Every reader that a physics term uses '
            + '(`soundPosition`/`soundIsPlaying`/`soundPercentage` with `intInd == -1`) '
            + 'takes a MAX over the whole set, so WHICH channel opened would not change '
            + 'the answer even for a multi-sound set of equal lengths.',
    }),
    'Music.songs[] — the background channels': Object.freeze({
        decl: 'Music.as:165-218 — `sndOTheme`, `sndOThemeNight`, `sndOMenu` and the rest '
            + 'of `songs`, each a static `Sfx`',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([
            'Game.as:1152-1200 `musicUpdate()` — `.playing` on the song objects and '
                + '`Music.fadeToLoop`',
            'Music.as — the fade/volume machinery, which reads `songs` only',
        ]),
        why: 'they are real `Sfx` channels on a real mixer and they DO advance on every '
            + 'frame the tape does not count — the same fact that made the swim channel '
            + 'a finding. They are inert because of the collection they live in: '
            + '`songs` is not `sounds`/`soundsO`, and the three physics-reaching '
            + 'accessors iterate the latter exclusively. ⚠ So the general claim is NOT '
            + '"background audio cannot matter" — it is "no term in physics\' reach can '
            + 'name a background channel". A future read of `Music.songs[...]` from an '
            + 'entity would reopen this entry.',
    }),
    'Music.<the "Other" channel 4>': Object.freeze({
        decl: 'Music.as:125 `soundOther` — five sounds; index 4 is `sndOther5`',
        survives: 'yes',
        advancesOnDeadFrames: true,
        verdict: 'inert',
        readSites: Object.freeze([
            'Crusher.as:77 — `else if (Music.soundPercentage("Other", 4) >= 0.1 || '
                + '!Music.soundIsPlaying("Other", 4)) Music.playSoundDistPlayer(x, y, '
                + '"Other", 4, 120, 0.5)`',
        ]),
        why: '⛓ FOUND BY THIS AUDIT, and it is the SECOND place a physics class reads the '
            + 'mixer — the first being the swim boost. It is inert because of where it '
            + 'sits: the read is in the `else if` arm of `Crusher.update`, its whole '
            + 'body is the `playSoundDistPlayer` call, and NOTHING downstream of it '
            + 'touches `v`, `x`, `y` or `hit()`. The crusher\'s motion is decided '
            + 'entirely by the `v.x == 0 && v.y == 0` arm above it. ⚠ Named anyway '
            + 'because slice 5 step 3 routes past L41/L42 crushers, and "a hazard reads '
            + 'the mixer" is the kind of sentence that should be found before a '
            + 'divergence, not after one. It also means the sound pin covers it for '
            + 'free: with `Bot.pinSoundClock` on, that read is the pinned clock.',
    }),
});

/**
 * The construction guard. An entry that says `inert` must either cite a
 * read site or say, in `noReaderConfirmedBy`, HOW it knows there is none.
 * "I could not find a reader" and "there is no reader" print the same in a
 * summary, and only one of them is a measurement.
 */
export function auditFindings(table = CROSS_SWAP_STATICS) {
    const problems = [];
    for (const [name, e] of Object.entries(table)) {
        if (!e.decl || !/\.as:\d+/.test(e.decl)) {
            problems.push(`${name}: no declaration line cited`);
        }
        if (!['pinned', 'modelled', 'inert', 'refused'].includes(e.verdict)) {
            problems.push(`${name}: verdict "${e.verdict}" is not one of the four`);
        }
        if (!['yes', 'reset-at-ctor', 'reset-at-load', 'instance'].includes(e.survives)) {
            problems.push(`${name}: survives "${e.survives}" is not one of the four`);
        }
        if (!e.why || e.why.length < 40) problems.push(`${name}: no reason given`);
        if (!Array.isArray(e.readSites)) problems.push(`${name}: readSites is not an array`);
        else if (e.readSites.length === 0 && !e.noReaderConfirmedBy) {
            problems.push(`${name}: claims no read site without saying how it knows. `
                + 'An entry with no reader in physics\' reach is inert — SAY WHY.');
        }
    }
    return problems;
}

/** One entry, or a throw naming what the table does hold. */
export function classify(name, table = CROSS_SWAP_STATICS) {
    if (!Object.prototype.hasOwnProperty.call(table, name)) {
        fail(`crossSwapStatics: "${name}" is not in the audit. Audited: `
            + `${Object.keys(table).join(', ')}. A candidate that is not here has not `
            + 'been classified — add it with its declaration line, every read site, and '
            + 'the reason, rather than assuming it is inert.');
    }
    return table[name];
}

/** The three verdicts that are not `inert`, for the docs and the close-out. */
export function liveEntries(table = CROSS_SWAP_STATICS) {
    return Object.entries(table)
        .filter(([, e]) => e.verdict !== 'inert')
        .map(([name, e]) => ({ name, verdict: e.verdict }));
}
