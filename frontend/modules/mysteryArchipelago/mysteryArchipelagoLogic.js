// Mystery Archipelago bridge logic.
//
// The mystery clue game's page (repository mystery-clue-game, loaded in an iframe with
// `?iframeId=mystery`) deals only in its own ids: question ids (`q.door`) and paper ids
// (`watch_book`). The Archipelago names stay here. The map between them is the loaded world's
// `world[player].slot_data.mystery`:
//
//   { story, version, goal, locations: { <location name>: <question id> },
//                             items:     { <item name>:     <paper id> } }
//
// Four messages on the event bus (the iframe adapter relays them both ways):
//
//   page -> host  mystery:questionSolved { story, questionId }
//   page -> host  mystery:requestState   { story, version? }
//   host -> page  mystery:state          { story, version, game, connected, papers, solved, lock?, inOffice? }
//   host -> page  mystery:refused        { reason, story, version }
//
// A GENERATED world may hold the case as one region of several (the `mystery` substrate,
// mysterySubstrateLibrary.js). The map is then that region's payload (`ap_locations`, `papers`),
// and the state carries two more fields: `lock`, the world's rule for what is locked while the
// player is not in the case's region (`actions`, `new-reading`, `everything`), and `inOffice`,
// whether the player is in it now AND may play it by hand: in loop mode that is only while the
// Loops queue is parked for live play on the region (the strict action gate would refuse a check
// at any other time, and the page must not offer what will not happen). Both are absent for a world whose case is its slot's (one
// region, always "in the office"). A question solved away from the region is not checked.
//
// `mystery:state` always carries the WHOLE set of papers held and questions checked, so the page
// replaces what it has and never adds; a reload or a reconnect is then safe. It is sent when the
// page asks and whenever its content changes.
//
// `game` names one slot of one generated multiworld (`<seed name>:<team>:<slot>` when connected,
// `offline:<seed name>:<player>` otherwise), so the page can keep one save per game. It names a
// GENERATION, not a hosted room: the same file hosted twice gives the same string.
//
// This class touches no global: everything it reads comes through `deps`, so it runs under vitest.

export const MYSTERY_EVENTS = Object.freeze({
  QUESTION_SOLVED: 'mystery:questionSolved',
  REQUEST_STATE: 'mystery:requestState',
  STATE: 'mystery:state',
  REFUSED: 'mystery:refused',
});

/** Every reason a request is refused, by name. A test asserts the name, never a sentence. */
export const MYSTERY_REFUSALS = Object.freeze({
  NO_MYSTERY_WORLD: 'no-mystery-world',
  OTHER_STORY: 'other-story',
  OTHER_VERSION: 'other-version',
});

export const SOURCE_MODULE = 'mysteryArchipelago';

/** The events after which the answer of `getLivePlay` may have changed (index.js declares the intents). */
export const LIVE_PLAY_EVENTS = Object.freeze([
  'gameState:loopModeChanged', 'loopState:manualEntered', 'loopState:manualResumed', 'loopState:pauseStateChanged',
  'loopState:queuePausedUntilReset', 'loopState:loopReset', 'loopState:queueCompleted', 'loopState:newActionStarted',
  'loopState:processingStopped',
]);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The mystery block of the loaded world, with its two inverse maps, or null when the loaded world
 * is not a mystery case.
 * @param {Object|null} staticData - the state manager's static data (the rules document)
 */
export function mysteryBlockOf(staticData) {
  if (!isObject(staticData) || !isObject(staticData.world)) return null;
  const player = String(staticData.playerId ?? Object.keys(staticData.world)[0] ?? '1');
  const block = staticData.world[player]?.slot_data?.mystery;
  if (!isObject(block) || typeof block.story !== 'string' || !isObject(block.locations) || !isObject(block.items)) {
    return null;
  }
  const locationOfQuestion = new Map();
  for (const [locationName, questionId] of Object.entries(block.locations)) locationOfQuestion.set(questionId, locationName);
  return {
    player,
    story: block.story,
    version: block.version ?? null,
    case: typeof block.case === 'string' && block.case ? block.case : null,
    seedName: staticData.seed_name != null ? String(staticData.seed_name) : '',
    questionOfLocation: block.locations,
    paperOfItem: block.items,
    locationOfQuestion,
    regionId: null,
    lock: null,
  };
}

/**
 * The same block, read off ONE region of a generated world: the `mystery` substrate's payload
 * (`{story, version?, case, lock, ap_locations: {<question id>: <location name>}, papers: {<item
 * name>: <paper id>}}`). Null when the payload is no case.
 * @param {string} regionId
 * @param {Object} payload - the region's deserialised world
 * @param {Object|null} staticData - for the player and the seed name
 */
export function mysteryBlockOfRegion(regionId, payload, staticData) {
  if (!isObject(payload) || typeof payload.story !== 'string' || !isObject(payload.ap_locations) || !isObject(payload.papers)) {
    return null;
  }
  const questionOfLocation = {};
  for (const [questionId, locationName] of Object.entries(payload.ap_locations)) questionOfLocation[locationName] = questionId;
  return {
    player: String(staticData?.playerId ?? Object.keys(staticData?.world ?? {})[0] ?? '1'),
    story: payload.story,
    version: payload.version ?? null,
    case: typeof payload.case === 'string' && payload.case ? payload.case : null,
    seedName: staticData?.seed_name != null ? String(staticData.seed_name) : '',
    questionOfLocation,
    paperOfItem: payload.papers,
    locationOfQuestion: new Map(Object.entries(payload.ap_locations)),
    regionId,
    lock: typeof payload.lock === 'string' ? payload.lock : null,
  };
}

/**
 * The `mystery` regions of the runtime player's warehouse (`procgenPlayer`'s `WorldWarehouse`:
 * `keys()` and `get(regionId) → {substrate, world}`), as `currentMysteryBlock` wants them. `[]`
 * for no warehouse (a world that is not generated).
 */
export function caseRegionsOfWarehouse(warehouse, substrateId) {
  if (!warehouse || typeof warehouse.keys !== 'function' || typeof warehouse.get !== 'function') return [];
  const out = [];
  for (const regionId of warehouse.keys()) {
    const entry = warehouse.get(regionId);
    if (entry?.substrate === substrateId && entry.world) out.push({ regionId, payload: entry.world });
  }
  return out;
}

/**
 * The case the page is to be answered about. A generated world's case regions win over the
 * slot's block; among several the one of the asked `story`, else the one the player is in, else
 * the first. Null when the world holds no case.
 * @param {{staticData: Object|null, caseRegions?: Array<{regionId: string, payload: Object}>, activeRegionId?: string|null, story?: string}} world
 */
export function currentMysteryBlock({ staticData, caseRegions = [], activeRegionId = null, story } = {}) {
  const blocks = (caseRegions ?? [])
    .map((r) => mysteryBlockOfRegion(r.regionId, r.payload, staticData))
    .filter(Boolean);
  if (blocks.length === 0) return mysteryBlockOf(staticData);
  return blocks.find((b) => story !== undefined && b.story === story)
    ?? blocks.find((b) => b.regionId === activeRegionId)
    ?? blocks[0];
}

/** The `game` string: one slot of one generated multiworld. */
export function gameKeyOf(block, connection) {
  if (connection?.connected) return `${block.seedName}:${connection.team ?? 0}:${connection.slot ?? block.player}`;
  return `offline:${block.seedName}:${block.player}`;
}

/**
 * Is the player in the case's region and able to play it by hand? `livePlay` is the Loops module's
 * word (`{loopMode, region}`: loop mode on, and the region the queue is parked on for live play, or
 * null); with loop mode off, or no Loops module, being in the region is enough.
 */
export function inOfficeNow(block, activeRegionId, livePlay = null) {
  if (!block.regionId || activeRegionId !== block.regionId) return false;
  return !livePlay?.loopMode || livePlay.region === block.regionId;
}

/**
 * The whole `mystery:state` payload for a block, a state snapshot and the connection.
 * Both lists are sorted, so two equal states are equal as JSON.
 */
export function mysteryStateOf(block, snapshot, connection, activeRegionId = null, livePlay = null) {
  const inventory = isObject(snapshot?.inventory) ? snapshot.inventory : {};
  const papers = [];
  for (const [itemName, paperId] of Object.entries(block.paperOfItem)) {
    if (Number(inventory[itemName]) > 0) papers.push(paperId);
  }
  const checked = new Set(Array.isArray(snapshot?.checkedLocations) ? snapshot.checkedLocations : []);
  const solved = [];
  for (const [locationName, questionId] of Object.entries(block.questionOfLocation)) {
    if (checked.has(locationName)) solved.push(questionId);
  }
  return {
    story: block.story,
    version: block.version,
    game: gameKeyOf(block, connection),
    connected: !!connection?.connected,
    papers: papers.sort(),
    solved: solved.sort(),
    // Only for a case that is a region of a generated world.
    ...(block.lock ? { lock: block.lock } : {}),
    ...(block.regionId ? { inOffice: inOfficeNow(block, activeRegionId, livePlay) } : {}),
  };
}

export class MysteryArchipelagoLogic {
  /**
   * @param {Object} deps
   * @param {{subscribe: Function, publish: Function}} deps.eventBus
   * @param {{publish: Function}} deps.dispatcher
   * @param {() => Object|null} deps.getStaticData
   * @param {() => Object|null} deps.getSnapshot
   * @param {() => {connected: boolean, slot: number|null, team: number|null}} deps.getConnection - asked
   *   every time, never remembered: this module may be enabled after the app has connected, and a
   *   connect event it was not there for must not leave it saying "offline".
   * @param {() => Array<{regionId: string, payload: Object}>} [deps.getCaseRegions] - the loaded world's
   *   `mystery` regions (none for a world that is not generated)
   * @param {() => string|null} [deps.getActiveRegionId] - the region the player is in
   * @param {() => {loopMode: boolean, region: string|null}|null} [deps.getLivePlay] - loop mode, and the
   *   region the Loops queue is parked on for live play (see `inOfficeNow`)
   * @param {(level: string, message: string, ...data: any[]) => void} [deps.log]
   */
  constructor({
    eventBus, dispatcher, getStaticData, getSnapshot, getConnection,
    getCaseRegions = () => [], getActiveRegionId = () => null, getLivePlay = () => null, log = () => {},
  }) {
    this._eventBus = eventBus;
    this._dispatcher = dispatcher;
    this._getStaticData = getStaticData;
    this._getSnapshot = getSnapshot;
    this._log = log;
    this._getConnection = getConnection;
    this._getCaseRegions = getCaseRegions;
    this._getActiveRegionId = getActiveRegionId;
    this._getLivePlay = getLivePlay;
    // The story the page last asked about: with several cases in one world, the one it is answered about.
    this._pageStory = undefined;
    // The page has asked at least once; until then nothing is sent (no page, nobody to tell).
    this._pageAsked = false;
    this._lastSent = null;
  }

  initialize() {
    const sub = (event, handler) => this._eventBus.subscribe(event, handler);
    sub(MYSTERY_EVENTS.QUESTION_SOLVED, (data) => this.handleQuestionSolved(data));
    sub(MYSTERY_EVENTS.REQUEST_STATE, (data) => this.handleRequestState(data));
    // The connection events only say WHEN to look; what is so is asked of the client each time.
    sub('game:connected', () => this.sendStateIfChanged());
    // After the client has applied the server's checked locations and items.
    sub('client:connectedStateApplied', () => this.sendStateIfChanged());
    sub('connection:close', () => this.sendStateIfChanged());
    sub('game:itemsReceived', () => this.sendStateIfChanged());
    sub('stateManager:rulesLoaded', () => this.sendStateIfChanged());
    sub('stateManager:snapshotUpdated', () => this.sendStateIfChanged());
    // The player moved: `inOffice` may have changed.
    sub('procgen:activeSubstrateChanged', () => this.sendStateIfChanged());
    // Loop mode, or the queue's park, changed: so may `inOffice`.
    for (const event of LIVE_PLAY_EVENTS) sub(event, () => this.sendStateIfChanged());
  }

  /** The case to answer about, for the story the page asked (or last asked). */
  _block(story = this._pageStory) {
    return currentMysteryBlock({
      staticData: this._getStaticData(),
      caseRegions: this._getCaseRegions(),
      activeRegionId: this._getActiveRegionId(),
      story,
    });
  }

  _state(block) {
    return mysteryStateOf(block, this._getSnapshot(), this._getConnection(), this._getActiveRegionId(), this._getLivePlay());
  }

  /** Why the page's `{story, version}` is refused, or null. A missing `version` is not checked. */
  refusalFor(block, request) {
    if (!block) return MYSTERY_REFUSALS.NO_MYSTERY_WORLD;
    if (request?.story !== undefined && request.story !== block.story) return MYSTERY_REFUSALS.OTHER_STORY;
    if (request?.version != null && block.version != null && request.version !== block.version) {
      return MYSTERY_REFUSALS.OTHER_VERSION;
    }
    return null;
  }

  _refuse(reason, block) {
    this._lastSent = null;
    this._eventBus.publish(MYSTERY_EVENTS.REFUSED, {
      reason,
      story: block?.story ?? null,
      version: block?.version ?? null,
    });
    this._log('warn', `refused the page: ${reason}`);
  }

  handleRequestState(request) {
    this._pageAsked = true;
    if (typeof request?.story === 'string') this._pageStory = request.story;
    const block = this._block();
    const reason = this.refusalFor(block, request);
    if (reason) return this._refuse(reason, block);
    this._send(this._state(block));
  }

  /** Send the state when the page has asked and the state differs from the last one sent. */
  sendStateIfChanged() {
    if (!this._pageAsked) return;
    const block = this._block();
    if (!block) return;
    const state = this._state(block);
    if (JSON.stringify(state) === this._lastSent) return;
    this._send(state);
  }

  _send(state) {
    this._lastSent = JSON.stringify(state);
    this._eventBus.publish(MYSTERY_EVENTS.STATE, state);
  }

  handleQuestionSolved(data) {
    const block = this._block(typeof data?.story === 'string' ? data.story : undefined);
    const reason = this.refusalFor(block, { story: data?.story });
    if (reason) return this._refuse(reason, block);
    const locationName = block.locationOfQuestion.get(data?.questionId);
    if (!locationName) {
      this._log('warn', `no location for question "${data?.questionId}"`);
      return;
    }
    // A case that is a region is answered only in it, under every lock. The page sends the
    // question again while the state lacks it, so it is checked once the player is back.
    if (block.regionId && !inOfficeNow(block, this._getActiveRegionId(), this._getLivePlay())) {
      this._log('warn', `question "${data?.questionId}" solved while region "${block.regionId}" is not played by hand: not checked`);
      return;
    }
    // Not remembered here on purpose: the page sends a solved question again when `mystery:state`
    // lacks it, and that is how a check lost on the way is recovered. What IS already checked is
    // read from the state.
    const checked = this._getSnapshot()?.checkedLocations;
    if (Array.isArray(checked) && checked.includes(locationName)) return;
    this._dispatcher.publish('user:locationCheck', {
      locationName,
      sourceModule: SOURCE_MODULE,
      reportedByGame: true, // the page solved the question: never logic-gated (client/core/checkGate.js)
    }, 'bottom');
  }
}
