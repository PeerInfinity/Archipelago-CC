/**
 * The region-libraries index (`frontend/region-libraries/region_library_files.json`)
 * is written by more than one pack maker (make-demo-bounce-pack.mjs,
 * make-demo-cloudberry-pack.mjs). Each registers its own row.
 *
 * ⛔ A row is REPLACED IN PLACE, never dropped and re-appended. The old
 * `filter(...)` + `push(...)` moved the writer's row to the END of `libraries`,
 * so the index's bytes depended on which pack maker ran last — a run-order
 * dependence through a file on disk (slice omsi-test-presets-order, 2026-11-11).
 * A row that is not there yet is appended.
 */

/**
 * Register `entry` in `index.libraries`, keyed by `entry.file`. Returns the
 * index (mutated). The row keeps its position when it is already present.
 */
export function upsertLibraryIndexEntry(index, entry) {
    if (!entry || typeof entry.file !== 'string') {
        throw new Error('upsertLibraryIndexEntry: entry.file is required');
    }
    const libraries = Array.isArray(index.libraries) ? index.libraries : [];
    const at = libraries.findIndex((l) => l?.file === entry.file);
    // A later duplicate row for the same file is stale: it goes.
    index.libraries = at < 0
        ? [...libraries, entry]
        : libraries.flatMap((l, i) => (i === at ? [entry] : l?.file === entry.file ? [] : [l]));
    return index;
}
