// blockIdentity.js
//
// Single source of truth for "which region-visit block does a queue entry
// belong to". A region visit ("block") is a (region, instanceNumber) pair —
// the same identity the loops panel already uses everywhere
// (dataset.regionInstance, expansionState.isRegionExpanded, the mode map).
//
// This logic used to live only inside LoopRenderer.groupActionsByVisit; it's
// extracted here so loopState (execution) resolves the exact same block for a
// queue index that the renderer draws the radios on. Getting them to agree is
// the whole point: a regionMove's own instanceNumber names its DESTINATION
// block, but the move is rendered inside — and manually driven from — its
// SOURCE block, so a naive (sourceRegion, instanceNumber) lookup would pick
// the wrong block for the leaving move. Walking the queue is the only way to
// recover the source instance.
//
// The block KEY here is `region#instance` — the transient, queue-shaped
// identity M1 uses for the mode map. It is DISTINCT from the persistent
// recording TAG `(region, arrivalKey, ordinal)` that M2 uses to match stored
// recordings across block deletion (see arrivalKeyOf / assignRecordingTags
// below). instanceNumber is a stable, unique per-region block identity (a
// middle visit can't be deleted without removing every later visit too —
// regionMoves are never removed by removePathEntry), so it is the correct key
// for the transient map; the recording tag deliberately keys on where the
// visit was ENTERED FROM instead, so a recreated block finds the same
// recording. See loops-region-block-modes-design.md §4 (post-M1 corrected).

/** Canonical block key for a (region, instance) visit. */
export function blockKeyOf(region, instance) {
  return `${region}#${instance}`;
}

/**
 * Canonical recording-tag string for a (region, arrivalKey, ordinal) visit.
 * Persistent identity — survives block deletion/recreation.
 */
export function recordingTagOf(region, arrivalKey, ordinal) {
  return `${region}␟${arrivalKey}␟${ordinal}`;
}

/**
 * Resolve a block's canonical `arrivalKey` — the id the SUBSTRATE RECORDERS
 * capture as `arrivedFrom.exit_id ?? 'entrance'`. The recorders store a
 * DESTINATION-region exit id, obtained by mapping the source exit through
 * `sourceWorld.exits.get(exitName).targetExitId` (this is exactly what
 * procgenPlayer.handleRegionMove does before publishing `<kind>:loadRegion`).
 * The queue side only has the SOURCE exit name (`exitUsed`) on the entering
 * regionMove, so we reproduce the same mapping here against the same live
 * warehouse world. Truthiness guards mirror handleRegionMove exactly so both
 * sides fall back to the raw source name in the identical cases.
 *
 * @param {?{sourceRegion:string, exitUsed:?string}} enteredVia
 *   the entering move's raw pair, or null for the start block
 * @param {?{get?:Function}} warehouse
 *   the live procgenPlayer warehouse (Map-like: region → { world }); may be
 *   null in non-procgen / test contexts, in which case the raw exitUsed is
 *   used (the recorder falls back identically).
 * @returns {string} the arrivalKey ('entrance' for the start block)
 */
export function arrivalKeyOf(enteredVia, warehouse) {
  if (!enteredVia || !enteredVia.exitUsed) return 'entrance';
  const { sourceRegion, exitUsed } = enteredVia;
  let id = exitUsed; // source exit name — the fallback, matches handleRegionMove
  const world = sourceRegion ? warehouse?.get?.(sourceRegion)?.world : null;
  const exits = world?.exits;
  if (exits && typeof exits.has === 'function' && exits.has(exitUsed)) {
    const targetExitId = exits.get(exitUsed)?.targetExitId;
    if (targetExitId) id = targetExitId; // → destination exit id
  }
  return id;
}

/**
 * Stamp each visit block with its persistent recording tag
 * `(region, arrivalKey, ordinal)`. `ordinal` is the 0-based count of
 * preceding visits in the queue that share the same `(region, arrivalKey)`.
 * Mutates and returns the same `visits` array (adds `arrivalKey`, `ordinal`,
 * `recordingTag`). Kept out of resolveQueueBlocks so the pure renderer path
 * never needs the warehouse.
 *
 * @param {Array} visits - from resolveQueueBlocks(...).visits (carry enteredVia)
 * @param {?{get?:Function}} warehouse - live procgenPlayer warehouse or null
 * @returns {Array} the same visits, now tagged
 */
export function assignRecordingTags(visits, warehouse) {
  const seen = new Map(); // `${region}␟${arrivalKey}` → next ordinal
  for (const v of visits || []) {
    const arrivalKey = arrivalKeyOf(v.enteredVia, warehouse);
    const groupKey = `${v.name}␟${arrivalKey}`;
    const ordinal = seen.get(groupKey) ?? 0;
    seen.set(groupKey, ordinal + 1);
    v.arrivalKey = arrivalKey;
    v.ordinal = ordinal;
    v.recordingTag = recordingTagOf(v.name, arrivalKey, ordinal);
  }
  return visits;
}

/**
 * Walk the action queue and assign every entry to its containing block.
 * Mirrors LoopRenderer.groupActionsByVisit's tracking exactly.
 *
 * @param {Array} actionQueue - the loops action queue (path entries)
 * @returns {{
 *   visits: Array<{key:string, name:string, instance:number, actions:Array}>,
 *   indexToBlock: Map<number, {region:string, instance:number, key:string}>
 * }}
 *   `visits` are the per-visit blocks in path order (each `actions` entry is
 *   `{ pathEntry, index, instanceNumber }`). `indexToBlock` maps each queue
 *   index to the block that owns it.
 */
export function resolveQueueBlocks(actionQueue) {
  const visits = [];
  const visitIndex = new Map(); // 'name#instance' -> index into visits
  const indexToBlock = new Map();

  function ensureVisit(name, instance, enteredVia = null) {
    const key = blockKeyOf(name, instance);
    const existing = visitIndex.get(key);
    if (existing !== undefined) return visits[existing];
    // enteredVia is captured only when the block is first created — a given
    // (region, instance) block is entered exactly once. Blocks not reached by
    // a regionMove (the start block) keep null → arrivalKey 'entrance'.
    const visit = { key, name, instance, actions: [], enteredVia };
    visitIndex.set(key, visits.length);
    visits.push(visit);
    return visit;
  }

  // Where the path "is" after processing entries so far. null until an
  // action anchors it.
  let current = null;

  (actionQueue || []).forEach((pathEntry, index) => {
    const entryInstance = pathEntry.instanceNumber || 1;
    if (pathEntry.type === 'regionMove') {
      // The move belongs to the SOURCE block we're currently in.
      const sourceInstance =
        (current && current.name === pathEntry.sourceRegion)
          ? current.instance
          : 1;
      const sourceVisit = ensureVisit(pathEntry.sourceRegion, sourceInstance);
      sourceVisit.actions.push({ pathEntry, index, instanceNumber: entryInstance });
      indexToBlock.set(index, {
        region: sourceVisit.name,
        instance: sourceVisit.instance,
        key: sourceVisit.key,
      });
      // After the move we're at the destination (its instanceNumber names
      // that block). Ensure it renders even with no actions queued there, and
      // record which exit entered it (raw source pair — the warehouse mapping
      // to the recorder-canonical arrivalKey happens in assignRecordingTags).
      ensureVisit(pathEntry.destinationRegion, entryInstance, {
        sourceRegion: pathEntry.sourceRegion,
        exitUsed: pathEntry.exitUsed ?? null,
      });
      current = { name: pathEntry.destinationRegion, instance: entryInstance };
    } else {
      // customAction / locationCheck / manual / customQueue — the entry
      // carries its own sourceRegion + instanceNumber (the instance of the
      // region it happens in). Trust them.
      const visit = ensureVisit(pathEntry.sourceRegion, entryInstance);
      visit.actions.push({ pathEntry, index, instanceNumber: entryInstance });
      indexToBlock.set(index, {
        region: visit.name,
        instance: visit.instance,
        key: visit.key,
      });
      current = { name: visit.name, instance: visit.instance };
    }
  });

  return { visits, indexToBlock };
}

export default {
  blockKeyOf,
  resolveQueueBlocks,
  recordingTagOf,
  arrivalKeyOf,
  assignRecordingTags,
};
