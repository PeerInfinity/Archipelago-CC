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
    'Puzzlements/Pulser.as:65': remaining('Energy Pulse', 'no ledger records a pulse that reaches nobody; `pulserPushes` sees only pushes'),
    'Puzzlements/Crusher.as:79': remaining('Other', 'the crusher\'s slam test reads its own channel (`soundPercentage("Other", 4)`); no ledger records a slam'),
    'Puzzlements/BeamTower.as:85': remaining('Energy Beam', 'no ledger records a beam firing'),
    'Puzzlements/RopeStart.as:47': remaining('Other', 'the rope cut is not in a ledger with its tick (`pulledRopes` is a set)'),
    'Scenery/BurnableTree.as:33': cued('Burn', '`treeBurns` (its own `t`): index 0'),
    'Scenery/Grass.as:32': remaining('Arrow', 'grass cutting is not modelled'),
    'Scenery/FallRock.as:82': remaining('Rock', '`rockFalls` records the TRIGGER, not the landing tick'),
    'Scenery/FallRockLarge.as:102': remaining('Rock', 'as FallRock.as:82'),
    'Scenery/RockFall.as:76': remaining('Rock', 'no ledger records the break'),
    'Scenery/Moonrock.as:94': remaining('Light', 'no ledger records the moonrock lighting'),
    'Scenery/Moonrock.as:116': remaining('Rock', 'no ledger records the moonrock landing'),
    'Scenery/LightBossTotem.as:50': remaining('Boss Die', 'the Lights fight\'s totems are not in a ledger with a death tick'),
    // ── enemies ─────────────────────────────────────────────────────────
    'Enemies/Enemy.as:80': cued('Enemy Fall', 'a chaser\'s `alpha` leaves 1 while not dying (the pit fade starts) (dist)'),
    'Enemies/Enemy.as:160': cued('Enemy Die', 'a chaser or spinner\'s `hits` rises and it is dying / destroyed (dist; index 0)'),
    'Enemies/Enemy.as:165': cued('Enemy Hit', 'a chaser or spinner\'s `hits` rises and it lives (dist; index 0)'),
    'Enemies/Bob.as:72': remaining('Enemy Hop', 'a hop is not a read'),
    'Enemies/BobSoldier.as:105': remaining('Enemy Hop', 'a hop is not a read'),
    'Enemies/Puncher.as:115': remaining('Punch', 'a punch is not a ledger row'),
    'Enemies/Drill.as:102': remaining('Drill', 'drill surfacing is not a ledger row'),
    'Enemies/Drill.as:108': remaining('Drill', 'as Drill.as:102'),
    'Enemies/Grenade.as:135': remaining('Explosion', 'the Owl\'s grenades: `owlGrenadeEvents` / `placedGrenadeEvents` not yet mapped'),
    'Enemies/Tentacle.as:105': remaining('Tentacle', 'not mapped'),
    'Enemies/TentacleBeast.as:86': remaining('Boss Die', 'not mapped'),
    'Enemies/TentacleBeast.as:96': remaining('Boss Die', 'not mapped'),
    'Enemies/LavaBoss.as:220': remaining('Lava', 'not mapped'),
    'Enemies/LavaBoss.as:247': remaining('Lava', 'not mapped'),
    'Enemies/Bulb.as:61': remaining('Lava', 'not mapped'),
    'Enemies/LightBoss.as:69': remaining('Boss 6 Move', 'a `Rng.cos()` roll on the cosmetic stream; not modelled (⚖ never model the cosmetic RNG)'),
    'Enemies/ShieldBoss.as:146': remaining('Metal Hit', 'not mapped'),
    'Enemies/BossTotem.as:294': remaining('Other', 'not mapped'),
    'Enemies/BossTotem.as:369': remaining('Enemy Attack', 'not mapped'),
    'Enemies/BossTotem.as:393': remaining('Other', 'not mapped'),
    'Enemies/BossTotem.as:455': remaining('Enemy Attack', 'not mapped'),
    'Enemies/BossTotem.as:456': remaining('Enemy Attack', 'not mapped'),
    'Enemies/BossTotem.as:478': remaining('Boss Die', 'not mapped'),
    'Enemies/LavaTrap.as:91': remaining('Enemy Attack', 'not mapped'),
    'Enemies/SandTrap.as:62': remaining('Enemy Attack', 'not mapped'),
    'Enemies/IceTrap.as:44': remaining('Enemy Attack', 'not mapped'),
    'Enemies/DarkTrap.as:35': remaining('Enemy Die', 'not mapped'),
    'Enemies/IceTurret.as:238': remaining('Push Rock', 'not mapped'),
    // ── projectiles ─────────────────────────────────────────────────────
    'Projectiles/Arrow.as:59': remaining('Arrow', 'an arrow\'s landing (`arrowBodyHits`) is per body; the AS3 plays once per arrow per landing tick — not mapped'),
    'Projectiles/TurretSpit.as:37': cued('Turret Shoot', '`spitEvents` `spawn` (its own `t`; dist from the row)'),
    'Projectiles/IceTurretBlast.as:36': remaining('Other', 'not mapped'),
    'Projectiles/Explosion.as:48': cued('Explosion', 'PARTIAL: `bombEvents` `blast` (Bomb.as:62\'s Explosion; dist 120). An enemy\'s death explosion (Enemy.as:205), LavaBall and BossTotemShot remain'),
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
        pushed: (run.pushedBlocks ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y })),
        chasers: (run.chasers ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, hits: c.hits ?? 0, dying: !!c.dying, destroy: !!c.destroy, alpha: c.alpha ?? 1 })),
        spinners: (run.spinnerBodies ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, hits: b.hits ?? 0, destroy: !!b.destroy })),
        responders: (act.responders ?? []).map((r) => ({ id: r.id, tag: r.tag, open: !!r.open, held: r.held ?? 0 })),
        pressers: (act.pressers ?? []).map((p) => ({ id: p.id, tag: p.tag, down: !!p.down })),
        talk: talk ? { key: `${talk.source}|${talk.id}|${talk.tag}`, page: talk.page, pages: talk.pages, length: talk.text.length, at: talk.currentCharacter } : null,
    };
}

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
        pressKeys: same ? prev.pressKeys : new Set(view.presses.map((p) => `${p.weapon}|${p.t}`)),
    };
    if (!same) return { state, cues };
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
    return { state, cues };
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
