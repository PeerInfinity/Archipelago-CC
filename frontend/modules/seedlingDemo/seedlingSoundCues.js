/**
 * seedlingSoundCues — **WHICH SEEDLING SOUND STARTS ON WHICH TICK**, read
 * out of the run (Seedling JS sound effects, ⚖ the user 2026-10-26: "Sound
 * effects are the first priority … I would prefer for the sound and its
 * timing to match exactly, but that's not as critical as the gameplay
 * timing").
 *
 * The game starts a sound where its AS3 calls `Music.playSound` /
 * `playSoundDistPlayer`. The JS model has no sound calls; it has the STATE
 * and the EVENT LEDGERS those calls sit next to. This module reads them —
 * through the run's EXISTING read-only getters, the ones the skins read
 * (⚖ planner js-11 2026-10-26: zero new getters) — and diffs them tick to
 * tick into CUES: `{ site, set, index, vol, pan, at }`.
 *
 * ⛔ AUDIO NEVER FEEDS THE MODEL. Nothing here writes the run, and nothing a
 * cue says is read back by anything that does. The model's own sound clock
 * (`state.swim`, `swimSoundClock.js`) is READ for the Swim cue — never the
 * other way round. The no-feedback pin (`seedlingSoundCues.test.js`) runs a
 * tape with and without this module stepping and compares every digest.
 *
 * ⛔ THE VARIANT IS NOT CHOSEN HERE. A cue carries the game's index: a fixed
 * one where the AS3 names it, −1 where `playSound(set, -1)` would draw it
 * from `Rng.cos()` — a stream the model does not carry, so the player picks
 * COSMETICALLY (`seedlingSoundPlayer.js`, its own PRNG and Music.as's
 * no-repeat rule).
 *
 * THE CENSUS OF RECORD is `SOUND_CALL_SITES`: every `Music.*` call site in
 * the AS3, by `File.as:line`, either `cued` (the read it is derived from and
 * its tick BAND — 0 means the cue fires on the tick the AS3 call runs) or
 * `remaining` (why no existing read sees it). `seedlingSoundCues.test.js`
 * fails on a call site the table does not list, and on a row whose site
 * moved.
 */
import { playerBoxAt } from './playerPhysicsV2.js';

/** `Main.as:36` — `super(160, 160, FPS)`: `FP.width`, the pan's half-width × 2. */
export const SCREEN_WIDTH = 160;
/** `Music.as` `playSoundDistPlayer`'s default `_distance`. */
export const DEFAULT_DISTANCE = 80;
/** `Game.as:1699` — characters before the end of a phrase where the typing sound stops restarting. */
export const SOUND_BUFFER_CHARACTERS = 3;
/** `Main.as:27` FPS — the frame clock a re-triggered channel's length is counted in (the model's sound pin's). */
export const CHANNEL_FPS = 60;

/** A Music.as set name → its content-pack key (`seedling:sfx/enemy-hit`); the same rule as the extractor. */
export const sfxKey = (set) => `seedling:sfx/${set.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * `Music.playSoundDistPlayer` (`Music.as`): pan from the x offset over half
 * the screen, volume falling linearly to 0 at `distance`, × `volMax`.
 * `player` null (no Player in the world) = full volume, centred.
 */
export function distVolPan(x, y, player, distance = DEFAULT_DISTANCE, volMax = 1) {
    let pan = 0;
    let vol = 1;
    if (player) {
        pan = Math.min(Math.max((x - player.x) / (SCREEN_WIDTH / 2), -1), 1);
        vol = Math.max(1 - Math.hypot(x - player.x, y - player.y) / distance, 0);
    }
    return { vol: vol * volMax, pan };
}

/**
 * The "Room" index a door plays (`Teleporter.as:37-60` / `Stairs.as:28-31`),
 * from its level-record entity: stairs up 1, down 2, a SHOWN teleporter 3
 * (`if (visible) soundIndex = 3`), any other door 0.
 */
export function roomIndexOf(entity) {
    if (!entity) return 0;
    if (entity.type === 'stairsup') return 1;
    if (entity.type === 'stairsdown') return 2;
    return String(entity.attrs?.show ?? '0') === '1' ? 3 : 0;
}

/** `"lock@112,192"` / `"arrowtrap@80,16#0.1"` → `{ x, y }` (the entity's placed position), or null. */
export function posOfId(id) {
    const m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(String(id ?? ''));
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** The responder tags whose `activate(true)` plays "Lock" (`Lock.as:59`, `RockLock.as:44`, `BossLock.as:53` and their subclasses). */
export const LOCK_TAGS = Object.freeze(['lock', 'shieldlock', 'rocklock', 'bosslock', 'wandlock', 'firewandlock', 'magicallock']);

/**
 * THE CENSUS OF RECORD — every `Music.*` call in `vendor/seedling/src`
 * (bar `Music.as` itself), keyed `File.as:line`. `cued` rows name the read and
 * the band; `remaining` rows say why no existing read sees the call. `music`
 * rows belong to the music layer (the next slice).
 */
const cued = (set, from, band = '0') => Object.freeze({ status: 'cued', set, from, band });
const remaining = (set, why) => Object.freeze({ status: 'remaining', set, why });
const music = (why) => Object.freeze({ status: 'music', why });
export const SOUND_CALL_SITES = Object.freeze({
    // ── the player ──────────────────────────────────────────────────────
    'Player.as:515': cued('Ground Hit', '`state.fall` leaves phase `descent` (the ceiling drop lands): index 1'),
    'Player.as:521': remaining('Ground Hit', 'the ceiling drop\'s BOUNCE (index 0, `v.y = -2`) is inside the descent phase; no read separates it'),
    'Player.as:551': cued('Swim', 'the model\'s own pinned channel `state.swim`: open with 0 frames = played this tick (step, read, then play)'),
    'Player.as:685': cued('Splash', '`state.terrain` changes INTO 1 (water) or 17 (lava)'),
    'Player.as:725': cued('Player Fall', '`state.fall` enters phase `out` (a pit)'),
    'Player.as:790': cued('Sword', '`slashPresses` outcome `dash` (its own `t`)'),
    'Player.as:797': cued('Sword', '`slashPresses` outcome `slash` (its own `t`)'),
    'Player.as:821': cued('Stab', 'the first `presses` row of a new spear press', '+(fired − t): the row appears with the hitbox'),
    'Player.as:863': cued('Fire', 'the first `presses` row of a new fire press, vol 0.4', '+(fired − t): the row appears with the flame\'s hitbox (L37: +4)'),
    'Player.as:1388': cued('Hurt', '`playerHits` (its own `t`)'),
    // ── doors, chests, the room's puzzlements ──────────────────────────
    'Teleporter.as:109': cued('Room', 'a new `transitions` row; the index from the door (`world.teleporters`) the player box overlapped the tick before, its kind from the level record: stairs 1/2, a shown teleporter 3, else 0'),
    'Chest.as:74': cued('Chest', '`chestOpens` (its own `t`)'),
    'Puzzlements/Lock.as:59': cued('Lock', '`activatorsNow` responder of a lock tag: `held` leaves 0 or `open` turns true (dist)'),
    'Puzzlements/RockLock.as:44': cued('Lock', 'as Lock.as:59'),
    'Puzzlements/BossLock.as:53': cued('Lock', 'as Lock.as:59'),
    'Puzzlements/MagicalLock.as:66': cued('Lock', '`magicalLocksOpened` (dist from its id)'),
    'Puzzlements/Button.as:44': cued('Switch', '`activatorsNow` presser `button`: `down` changes (dist)'),
    'Puzzlements/ButtonRoom.as:72': cued('Switch', '`activatorsNow` presser `buttonroom`: `down` turns true'),
    'Puzzlements/PushableBlock.as:87': cued('Push Rock', '`pushedBlocks`: EVERY tick a block\'s position changes, vol 0.5 (the AS3 re-plays it each moving frame; FlashPunk\'s `Sfx.play` restarts the one channel)'),
    'Puzzlements/PushableBlockFire.as:139': cued('Push Rock', 'as PushableBlock.as:87'),
    'Puzzlements/BreakableRock.as:62': cued('Rock', '`rocksBroken` (its `hitTick`): index 1'),
    'Puzzlements/ArrowTrap.as:56': cued('Arrow', '`arrowVolleys` (its own `t`; dist from the trap id): index 0'),
    'Puzzlements/Pulser.as:65': cued('Energy Pulse', '`machinesNow` (G9) pulser `anim` turns `pulse` — the same line plays it (dist 120)'),
    'Puzzlements/Crusher.as:79': remaining('Other', 'the crusher\'s slam test reads its own channel (`soundPercentage("Other", 4)`); no ledger records a slam'),
    'Puzzlements/BeamTower.as:85': remaining('Energy Beam', 'the beam\'s sound point is the PLAYER clamped to the beam line under a `playedSound` latch; `machinesNow` carries the tower\'s picture, not the latch'),
    'Puzzlements/RopeStart.as:47': remaining('Other', 'the rope cut is not in a ledger with its tick (`pulledRopes` is a set)'),
    'Scenery/BurnableTree.as:33': cued('Burn', '`treeBurns` (its own `t`): index 0'),
    'Scenery/Grass.as:32': remaining('Arrow', 'grass cutting is not modelled'),
    'Scenery/FallRock.as:82': remaining('Rock', '`rockFalls` records the TRIGGER, not the landing tick'),
    'Scenery/FallRockLarge.as:102': remaining('Rock', 'as FallRock.as:82'),
    'Scenery/RockFall.as:76': remaining('Rock', 'no ledger records the break'),
    'Scenery/Moonrock.as:94': remaining('Light', 'no ledger records the moonrock lighting'),
    'Scenery/Moonrock.as:116': remaining('Rock', 'no ledger records the moonrock landing'),
    'Scenery/LightBossTotem.as:50': cued('Boss Die', '`lightsFight` `totemDie` turns true (the `die` setter): index 2, vol 0.3'),
    // ── enemies ─────────────────────────────────────────────────────────
    'Enemies/Enemy.as:80': cued('Enemy Fall', 'a chaser\'s `alpha` leaves 1 while not dying (the pit fade starts) (dist)'),
    'Enemies/Enemy.as:160': cued('Enemy Die', 'the class\'s `dieSound`/`dieSoundIndex` (dist): a chaser or spinner\'s `hits` rises and it is dying / destroyed (index 0); a tentacle\'s `tentacle-hit` `killed` (0); the bosses\' big index 1 — ShieldBoss `shieldBossHits` `killed`, the Owl\'s `hits` rising with a `finalBossKills` `kill`, a Lights flier\'s `hits` rising into its die animation, a Bob Boss form\'s `hits` rising with `destroy`; the BossTotem\'s `bossHits` `killed` plays its own "Boss Die" 0'),
    'Enemies/Enemy.as:165': cued('Enemy Hit', 'the class\'s `hitSound`/`hitSoundIndex` (dist): a chaser or spinner\'s `hits` rises and it lives (index 0); a tentacle\'s landed `tentacle-hit` (0); the bosses\' index 1 — ShieldBoss `shieldBossHits` landed in `movedShield`, the Owl / a Lights flier / a Bob Boss form `hits` rising, the BossTotem\'s landed `bossHits`. The King of Fire\'s own `hit` plays nothing (`LavaBoss.as:143`)'),
    'Enemies/Bob.as:72': remaining('Enemy Hop', 'a hop is not a read'),
    'Enemies/BobSoldier.as:105': remaining('Enemy Hop', 'a hop is not a read'),
    'Enemies/Puncher.as:115': remaining('Punch', 'a punch is not a ledger row'),
    'Enemies/Drill.as:102': remaining('Drill', 'drill surfacing is not a ledger row'),
    'Enemies/Drill.as:108': remaining('Drill', 'as Drill.as:102'),
    'Enemies/Grenade.as:135': cued('Explosion', '`owlGrenadeEvents` `exploded` (its x, y) and `placedGrenadeEvents` `blast` (the `placedGrenades` body; else its id): dist 120'),
    'Enemies/Tentacle.as:105': cued('Tentacle', 'a `tentacleBeastFight` tentacle\'s `anim` turns `hitting` (the "hit" animation\'s end plays it) (dist)'),
    'Enemies/TentacleBeast.as:86': cued('Boss Die', '`tentacleBeastEvents` `wake`: index 3, vol 0.2'),
    'Enemies/TentacleBeast.as:96': cued('Boss Die', '`tentacleBeastEvents` `dying`: index 4, vol 0.2'),
    'Enemies/LavaBoss.as:220': cued('Lava', '`lavaBossFight` boss `anim` turns `smashback` (the smash\'s `endAnim`): index 0'),
    'Enemies/LavaBoss.as:247': cued('Lava', '`lavaBossFight` boss `anim` turns `sweepback` (the sweep\'s `endAnim`): index 1'),
    'Enemies/Bulb.as:61': cued('Lava', '`bulbEvents` `drop`: index 2'),
    'Enemies/LightBoss.as:69': cued('Boss 6 Move', 'one roll per live `lightsFight` flier per tick, 1 in 90, on the CUES\' OWN cosmetic stream (mulberry32, `COSMETIC_CUE_SEED`) — the game rolls `Rng.cos()`, which is never modelled (⚖ never model the cosmetic RNG)', 'cosmetic: the game\'s RATE, not its ticks'),
    'Enemies/ShieldBoss.as:146': cued('Metal Hit', 'a `shieldBossHits` row neither swallowed nor in `movedShield`, under the `playedSound` latch — set by the play, cleared by `endAnim`, read as a non-`sit` animation (`moveShield` / `movedShield` / `stab`) changing on a tick no hit of that boss aborted, retaliated or killed', '0 (the latch reconstructed from the animation chain)'),
    'Enemies/BossTotem.as:294': cued('Other', 'a `bossesWoken` body appears (activation), same room: index 0'),
    'Enemies/BossTotem.as:369': cued('Enemy Attack', '`bossShotsFired`: once per tick that fired (the AS3 plays once per PAIR): index 2, vol 0.2'),
    'Enemies/BossTotem.as:393': remaining('Other', 'the walk\'s step sound is keyed to the boss\'s own `currentFrame` (2 or 6) under a `playedSound` latch; `bossesWoken` carries `anim`/`state`, not the frame'),
    'Enemies/BossTotem.as:455': cued('Enemy Attack', '`bossLasers` (one row per firing): index 0, vol 0.15'),
    'Enemies/BossTotem.as:456': cued('Enemy Attack', 'as BossTotem.as:455: index 1, vol 0.15'),
    'Enemies/BossTotem.as:478': cued('Boss Die', 'a `bossesWoken` body\'s `removed` turns true, same room: index 1, vol 0.8'),
    'Enemies/LavaTrap.as:91': remaining('Enemy Attack', 'not mapped'),
    'Enemies/SandTrap.as:62': remaining('Enemy Attack', 'not mapped'),
    'Enemies/IceTrap.as:44': remaining('Enemy Attack', 'not mapped'),
    'Enemies/DarkTrap.as:35': remaining('Enemy Die', 'not mapped'),
    'Enemies/IceTurret.as:238': remaining('Push Rock', 'not mapped'),
    // ── projectiles ─────────────────────────────────────────────────────
    'Projectiles/Arrow.as:59': remaining('Arrow', 'an arrow\'s landing (`arrowBodyHits`) is per body; the AS3 plays once per arrow per landing tick — not mapped'),
    'Projectiles/TurretSpit.as:37': cued('Turret Shoot', '`spitEvents` `spawn` (its own `t`; dist from the row)'),
    'Projectiles/IceTurretBlast.as:36': remaining('Other', 'not mapped'),
    'Projectiles/Explosion.as:48': cued('Explosion', 'PARTIAL, dist 120: `bombEvents` `blast` (Bomb.as:62); `bossBlasts` — a BossTotemShot\'s (BossTotemShot.as:71) and the BossTotem\'s wand death (Enemy.as:205); `lavaBossEvents` `ball-hit` at x + the ball\'s last v (LavaBall.as:82). Remaining: Enemy.as:205 for any OTHER body a wand kills (no ledger ties a wand kill to its body)'),
    'Projectiles/WandShot.as:71': cued('Wand Fire', '`wandShots` (its own `t`)'),
    'Projectiles/WandShot.as:89': cued('Wand Fizzle', 'a `wandShotsLive` shot\'s `anim` turns `die`'),
    'Projectiles/WandShot.as:123': cued('Wand Fizzle', 'as WandShot.as:89 (a hit plays `die` in the same update)'),
    // ── talk and the game ──────────────────────────────────────────────
    'Game.as:837': remaining('Wind', 'the fresh-start intro (`level < 0`), which the JS runtime does not boot'),
    'Game.as:1206': remaining('Wind', 'the blizzard (`snowAlpha`) is not a read'),
    'Game.as:1207': remaining('Wind', 'as Game.as:1206 (a volume)'),
    'Game.as:1212': remaining('Wind', 'as Game.as:1206 (a stop)'),
    'Game.as:1306': remaining('Text', 'the pause menu; the JS runtime has none'),
    'Game.as:1315': remaining('Text', 'the pause menu; the JS runtime has none'),
    'Game.as:1719': cued('Text', '`talkingNow.currentCharacter` advancing short of the last 3 characters, re-played whenever its channel (Text1\'s length at 60 fps) is not open: index 0'),
    'NPCs/NPC.as:198': cued('Text', '`talkingNow` moves to the next page or ends (the X release): index 1, vol 0.3'),
    'NPCs/BobBossNPC.as:37': cued('Text', 'as NPC.as:198 (the Bob Boss\'s talk is a `talkingNow` row)'),
    // ── the music layer (next slice) ────────────────────────────────────
    'Game.as:1216': music('the menu song'),
    'Game.as:1221': music('Music.stop'),
    'Game.as:1228': music('a level song'),
    'Game.as:1233': music('a level song'),
    'Game.as:1237': music('a fade out'),
    'SealController.as:167': music('a jingle (abruptThenFade)'),
    'Pickups/Pickup.as:81': music('a pickup jingle (abruptThenFade)'),
});

/**
 * THE VIEW — everything the cues read, as plain copies (null with no run).
 * `record` is the room's level record (the door kinds), as the other views take it.
 */
export function soundCueView(run, { record = null } = {}) {
    if (!run?.state) return null;
    const s = run.state;
    const act = run.activatorsNow ?? { responders: [], pressers: [] };
    const talk = run.talkingNow ?? null;
    return {
        run,
        level: run.level,
        tick: run.ticksCompleted ?? 0,
        record,
        player: { x: s.x, y: s.y },
        doors: (run.world?.teleporters ?? []).filter((d) => !d.deactivated).map((d) => ({ x: d.x, y: d.y, rect: d.rect })),
        terrain: s.terrain ?? 0,
        swim: s.swim ? { open: !!s.swim.open, frames: s.swim.frames } : null,
        fall: s.fall?.phase ?? null,
        slashPresses: run.slashPresses ?? [],
        presses: run.presses ?? [],
        playerHits: run.playerHits ?? [],
        transitions: run.transitions ?? [],
        chestOpens: run.chestOpens ?? [],
        rocksBroken: run.rocksBroken ?? [],
        treeBurns: run.treeBurns ?? [],
        arrowVolleys: run.arrowVolleys ?? [],
        spitEvents: run.spitEvents ?? [],
        bombEvents: run.bombEvents ?? [],
        wandShots: run.wandShots ?? [],
        magicalLocksOpened: run.magicalLocksOpened ?? [],
        wandLive: (run.wandShotsLive ?? []).map((w) => ({ id: w.id, anim: w.anim })),
        pulsers: (run.machinesNow?.pulsers ?? []).map((m) => ({ id: m.id, x: m.x, y: m.y, anim: m.anim })),
        pushed: (run.pushedBlocks ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y })),
        chasers: (run.chasers ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, hits: c.hits ?? 0, dying: !!c.dying, destroy: !!c.destroy, alpha: c.alpha ?? 1 })),
        spinners: (run.spinnerBodies ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, hits: b.hits ?? 0, destroy: !!b.destroy })),
        responders: (act.responders ?? []).map((r) => ({ id: r.id, tag: r.tag, open: !!r.open, held: r.held ?? 0 })),
        pressers: (act.pressers ?? []).map((p) => ({ id: p.id, tag: p.tag, down: !!p.down })),
        talk: talk ? { key: `${talk.source}|${talk.id}|${talk.tag}`, page: talk.page, pages: talk.pages, length: talk.text.length, at: talk.currentCharacter } : null,
        bosses: bossCueView(run),
    };
}

/** A getter the run may not carry (an older run, a stub): its value, or `fallback`. */
const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/** The boss ledgers the cues read new rows of (each grows within a run). */
const BOSS_LEDGERS = Object.freeze(['shieldBossHits', 'finalBossKills', 'owlGrenadeEvents', 'placedGrenadeEvents', 'lavaBossEvents',
    'tentacleBeastEvents', 'bossShotsFired', 'bossLasers', 'bossHits', 'bossBlasts', 'bulbEvents']);

/**
 * THE BOSSES' VIEW — the same EXISTING getters the boss skin (G10) and the music
 * driver read, copied. ⛔ No new getter: a sound no one of these sees stays a
 * `remaining` row with its reason.
 */
function bossCueView(run) {
    const ledgers = {};
    for (const k of BOSS_LEDGERS) ledgers[k] = read(run, k, []) ?? [];
    const lava = read(run, 'lavaBossFight', null);
    const beast = read(run, 'tentacleBeastFight', null);
    return {
        ...ledgers,
        shield: (read(run, 'shieldBosses', []) ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, anim: b.anim, hits: b.hits ?? 0 })),
        owl: (read(run, 'finalBosses', []) ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, hits: b.hits ?? 0 })),
        placedGrenades: (read(run, 'placedGrenades', []) ?? []).map((g) => ({ id: g.id, x: g.x, y: g.y })),
        lava: lava?.boss ? { anim: lava.boss.anim ?? '' } : null,
        lavaBalls: (lava?.balls ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y, vx: s.vx ?? 0, vy: s.vy ?? 0 })),
        tentacles: (beast?.tentacles ?? []).map((t) => ({ id: t.id, x: t.x, y: t.y, anim: t.anim ?? '' })),
        lights: (read(run, 'lightsFight', []) ?? []).map((f) => ({
            id: f.id, totemDie: !!f.totemDie,
            fliers: (f.bodies ?? []).filter((b) => !b.removed).map((b) => ({ id: b.id, x: b.x, y: b.y, hits: b.hits ?? 0, dying: !!b.dieAnim })),
        })),
        totems: (read(run, 'bossesWoken', []) ?? []).map((b) => ({ x: b.x, y: b.y, removed: !!b.removed })),
        bob: (() => {
            const m = read(run, 'bobBoss', null);
            const body = m instanceof Map ? m.get('boss') : null;
            return body ? { id: body.id, x: body.x, y: body.y, hits: body.hits ?? 0, destroy: !!body.destroy } : null;
        })(),
    };
}

/** mulberry32, one step, PURE (`a` in, `{ a, r }` out) — the cues' OWN cosmetic stream (never the model's). */
export function cosmeticStep(a) {
    const next = (a + 0x6d2b79f5) >>> 0;
    let t = next;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return { a: next, r: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
/** The cues' cosmetic stream's seed (a constant, so a golden is reproducible). */
export const COSMETIC_CUE_SEED = 0x6b055;
/** `LightBoss.as:67` — `!Math.floor(Rng.cos() * 90)`: one update in 90 plays "Boss 6 Move". */
export const LIGHT_BOSS_MOVE_ODDS = 90;
/** The ShieldBoss animations whose end runs `endAnim` (`sit` has frame rate 0 and never ends — `ShieldBoss.as:36-40`). */
const SHIELD_ENDING_ANIMS = Object.freeze(['moveShield', 'movedShield', 'stab']);

/** The new rows of a ledger since the last tick (a ledger only grows within a run). */
const fresh = (list, seen) => (list.length > seen ? list.slice(seen) : []);

/**
 * One GAME tick of cues (call after every `tick()`). Pure: returns
 * `{ state, cues }`. `prev` null — or another run (a boot, a reboot in
 * place) — BASELINES: it emits nothing, because a ledger's history is not
 * this tick's sound. `lengthFrames(set, index)` gives a re-triggered
 * channel's length at 60 fps (the page reads it from the sfx manifest).
 */
export function stepSoundCues(prev, view, tick, { lengthFrames = () => 1 } = {}) {
    if (!view) return { state: prev, cues: [] };
    const same = !!prev && prev.run === view.run;
    const cues = [];
    const at = tick;
    const cue = (site, set, index = -1, vol = 1, pan = 0) => cues.push({ site, set, key: sfxKey(set), index, vol, pan, at });
    const dist = (site, set, index, x, y, distance, volMax) => {
        const { vol, pan } = distVolPan(x, y, view.player, distance, volMax);
        cue(site, set, index, vol, pan);
    };
    const lens = {};
    for (const k of ['slashPresses', 'presses', 'playerHits', 'transitions', 'chestOpens', 'rocksBroken', 'treeBurns',
        'arrowVolleys', 'spitEvents', 'bombEvents', 'wandShots', 'magicalLocksOpened']) lens[k] = view[k].length;
    // The re-triggered channel (Game.as:1719's "is it playing?"): frames since the last play, at 60 fps per tick.
    const textChannel = same ? { ...prev.textChannel } : { open: false, frames: 0 };
    if (textChannel.open) {
        textChannel.frames += 1;
        if (textChannel.frames >= Math.max(1, lengthFrames('Text', 0))) textChannel.open = false;
    }
    const state = {
        run: view.run, level: view.level, lens, textChannel,
        player: view.player, record: view.record, doors: view.doors,
        terrain: view.terrain, fall: view.fall, swim: view.swim, talk: view.talk,
        chasers: new Map(view.chasers.map((c) => [c.id, c])),
        spinners: new Map(view.spinners.map((b) => [b.id, b])),
        responders: new Map(view.responders.map((r) => [r.id, r])),
        pressers: new Map(view.pressers.map((p) => [p.id, p])),
        pushed: new Map(view.pushed.map((b) => [b.id, b])),
        wandLive: new Map(view.wandLive.map((w) => [w.id, w])),
        pulsers: new Map(view.pulsers.map((m) => [m.id, m])),
        pressKeys: same ? prev.pressKeys : new Set(view.presses.map((p) => `${p.weapon}|${p.t}`)),
    };
    if (!same) { state.boss = bossBaseline(view); return { state, cues }; }
    const p = prev;

    // ── the player ──
    for (const d of fresh(view.slashPresses, p.lens.slashPresses)) {
        if (d.outcome === 'dash') cue('Player.as:790', 'Sword');
        else if (d.outcome === 'slash') cue('Player.as:797', 'Sword');
    }
    const pressKeys = new Set(p.pressKeys);
    for (const r of fresh(view.presses, p.lens.presses)) {
        const k = `${r.weapon}|${r.t}`;
        if (pressKeys.has(k)) continue;
        pressKeys.add(k);
        if (r.weapon === 'spear') cue('Player.as:821', 'Stab');
        else if (r.weapon === 'fire') cue('Player.as:863', 'Fire', -1, 0.4);
    }
    state.pressKeys = pressKeys;
    for (let i = 0; i < fresh(view.playerHits, p.lens.playerHits).length; i += 1) cue('Player.as:1388', 'Hurt');
    // The pinned channel steps BEFORE the read and the play (`playerPhysicsV2`), so open with 0 frames after a tick
    // means this tick's `playSound("Swim")` ran.
    if (view.swim?.open && view.swim.frames === 0) cue('Player.as:551', 'Swim');
    if (view.terrain !== p.terrain && (view.terrain === 1 || view.terrain === 17)) cue('Player.as:685', 'Splash');
    if (view.fall === 'out' && p.fall !== 'out') cue('Player.as:725', 'Player Fall');
    if (p.fall === 'descent' && view.fall !== 'descent') cue('Player.as:515', 'Ground Hit', 1);

    // ── doors ──
    // A pit or a ceiling carries the player too (`Player.as:725`'s fall), with no door and no "Room": only a door
    // the player's box touched plays it. An unmatched crossing is COUNTED (`unmatchedDoors`), never guessed.
    state.unmatchedDoors = p.unmatchedDoors ?? 0;
    if (fresh(view.transitions, p.lens.transitions).length) {
        const door = p.fall === 'out' ? null : doorUnder(p.player, p.doors, p.record);
        if (door) cue('Teleporter.as:109', 'Room', roomIndexOf(door));
        else if (p.fall !== 'out') state.unmatchedDoors += 1;
    }

    // ── the room ──
    for (let i = 0; i < fresh(view.chestOpens, p.lens.chestOpens).length; i += 1) cue('Chest.as:74', 'Chest');
    for (let i = 0; i < fresh(view.rocksBroken, p.lens.rocksBroken).length; i += 1) cue('Puzzlements/BreakableRock.as:62', 'Rock', 1);
    for (let i = 0; i < fresh(view.treeBurns, p.lens.treeBurns).length; i += 1) cue('Scenery/BurnableTree.as:33', 'Burn', 0);
    for (const v of fresh(view.arrowVolleys, p.lens.arrowVolleys)) {
        const pos = posOfId(v.id);
        if (pos) dist('Puzzlements/ArrowTrap.as:56', 'Arrow', 0, pos.x, pos.y);
    }
    for (const e of fresh(view.spitEvents, p.lens.spitEvents)) {
        if (e.what === 'spawn') dist('Projectiles/TurretSpit.as:37', 'Turret Shoot', -1, e.x, e.y);
    }
    for (const e of fresh(view.bombEvents, p.lens.bombEvents)) {
        if (e.what === 'blast' && e.at) dist('Projectiles/Explosion.as:48', 'Explosion', -1, e.at.x, e.at.y, 120);
    }
    for (let i = 0; i < fresh(view.wandShots, p.lens.wandShots).length; i += 1) cue('Projectiles/WandShot.as:71', 'Wand Fire');
    for (const w of view.wandLive) {
        if (w.anim === 'die' && p.wandLive.get(w.id)?.anim !== 'die') cue('Projectiles/WandShot.as:89', 'Wand Fizzle');
    }
    for (const m of view.pulsers) {
        const was = p.pulsers.get(m.id);
        if (was && m.anim === 'pulse' && was.anim !== 'pulse') dist('Puzzlements/Pulser.as:65', 'Energy Pulse', -1, m.x, m.y, 120);
    }
    for (const l of fresh(view.magicalLocksOpened, p.lens.magicalLocksOpened)) {
        const pos = posOfId(l.id);
        if (pos) dist('Puzzlements/MagicalLock.as:66', 'Lock', -1, pos.x, pos.y);
    }
    for (const r of view.responders) {
        const was = p.responders.get(r.id);
        if (!was || !LOCK_TAGS.includes(r.tag) || r.tag === 'magicallock') continue;
        if ((was.held === 0 && r.held > 0 && !was.open) || (!was.open && r.open && was.held === 0)) {
            const pos = posOfId(r.id);
            if (pos) dist('Puzzlements/Lock.as:59', 'Lock', -1, pos.x, pos.y);
        }
    }
    for (const b of view.pressers) {
        const was = p.pressers.get(b.id);
        if (!was || was.down === b.down) continue;
        if (b.tag === 'buttonroom') { if (b.down) cue('Puzzlements/ButtonRoom.as:72', 'Switch'); continue; }
        const pos = posOfId(b.id);
        if (pos) dist('Puzzlements/Button.as:44', 'Switch', -1, pos.x, pos.y);
    }
    for (const b of view.pushed) {
        const before = p.pushed.get(b.id) ?? posOfId(b.id);
        if (before && (before.x !== b.x || before.y !== b.y)) cue('Puzzlements/PushableBlock.as:87', 'Push Rock', -1, 0.5);
    }

    // ── enemies ──
    for (const c of view.chasers) {
        const was = p.chasers.get(c.id);
        if (!was) continue;
        if (c.hits > was.hits) {
            if (c.dying || c.destroy) dist('Enemies/Enemy.as:160', 'Enemy Die', 0, c.x, c.y);
            else dist('Enemies/Enemy.as:165', 'Enemy Hit', 0, c.x, c.y);
        } else if (!c.dying && !c.destroy && c.alpha < 1 && was.alpha >= 1) {
            dist('Enemies/Enemy.as:80', 'Enemy Fall', -1, c.x, c.y);
        }
    }
    for (const b of view.spinners) {
        const was = p.spinners.get(b.id);
        if (was && b.hits > was.hits) {
            if (b.hits >= 3 || b.destroy) dist('Enemies/Enemy.as:160', 'Enemy Die', 0, b.x, b.y);
            else dist('Enemies/Enemy.as:165', 'Enemy Hit', 0, b.x, b.y);
        }
    }

    // ── talk ──
    const t = view.talk;
    const was = p.talk;
    if (was && (!t || t.key !== was.key || t.page !== was.page)) cue('NPCs/NPC.as:198', 'Text', 1, 0.3);
    // Game.as:1717-1720: while the phrase is still typing, short of its last 3 characters, re-play when the channel closed.
    if (t && t.at < t.length && t.at <= t.length - SOUND_BUFFER_CHARACTERS) {
        if (!textChannel.open) {
            cue('Game.as:1719', 'Text', 0);
            textChannel.open = true;
            textChannel.frames = 0;
        }
    }

    stepBossCues(p, view, state, { cue, dist });
    return { state, cues };
}

/** The boss half of the state a new run baselines with. */
function bossBaseline(view) {
    const b = view.bosses;
    const lens = {};
    for (const k of BOSS_LEDGERS) lens[k] = b ? b[k].length : 0;
    return { lens, bosses: b, shieldLatch: new Map(), cosmetic: COSMETIC_CUE_SEED };
}

/**
 * The bosses, one family at a time (⚖ the brief: bosses first). Every family
 * reads its own getters; a list that is LEVEL-scoped (a body's state) is only
 * diffed while the level stays the same, so a room change cannot read as a
 * hit, a death or a wake.
 */
function stepBossCues(p, view, state, { cue, dist }) {
    const b = view.bosses;
    const was = p.boss?.bosses;
    if (!b || !was) { state.boss = bossBaseline(view); return; }
    const lensBefore = p.boss.lens;
    const fresh = (k) => (b[k].length > lensBefore[k] ? b[k].slice(lensBefore[k]) : []);
    const sameRoom = view.level === p.level;
    const byId = (list) => new Map((list ?? []).map((x) => [x.id, x]));
    const shieldLatch = new Map(p.boss.shieldLatch);
    let cosmetic = p.boss.cosmetic;

    // ── ShieldBoss (L19) ── `ShieldBoss.hit` (`:130-151`): the swallowed first hit plays nothing; in "movedShield"
    // `super.hit` (Enemy.as:160/165, the big index 1); anywhere else "Metal Hit" under the `playedSound` latch,
    // which `endAnim` clears (`:192`) — seen as a non-`sit` animation changing with no hit of this tick to explain it.
    const shieldNow = byId(b.shield);
    const shieldWas = byId(was.shield);
    const hitIds = new Set();
    for (const r of fresh('shieldBossHits')) {
        if (r.swallowed) continue;
        const body = shieldNow.get(r.id) ?? shieldWas.get(r.id) ?? posOfId(r.id);
        if (r.anim === 'movedShield') {
            if (r.landed) dist(r.killed ? 'Enemies/Enemy.as:160' : 'Enemies/Enemy.as:165', r.killed ? 'Enemy Die' : 'Enemy Hit', 1, body.x, body.y);
        } else if (!shieldLatch.get(r.id)) {
            cue('Enemies/ShieldBoss.as:146', 'Metal Hit');
            shieldLatch.set(r.id, true);
        }
        if (r.aborted || r.retaliated || r.killed) hitIds.add(r.id);
    }
    if (sameRoom) {
        for (const s of b.shield) {
            const before = shieldWas.get(s.id);
            if (before && SHIELD_ENDING_ANIMS.includes(before.anim) && s.anim !== before.anim && !hitIds.has(s.id)) shieldLatch.set(s.id, false);
        }
    }

    // ── the Owl (L112) ── `FinalBoss` keeps `Enemy.hit`: a hit plays index 1, the killing one "Enemy Die" 1.
    const owlKills = new Set(fresh('finalBossKills').filter((r) => r.what === 'kill').map((r) => r.id));
    if (sameRoom) {
        const owlWas = byId(was.owl);
        for (const o of b.owl) {
            const before = owlWas.get(o.id);
            if (before && o.hits > before.hits) {
                if (owlKills.has(o.id)) dist('Enemies/Enemy.as:160', 'Enemy Die', 1, o.x, o.y);
                else dist('Enemies/Enemy.as:165', 'Enemy Hit', 1, o.x, o.y);
            }
        }
    }
    // `Grenade.animEnd`'s "explode" (`:135`) — the Owl's and the placed ones (dist from the grenade's x, y; 120).
    for (const r of fresh('owlGrenadeEvents')) if (r.what === 'exploded') dist('Enemies/Grenade.as:135', 'Explosion', -1, r.x, r.y, 120);
    const placed = byId(b.placedGrenades);
    for (const r of fresh('placedGrenadeEvents')) {
        if (r.what !== 'blast') continue;
        const g = placed.get(r.id) ?? posOfId(r.id);
        if (g) dist('Enemies/Grenade.as:135', 'Explosion', -1, g.x, g.y, 120);
    }

    // ── the King of Fire (L82) ── `LavaBoss.endAnim`: "smash" ends → "smashback" + Lava 0 (`:220`); "sweep" ends →
    // "sweepback" + Lava 1 (`:247`). Its own `hit` plays nothing. A LavaBall that hits explodes at x + v (`LavaBall.as:82`).
    if (sameRoom && b.lava && was.lava && b.lava.anim !== was.lava.anim) {
        if (b.lava.anim === 'smashback') cue('Enemies/LavaBoss.as:220', 'Lava', 0);
        if (b.lava.anim === 'sweepback') cue('Enemies/LavaBoss.as:247', 'Lava', 1);
    }
    const ballsWas = byId(was.lavaBalls);
    for (const r of fresh('lavaBossEvents')) {
        if (r.kind !== 'ball-hit') continue;
        const v = ballsWas.get(r.id) ?? { vx: 0, vy: 0 };
        dist('Projectiles/Explosion.as:48', 'Explosion', -1, r.x + v.vx, r.y + v.vy, 120);
    }

    // ── the Tentacled Beast (L57) ── wake "Boss Die" 3 (`:86`), dying "Boss Die" 4 (`:96`), both vol 0.2; a tentacle
    // (an Enemy, the small index) hit or cut; a tentacle's "hit" ending into "hitting" plays "Tentacle" (`Tentacle.as:105`).
    const tentWas = byId(was.tentacles);
    const tentNow = byId(b.tentacles);
    for (const r of fresh('tentacleBeastEvents')) {
        if (r.kind === 'wake') cue('Enemies/TentacleBeast.as:86', 'Boss Die', 3, 0.2);
        else if (r.kind === 'dying') cue('Enemies/TentacleBeast.as:96', 'Boss Die', 4, 0.2);
        else if (r.kind === 'tentacle-hit' && r.landed) {
            const t = tentNow.get(r.id) ?? tentWas.get(r.id);
            if (t) dist(r.killed ? 'Enemies/Enemy.as:160' : 'Enemies/Enemy.as:165', r.killed ? 'Enemy Die' : 'Enemy Hit', 0, t.x, t.y);
        }
    }
    if (sameRoom) {
        for (const t of b.tentacles) {
            const before = tentWas.get(t.id);
            if (before && t.anim === 'hitting' && before.anim !== 'hitting') dist('Enemies/Tentacle.as:105', 'Tentacle', -1, t.x, t.y);
        }
    }

    // ── the Lights (L69) ── a flier keeps `Enemy.hit` (index 1); the totem's `die` setter plays "Boss Die" 2, 0.3
    // (`LightBossTotem.as:50`); every update a flier rolls `Rng.cos()` for "Boss 6 Move" (`LightBoss.as:69`) — a roll on
    // the COSMETIC stream, so the cues roll their OWN (⚖ never model the cosmetic RNG): the game's rate, not its ticks.
    if (sameRoom) {
        const lightsWas = byId(was.lights);
        for (const f of b.lights) {
            const before = lightsWas.get(f.id);
            if (!before) continue;
            if (f.totemDie && !before.totemDie) cue('Scenery/LightBossTotem.as:50', 'Boss Die', 2, 0.3);
            const fliersWas = byId(before.fliers);
            for (const fl of f.fliers) {
                const fb = fliersWas.get(fl.id);
                if (!fb) continue;
                if (fl.hits > fb.hits) {
                    if (fl.dying) dist('Enemies/Enemy.as:160', 'Enemy Die', 1, fl.x, fl.y);
                    else dist('Enemies/Enemy.as:165', 'Enemy Hit', 1, fl.x, fl.y);
                }
                const roll = cosmeticStep(cosmetic);
                cosmetic = roll.a;
                if (!Math.floor(roll.r * LIGHT_BOSS_MOVE_ODDS)) cue('Enemies/LightBoss.as:69', 'Boss 6 Move');
            }
        }
    }

    // ── the BossTotem (L43) ── woken "Other" 0 (`:294`); a volley "Enemy Attack" 2, 0.2 once per PAIR (`:369`); the
    // laser "Enemy Attack" 0 and 1, 0.15 (`:455-456`); a hit index 1, the kill its `dieSound` "Boss Die" 0 (Enemy.as:160);
    // removed "Boss Die" 1, 0.8 (`:478`); a BossTotemShot's or the wand death's Explosion (dist, 120).
    if (sameRoom) {
        b.totems.forEach((t, i) => {
            const before = was.totems[i];
            if (!before) cue('Enemies/BossTotem.as:294', 'Other', 0);
            else if (t.removed && !before.removed) cue('Enemies/BossTotem.as:478', 'Boss Die', 1, 0.8);
        });
    }
    for (let i = new Set(fresh('bossShotsFired').map((r) => r.t)).size; i > 0; i -= 1) cue('Enemies/BossTotem.as:369', 'Enemy Attack', 2, 0.2);
    for (let i = 0; i < fresh('bossLasers').length; i += 1) {
        cue('Enemies/BossTotem.as:455', 'Enemy Attack', 0, 0.15);
        cue('Enemies/BossTotem.as:456', 'Enemy Attack', 1, 0.15);
    }
    for (const r of fresh('bossHits')) {
        if (!r.landed) continue;
        const x = posOfId(r.id)?.x ?? view.player.x;
        if (r.killed) dist('Enemies/Enemy.as:160', 'Boss Die', 0, x, r.bossY);
        else dist('Enemies/Enemy.as:165', 'Enemy Hit', 1, x, r.bossY);
    }
    for (const r of fresh('bossBlasts')) dist('Projectiles/Explosion.as:48', 'Explosion', -1, r.x, r.y, 120);

    // ── the Bulb (`Bulb.as:61`): its drop plays "Lava" 2 ──
    for (const r of fresh('bulbEvents')) if (r.kind === 'drop') cue('Enemies/Bulb.as:61', 'Lava', 2);

    // ── the Bob Boss (L32) ── `BobBoss.hit` ends in `super.hit` (index 1); each form is its own body (`bobboss#n`),
    // and a form's last hit sets `destroy` on the same tick.
    if (sameRoom && b.bob && was.bob && b.bob.id === was.bob.id && b.bob.hits > was.bob.hits) {
        if (b.bob.destroy) dist('Enemies/Enemy.as:160', 'Enemy Die', 1, b.bob.x, b.bob.y);
        else dist('Enemies/Enemy.as:165', 'Enemy Hit', 1, b.bob.x, b.bob.y);
    }

    const lens = {};
    for (const k of BOSS_LEDGERS) lens[k] = b[k].length;
    state.boss = { lens, bosses: b, shieldLatch, cosmetic };
}

const DOOR_TYPES = Object.freeze(['teleporter', 'stairsup', 'stairsdown']);
const overlaps = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

/**
 * The level-record entity of the door the player's box overlapped (`Teleporter.update`'s `collide("Player")`),
 * or a bare `{ type: 'teleporter' }` for a door with no record row (a runtime one), or null when none.
 */
function doorUnder(player, doors, record) {
    if (!player || !doors?.length) return null;
    const box = playerBoxAt(player.x, player.y);
    const hit = doors.find((d) => d.rect && overlaps(box, d.rect));
    if (!hit) return null;
    return (record?.entities ?? []).find((e) => DOOR_TYPES.includes(e.type) && Number(e.x) === hit.x && Number(e.y) === hit.y)
        ?? { type: 'teleporter' };
}
