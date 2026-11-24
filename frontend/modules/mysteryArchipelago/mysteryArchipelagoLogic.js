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
//   host -> page  mystery:state          { story, version, game, connected, papers, solved }
//   host -> page  mystery:refused        { reason, story, version }
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
    seedName: staticData.seed_name != null ? String(staticData.seed_name) : '',
    questionOfLocation: block.locations,
    paperOfItem: block.items,
    locationOfQuestion,
  };
}

/** The `game` string: one slot of one generated multiworld. */
export function gameKeyOf(block, connection) {
  if (connection?.connected) return `${block.seedName}:${connection.team ?? 0}:${connection.slot ?? block.player}`;
  return `offline:${block.seedName}:${block.player}`;
}

/**
 * The whole `mystery:state` payload for a block, a state snapshot and the connection.
 * Both lists are sorted, so two equal states are equal as JSON.
 */
export function mysteryStateOf(block, snapshot, connection) {
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
   * @param {(level: string, message: string, ...data: any[]) => void} [deps.log]
   */
  constructor({ eventBus, dispatcher, getStaticData, getSnapshot, getConnection, log = () => {} }) {
    this._eventBus = eventBus;
    this._dispatcher = dispatcher;
    this._getStaticData = getStaticData;
    this._getSnapshot = getSnapshot;
    this._log = log;
    this._getConnection = getConnection;
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
    const block = mysteryBlockOf(this._getStaticData());
    const reason = this.refusalFor(block, request);
    if (reason) return this._refuse(reason, block);
    this._send(mysteryStateOf(block, this._getSnapshot(), this._getConnection()));
  }

  /** Send the state when the page has asked and the state differs from the last one sent. */
  sendStateIfChanged() {
    if (!this._pageAsked) return;
    const block = mysteryBlockOf(this._getStaticData());
    if (!block) return;
    const state = mysteryStateOf(block, this._getSnapshot(), this._getConnection());
    if (JSON.stringify(state) === this._lastSent) return;
    this._send(state);
  }

  _send(state) {
    this._lastSent = JSON.stringify(state);
    this._eventBus.publish(MYSTERY_EVENTS.STATE, state);
  }

  handleQuestionSolved(data) {
    const block = mysteryBlockOf(this._getStaticData());
    const reason = this.refusalFor(block, { story: data?.story });
    if (reason) return this._refuse(reason, block);
    const locationName = block.locationOfQuestion.get(data?.questionId);
    if (!locationName) {
      this._log('warn', `no location for question "${data?.questionId}"`);
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
