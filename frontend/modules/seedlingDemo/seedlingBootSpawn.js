/**
 * ⛓⛓ **WHERE THE GAME ITSELF BOOTS** — `Main.as:51`, `FP.world = new Game(0, 80, 128)`.
 *
 * DEPENDENCY-FREE (it imports nothing), and that is why it is its own file: the
 * flash panel's region binding needs it (a new game starts here — ⚖ the user,
 * 2026-10-28: *"Yes, start in front"*), and the binding is in the panel's static
 * closure, where `tapeFormat.js` (which re-exports this, and whose tape rules
 * explain the bake below) would cost +145 KB. The constants census reaches it
 * through that re-export and pins its three literals to `Main.as:51`.
 *
 * ⚠ THE SPAWN IS BAKED INTO THE BUILD, so a tape's `boot` block is a CLAIM
 * about the build rather than an instruction to it.
 *
 * `Main.as:51` is `FP.world = new Game(0, 80, 128)`, and `Bot.as` assigns
 * `bootLevel = int(t.boot.level)` and then never reads it — `boot.x`/`boot.y`
 * it does not look at at all. So a tape declaring anything else is silently
 * HONOURED by the JS engine and silently IGNORED by the game, and the
 * differential blames the physics for a disagreement that is entirely
 * bookkeeping. That is exactly the asymmetric interpretation the tape format
 * exists to make impossible, so it is a named error like every other
 * ambiguity there (found in v2 slice 0; the check is slice 4's).
 *
 * When the build gains a parameterised boot — an AS3 edit, and therefore
 * something to batch — this constant is the ONE place that changes, and
 * `parseTape` becomes a check that the tape names a boot the build can
 * actually take rather than the single one it always takes.
 *
 * (x, y) is the constructor's argument: the player box's TOP-LEFT, the
 * convention `resolveArrivalSpawn` and `teleport` use (botStatus reports the
 * centre, + half a tile).
 */
export const BUILD_SPAWN = Object.freeze({ level: 0, x: 80, y: 128 });
