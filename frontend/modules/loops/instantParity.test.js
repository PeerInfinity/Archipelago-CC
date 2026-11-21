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
});
