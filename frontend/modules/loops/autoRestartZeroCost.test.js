/**
 * The free-pass guard on the auto-restart wrap
 * (loopState._completeCurrentAction).
 *
 * A queue whose entries all resolve for 0 mana completes every entry in a
 * single frame, so with auto-restart on it used to wrap forever at frame
 * rate: nothing is ever spent, so `_maybeResetForOOM` — the only thing that
 * normally ends an auto-restarting run — can never fire, and the
 * per-completion re-render storm swallowed the user's clicks, so the path
 * could not even be edited out of the loop.
 *
 * The guard measures what the pass ACTUALLY burned (`_passManaSpent`,
 * accumulated at the two spend sites) rather than summing the queue, because
 * costs are dynamic. A pass that burned nothing parks on the ordinary
 * queueCompleted path instead of wrapping.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  installRafShim,
  uninstallRafShim,
  makeWired,
  makeTicker,
} from './testHarness.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

/** Cost data that prices every region/location at 0. */
function zeroCostData() {
  return {
    isLoaded: () => true,
    getRegionCost: () => 0,
    getLocationCost: () => 0,
    getRegionXpEffect: () => 'cost',
  };
}

describe('auto-restart wrap — free-pass guard', () => {
  let loopState, gs, bus, tick;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
    tick = makeTicker();
  });

  it('a zero-cost pass parks instead of wrapping, with reason "zeroCostPass"', () => {
    loopState.setCostDataManager(zeroCostData());
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.startProcessing();

    for (let i = 0; i < 20 && loopState.isProcessing; i++) tick(loopState);

    expect(loopState.isProcessing).toBe(false);
    expect(loopState._queueCompleted).toBe(true);
    expect(loopState.getProcessingState()).toBe('completed');
    expect(loopState._queueCompletedReason).toBe('zeroCostPass');

    const completed = bus.events.find(e => e.name === 'loopState:queueCompleted');
    expect(completed).toBeDefined();
    expect(completed.data.reason).toBe('zeroCostPass');
    // Mana untouched — that is exactly why the wrap had to be declined.
    expect(gs.currentMana).toBe(gs.maxMana);
  });

  it('the guard fires WITHOUT instant mode (zero cost completes in one frame anyway)', () => {
    loopState.setCostDataManager(zeroCostData());
    loopState.instantMode = false;
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.startProcessing();

    for (let i = 0; i < 20 && loopState.isProcessing; i++) tick(loopState);

    expect(loopState._queueCompletedReason).toBe('zeroCostPass');
  });

  it('a pass that COSTS mana still wraps under auto-restart (no behaviour change)', () => {
    // Default cost data absent → explore costs 50, mana 100: the pass
    // spends, so the wrap happens and the queue keeps running until OOM.
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.instantMode = true;
    loopState.startProcessing();

    tick(loopState); // completes action 0 → wraps

    expect(loopState._queueCompleted).toBe(false);
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.currentActionIndex).toBe(0);
    expect(bus.events.find(e => e.name === 'loopState:queueCompleted')).toBeUndefined();
  });

  it('auto-restart OFF still reports the ordinary end-of-queue reason', () => {
    loopState.setCostDataManager(zeroCostData());
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(false);
    loopState.startProcessing();

    for (let i = 0; i < 20 && loopState.isProcessing; i++) tick(loopState);

    expect(loopState._queueCompleted).toBe(true);
    expect(loopState._queueCompletedReason).toBe('queueEnd');
  });

  it('Restart after a free-pass park re-runs the queue exactly once more', () => {
    // The park is not a dead end: the completed state's Restart button
    // (setPaused(false) → _resetLoop + startProcessing) runs the pass
    // again, and the guard parks it again rather than spinning.
    loopState.setCostDataManager(zeroCostData());
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.startProcessing();
    for (let i = 0; i < 20 && loopState.isProcessing; i++) tick(loopState);
    expect(loopState._queueCompleted).toBe(true);

    bus.events.length = 0;
    loopState.setPaused(false);
    for (let i = 0; i < 20 && loopState.isProcessing; i++) tick(loopState);

    const completions = bus.events.filter(e => e.name === 'loopState:actionCompleted');
    expect(completions.length).toBe(1);
    expect(loopState._queueCompletedReason).toBe('zeroCostPass');
  });
});

describe('_passManaSpent — the pass tally', () => {
  let loopState, gs, tick;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    tick = makeTicker();
  });

  it('accumulates what the generic timer deducts, and zeroes on the wrap', () => {
    gs.addCustomAction('explore'); // cost 50
    loopState.setAutoRestartQueue(true);
    loopState.instantMode = true;
    loopState.startProcessing();

    tick(loopState); // completes + wraps

    // The wrap's _resetActionsProgress starts the next pass's tally fresh.
    expect(loopState._passManaSpent).toBe(0);
    expect(gs.currentMana).toBe(50);
  });

  it('startProcessing zeroes the tally; resumeProcessing preserves it', () => {
    // A park in the middle of a pass (manual block, user pause) must not
    // make that pass look free when it resumes.
    gs.addCustomAction('explore');
    loopState._passManaSpent = 7;
    loopState.startProcessing();
    expect(loopState._passManaSpent).toBe(0);

    loopState.stopProcessing();
    loopState._passManaSpent = 7;
    loopState.resumeProcessing();
    expect(loopState._passManaSpent).toBe(7);
  });

  it('mana drained by SOMEONE ELSE (a substrate economy) is not a free pass', () => {
    // resourceChannels-style substrates deduct straight from gameState and
    // never reach _spendMana, so the tally alone would call their passes
    // free and park a perfectly healthy loop. _passStartMana is the second
    // witness: the pool went down, so the wrap happens as before.
    loopState.setCostDataManager({
      isLoaded: () => true,
      getRegionCost: () => 0,
      getLocationCost: () => 0,
      getRegionXpEffect: () => 'cost',
    });
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.startProcessing();

    tick(loopState);        // completes action 0
    gs.deductMana(5);       // the substrate's own spend, mid-pass
    tick(loopState);        // completes action 1 → wrap decision

    expect(loopState._passManaSpent).toBe(0); // loops itself spent nothing
    expect(loopState._queueCompleted).toBe(false);
    expect(loopState.isProcessing).toBe(true);
  });

  it('live-play spends (_spendMana) count toward the pass tally', () => {
    // Manual / Record / Playback / bot spends all route through
    // _spendMana, so a pass whose only cost is live play is NOT free.
    loopState._spendMana('Menu', 12);
    expect(loopState._passManaSpent).toBe(12);
    // A zero (or negative) charge is a no-op, as it always was.
    loopState._spendMana('Menu', 0);
    expect(loopState._passManaSpent).toBe(12);
  });
});
