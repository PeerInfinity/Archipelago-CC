/**
 * seedlingSoundCues — ⛓ SOUND EFFECTS (slice `seedling-js-sound-effects`, ⚖ the user 2026-10-26).
 *
 *   1. THE CENSUS OF RECORD: every `Music.*` call in `vendor/seedling/src` is a
 *      row of `SOUND_CALL_SITES` (cued / remaining / music), and every row is
 *      a call site — a moved or new call turns this red.
 *   2. THE CUE PINS: on real fixture tapes the cue list per tick is the
 *      committed golden (`fixtures/sound-cue-goldens/`), so a model change
 *      that moves a sound is seen. ⚠ CHANGE DETECTORS:
 *      `UPDATE_SOUND_GOLDENS=1 npx vitest run <this file>`.
 *   3. ⛔ THE NO-FEEDBACK PIN: the same tape with the page's sound stepping
 *      every tick — on with a fake AudioContext, on and LOCKED (never
 *      unlocked), on with a REFUSED context, and off — gives the same
 *      `stateDigest()` after every tick, the same checks and the same ticks.
 *      Audio never feeds the model.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTape } from './tapeRunner.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import {
    COSMETIC_CUE_SEED, LIGHT_BOSS_MOVE_ODDS, SOUND_CALL_SITES, cosmeticStep, distVolPan, posOfId, roomIndexOf, sfxKey, soundCueView,
    stepSoundCues,
} from './seedlingSoundCues.js';
import { createPageSound } from './jsRuntimeSound.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SRC = join(ROOT, 'vendor/seedling/src');
const HAVE_SRC = existsSync(join(SRC, 'Music.as'));
const GOLDENS = join(HERE, 'fixtures/sound-cue-goldens');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = new Map(MAP.levels.map((l) => [l.level, l]));
/** A roster tape (`fixtures/tapes/<name>.json`), or a game witness's EMBEDDED tape (`<dir>/<name>` → `fixtures/<dir>/<name>.json`). */
const fixture = (name) => {
    if (!name.includes('/')) return JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));
    return JSON.parse(readFileSync(join(HERE, 'fixtures', `${name}.json`), 'utf8')).tape;
};
const SFX = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/seedling/sfx/manifest.json'), 'utf8'));
/** The vanilla level set's rooms (the page's twin): the blizzard's `snow_gradient` flag. */
const SET_ROOMS = JSON.parse(readFileSync(join(HERE, 'fixtures/seedling-vanilla-set.json'), 'utf8')).rooms;
const viewOf = (run) => soundCueView(run, { record: RECORDS.get(run.level), snowGradient: !!SET_ROOMS[run.level]?.snow_gradient });

/** A clip's length at 60 fps, from the committed manifest (what the page reads). */
const lengthFrames = (set, index) => {
    const id = SFX.sounds[sfxKey(set)]?.clips[index];
    return id ? Math.max(1, Math.round(SFX.clips[id].seconds * 60)) : 1;
};

// ── 1. the census ────────────────────────────────────────────────────────
const CALL = /Music\.(playSound|playSoundDistPlayer|stopSound|volumeSound|stop|play|loop|fadeToLoop|abruptThenFade)\(/;

/** Every `Music.*(` call in the AS3 (not Music.as itself, not a comment): `{ site, line }`. */
function auditCallSites() {
    const out = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) { if (name !== 'net') walk(p); continue; }
            if (!name.endsWith('.as') || name === 'Music.as') continue;
            readFileSync(p, 'utf8').split(/\r?\n/).forEach((text, i) => {
                const code = text.trim();
                if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('+')) return;
                if (CALL.test(code)) out.push({ site: `${relative(SRC, p)}:${i + 1}`, line: code });
            });
        }
    };
    walk(SRC);
    return out;
}

describe.skipIf(!HAVE_SRC)('1. THE CENSUS OF RECORD — every Music.* call site, by File.as:line', () => {
    const sites = auditCallSites();

    it('the audit is not vacuous (≈80 sites, the ones the brief counted)', () => {
        expect(sites.length).toBeGreaterThan(75);
    });

    it('⛔ every call site has a row (cued / remaining / music) — an unlisted call fails here', () => {
        const unlisted = sites.filter((s) => !(s.site in SOUND_CALL_SITES)).map((s) => `${s.site}  ${s.line}`);
        expect(unlisted).toEqual([]);
    });

    it('⛔ every row is a call site (a stale row — the call moved — fails here)', () => {
        const live = new Set(sites.map((s) => s.site));
        expect(Object.keys(SOUND_CALL_SITES).filter((k) => !live.has(k))).toEqual([]);
    });

    it('a row\'s set is the set its line names, where the line names one literally', () => {
        for (const s of sites) {
            const row = SOUND_CALL_SITES[s.site];
            const m = /"([A-Z][A-Za-z0-9 ]+)"/.exec(s.line);
            if (row.status !== 'music' && m && /playSound/.test(s.line)) expect(`${s.site} ${row.set}`).toBe(`${s.site} ${m[1]}`);
        }
    });

    it('every cued row names its read and its band; every set is a key of the pack', () => {
        for (const [site, row] of Object.entries(SOUND_CALL_SITES)) {
            expect(['cued', 'remaining', 'music'], site).toContain(row.status);
            if (row.status === 'cued') {
                expect(row.from, site).toBeTruthy();
                expect(row.band, site).toBeTruthy();
            }
            if (row.status === 'remaining') expect(row.why, site).toBeTruthy();
            if (row.status !== 'music') expect(SFX.sounds[sfxKey(row.set)], `${site} ${row.set}`).toBeTruthy();
        }
    });

    it('the census counts (a readout, kept honest): cued + remaining + music = every site', () => {
        const by = (st) => Object.values(SOUND_CALL_SITES).filter((r) => r.status === st).length;
        expect(by('cued') + by('remaining') + by('music')).toBe(sites.length);
        expect(by('cued')).toBeGreaterThanOrEqual(30);
    });
});

// ── 2. the cue pins ─────────────────────────────────────────────────────
/**
 * A boot STAND — a `createLevelRun` at `boot`, `n` ticks holding `keys` — for a room no committed tape reaches
 * (the trap skin's test stands L45's ice trap the same way). Named `stand:<level>:<x>,<y>:<n>[:<keys>]`.
 */
const STAND = /^stand:(\d+):(-?\d+),(-?\d+):(\d+)(?::([a-z,]+))?$/;
/** Run a fixture tape (or a stand); `each(t, run)` after every tick. */
function drive(name, each) {
    const m = STAND.exec(name);
    if (m) {
        const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: +m[1], x: +m[2], y: +m[3] }, noDamage: true });
        const keys = new Set((m[5] ?? '').split(',').filter(Boolean));
        for (let t = 0; t < +m[4]; t += 1) { run.advance(keys); each(t, run); }
        return { out: { ticks: [] }, last: run };
    }
    let last = null;
    const out = runTape(fixture(name), {
        levelSource: atlasLevelSource(),
        onTick: (t, now, held, run) => { last = run; each(t, run); },
    });
    return { out, last };
}

/** The per-tick cue lines of a tape: `tick level site set index vol pan`. */
function cueLines(name) {
    const lines = [];
    let st = null;
    drive(name, (t, run) => {
        const r = stepSoundCues(st, viewOf(run), t, { lengthFrames });
        st = r.state;
        // a channel op and a delay are part of the line (only the rows that carry one: older lines are unchanged)
        for (const c of r.cues) {
            lines.push(`${t} L${run.level} ${c.site} "${c.set}" ${c.index} ${c.vol.toFixed(3)} ${c.pan.toFixed(3)}${c.op ? ` op=${c.op}` : ''}${c.delayFrames ? ` +${c.delayFrames}f` : ''}`);
        }
    });
    return { lines, state: st };
}

/** Each tape and the cue sites its golden must contain (so a golden cannot be quietly emptied). */
const CUE_TAPES = Object.freeze([
    { name: 'r9-l0-sword-dash', want: ['Player.as:790', 'Player.as:797'] },
    { name: 'u7-puncher-kill', want: ['Enemies/Enemy.as:165', 'Enemies/Enemy.as:160'] },
    { name: 'r5-l37-burn', want: ['Player.as:863', 'Scenery/BurnableTree.as:33'] },
    { name: 'pit-fall-83', want: ['Player.as:725', 'Player.as:515'] },
    { name: 'pit-fall-chain-85', want: ['Player.as:521', 'Player.as:515'] },
    { name: 'r5-swim-cross', want: ['Player.as:551', 'Player.as:685', 'Teleporter.as:109'] },
    { name: 'r5-l40-part0', want: ['Projectiles/Explosion.as:48', 'Puzzlements/ButtonRoom.as:72', 'Puzzlements/BreakableRock.as:62'] },
    { name: 'pushblock-l65-reach-l63', want: ['Puzzlements/PushableBlock.as:87', 'Player.as:821'] },
    { name: 'u15-turret-spit', want: ['Projectiles/TurretSpit.as:37', 'Player.as:1388'] },
    { name: 'f1-l5-lock-removal', want: ['Puzzlements/ArrowTrap.as:56', 'Projectiles/Arrow.as:59'] },
    { name: 'stance-l46-chest', want: ['Chest.as:74'] },
    { name: 'r6-watcher-talk', want: ['Game.as:1719', 'NPCs/NPC.as:198'] },
    { name: 'r2-walk-1-sword-shield', want: ['Teleporter.as:109'] },
    { name: 'prox-l38-chest', want: ['Puzzlements/Pulser.as:65'] },
    // ── the bosses (slice `seedling-js-sfx-cues`): ≥ 1 tape per boss, each family's sites in its golden ──
    { name: 'r6-shield-kill', want: ['Enemies/ShieldBoss.as:146', 'Enemies/Enemy.as:165', 'Enemies/Enemy.as:160'] },
    { name: 'r6-owl-kill', want: ['Enemies/Grenade.as:135', 'Enemies/Enemy.as:165', 'Enemies/Enemy.as:160', 'Scenery/RockFall.as:76'] },
    { name: 'r6-totem-kill', want: ['Enemies/BossTotem.as:294', 'Enemies/BossTotem.as:369', 'Enemies/BossTotem.as:455', 'Enemies/BossTotem.as:456',
        'Enemies/BossTotem.as:478', 'Projectiles/Explosion.as:48', 'Enemies/Enemy.as:160'] },
    { name: 'lavaboss-witness/kof-policy-kill', want: ['Enemies/LavaBoss.as:220', 'Enemies/LavaBoss.as:247', 'Projectiles/Explosion.as:48'] },
    { name: 'tentaclebeast-witness/tb-policy-s2', want: ['Enemies/TentacleBeast.as:86', 'Enemies/TentacleBeast.as:96', 'Enemies/Tentacle.as:105',
        'Enemies/Enemy.as:160'] },
    { name: 'lights-witness/lights-solve-sword', want: ['Scenery/LightBossTotem.as:50', 'Enemies/LightBoss.as:69', 'Enemies/Enemy.as:165',
        'Enemies/Enemy.as:160'] },
    { name: 'chaser-witness/bulb-l77-lava', want: ['Enemies/Bulb.as:61'] },
    { name: 'r5-bobboss-fire', want: ['Enemies/Enemy.as:165', 'Enemies/Enemy.as:160', 'Scenery/FallRockLarge.as:102'] },
    // ── the rest of the room (same slice): traps, chasers' animation starts, machines, falling things, the blizzard ──
    { name: 'f4-l8-sandtraps', want: ['Enemies/SandTrap.as:62'] },
    { name: 'darktrap-witness/darktrap2-l63-step145-light', want: ['Enemies/DarkTrap.as:35'] },
    { name: 'stand:45:64,70:120', want: ['Enemies/IceTrap.as:44', 'Game.as:1206'] },
    { name: 'stand:45:64,70:30:down', want: ['Game.as:1206', 'Game.as:1207'] },
    { name: 'stand:29:112,144:60:up', want: ['Scenery/FallRock.as:82'] },
    { name: 'u7-puncher-punch', want: ['Enemies/Puncher.as:115'] },
    { name: 'bobsoldier-kill', want: ['Enemies/BobSoldier.as:105'] },
    { name: 'r8-l6-bob-contact', want: ['Enemies/Bob.as:72'] },
    { name: 'drill-witness/drill-l28-pair', want: ['Enemies/Drill.as:102', 'Enemies/Drill.as:108'] },
    { name: 'prox-l40-turret-volley', want: ['Projectiles/IceTurretBlast.as:36'] },
    { name: 'crusher-l42-round-trip', want: ['Puzzlements/Crusher.as:79'] },
    { name: 'ladder2-l104-beam', want: ['Puzzlements/BeamTower.as:85'] },
    { name: 'u14-moonrock-beam', want: ['Scenery/Moonrock.as:94', 'Scenery/Moonrock.as:116'] },
    { name: 'rope-witness/rope-l28-cut', want: ['Puzzlements/RopeStart.as:47'] },
]);

describe('2. THE CUE PINS — on real tapes the per-tick cue list is the committed golden', () => {
    for (const tape of CUE_TAPES) {
        it(`${tape.name}: the cue list per tick; it contains ${tape.want.join(', ')}`, () => {
            const { lines, state } = cueLines(tape.name);
            // a golden's file name: `/` → `__`, a stand's `:` and `,` → `_` (portable to every checkout)
            const path = join(GOLDENS, `${tape.name.replaceAll('/', '__').replace(/[:,]/g, '_')}.txt`);
            if (process.env.UPDATE_SOUND_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${lines.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} — record it with UPDATE_SOUND_GOLDENS=1`).toBe(true);
            expect(lines).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n').filter(Boolean));
            const seen = new Set(lines.map((l) => l.split(' ')[2]));
            for (const site of tape.want) expect(seen, site).toContain(site);
            // every crossing through a door found its door (a pit's crossing plays no "Room")
            expect(state.unmatchedDoors ?? 0).toBe(0);
        }, 120000);
    }

    it('a cue fires ON the tick of its ledger row (band 0): the sword press, the hurt, the chest', () => {
        let st = null;
        const at = [];
        drive('u15-turret-spit', (t, run) => {
            const r = stepSoundCues(st, viewOf(run), t, { lengthFrames });
            st = r.state;
            for (const c of r.cues) if (c.site === 'Player.as:1388') at.push([t, run.playerHits.at(-1).t]);
        });
        expect(at.length).toBeGreaterThan(0);
        // the ledger row's own `t` is the run tick the hit landed on; the cue is emitted right after that tick
        for (const [t, rowT] of at) expect(t).toBe(rowT);
    }, 120000);
});

/** Every tick's cues of a tape, with the run they were read from: `[{ t, run, cues }]` (the run is the LAST one). */
function cuesOf(name) {
    let st = null;
    const out = [];
    let last = null;
    drive(name, (t, run) => {
        const r = stepSoundCues(st, viewOf(run), t, { lengthFrames });
        st = r.state;
        last = run;
        out.push(...r.cues.map((c) => ({ ...c, t })));
    });
    return { cues: out, run: last };
}
const countOf = (cues, site, set) => cues.filter((c) => c.site === site && (!set || c.set === set)).length;

describe('2b. THE BOSSES — each family\'s cues tie out against its own ledger (the golden says WHEN, this says HOW MANY)', () => {
    it('the King of Fire: a Lava 0 per smash (2 runners each), a Lava 1 per fan, an Explosion per ball-hit', () => {
        const { cues, run } = cuesOf('lavaboss-witness/kof-policy-kill');
        const ev = run.lavaBossEvents;
        const n = (k) => ev.filter((r) => r.kind === k).length;
        expect(countOf(cues, 'Enemies/LavaBoss.as:220')).toBe(n('runner') / 2);
        expect(countOf(cues, 'Enemies/LavaBoss.as:247')).toBe(n('fan'));
        expect(countOf(cues, 'Projectiles/Explosion.as:48')).toBe(n('ball-hit'));
        expect(n('fan')).toBeGreaterThan(0);
    }, 120000);
    it('the Tentacled Beast: one wake, one dying, a Tentacle per sink, a cut per tentacle gone', () => {
        const { cues, run } = cuesOf('tentaclebeast-witness/tb-policy-s2');
        const ev = run.tentacleBeastEvents;
        const n = (k) => ev.filter((r) => r.kind === k).length;
        expect(countOf(cues, 'Enemies/TentacleBeast.as:86')).toBe(1);
        expect(countOf(cues, 'Enemies/TentacleBeast.as:96')).toBe(1);
        expect(countOf(cues, 'Enemies/Tentacle.as:105')).toBe(n('tentacle-sank'));
        expect(countOf(cues, 'Enemies/Enemy.as:160', 'Enemy Die')).toBe(n('tentacle-gone'));
    }, 120000);
    it('the BossTotem: woken once, one volley sound per PAIR, two per laser, a hit per landed shot, removed once', () => {
        const { cues, run } = cuesOf('r6-totem-kill');
        expect(countOf(cues, 'Enemies/BossTotem.as:294')).toBe(1);
        expect(countOf(cues, 'Enemies/BossTotem.as:369')).toBe(new Set(run.bossShotsFired.map((r) => r.t)).size);
        expect(countOf(cues, 'Enemies/BossTotem.as:455')).toBe(run.bossLasers.length);
        expect(countOf(cues, 'Enemies/BossTotem.as:456')).toBe(run.bossLasers.length);
        const landed = run.bossHits.filter((r) => r.landed);
        expect(countOf(cues, 'Enemies/Enemy.as:165', 'Enemy Hit')).toBe(landed.filter((r) => !r.killed).length);
        expect(countOf(cues, 'Enemies/Enemy.as:160', 'Boss Die')).toBe(1);
        expect(countOf(cues, 'Projectiles/Explosion.as:48')).toBe(run.bossBlasts.length);
        expect(countOf(cues, 'Enemies/BossTotem.as:478')).toBe(1);
    }, 120000);
    it('the ShieldBoss: the swallowed first hit is silent; one Metal Hit per latch; three big hits, the last a death', () => {
        const { cues } = cuesOf('r6-shield-kill');
        expect(countOf(cues, 'Enemies/Enemy.as:165', 'Enemy Hit')).toBe(2);
        expect(countOf(cues, 'Enemies/Enemy.as:160', 'Enemy Die')).toBe(1);
        expect(cues.filter((c) => c.site.startsWith('Enemies/Enemy.as')).every((c) => c.index === 1)).toBe(true);
        // each Metal Hit is the press AFTER a landed hit (the boss sits again, the latch was cleared by the moveShield's end)
        const metal = cues.filter((c) => c.site === 'Enemies/ShieldBoss.as:146').map((c) => c.t);
        const landed = cues.filter((c) => c.site.startsWith('Enemies/Enemy.as')).map((c) => c.t);
        expect(metal).toEqual(landed.map((t) => t + 1));
    }, 120000);
    it('the Lights: a big hit or death per flier hit, the totem\'s Boss Die once, Boss 6 Move at the game\'s rate', () => {
        // the walk wins the fight and leaves the room (its last run has no `lightsFight`): all six fliers die (`flierNumber` 6)
        const { cues } = cuesOf('lights-witness/lights-solve-sword');
        expect(countOf(cues, 'Enemies/Enemy.as:160')).toBe(6);
        expect(new Set(cues.filter((c) => c.site === 'Enemies/Enemy.as:160').map((c) => c.index))).toEqual(new Set([1]));
        expect(countOf(cues, 'Scenery/LightBossTotem.as:50')).toBe(1);
        expect(countOf(cues, 'Enemies/LightBoss.as:69')).toBeGreaterThan(0);
    }, 120000);
    it('the Owl: a grenade Explosion per `exploded`; the Bob Boss: each form\'s hits, its last a death', () => {
        const owl = cuesOf('r6-owl-kill');
        expect(countOf(owl.cues, 'Enemies/Grenade.as:135')).toBe(owl.run.owlGrenadeEvents.filter((r) => r.what === 'exploded').length);
        expect(countOf(owl.cues, 'Enemies/Enemy.as:160')).toBe(1);
        const bob = cuesOf('r5-bobboss-fire');
        expect(countOf(bob.cues, 'Enemies/Enemy.as:160')).toBe(3);   // three forms
        expect(countOf(bob.cues, 'Enemies/Enemy.as:165')).toBe(4);   // hitsMax 2, 3, 2 → 1 + 2 + 1 survived hits
    }, 120000);
});

describe('2b. THE ROOM — the other families tie out against their own ledgers', () => {
    it('the ice turret: three IceTurretBlast cues per volley; the drill: a cue per axis a hop moved', () => {
        const turret = cuesOf('prox-l40-turret-volley');
        expect(countOf(turret.cues, 'Projectiles/IceTurretBlast.as:36')).toBe(3 * turret.run.volleys.length);
        const drill = cuesOf('drill-witness/drill-l28-pair');
        const hops = drill.run.drills.events.filter((e) => e.kind === 'hop').length;
        const axes = countOf(drill.cues, 'Enemies/Drill.as:102') + countOf(drill.cues, 'Enemies/Drill.as:108');
        expect(axes).toBeGreaterThanOrEqual(hops);
        expect(axes).toBeLessThanOrEqual(2 * hops);
    }, 120000);
    it('the rope: one cue per `ropePulls` row; the Owl\'s rocks: one per `owlRockLandings` row', () => {
        const rope = cuesOf('rope-witness/rope-l28-cut');
        expect(countOf(rope.cues, 'Puzzlements/RopeStart.as:47')).toBe(rope.run.ropePulls.length);
        const owl = cuesOf('r6-owl-kill');
        expect(countOf(owl.cues, 'Scenery/RockFall.as:76')).toBe(owl.run.owlRockLandings.length);
    }, 120000);
    it('the held FallRock: its landing is DELAYED into the hold, short of the freeze\'s end', () => {
        const { cues, run } = cuesOf('stand:29:112,144:60:up');
        const rock = cues.filter((c) => c.site === 'Scenery/FallRock.as:82');
        expect(rock).toHaveLength(1);
        expect(rock[0].delayFrames).toBeGreaterThan(0);
        expect(rock[0].delayFrames).toBeLessThanOrEqual(run.rockFalls[0].deadFrames);
    }, 120000);
    it('the crusher: re-played only once its ONE channel has run 10 %, never on two consecutive ticks', () => {
        const { cues } = cuesOf('crusher-l42-round-trip');
        const ticks = cues.filter((c) => c.site === 'Puzzlements/Crusher.as:79').map((c) => c.t);
        expect(ticks.length).toBeGreaterThan(10);
        const gap = Math.ceil(0.1 * lengthFrames('Other', 4));
        for (let i = 1; i < ticks.length; i += 1) expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(gap);
    }, 120000);
    it('the blizzard: started once in a snowing room, re-gained as the player descends a gradient room, stopped on leaving', () => {
        const { cues } = cuesOf('stand:45:64,70:30:down');
        expect(countOf(cues, 'Game.as:1206')).toBe(1);
        const vols = cues.filter((c) => c.site === 'Game.as:1207').map((c) => c.vol);
        expect(vols.length).toBeGreaterThan(5);
        for (let i = 1; i < vols.length; i += 1) expect(vols[i]).toBeLessThan(vols[i - 1]);   // lower in the room = fainter
        // a hand-built exit: the same room, then a room with no snow → one stop
        const run = { state: { x: 64, y: 70 }, level: 45, ticksCompleted: 0 };
        const snowy = soundCueView(run, { record: RECORDS.get(45) });
        let st = stepSoundCues(null, snowy, 0, { lengthFrames }).state;
        st = stepSoundCues(st, snowy, 1, { lengthFrames }).state;
        const out = stepSoundCues(st, { ...snowy, snowing: false }, 2, { lengthFrames });
        expect(out.cues.map((c) => [c.site, c.op])).toEqual([['Game.as:1212', 'stop']]);
    }, 120000);
});

describe('2c. THE SHIELDBOSS LATCH, by hand (`ShieldBoss.as:130-151`, `endAnim` `:192`)', () => {
    const base = soundCueView({ state: { x: 80, y: 120 }, level: 19, ticksCompleted: 0 });
    const view = (anim, hits = []) => ({ ...base, bosses: { ...base.bosses, shield: [{ id: 'sb', x: 80, y: 32, anim, hits: 0 }], shieldBossHits: hits } });
    const row = (anim, extra = {}) => ({ id: 'sb', anim, swallowed: false, landed: false, killed: false, aborted: false, retaliated: false, ...extra });
    it('a hit on `sit` plays Metal Hit once; the next is held by the latch; a stab chain\'s end clears it', () => {
        const hits = [];
        let st = stepSoundCues(null, view('sit', hits), 0).state;
        const step = (anim, add = []) => {
            hits.push(...add);
            const r = stepSoundCues(st, view(anim, [...hits]), 0);
            st = r.state;
            return r.cues.map((c) => c.site);
        };
        expect(step('moveShield', [row('sit', { retaliated: true })])).toEqual(['Enemies/ShieldBoss.as:146']);
        expect(step('moveShield', [row('moveShield')])).toEqual([]);               // latched
        expect(step('stab')).toEqual([]);                                          // moveShield ENDS → the latch clears
        expect(step('stab', [row('stab')])).toEqual(['Enemies/ShieldBoss.as:146']);
        expect(step('sit')).toEqual([]);                                           // stab ends → clears
        expect(step('sit', [row('sit', { swallowed: true })])).toEqual([]);         // the arming hit: silent
        expect(step('movedShield', [row('movedShield', { landed: true })])).toEqual(['Enemies/Enemy.as:165']);
    });
});

describe('2d. THE COSMETIC STREAM — the cues\' own, never the model\'s', () => {
    it('the cue module imports nothing that carries the gameplay RNG — the player box, three skins\' reducers, the rock replay', () => {
        const src = readFileSync(join(HERE, 'seedlingSoundCues.js'), 'utf8');
        const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
        // the skins are presentation reducers (pure, per tick); `fallRock.js` is the pure FallRock state machine the
        // trap skin's hold replays — none of them draws on a model RNG stream
        expect(imports).toEqual(['./playerPhysicsV2.js', './seedlingTrapSkin.js', './seedlingPuzzleSkin.js', './seedlingEnemySkin.js', './fallRock.js']);
        expect(src).not.toMatch(/\b(run|state|world|s)\.rng|rngState|\.cosRng/);
    });
    it('cosmeticStep is mulberry32, pure; the Boss 6 Move roll hits 1 in 90', () => {
        expect(cosmeticStep(COSMETIC_CUE_SEED)).toEqual(cosmeticStep(COSMETIC_CUE_SEED));
        let a = COSMETIC_CUE_SEED;
        let hits = 0;
        const N = 90000;
        for (let i = 0; i < N; i += 1) {
            const r = cosmeticStep(a);
            a = r.a;
            if (!Math.floor(r.r * LIGHT_BOSS_MOVE_ODDS)) hits += 1;
        }
        expect(hits / N).toBeGreaterThan(0.9 / 90);
        expect(hits / N).toBeLessThan(1.1 / 90);
    });
});

describe('the helpers', () => {
    it('distVolPan is Music.playSoundDistPlayer: pan over half of FP.width (160), linear fall-off to `distance`', () => {
        expect(distVolPan(100, 100, { x: 100, y: 100 })).toEqual({ vol: 1, pan: 0 });
        expect(distVolPan(140, 100, { x: 100, y: 100 })).toEqual({ vol: 0.5, pan: 0.5 });
        expect(distVolPan(500, 100, { x: 100, y: 100 })).toEqual({ vol: 0, pan: 1 });
        expect(distVolPan(40, 100, { x: 100, y: 100 }, 120, 0.5)).toEqual({ vol: 0.25, pan: -0.75 });
        expect(distVolPan(1, 2, null)).toEqual({ vol: 1, pan: 0 });
    });
    it('posOfId reads an entity id; roomIndexOf reads a door\'s record row', () => {
        expect(posOfId('arrowtrap@80,16#0.1')).toEqual({ x: 80, y: 16 });
        expect(posOfId('wand@40#3')).toBeNull();
        expect(roomIndexOf({ type: 'stairsup' })).toBe(1);
        expect(roomIndexOf({ type: 'stairsdown' })).toBe(2);
        expect(roomIndexOf({ type: 'teleporter', attrs: { show: '1' } })).toBe(3);
        expect(roomIndexOf({ type: 'teleporter', attrs: { show: '0' } })).toBe(0);
    });
    it('a new run BASELINES: the first tick of a run emits nothing, whatever its ledgers hold', () => {
        const view = { run: {}, level: 1, tick: 9, player: { x: 0, y: 0 }, doors: [], terrain: 1, swim: { open: true, frames: 0 },
            fall: 'out', slashPresses: [{ outcome: 'slash' }], presses: [], playerHits: [{}], transitions: [{}], chestOpens: [{}],
            rocksBroken: [], treeBurns: [], arrowVolleys: [], spitEvents: [], bombEvents: [], wandShots: [], magicalLocksOpened: [],
            wandLive: [], pulsers: [], pushed: [], chasers: [], spinners: [], responders: [], pressers: [], talk: null };
        expect(stepSoundCues(null, view, 9).cues).toEqual([]);
        expect(stepSoundCues({ run: {} }, view, 9).cues).toEqual([]);
    });
});

// ── 3. the no-feedback pin ──────────────────────────────────────────────
/** A fake AudioContext that records every scheduled start (and never throws). */
function fakeCtx(starts) {
    return class FakeCtx {
        constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
        createGain() { return { gain: { value: 1 }, connect() {} }; }
        createStereoPanner() { return { pan: { value: 0 }, connect() {} }; }
        createBuffer() { return { silent: true }; }
        createBufferSource() {
            const s = { connect() {}, stop() {}, start: (when) => { if (!s.buffer?.silent) starts.push({ buffer: s.buffer, when }); } };
            return s;
        }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData(ab) { return Promise.resolve({ bytes: ab.byteLength }); }
    };
}

/** A window whose fetch reads the committed packs from disk. */
const fsWin = () => ({
    document: { visibilityState: 'visible' },
    navigator: {},
    console: { warn() {} },
    fetch: async (url) => {
        const p = fileURLToPath(url);
        if (!existsSync(p)) return { ok: false, status: 404 };
        const bytes = readFileSync(p);
        return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
});

const NO_FEEDBACK_TAPES = ['u15-turret-spit', 'r5-l40-part0', 'pushblock-l65-reach-l63', 'r6-totem-kill', 'lavaboss-witness/kof-policy-kill'];
/** The page's modes: its query, the game speed (a tick's length), and whether ▶ Start was never pressed. */
const MODES = Object.freeze({
    off: { query: 'sound=off' },
    muted: { query: 'volume=0' },
    locked: { query: '', locked: true },
    refused: { query: '', refused: true },
    on: { query: '' },
    'quarter-speed': { query: '', speed: 0.25 },
    'speed-16': { query: '', speed: 16 },
});

/**
 * Drive `name` with the page's sound in `mode` (`none` = no sound object at all), and return what the model did:
 * every tick's digest, the checks, the end ticks.
 */
async function modelUnderSound(name, mode) {
    const starts = [];
    let sound = null;
    const m = MODES[mode] ?? {};
    if (mode !== 'none') {
        const params = new URLSearchParams(m.query);
        const Ctx = m.refused ? function Refused() { throw new Error('NotAllowedError'); } : fakeCtx(starts);
        sound = createPageSound({ win: fsWin(), params, listen: () => {}, now: () => 0, AudioContextCtor: Ctx });
        if (!m.locked) sound.unlock();
    }
    const tickSeconds = 1 / (30 * (m.speed ?? 1));
    // the page's load is async: let it finish before the tape runs, so the run plays cues against loaded clips
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 50 && sound && sound.readout().loaded === 'loading'; i += 1) await new Promise((r) => setTimeout(r, 20));
    const digests = [];
    const { out, last } = drive(name, (t, run) => {
        sound?.slotRan();
        sound?.step(run, { record: RECORDS.get(run.level), tick: t, tickSeconds });
        digests.push(JSON.stringify(run.stateDigest()));
    });
    return {
        digests, ticks: JSON.stringify(out.ticks), checks: JSON.stringify(last.collected),
        readout: sound?.readout() ?? null, starts,
    };
}

describe('3. ⛔ THE NO-FEEDBACK PIN — audio never feeds the model', () => {
    for (const name of NO_FEEDBACK_TAPES) {
        it(`${name}: digests after every tick, the checks and the ticks are identical — no sound / ${Object.keys(MODES).join(' / ')}`, async () => {
            const base = await modelUnderSound(name, 'none');
            expect(base.digests.length).toBeGreaterThan(50);
            for (const mode of Object.keys(MODES)) {
                const r = await modelUnderSound(name, mode);
                expect(r.digests, mode).toEqual(base.digests);
                expect(r.ticks, mode).toBe(base.ticks);
                expect(r.checks, mode).toBe(base.checks);
                if (mode === 'on' || mode === 'muted' || mode.includes('speed')) {
                    expect(r.readout.cues, mode).toBeGreaterThan(0);
                    expect(r.readout.state).toBe('running');
                }
                if (mode === 'refused') expect(r.readout.state).toBe('refused');
                if (mode === 'locked') expect(r.readout.state).toBe('locked');
                if (mode === 'off') expect(r.readout.cues).toBe(0);
            }
        }, 240000);
    }
});
