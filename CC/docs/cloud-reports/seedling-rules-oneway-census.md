# Seedling RULES one-way event census: what can seal what the AP logic says is open (measure only)

**Slice:** `rules-oneway-event-census`, an Opus measure-only slice in the RULES arc (planner
`seedling-rules-planning-4`). Nothing that the delivery, the rules or the model reads changed. The only tracked
additions are this report, the game witness `scripts/procgen/probe-seedling-oneway-census.mjs` and its enrolments
(`boxLock.test.js`'s guarded-taker list; the generated procgen instruments index).

⚖ **The question** (the user, 2026-10-28): *"We changed some of the rock fall events to not interfere with the
Archipelago logic, but not others. ... I want to check for other events that could interfere with the Archipelago
logic that we need to fix."* The plan the user picked: *"Census, then fix list"*.

| | |
|---|---|
| Base | `git merge-base HEAD origin/main` = **`af86d85d0ca5f8f447223187b5f490d2074af7d9`** (= `origin/main` at fetch) |
| Branch | `rules-oneway-event-census` |
| Game | `seedling_bot_ap_p4g`, headless logic-only, under the box lock; local dev server on 8228 |
| Rules read | `worlds/seedling_playthrough/{Regions,Rules,Locations}.py` and `frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json` at the base |
| Verdict | **0 findings (no SEAL, no LOOSER, no TIGHTER).** 271 instances: 160 harmless · 98 priced · 10 patched · 3 inert-in-AP |

## The one thing to know first

**Every one-way event left in the delivered set is either already patched, already priced by a rules event, inert in
the AP delivery, or seals nothing the logic relies on.** The planner's two open candidates both resolve without a fix:

- **L28 `fallrock@112,240` is PRICED, and it is an OPENER, not a seal.** Cutting `rope@160,64` (tset 1) drops it onto
  `button@112,240` (tset 0), and a Solid is one of a Button's pressers (`Button.as:16`). So the rock holds
  `grasslock@176,208` (tset 0) open, on this visit and on every later one (the rock is rebuilt fallen,
  `FallRock.as:42-47`). The rules carry exactly that: `L28 flag 0: rope@160,64 cleared` has
  `action.opens = [{class: fallrock, x: 112, y: 240, effect: "holds"}]` and gates both
  `level_28__r1c18 <-> level_28__r11c4`. The rock lands in the middle of four `dungeonspire`s, which leave a ring
  around it, so no passage is cut. It is already game-witnessed by `probe-seedling-rope-events.mjs` (the L28 rows).
  ⚠ ROCKMOVE's D1 row (*"lands on its own `button@112,240` (t0, which has no responder)"*) is wrong: the grass lock
  answers tset 0.
- **L82 `fallrocklarge@128,224` is HARMLESS.** It is not Bob's class. Bob's rock landed on the stairs. This one lands
  in the neck between the arena and a dead-end pocket that holds no location and no door: the pocket is where L71's
  pit lands (`control@192,208`, landing (160,272)). The pocket has a second way out: `lock@192,224` (tset 1), held
  by `button@192,240` directly under it. Witnessed (D3): with the rock fallen, the player stands on the button at y 245.55 while the lock fades and then walks up through it to y 132.7.

Beyond the rocks, two families were worth a closer look, and neither yields a finding. Details are in D2.
- **One-sided openers.** BossLock reads its key only on the pixel row BELOW it (`BossLock.as:62`). ShieldLock reads a
  touch only from the WEST (`ShieldLock.as:33`, `collide("Player", x - 1, y)`). Twelve of the fourteen boss locks and
  the L71 shield lock are events with a recorded `side`. The other four (L56/L66 boss locks, L12/L20 shield locks)
  each face their room's arrivals with the side that opens, and their far side is reached only through them.
- **Item pickups with side effects.** Only the vanilla `Wand` publishes an activation group on pickup
  (`Wand.as:58-68`; `FireWand.as:22`'s comment says the same, but its `removed()` does not). The AP delivery rewrites
  L43's Wand to an `apitem`, and the two pocket rocks stay up. Witnessed (D3): the apitem clears `{43,0}` alone; the vanilla Wand control clears `{43,0} {43,1} {43,2}`.

---

## D1: the class list, derived from the source

**Instrument:** the AS3 at `vendor/seedling` (the pinned Seedling source), swept with `grep -a` (the NUL-bearing-file
rule):
- every `Game.setPersistence(` caller (50 sites; `Bot.as` excluded: an instrument);
- every `type = "Solid"` assignment made outside a constructor;
- every activation propagator (`activateAll`, `.activate = ` on a group);
- every `Player.has*` / `Main.has*` read in a constructor, `added()`, `check()` or `update()`;
- every `new Teleporter(` built at runtime.

Then every instance of each class in `frontend/modules/flashPanel/atlases/seedling-map.json`, with the delivery's
`SEEDLING_SET_PATCHES` applied. No two entities in any level share a persistence tag (measured: zero
collisions over all 116 levels). The only implicit writers are `Yeti.as:48` (`{58,1}`), `FinalBoss.as:222`
(`tag + 1`), `BobBoss.KILLED_TAG` / `Fire.BOSS_DROP_TAG` (L32, R4) and `Moonrock.as:135` (removed).

| family | classes (source) | what it does to passability |
|---|---|---|
| **A: seals** (Solid after a trigger, persistent) | `FallRock`, `FallRockLarge`, `Moonrock` | parked off-map (`type ""`), fall on their trigger, write their tag false, and are rebuilt fallen on every later entry |
| **B: reclosers** (write their tag back TRUE, or go Solid again) | `Lock` with tset ≥ 0 (`returnToNormal`, `Lock.as:101-107`), `GrassLock`, `WandLock`, `Cover`; `RockLock` / `BossLock` when deactivated | held open only while their group is active. Not one-way: CLEARTAG's activation-held class |
| **C: persistent openers** | `BossLock`, `ShieldLock` (tset −2), `MagicalLock`, `BreakableRock`, `BurnableTree`, `RockLock`, `Lock` with tset −1, `FinalDoor`, `Chest`, `Karlore` (`hasFire`), the tagged `teleporter` (L58) | open once; `check()` removes them on every later entry |
| **D: cross-level writers** | `ButtonRoom` with `room ≥ 0` (`ButtonRoom.as:91-93`) | a latch that clears `{room, tset}` |
| **E: propagators** | `Button` (momentary), `ButtonRoom` with `room −1` (latch, *"Can't be reset to false!!"*), `RopeStart` (cut), the vanilla `Wand`, `FinalBoss`'s death (`activateAll(t0)`) | carry the trigger to an A/B/C responder |
| **F: talk / kill / toggle writers** | `Watcher`, `Oracle`, `Yeti`, `LightPole`, the bosses, `SandTrap`, `Spinner` | write a tag; matter only where something reads it |
| **T: transient Solids** (no persistence, rebuilt per entry) | `Crusher`, the pushable blocks, the `IceTurret` corpse, the bridge tile 29 (opens on a Spear), the igneous tile 31 (turns to lava after proximity) | at most a visit-long block; never a cross-visit seal |

**Out of class, and why:**
- the static walls (`rock*`, `pole`, `tree*`, NPCs …) never change;
- `Pulser`, `ArrowTrap`, `SpinningAxe`, `LavaChain` and `BeamTower` are hazards (static `wall` rows or open), not
  passability;
- `BossTotem` / `FinalBoss` going Solid are set-piece encounters priced by their encounter rows;
- `IGNEOUS_IS_FREE` is the rules' own refutation row for tile 31 (`AP_1` `provenance.refutations`);
- runtime `new Teleporter(` sites (`TentacleBeast.as:213`, `LightBossController.as:104`, `Moonrock.as:134`)
  OPEN exits, and they are encounter-priced (the moonrock is removed).

## D2: classification, by instance

**Counts (271 instances):** **160 harmless · 98 priced · 10 patched · 3 inert-in-AP · 0 SEAL · 0 LOOSER · 0 TIGHTER.**

| class | instances | verdict | why |
|---|---|---|---|
| `fallrock` | 8 | 5 patched · 1 priced · 2 inert-in-AP | patched: L37, L74, L39, L29, L43 doorway (rows `l37-fallrock-removed`, `l74-…`, `l39-…`, `l29-…`, `l43-fallrock-removed`). Priced: **L28** (above). Inert: L43's two pocket rocks (only the vanilla Wand drops them; witness `l43-*`) |
| `fallrocklarge` | 2 | 1 patched · 1 harmless | L32 `l32-bossrock-moved`; **L82** (above; witness `l82-*`) |
| `moonrock` | 1 | patched | `moonrock-removed` |
| `button` | 23 | 2 patched · 21 harmless | momentary; the verdict is the responder's row. L74 and L29 removed with their rocks |
| `buttonroom` | 11 | 10 priced · 1 patched | the four cross-level latches write `{39,8}` = `L39 flag 8: wandlock@144,592`, `{63,1}` = `L63 flag 1: lightpole@64,88`, `{62,0}` = `L62 flag 0: lightpole@120,200`, and `{37,4}`, the removed L37 rock (builds nothing). The seven same-room latches open their group for good, and the puzzle policy prices the press free (L20 is refuted to cost the Shield) |
| `rope` | 3 | priced | `L16 flag 0` (disarms the t0 arrow traps), `L28 flag 0` (the rock that holds the grass lock), L39's shaft gate G(sword/spear/fire) (its rock patched; its pulser armed, rules-l39) |
| `wand` | 1 | inert-in-AP | the L43 location: an `apitem` in the AP delivery, with no Activators |
| `bosslock` | 14 | 12 priced · 2 harmless | 12 obstacle events, each with a `side` ("walking its key line"). L56 `@96,16` and L66 `@72,64` have no event: in each, the south key line faces the room's arrivals ((16,112) from L52; (72,80) from L70), and the far side (L56's pit to L57; L66's door to L70) is reached only through it |
| `shieldlock` / `shieldlocknorm` | 1 / 2 | 1 priced · 2 harmless | L71 `@288,256` is an event with a side. **L12 `@288,704`**: opens from the WEST only, so a player in the east pocket (`level_12__r43c21` + L34) cannot open it. But L34's only entrance is that pocket, and the pocket's only entrance is `r0c19` through the lock from the west, which removes the lock for good (tset −2, tag 10). So the rules' east→west `Has(Shield)` edge is never needed while the lock is shut. L20 `@176,16`: the west side is the main room; the east tile is `buttonroom@192,16`'s dead end |
| `lock` | 13 | 8 priced · 5 harmless | tset −1 ×8: room-clear locks that `check()` keeps open. tset ≥ 0 ×5: held by a button (B, not one-way); L82's is the pocket's exit |
| `grasslock` | 1 | priced | L28, held by the fallen rock (`L28 flag 0`, effect "holds") |
| `wandlock` | 15 | 1 priced · 14 harmless | `L39 flag 8` (the cross-level latch from L38); the rest are button/cover puzzles (B) |
| `rocklock` | 2 | priced | L26 tset −1 (room clear; `check()` removes it once cleared; the rules charge the kill per crossing); `L112 flag 1` (FinalBoss's `activateAll(t0)`) |
| `magicallock` / `…fire` / `breakablerock` / `…ghost` / `burnabletree` / `karlore` / `finaldoor` / `teleporter`(L58) / `yeti` | 4/2/22/2/6/1/1/1/1 | priced | item- or talk-gated persistent openers, openable from any side (wand shot / strike / fire / talk); events where a flag matters (`L0 flag 1/4`, `L12 flag 7`, `L24 flag 0`, `L58 flag 1`, `L113 flag 0`) |
| `chest` | 16 | harmless | opens, never closes; a location chest is an `apitem` (8×8, not Solid) in the AP delivery, so its tile is at most more open (the rules price `chest` open). Its *pickup side* is a separate, already-queued item: a vanilla Chest opens only from the line under it (`Chest.as:63`), an `apitem` from any side (the rules arc's 2026-10-27 FUTURE row, held for the next AS3 recompile) |
| `lightpole` / `darktrap` | 20 / 7 | 6+7 priced · 14 harmless | the dark-trap pole events (`L62 flag 0`, `L63 flag 1/6/7`, `L65 flag 0`, `L101 flag 0`); 14 poles have no darktrap reading them (lighting only, which is fidelity W34 LIGHTPOLE's ground) |
| `watcher` / `oracle` | 11 / 1 | harmless (`L114 flag 0` priced) | talk writers. No other entity in their level reads the tag; invisible and not Solid. `L114 flag 0` is the FinalDoor's watcher event |
| bosses (`lavaboss`, `shieldboss`, `tentaclebeast`, `bosstotem`, `lightbosscontroller`, `finalboss`) | 6 | priced | encounter / boss-report rows; they open (mouth and exit teleporters, L112's rock lock) and never close |
| `sandtrap` / `spinner` | 13 / 11 | harmless | tagged enemies, removed once dead; not Solid |
| T: `crusher` / pushables / `iceturret` / `cover` | 4 / 19 / 2 / 24 | harmless | no persistence: rebuilt at their origin on every entry |

The per-instance table (all 271 rows) is the appendix.

## D3: the game witnesses

**Instrument:** `scripts/procgen/probe-seedling-oneway-census.mjs` (this slice). It follows the shape of
`probe-seedling-l39-pulser.mjs`: p4g headless logic-only, a FRESH page per tape, `botLoadLevels` → `botLoadTape` →
`botStart` → `botDrain`, and the staging of `fixtures/tapes/r9-solve-16.json` with its items cleared and `noDamage`.
The vanilla arm is `vanillaRecordSet(EMBED, MAP)` (the delivery's own `SEEDLING_SET_PATCHES`). The AP arm is that set
with L43's one location rewritten by `rewriteRecordSet`, exactly as the delivery writes every placement.

Local run (dev server on 8228, `ALL CHECKS PASSED`, 10/10):

| tape | set | staging | game | verdict |
|---|---|---|---|---|
| `l82-top-entry` | vanilla delivery | boot L82 (144,16) = the L96 landing, idle 240 t | `{82,1}` written; the player never goes below the arena | the rock falls on entry from the top (`FallRockLarge.as:70-79`): any later L71 fall lands with it fallen |
| `l82-pocket-seal` | vanilla delivery | boot (160,272) = the L71 pit landing, `{82,1}` staged, up the rock's columns | min y **258.05** (the pocket's top is 256); no transition | the rock neck is shut |
| `l82-pocket-lock` | vanilla delivery | the same boot and staging; up to row 16, east, one step onto `button@192,240`, wait, up | on the button at y **245.55** from t80 to t220 (the lock fades); then up through `lock@192,224`: y 222.65 at t240, **132.7** at t320 | **the pocket leaves through the lock: not a trap** |
| `l43-ap-wand` | vanilla delivery + L43's `wand@144,224` → `apitem` (`rewriteRecordSet`) | boot (144,240), all five totem parts, up, dismiss | clears **`{43,0}` only** | inert in AP: no pocket rock falls |
| `l43-vanilla-wand` | vanilla delivery (a real `Wand`) | the same | clears **`{43,0}` `{43,1}` `{43,2}`** | the control: the Wand drops both pocket rocks |

Two tape corrections were made on the way (recorded so nobody re-derives them). The first L43 arms walked past an
INVISIBLE Wand: `Wand.as:78` shows it only once the save holds every totem part and the player stands below it, so
the staging is ROCKMOVE's `l43-wand-stairs`. The first L82 lock tape pushed east along row 17, which is three tiles wide;
the button's column opens on row 16.

**CI:** `seedling-probe.yml` ×8 at this branch, `probes=probe-seedling-oneway-census.mjs`: **8/8 green, 80 checks / 0 failed** (10 per run, `ALL CHECKS PASSED`, `CHANNEL: headless logic-only`) at `2cb4ab8e22`: runs 40732057190, 40732062358, 40732067564, 40732071932, 40732076209, 40732081599, 40732085908, 40732090790.

## D4: the fix list

**No finding, so no fix is proposed.** For each candidate the user named or the census surfaced, here is what a fix
would cost and why it is not needed:

| candidate | least invasive fix, had it been a finding | why none is needed | predicted effect of doing nothing |
|---|---|---|---|
| L28 `fallrock@112,240` | — | the rock is the L28 grass lock's intended holder. A `remove` would **break** `L28 flag 0`'s "holds" effect: the lock would re-close behind every crossing, so `r1c18 <-> r11c4` would become TIGHTER than the rules. A `move` would move the holder off the button, the same break | none |
| L82 `fallrocklarge@128,224` | (i) a `move` would not help (the neck is 2 wide and the rock is 2 wide); (ii) a `remove` would keep the pocket's neck open | it seals only the pit pocket, which holds no location or door, and the pocket leaves by the lock + button (witnessed). L82's content (King of Fire, the L96 door) is also reached from L96 (`L37 r9c36 → L97 → L96 → L82`, the same weapon + Dark Suit cost) | none |
| L43 pocket rocks `@96,336` / `@192,336` | (ii) `remove` ×2 | inert in the AP delivery (witnessed); in the vanilla delivery they seal only orb pockets (`l43-fallrock-removed`'s header) | none |
| L12 `shieldlocknorm@288,704` (one-sided) | (iii) a rules event with `side: level_12__r0c19` | the east side is reached only through the lock from the west | none. Note: it becomes a real LOOSER the day any other door leads into `r43c21`/L34 (e.g. an entrance randomizer); see Residue |

Had a fix been proposed, the shared cost of any new set-patch row is the one ROCKMOVE D5 lists. The delivered set id
moves (`seedlingSetPatches.test.js`'s table + id pins, `fidelityMoonrock.test.js:49`). `moonrock-oracle.json` and
`descent-oracle.json` re-record on the game with `--record` and the full `--variants`. AP_1 regenerates
(provenance-only for a rock), and `fixtures/campaign-frontier.json` re-pins its md5.

## What the brief got wrong (measured)

1. **"L43's three wand fallrocks are left on purpose."** Only two are. The doorway rock `@176,384` (tag 3) is removed
   by `l43-fallrock-removed` (⚖ 2026-10-22, rules-l39), so the delivered L43 has two pocket rocks.
2. **L28 is an open candidate.** It is priced: the rules' `L28 flag 0` event already carries the rock's "holds"
   effect, and `probe-seedling-rope-events.mjs` witnesses it.
3. **L82 is "the same class as Bob's L32 rock".** It is not. Bob's rock fell on the room's stairs. L82's falls between
   the arena and a door-less pocket that has its own way out.

## Residue (named, not fixed)

- **Entrance randomization (`project_entrance_randomization`, Q1–Q5 open) would turn the one-sided openers into
  findings.** Every harmless one-sided row above (L12 / L20 shield locks; L56 / L66 boss locks; L82's pocket) rests on
  "the far side is reached only through it". A shuffled door into the far side breaks that. An entrance-rando slice
  should start from this table's `harmless (one-sided)` rows.
- ROCKMOVE's L28 row (*"no responder"*) is wrong in its evidence file (`seedling-fidelity-rockmove.md` D1, D5). It is
  left as is, since that is another slice's report.
- `FireWand.as:22`'s comment claims a tset-0 activation that its `removed()` does not perform. Harmless.

## Byte-inertia

No tracked file outside `CC/docs/cloud-reports/`, the probe, `boxLock.test.js` and the generated procgen index
(`instruments.js` and its `architecture.md` count block) changed: no `seedlingSetPatches.js`, rules, worlds, presets,
AS3, wasm or gitlinks. No `pytest` run, no unfiltered vitest. The dev server on 8228 is stopped by PID at the end.

## Appendix: every instance

`tset`/`tag`/`room` as the map stores them; the patched rows are listed at their vanilla position.

| level | entity | attrs | verdict | why |
|---|---|---|---|---|
| L0 | `breakablerock@192,32` | tag=3 | priced | G(hasSword|hasSpear) |
| L0 | `breakablerock@288,176` | tag=1 | priced | G(hasSword|hasSpear) |
| L0 | `moonrock@240,256` | tag=0 | patched | moonrock-removed |
| L0 | `breakablerock@80,112` | tag=4 | priced | G(hasSword|hasSpear) |
| L1 | `oracle@64,32` | tag=0 | harmless | dialogue; no reader |
| L3 | `breakablerock@96,112` | tag=0 | priced | G(hasSword|hasSpear) |
| L3 | `breakablerockghost@0,64` | tag=1 | priced | G(hasGhostSword) |
| L4 | `button@16,64` | tset=0 | harmless | momentary; the verdict is its responder row |
| L4 | `pushableblock@32,64` |  | harmless | no persistence |
| L5 | `button@48,48` | tset=0 | harmless | momentary; the verdict is its responder row |
| L5 | `lock@48,112` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L6 | `sandtrap@64,16` | tag=0 | harmless | opens nothing; not Solid |
| L6 | `sandtrap@64,48` | tag=1 | harmless | opens nothing; not Solid |
| L6 | `sandtrap@160,16` | tag=2 | harmless | opens nothing; not Solid |
| L6 | `sandtrap@160,48` | tag=3 | harmless | opens nothing; not Solid |
| L8 | `button@64,48` | tset=0 | harmless | momentary; the verdict is its responder row |
| L8 | `sandtrap@96,80` | tag=0 | harmless | opens nothing; not Solid |
| L8 | `sandtrap@96,128` | tag=1 | harmless | opens nothing; not Solid |
| L8 | `pushableblock@96,112` |  | harmless | no persistence |
| L8 | `pushableblock@112,48` |  | harmless | no persistence |
| L11 | `chest@32,48` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L12 | `bosslock@416,240` | keyType=0 tag=4 | priced | L12 flag 4: bosslock@416,240 cleared (sided: the key line south) |
| L12 | `bosslock@432,240` | keyType=0 tag=5 | priced | L12 flag 5: bosslock@432,240 cleared (sided: the key line south) |
| L12 | `burnabletree@480,640` | tag=2 | priced | G(hasFire) |
| L12 | `bosslock@80,656` | keyType=1 tag=3 | priced | L12 flag 3: bosslock@80,656 cleared (sided: the key line south) |
| L12 | `watcher@296,104` | tag=6 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L12 | `chest@320,816` | tag=9 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L12 | `shieldlocknorm@288,704` | tag=10 | harmless | touch from the WEST only; the east pocket (level_12__r43c21 + L34) is entered only through it from the west, which removes it for good (tset -2, tag 10) |
| L12 | `bosslock@112,192` | keyType=4 tag=11 | priced | L12 flag 11: bosslock@112,192 cleared (sided: the key line south) |
| L12 | `magicallock@32,864` | tag=7 | priced | G(hasWand|hasFireWand); removed on later entries once its tag clears |
| L12 | `bosslock@32,864` | keyType=4 tag=12 | priced | L12 flag 12: bosslock@32,864 cleared (sided: the key line south) |
| L15 | `pushableblock@64,64` |  | harmless | no persistence |
| L15 | `breakablerock@96,80` | tag=2 | priced | G(hasSword|hasSpear) |
| L15 | `breakablerock@96,16` | tag=3 | priced | G(hasSword|hasSpear) |
| L15 | `button@112,32` | tset=0 | harmless | momentary; the verdict is its responder row |
| L15 | `lock@128,48` | tset=0 tag=0 | harmless | held by its button (recloses on release): not one-way; CLEARTAG's activation-held class |
| L15 | `chest@144,96` | tag=1 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L16 | `breakablerock@112,80` | tag=5 | priced | G(hasSword|hasSpear) |
| L16 | `breakablerock@96,80` | tag=4 | priced | G(hasSword|hasSpear) |
| L16 | `breakablerock@96,64` | tag=3 | priced | G(hasSword|hasSpear) |
| L16 | `rope@32,16` | tset=0 tag=0 | priced | L16 flag 0: rope@32,16 cleared (disarms the t0 arrow traps) |
| L16 | `sandtrap@32,32` | tag=1 | harmless | opens nothing; not Solid |
| L16 | `sandtrap@48,32` | tag=2 | harmless | opens nothing; not Solid |
| L16 | `lock@320,112` | tset=1 tag=7 | harmless | held by its button (recloses on release): not one-way; CLEARTAG's activation-held class |
| L16 | `breakablerock@304,64` | tag=6 | priced | G(hasSword|hasSpear) |
| L16 | `button@272,48` | tset=1 | harmless | momentary; the verdict is its responder row |
| L16 | `pushableblock@256,80` |  | harmless | no persistence |
| L17 | `chest@128,16` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L18 | `lock@144,112` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L18 | `spinner@48,96` | tag=-1 | harmless | opens nothing; not Solid |
| L18 | `spinner@112,48` | tag=-1 | harmless | opens nothing; not Solid |
| L19 | `shieldboss@80,32` | tag=0 | priced | gated overlay row |
| L19 | `bosslock@48,32` | keyType=0 tag=1 | priced | L19 flag 1: bosslock@48,32 cleared (sided: the key line south) |
| L20 | `buttonroom@192,16` | tset=0 tag=4 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L20 | `shieldlocknorm@176,16` | tag=0 | harmless | touch from the WEST only, which is the main room; the east tile is the buttonroom@192,16 dead end (the Shield refutation) |
| L20 | `lock@32,80` | tset=0 tag=1 | harmless | held by its button (recloses on release): not one-way; CLEARTAG's activation-held class |
| L22 | `pushableblock@96,64` |  | harmless | no persistence |
| L24 | `burnabletree@32,128` | tag=0 | priced | G(hasFire) |
| L25 | `pushableblock@80,64` |  | harmless | no persistence |
| L25 | `chest@96,96` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L26 | `rocklock@112,208` | tset=-1 tag=0 | priced |  |
| L28 | `fallrock@112,240` | tset=1 tag=1 | priced | L28 flag 0: rope@160,64 cleared (action "opens" fallrock "holds"): it lands on button@112,240 and holds grasslock@176,208 open; the four spires around it leave a ring (no cut). Witness: probe-seedling-rope-events.mjs |
| L28 | `rope@160,64` | tset=1 tag=0 | priced | L28 flag 0: rope@160,64 cleared |
| L28 | `button@112,240` | tset=0 | harmless | momentary; the verdict is its responder row |
| L28 | `grasslock@176,208` | tset=0 tag=2 | priced | held open for good by the fallen rock on button@112,240: L28 flag 0 (rope, effect "holds") |
| L29 | `fallrock@112,112` | tset=0 tag=0 | patched | l29-fallrock-removed |
| L29 | `button@112,128` | tset=0 | patched | l29-button-removed |
| L30 | `bosslock@64,32` | keyType=1 tag=0 | priced | L30 flag 0: bosslock@64,32 cleared (sided: the key line south) |
| L30 | `breakablerock@48,224` | tag=1 | priced | G(hasSword|hasSpear) |
| L30 | `bosslock@224,208` | keyType=1 tag=2 | priced | L30 flag 2: bosslock@224,208 cleared (sided: the key line south) |
| L31 | `bosslock@192,432` | keyType=1 tag=0 | priced | L31 flag 0: bosslock@192,432 cleared (sided: the key line south) |
| L32 | `fallrocklarge@64,128` | tset=0 tag=1 bossrock=1 thirdboss=1 | patched | l32-bossrock-moved (to 88,128) |
| L32 | `burnabletree@64,0` | tag=0 | priced | G(hasFire) |
| L32 | `watcher@8,48` | tag=2 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L34 | `magicallock@128,0` | tag=0 | priced | G(hasWand|hasFireWand); removed on later entries once its tag clears |
| L36 | `chest@64,48` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L36 | `sandtrap@32,48` | tag=2 | harmless | opens nothing; not Solid |
| L36 | `sandtrap@64,64` | tag=3 | harmless | opens nothing; not Solid |
| L36 | `sandtrap@80,80` | tag=6 | harmless | opens nothing; not Solid |
| L36 | `sandtrap@48,80` | tag=4 | harmless | opens nothing; not Solid |
| L36 | `sandtrap@64,80` | tag=5 | harmless | opens nothing; not Solid |
| L37 | `burnabletree@128,192` | tag=1 | priced | G(hasFire) |
| L37 | `watcher@104,264` | tag=2 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L37 | `fallrock@288,32` | tset=0 tag=4 | patched | l37-fallrock-removed |
| L38 | `chest@144,112` | tag=1 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L38 | `cover@144,112` | tset=0 | harmless | held, not one-way |
| L38 | `buttonroom@208,224` | tset=1 tag=3 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L38 | `button@80,192` | tset=0 | harmless | momentary; the verdict is its responder row |
| L38 | `buttonroom@32,48` | tset=8 tag=4 flip=1 room=39 | priced | cross-level write {39,8}: L39 flag 8: wandlock@144,592 cleared |
| L38 | `pushableblockfire@80,208` |  | harmless | no persistence |
| L38 | `cover@208,224` | tset=2 | harmless | held, not one-way |
| L38 | `buttonroom@144,128` | tset=2 tag=0 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L38 | `buttonroom@144,288` | tset=4 tag=5 flip=1 room=37 | patched | cross-level write {37,4}: writes {37,4}, the removed L37 rock (l37-fallrock-removed): builds nothing |
| L39 | `button@144,112` | tset=4 | harmless | momentary; the verdict is its responder row |
| L39 | `button@112,144` | tset=3 | harmless | momentary; the verdict is its responder row |
| L39 | `button@176,144` | tset=5 | harmless | momentary; the verdict is its responder row |
| L39 | `button@144,128` | tset=1 | harmless | momentary; the verdict is its responder row |
| L39 | `button@128,144` | tset=0 | harmless | momentary; the verdict is its responder row |
| L39 | `button@160,144` | tset=2 | harmless | momentary; the verdict is its responder row |
| L39 | `wandlock@144,64` | tset=3 tag=0 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L39 | `wandlock@144,48` | tset=4 tag=1 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L39 | `wandlock@144,32` | tset=5 tag=2 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L39 | `cover@144,112` | tset=0 | harmless | held, not one-way |
| L39 | `cover@176,144` | tset=1 | harmless | held, not one-way |
| L39 | `cover@112,144` | tset=2 | harmless | held, not one-way |
| L39 | `pushableblockfire@144,176` |  | harmless | no persistence |
| L39 | `pushableblockfire@208,80` |  | harmless | no persistence |
| L39 | `spinner@112,88` | tag=3 | harmless | opens nothing; not Solid |
| L39 | `spinner@224,112` | tag=4 | harmless | opens nothing; not Solid |
| L39 | `spinner@224,208` | tag=6 | harmless | opens nothing; not Solid |
| L39 | `wandlock@48,160` | tset=1 tag=7 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L39 | `pushableblockfire@48,176` |  | harmless | no persistence |
| L39 | `wandlock@144,592` | tset=-1 tag=8 | priced | L39 flag 8: wandlock@144,592 cleared |
| L39 | `rope@96,384` | tset=6 tag=9 | priced | the shaft gate G(sword|spear|fire); its rock is patched (l39-fallrock-removed), its pulser is armed (rules-l39) |
| L39 | `fallrock@144,624` | tset=6 tag=10 | patched | l39-fallrock-removed |
| L40 | `burnabletree@872,784` | tag=0 | priced | G(hasFire) |
| L40 | `iceturret@472,400` |  | harmless | no persistence; rules price it wall |
| L40 | `spinner@192,144` | tag=18 | harmless | opens nothing; not Solid |
| L40 | `spinner@192,128` | tag=19 | harmless | opens nothing; not Solid |
| L40 | `buttonroom@160,128` | tset=1 tag=1 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L40 | `spinner@192,160` | tag=17 | harmless | opens nothing; not Solid |
| L40 | `buttonroom@272,208` | tset=0 tag=7 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L40 | `buttonroom@880,768` | tset=3 tag=12 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L40 | `wandlock@176,80` | tset=1 tag=2 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `wandlock@208,128` | tset=0 tag=4 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `wandlock@208,144` | tset=0 tag=5 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `wandlock@208,160` | tset=0 tag=6 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `wandlock@176,208` | tset=1 tag=3 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `wandlock@480,560` | tset=3 tag=11 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `chest@880,816` | tag=13 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L40 | `button@480,384` | tset=2 | harmless | momentary; the verdict is its responder row |
| L40 | `wandlock@448,432` | tset=2 tag=9 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `wandlock@512,480` | tset=2 tag=10 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `pushableblockfire@480,480` |  | harmless | no persistence |
| L40 | `button@816,400` | tset=4 | harmless | momentary; the verdict is its responder row |
| L40 | `pushableblockfire@576,576` |  | harmless | no persistence |
| L40 | `spinner@816,848` | tag=15 | harmless | opens nothing; not Solid |
| L40 | `spinner@880,848` | tag=16 | harmless | opens nothing; not Solid |
| L40 | `breakablerock@160,144` | tag=23 | priced | G(hasSword|hasSpear) |
| L40 | `breakablerock@176,128` | tag=22 | priced | G(hasSword|hasSpear) |
| L40 | `breakablerock@176,144` | tag=24 | priced | G(hasSword|hasSpear) |
| L40 | `pushableblock@576,560` |  | harmless | no persistence |
| L40 | `wandlock@800,400` | tset=5 tag=21 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L40 | `button@768,400` | tset=5 | harmless | momentary; the verdict is its responder row |
| L40 | `bosslock@480,352` | keyType=2 tag=8 | priced | L40 flag 8: bosslock@480,352 cleared (sided: the key line south) |
| L41 | `button@248,232` | tset=0 | harmless | momentary; the verdict is its responder row |
| L41 | `pushableblockfire@112,144` |  | harmless | no persistence |
| L41 | `cover@112,128` | tset=0 | harmless | held, not one-way |
| L41 | `crusher@240,64` | tset=-1 | harmless | no persistence; a visit-long block only |
| L41 | `breakablerock@224,64` | tag=1 | priced | G(hasSword|hasSpear) |
| L41 | `breakablerock@224,80` | tag=2 | priced | G(hasSword|hasSpear) |
| L41 | `button@176,176` | tset=1 | harmless | momentary; the verdict is its responder row |
| L41 | `wandlock@240,96` | tset=1 tag=0 | harmless | held by a button / cover puzzle (recloses): not one-way |
| L42 | `crusher@96,144` | tset=-1 | harmless | no persistence; a visit-long block only |
| L42 | `crusher@128,144` | tset=-1 | harmless | no persistence; a visit-long block only |
| L43 | `fallrock@96,336` | tset=0 tag=2 | inert-in-AP | dropped only by the vanilla Wand (tset 0); the AP delivery rewrites the Wand to an apitem. Witness: l43-ap-wand / l43-vanilla-wand |
| L43 | `fallrock@192,336` | tset=0 tag=1 | inert-in-AP | dropped only by the vanilla Wand (tset 0); the AP delivery rewrites the Wand to an apitem. Witness: l43-ap-wand / l43-vanilla-wand |
| L43 | `wand@144,224` | tag=0 | inert-in-AP | an apitem in the AP delivery (apPlacementRewriter), which has no Activators: witnessed l43-ap-wand |
| L43 | `bosstotem@152,168` | tag=5 | priced | gated overlay row (Wand + totem parts) |
| L43 | `fallrock@176,384` | tset=0 tag=3 | patched | l43-fallrock-removed |
| L43 | `magicallock@144,112` | tag=4 | priced | G(hasWand|hasFireWand); removed on later entries once its tag clears |
| L43 | `watcher@200,280` | tag=6 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L44 | `burnabletree@48,64` | tag=0 | priced | G(hasFire) |
| L46 | `chest@424,40` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L48 | `chest@152,184` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L48 | `karlore@112,272` | tag=-1 | priced | G(hasFire) overlay row |
| L48 | `bosslock@48,144` | keyType=3 tag=1 | priced | L48 flag 1: bosslock@48,144 cleared (sided: the key line south) |
| L53 | `lock@144,208` | tset=-1 tag=2 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L53 | `breakablerock@112,128` | tag=0 | priced | G(hasSword|hasSpear) |
| L53 | `breakablerock@128,160` | tag=1 | priced | G(hasSword|hasSpear) |
| L56 | `bosslock@96,16` | keyType=3 tag=0 | harmless | no event; the south key line faces the room's arrivals, and the far side is reached only through it |
| L57 | `tentaclebeast@80,48` | tag=0 | priced | encounter row |
| L57 | `watcher@48,32` | tag=1 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L58 | `yeti@56,56` | tag=0 | priced | L58 flag 1 |
| L58 | `teleporter@80,16` | tag=1 invert=0 | priced | L58 flag 1: yeti@56,56 (Yeti.as:46-48 writes tag 1) |
| L60 | `lock@128,80` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L61 | `buttonroom@176,40` | tset=1 tag=1 flip=1 room=63 | priced | cross-level write {63,1}: L63 flag 1: lightpole@64,88 cleared |
| L62 | `lightpole@120,200` | tset=-1 tag=0 invert=0 | priced | L62 flag 0: lightpole@120,200 cleared |
| L62 | `darktrap@112,208` | tag=1 | priced | dark-trap pole events |
| L63 | `pushableblockspear@112,96` |  | harmless | no persistence |
| L63 | `chest@224,80` | tag=5 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L63 | `darktrap@64,96` | tag=8 | priced | dark-trap pole events |
| L63 | `lightpole@64,88` | tset=-1 tag=1 invert=0 | priced | L63 flag 1: lightpole@64,88 cleared |
| L63 | `darktrap@80,64` | tag=2 | priced | dark-trap pole events |
| L63 | `darktrap@32,272` | tag=3 | priced | dark-trap pole events |
| L63 | `darktrap@128,272` | tag=4 | priced | dark-trap pole events |
| L63 | `lightpole@48,272` | tset=-1 tag=6 invert=0 | priced | L63 flag 6: lightpole@48,272 cleared |
| L63 | `lightpole@112,272` | tset=-1 tag=7 invert=0 | priced | L63 flag 7: lightpole@112,272 cleared |
| L63 | `buttonroom@32,64` | tset=0 tag=0 flip=1 room=62 | priced | cross-level write {62,0}: L62 flag 0: lightpole@120,200 cleared |
| L65 | `lightpole@128,168` | tset=-1 tag=0 invert=0 | priced | L65 flag 0: lightpole@128,168 cleared |
| L65 | `darktrap@144,144` | tag=1 | priced | dark-trap pole events |
| L65 | `pushableblockspear@176,128` |  | harmless | no persistence |
| L65 | `lightpole@176,120` | tset=-1 tag=2 invert=0 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L66 | `bosslock@72,64` | keyType=4 tag=0 | harmless | no event; the south key line faces the room's arrivals, and the far side is reached only through it |
| L66 | `lightpole@96,80` | tset=-1 tag=2 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L66 | `lightpole@48,80` | tset=-1 tag=3 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L67 | `pushableblockspear@144,112` |  | harmless | no persistence |
| L67 | `button@96,112` | tset=0 | harmless | momentary; the verdict is its responder row |
| L67 | `lightpole@160,104` | tset=-1 tag=1 invert=0 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L68 | `bosslock@16,32` | keyType=4 tag=0 | priced | L68 flag 0: bosslock@16,32 cleared (sided: the key line south) |
| L68 | `magicallock@16,32` | tag=1 | priced | G(hasWand|hasFireWand); removed on later entries once its tag clears |
| L69 | `watcher@144,144` | tag=1 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L69 | `lightbosscontroller@72,72` | tag=0 | priced | encounter row |
| L70 | `lightpole@32,16` | tset=-1 tag=0 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L71 | `lock@112,192` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L71 | `chest@160,256` | tag=1 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L71 | `shieldlock@288,256` | tag=2 | priced | L71 flag 2: shieldlock@288,256 cleared (sided) |
| L71 | `button@112,176` | tset=0 | harmless | momentary; the verdict is its responder row |
| L71 | `lock@112,160` | tset=0 tag=3 | harmless | held by its button (recloses on release): not one-way; CLEARTAG's activation-held class |
| L73 | `breakablerock@64,48` | tag=0 | priced | G(hasSword|hasSpear) |
| L74 | `lightpole@48,24` | tset=-1 tag=1 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L74 | `button@288,128` | tset=0 | patched | l74-button-removed |
| L74 | `fallrock@288,144` | tset=0 tag=2 | patched | l74-fallrock-removed |
| L78 | `lock@32,32` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L80 | `chest@16,128` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L82 | `lavaboss@112,48` | tag=0 | priced | encounter / boss report row |
| L82 | `fallrocklarge@128,224` | tset=0 tag=1 bossrock=1 thirdboss=0 | harmless | falls behind a player who climbs out of the L71 pit pocket, or at once on entry from L96; it seals only the pocket (no location, no door), whose second way out is lock@192,224 held by button@192,240. Witness: l82-* |
| L82 | `watcher@72,96` | tag=2 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L82 | `lock@192,224` | tset=1 tag=3 | harmless | held by button@192,240 directly under it: the L82 pocket's second exit (witness l82-pocket-lock) |
| L82 | `button@192,240` | tset=1 | harmless | momentary; the verdict is its responder row |
| L86 | `chest@48,16` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L89 | `watcher@248,176` | tag=1 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L90 | `chest@48,32` | tag=0 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L92 | `spinner@224,64` | tag=-1 | harmless | opens nothing; not Solid |
| L92 | `breakablerock@176,48` | tag=-1 | priced | G(hasSword|hasSpear) |
| L92 | `breakablerock@256,112` | tag=-1 | priced | G(hasSword|hasSpear) |
| L93 | `lightpole@80,144` | tset=-1 tag=0 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L93 | `lightpole@144,144` | tset=-1 tag=1 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L94 | `watcher@152,128` | tag=0 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L98 | `iceturret@104,24` |  | harmless | no persistence; rules price it wall |
| L98 | `lock@112,112` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L98 | `chest@160,32` | tag=1 | harmless | opens, never closes; a location chest is an apitem in the AP delivery (not Solid) |
| L99 | `lock@80,96` | tset=-1 tag=0 | priced | room-clear lock; check() removes it once cleared (persistent opener) |
| L100 | `breakablerock@128,144` | tag=0 | priced | G(hasSword|hasSpear) |
| L101 | `lightpole@144,64` | tset=-1 tag=0 invert=0 | priced | L101 flag 0: lightpole@144,64 cleared |
| L101 | `darktrap@160,80` | tag=1 | priced | dark-trap pole events |
| L101 | `breakablerockghost@224,96` | tag=2 | priced | G(hasGhostSword) |
| L101 | `magicallockfire@96,48` | tag=3 | priced | G(hasFireWand) |
| L101 | `magicallockfire@112,48` | tag=4 | priced | G(hasFireWand) |
| L102 | `lightpole@80,104` | tset=-1 tag=0 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L102 | `lightpole@144,104` | tset=-1 tag=1 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L103 | `watcher@120,24` | tag=0 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
| L106 | `lightpole@32,56` | tset=-1 tag=1 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L106 | `lightpole@96,56` | tset=-1 tag=2 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L107 | `crusher@32,0` | tset=-1 | harmless | no persistence; a visit-long block only |
| L107 | `buttonroom@288,176` | tset=0 tag=1 flip=0 room=-1 | priced | same-room latch: opens its group for good (puzzle policy prices the press free; L20 refuted to cost the Shield) |
| L107 | `pushableblockfire@64,32` |  | harmless | no persistence |
| L109 | `lightpole@128,56` | tset=-1 tag=1 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L109 | `lightpole@192,56` | tset=-1 tag=2 invert=1 | harmless | no darktrap reads it in its level; lighting only (fidelity W34 LIGHTPOLE owns light fidelity) |
| L110 | `cover@48,48` | tset=0 | harmless | held, not one-way |
| L110 | `cover@80,48` | tset=0 | harmless | held, not one-way |
| L110 | `cover@80,64` | tset=0 | harmless | held, not one-way |
| L110 | `cover@48,32` | tset=0 | harmless | held, not one-way |
| L110 | `cover@48,16` | tset=0 | harmless | held, not one-way |
| L110 | `cover@64,16` | tset=0 | harmless | held, not one-way |
| L110 | `cover@80,16` | tset=0 | harmless | held, not one-way |
| L110 | `cover@96,16` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,16` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,32` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,48` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,64` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,80` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,96` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,112` | tset=0 | harmless | held, not one-way |
| L110 | `cover@112,128` | tset=0 | harmless | held, not one-way |
| L110 | `cover@96,128` | tset=0 | harmless | held, not one-way |
| L110 | `cover@48,64` | tset=0 | harmless | held, not one-way |
| L112 | `finalboss@64,96` | tag=0 | priced | encounter row; opens rocklock@112,16 = L112 flag 1 |
| L112 | `rocklock@112,16` | tset=0 tag=1 | priced | L112 flag 1: rocklock@112,16 cleared |
| L113 | `finaldoor@112,0` | tag=0 | priced | L113 flag 0: finaldoor@112,0 cleared |
| L114 | `watcher@72,72` | tag=0 | harmless | no other entity in its level reads its tag (no shared tags in any level); invisible, not Solid |
