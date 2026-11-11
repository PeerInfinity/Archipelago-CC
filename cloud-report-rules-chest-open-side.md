# Cloud report: rules-chest-open-side

**STOPPED before writing any rule.** No rule, atlas, AP_1, maze, `seedling_er`, frontier, pin or derived-table file
changed. Two reasons, either one enough:

1. **The brief's stop fired: a chest-as-Solid rule moves rules in four rooms, not one** (L11, L25, L38, L80).
2. **The premise does not hold on the game the rules describe.** The randomizer's delivered set carries an `<apitem>`
   in place of every one of the 16 chests. An `APItem` is not a Solid and is taken on overlap from any side. Witnessed
   on the game: from L22's landing the player walks into L25's chest cell, takes the item and leaves by L28's door.
   AP_1's `Level 025 - Chest: True` and `level_25 -> level_28__r0c6: True` are right for that game. The earlier
   `--chest` witness ran on the vanilla set (`vanillaRecordSet(...)`, where the chest is still a `Chest`).

Base: `git rev-parse origin/main` = `4bbf15fea9602d10ad51ea239e93d87dba3f52c8`.

## Decision for Robert

Is the chest rule wanted at all? It describes the vanilla set only. Under the randomizer's delivery no chest is a
Solid, so the rule would make the logic stricter than the game in L11, L25, L38 and L80 and buy nothing. My
recommendation: drop it, and keep the census and the `--through` witness as the record of why.

If it is wanted anyway (for a vanilla-set mode), it needs a ruling on the four rooms below first.

## The source

`vendor/seedling/src/Chest.as` (pin `ccdf189`):

```
29   type = "Solid";
30   setHitbox(16, 16, 8, 8);
35   checkBySeal();                                   // constructor
41   if (tag >= 0 && !Game.checkPersistence(tag))     // check(): an opened chest is gone on the next entry
43       FP.world.remove(this);
49   if (SealController.hasAllSealParts())            // checkBySeal(), from the constructor and every update
53           Game.setPersistence(tag, false);
55       FP.world.remove(this);
61   checkBySeal();
63   if (!collide("Solid", x, y) && FP.world.collideLine("Player", x - originX + m, y - originY + height + 1,
                                                      x - originX + width - 2 * m, y - originY + height + 1))
65       open();
77   type = "";                                       // open(): the passage
89   Game.setPersistence(tag, false);
```

`SealController.as:85-87`: `hasAllSealParts()` is `Main.hasSealPart(SEALS - 1) != -1`.

So in the vanilla set a chest is a Solid, opens only for a player on the one-pixel line under its bottom edge (and
only while no other Solid, such as a `Cover`, overlaps it), is gone for good once opened, and every chest is removed
once the last seal slot is filled.

How the rules read chests today:

- `seedlingSemantics.js:417`: `chest: M('Chest is solid until opened (no item requirement, but an interaction)')`.
- `seedlingPlaythroughOverlay.js:751-753`: `chest: OPEN('Chest.as:62-104', 'a Chest is a Solid until opened, and
  opening it needs no item ... Choreography.')`. The chest's cell is floor in the analyzer grid.
- `make-seedling-playthrough-rules.mjs` has no chest rule of its own (its only `chest` mentions are the boss filler
  note).

What the delivery does (`apChestDelivery.js:5-11`, `seedlingRandomizerWiring.js:966-992`,
`apPlacementRewriter.rewriteRecordSet`): the delivered set is `rewriteRecordSet(vanillaRecordSet(mapDoc), table)`;
every rewritable ledger row's entity becomes `{type: 'apitem', x, y, attrs: {tag, look}}`, for a chest with its
vanilla tag. On the game that builds `Pickups/APItem` (`Game.as:2330`): no `type`, an 8x8 box at the cell's centre,
taken on overlap (`Pickup.as:78`), never through `Chest.update`.

## The census

`node scripts/procgen/census-seedling-chest-open-side.mjs` (new; node only). Per chest: the open side from the model
(free player positions on the probe line, the chest shut), then the room analysed with the producer's own grid and
analyzer options twice, as today and with the chest's tiles walled.

| level | chest | open side | as a vanilla Solid | delivered as |
|---|---|---|---|---|
| L11 | (2,3) | (2,4) | **FIRES**: splits the one sub-region; L3's door (both ways) is cut off from the open side | apitem |
| L12 | (20,51) | (20,52) | no change | apitem |
| L15 | (9,6) | (9,7) | no change | apitem |
| L17 | (8,1) | (8,2) | no change | apitem |
| L25 | (6,6) | (6,7) | **FIRES**: splits the one sub-region; L22's and L26's doors (both ways) are cut off | apitem |
| L36 | (4,3) | (4,4) | no change | apitem |
| L38 | (9,7), under a cover | (9,8) | **FIRES**: splits `r0c9`; L39's door (both ways) is cut off | apitem |
| L40 | (55,51) | (55,52) | no change | apitem |
| L46 | off-grid, 4 tiles | (26,3) (27,3) | no change (the model's flood from the open side reaches all of its sub-region) | apitem |
| L48 | off-grid, 4 tiles | (9,12) (10,12) | no change (the chest is alone in its sub-region; weak, tile-level) | apitem |
| L63 | (14,5) | (14,6), a Dark Suit cell | no change (the only way to it is the open side's cell) | apitem |
| L71 | (10,16) | (10,17) | no change | apitem |
| L80 | (1,8) | (1,9), a Dark Suit cell | **FIRES**: also reached today from the left cell, which would not open it (same Dark Suit price) | apitem |
| L86 | (3,1) | (3,2) | no change | apitem |
| L90 | (3,2) | (3,3) | no change | apitem |
| L98 | (10,2) | (10,3) | no change | apitem |

Totals: 16 chests; 4 fire as a vanilla Solid; 16 of 16 are ledger rows and are delivered as an apitem.

What each fired room would gate, and whether the vanilla route uses it:

- **L11** (doors: L3 at (2,0), stairs to L10 at (2,5)). The chest sits mid-corridor. A player from L3 lands at (2,1),
  above it, and could neither take `Level 011 - Chest` nor reach the stairs to L10. A player from L10 lands at (2,4),
  under it. The vanilla route arrives from L10, opens it and leaves to L3.
- **L25**: as the brief says. From L22 (lands (8,2)) or L26 (lands (1,6)) neither the chest nor L28's door; from
  L28 (lands (6,7)) all of it.
- **L38** (doors: L39 at (9,0), L37 at (9,19)). The chest is the one-cell join of the room's two halves, under a
  cover. From L39 (lands (9,1)) neither the chest nor the L37 half; from L37 (lands (9,18)) the open side.
  `seedlingDemo/chest.js` already documents this join for the vanilla route (from L37, upward).
- **L80**: the chest is alone in a pocket with a Dark Suit cell to its left and one below. Only the one below opens
  it. Both cost the Dark Suit, so the price would probably not move, only the cell it is charged on.

I did not write the rule, so there is no `--blocks` list and no seed-1 sphere diff to show.

Census limits: it is tile-level (an off-grid chest walls every tile it touches, so L46 and L48 take the model's flood
or a note instead); it does not ask whether a `Cover` over the chest can be opened from the open side's part.

## The witness, on the game

`node scripts/procgen/probe-seedling-l25-apitem.mjs --through` (new arm; page `seedling_bot_ap_p4g`, box lock taken,
dev server `scripts/serve-nocache.py 8000`). Boot: the committed step-34 tape's (L25 at L22's landing, Sword and
Shield, 5 seal parts). Keys: a waypoint walk on the model, (7,2) -> (7,6) -> (6,6) -> (6,8), 161 ticks. The same keys
on both sets:

| set | the game |
|---|---|
| delivered `seedling-ap-record-01b432a9` | levels `[25, 28]`, `{25,0}` cleared, ends in L28 at (104, 24), 0 hits |
| vanilla `seedling-vanilla-record-5aeefc3c` (control) | stays in L25, `{25,0}` still set, stopped at (116.9, 109.0) east of the chest, 0 hits |

4 checks, `ALL CHECKS PASSED`. The probe's existing four arms (committed oracle, `fidelityL25ApItem.test.js`) already
hold that the delivered apitem is taken from the north-east without standing under it.

**Not witnessed** (moot under the delivery, so I did not spend game runs on them): the all-seal-parts removal, and
the vanilla corridor staying open on a later entry from L22's side.

## What changed on the branch

- `scripts/procgen/census-seedling-chest-open-side.mjs` (new) and `seedlingChestOpenSideCensus.test.js` (new): the
  test holds that every chest is a ledger row delivered as an apitem, and that the Solid reading separates more than
  one room.
- `scripts/procgen/probe-seedling-l25-apitem.mjs`: the `--through` arm. The default four arms and `--record` are
  untouched.
- `frontend/modules/procgenDocs/generated/instruments.js`: regenerated for the new script and flag.

## Gates

- **Census**: output above (full text reproducible with the command).
- **Witness**: `--through`, 4 of 4 pass.
- **Bounded vitest**, 12 files, 199 tests, all pass: `seedlingChestOpenSideCensus.test.js`, `boxLock.test.js`,
  `checkProcgenHelp.test.js`, `lintGateLabels.test.js`, the no-tracked-pointers guard, `fidelityL25ApItem.test.js`,
  `fidelityBobIframe.test.js` (both import the probe's module), `seedlingErDoorCensus.test.js`,
  `seedlingConstantsCensus.test.js`, `flashPanel/seedlingObstacleEvents.test.js`,
  `seedlingPlaythroughObstacleEvents.test.js`.
- **`census-seedling-constants.mjs --write`**: 0 file change.
- **`generate-procgen-reference.mjs`** then `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- **`check-procgen-help.mjs --only=`** for the census and for the probe: `ALL PASS` each.
- No submodule pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling` or `.github/` was touched.

**Not run**, because nothing they read changed: the producers and their `--check`s, `Generate.py`, the maze,
`seedling_er`, the frontier, the atlas/AP_1 reader tests, the derived-table freshness tests. Also not run: the slow,
train and calib tiers, `npm test` browser batches, the unfiltered vitest.

The bootstrap printed `pip headless: FAILED`; it reached `READY` and nothing here needed it.
