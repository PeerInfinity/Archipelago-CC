/**
 * seedlingDemo/lightsVerb — ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20, D3): THE `lights` VERB — the L69 fight, solved.
 *
 * ⚖ The user (2026-10-20): *"L69 Lights"*; (2026-10-12) *"model the game, do not plan around it"*. The verb behind
 * `solverBot.OBSTACLE_STRATEGIES['solid:lightbosscontroller']` (registered only while
 * `CONTACT_FIDELITY.lightsBossFight` is ON), reached through rules-2's `bossGoal` as a `clear-tag` on {69,0}:
 *
 *   1. THE INTRO. `check()` put a temporary NPC at (80,80); nothing spawns until its pages are done. Walk to a cell
 *      inside its 24 px circle, release X to open it, page it (one X release a page-fill), and wait for its removal.
 *   2. THE FIGHT. Six `LightBoss` fliers circle (80,80) at radius 48..64 on `Game.worldFrame`, shooting along their
 *      heading; a standing player is hit within 40..400 ticks almost anywhere (MEASURED on the model, every cell of the
 *      room), so the fight is a sequence of SORTIES — wait w ticks, move n ticks in one direction, swing, move back —
 *      and DODGES (one or two legs of movement). Each candidate is FORECAST, not guessed: the fight is a clone
 *      stepped by `lightBoss.js`'s own functions, the player by the run's own `previewStepper`, the swing by the
 *      game's window (`Player.slash`: tests on T+1 … T+5 from the live position, the plain-swing rect and its 16 px
 *      reach, `collideLine("Solid")` to the body's centre; the spear: its 32x5 rect only). A sortie is taken when it
 *      lands a hit and nobody touches the player inside its window plus `SAFE_TAIL` idle ticks.
 *   3. THE FINISH. When the last flier leaves the world the controller's next update runs `endState()`: the {69,0}
 *      write (APFLIP's report path) and, from the update after, the exit Teleporter to L36. `execClearTag` waits for
 *      the write as it does for every flag; a following `reach-exit` walks onto the Teleporter.
 *
 * ⛔ NOTHING IS ASSUMED ABOUT THE LIVE RUN: after every plan the live fight is compared with the forecast's; a
 * difference, a hit on the player or a crossing is a refusal by name (`obstacle.kind: 'clear-tag'`, `reason`
 * `unresolved`), never a silent continuation. The wand is refused by name (`cannot-act`): the `WandShot` arm against
 * a LightBoss is not modelled (fidelity LIGHTS residue).
 */

import {
    LIGHT_BOSS, LIGHTS_SPEAR_FORCE, SCREEN_H, SCREEN_W, cloneLightsFight, collideLineSolid, distanceRectPoint, lightBossFlierHit,
    lightBossRect, playerBoxAt, rectsOverlap, slashRect, spearRect, stepLightBossFlier, stepLightBossFlierGraphic,
    stepLightBossShot, stepLightsController,
} from './solverView.js';

/** The planner's numbers. Each is a search bound or a safety margin, not a game constant. */
export const LIGHTS_VERB = Object.freeze({
    /** The longest wait a sortie may open with (ticks). */
    waitMax: 60,
    waitStep: 2,
    /** A sortie's longest leg out (ticks of one held direction). */
    legMax: 10,
    /** Idle ticks after a plan's last key that must stay unhit — the next decision's margin. */
    safeTail: 16,
    /** A dodge is one or two legs; the second leg's lengths. */
    dodgeSecondLegs: Object.freeze([0, 3, 6]),
    /** How many idle ticks a dodge is scored over (its survival). */
    dodgeHorizon: 60,
    /** `Player.slashTimerMax` (20): a press with the timer above 0 DASHES (`set slashing`), so plans keep 21 apart. */
    pressGap: 21,
    /** The tests of one swing: T+1 … T+5 (`presses.SLASH_HIT_TICKS`); a spear thrust's: T+1, T+3, T+5 (as offsets). */
    swingTests: 5,
    spearTests: Object.freeze([0, 2, 4]),
    /** The intro: the paging cadence (an X release every this many ticks) and the stance's distance from (80,80). */
    pageEvery: 4,
    introBound: 400,
    /** The whole fight's tick bound: six fliers, three landed hits each, at most this many ticks per landed hit. */
    ticksPerHit: 240,
    src: 'seedling-fidelity-lights D3 (search bounds, measured on the model: the full kill in 806 t from the arrival)',
});

/** The room's one fight (`run.entities('lightsFight')` is a list: one per live controller). */
const fightOf = (run) => run.entities('lightsFight')?.[0] ?? null;

const IDLE = new Set();
const DIRS = Object.freeze(['right', 'up', 'left', 'down']);
const OPP = Object.freeze({ right: 'left', left: 'right', up: 'down', down: 'up' });

/**
 * The forecast's cull: `camera.onScreen` at margin 0 against the camera at rest — in a room the size of the screen
 * (L69 is 160x160) `view()` clamps it to (0,0). The planner keeps the player unhit, so no shake moves it.
 */
const restingOnScreen = (b) => !(b.right < 0 || b.bottom < 0 || b.x > SCREEN_W || b.y > SCREEN_H);

/**
 * The forecast's state: a fight clone, the player's physics state, the `Game.time` of the next update, the pending
 * swing tests and the slash timer. Cloned per candidate.
 */
export function lightsForecastState(run, { weapon }) {
    const fight = fightOf(run);
    const slash = run.progress('slashInfo');
    return {
        fight: cloneLightsFight(fight),
        player: { ...run.state },
        time: fight.time,
        tests: [],
        slashTimer: slash?.state?.slashTimer ?? 0,
        slashing: slash?.state?.slashing === true,
        prevPrimary: false,
        weapon,
    };
}

function cloneForecast(s) {
    return { ...s, fight: cloneLightsFight(s.fight), player: { ...s.player }, tests: s.tests.map((t) => ({ ...t })) };
}

/**
 * ONE forecast tick, in the run's order: every shot, every flier (its graphic in its slot), the controller, this
 * frame's removals, then the player's update — the due swing test from where it stands, the press, the move.
 *
 * @returns {{damaged: boolean, landed: number, killed: number}}
 */
function forecastTick(s, held, env) {
    const F = s.fight;
    const box = playerBoxAt(s.player.x, s.player.y);
    let damaged = false;
    for (let i = F.shots.length - 1; i >= 0; i -= 1) {
        const sh = F.shots[i];
        if (sh.removed) continue;
        if (stepLightBossShot(sh, { playerBox: box, onScreen: env.onScreen }).hitPlayer) damaged = true;
    }
    F.shots = F.shots.filter((sh) => !sh.removed);
    for (let i = F.bodies.length - 1; i >= 0; i -= 1) {
        const b = F.bodies[i];
        if (b.removed) continue;
        stepLightBossFlier(b, { playerBox: box, onContact: () => { damaged = true; } });
        if (stepLightBossFlierGraphic(b)) b.removing = true;
    }
    s.time += 1;
    stepLightsController(F, { time: s.time });
    for (const b of F.bodies) if (b.removing) { b.removing = false; b.removed = true; }
    let landed = 0;
    let killed = 0;
    // `Player.update`: `slash()`/`spear()` first — the window's test on the position the last move left.
    s.slashTimer = Math.max(0, s.slashTimer - 1);
    const due = s.tests.filter((t) => t.k === 0);
    s.tests = s.tests.filter((t) => t.k > 0).map((t) => ({ ...t, k: t.k - 1 }));
    for (const t of due) {
        const r = s.weapon === 'spear' ? spearRect(s.player.x, s.player.y, t.dir) : slashRect(s.player.x, s.player.y, t.dir);
        for (const b of F.bodies) {
            if (b.removed || b.dieAnim) continue;
            const bx = lightBossRect(b);
            if (!rectsOverlap(r, bx)) continue;
            if (s.weapon !== 'spear') {
                if (distanceRectPoint(s.player.x, s.player.y, bx) > env.reach) continue;
                if (collideLineSolid(env.solids, s.player.x, s.player.y, b.x, b.y)) continue;
            }
            const v = lightBossFlierHit(F, b, { d: env.damage, force: env.force, t: env.hitType,
                from: { x: s.player.x, y: s.player.y } });
            if (v.landed) landed += 1;
            if (v.killed) killed += 1;
        }
    }
    if (s.tests.length === 0) s.slashing = false;
    const press = held.has('primary') && !s.prevPrimary;
    if (press) {
        // the sword tests T+1 … T+5; the spear T+1, T+3, T+5 (`spearDelayMax` 1 — `levelRun.lightsSpearRepeatsNow`)
        const ks = s.weapon === 'spear' ? LIGHTS_VERB.spearTests : [0, 1, 2, 3, 4];
        for (const j of ks) s.tests.push({ k: j, dir: s.player.direction });
        s.slashTimer = LIGHTS_VERB.pressGap - 1;
        s.slashing = true;
    }
    s.prevPrimary = held.has('primary');
    s.player = env.step(s.player, held);
    return { damaged, landed, killed };
}

/** Forecast `plan` then `tail` idle ticks from `s` (cloned). */
function forecastPlan(s0, plan, tail, env) {
    const s = cloneForecast(s0);
    let landed = 0;
    let killed = 0;
    const n = plan.length + tail;
    for (let k = 0; k < n; k += 1) {
        const r = forecastTick(s, k < plan.length ? plan[k] : IDLE, env);
        landed += r.landed;
        killed += r.killed;
        if (r.damaged) return { damaged: k, landed, killed, end: null };
        if (k === plan.length - 1) s.atPlanEnd = fightDigest(s);
    }
    return { damaged: null, landed, killed, end: s.atPlanEnd ?? fightDigest(s) };
}

/** What a plan's end must match on the live run: the player, every flier's position and hits. */
function fightDigest(s) {
    return JSON.stringify([s.player.x, s.player.y,
        s.fight.bodies.map((b) => [b.removed ? 'X' : b.x, b.removed ? 'X' : b.y, b.hits])]);
}

/**
 * The next sortie from `s0`: the idle prefix is stepped once and shared (snapshots every `waitStep` ticks, cut at the
 * first tick it would be hit), then each (wait, direction, leg, back) is forecast from its snapshot.
 * @returns {?{keys: Set[], landed: number, w: number, d: string, n: number, back: boolean, end: string}}
 */
export function planLightsSortie(s0, env) {
    const V = LIGHTS_VERB;
    const snaps = [];
    let s = cloneForecast(s0);
    for (let w = 0; w <= V.waitMax; w += 1) {
        if (w % V.waitStep === 0) snaps.push({ w, s: cloneForecast(s) });
        if (forecastTick(s, IDLE, env).damaged) break;
    }
    let best = null;
    for (const { w, s: sw } of snaps) {
        for (const d of DIRS) {
            for (let n = 1; n <= V.legMax; n += 1) {
                if (sw.slashTimer - n > 0 || sw.tests.length > 0) continue;
                for (const back of [true, false]) {
                    const plan = [];
                    for (let i = 0; i < n; i += 1) plan.push(new Set([d]));
                    plan.push(new Set(['primary']));
                    if (back) for (let i = 0; i < n; i += 1) plan.push(new Set([OPP[d]]));
                    while (plan.length < n + 1 + V.swingTests) plan.push(IDLE);
                    const r = forecastPlan(sw, plan, V.safeTail, env);
                    if (r.damaged !== null || r.landed === 0) continue;
                    const cost = w + plan.length;
                    if (!best || r.landed > best.landed || (r.landed === best.landed && cost < best.cost)) {
                        const keys = [...Array(w).fill(IDLE), ...plan];
                        best = { keys, landed: r.landed, killed: r.killed, w, d, n, back, cost, end: r.end };
                    }
                }
            }
        }
        // the earliest wait that lands is enough when it lands as much as any later one could (one press, one hit
        // per body in its i-frames): stop at the first wait with a candidate
        if (best) break;
    }
    return best;
}

/** The safest move from `s0`: one or two legs, scored by how long it then stays unhit. */
export function planLightsDodge(s0, env) {
    const V = LIGHTS_VERB;
    let best = null;
    for (const d of [null, ...DIRS]) {
        for (let n = 1; n <= V.legMax; n += 1) {
            for (const d2 of [null, ...DIRS]) {
                for (const n2 of V.dodgeSecondLegs) {
                    if ((d2 === null) !== (n2 === 0)) continue;
                    const plan = [];
                    for (let i = 0; i < n; i += 1) plan.push(new Set(d ? [d] : []));
                    for (let i = 0; i < n2; i += 1) plan.push(new Set([d2]));
                    const r = forecastPlan(s0, plan, V.dodgeHorizon, env);
                    const survive = r.damaged === null ? Infinity : r.damaged;
                    if (survive < plan.length + V.safeTail) continue;
                    const score = survive - plan.length;
                    if (!best || score > best.score) best = { keys: plan, score, d, n, d2, n2, end: r.end };
                }
            }
        }
    }
    return best;
}

/**
 * The verb. `ctx.refuse(reason, why)` is `execClearTag`'s own (`obstacle.kind: 'clear-tag'`); `ctx.walkTo` its walk.
 * @returns {object} the record `execClearTag` banks
 */
export function execLights(run, perTick, resolved, ctx) {
    const { refuse } = ctx;
    const from = perTick.length;
    const drive = (held) => {
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            refuse('unresolved', `the run crossed from level ${transition.from_level} to ${transition.to_level} during `
                + 'the Lights fight — the fight is per visit (`check()` rebuilds it on every entry)');
        }
    };
    const fight0 = fightOf(run);
    if (globalThis.process?.env?.SEEDLING_LIGHTS_DEBUG === '1') {
        console.log(`[lights debug] execLights at t${run.ticksCompleted} perTick ${perTick.length} fight ${fight0 ? `intro ${fight0.introUp} ended ${fight0.endedAt} gone ${fight0.totemGone}` : 'null'} controllers ${JSON.stringify(run.world.lightsControllers)}`);
    }
    if (!fight0) refuse('unresolved', 'the run holds no live Lights fight in this room (`run.entities(\'lightsFight\')`)');
    const weapon = run.progress('primaryWeapon');
    if (weapon !== 'sword' && weapon !== 'spear') {
        refuse('cannot-act', `the primary weapon is ${weapon ?? 'none'}; a LightBoss is \`Enemy.hit\` by the sword, the `
            + 'spear or the wand (`LIGHTS_ARENA`), and the wand\'s `WandShot` arm against it is not modelled (fidelity '
            + 'LIGHTS residue) — select the sword or the spear');
    }
    const damage0 = run.damage.hits;
    const env = {
        step: run.previewStepper(),
        onScreen: restingOnScreen,
        solids: (run.world.solids ?? []).map((so) => so.rect),
        reach: 16,
        damage: weapon === 'spear' ? 2 : (run.progress('inventory')?.hasDarkSword ? 2 : 1),
        force: weapon === 'spear' ? LIGHTS_SPEAR_FORCE : 5,
        hitType: weapon === 'spear' ? 'Spear' : 'Sword',
    };
    // ── 1. the intro ──
    let paged = 0;
    if (fightOf(run).introUp) {
        const c = fightOf(run).center;
        const stance = { x: c.x, y: c.y + LIGHT_BOSS.intro.talkRange - 4 };
        ctx.walkTo(ctx.goal, stance, { what: `${ctx.what} -> the intro's circle (${stance.x},${stance.y})` });
        for (let i = 0; i < LIGHTS_VERB.introBound && fightOf(run).introUp; i += 1) {
            const press = i % LIGHTS_VERB.pageEvery === 0;
            if (press) paged += 1;
            drive(press ? new Set(['primary']) : IDLE);
        }
        if (fightOf(run).introUp) {
            refuse('unresolved', `the intro is still up after ${LIGHTS_VERB.introBound} ticks of paging at `
                + `(${run.state.x},${run.state.y}) — \`NPC.talk\` opens on an X release within 24 px of `
                + `(${c.x},${c.y})`);
        }
    }
    const introTicks = perTick.length - from;
    // ── 2. the fight ──
    const sorties = [];
    let dodges = 0;
    const bound = fightOf(run).flierNumber * LIGHT_BOSS.flier.hitsMax * LIGHTS_VERB.ticksPerHit;
    const start = perTick.length;
    for (;;) {
        const F = fightOf(run);
        if (F.endedAt !== null) break;
        if (perTick.length - start > bound) {
            refuse('unresolved', `the fight ran its ${bound}-tick bound (${sorties.length} sorties, ${dodges} dodges; `
                + `fliers [${F.bodies.map((b) => (b.removed ? 'X' : b.hits)).join(' ')}])`);
        }
        if (!F.madeFliers) { drive(IDLE); continue; }
        const s0 = lightsForecastState(run, { weapon });
        const sortie = planLightsSortie(s0, env);
        const plan = sortie ?? planLightsDodge(s0, env);
        if (!plan) {
            refuse('unresolved', `no sortie lands a hit and no dodge stays unhit for ${LIGHTS_VERB.safeTail} ticks from `
                + `(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) at tick ${run.ticksCompleted} (fliers `
                + `[${F.bodies.map((b) => (b.removed ? 'X' : `${b.x.toFixed(1)},${b.y.toFixed(1)}:${b.hits}`)).join(' ')}])`);
        }
        const waitIdle = sortie ? sortie.w : 0;
        const executed = sortie ? sortie.keys.length : plan.keys.length;
        const debug = globalThis.process?.env?.SEEDLING_LIGHTS_DEBUG === '1' ? cloneForecast(s0) : null;
        for (const k of plan.keys) {
            drive(k);
            if (debug) {
                forecastTick(debug, k, env);
                const a = fightDigest(debug);
                const b = fightDigest({ player: run.state, fight: fightOf(run) });
                if (a !== b) {
                    console.log(`[lights debug] t${run.ticksCompleted} keys [${[...k]}] forecast ${a.slice(0, 400)}`);
                    console.log(`[lights debug]            live     ${b.slice(0, 400)}`);
                    console.log(`[lights debug] shots forecast ${JSON.stringify(debug.fight.shots.map((x) => [x.x, x.y]))}`);
                    console.log(`[lights debug] shots live     ${JSON.stringify(fightOf(run).shots.map((x) => [x.x, x.y]))}`);
                    break;
                }
            }
        }
        if (sortie) sorties.push({ t: run.ticksCompleted, w: waitIdle, d: sortie.d, n: sortie.n, back: sortie.back,
            landed: sortie.landed, ticks: executed });
        else dodges += 1;
        if (run.damage.hits !== damage0) {
            refuse('unresolved', `the player was hit during the fight at tick ${run.ticksCompleted} (hits ${damage0} -> `
                + `${run.damage.hits}) — the forecast said no body would touch it; the model and its forecast disagree`);
        }
        const live = fightDigest({ player: run.state, fight: fightOf(run) });
        if (live !== plan.end) {
            refuse('unresolved', `the live fight after a ${sortie ? 'sortie' : 'dodge'} at tick ${run.ticksCompleted} is `
                + `not the forecast's (forecast ${plan.end.slice(0, 160)}, live ${live.slice(0, 160)})`);
        }
    }
    return {
        verb: 'lights', target: resolved.obstacle?.id ?? 'lightbosscontroller', from, ticks: perTick.length - from,
        introTicks, paged, sorties: sorties.length, dodges, weapon,
        endedAt: fightOf(run).endedAt,
    };
}
