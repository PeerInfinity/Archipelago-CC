# rules-boss-host (R4b part 2): game witnesses on p4g

The driver is `drivers/witness.mjs`. It runs each arm on a fresh headless page (`seedling_bot_ap_p4g`, and one
`seedling_bot_ap_p4d` control) through `botLoadTape` and `botStart`, then plays to the latch. Each arm's
`pendingCheck` reports go, in order, to the real `SeedlingCheckBinding` over the real table
(`buildPlacementTable(bossReport: true)`, seedling_playthrough AP_1).

The driver mirrors the engine's arming window: the tape's declarations. The reconcile reads the arm's FINAL
`persistence_cleared`, so a check can show as `(reconcile)` earlier than the live host would credit it. The count
per location is still exact.

- `witnesses.json`: the full run, 17 arms.
- `witnesses-totem-guard.json`: the four L43 arms, including the R4 AS3 guard with the Wand already collected.

| Arm | Build | Measured |
|---|---|---|
| bob-nofire (`r5-bobboss-fire`) | p4g | (32,3) Times and (32,4) Fire each reported once and checked once; `hasFire` false at the end (the game grants nothing) |
| bob-serverfire (+ `fire` granted) | p4g | Bob is still fought with Fire held: (32,3) cleared, (32,4) cleared |
| l32-reentry-killed ({32,1},{32,3} declared) | p4g | `Pickups::Fire` in the room, no BobBoss; the declarations are not credited |
| l32-reentry-collected (+{32,4}) | p4g | neither Fire nor BobBoss |
| l32-leave-stairs-nofire (hold `down` 400 ticks) | p4g | still level 32: the fallen rock seals the stairs |
| l32-leave-pit-nofire (`enc-l32-fire-return` path, no Fire, tree standing) | p4g | still level 32: the tree does not burn |
| witch (`enc-l12-witch`) | p4g | (12,1) reported once, checked once; `hasDarkSword` false |
| owl (`r6-owl-kill`) | p4g | only (112,1) reported live; `persistence_cleared` holds (112,0) and (112,1); the reconcile checks the Owl once |
| shieldspire (`r6-shield-kill`) | p4g | (19,0) once |
| totem-all-parts (`r6-totem-kill`, 5 parts) | p4g | (43,0) Wand, then (43,5) Totem of Lacste, each once |
| totem-four-parts (vanilla Wand present) | p4g | no clear; the vanilla Wand is inert without the parts |
| totem-wand-gone-5-parts ({43,0} declared, wand granted) | p4g | the fight ACTIVATES: the player ends exactly at `BossTotem.playerPosSet` (144,352), status (152,360) |
| totem-wand-gone-4-parts | p4g | NO activation: the player is where the walk left it (131.5,349). This is the R4 AS3 guard alone |
| door-N16-seals16 / -seals15 | p4g | the host fills `sealLogSlots(c, 16)` = 16 / 15 slots: (113,0) cleared / not |
| door-N8-seals8 / -seals7 | p4g | `sealLogSlots(c, 8)` = 16 / 7 slots: (113,0) cleared / not |
| p4d-bob-control | p4d | `hasFire` TRUE (the game grants it); no (32,3) or (32,4); the old `32|-1` quirk report. This is why p4d refuses the nine rows |

Not witnessed (no fight tape exists, and there is no kill API in the bridge): Tentacled Beast (57,0), Lights
(69,0), King of Fire (82,0). Their AS3 is unchanged by R4. Each clears its own OEL tag on the kill, through the same
`setPersistence` choke point witnessed above.
