/**
 * seedling-fidelity-terrain — the divergence sweep's "terrain" rows, as GAME WITNESSES replayed on the model.
 *
 * Each fixture in `fixtures/contact-witness/` is one leg the production wasm engine served on p4f
 * (`probe-seedling-contact-divergence.mjs --capture`): the solve request as the engine sent it, the leg's room
 * record from the delivered set, the plan, and every game tick the in-page sampler read while the game played it.
 * `replay-seedling-contact-capture.mjs` rebuilds the model's run and compares the player tick by tick.
 *
 * The pins:
 *   - switches all OFF (the BEFORE model): every witness leaves the model at the tick the sweep named, and the game's side
 *     of that tick carries `hits` 0 → 1 or a body the model's run lacks (it is a CONTACT, not terrain);
 *   - each switch alone fixes exactly its own rows (W1 the two ray rows, W2 the three struck-flyer rows, W3 the
 *     four L88 rows), which is also the mutation: switch one off and its rows come back at their tick;
 *   - all ON (the shipped default since LINEFLIP): the nine reproduce the game at 0 px; the four residue rows still
 *     leave at their named tick.
 *   - ⛓ fidelity BOBSOLDIER: W4 (`bobSoldierLive`) moves legs 308/309 from residue to fixed — eleven reproduce, two
 *     residue rows (576 AXE, 589 ARRIVAL) remain.
 *   - ⛓ JS wave-16 wiring: 589 re-captured at the `Bot`'s observation point (`seedlingContactLab`'s LAST poll per tick);
 *     its rule is `buttonFallReleaseStep` (fidelity SMALLGAPS D1), and twelve reproduce — 576 is the one residue row.
 *   - ⚖ (user, 2026-10-15, fidelity planning-8): 576's 10-05 capture is DELETED — today's plan for that leg plays to
 *     `done` even with every switch OFF (JS witness refresh), so the parted capture witnessed a plan no one walks. Twelve
 *     witnesses, all of which reproduce at the defaults; no residue row remains.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayCapture } from '../../../scripts/procgen/replay-seedling-contact-capture.mjs';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'contact-witness');
const load = (id) => JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));

/**
 * leg id → [the tick the sweep named, the switch that fixes it, or null for residue]
 *
 * ⛓ JS witness refresh: the solver's plans for 264, 269, 308, 309, 659, 661 and 666 had drifted since the 10-05
 * captures (fidelity's model changes), so those seven were re-captured under today's plans (switches none,
 * `--poll=last`) and their ticks re-pinned from the replay. The other five are the 10-05 captures, byte-untouched
 * (their plans are unchanged). 269's closing rule moved: the 10-05 plan was struck by a wallflyer
 * (`wallFlyerSwordHits`); on today's plan the model takes a hit the game does not take (a WallFlyer and two Bobs in
 * reach), and `collideLinePointsExact` alone closes it.
 */
const ROWS = {
    243: [52, 'wallFlyerSwordHits'], // L22, wallflyer@64,80 struck at t46 in the game
    251: [60, 'wallFlyerSwordHits'], // L22
    269: [70, 'collideLinePointsExact'], // L25, the model takes a hit the game does not (10-05: t55, wallFlyerSwordHits)
    264: [116, 'collideLinePointsExact'], // L25, a knockback in the game the model lacks; WallFlyer@72,79 and two Bobs in reach (10-05: t80)
    283: [19, 'collideLinePointsExact'], // L27, the launch a tick early in the model
    659: [96, 'drillLive'], // L88, the drill@104,184 hops onto the player (10-05: t48)
    661: [96, 'drillLive'], // (10-05: t48)
    663: [104, 'drillLive'],
    666: [98, 'drillLive'], // L88, the drill@136,136 (10-05: t53)
    308: [95, 'bobSoldierLive'], // L30 BobSoldier — its sword (fidelity BOBSOLDIER W4; 10-05: t67)
    309: [131, 'bobSoldierLive'], // L30 BobSoldier — its sword (10-05: t66)
    // L74 — the arrival button's release step a tick late in the model (fidelity SMALLGAPS D1). ⛓ JS wave-16 wiring: the
    // 10-05 capture took each tick's FIRST poll, 20 frames into the 175-frame freeze (t1 y 136, vy 0), which read as
    // L74ARRIVAL's frozen t1 (`arrivalButtonArm`); at the `Bot`'s own observation point t1 is the release step (135.2,
    // vy −0.8), every other common sample unchanged (re-captured with switches none, `--poll=last`).
    589: [2, 'buttonFallReleaseStep'],
};
/** ⛓ fidelity L74ARRIVAL: a capture shorter than the usual window (589 holds the game's t0–t4 only). */
const SHORT = { 589: 5 };
/**
 * A row the model leaves on something other than a contact knockback — no `hits` moves at its tick.
 * 589: the arrival button's freeze.
 */
const NOT_A_CONTACT = { 589: 'the arrival button freeze' };
/**
 * ⛓ JS wave-16 wiring — a row whose mutant (every switch but its own) leaves it at ANOTHER tick. 589: `arrivalButtonArm`
 * without `buttonFallReleaseStep` freezes the arrival's t1, where the `Bot` reads the release step — it parts a tick
 * earlier than the all-OFF model, which moves on t1 and stalls on t2.
 */
const MUTANT_TICK = { 589: 1 };
const ALL_OFF = Object.fromEntries(Object.keys(CONTACT_FIDELITY).map((k) => [k, false]));

describe('contact witnesses (fixtures/contact-witness)', () => {
    it('holds exactly the twelve measured legs', () => {
        const ids = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => Number.parseInt(f, 10)).sort((a, b) => a - b);
        expect(ids).toEqual(Object.keys(ROWS).map(Number).sort((a, b) => a - b));
    });

    // ⛓ a measuring run sets SEEDLING_CONTACT_FIDELITY on purpose; the default is what this pins
    // ⛓ TERRAIN D3 shipped W2 and W3 ON; LINEFLIP turned W1 ON (licensed: r9-solve-18 re-recorded on the game, 510 → 519 t)
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_STRIKE_IFRAME_LAPSE
        || !!process.env.SEEDLING_FALLROCK_POSTFALL || !!process.env.SEEDLING_FORECAST_SPEED_BY_TERRAIN
        || !!process.env.SEEDLING_ARRIVAL_BUTTON_ARM
        || !!process.env.SEEDLING_UNBILLED_DAMAGE_GATE || !!process.env.SEEDLING_BUTTON_FALL_RELEASE_STEP
        || !!process.env.SEEDLING_WAYPOINT_SLIDE || !!process.env.SEEDLING_LAVA_CHAIN_PLAYER_HIT
        || !!process.env.SEEDLING_CEREMONY_SHOVE
        || !!process.env.SEEDLING_FLYER_LIVE
        || !!process.env.SEEDLING_BEAMTOWER_DRIFT || !!process.env.SEEDLING_BEAMTOWER_BEAM_HIT
        || !!process.env.SEEDLING_SPINNING_AXE_PLAYER_HIT || !!process.env.SEEDLING_PARTIAL_DODGE_REPROBE
        || !!process.env.SEEDLING_CORRIDOR_BODY_PRICING
        || !!process.env.SEEDLING_ARROW_LANE_CROSSING
        || !!process.env.SEEDLING_AXE_TIMING_RUNG || !!process.env.SEEDLING_AXE_GATE_TRANSIT
        || !!process.env.SEEDLING_STATUE_TALK_RANGE)('the shipped defaults: all three ON', () => {
        // ⛓ fidelity BOBSOLDIER: W4 `bobSoldierLive` ships ON as well; W5 `chaserPointExact` was retired as a switch at
        // the wave-8 harvest (its OFF arm was a second `Point.length` spelling — the one-spelling law).
        // ⛓ fidelity WALLFLYER: W6 `wallFlyerKill` and W7 `wallFlyerShieldBump` ship ON (nothing committed moved).
        // ⛓ fidelity STATICLADDER D2: `darkTrapLight` shipped OFF; ⚖ (user, 2026-10-10) ON at the wave-10 harvest, then
        // OFF again the same day (game-refuted in L65 by PUSHBLOCK) until a fix slice re-witnesses it.
        expect(CONTACT_FIDELITY).toEqual({ collideLinePointsExact: true, wallFlyerSwordHits: true, drillLive: true,
            bobSoldierLive: true, wallFlyerKill: true, wallFlyerShieldBump: true, darkTrapLight: true,
            // ⛓ fidelity DARKTRAP2 D2: the spear's `spearing` window and the press a pit fall burns — ⚖ (user, 2026-10-10, "Yes to all") ON since the wave-11 harvest, with
            // `darkTrapLight` (DARKTRAP2 re-witnessed L62/L65/L63).
            spearingWindow: true, fallBurnsPress: true,
            // ⛓ fidelity BULB: W8 `bulbLive` — ⚖ (user, 2026-10-10, "Yes to all") ON since the wave-11 harvest.
            bulbLive: true,
            // ⛓ fidelity LEASH D2: `baitForecast` (`solverBot.BAIT_FORECAST`) shipped OFF — ⚖ (user, 2026-10-11) ON since
            // the wave-12 harvest.
            baitForecast: true,
            // ⛓ fidelity FORCEDHIT D2: `forcedHits` (`forcedHit.FORCED_HITS`) — ⚖ ON since the wave-13 harvest.
            forcedHits: true,
            // ⛓ fidelity BOMBPUSHER D2: `bombPusherLive` (the lobber, its Bomb and its Explosion) — ⚖ ON since the wave-13 harvest.
            bombPusherLive: true,
            // ⛓ fidelity MOVINGWAIT D2: `movingWait` (`solverBot.MOVING_WAIT`, a latched wait inside a lobber's reach
            // paces) ships OFF.
            movingWait: false,
            // ⛓ fidelity MOVINGWAIT D4: `totemShotBlastInt` (the totem shot's Explosion at its int point, r 15) and
            // `rebootShake` (a death reboot settles the camera through the shake) shipped OFF — ⚖ (user, 2026-10-12,
            // "Both ON") ON since the wave-14 flip.
            totemShotBlastInt: true,
            rebootShake: true,
            // ⛓ fidelity L74LEG624: `strikeIframeLapse` (D3), `fallRockPostFall` (D2), `forecastSpeedByTerrain` (D4)
            // shipped OFF — ⚖ (user, 2026-10-12, "All three ON") ON since the wave-14 flip (fidelity FLIP14); the lapse
            // waited for STRIKELAPSE + LAPSECOST (its flip, licensed ⚖ 2026-10-14, "Flip after DD lands").
            strikeIframeLapse: true, fallRockPostFall: true, forecastSpeedByTerrain: true,
            // ⛓ fidelity L74ARRIVAL: `arrivalButtonArm` (a button under a room arrival presses on the first live
            // frame) ships OFF.
            arrivalButtonArm: false,
            // ⛓ fidelity UNBILLEDGATE D2: `unbilledDamageGate` (`solverBot.UNBILLED_DAMAGE`) ships OFF.
            unbilledDamageGate: false,
            // ⛓ fidelity SMALLGAPS: `buttonFallReleaseStep` (D1), `waypointSlide` (D2), `lavaChainPlayerHit` (D3) shipped OFF —
            // ⚖ (user, 2026-10-14, "Flip all three") ON since the wave-16 harvest.
            buttonFallReleaseStep: true, waypointSlide: true, lavaChainPlayerHit: true,
            // ⛓ fidelity CEREMONYSHOVE D2: `ceremonyShove` (a pickup ceremony's dead frames stepped) shipped OFF —
            // ⚖ (user, 2026-10-14, "Flip now") ON since the wave-16 harvest.
            ceremonyShove: true,
            // ⛓ fidelity LAPSECOST D2: `flyerLive` (the Flyer stepped: its chase, its "fall" and its drop) ships OFF.
            flyerLive: false,
            // ⛓ fidelity BEAMTOWER: `beamTowerDrift` (D1, the tower's Solid drifts with its `y`) and `beamTowerBeamHit`
            // (D3, the run bills the beam on the player) ship OFF.
            beamTowerDrift: false, beamTowerBeamHit: false,
            // ⛓ fidelity SPINNINGAXE D1: `spinningAxePlayerHit` (a spinning axe bills the player) ships OFF.
            spinningAxePlayerHit: false,
            // ⛓ fidelity SPINNINGAXE D2: `partialDodgeReprobe` (a phase dodge's partial stall re-probed) ships OFF.
            partialDodgeReprobe: false,

            // ⛓ fidelity L40CONTACT D1: `chaserSpinnerWalls` (a live spinner walls a chaser whose list holds "Enemy") ships OFF.
            chaserSpinnerWalls: false,

            // ⛓ fidelity CORRIDOR D2: `corridorBodyPricing` (the walk corridor prices the live wallflyers and drills) ships OFF.
            corridorBodyPricing: false,

            // ⛓ fidelity SEALDOOR D2: `sealDoorApproach` (the solver steps the FinalDoor's open-on-approach) ships OFF.
            sealDoorApproach: false,
            // ⛓ fidelity ARROWLANE D2: `arrowLaneCrossing` (an ARMED lane crossed, its arrows billed) ships OFF.
            arrowLaneCrossing: false,
            // ⛓ fidelity AXETIMING D2: `axeTimingRung` (a spinning axe's gap crossed on its clock at dash speed) ships OFF.
            axeTimingRung: false,
            // ⛓ fidelity AXETIMING D2b: `axeGateTransit` (the walk's gate times a spinning axe's blade) ships OFF.
            axeGateTransit: false,
            // ⛓ fidelity DASHSTEP D2: `statueTalkRange` (a statue's talk circle is its class's 32 px) ships OFF.
            statueTalkRange: false });
    });

    // ⛓ LINEFLIP: with W1 ON by default, #264 and #283 reproduce at the default too (they waited on W1 at TERRAIN)
    // ⛓ fidelity L74ARRIVAL: a row whose switch is OFF in this process is still at its tick
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY).each(Object.entries(ROWS))('leg %s — the shipped defaults: fixed rows at 0 px, residue at its tick', async (id, [t, sw]) => {
        const r = await replayCapture(load(id));
        expect(r.error).toBeNull();
        if (sw && CONTACT_FIDELITY[sw]) expect(r.worst).toBe(0);
        else expect(r.firstDiff?.t).toBe(t);
    });

    it.each(Object.entries(ROWS))('leg %s — switches OFF, the model leaves the game at the named tick, on a contact', async (id, [t]) => {
        const cap = load(id);
        const r = await withContactFidelity(ALL_OFF, () => replayCapture(cap));
        expect(r.error).toBeNull();
        expect(r.firstDiff?.t).toBe(t);
        if (!NOT_A_CONTACT[id]) {
            // a knockback: one side's hits moved at that tick
            const hits = r.firstDiff.fields.find((f) => f.field === 'hits');
            expect(hits).toBeTruthy();
            expect(Math.abs(hits.game - hits.model)).toBe(1);
        }
    });

    /**
     * ⛓ fidelity BOBSOLDIER: leg 309's sword knockback needed a second switch, W5 `chaserPointExact`, for its last ulp
     * (7.1e-15 px with W4 alone). ⚖ W5 was retired as a switch at the wave-8 harvest — the runtime's `Point`
     * arithmetic is now the only one — so its own switch alone reproduces the leg at 0 px.
     */
    it.each(Object.entries(ROWS).filter(([, [, sw]]) => sw))('leg %s — its own switch alone reproduces the game at 0 px', async (id, [, sw]) => {
        const r = await withContactFidelity({ ...ALL_OFF, [sw]: true }, () => replayCapture(load(id)));
        expect(r.error).toBeNull();
        expect(r.compared).toBeGreaterThan(SHORT[id] ? SHORT[id] - 1 : 15);
        expect(r.worst).toBe(0);
        expect(r.firstDiff).toBeNull();
    });

    it.each(Object.entries(ROWS).filter(([, [, sw]]) => sw))('leg %s — every switch EXCEPT its own leaves it at the named tick (the mutant)', async (id, [t, sw]) => {
        const on = Object.fromEntries(Object.keys(CONTACT_FIDELITY).map((k) => [k, k !== sw]));
        const r = await withContactFidelity(on, () => replayCapture(load(id)));
        expect(r.firstDiff?.t).toBe(MUTANT_TICK[id] ?? t);
    });

    it.each(Object.entries(ROWS))('leg %s — all switches ON: fixed rows at 0 px, residue at its tick', async (id, [t, sw]) => {
        const all = Object.fromEntries(Object.keys(CONTACT_FIDELITY).map((k) => [k, true]));
        const r = await withContactFidelity(all, () => replayCapture(load(id)));
        expect(r.error).toBeNull();
        if (sw) expect(r.worst).toBe(0);
        else expect(r.firstDiff?.t).toBe(t);
    });
});
