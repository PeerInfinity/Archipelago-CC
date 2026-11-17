/**
 * seedlingPackProvenance — **THE PROVENANCE BLOCKS OF THE GENERATED PACKS**
 * (`seedling`, `archipelago`; ⛓ CONTENT SETS PL-1, Z.7 backfill).
 *
 * The extractors (`extract-seedling-art-packs.mjs`, which owns `pack.json` and
 * builds every layer; `extract-seedling-sfx-pack.mjs`; `extract-seedling-music-pack.mjs`)
 * write each layer manifest's `provenance` block from here, so a regenerated
 * manifest carries it and `--check` holds it like every other byte.
 *
 * ⛔ THE COMMIT IS THE PIN. A `game` source names `vendor/seedling` at the commit
 * this repository's index pins (`git ls-files -s vendor/seedling`), not the HEAD
 * of whatever checkout `--source` names: the pin is the source of record, and a
 * copy of the checkout (the mutant tests build from one) gives the same bytes.
 *
 * ⛔ An AUTHORED art row (`authored` on its table row: built by a producer, not
 * copied from the checkout) must have its own source in `AUTHORED_SOURCES`, by
 * key; `artProvenance` refuses a row it has no source for, by name.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEEDLING_REPO, SEEDLING_SUBMODULE } from './seedlingSource.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ART_SCRIPT = 'scripts/procgen/extract-seedling-art-packs.mjs --check';
const SFX_SCRIPT = 'scripts/procgen/extract-seedling-sfx-pack.mjs --check';
const MUSIC_SCRIPT = 'scripts/procgen/extract-seedling-music-pack.mjs --check';

/** The `vendor/seedling` commit this repository pins (its index's gitlink); refused by name when there is none. */
export function seedlingPinnedCommit(repo = REPO) {
    let out = '';
    try {
        out = execFileSync('git', ['-C', repo, 'ls-files', '-s', '--', SEEDLING_SUBMODULE], { encoding: 'utf8' });
    } catch (err) {
        throw new Error(`seedlingPinnedCommit: git ls-files -s ${SEEDLING_SUBMODULE} failed in ${repo} (${err.message})`);
    }
    const m = /^160000 ([0-9a-f]{40}) /.exec(out);
    if (!m) throw new Error(`seedlingPinnedCommit: ${repo} pins no ${SEEDLING_SUBMODULE} gitlink (got ${JSON.stringify(out.trim())})`);
    return m[1];
}

/** The Seedling game source for one layer. */
const seedlingGame = (commit, { files, credit, extractedBy }) => ({
    type: 'game',
    name: 'Seedling',
    repo: SEEDLING_REPO,
    commit,
    files,
    credit,
    licence: 'Unlicense',
    extracted_by: extractedBy,
});

/**
 * The sources of the art rows a producer BUILDS (`authored` on the table row), by art key. Each records who made
 * it: the font's glyph table was written by the model named in its commit's `Co-Authored-By` trailer; the 64x64
 * logo is derived from the Archipelago icon by a script.
 */
export const AUTHORED_SOURCES = Object.freeze({
    'seedling:font/default': Object.freeze({
        id: 'font',
        source: Object.freeze({
            type: 'model',
            model: 'claude-opus-5-5',
            date: '2026-10-21',
            licence: 'MIT',
            note: 'ORIGINAL glyphs (not 04B_03): the glyph table in scripts/procgen/make-seedling-font.mjs, first '
                + 'committed in e7288a431d (Co-Authored-By: Claude Opus 5.5); the sheet is that script\'s '
                + 'fontSheetBytes(), not a checkout file',
        }),
    }),
    'archipelago:pickup/item-64': Object.freeze({
        id: 'logo64',
        source: Object.freeze({
            type: 'derived',
            from: Object.freeze(['archipelago-icon']),
            by: 'scripts/procgen/archipelagoLogoArt.mjs',
            licence: 'MIT',
            note: 'data/icon.png (512x512) by an 8x8 box filter',
        }),
    }),
});

/** Sources an AUTHORED source's `from` names, by id, added beside it. */
const SUPPORTING_SOURCES = Object.freeze({
    'archipelago-icon': Object.freeze({
        type: 'game', name: 'Archipelago (the application icon)', path: 'data/icon.png', licence: 'MIT',
    }),
});

/**
 * The art layer's block for pack `packId`. `rows` are its `ART_TABLE` rows; an authored row's key becomes a
 * `groups` entry naming its own source (a whole key is its own prefix).
 */
export function artProvenance(packId, rows, commit) {
    const sources = {};
    if (packId === 'seedling') {
        sources.seedling = seedlingGame(commit, {
            files: ['assets/graphics'],
            credit: 'art by Connor Ullmann (vendor/seedling/README)',
            extractedBy: ART_SCRIPT,
        });
    } else if (packId === 'archipelago') {
        sources['seedling-fork'] = {
            ...seedlingGame(commit, {
                files: ['assets/graphics/ArchipelagoLogo.png'],
                credit: 'the Archipelago application icon, downscaled to 16x16 by the Seedling fork '
                    + '(src/Pickups/APItem.as:67-73)',
                extractedBy: ART_SCRIPT,
            }),
            name: 'Seedling (the PeerInfinity fork\'s AP item pickup)',
            licence: 'MIT',
        };
    } else {
        throw new Error(`artProvenance: no provenance for the generated pack "${packId}"`);
    }
    const [def] = Object.keys(sources);
    const groups = {};
    for (const row of rows.filter((r) => r.authored)) {
        const a = AUTHORED_SOURCES[row.key];
        if (!a) throw new Error(`${row.key}: an authored art row with no source in seedlingPackProvenance.AUTHORED_SOURCES`);
        sources[a.id] = a.source;
        for (const from of a.source.from ?? []) if (SUPPORTING_SOURCES[from]) sources[from] = SUPPORTING_SOURCES[from];
        groups[row.key] = a.id;
    }
    return { sources, default: def, ...(Object.keys(groups).length ? { groups } : {}) };
}

/** The sfx layer's block. */
export function sfxProvenance(commit) {
    return {
        sources: {
            seedling: seedlingGame(commit, {
                files: ['src/Music.as', 'assets/sound'],
                credit: 'sound effects by Rekcahdam (vendor/seedling/README)',
                extractedBy: SFX_SCRIPT,
            }),
        },
        default: 'seedling',
    };
}

/** The music layer's block. */
export function musicProvenance(commit) {
    return {
        sources: {
            seedling: seedlingGame(commit, {
                files: ['src/Music.as', 'assets/sound'],
                credit: 'music by Rekcahdam (vendor/seedling/README)',
                extractedBy: MUSIC_SCRIPT,
            }),
        },
        default: 'seedling',
    };
}
