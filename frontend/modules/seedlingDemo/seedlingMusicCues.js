/**
 * seedlingMusicCues — **WHICH SEEDLING SONG PLAYS WHEN**, read out of the run
 * (Seedling JS music, ⚖ the user 2026-10-26: "I'll also want to implement the
 * music unless there's a licensing issue. I would prefer for the sound and its
 * timing to match exactly, but that's not as critical as the gameplay
 * timing"; GO 2026-10-27).
 *
 * The game's music is `Game.musicUpdate()` (`Game.as:1200-1269`), called once
 * a frame, choosing the room's song from `Game.levelMusics[level]`, plus the
 * jingles a pickup and the seal ceremony play over it (`Music.abruptThenFade`,
 * `Pickup.as:81`, `SealController.as:167`), plus the seven boss classes that
 * WRITE `levelMusics[level]` (`bossMusic` on waking, −1 on death). This module
 * mirrors those rules and nothing else; the mixing (`Music.update`'s fades,
 * the interrupt, the day/night pair) is the generic mixer's
 * (`musicLibrary/musicLibrary.js`), configured here with Music.as's numbers.
 *
 * ⛔ MUSIC NEVER FEEDS THE MODEL. Everything here is READ from the run's
 * EXISTING getters (the ones the skins and the sfx cues read — no new
 * `levelRun` getter, so no design check is owed) and from the level set's room
 * table; nothing writes the run, and nothing the mixer says is read back by
 * anything that does. The model's own sound clock (`soundPosition`,
 * `soundIsPlaying` — the Swim pin) is the SFX channels', never a song's.
 *
 * THE TWO HALVES, and why they are split:
 *   · `stepMusicCues(prev, view, tick)` — PURE, from the run alone: the
 *     tick's jingles and `levelMusics` writes, and the TARGET `musicUpdate`
 *     chooses (a song, silence, or the Watcher stop). Goldened per tick.
 *   · `musicFrame(mixer, target, view)` — one `musicUpdate` against the mixer:
 *     its `if (!songs[i].playing) fadeToLoop(...)` reads the MIXER (a song's
 *     own life), which a pure function of the run cannot.
 *
 * TIMING (band 0 = the tick the AS3 runs it). `musicUpdate` runs at the top of
 * `Game.update`, before the entities (`Game.as:858` vs `:883`), so frame N's
 * choice reads the level, the bag and `levelMusics` as frame N−1 left them:
 * the target a tick returns is computed from `prev`. A jingle is played by the
 * entity's update in the same frame (band 0). Fades are counted in FRAMES (the
 * mixer steps once per tick slot), so they scale with the game speed; a song
 * itself plays at its own pitch and tempo at every speed.
 */
import { NIGHT } from './seedlingNightSkin.js';

const K = (name) => `seedling:music/${name}`;

/**
 * `Music.songs` (`Music.as:218-220`), the array `Game.levelMusics` indexes, as
 * music-layer keys (`seedlingMusicLayer.musicKeyOf`). PINNED to the parsed AS3
 * by `seedlingMusicCues.test.js`.
 */
export const SONG_KEYS = Object.freeze([
    K('theme'), K('theme-night'), K('menu'), K('yes-master'), K('my-lifes-purpose'),
    K('the-watcher'), K('my-first-dungeon'), K('stuck-in-the-forest'), K('mysterious-magic'), K('cold-blooded'),
    K('shadow'), K('lava-is-hot'), K('the-sky'), K('boss'),
]);
/** `Game.as:198` `bossMusic`. */
export const BOSS_MUSIC = 13;
/** `Game.as:1219` — the Watcher's song index. */
export const WATCHER_SONG = 5;
/** `Game.as:1225-1228` — before the sword, the Watcher's and the overworld's rooms play `songs[4]`. */
export const NO_SWORD_SONG = 4;
/** `Game.as:1228/1233/1237` — `fadeToLoop(…, 0.05)`: 20 frames. */
export const MUSIC_FADE_RATE = 0.05;
/** `Music.as:228/232` `bkgdVolumeMax` / `fadeVolumeMax`. */
export const MUSIC_MAX_VOLUME = 0.5;
/** `Music.as:270-271` — the menu song is played 1.5× louder as the background. */
export const MENU_SONG_GAIN = 1.5;
/** The jingles `abruptThenFade` plays (`Pickup.as:35`, `SealPiece.as:26`, `BossKey.as:31`, `SealController.as:167`). */
export const JINGLES = Object.freeze({ foundIt: K('found-it'), sealPiece: K('seal-piece'), seal: K('seal'), key: K('key') });
/** `Pickup.as:36` `myVolume` — no subclass changes it. */
export const PICKUP_JINGLE_VOLUME = 0.5;
/** `ShieldBoss.as:75` — the boss music arms within this distance, every frame. */
export const SHIELD_BOSS_MUSIC_RANGE = 96;
const THEME = SONG_KEYS[0];
const THEME_NIGHT = SONG_KEYS[1];

/**
 * THE MUSIC CENSUS OF RECORD — every music call site in `vendor/seedling/src`
 * (bar `Music.as`): each `Music.fadeToLoop|abruptThenFade|stop|play|loop(`,
 * each `levelMusics[…] =` write and each `…VolumeMaxExtern =` write, keyed
 * `File.as:line`. `cued` rows name the read and the band (0 = the tick the
 * AS3 runs it); `remaining` rows say why no read sees it.
 * `seedlingMusicCues.test.js` fails on an unlisted site and on a stale row.
 */
const cued = (from, band = '0') => Object.freeze({ status: 'cued', from, band });
const remaining = (why) => Object.freeze({ status: 'remaining', why });
export const MUSIC_CALL_SITES = Object.freeze({
    // ── Game.musicUpdate ──
    'Game.as:1216': remaining('the title menu song: the JS runtime has no title menu (`Game.menu` is false in play)'),
    'Game.as:1221': cued('`musicTarget` op `stop`: the Watcher\'s room (song 5, not exempt) with the sword and no shield, from `inventory`', '0 (frame-top: the previous tick\'s level and bag)'),
    'Game.as:1228': cued('`musicTarget`: no sword in the Watcher\'s or a song-0 room (not exempt) → `songs[4]`', '0 (frame-top)'),
    'Game.as:1233': cued('`musicTarget`: the room\'s `levelMusics` (the level set\'s `music`, or a boss\'s write) → `songs[i]`', '0 (frame-top)'),
    'Game.as:1237': cued('`musicTarget` op `silence`: `levelMusics` −1 (a boss room before its boss wakes / after it dies)', '0 (frame-top)'),
    'Game.as:692': cued('a new Game restores the extern cap to 1: a new run has no seal piece out (`sealPiece` null)'),
    // ── the jingles ──
    'Pickups/Pickup.as:81': cued('`ceremonyStarts` (Found It!, or The Key for a `bosskey`, vol 0.5) and `sealCollections` (One Piece, vol 0.5); '
        + 'a pickup with no ceremony (a heart, a coin) is in no ledger and plays nothing'),
    'SealController.as:167': cued('`sealCollections`: Of The Puzzle, QUEUED behind the piece\'s jingle',
        '+150+60 dead frames in the game; the JS run spends them inside the collecting tick, so it plays when One Piece completes'),
    'SealController.as:221': cued('the extern cap back to 1 when `sealPiece` goes null (the collecting tick)'),
    'Pickups/SealPiece.as:29': cued('the extern cap 0 (background) while `sealPiece` is non-null (from the chest\'s spawn)'),
    'Pickups/SealPiece.as:30': cued('the extern cap 0 (fade) — as SealPiece.as:29'),
    // ── the seven bosses' `levelMusics[level]` writes (`bossWrites`) ──
    'Enemies/ShieldBoss.as:77': cued('`shieldBosses`: not destroyed, within 96 px of the player (every frame, no latch)', '0 / +1 (the player\'s position after the tick, not at the boss\'s update)'),
    'Enemies/ShieldBoss.as:94': cued('`shieldBosses` `destroy`'),
    'Enemies/FinalBoss.as:105': cued('`finalBosses` `started`'),
    'Enemies/FinalBoss.as:235': cued('`finalBosses` `destroy`'),
    'Enemies/LavaBoss.as:108': cued('`lavaBossFight.boss.startAttacking`'),
    'Enemies/LavaBoss.as:140': cued('`lavaBossFight.boss.destroy`'),
    'Enemies/TentacleBeast.as:85': cued('`tentacleBeastFight.beast.activated`'),
    'Enemies/TentacleBeast.as:97': cued('`tentacleBeastFight.beast.dead`'),
    'Enemies/LightBossController.as:83': cued('`lightsFight` `madeFliers`'),
    'Enemies/LightBossController.as:105': cued('`lightsFight` `totemDie` (`endState` runs with it)'),
    'Enemies/BossTotem.as:295': cued('`bossesWoken` (activated)'),
    'Enemies/BossTotem.as:479': cued('`bossesWoken` `removed`'),
    'Enemies/BobBoss.as:48': cued('`bobBoss` has a `boss` row (each form\'s constructor writes it)'),
    'Enemies/BobBoss.as:195': cued('`bobBoss` has `fire` / `fireCollected` / a pending fire (the last form\'s death)', '0 / +1'),
});

/** The mixer's options: Music.as's ceiling, the menu's gain, the day theme's night partner. */
export function seedlingMixerOptions(lengthOf) {
    return {
        lengthOf,
        maxVolume: MUSIC_MAX_VOLUME,
        gainOf: (key) => (key === SONG_KEYS[2] ? MENU_SONG_GAIN : 1),
        partnerOf: (key) => (key === THEME ? THEME_NIGHT : null),
    };
}

/**
 * The level set's per-room music (`music`, `music_override_exempt`), as a
 * `Map(room id → { music, exempt })`. `rooms` is a level set's `rooms` (the
 * mounted set's, or the vanilla twin's).
 */
export function roomMusicTable(rooms) {
    const table = new Map();
    for (const r of rooms ?? []) {
        if (Number.isInteger(r?.id) && Number.isInteger(r.music)) table.set(r.id, { music: r.music, exempt: r.music_override_exempt === true });
    }
    return table;
}

/**
 * `Game.musicUpdate`'s Theme volume (`Game.as:1241-1263`): dawn rises, day is
 * full, twilight falls, night is silent (the night song is its complement).
 * `gameTime` is `Game.time`; null (a clock the boot never declared) = day.
 */
export function themeDayLevel(gameTime) {
    if (!Number.isFinite(gameTime)) return 1;
    const t = gameTime % (NIGHT.dayLength + NIGHT.nightLength);
    const q = NIGHT.dayLength / 4;
    if (t < q) return t / q;
    if (t < q * 3) return 1;
    if (t < NIGHT.dayLength) return 1 - (t - q * 3) / q;
    return 0;
}

const read = (run, name, fallback) => {
    try { return name in run ? run[name] ?? fallback : fallback; } catch { return fallback; }
};

/**
 * THE BOSS WRITES — `Game.levelMusics[level] = bossMusic | -1` — as LEVEL
 * conditions on the boss reads the skins already use. −1 wins (a dead boss
 * stays dead). Each row names its AS3 lines; the band is in the census.
 */
function bossWrites(run, player) {
    const out = [];
    for (const b of read(run, 'shieldBosses', []) ?? []) {
        if (b.destroy) out.push({ site: 'Enemies/ShieldBoss.as:94', value: -1 });
        else if (!b.removed && Math.hypot(b.x - player.x, b.y - player.y) <= SHIELD_BOSS_MUSIC_RANGE) out.push({ site: 'Enemies/ShieldBoss.as:77', value: BOSS_MUSIC });
    }
    for (const b of read(run, 'finalBosses', []) ?? []) {
        if (b.destroy) out.push({ site: 'Enemies/FinalBoss.as:235', value: -1 });
        else if (b.started) out.push({ site: 'Enemies/FinalBoss.as:105', value: BOSS_MUSIC });
    }
    const lava = read(run, 'lavaBossFight', null)?.boss;
    if (lava?.destroy) out.push({ site: 'Enemies/LavaBoss.as:140', value: -1 });
    else if (lava?.startAttacking) out.push({ site: 'Enemies/LavaBoss.as:108', value: BOSS_MUSIC });
    const beast = read(run, 'tentacleBeastFight', null)?.beast;
    if (beast?.dead) out.push({ site: 'Enemies/TentacleBeast.as:97', value: -1 });
    else if (beast?.activated) out.push({ site: 'Enemies/TentacleBeast.as:85', value: BOSS_MUSIC });
    for (const f of read(run, 'lightsFight', []) ?? []) {
        if (f.totemDie) out.push({ site: 'Enemies/LightBossController.as:105', value: -1 });
        else if (f.madeFliers) out.push({ site: 'Enemies/LightBossController.as:83', value: BOSS_MUSIC });
    }
    for (const b of read(run, 'bossesWoken', []) ?? []) {
        if (b.removed) out.push({ site: 'Enemies/BossTotem.as:479', value: -1 });
        else out.push({ site: 'Enemies/BossTotem.as:295', value: BOSS_MUSIC });
    }
    const bob = read(run, 'bobBoss', null);
    if (bob instanceof Map) {
        if (bob.has('fire') || bob.has('fireCollected') || bob.get('pending')?.fire) out.push({ site: 'Enemies/BobBoss.as:195', value: -1 });
        else if (bob.has('boss')) out.push({ site: 'Enemies/BobBoss.as:48', value: BOSS_MUSIC });
    }
    const dead = out.find((w) => w.value === -1);
    return dead ? [dead] : out.slice(0, 1);
}

/**
 * THE VIEW — what the music reads, as plain copies (null with no run).
 * `rooms` is `roomMusicTable(...)`.
 */
export function musicCueView(run, { rooms = null } = {}) {
    if (!run?.state) return null;
    const inv = read(run, 'inventory', {}) ?? {};
    const player = { x: run.state.x, y: run.state.y };
    return {
        run,
        rooms,
        level: run.level,
        hasSword: inv.hasSword === true,
        hasShield: inv.hasShield === true,
        gameTime: read(run, 'gameTime', null),
        ceremonyStarts: read(run, 'ceremonyStarts', []) ?? [],
        // `SealPiece.as:29-30`: while a seal piece is in the world the background and fade are capped at 0
        // (`MaxExtern = 0`), restored when its SealController leaves (`SealController.as:221`) — the same tick here
        sealPieceOut: read(run, 'sealPiece', null) !== null,
        sealCollections: read(run, 'sealCollections', []) ?? [],
        bossWrites: bossWrites(run, player),
    };
}

/**
 * `Game.musicUpdate`'s choice (`Game.as:1217-1239`) for a level, a bag and a
 * `levelMusics` value: `{ site, op: 'stop' }` (the Watcher's room once the
 * sword is in hand without the shield), `{ site, op: 'song', key }`, or
 * `{ site, op: 'silence' }` (`fadeToLoop(null)`: a boss room before its boss
 * wakes, and after it dies).
 */
export function musicTarget({ music, exempt, hasSword, hasShield }) {
    if (hasSword && !hasShield && music === WATCHER_SONG && !exempt) return { site: 'Game.as:1221', op: 'stop' };
    if (!hasSword && (music === WATCHER_SONG || music === 0) && !exempt) return { site: 'Game.as:1228', op: 'song', key: SONG_KEYS[NO_SWORD_SONG] };
    if (music >= 0 && music < SONG_KEYS.length) return { site: 'Game.as:1233', op: 'song', key: SONG_KEYS[music] };
    return { site: 'Game.as:1237', op: 'silence' };
}

/** `levelMusics[level]`: the boss-written value when there is one, else the room table's (unknown room = silence). */
const levelMusicOf = (overrides, rooms, level) => (overrides.has(level) ? overrides.get(level) : rooms?.get(level)?.music ?? -1);

/** The fresh rows of a ledger since the last tick (a ledger only grows within a run). */
const fresh = (list, seen) => (list.length > seen ? list.slice(seen) : []);

/**
 * One GAME tick (call after every `tick()`). Pure: `{ state, cues, target }`.
 * `cues` = `{ site, op: 'jingle', key, vol, queue? }` and
 * `{ site, op: 'levelMusic', level, value }`; `target` = `musicTarget` as this
 * tick's frame began (from `prev`). A new run BASELINES its ledgers (their
 * history is not this tick's music), but `levelMusics` is the GAME's static
 * table and carries across runs — it is re-seeded only with a new room table
 * (`LevelSet.seedRuntimeTables`, at a set's activation).
 */
export function stepMusicCues(prev, view, tick) {
    if (!view) return { state: prev, cues: [], target: null };
    const sameRun = !!prev && prev.run === view.run;
    const overrides = prev && prev.rooms === view.rooms ? new Map(prev.overrides) : new Map();
    const before = prev && prev.rooms === view.rooms ? prev : null;
    const frameTop = before
        ? { level: before.level, hasSword: before.hasSword, hasShield: before.hasShield }
        : { level: view.level, hasSword: view.hasSword, hasShield: view.hasShield };
    const target = musicTarget({
        music: levelMusicOf(overrides, view.rooms, frameTop.level),
        exempt: view.rooms?.get(frameTop.level)?.exempt === true,
        hasSword: frameTop.hasSword, hasShield: frameTop.hasShield,
    });
    const cues = [];
    if (sameRun) {
        for (const c of fresh(view.ceremonyStarts, prev.lens.ceremonyStarts)) {
            const key = c.tag === 'bosskey' ? JINGLES.key : JINGLES.foundIt;
            cues.push({ site: c.tag === 'bosskey' ? 'Pickups/BossKey.as:31' : 'Pickups/Pickup.as:81', op: 'jingle', key, vol: PICKUP_JINGLE_VOLUME, at: tick });
        }
        for (let i = 0; i < fresh(view.sealCollections, prev.lens.sealCollections).length; i += 1) {
            cues.push({ site: 'Pickups/SealPiece.as:26', op: 'jingle', key: JINGLES.sealPiece, vol: PICKUP_JINGLE_VOLUME, at: tick });
            // The SealController's jingle comes 150 + 60 dead frames later in the game (phase A, then `alphaStep`
            // reaching `alphaSteps`); the JS run spends those dead frames inside this one tick, so it is QUEUED
            // behind the piece's jingle instead of cutting it — the order the game plays them in.
            cues.push({ site: 'SealController.as:167', op: 'jingle', key: JINGLES.seal, vol: 1, queue: true, at: tick });
        }
    }
    for (const w of view.bossWrites) {
        if (levelMusicOf(overrides, view.rooms, view.level) === w.value && overrides.has(view.level)) continue;
        overrides.set(view.level, w.value);
        cues.push({ site: w.site, op: 'levelMusic', level: view.level, value: w.value, at: tick });
    }
    const state = {
        run: view.run, rooms: view.rooms, overrides,
        level: view.level, hasSword: view.hasSword, hasShield: view.hasShield, gameTime: view.gameTime, sealPieceOut: view.sealPieceOut,
        lens: { ceremonyStarts: view.ceremonyStarts.length, sealCollections: view.sealCollections.length },
    };
    return { state, cues, target };
}

/** The target for a frame with no tick (a held dead frame): the state as the last tick left it. */
export function heldTarget(state) {
    if (!state) return null;
    return musicTarget({
        music: levelMusicOf(state.overrides, state.rooms, state.level),
        exempt: state.rooms?.get(state.level)?.exempt === true,
        hasSword: state.hasSword, hasShield: state.hasShield,
    });
}

/**
 * ONE `Game.musicUpdate` (`Game.as:1215-1268`) against the mixer, then the
 * tick's jingles (the entities' updates come after it in the frame). The
 * caller then steps the mixer one frame (`Music.update`, `Main.as:88`).
 */
export function musicFrame(mixer, target, { cues = [], gameTime = null, sealPieceOut = false } = {}) {
    mixer.setExternVolume(sealPieceOut ? 0 : 1);
    if (target?.op === 'stop') mixer.stop({ over: false, bkgd: true, fade: true });
    else if (target?.op === 'song') { if (!mixer.isPlaying(target.key)) mixer.fadeTo(target.key, MUSIC_FADE_RATE); }
    else if (target?.op === 'silence') mixer.fadeTo(null, MUSIC_FADE_RATE);
    mixer.setDefaultVolume(mixer.isPlaying(THEME) ? themeDayLevel(gameTime) : 1);
    for (const c of cues) if (c.op === 'jingle') mixer.interrupt(c.key, c.vol, { queue: !!c.queue });
}
