/**
 * apworldEditor — **VITEST HELPERS** shared by the zone-source rows
 * (`regionContent.test.js`, `recordedZoneConfig.test.js`). Not shipped.
 *
 * ⛓⛓ APWORLD SUBSTRATE CHANGE R6c. The five pipeline-built jta fixtures were
 * RE-RECORDED with their `procgen_metadata` block (user ruling 2026-09-24). The
 * rows that needed a document WITHOUT a record had read one straight off the
 * corpus, so the re-record turned them red: they pinned what the corpus lacked,
 * not what the code does. A row about the UN-recorded case now builds that
 * document from a copy of the committed fixture, so it reads the same whatever
 * the corpus records.
 */

/** ⛓ A copy of `doc` with its whole `procgen_metadata` block removed (the input is never mutated). */
export function withoutProcgenMetadata(doc) {
    const out = JSON.parse(JSON.stringify(doc));
    delete out.procgen_metadata;
    return out;
}
