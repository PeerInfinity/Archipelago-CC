/**
 * ⛓ THE INLINE REGION-REACHABILITY COPIES AS THEY WERE BEFORE region-view-dedup — a FROZEN ORACLE for
 * `reachabilityCopies.equivalence.test.js` and `scripts/dev/region-panels-dom-snapshot.mjs`, and nothing else (no app
 * code imports it).
 *
 * The slice replaced each REPLACED copy below with `isRegionReachable(snapshot, name)` (`regionViewModel.js`). Each is
 * kept here VERBATIM from base `39b1df8cbd8e3a4b216cb06ac07ded2534b6b8d3`: the statement lines are the base's, cut with
 * `sed -n`; only the function wrappers (which name the inputs the statements read) and the `return` are new.
 * The LEFT-ALONE copies (a different status set or a different input) are kept too, so the test can MEASURE how they
 * differ from the helper; they were not replaced.
 * ⛔ Do not edit the bodies: they are the measurement.
 */

/* ══════════ REPLACED ══════════ */

/** exits/exitUI.js:596-600 (the traversability filter, parent side). */
export function exitFilterParent(snapshot, parentRegionName) {
      const parentRegionStatus = snapshot.regionReachability?.[parentRegionName];
      const parentRegionReachable =
        parentRegionStatus === true ||
        parentRegionStatus === 'reachable' ||
        parentRegionStatus === 'checked';
    return parentRegionReachable;
}

/** exits/exitUI.js:614-618 (the traversability filter, connected side). */
export function exitFilterConnected(snapshot, connectedRegionName) {
      const connectedRegionStatus = snapshot.regionReachability?.[connectedRegionName];
      const connectedRegionReachable =
        connectedRegionStatus === true ||
        connectedRegionStatus === 'reachable' ||
        connectedRegionStatus === 'checked';
    return connectedRegionReachable;
}

/** exits/exitUI.js:702-709 (the 'accessibility' sort, exit A). → [parent, connected] */
export function exitSortA(snapshot, a) {
        const parentAReachable =
          (snapshot.regionReachability?.[a.parentRegion]) === true ||
          (snapshot.regionReachability?.[a.parentRegion]) === 'reachable' ||
          (snapshot.regionReachability?.[a.parentRegion]) === 'checked';
        const connectedAReachable =
          (snapshot.regionReachability?.[a.connectedRegion]) === true ||
          (snapshot.regionReachability?.[a.connectedRegion]) === 'reachable' ||
          (snapshot.regionReachability?.[a.connectedRegion]) === 'checked';
    return [parentAReachable, connectedAReachable];
}

/** exits/exitUI.js:731-738 (the 'accessibility' sort, exit B). → [parent, connected] */
export function exitSortB(snapshot, b) {
        const parentBReachable =
          (snapshot.regionReachability?.[b.parentRegion]) === true ||
          (snapshot.regionReachability?.[b.parentRegion]) === 'reachable' ||
          (snapshot.regionReachability?.[b.parentRegion]) === 'checked';
        const connectedBReachable =
          (snapshot.regionReachability?.[b.connectedRegion]) === true ||
          (snapshot.regionReachability?.[b.connectedRegion]) === 'reachable' ||
          (snapshot.regionReachability?.[b.connectedRegion]) === 'checked';
    return [parentBReachable, connectedBReachable];
}

/** exits/exitUI.js:894-904 (the card render). → [parent, connected] */
export function exitCard(snapshot, parentRegionName, connectedRegionName) {
        const parentRegionStatus = snapshot.regionReachability?.[parentRegionName];
        const parentRegionReachable =
          parentRegionStatus === true ||
          parentRegionStatus === 'reachable' ||
          parentRegionStatus === 'checked';
          
        const connectedRegionStatus = snapshot.regionReachability?.[connectedRegionName];
        const connectedRegionReachable =
          connectedRegionStatus === true ||
          connectedRegionStatus === 'reachable' ||
          connectedRegionStatus === 'checked';
    return [parentRegionReachable, connectedRegionReachable];
}

/** regions/index.js:200-211 (the exit-click traversability test). → [parent, connected] */
export function regionsExitClick(snapshot, sourceRegion, destinationRegion) {
  const parentRegionStatus = snapshot.regionReachability?.[sourceRegion];
  const parentRegionReachable =
    parentRegionStatus === true ||
    parentRegionStatus === 'reachable' ||
    parentRegionStatus === 'checked';

  // Check connected region reachability
  const connectedRegionStatus = snapshot.regionReachability?.[destinationRegion];
  const connectedRegionReachable =
    connectedRegionStatus === true ||
    connectedRegionStatus === 'reachable' ||
    connectedRegionStatus === 'checked';
  return [parentRegionReachable, connectedRegionReachable];
}

/** regions/navigationManager.js:87-90 (computeRegionsToRender, Show All). */
export function navShowAll(snapshot, name) {
    return {
        isReachable:
          snapshot.regionReachability?.[name] === true ||
          snapshot.regionReachability?.[name] === 'reachable' ||
          snapshot.regionReachability?.[name] === 'checked',
    }.isReachable;
}

/** regions/navigationManager.js:117-120 (computeRegionsToRender, the path). */
export function navPath(snapshot, vr) {
    return {
          isReachable:
            snapshot.regionReachability?.[vr.name] === true ||
            snapshot.regionReachability?.[vr.name] === 'reachable' ||
            snapshot.regionReachability?.[vr.name] === 'checked',
    }.isReachable;
}

/** regions/navigationManager.js:134-137 (computeRegionsToRender, the last region only). */
export function navLast(snapshot, lastRegion) {
    return {
          isReachable:
            snapshot.regionReachability?.[lastRegion.name] === true ||
            snapshot.regionReachability?.[lastRegion.name] === 'reachable' ||
            snapshot.regionReachability?.[lastRegion.name] === 'checked',
    }.isReachable;
}

/** regions/regionBlockBuilder.js:563-566 (addEntrances, the entrance's source region). */
export function blockEntranceSource(snapshot, entrance) {
        const sourceRegionReachable =
          snapshot.regionReachability?.[entrance.sourceRegion] === true ||
          snapshot.regionReachability?.[entrance.sourceRegion] === 'reachable' ||
          snapshot.regionReachability?.[entrance.sourceRegion] === 'checked';
    return sourceRegionReachable;
}

/** regions/regionBlockBuilder.js:747-750 (addExits, the exit's connected region). */
export function blockExitConnected(snapshot, connectedRegionName) {
        const connectedRegionReachable =
          snapshot.regionReachability?.[connectedRegionName] === true ||
          snapshot.regionReachability?.[connectedRegionName] === 'reachable' ||
          snapshot.regionReachability?.[connectedRegionName] === 'checked';
    return connectedRegionReachable;
}

/**
 * commonUI/commonUI.js:2856-2870 (createRegionLink's displayStatus; the replaced part is the first `if`'s condition,
 * so the whole three-way answer is kept). → true | false | undefined
 */
export function regionLinkDisplayStatus(snapshot, regionName) {
    const rawStatus = snapshot?.regionReachability?.[regionName];
    let displayStatus; // Will be true (accessible), false (inaccessible), or undefined (unknown)

    if (
      rawStatus === 'reachable' ||
      rawStatus === 'checked' ||
      rawStatus === true
    ) {
      displayStatus = true;
    } else if (rawStatus === undefined) {
      displayStatus = undefined; // Explicitly undefined if not in snapshot or snapshot missing
    } else {
      // Covers: false, 'unreachable', 'locked', or any other string not explicitly 'reachable' or 'checked'
      displayStatus = false;
    }
    return displayStatus;
}

/** commonUI/commonUI.js:2964-2969 (createLocationLink, its region). */
export function locationLinkRegion(snapshot, regionName) {
    const regionStatus = snapshot?.regionReachability?.[regionName];
    const isRegionAccessible = (
      regionStatus === 'reachable' ||
      regionStatus === 'checked' ||
      regionStatus === true
    );
    return isRegionAccessible;
}

/* ══════════ LEFT ALONE (they differ from the helper; measured, not replaced) ══════════ */

/**
 * locations/locationUI.js:834-838 — the same two-value test at :988-992, :1025-1029, :1073-1077, :1107-1111 and
 * :1211-1215. No `true`.
 */
export function locationsParentRegion(snapshot, parentRegionName) {
        const parentRegionReachabilityStatus =
          snapshot?.regionReachability?.[parentRegionName];
        const isParentRegionEffectivelyReachable =
          parentRegionReachabilityStatus === 'reachable' ||
          parentRegionReachabilityStatus === 'checked';
    return isParentRegionEffectivelyReachable;
}

/** exits/exitUI.js:770-775 (the 'accessibility_original' sort; the same at :796-801 for B). No `'reachable'`. */
export function exitSortOriginalA(snapshot, a) {
        const parentAReachable =
          (snapshot.regionReachability?.[a.parentRegion]) === true ||
          (snapshot.regionReachability?.[a.parentRegion]) === 'checked';
        const connectedAReachable =
          (snapshot.regionReachability?.[a.connectedRegion]) === true ||
          (snapshot.regionReachability?.[a.connectedRegion]) === 'checked';
    return [parentAReachable, connectedAReachable];
}
