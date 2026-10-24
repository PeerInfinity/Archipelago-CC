#!/usr/bin/env node
/**
 * plan-seedling-wallflyer — ⛓⛓⛓ seedling-fidelity-wallflyer: THE WALLFLYER'S DEATH AND THE SHIELD'S TURN, DRIVEN.
 *
 * Fidelity TERRAIN W2 modelled the sword HITS on a WallFlyer and refused the KILL by name; survey step 47 (L22 → L29)
 * stopped there. This slice stages the kill (`contactFidelity.wallFlyerKill`, W6) and the moving shield's
 * `knockback` on the class (`wallFlyerShieldBump`, W7). No committed tape reaches either — every tape that crosses
 * L22, L25 or L27 with `noDamage` false strikes a flyer at most twice and none carries a shield past one — so these
 * tapes are recorded on the GAME (`check-seedling-bot-differential --record --only=<name>`) and the bodies are
 * compared per tick by `probe-seedling-wallflyer-mobiles.mjs` (position, velocity, hits, `hits_timer`, the "die"
 * anim and its index, `destroy`, alpha, presence).
 *
 *   wallflyer-kill         L22, boot (72,104): the player BELOW `wallflyer@64,80` (built at (72,88), settled to
 *                          (71,88)), out of every ray, a sword, one tick of `up` to face it, then a press every 31
 *                          ticks while it is in `slash()`'s reach — three landed hits on a body AT REST (v = 0, so
 *                          `knockback`'s `v = -v` moves nothing), the third plays "die" (no `destroy`), `endAnim` sets
 *                          `destroy` at the anim's end, `Mobile.death` fades it, and the removal.
 *   wallflyer-kill-flight  the same boot and the same two hits, then — once the second i-frame has run out — `up`
 *                          into the y-88 ray until the flyer LAUNCHES (+4 px/t), and the killing press as it comes
 *                          in reach: the corpse KEEPS FLYING through its die anim (`Mobile.mobileUpdate` runs while
 *                          `!destroy`, and the killing hit takes no knockback) and through the player (its
 *                          `hitPlayer` is gated on the anim), then stops where `endAnim` sets `destroy`.
 *   wallflyer-shield-bump  L22, boot (80,112), the sword AND the shield, `left` for 14 ticks into `wallflyer@48,112`'s
 *                          y-120 ray: the flyer launches at the player and every tick the moving shield's box touches
 *                          it, `Player.shieldBump` → `WallFlyer.knockback` turns it back (`v = -v`).
 *
 * The stances are CHOSEN, not derived — a witness is not a solve. The switches are FORCED ON for the authoring
 * (`withContactFidelity`), whatever the import-time defaults.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-wallflyer.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-wallflyer.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const TAPES = join(MODULE, 'fixtures', 'tapes');

    const CHECK = process.argv.includes('--check');

    const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
    const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
    const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
    const { removalTicksAfterHit } = await import(join(MODULE, 'enemyDamage.js'));
    const { wallFlyerRect, wallFlyerDeathTicks, WALLFLYER } = await import(join(MODULE, 'wallFlyer.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    const levelSource = atlasLevelSource();
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);
    const UP = new Set(['up']);
    const CADENCE = 31;
    /**
     * `removalTicksAfterHit('WallFlyer', …)`: the die anim's updates, then `Mobile.death`'s fade — counted from the
     * anim's FIRST update, which for a PRESS kill is the tick AFTER the blow (the Player updates last, so the body's
     * graphic has already run this tick: `chasers.stepSpriteAnim`'s fencepost). Hence `+ 1` from the press.
     */
    const OWED = removalTicksAfterHit('WallFlyer', wallFlyerDeathTicks());
    const PRESS_FENCEPOST = 1;

    function stage(boot, items) {
        return createLevelRun({
            levelSource,
            boot,
            noclip: false,
            noHazards: [],
            // ⚠ FALSE — under `noDamage` the run steps no wallflyer.
            noDamage: false,
            grants: [],
            persistence: [],
            despawn: [],
            equips: [],
            pins: [...PIN_NAMES],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null,
            seam: { items },
            roles: ROLES,
        });
    }

    function tapeJson(name, boot, perTick, items, description) {
        const folded = buildTape(perTick, boot, name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const tape = {
            game: 'seedling',
            name,
            boot,
            noclip: false,
            noDamage: false,
            noHazards: [],
            grants: [],
            persistence: [],
            equips: [],
            pins: [...PIN_NAMES],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 1, split: false },
            seam: { items },
            tick_count: perTick.length,
            inputs: folded.inputs,
            tape_version: 8,
        };
        const parsed = parseTape({ ...tape, description });
        return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    }

    function emit(name, json) {
        const path = join(TAPES, `${name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`⛓ the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }

    const body = (run, id) => run.wallFlyers.bodies.find((b) => b.id === id);
    const reachOf = (run, w) => (w && !w.removed && w.dieAnim === null
        ? distanceRectPoint(run.state.x, run.state.y, wallFlyerRect(w)) : Infinity);
    const deathOf = (run, id) => {
        const ev = run.wallFlyers.events.filter((e) => e.id === id);
        const at = (k) => ev.find((e) => e.kind === k)?.t ?? null;
        return { killed: at('killed'), destroyed: at('destroyed'), removed: at('removed'),
            by: ev.find((e) => e.kind === 'killed')?.by ?? null };
    };

    await withContactFidelity({ wallFlyerKill: true, wallFlyerShieldBump: true }, async () => {
        const BOOT = Object.freeze({ level: 22, x: 72, y: 104 });
        const TARGET = 'wallflyer@64,80';
        const ITEMS = { hasSword: true };

        // ── wallflyer-kill ───────────────────────────────────────────────────
        {
            const NAME = 'wallflyer-kill';
            const run = stage(BOOT, ITEMS);
            const perTick = [];
            let last = -99;
            for (let i = 0; i < 400; i += 1) {
                const w = body(run, TARGET);
                if (w.dieAnim !== null || w.removed) break;
                // ⚠ ONE tick of `up` first: `slash()` swings the way the player FACES, and the boot faces down.
                const held = i === 0 ? UP : (reachOf(run, w) <= SLASH_REACH && i - last >= CADENCE ? PRESS : NO_KEYS);
                if (held === PRESS) last = i;
                perTick.push(held);
                run.advance(held);
                if (run.playerDeaths.length > 0) break;
            }
            for (let i = 0; i < OWED + 8; i += 1) { perTick.push(NO_KEYS); run.advance(NO_KEYS); }
            const landed = run.chaserPressHits.filter((h) => h.landed && h.id === TARGET);
            const d = deathOf(run, TARGET);
            const others = run.wallFlyers.events.filter((e) => e.id !== TARGET && e.kind !== 'launch');
            check('⛓⛓⛓ THREE presses LAND on the resting flyer, 1 -> 2 -> 3 of `hitsMax` 3, the third the kill',
                landed.length === WALLFLYER.hitsMax && JSON.stringify(landed.map((h) => [h.hits, h.killed]))
                    === '[[1,false],[2,false],[3,true]]',
                JSON.stringify(landed.map((h) => ({ t: h.t, hits: h.hits, killed: h.killed }))));
            check('⛓ the death: "die" (no `destroy`), `endAnim`\'s `destroy`, then the fade and the removal',
                d.killed !== null && d.destroyed !== null && d.removed !== null && d.removed - d.killed === OWED + PRESS_FENCEPOST,
                `${JSON.stringify(d)}, removalTicksAfterHit = ${OWED}`);
            check('the player is untouched and alive (no flyer launched: the stance is in no ray)',
                run.playerHits.length === 0 && run.playerDeaths.length === 0 && others.length === 0,
                JSON.stringify({ hits: run.playerHits.length, others }));
            const description = '⛓⛓⛓ seedling-fidelity-wallflyer W6 — THE DEATH, AT REST. L22, boot (72,104): the player '
                + 'below `wallflyer@64,80` (settled at (71,88)) and in no flyer\'s ray, a sword, one tick of `up` to '
                + 'face it, then a press every 31 ticks in `slash()`\'s reach. Three LANDED hits '
                + `(t ${landed.map((h) => h.t).join(', ')}); the body is at rest, so \`WallFlyer.knockback\`'s \`v = -v\` `
                + 'moves nothing, and the third plays "die" WITHOUT `destroy` (`WallFlyer.startDeath`). The model '
                + `predicts \`destroy\` (\`endAnim\`) at t ${d.destroyed} and the removal (\`Mobile.death\`'s fade; `
                + `\`classCount(WallFlyer)\` 4 -> 3) at t ${d.removed}, ${OWED} after the anim's first update (the tick after `
                + 'the blow: the Player updates last). '
                + 'Authored by scripts/procgen/plan-seedling-wallflyer.mjs.';
            emit(NAME, tapeJson(NAME, BOOT, perTick, ITEMS, description));
            console.log(`## ${NAME}: ${perTick.length} ticks, landed t ${landed.map((h) => h.t).join(', ')}, `
                + `death ${JSON.stringify(d)}`);
        }

        // ── wallflyer-kill-flight ────────────────────────────────────────────
        {
            const NAME = 'wallflyer-kill-flight';
            const run = stage(BOOT, ITEMS);
            const perTick = [];
            let last = -99;
            let killedAt = null;
            let xAtKill = null;
            for (let i = 0; i < 400 && killedAt === null; i += 1) {
                const w = body(run, TARGET);
                let held = NO_KEYS;
                if (i === 0) held = UP;
                else if (w.hits < 2) {
                    if (reachOf(run, w) <= SLASH_REACH && i - last >= CADENCE) held = PRESS;
                } else if (w.hitsTimer > 0) {
                    held = NO_KEYS;
                } else if (w.vx === 0 && w.vy === 0) {
                    held = UP;
                } else if (reachOf(run, w) <= SLASH_REACH) {
                    held = PRESS;
                }
                if (held === PRESS) last = i;
                perTick.push(held);
                run.advance(held);
                if (body(run, TARGET).dieAnim !== null) {
                    killedAt = run.ticksCompleted ?? i + 1;
                    xAtKill = body(run, TARGET).x;
                }
                if (run.playerDeaths.length > 0) break;
            }
            const d0 = deathOf(run, TARGET);
            // to the removal and four ticks on — not past it: the room's other flyers keep coming
            while (deathOf(run, TARGET).removed === null && perTick.length < 600) {
                perTick.push(NO_KEYS);
                run.advance(NO_KEYS);
                if (run.playerDeaths.length > 0) break;
            }
            for (let i = 0; i < 4; i += 1) { perTick.push(NO_KEYS); run.advance(NO_KEYS); }
            const d = deathOf(run, TARGET);
            const kill = run.wallFlyers.events.find((e) => e.id === TARGET && e.kind === 'killed');
            const fin = body(run, TARGET);
            const destroyedAt = run.wallFlyers.events.find((e) => e.id === TARGET && e.kind === 'destroyed');
            check('⛓⛓⛓ the killing press lands on a flyer IN FLIGHT (v ≠ 0 at the blow)',
                kill && (kill.vx !== 0 || kill.vy !== 0), JSON.stringify(kill));
            check('⛔ the corpse KEEPS FLYING through its die anim (`Mobile.mobileUpdate` runs while `!destroy`)',
                destroyedAt && Math.abs(destroyedAt.x - xAtKill) >= 4 * (wallFlyerDeathTicks() - 2),
                `x ${xAtKill} at the blow -> ${destroyedAt?.x} at \`destroy\``);
            check('⛓ the death runs to the removal', d.removed !== null && d.removed - d.killed === OWED + PRESS_FENCEPOST,
                JSON.stringify(d));
            check('the player is alive at the end', run.playerDeaths.length === 0,
                JSON.stringify(run.playerHits.map((h) => ({ t: h.t, id: h.id, hits: h.hits }))));
            const description = '⛓⛓⛓ seedling-fidelity-wallflyer W6 — THE DEATH, IN FLIGHT. The `wallflyer-kill` boot '
                + 'and its first two hits; once the second i-frame is spent, `up` into `wallflyer@64,80`\'s y-88 ray '
                + `until it LAUNCHES, and the killing press at t ${d.killed} on a body moving (${kill?.vx}, ${kill?.vy}). `
                + 'The killing hit takes no knockback and `Mobile.mobileUpdate` still moves a body that is playing '
                + `"die" (\`destroy\` is false), so the model predicts the corpse flying from x ${xAtKill} to `
                + `${destroyedAt?.x} — through the player, its \`hitPlayer\` gated on the anim — before \`endAnim\` sets `
                + `\`destroy\` at t ${d.destroyed}; the removal at t ${d.removed}. \`wallflyer@128,80\` launches with it `
                + `(the same ray); player hits: ${run.playerHits.map((h) => `t ${h.t} ${h.id}`).join(', ') || 'none'}. `
                + 'Authored by scripts/procgen/plan-seedling-wallflyer.mjs.';
            emit(NAME, tapeJson(NAME, BOOT, perTick, ITEMS, description));
            console.log(`## ${NAME}: ${perTick.length} ticks, kill ${JSON.stringify(kill)}, death ${JSON.stringify(d)}, `
                + `x ${xAtKill} -> ${destroyedAt?.x} (final ${fin?.x}), hits ${JSON.stringify(run.playerHits.map((h) => h.t))}`
                + `${d0.killed === null ? ' (⚠ no kill in the strategy loop)' : ''}`);
        }

        // ── wallflyer-shield-bump ────────────────────────────────────────────
        {
            const NAME = 'wallflyer-shield-bump';
            const SBOOT = Object.freeze({ level: 22, x: 80, y: 112 });
            const SITEMS = { hasSword: true, hasShield: true };
            const LEFT = new Set(['left']);
            const WALK = 14;
            const TICKS = 24;
            const run = stage(SBOOT, SITEMS);
            const perTick = [];
            for (let i = 0; i < TICKS; i += 1) {
                const held = i < WALK ? LEFT : NO_KEYS;
                perTick.push(held);
                run.advance(held);
            }
            const bumps = run.shieldBumps.filter((r) => r.family === 'wallflyer');
            const turned = bumps.filter((r) => r.shoved);
            check('⛓⛓⛓ the moving shield TURNS the flying wallflyer at least twice (`WallFlyer.knockback`, `v = -v`)',
                turned.length >= 2, JSON.stringify(bumps.map((r) => ({ t: r.t, id: r.id, v: r.v }))));
            check('the player is alive at the end', run.playerDeaths.length === 0,
                JSON.stringify(run.playerHits.map((h) => ({ t: h.t, id: h.id, hits: h.hits }))));
            const description = '⛓⛓⛓ seedling-fidelity-wallflyer W7 — THE SHIELD TURNS A WALLFLYER. L22, boot (80,112), '
                + `the sword and the shield, \`left\` for ${WALK} ticks into \`wallflyer@48,112\`'s y-120 ray, then still. `
                + 'The flyer launches at the player (+4 px/t) and on every tick the MOVING player\'s shield box touches '
                + 'it, `Player.shieldBump` calls `WallFlyer.knockback` — `v = -v`, no gate — so it turns back: the model '
                + `bills the turn at t ${turned.map((r) => r.t).join(', ')}. Player hits: `
                + `${run.playerHits.map((h) => `t ${h.t} ${h.id}`).join(', ') || 'none'}. `
                + 'Authored by scripts/procgen/plan-seedling-wallflyer.mjs.';
            emit(NAME, tapeJson(NAME, SBOOT, perTick, SITEMS, description));
            console.log(`## ${NAME}: ${perTick.length} ticks, turns at t ${turned.map((r) => r.t).join(', ')}, hits `
                + `${JSON.stringify(run.playerHits.map((h) => h.t))}`);
        }
    });

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
