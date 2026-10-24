# The Tape Envelope and the Observation Core

The contract two bots share: what every input tape says whatever game it drives (the envelope), how Seedling's tape and Robot Wants Kitty's two tape forms map onto it, the core every observation stream reports, and why the gates compare exactly. `frontend/modules/seedlingDemo/tapeEnvelope.js` reads the envelope and `observationTolerance.js` is the diagnostic comparator; neither is a gate. The Robot Wants Kitty half of this page is a description for a later session in that repository, not a change to it.

## Why an envelope

The Seedling bot (the seedling-bot document in this directory) and the Robot Wants Kitty engine (a separate repository) both replay tick-indexed input against a game and compare what the game did with what a model predicted. They grew their tape formats separately. The envelope is the part the two already agree on, written down once so that a reader, a converter or a later shared tool has one definition to point at. It is small on purpose: a field goes in the envelope only when both games carry it with the same meaning.

Nothing on disk changes because of this page. No tape is rewritten, no expectation is renamed, and each game's own parser keeps its own rules. `parseTape` still refuses any `game` other than `"seedling"`; `readEnvelope` is the one reader that accepts any game id, and it validates only the envelope.

## 1. The envelope

| Field | Type | Meaning |
|---|---|---|
| `game` | non-empty string | which game the tape drives. Seedling writes `"seedling"`, Robot Wants Kitty's Flash tapes write `"robotkitty"` |
| `tape_version` | integer ≥ 1 | the version of THAT game's tape format. Versions are per game: Seedling 3 and Robot Wants Kitty 3 are unrelated |
| `profile` | `{id, md5}`, optional | the physics profile the tape was made for: `id` a non-empty name, `md5` 32 lowercase hex digits over the profile's own dump. Absent means "the game's one profile" |
| `boot` | object with finite `x`, `y` | where the player starts. Any further keys (`level`, `grants`) are the game's own |
| `rng` | object, optional | the random state the run starts from. Its keys are the game's own; absent means the game's default stream |
| `tick_count` | integer ≥ 0 | how many ticks the tape runs. When absent, the end of the longest span |
| `inputs` | array of `{key, from, to}` | named-key hold spans |

**The half-open rule, stated once:** a span `{key, from, to}` holds `key` during tick `t` if and only if `from <= t < to`. `from` and `to` are integers, `0 <= from < to <= tick_count`. A span therefore presses on tick `from` and releases on tick `to`; a one-tick span is `{from: t, to: t + 1}`, and a zero-length span (`from == to`) is refused because it produces neither edge. Seedling's `heldKeysAt` in `tapeFormat.js` is the single definition this sentence transcribes.

What the envelope does not fix, because the two games differ:

- **The key vocabulary.** Each game names its own keys, and each game's parser refuses unknown ones. The envelope requires only a non-empty string.
- **Overlapping spans on one key.** Seedling refuses them (FlashPunk's first release clears the whole hold, so overlaps do not compose). Whether another game composes them is that game's rule.
- **Ticks.** Tick 0 is the first tick the bot is armed and a tick is one fixed physics step; how a game skips dead frames is its own contract.

## 2. Seedling's mapping

Every committed Seedling tape already carries the whole envelope under the envelope's own names, so the mapping is an identity. The rest of the tape is Seedling-specific and is listed here by the version that introduced it and whether it reaches the game. The seedling-bot document's Versions table is the fuller account of each field; this table adds the envelope column.

A tape's version is decided by which fields it declares, never by the constant `TAPE_VERSION`: `requiredTapeVersion` walks the features highest first. The recompiled game (`Bot.as`) accepts versions 1 to 8 and 12, and `gameVisibleTape` projects every tape to `hold ? 12 : min(version, 8)` by dropping the model-only fields (`GAME_VISIBLE_DROPS`).

| Field | Version | Envelope | Reaches the game? |
|---|---|---|---|
| `game` | 1 | `game` | yes |
| `tape_version` | 1 | `tape_version` | yes, as the projection's version |
| `boot {level, x, y}` | 1 (any level from 2) | `boot` | yes |
| `tick_count` | 1 | `tick_count` | yes |
| `inputs [{key, from, to}]` | 1 | `inputs`; keys `right up left down primary secondary inventory inventory2` | yes |
| `noclip` | 1 | Seedling only | yes |
| `noDamage`, `noHazards`, `grants` | 2 | Seedling only | yes |
| `persistence` | 3 | Seedling only | yes, except a row carrying `at` |
| `equips` | 4 | Seedling only | yes |
| `pins` | 5 | Seedling only | yes |
| `save` | 6 | Seedling only | yes |
| `rng {seed, split}` | 7 | `rng` | yes |
| `rng.cosmetic`, `rng.fp`, `seam` | 8 | `rng` (the two streams); `seam` Seedling only | yes |
| `at` on a persistence row | 9 | Seedling only | no, model only |
| `despawn` | 10 | Seedling only | no, model only |
| `tick0 {rng, seam}` | 11 | Seedling only | no, model only |
| `hold` | 12 | Seedling only | yes, on builds declaring `hold` |
| `profile {id, md5}` | 13 | `profile` | no, model only |
| `name`, `description` | any | audit text, not envelope | no reader acts on them |

`profile` is the one field this page added. It is model-only for the reason every model-only field is: it is a statement about which physics the tape was recorded against, and Seedling has one build physics, so there is nothing for the game to do with it. A tape below 13 that declares it is a named error, as for every field before it, and `serializeTape` writes it only when a tape declares it. No committed tape declares it, so the 154 committed tapes, their serialised bytes and their projected bytes are unchanged by its arrival.

Seedling's `rng` block is absent below version 7; the envelope reads that as "no rng declared", which is what version 7's normalised `{seed: 0, split: false}` means too.

## 3. Robot Wants Kitty's Flash JSON mapping

Robot Wants Kitty has 16 Flash tapes, in JSON, written in Seedling's shape: the envelope reads them directly.

| Robot Wants Kitty field | Envelope |
|---|---|
| `tape_version: 1` | `tape_version` |
| `game: "robotkitty"` | `game` |
| `name` | audit text |
| `rng.seed` | `rng` |
| `tick_count` | `tick_count` |
| `boot {x, y, grants[]}` | `boot` (`grants` is the game's own key) |
| `inputs [{key, from, to}]`, half-open | `inputs` |
| `elapsed_phase`, `arm_frame`, `streams {}` | game-specific, outside the envelope |

The keys a Flash tape holds are Flash key names (`left`, `right`, `down`, `z`, `x`, `c`), which is the vocabulary the engine verbs are converted into (below). No Flash tape carries a profile today.

## 4. Robot Wants Kitty's engine CSV mapping

The engine's own tapes are CSV, and they differ from the envelope in three ways a converter must bridge.

**Spans are inclusive at both ends.** An engine line `button,from,to` holds the button on every tick from `from` through `to`, zero-based. The envelope span is `{from: from, to: to + 1}`; `tapeEnvelope.inclusiveToHalfOpen([a, b])` is that conversion, and `a == b`, a one-tick press in the engine, becomes the one-tick span `{from: a, to: a + 1}`. The reverse is `to - 1`. Robot Wants Kitty's `scripts/engine_tape_convert.py` already does the forward conversion and `flash_tape_convert.py` the reverse.

**Buttons are verbs, not keys.** The engine names `left right jump shoot rocket rocketup`. The converter's map is `left`→`left`, `right`→`right`, `jump`→`z`, `shoot`→`x`, `rocket`→`c`, and `rocketup`→ BOTH `down` and `c` over the same ticks: one verb becomes two spans.

**The header is three keys and nothing else.** Lines starting `#!key=value` carry exactly `frame0` (an integer ≥ 0), `boot` (`x,y`) and `powers` (an integer mask); a plain `#` line is a comment. None of the 17 committed engine tapes carries a header today. `boot` maps to the envelope's `boot`; `frame0` and `powers` are game-specific.

**What the file does not say, and the converter must supply:**

- `game` — always `"robotkitty"`; the CSV has no game id.
- `tape_version` — the CSV has no version; the Flash form's is 1.
- `rng` — the seed is a command-line flag of the engine run, not a field of the tape.
- `profile` — the engine's profile has no id, only an md5 over its dump text and a provenance phrase. An envelope `profile` for it takes that md5 and an id the converter names (the provenance phrase is the natural source).
- `tick_count` — derivable as the end of the last span, or `frame0` plus a run length the invocation fixes.

## 5. The observation core

Every observation stream has one record per tick, and the core of each record is four values:

| Core | Seedling spells it | Robot Wants Kitty spells it |
|---|---|---|
| tick | `t` | `tick` |
| x | `x` | `x` |
| y | `y` | `y` |
| room | `level` | none: one stream is one level |

plus the **transition events**, one per room change: `{t, from_level, to_level}` in Seedling, where `t` is the first observation in the new room. A stream of N ticks has N + 1 observations (0..N), because the bot records before it acts.

**Seedling spells `room` as `level`, and it stays that way.** Every committed expectation is `{ticks: [{t, x, y, level}], transitions: [{t, from_level, to_level}]}`; no file is renamed or rewritten for the envelope. A shared reader maps `level` to `room` on read. Robot Wants Kitty has no room concept, so a Robot Wants Kitty stream is a single room and carries no transitions.

**Game-specific columns follow the core under a per-game namespace.** Robot Wants Kitty's core CSV stream is 15 columns, `tick,held,x,y,speed,gravity,gmod,touchingGround,jumpKludge,inJump,doubleJump,rocketCd,timer,died,win`; everything after `tick`, `x`, `y` is its own, and a shared record would carry it as `robotkitty.speed`, `robotkitty.gravity` and so on. Its entity, grid, RNG and forecast streams are separate streams, not columns. Seedling's `parseObservationStream` keeps exactly the core and drops every other field, so Seedling has no extra columns in its committed streams.

## 6. Exact comparison, and why it stays the gate

Every gate compares observation streams **exactly**. Seedling's `diffObservationStreams` compares every `x`, `y` and `level` with `!==` and every transition element-wise; Robot Wants Kitty compares the md5 of the stream text. The reason is the one `diffObservationStreams`' docblock gives: the game, the recompiled runtime and the JavaScript model all compute in IEEE-754 doubles, so a difference is a transcription defect to investigate, not a tolerance to configure. A tolerance on a gate hides exactly the bugs the gate exists to find, and it hides them where they are smallest, which is where they start.

A tolerance comparator is still useful as a **diagnostic**: once a stream is known to diverge, it says how far, from which tick, and whether the room sequence at least agrees. That is `observationTolerance.compareObservationStreams(expected, actual, {epsilon: {x, y}, transitionSlack})`. Its rules:

- `x` and `y` may differ by at most `epsilon.x` and `epsilon.y` at every tick.
- The room must match exactly at every tick outside a transition's slack window (the ticks within `transitionSlack` of an expected transition).
- The room SEQUENCE must be identical, and each transition's tick may differ by at most `transitionSlack`.
- A length difference is reported, and tolerated only up to `transitionSlack`.

With `epsilon` 0 and slack 0 its verdict equals `diffObservationStreams(...) === null`; `observationTolerance.test.js` asserts that over all 154 committed streams against the model's own streams and over perturbed copies. It is a separate module rather than an option on `diffObservationStreams`, and a test refuses any import of it from the gate scripts (`scripts/procgen/check-*.mjs`), `tapeRunner.test.js`, `fixtures/index.js` and `watchWasm.js`, so no gate can loosen by accident. Robot Wants Kitty's one tolerance, a solver check's `--max-px` (default `1e-4`), is the same kind of thing: a search-time diagnostic, not the replay gate.
