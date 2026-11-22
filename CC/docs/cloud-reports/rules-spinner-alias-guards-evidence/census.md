max non-negative tag on any map entity: 24; rules events: 41; max event tag: 12; unclassified types: none

| level | entity | tag | alias slot | writes? | slot owned in target level | rules event on slot |
|---|---|---|---|---|---|---|
| L18 | `spinner@48,96` | tag="-1" | {17,29} | YES | none | none |
| L18 | `spinner@112,48` | tag="-1" | {17,29} | YES | none | none |
| L48 | `karlore@112,272` | tag="-1" | {47,29} | no | none | none |
| L92 | `spinner@224,64` | tag="-1" | {91,29} | YES | none | none |
| L92 | `breakablerock@176,48` | tag="-1" | {91,29} | YES | none | none |
| L92 | `breakablerock@256,112` | tag="-1" | {91,29} | YES | none | none |
| 100 levels | `teleporter` x227 | -1 | {N-1,29} | no | 0 owned | 0 events |
| 5 levels | `bosskey` x5 | -1 | {N-1,29} | no | 0 owned | 0 events |
| 4 levels | `totempart` x5 | -1 | {N-1,29} | no | 0 owned | 0 events |
| 1 levels | `seed` x1 | -1 | {N-1,29} | no | 0 owned | 0 events |

WRITER classification (source):
- `spinner`: WRITES — Enemies/Spinner.as:47-64: check() guards tag>=0, removed() writes setPersistence(tag) under doActions
- `breakablerock`: WRITES — Puzzlements/BreakableRock.as:68-72: endAnim() writes setPersistence(tag) with no guard
- `karlore`: no write — NPCs/Karlore.as:17 -> NPC.as:122 reads checkPersistence only under tag>=0; NPC/Karlore never write
- `teleporter`: no write — Teleporter.as:79-82 removeSelf() writes, but nothing calls Teleporter.removeSelf; :86 read guarded tag>=0
- `bosskey`: no write — Pickups/BossKey.as:68 `if (tag >= 0) setPersistence`
- `totempart`: no write — Pickups/BossTotemPart.as:51 `if (tag >= 0) setPersistence`
- `seed`: no write — Pickups/Seed.as:109 `if (tag >= 0) setPersistence`
