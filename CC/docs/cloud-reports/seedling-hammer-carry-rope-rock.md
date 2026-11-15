# seedling-hammer-carry-rope-rock — `--carry-route-flags` stages a rope's rock tag with its flag

Planner: `seedling-hammer-phase-planning-6`. Approved 2026-11-12 (the hammer replan, "Carry-flags rope rock"). Cloud, Opus.

## 1. SHAs

- Start (base): `fe98f37f2207594e648cefb90f007a16e453c0eb` (origin/main)
- Code commit: `f6479ef72b`; the head is this report's own commit (follows it)
- Branch: `claude/seedling-carry-rope-rock-fcfpdp`

## 2. The answer

- **Switch:** `SEEDLING_CARRY_ROPE_ROCK=1`, OFF by default. The wrapper is `withCarryRopeRock(enabled, fn)` and the reader is
  `carryRopeRockOn()`, both in `scripts/procgen/seedling-divergence-legs.mjs`. **It runs on the node thread only**: the leg
  list builder is a node script, and no page or worker module reads it. It is **not** in `SOLVER_ENV_NAMES`
  (see §8).
- **Result:** with the switch ON, the seed-1 L28 carry leg (`level_28__r1c18 <- in_L30_0_128 -> exit:out_teleporter_304_16`)
  stages `flag:L28:0 + flag:L28:1`. Its node replay goes from **refused** ("…boots PULLED… Declare both tags or neither")
  to **solved**: 7 ticks, `walk`, end at L30 (24,136), 0 deaths. No other leg's bytes move.
- **The one thing to know first:** the change only touches the `--carry-route-flags` arm. On seed 1 it moves exactly
  **1 of 936** legs. OFF, every list (with or without carry) is byte-identical, and so is the acceptance md5.

## 3. The reproduction (measured, base `fe98f37f22`)

```
node scripts/procgen/seedling-divergence-legs.mjs --out=legs-carry.jsonl --carry-route-flags   # 936 legs, 85 carried
grep -a 'level_28__r1c18 <- in_L30_0_128 -> exit:out_teleporter_304_16' legs-carry.jsonl > leg28.jsonl
echo '{"entries":[],"events":[],"refused":[]}' > dump-min.json      # an exit goal reads no dump entry
node scripts/procgen/seedling-divergence-bare.mjs --legs=leg28.jsonl --dump=dump-min.json --out=bare28.jsonl
```
- Leg id 301 at this SHA. Without carry it has no `stagedEvents`. With carry: `stagedEvents = carriedFlags = [flag:L28:0]`.
- Outcome `refused`, refusalKind `refusal`, 50 ms. The message: `levelRun: rope@160,64 in level 28 boots PULLED (its tag
  0 is cleared), so RopeStart.check() re-publishes group 1 on the first frame — and fallrock@112,240 (tag undefined) is
  in that group and has NOT fallen … Declare both tags or neither.` The thrower is `levelRun.publishRopeGroup` with
  `atBuild` (`levelRun.js:1779`). The "tag undefined" in that text is a cosmetic slip in the message (`rock.persistTag`
  is read off the run's rock state, which spells it `tag`). This slice leaves `levelRun.js` alone.
- Mutant (`--no-stage-events`): solved, 7 ticks. The rope is then uncut, and the rock is parked and passable.
- Hand fix, `flag:L28:1` appended: solved, 7 ticks, end L30. This confirmed the premise before any code changed.
- `createRunForStaging` alone does NOT throw with the rope flag only. The refusal fires when the arrival request is built.

## 4. Design + change; OFF identity

The fix is in the STAGING (`seedling-divergence-legs.mjs`). `levelRun` is untouched. I added three functions and one call site:

- `ropeRockPairs(levels, readers)` is pure. It maps each rope's flag to the flags of the rocks its pull drops. A
  `RopeStart` (`ENTITY_CLASSES[type].as3`) publishes its `tset` group (`activators.ropePublish`). Every
  `FallRock`/`FallRockLarge` of the same level with that `tset` falls and writes its own tag (`fallRock.dropRock`). This is
  the same set `publishRopeGroup` walks (`rock.t === pub.group`).
- `atlasRopeRockPairs(M, mapPath)` runs that over `seedling-map.json` with the run's own readers. Those are `tSetOf`, `tagOf`
  and `outOfBandFlagFor`; a rope with tag < 0 goes through `outOfBandFlagForWriter`, as `pullRope` does, and a rock with
  tag < 0 writes nothing, as `dropRock` does.
- `withRopeRockCarry(leg, pairs)` acts on each CARRIED rope flag. It appends the rock flags that `stagedEvents` does not
  already hold, and stamps them in `carriedFlags` with `ropeRock: <rope id>`. A leg with no carried rope flag comes back as
  the same object.
- The call site is in `emitLeg`, after `withRouteCarry`, and runs only when `--carry-route-flags` and the switch are both
  on. When the switch is OFF, the levelWorld/ledger modules are not even imported.
- There are no level ids, coordinates or Seedling constants in the logic. The rows use L28 as a witness only.
- The rock builds fallen because `CONTACT_FIDELITY.fallRockPostFall` (on since the wave-14 flip) builds a cleared
  non-arena `FallRock` with `postFall`. Without it, the staged rock tag would hit the build's arm refusal instead.

**Is this a request change, and so switch-guarded?** Yes. ON, the L28 carry leg's staging, and so its request
`persistence`, gains `{28,1}`. That is why it is guarded.

**OFF identity (measured):**
- Acceptance md5: `391322d681b7aa0229d94b3f6906d024` at base `fe98f37f22`, and the same `391322d681b7aa0229d94b3f6906d024`
  at the code commit `f6479ef72b`.
- Leg list, no carry: `98717fff34d0a9f361a12dc587ca73ac` on the base, the head and the head with the switch ON. All three
  are identical, because the switch never touches a list built without carry.
- Leg list, `--carry-route-flags`: `0564732accb8249d923a1ad45a0a8963` on the base and on the head with the switch OFF.
  With the switch ON it is `2bebfe339745e667b29dfa516dba471d`.

## 5. Rows + bounded vitest

New file `scripts/procgen/seedlingDivergenceRopeRock.test.js`, 12 rows:
- `ropeRockPairs` on synthetic levels:
  - pairs by `tset` within a level only; a non-rock member and a tag-less rock are excluded;
  - a rope that drops nothing is absent;
  - **mutant**: pairing by tag instead of group would name the wrong rock.
- **Ropes census** over the atlas: 3 ropes (L16 `rope@32,16`, L28 `rope@160,64`, L39 `rope@96,384`). Two pairs:
  `28:0 → fallrock@112,240 flag:L28:1` and `39:9 → fallrock@144,624 flag:L39:10`. L16's rope drops nothing (its group 0
  holds 3 arrow traps).
- **Node build:** `buildLevelWorld(L28, {cleared:[0,1]})` gives the rope `bootPulled` (ropeT 1, ropeTag 0) and the rock
  `postFall` (t 1, persistTag 1).
- `withRopeRockCarry`:
  - adds and stamps the rock;
  - returns the leg UNCHANGED (the same object) when there is no carry, when the carry holds no rope, or when the rock is
    already staged;
  - the switch is OFF by default and `withCarryRopeRock` restores it.
- **Integration** (runs the legs script for `seedling_playthrough`):
  - the switch leaves a no-carry list byte-identical;
  - with carry, exactly one leg moves (the L28 key), by exactly `flag:L28:1` appended;
  - the no-carry list stages no rope flag whose pull drops a rock, so a level without a paired rope stages byte-identically;
  - the node bare replay of the L28 carry leg is OFF `refused` (`boots PULLED`) and ON `solved`, end level 30, 0 deaths.

Bounded runs:
- `npx vitest run scripts/procgen/seedlingDivergenceRopeRock.test.js scripts/procgen/seedlingDivergenceRouteCarry.test.js
  scripts/procgen/seedlingDivergenceLegs.test.js scripts/procgen/seedlingDivergenceSweep.test.js`: **4 files, 101 passed**
  (12 + 19 + 32 + 38), 4.9 s.
- Regenerators:
  - `census-seedling-solver-surface.mjs --write`: 372 rows, no diff; `--check` GREEN.
  - `generate-procgen-reference.mjs`: no diff; `--check` all match.
  - `generate-docs-index.mjs`: no diff; `--check` OK.
  - `check-procgen-help.mjs`: ALL PASS.
- No docs under `docs/json/developer/procgen/` were edited, so the procgenDocs pins are not owed.

## 6. Page play / game witness

None run. The brief did not ask for a page sweep, and the node replay is the defect it named.

The game-side claim rests on code that was already in the repo:
- `levelRun`'s refusal text, which says the game's pull writes the rock's tag on the same frame as the rope's;
- the fallRockPostFall witness `l74leg624-postfall-reentry`, a game boot with a fallen rock's tag staged.

The page sweep would write `{28,1}` with `Game.setPersistence` next to `{28,0}`. The FallRock ctor then builds it fallen
(`FallRock.as:42-47`), which is the state a real pull leaves.

## 7. Census — which seed-1 divergence-sweep legs the change can move

The request diff of `--carry-route-flags`, switch OFF vs ON, over all 936 legs: **1 changed**, by key:
- `level_28__r1c18 <- in_L30_0_128 -> exit:out_teleporter_304_16`: `+flag:L28:1` (ropeRock `rope@160,64`)

Why only that leg:
- Only two ropes drop a rock. Their rope flags are `flag:L28:0` and `{39,9}`.
- `flag:L39:9` is not an AP `game_state` event: the rules have L39 flag 8, the wandlock, not 9. So no leg ever carries it.
- `flag:L28:0` is carried by that one leg only.
- The rock tags (`{28,1}`, `{39,10}`) are not AP flags either.
- The only rope flag staged naturally (arrival or goal staging, no carry) is `flag:L16:0`, on 24 legs. L16's rope drops
  no rock.

## 8. What the brief got wrong (measured)

- **"a new name in `solverEnvChannel`'s `SOLVER_ENV_NAMES`".** This cannot apply here. `solverEnvChannel.test.js` holds
  that table EQUAL to the `process.env.SEEDLING_*` names read in the solve worker's static import closure. The staging
  lives in a node script outside that closure, so adding the name there would fail that pin. The switch follows the same
  shape instead (a `SEEDLING_*` env name, OFF, plus a `with…` wrapper), in the script that reads it.
- **"a NODE levelRun build of that staging throws".** It does, but only at the arrival request (`publishRopeGroup` at
  build, inside the produce service). The bare pass reports it as a `refused` row, kind `refusal`, not as a crash.
  `createRunForStaging` alone builds without throwing.
- **"the PAGE sweep reads the leg done".** Not measured here (no page run). Everything else in the premise held: the rock
  tag is `{28,1}`, the pairing is in the level data (the rope's `tset` group equals the rock's), and it is generic.

## 9. Residue / hand-overs

- **CI plumbing:** `seedling-divergence-sweep.yml` does not pass `SEEDLING_CARRY_ROPE_ROCK` to the leg-list step. A CI
  sweep with the switch ON needs that one env line, or a flip of the default. That is the planner's call at landing.
- **Natural staging:** a non-carried staging (arrival or goal event) of a rope flag whose pull drops a rock would hit the
  same refusal. None exist on seed 1 (only L16's rope, which has no rock). A row pins that list to empty, so it fails by
  name if one appears.
- **For levelRun's owner** (not edited, as the brief's boundary says): the refusal text prints `tag undefined`, because it
  reads `rock.persistTag` while the run's rock state carries `tag`. This is cosmetic.
- Nothing was pushed to `main`, and no gitlinks moved.
