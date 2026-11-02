/**
 * rulesLoadFailure — the worker's named failure for a `loadRules` that throws.
 *
 * ⛓ Before this, a throw anywhere in `loadFromJSON` (a structural data error such as
 * `region.exits = 5` or a `null` exit entry) reached the worker's generic catch, which
 * posted `workerError` with no `queryId` (loadRules is fire-and-forget). Nothing settled
 * the proxy's `initialLoadPromise`, so the page HUNG with two console lines.
 *
 * Now the worker posts `rulesLoadFailed {loadSeq, game, player, phase, where, message,
 * stack}` and then rethrows, so the existing `workerError` post is unchanged. `phase` and
 * `where` come from the marker `core/initialization.js` keeps on the instance while it
 * loads (`sm._rulesLoadProgress`). A load that completes leaves it null.
 *
 * Pure apart from `post`, so it is unit-tested in node with a real StateManager
 * (rulesLoadFailure.test.js).
 *
 * @module stateManager/core/rulesLoadFailure
 */

/** The game a rules file names for a player: the same precedence as initializeGameLogic. */
export function rulesGameName(rulesData, playerId) {
  return rulesData?.world?.[playerId]?.game || rulesData?.game_name || null;
}

/**
 * Builds the `rulesLoadFailed` message.
 * @param {object} args
 * @param {number|undefined} args.loadSeq - echoed from the loadRules payload
 * @param {object} args.rulesData
 * @param {string} args.playerId
 * @param {{phase: string, where: string|null}|null} args.progress - the marker at the throw
 * @param {string} args.fallbackPhase - the phase when the marker is not set (getSnapshot …)
 * @param {Error} args.error
 */
export function buildRulesLoadFailed({ loadSeq, rulesData, playerId, progress, fallbackPhase, error }) {
  return {
    type: 'rulesLoadFailed',
    loadSeq,
    game: rulesGameName(rulesData, playerId),
    player: playerId,
    phase: progress?.phase || fallbackPhase,
    where: progress?.where ?? null,
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  };
}

/**
 * Runs the loadRules body. On success it returns what the worker posts in
 * `rulesLoadedConfirmation`, and posts nothing itself. On a throw it posts
 * `rulesLoadFailed` and rethrows the original error.
 *
 * @param {object} sm - the worker's StateManager
 * @param {object} rulesData
 * @param {string} playerId
 * @param {number|undefined} loadSeq
 * @param {(message: object) => void} post - self.postMessage in the worker
 * @returns {Promise<{initialSnapshot: object, workerStaticGameData: object}>}
 */
export async function loadRulesOrReport(sm, rulesData, playerId, loadSeq, post) {
  let fallbackPhase = 'loadFromJSON';
  try {
    await sm.loadFromJSON(rulesData, playerId);
    fallbackPhase = 'getSnapshot';
    const initialSnapshot = sm.getSnapshot();
    fallbackPhase = 'getStaticGameData';
    const workerStaticGameData = sm.getStaticGameData();
    return { initialSnapshot, workerStaticGameData };
  } catch (error) {
    // A marker left non-null means loadFromJSON was the one that threw.
    const progress = sm._rulesLoadProgress || null;
    sm._rulesLoadProgress = null;
    post(buildRulesLoadFailed({ loadSeq, rulesData, playerId, progress, fallbackPhase, error }));
    throw error;
  }
}
