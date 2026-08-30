/**
 * reference/sources — **THE MODULES THE TABLES ARE MADE OF, AND WHERE THEIR
 * SOURCE TEXT LIVES.**
 *
 * `M` is the code's own answer, imported; `SOURCES` is the path of every file a
 * declared scan reads. Both are shared by the six builders, which is why they
 * are here rather than in one of them.
 */

export const M = {
    urlParams: await import('../../../frontend/modules/procgenCore/urlParams.js'),
    levelGenerator: await import('../../../frontend/modules/procgenCore/levelGenerator.js'),
    skeletonKinds: await import('../../../frontend/modules/procgenCore/skeletonKinds.js'),
    elementSpec: await import('../../../frontend/modules/procgenCore/elementSpec.js'),
    areaSpec: await import('../../../frontend/modules/procgenCore/areaSpec.js'),
    areaGraph: await import('../../../frontend/modules/procgenCore/areaGraph.js'),
    killGate: await import('../../../frontend/modules/procgenCore/elements/killGate.js'),
    roomDoor: await import('../../../frontend/modules/procgenCore/elements/roomDoor.js'),
    blockPocket: await import('../../../frontend/modules/procgenCore/elements/blockPocket.js'),
    openChamber: await import('../../../frontend/modules/procgenCore/elements/openChamber.js'),
    palette: await import('../../../frontend/modules/seedlingDemo/procgenPalette.js'),
    seedling: await import('../../../frontend/modules/seedlingDemo/procgenSeedling.js'),
    seedlingElements: await import('../../../frontend/modules/seedlingDemo/procgenSeedlingElements.js'),
    watchGenerate: await import('../../../frontend/modules/seedlingDemo/watchGenerate.js'),
    oracle: await import('../../../frontend/modules/seedlingDemo/procgenOracle.js'),
    mazeLab: await import('../../../frontend/modules/mazeRoom/mazeLab.js'),
    maze: await import('../../../frontend/modules/mazeRoom/procgenMaze.js'),
    glossary: await import('../../../frontend/modules/procgenDocs/glossary.js'),
    /** ⛓ The docs page's OWN heading reader — so the docs index counts headings
     *  with the same rule the page slugs them with, not a second regex. */
    ghSlug: await import('../../../frontend/modules/procgenDocs/ghSlug.js'),
};

export const SOURCES = {
    urlParams: 'frontend/modules/procgenCore/urlParams.js',
    watchGenerate: 'frontend/modules/seedlingDemo/watchGenerate.js',
    watchViewer: 'frontend/modules/seedlingDemo/watchViewer.js',
    watchSolve: 'frontend/modules/seedlingDemo/watchSolve.js',
    watchManual: 'frontend/modules/seedlingDemo/watchManual.js',
    mazeLab: 'frontend/modules/mazeRoom/mazeLab.js',
    mazeLabView: 'frontend/modules/mazeRoom/mazeLabView.js',
    killGate: 'frontend/modules/procgenCore/elements/killGate.js',
    roomDoor: 'frontend/modules/procgenCore/elements/roomDoor.js',
    blockPocket: 'frontend/modules/procgenCore/elements/blockPocket.js',
    openChamber: 'frontend/modules/procgenCore/elements/openChamber.js',
    seedlingElements: 'frontend/modules/seedlingDemo/procgenSeedlingElements.js',
    seedling: 'frontend/modules/seedlingDemo/procgenSeedling.js',
    elementSpec: 'frontend/modules/procgenCore/elementSpec.js',
    areaGraph: 'frontend/modules/procgenCore/areaGraph.js',
    maze: 'frontend/modules/mazeRoom/procgenMaze.js',
    oracle: 'frontend/modules/seedlingDemo/procgenOracle.js',
    levelGenerator: 'frontend/modules/procgenCore/levelGenerator.js',
};
