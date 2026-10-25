/**
 * seedlingDemo/bossTotemPolicy — THE TOTEM FIGHT AS A PER-TICK POLICY (fidelity L67BK4 D2, `totemBossFight`).
 *
 * The run steps the whole fight (`bossTotem.js` + `bossTotemFight.js`: the wake, the clamp, the 0.75 px/tick descent,
 * the laser's fixed `[x-17, x+17)` band, the attack's two shots, the body's 20-tick pacer, the death and the white-out),
 * so this module only CHOOSES KEYS. It is `r6-totem-kill`'s cycle (game-witnessed, the ladder's first boss kill) read off
 * the live body instead of a tick table:
 *
 *   SETTLE   before the walk: west of the laser band (`stanceX`), and `d0` px below the body's y (the wand's 16 px spawn
 *            and 48 px of flight reach a body `D < 110` above; the body's box ends at `D = 44`);
 *   CYCLE    from the first walking tick, every `period` (22) ticks: one `up` tap (the wand fires along `direction`,
 *            which `sprites()` writes from velocity, so every tracking `down` turns it south), one idle tick, the
 *            `primary` press; then up to `burst` ticks of `down` while `D < dt` — the descent tracked;
 *   DONE     once the body's `destroy` is set: idle through the white-out.
 *
 * ⚠ The policy proves nothing by itself: `solverBot.execTotemBoss` plays each variant on a FORK of the run and keeps
 * one that kills with no death (hitless first). A variant is a guess the fork judges.
 */

/** The witness's cadence: the body's `hitsTimerMax` is 20, so a 22-tick cycle lands every shot. */
export const BOSS_TOTEM_POLICY = Object.freeze({
    period: 22,
    /** the `up` tap's tick in the cycle, then the press two ticks later (`r6-totem-kill`: 209 up, 213 press …). */
    faceAt: 0,
    pressAt: 2,
    /** the burst's first tick: eight ticks after the press, clear of the wand's own animation. */
    burstFrom: 10,
    /** west of the band: the band's left edge is `x - 17`, the player's box is `[px - 2, px + 3)`. */
    stanceOffsetX: -20.5,
    /** the settle's dead zone (px). */
    settleSlack: 2,
});

/**
 * The variants the executor tries, in order. `d0`: the settle's offset below the body; `dt`: the burst's ceiling on
 * `D`; `burst`: the longest burst. The first is the scratch prototype's (hitless from a hand-walked approach); from
 * the solver's own stance walk it kills with 2 hits on three of the four captured passes of legs 862/872, and the
 * second is hitless on all four — so the executor's hitless-first ranking is load-bearing, not a tie-break.
 */
export const BOSS_TOTEM_POLICY_VARIANTS = Object.freeze([
    Object.freeze({ d0: 97, dt: 75, burst: 10 }),
    Object.freeze({ d0: 90, dt: 70, burst: 10 }),
    Object.freeze({ d0: 97, dt: 80, burst: 8 }),
    Object.freeze({ d0: 97, dt: 85, burst: 10 }),
    Object.freeze({ d0: 80, dt: 62, burst: 12 }),
]);

export function createBossTotemPolicy(params) {
    return { ...params, cycleFrom: null, presses: 0, log: [] };
}

/**
 * One tick's keys. `view` is the body's row of the run's `bosses` family (with `totemBossFight` ON: `x`, `y`, `state`,
 * `walking`, `destroy`); `p` the player state; `t` the run's tick.
 */
export function bossTotemPolicyStep(mem, { view, p, t }) {
    const keys = new Set();
    if (view.destroy) return keys;
    const stanceX = view.x + BOSS_TOTEM_POLICY.stanceOffsetX;
    const D = p.y - view.y;
    if (mem.cycleFrom === null && view.walking && view.state === 1) {
        mem.cycleFrom = t;
        mem.log.push({ t, cycleFrom: t, D });
    }
    if (mem.cycleFrom === null) {
        if (p.x > stanceX + 0.5) keys.add('left');
        else if (p.x < stanceX - 8) keys.add('right');
        if (D > mem.d0 + BOSS_TOTEM_POLICY.settleSlack) keys.add('up');
        else if (D < mem.d0 - BOSS_TOTEM_POLICY.settleSlack) keys.add('down');
        return keys;
    }
    const c = (t - mem.cycleFrom) % BOSS_TOTEM_POLICY.period;
    if (c === BOSS_TOTEM_POLICY.faceAt) keys.add('up');
    else if (c === BOSS_TOTEM_POLICY.pressAt) {
        keys.add('primary');
        mem.presses += 1;
    } else if (c >= BOSS_TOTEM_POLICY.burstFrom && c < BOSS_TOTEM_POLICY.burstFrom + mem.burst && D < mem.dt) {
        keys.add('down');
    }
    return keys;
}
