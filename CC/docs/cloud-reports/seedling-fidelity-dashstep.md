# Seedling fidelity DASHSTEP: hammer's leg 7 is a statue's dialogue — the talk circle is 32 px, not 24

| | |
|---|---|
| Session | `seedling-fidelity-dashstep` (planner `seedling-fidelity-planning-8`, wave 18, model coverage) |
| Start SHA | `f77dbd6bb9` (main: waves 17 and 18 harvested OFF; not rebased) |
| Head | the commit carrying this report. D1 evidence `70b9580`; D2 code `3d755a4`; D3 evidence `8f6dc34` |
| Harness branch | `claude/seedling-sword-dash-7g06ce` |
| Verdicts | **W0 PASS · D1 PASS (the cause is NOT dash timing) · D2 PASS (one switch, OFF, byte-identical OFF, two game witnesses at 0 px, 4 mutants) · D3 PASS, STOP at the flip (movers listed)** |

**The one thing to know first.** The game does not lose a tick of the dash. The dash press at t99 is the sword key,
and the sword key is also the talk key. Its release at t100 lands **31.79 px** from L0's `statue2@184,160`. The game
gives a `Statue` a 32 px talk circle (`Statue.as:25`), so the dialogue opens and `Game.freezeObjects` stops the player
from t102. The model gave every talker the NPC default of 24 px. New switch: `CONTACT_FIDELITY.statueTalkRange`.
Hammer's flip needs it ON to fix leg 7, and that turn-on is the user's call.

## W0 — the bank at base (`f77dbd6bb9`)

| row | command | result |
|---|---|---|
| base | harness branch at `f77dbd6bb9`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Dev server `serve-nocache.py 9689` (pid 509). Scratch worktrees for the flip (`hammer-flip-m` @ `d3099b0603`, server 9690) and for the base (server 9691) |
| identity block | `SEEDLING_PORT=9689 bash scripts/procgen/identity-block.sh .` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK. The six `--check`s: `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0. These equal AXETIMING's bank on every row. The reference read "4 differ" until the six non-wasm submodules were initialised, then **ALL 7 + 5 MATCH** (`evidence/w0/identity-base.txt`) |
| tapeRunner pairs | from the bounded run's JSON: md5 over sorted `status\tfullName` | **617**, `8f27f975cfdd702f442f576e6f217d47`, 0 non-pass |
| roster | `fixtures/tapes/index.json` `.tapes` | **280** |
| surface / constants / entities / profile | the four `--check`s | GREEN 312 · PASS 6,001 · PASS 566 · PASS 138 (both JSONs) (`evidence/w0/four-checks-base.txt`) |
| bounded vitest BEFORE | 235 files (`evidence/drivers` lists how): the brief's list, plus every non-slow test naming `TALK_RANGE`, `talkGuard`, `inTalkRange`, `talkCircles`, `PLACED_NPC_TALK`, `CONTACT_FIDELITY_KEYS/_DEFAULTS`, `stepTalkers`, `talkerTalks`, `statue`, `endingChain`, `placedTalk`, `seedlingProfile`, surface, constants, plus `tapeRunner` | **6,674 / 6,674 pass**, md5 `72ee48c5f7598a0f03061d82b939b67c` |

## D1 — the game witness (PASS; the brief's reading is refuted)

**Reproduction.** Leg 7's captured request (run 39005482173, `requests-9.jsonl`, key
`level_0__r8c0 <- in_L1_64_112 -> location:L0 flag 1: breakablerock@288,176 cleared`) replays in node at the flip's
head with one answer: the full pass solves in **247 t**, verb `break`. Its primary presses come at t83 (a swing), t91
(a dash at rest), t93 (swallowed) and **t99** (a dash while walking right).

**The game.** The contact sampler (`probe-seedling-contact-divergence.mjs`) does not stage event flags, so on its own
it lands the leg inside `breakablerock@80,112` and the solver refuses. I made a scratch copy that writes the leg's
`flag:L0:4` through `Game.setPersistence` first, as the sweep does (`evidence/drivers/contact-staged.diff`). It ran on
the flip's page (p4f, headless logic-only) and reproduced the sweep's failure exactly: t102, expected 182.803, got 180.153.

| t | keys | game x | game vx | anim | distance to the statue (208,160) |
|---|---|---|---|---|---|
| 98 | right | 172.70326 | 0.85 | side-walk | 36.21 |
| 99 | right, **primary** | 174.10326 | 1.40 | side-walk | 34.84 |
| 100 | right | 177.25326 | 3.15 | side-walk | **31.79** ← the release |
| 101 | right | 180.15326 | 2.90 | side-walk | 28.99 |
| 102 | right | **180.15326** | **2.90** | **side-stand** | 28.99 |
| 103–105 | right | 180.15326 | 2.90 | side-stand | (frozen) |

(`evidence/d1/leg7-game-rows-t95-105.txt`.) The dash is the model's to the bit: t100 vx 3.15 and t101 vx 2.90 are the
model's own rows. At t102 the game neither moves the player nor applies friction, and the anim drops to `side-stand`
while `right` is held. The whole Player update is skipped. That is `Game.freezeObjects`, not a lost tick of the dash.

**Why (the AS3).**
- `NPCs/NPC.as:190` — `inRange = FP.distance(x, y, p.x, p.y) <= talkRange`.
- `NPCs/NPC.as:191` — `hitKey = Input.released(p.keys[6])`. `Player.as:59` lists the keys as
  `RIGHT, UP, LEFT, DOWN, X, C, X, V, I`, so keys[6] is **X, the sword key**.
- `NPCs/NPC.as:225` — `(hitKey || !keyNeeded) && !Game.talking …` → `startTalking()`.
- `NPCs/NPC.as:193-195` — from the next update, `if (talking) Game.freezeObjects = true`.
- `NPCs/NPC.as:27` declares `talkRange = 24`, but **`NPCs/Statue.as:25` assigns `talkRange = 32`**.

The release at t100 is 31.79 px from the statue: inside 32, outside 24. The dialogue opens in that frame, and the
player is frozen from t102 (the statue updates after the player). `wasmPlayback.INERT_MOBILES` (the JS arc's) already
reads 32 for `NPCs::Statue`, with the note *"The MODEL still tests 24 for a statue … a fidelity defect … routed to the
fidelity planner"*. This slice is that fix.

**Committed:** the capture `fixtures/statue-talk/leg7-l0-statue2.json` (the request, the room records, the 247-t plan,
and 106 game ticks).

## D2 — the rule (PASS; one switch, OFF)

`CONTACT_FIDELITY.statueTalkRange` (`SEEDLING_STATUE_TALK_RANGE=0|1`), a new row appended after `axeGateTransit`.
- `endingChain.js`: `STATUE_TALK_RANGE = 32`, `CLASS_TALK_RANGE = {statue1, statue2}`, and `talkRangeOf(tag)`. ON it
  returns the class's radius; OFF it returns `TALK_RANGE`, so OFF is byte-identical.
- `levelRun.stepTalkersNow` (the run's placed-talker arm) tests `inTalkRange(…, talkRangeOf(w.tag))`. Its REFUSED
  sentence names that radius.
- `levelRun.talkCirclesNow` (`run.talkCircles`): ON only, each circle carries `talkRange`.
- `strikePolicy.talkGuard` (⚖ ruling 53: a release inside a circle is refused, not priced) adds its travel bound to
  `c.talkRange ?? TALK_RANGE`. Same float order as before, so OFF is identical. Its refusal sentence names that radius.

Nothing in `planSwordDash`, `dashPrefixesFor`, `corridorDashRescue`, the strike code or `solveSegment` changed. Both
statues are covered: L0 `statue2@184,160` and L87 `statue1@224,176` (the atlas has no others).

**Witnesses (`fidelityStatueTalk.test.js`, 6 rows):**
- **Leg 7.** ON, `replayCapture` reproduces all 106 game ticks with worst |Δ| = **0.000 px** and no differing field,
  vx included; x and vx are held at t102. OFF, the model parts at **t102** (x game 180.153, model 182.803), the sweep's
  own row (`evidence/d2/leg7-replay-off-on.txt`).
- **Survey step 79** (D3 below): ON, the model matches all 200 game ticks; OFF it parts at t143.
- The radius rows (32 for both statue types ON, 24 OFF and for `sign`); `talkGuard` on the witness's t99 state (no
  `talkRange` → null; 32 → refuses).

**Mutants**, predicted first, each made by copy and restore:

| mutant | predicted red | measured red |
|---|---|---|
| M1 the run arm keeps 24 | leg-7 ON, step-79 ON | exactly those 2 |
| M2 `STATUE_TALK_RANGE = 31` | the radius row, leg-7 ON (31.79 > 31); step 79 stays green (29.45) | exactly those 2 |
| M3 `talkGuard` ignores `c.talkRange` | the guard row only | exactly that 1 |
| M4 `talkRangeOf` ignores the switch | the radius row, both OFF controls | exactly those 3 |

**Records.**
- Constants census: `--write` after a reviewed `seedling-constants-fields.csv` row classes the literal (`rule/bound`,
  `NPCs/Statue.as:talkRange`). `--check` PASS, 6,002, 0 drift.
- The reference was regenerated (`seedling-bot.md` paragraph): ALL 7 + 5 MATCH.
- Re-pins, which a new key at the end of the list requires:
  - `contactFidelity.test.js`: the defaults row, plus the new key in its `skipIf` list.
  - `fidelityAxeTiming.test.js`: "the last two keys" becomes "the two keys right after `arrowLaneCrossing`", the way
    the wave-18 harvest re-pinned ARROWLANE.
  - `lintGateLabels`: my first version of the test pinned a roster length; it now asserts the witness reaches past t143.

## D3 — reach (PASS; STOP at the flip)

The switch can only matter in a room with a statue (L0, L87), and only for a primary release within 32 px plus the
guard's travel margin. Everything below was measured with the switch ON against OFF.

| instrument | base `f77dbd6bb9` (main) | flip `d3099b0603` (DB + DK + `dashOnlyWindow` ON) |
|---|---|---|
| tapeRunner, ON | 617 pairs, md5 `8f27f975…` = W0. **No committed tape moves**, the dash tapes `r9-l0-sword-dash*` in L0 included | (replay is solver-free: same) |
| route survey, every L0/L87 step (L0 visits 1–10 = steps 1, 14, 20, 22, 29, 33, 42, 67, 73, 79; L87 visits 1–3 = local 99, 103, 187) | **one mover: step 79** `L0 → teleporter@304,176`, SOLVED **199 → 204** | the same, and only that (`evidence/d3/survey-l0-l87-ab.txt`) |
| sweep, node replay of every captured L0/L87 request | main 39005483635: **43 requests, 0 move** | flip 39005482173: 45 requests, **5 move**, on legs **7** (247 → 243, both captures), **23** (233 → 237), **39** (283 → 282), **47** (273 → 281). All four are `breakablerock@288,176` legs |
| those flip legs played on the game ON (p4f, the staged scratch probe) | — | **all four `done`**, at the node answers' ticks (243, 237, 282, 281). The playback's tolerance is zero px per tick (`evidence/d3/cd-flip4-on.jsonl`) |
| identity block ON (`SEEDLING_STATUE_TALK_RANGE=1`) | every row = OFF **except `solve-seedling-r9-campaign --check` → exit 1** (`686c0428`) | not run |
| bounded vitest ON (236 files) | tapeRunner md5 = W0. 3 reds, all re-pins already listed in D2 (the defaults row reads the live env and lacked its `skipIf`; the AXETIMING key-order row; the lint), each green at the head with the env set | — |

**Step 79 is a fidelity gain.** Its OFF 199-t walk releases X at t141, **29.45 px** from the L0 statue. Played on the
game (p4f; `probe-seedling-chaser-mobiles.mjs --frames`, the class rows vacuous since L0 has no Bob), the game holds
x 237.699 from **t143** (`side-stand`). The sample clock fits the model ON at shift exactly [0] over all 200 ticks; it
fits the model OFF at none (`[]`). Committed as `fixtures/statue-talk/survey-step-79-off.json`. The ON 204-t walk does
not release inside the circle. So the CI survey's step 79 "SOLVED 199" is a plan the game would not follow.

**The campaign mover is a cost, not a gain.** ON, `r9-solve-0-v3` (L0 → L12) re-derives at **313 t against the
committed 299**. `r9-solve-12`'s free-oracle clock follows (12856 declared, 12870 derived), and `sum(segment ticks)`
rises 10,825 → 10,839 (`evidence/d3/campaign-check-on.txt`). The committed walk releases X at t130 (36.82 px) and
t182 (34.60 px). Both are outside 32, so neither the game nor the model ON opens the dialogue: the model's ON and OFF
rows are identical on that tape. The 14 ticks come from ruling 53's guard. It refuses a release within the radius
plus one tick's bound on travel (`|v| + MAX_MOVE_SPEED·√2 + SLASH_DASH_FORCE`), and that margin now sits on 32 instead
of 24. Flip legs 23 (+4) and 47 (+8) are the same cost; 39 gains 1.

**A run-only variant, measured and not shipped** (the guard left at 24, only the run arm at 32):

| row | full switch (shipped) | run-only variant |
|---|---|---|
| leg 7 on the flip | 243 t, `done` on the game | **313 t** (main's dashless plan: the dash preview now freezes, so the full pass falls back) |
| flip legs 23 / 39 / 47 | 237 / 282 / 281 (`done`) | unmoved |
| `r9-solve-0-v3` (campaign `--check`) | 299 → 313, exit 1 | **unmoved, exit 0** |
| survey step 79 | SOLVED 204 | **REFUSED**: *"waypoint 0 (248,184): not reached within 400 ticks; stalled at (237.699, 151.507)"*. The walk releases into the dialogue it now models, and no guard steers it away |

(`evidence/d3/campaign-check-runonly-variant.txt`, `survey-79-runonly-variant.json`, `l087-flip-runonly.jsonl`.) Under
ruling 53 the planner must not plan into a dialogue the model knows about, so the guard has to read the same radius
as the run. I kept the two together. The cost could be removed by a guard that reads the release's position from the
preview instead of a travel bound. That is a ruling-53 policy question, queued here and not built.

**STOP.** The switch ships OFF. A flip owes:
- the re-record of `r9-solve-0-v3` (and the boots after it, by the clock: DASHFLIP's trap, where a boot-only move
  shifts a residue pin);
- survey step 79's 204;
- under the flip, sweep legs 7, 23, 39 and 47.

## The rows this moves, and the CI dispatches to confirm them

| row | before → after (ON) | dispatch |
|---|---|---|
| sweep (main) | 0 of 43 L0/L87 requests move in node | `seedling-divergence-sweep.yml`, branch `claude/seedling-sword-dash-7g06ce`, `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,statueTalkRange`, `capture_requests=true`; and its control, the same branch with `contact_fidelity` empty. Expected: no L0/L87 mover; elsewhere only the ±20 `crossed`↔`done` noise. Repeat ×2 on any key that moves |
| sweep (the flip) | leg 7 failed → done (243 t); 23, 39, 47 done at 237 / 282 / 281 | the workflow takes `contact_fidelity`, but `hammer-flip-m` has no `statueTalkRange` key (`parseContactFidelity` throws on an unknown key). The planner makes a scratch merge of `hammer-flip-m` with this branch. The code merges clean; only the generated `README.md` and `docsIndex.js` conflict, so regenerate them with `generate-procgen-reference.mjs`. Then dispatch with the `contact_fidelity` above, `keys=` the four leg keys, ×2, then the full 843 legs |
| route survey | step 79 SOLVED 199 → 204 | `seedling-survey.yml` has no switch input. On a scratch branch with `statueTalkRange: true` as the default: `-f through=end -f route=full -f only=79 -f base_run=38926053841`. Steps 1–79 have the same ids locally and on CI (`(level, goal, boot)` agree). Expected: step 79 204, the rest unmoved |
| producer | `r9-solve-0-v3` 299 → 313 | none on CI: `SEEDLING_STATUE_TALK_RANGE=1 node scripts/procgen/solve-seedling-r9-campaign.mjs --check` (exit 1, 5 failures, all this one window) |

## The JS arc

- **Pins that move:** none. The contact settings derive from `CONTACT_FIDELITY_KEYS` (`seedlingContactSettings.js`),
  so the new key is a flashPanel setting and a valid `contact_fidelity` input with no edit. `contactFidelityStamp()`
  stamps nothing at the defaults.
- **To wire:** nothing. Optional: the comment in `wasmPlayback.js:200-203` (*"The MODEL still tests 24 for a statue …
  not changed here"*) can now point at `statueTalkRange`.
- The talk-circle adoption guard (`talkCircleGuard`) already uses 32 for a statue.

## Handed to the hammer arc

Nothing is in hammer's region. Leg 7 is a placed NPC's dialogue, priced in `levelRun` and in `strikePolicy`'s guard,
and none of `planSwordDash`, `dashPrefixesFor`, `corridorDashRescue` or the strike code is involved. For the dash flip:
**with `statueTalkRange` ON, leg 7 plays `done` under the flip** (243 t). The flip has three other L0 movers (23, 39,
47), all `done` on the game. The flip can be re-measured against this switch as soon as the merge described above
exists.

## Deltas

- Code: `contactFidelity.js` (+1 key, its env reader), `endingChain.js` (`STATUE_TALK_RANGE`, `CLASS_TALK_RANGE`,
  `talkRangeOf`), `levelRun.js` (3 lines in `stepTalkersNow` / `talkCirclesNow`), `strikePolicy.js` (`talkGuard`'s
  per-circle radius + its sentence).
- New: `fidelityStatueTalk.test.js` (6 rows), `fixtures/statue-talk/` (2 game witnesses).
- Re-pins: `contactFidelity.test.js`, `fidelityAxeTiming.test.js`.
- Records: constants fields + census + doc region, `seedling-bot.md`, `seedling-bot-log.md`, the reference
  (`README.md`, `docsIndex.js`).
- Roster: 280 tapes, unchanged (the witnesses are fixtures, not tapes). Surface GREEN 312, entities 566, profile 138:
  unchanged.

## What the brief got wrong (measured)

1. **"The game loses ONE tick of movement in the dash's first ticks."** It loses every tick from t102 until the
   dialogue closes. The playback stops at the first differing tick, which is why only one tick showed. The dash's
   impulse and decay match the game to the bit at t100–t101.
2. **"It is in the dash-timing family of DASHFLIP."** It is not. Neither `SLASH_ANIM_TICKS` nor the dash window is
   involved. The dash matters only because it carries the player into the statue's annulus (24–32 px) on the frame the
   sword key comes up.
3. **"Replay leg 7's captured plan on the game."** The JS arc's contact probe cannot do that for this leg. It does not
   stage the leg's `stagedEvents` (`flag:L0:4`), so the arrival lands inside `breakablerock@80,112` and the solver
   refuses `arrival-inside-solid`. My scratch copy stages the flag the way the sweep does.
4. **D3's census of dash tapes** (`r9-l6-sword-dash-hit`, `dash-l16-sword-all`, `axe-*`) is moot. Only L0 and L87 have
   statues, and tapeRunner ON is byte-identical (617, md5 = W0).

## Residue

- The guard's travel margin costs 14 t on `r9-solve-0-v3` and 4–8 t on two flip legs (above). It would take a
  preview-exact release guard to remove that cost: a ruling-53 question.
- Local survey derivation at base has 212 steps against CI's 222, so local ids past 79 differ from CI's. I compared by
  (level, goal) and ran every L0/L87 step of the local route. CI step 128 (L0) is not in the local route.

## Byte-inertia

OFF (the default) the identity block at the head = W0 on every row, the six `--check`s included
(`evidence/d2/identity-head-off.txt`). The reference MATCHes. Bounded vitest AFTER, the final run at the head's
sources: **6,681 / 6,681 pass** (236 files), tapeRunner 617 md5 `8f27f975…` = W0. CI `JavaScript Unit Tests` at the
last head: below.

## Rows to BANK

- `fidelityStatueTalk.test.js` (6) and the two witnesses: `fixtures/statue-talk/leg7-l0-statue2.json` (md5
  `6f530d13dc6268e2f9d24f7ee6cef699`) and `survey-step-79-off.json`.
- `CONTACT_FIDELITY_KEYS` +`statueTalkRange` (appended last; a union).
- Constants census 6,002 (+1 reviewed rule row).
- Trap candidates (in the log entry):
  - the sword key is the talk key, so a stop right after a swing near an NPC is a dialogue first;
  - a field a subclass constructor assigns is not the base declaration's value.

## CI

`JavaScript Unit Tests` at `ab11b8c` (the report's first commit; same code as D3 `8f6dc34`, whose run the push cancelled): run 39052145150 **success** — vitest (unfiltered) 20,730 passed, 0 skipped, 0 failed; slow battery 253 / 253. This line's own commit is docs-only.
