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
// M1 scope note: the block KEY here is `region#instance`. The design doc's
// fuller (region, arrivalKey, ordinal) recording tag is deliberately NOT
// built here — that partitioning only matters for matching persistent
// recordings (M2's savedQueueStore), and instanceNumber is already a stable,
// unique per-region block identity (a middle visit can't be deleted without
// removing every later visit too — regionMoves are never removed by
// removePathEntry). See loops-block-modes-m1-opus-kickoff.md §6 recon.

/** Canonical block key for a (region, instance) visit. */
export function blockKeyOf(region, instance) {
  return `${region}#${instance}`;
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

  function ensureVisit(name, instance) {
    const key = blockKeyOf(name, instance);
    const existing = visitIndex.get(key);
    if (existing !== undefined) return visits[existing];
    const visit = { key, name, instance, actions: [] };
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
      // that block). Ensure it renders even with no actions queued there.
      ensureVisit(pathEntry.destinationRegion, entryInstance);
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

export default { blockKeyOf, resolveQueueBlocks };
