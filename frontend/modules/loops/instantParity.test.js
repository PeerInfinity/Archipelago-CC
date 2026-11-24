/**
 * LOOPS-I1 — Instant gives the SAME outcome as normal speed, only faster.
 *
 * The same one-action queue runs twice from the same mana: once at normal
 * speed (stepped frame by frame) and once under Instant (the global
 * `instantMode` flag, and the per-block Instant toggle). The end states must
 * agree for an action the pool affords, one that costs exactly the pool, and
 * one that costs more than the pool.
 *
 * Before LOOPS-I1, Instant completed the over-cost action in one frame
 * (`deductMana` clamps the pool to 0, and `_maybeCompleteCurrentAction` runs
 * before `_maybeResetForOOM`), so the third case was red. The fix caps the
 * frame's spend at the pool in `_advanceActionProgress`.
 *
 * The normal-speed frame is sized so each frame spends a whole 2 mana
 * (gameSpeed 10 × 1000 ms → 10 s × 0.2 mana/s), so the stepped run hits the
 * pool's edge on a frame boundary and the comparison needs no tolerance.
 * The `uneven` case puts the edge INSIDE a frame: normal speed's last frame
 * used to complete it too.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';

beforeAll(() => {
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
});
afterAll(() => {
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

function makeWired() {
  const events = [];
  const bus = {
    events,
    publish: (name, data) => events.push({ name, data }),
    subscribe: () => () => {},
  };
  const gs = new GameState(bus);
  const loopState = new LoopState();
  loopState.setDependencies({
    eventBus: bus,
    stateManager: {
      getLatestStateSnapshot: () => ({ checkedLocations: [], inventory: {} }),
      getStaticData: () => ({ regions: new Map() }),
    },
    dispatcher: { publish: () => {}, publishToNextModule: () => {} },
    gameState: {
      getState: () => gs,
      getPath: () => gs.getPath(),
      getCurrentRegion: () => gs.getCurrentRegion(),
      clearPath: () => gs.clearPath(),
      removeAllActionsOfType: (t, n) => gs.removeAllActionsOfType(t, n),
      trimPath: (r, i) => gs.trimPath(r, i),
      addLocationCheck: (l, r, sd) => gs.addLocationCheck(l, r, sd),
      addCustomAction: (a, p) => gs.addCustomAction(a, p),
      removePathEntry: (idx) => gs.removePathEntry(idx),
      removeLocationCheckAt: (l, r, i) => gs.removeLocationCheckAt(l, r, i),
      removeCustomActionAt: (a, r, i, m) => gs.removeCustomActionAt(a, r, i, m),
      insertLocationCheckAt: (l, r, i, lr) => gs.insertLocationCheckAt(l, r, i, lr),
      insertCustomActionAt: (a, r, i, p) => gs.insertCustomActionAt(a, r, i, p),
    },
  });
  gs.setStartRegions(['Menu']);
  gs.setCurrentRegion('Menu');
  return { loopState, gs, bus };
}

/**
 * Run a queue of two `explore` actions (so an action completing does not end
 * the queue) from `mana` until the first action completes or the loop resets,
 * and return what a player could observe.
 * @param {'normal'|'instant'|'blockInstant'} speed
 */
function runOnce(mana, speed) {
  const { loopState, gs, bus } = makeWired();
  gs.addCustomAction('explore');
  gs.addCustomAction('explore');
  gs.maxMana = 100;
  gs.currentMana = mana;
  loopState.gameSpeed = 10;
  loopState.instantMode = speed === 'instant';
  if (speed === 'blockInstant') loopState._currentBlockIsInstant = () => true;
  const cost = loopState._calculateActionCost(loopState.getActionQueue()[0]);
  const region = loopState.getActionQueue()[0].sourceRegion;
  loopState.startProcessing();

  let t = 1000;
  let frames = 0;
  const done = () => bus.events.some(e => e.name === 'loopState:actionCompleted'
      || e.name === 'loopState:loopReset');
  while (!done() && loopState.isProcessing && frames < 10000) {
    loopState._processFrame(t);
    t += 1000;
    frames += 1;
  }
  const names = bus.events.map(e => e.name);
  const completed = names.filter(n => n === 'loopState:actionCompleted').length;
  // A same-frame completion + OOM publishes the completion before the reset.
  const order = names.filter(n => n === 'loopState:actionCompleted' || n === 'loopState:loopReset');
  return {
    cost,
    frames,
    result: {
      completed,
      reset: names.includes('loopState:loopReset'),
      order,
      xp: loopState.getRegionXP(region).xp,
      mana: gs.currentMana,
      index: loopState.currentActionIndex,
    },
  };
}

// The first _processFrame only primes _lastFrameTime; the second does the work.
const FAST_FRAMES = 2;

describe('LOOPS-I1 — Instant ends where normal speed ends', () => {
  it('the fixture action costs 50 (the no-cost-data explore)', () => {
    expect(runOnce(100, 'instant').cost).toBe(50);
  });

  const cases = [
    { name: 'affordable (pool 80, cost 50)', mana: 80,
      want: { completed: 1, reset: false, xp: 50, mana: 30, index: 1 } },
    { name: 'exactly the pool (pool 50, cost 50)', mana: 50,
      want: { completed: 1, reset: true, xp: 50, mana: 100, index: 0 } },
    { name: 'exceeds the pool (pool 30, cost 50)', mana: 30,
      want: { completed: 0, reset: true, xp: 30, mana: 100, index: 0 } },
    { name: 'the NORMAL-SPEED edge: exceeds the pool mid-frame (pool 49, cost 50; before LOOPS-I1 normal speed\'s last frame completed it)', mana: 49,
      want: { completed: 0, reset: true, xp: 49, mana: 100, index: 0 } },
  ];

  for (const c of cases) {
    describe(c.name, () => {
      it('normal speed (stepped) gives the measured outcome', () => {
        const normal = runOnce(c.mana, 'normal');
        expect(normal.frames).toBeGreaterThan(FAST_FRAMES);
        expect(normal.result).toMatchObject(c.want);
      });
      for (const speed of ['instant', 'blockInstant']) {
        it(`${speed} gives the same end state, in one working frame`, () => {
          const normal = runOnce(c.mana, 'normal');
          const fast = runOnce(c.mana, speed);
          expect(fast.frames).toBe(FAST_FRAMES);
          expect(fast.result).toEqual(normal.result);
        });
      }
    });
  }

  // A pool whose capped spend, recomputed as (mana / cost × 100) / 100 × cost,
  // leaves a float sliver (77/97 − that = 1.1e-16 with cost 50). A sliver above
  // 0 never fires the OOM reset, and the queue drained slivers forever: the
  // first cut of this fix stalled playback-bot-loop-mode-adventure in loop 2.
  describe('a fractional pool lands on EXACTLY 0 and resets (no sliver stall)', () => {
    const mana = 77 / 97;
    for (const speed of ['normal', 'instant', 'blockInstant']) {
      it(`${speed}`, () => {
        const run = runOnce(mana, speed);
        expect(run.result).toMatchObject({ completed: 0, reset: true, mana: 100, index: 0 });
        expect(run.result.xp).toBe(mana);
        expect(run.frames).toBe(FAST_FRAMES);
      });
    }
  });
});

/**
 * LOOPS-I2 — ⚖ Ruling A (Robert, 2026-11-21): an action is priced ONCE, at
 * the region level it has when it starts, at every speed.
 *
 * The fixture explore costs 50 at level 0; from 80 XP the region levels up
 * after 20 mana. Normal speed used to re-price every frame, so the rest of
 * the action got cheaper (≈ 48.58 in all), and at pool 49 normal speed
 * COMPLETED an action whose start price is 50, where Instant (and live play,
 * blockModes "ONE ECONOMY") drained the pool and reset. With xpGainScale 5 it
 * crosses two boundaries.
 *
 * The normal-speed frame is small (gameSpeed 10 × 10 ms → 0.02 mana), so a
 * total the frame grid does not divide lands within one frame's spend; that
 * is the tolerance on mana and XP. Completion, reset, level and the queue
 * index must agree exactly.
 */
const CROSS_FRAME_MS = 10;
const CROSS_FRAME_MANA = (10 * CROSS_FRAME_MS) / 5000; // deltaTime / 1000 × 20 / 100

function runCrossing({ mana, speed, gainScale = 1, xp0 = 80 }) {
  const { loopState, gs, bus } = makeWired();
  if (gainScale !== 1) {
    loopState.costDataManager = {
      isLoaded: () => false,
      getRegionXpGainScale: () => gainScale,
      getRegionXpEffect: () => undefined,
    };
  }
  gs.addCustomAction('explore');
  gs.addCustomAction('explore');
  gs.maxMana = 100;
  gs.currentMana = mana;
  const region = loopState.getActionQueue()[0].sourceRegion;
  gs.addRegionXP(region, xp0);
  loopState.gameSpeed = 10;
  loopState.instantMode = speed === 'instant';
  if (speed === 'blockInstant') loopState._currentBlockIsInstant = () => true;
  let spent = 0;
  const deduct = gs.deductMana.bind(gs);
  gs.deductMana = (a) => { spent += a; return deduct(a); };
  loopState.startProcessing();
  let t = 1000;
  let frames = 0;
  const done = () => bus.events.some(e => e.name === 'loopState:actionCompleted'
      || e.name === 'loopState:loopReset');
  while (!done() && loopState.isProcessing && frames < 100000) {
    loopState._processFrame(t);
    t += CROSS_FRAME_MS;
    frames += 1;
  }
  const names = bus.events.map(e => e.name);
  const xp = loopState.getRegionXP(region);
  return {
    frames,
    spent,
    exact: {
      completed: names.filter(n => n === 'loopState:actionCompleted').length,
      reset: names.includes('loopState:loopReset'),
      level: xp.level,
      index: loopState.currentActionIndex,
    },
    xp: xp.xp,
  };
}

describe('LOOPS-I2 — a level-crossing action costs its START price at every speed', () => {
  const cases = [
    { name: 'affordable (pool 100 → 50 spent, completes)', mana: 100, spent: 50, xp: 30,
      want: { completed: 1, reset: false, level: 1, index: 1 } },
    { name: 'unaffordable (pool 49 → drains, no completion, reset; per-frame re-pricing completed it)',
      mana: 49, spent: 49, xp: 29,
      want: { completed: 0, reset: true, level: 1, index: 0 } },
    // XP × 5: 80 + 250 = 330 → L1 (100), L2 (+120), 110 into L2.
    { name: 'two boundaries, affordable (xpGainScale 5, pool 100)', mana: 100, gainScale: 5,
      spent: 50, xp: 110, want: { completed: 1, reset: false, level: 2, index: 1 } },
    // 80 + 245 = 325 → L2, 105 in.
    { name: 'two boundaries, unaffordable (xpGainScale 5, pool 49)', mana: 49, gainScale: 5,
      spent: 49, xp: 105, want: { completed: 0, reset: true, level: 2, index: 0 } },
  ];

  for (const c of cases) {
    const scale = c.gainScale ?? 1;
    describe(c.name, () => {
      it('normal speed (stepped) charges the start price', () => {
        const normal = runCrossing({ mana: c.mana, speed: 'normal', gainScale: scale });
        expect(normal.frames).toBeGreaterThan(FAST_FRAMES);
        expect(normal.exact).toEqual(c.want);
        expect(Math.abs(normal.spent - c.spent)).toBeLessThanOrEqual(CROSS_FRAME_MANA);
        expect(Math.abs(normal.xp - c.xp)).toBeLessThanOrEqual(CROSS_FRAME_MANA * scale);
      });
      for (const speed of ['instant', 'blockInstant']) {
        it(`${speed} ends where normal speed ends, in one working frame`, () => {
          const normal = runCrossing({ mana: c.mana, speed: 'normal', gainScale: scale });
          const fast = runCrossing({ mana: c.mana, speed, gainScale: scale });
          expect(fast.frames).toBe(FAST_FRAMES);
          expect(fast.exact).toEqual(normal.exact);
          expect(fast.spent).toBe(c.spent);
          expect(Math.abs(fast.spent - normal.spent)).toBeLessThanOrEqual(CROSS_FRAME_MANA);
          expect(Math.abs(fast.xp - normal.xp)).toBeLessThanOrEqual(CROSS_FRAME_MANA * scale);
        });
      }
    });
  }

  it('a fresh start re-prices: after the reset, the next attempt is priced at the NEW level', () => {
    const { loopState, gs } = makeWired();
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    gs.currentMana = 49;
    const action = loopState.getActionQueue()[0];
    gs.addRegionXP(action.sourceRegion, 80);
    expect(loopState._startedActionPrice(action, 0)).toBe(50);
    gs.addRegionXP(action.sourceRegion, 20); // → level 1
    expect(loopState._startedActionPrice(action, 40)).toBe(50); // mid-action: frozen
    expect(loopState._startedActionPrice(action, 0)).toBeCloseTo(50 / 1.05, 12); // fresh start
  });
});
