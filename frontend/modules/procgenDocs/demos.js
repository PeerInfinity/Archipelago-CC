/**
 * procgenDocs/demos.js — **THE PROCGEN DEMO CATALOGUE, AS DATA.** One frozen
 * entry per demonstrable feature of the two procgen lab pages: the URL that
 * shows it, the CLI command that reproduces it in node, which control to
 * press, and what you are looking at.
 *
 * ⚖ It exists because the user asked for it on the 2026-08-17 generation
 * review (§4 item 6): *"interactive DEMONSTRATIONS of every demonstrable
 * feature — URL + how to run + what is happening"*. It became a MODULE on
 * 2026-08-18 (⚖ the user: *"change demos.md to an html file, so that it can
 * interact with the scripts directly, rather than having to be manually
 * edited"*) — before that it was prose in `demos.md` that a browser row
 * PARSED, and every link had to be kept in step by hand.
 *
 * ⛔⛔ **ONE DATA MODULE, TWO READERS.** This file is the ONLY copy:
 *
 *   - `procgenDocs/demos.html` renders it in a browser (locally and on
 *     GitHub Pages) — the page IS its data, it fetches nothing.
 *   - `scripts/procgen/check-procgen-demos.mjs` IMPORTS it, loads every URL
 *     and asserts every entry's own claim off the page's readout.
 *
 * ⛓ And ONE module is read BY it: `procgenDocs/glossary.js`, through each
 * entry's `terms` (P2). The catalogue names glossary slugs; the glossary
 * computes the back-links. Neither imports the other's entry list.
 *
 * ⛓ Because both read the same module there is no second spelling to drift:
 * a URL edited here is the URL the page links AND the URL the row loads, in
 * the same commit. The old markdown carried a hand-kept `Live:` line per
 * entry and a coverage claim over the file's prose; both are gone —
 * `pagesHref()` below is the ONE spelling of the Pages mapping.
 *
 * ── THE ENTRY SHAPE ─────────────────────────────────────────────────────
 *
 *   id              stable slug — the page's anchor AND the row's `--only=`
 *   n, title        the catalogue number and the entry's headline
 *   page            REPO path to the .html (`/frontend/modules/…`)
 *   url             the query string — ⛔ the page WRITER's own spelling
 *   also            an optional SECOND URL the entry loads for contrast
 *   cli             the headless equivalent. ⚠ **AT `--count=1`, NEVER
 *                   `--count=0`, even where the URL says `count=0`**:
 *                   `levelGenerator` refuses `obstacleTarget: 0` by name
 *                   (*"there is no default that means unbounded"*), so a
 *                   step-0 URL's headless twin is the ONE-step ladder — the
 *                   element and the room are pass 1's either way. ⛔ Six
 *                   entries carried `--count=0` from the catalogue's first
 *                   day and every one of them THREW (exit 1); the row does
 *                   NOT run this field, which is why nobody noticed.
 *   phase           optional: step the phase ladder to it
 *   facts           optional: TICK these fact lines
 *   layer           optional: the overlay select
 *   control         optional: a control the entry asks the reader to PRESS,
 *                   as a CSS selector. ⛔ The row asserts it EXISTS on the
 *                   page — a catalogue that told people to press a button
 *                   that had been renamed would be prose nobody gated. It
 *                   is not PRESSED by the row: `#loadWasm` starts a wasm
 *                   boot, which is `check-seedling-wasm-pages.mjs`'s job
 *                   and needs a real ▶ Start the catalogue row cannot give.
 *   claim           `<path> <op> <value>`, asserted off the page's readout
 *   demonstrates    prose — what the entry shows
 *   howToRun        prose — which controls to press
 *   whatIsHappening prose — what you are looking at
 *   notes           prose — trailing ⚠ notes (a published bar, an acceptance
 *                   rate); may contain a fenced code block
 *   pointsAt        PROSE ENTRIES ONLY: the docs this one defers to
 *   terms           the GLOSSARY slugs this entry's prose uses — a flat array
 *                   of ids from `procgenDocs/glossary.js`. The page renders
 *                   them as a `terms:` line of anchor links into
 *                   `glossary.html`, and `glossary.test.js` asserts every one
 *                   RESOLVES. ⛔ Filled by PROCGEN DOCS P2; an entry naming a
 *                   term nobody defined reds the unit row.
 *   prose           true for an entry that names no URL of its own
 *
 * ⛔ THE PROSE IS STRINGS, NEVER HTML. The renderer handles a light markdown
 * subset — backticks, `**bold**`, `*italic*`, `[text](url)`, `<url>`, blank-
 * line paragraphs and ```fenced blocks — so the data stays readable in a diff
 * and a doc cannot inject markup into the page.
 *
 * ⛔⛔ **NEVER HAND-SPELL A URL.** Every one below came out of the page's own
 * writer (`watchGenerate.writeGenerateParams` / `mazeLab.writeLabParams`), so
 * pasting one back into the bar is a fixed point. To add or regenerate one,
 * see `docs/json/developer/procgen/demos.md` § *How to add an entry* — three
 * spellings each cost a run to find.
 */

/** ⛓ The deployed site. `.github/workflows/deploy-gh-pages.yml` publishes the
 *  `frontend/` directory AS the Pages root, so `/frontend/modules/…` here is
 *  `<base>/modules/…` there. */
export const PAGES_BASE = 'https://peerinfinity.github.io/Archipelago-CC';

/** ⛓ Where the sources live, for the links this page shows at a doc. */
export const REPO_URL = 'https://github.com/PeerInfinity/Archipelago-CC/blob/main';

/** `<origin>/frontend/modules/…?<url>` — the entry on a server rooted at the
 *  REPO root (the dev server on :8000). */
export function localHref(entry, { origin = '', url = entry.url } = {}) {
    return `${origin}${entry.page}?${url}`;
}

/** ⛓⛓ **THE ONE SPELLING OF THE PAGES MAPPING.** A repo path `/frontend/x`
 *  is `<base>/x` on the deployed site, because `deploy-gh-pages.yml`
 *  publishes `frontend/` AS the Pages root. ⛓ `pagesHref` below and
 *  `glossary.js`'s `hrefFor` are both spelled through THIS function rather
 *  than each carrying the strip — a mapping spelled once cannot disagree with
 *  itself, which is what the old hand-typed `Live:` lines proved the hard
 *  way. */
export function pagesUrl(page, { base = PAGES_BASE } = {}) {
    return `${String(base).replace(/\/$/, '')}${String(page).replace(/^\/frontend(?=\/)/, '')}`;
}

/** ⛓⛓ **THE INVERSE OF THAT MAPPING, AND IT IS SPELLED THROUGH IT.** A page
 *  under `procgenDocs/` needs to know where the SITE root is so it can fetch
 *  something that is not beside it — `docs.html` fetches the tracked `.md`s
 *  from `<siteRoot>/docs/json/developer/procgen/`, which is the repo root when
 *  the dev server is serving this tree and the Pages base when it is not.
 *
 *  ⛔ The strip is NOT written out a second time here. `pagesUrl(page, {base:
 *  ''})` already answers "what does this repo path look like on the deployed
 *  site"; this function just asks which of the two spellings the pathname it
 *  was handed actually ends with, and returns everything before it. A hand-
 *  written regex here would be a second answer to the same question, which is
 *  the exact failure the `Live:` lines proved the hard way.
 *
 *      /frontend/modules/procgenDocs/docs.html      →  ''  (repo root served)
 *      /Archipelago-CC/modules/procgenDocs/docs.html →  '/Archipelago-CC'
 *      /modules/procgenDocs/docs.html                →  ''  (frontend/ served)
 *
 *  ⛓ The repo-rooted form is tried FIRST, because a repo-rooted pathname ends
 *  with the Pages-shaped one too. */
export function siteRoot(pathname, { page = '/frontend/modules/procgenDocs/docs.html' } = {}) {
    const p = String(pathname);
    for (const tail of [page, pagesUrl(page, { base: '' })]) {
        if (p.endsWith(tail)) return p.slice(0, -tail.length);
    }
    return '';
}

/** `<base>/modules/…?<url>` — the SAME run on the deployed site. The row
 *  imports this rather than keeping its own copy. */
export function pagesHref(entry, { base = PAGES_BASE, url = entry.url } = {}) {
    return `${pagesUrl(entry.page, { base })}?${url}`;
}

/** A repo-relative doc path on GitHub — a prose entry's `pointsAt` targets. */
export function docHref(doc, { base = REPO_URL } = {}) {
    return `${base}/${String(doc).replace(/^\/+/, '')}`;
}

/** ⛓ THE CLAIM GRAMMAR LIVES HERE, not in the row: the page states a claim,
 *  the row asserts it, and the unit test parses every one of them. Two
 *  spellings of `>=` would be two answers to "is this entry well-formed".
 *  `a.b.c OP value` → `{path, op, value}`; a malformed claim THROWS. */
export const CLAIM_OPS = Object.freeze(['>=', '<=', '!=', '==', '>', '<', 'includes', 'matches']);

export function parseClaim(text) {
    for (const op of CLAIM_OPS) {
        const at = String(text).indexOf(` ${op} `);
        if (at < 0) continue;
        const path = String(text).slice(0, at).trim();
        const raw = String(text).slice(at + op.length + 2).trim();
        let value;
        try { value = JSON.parse(raw); } catch { value = raw; }
        return { path, op, value };
    }
    throw new Error(`the claim ${JSON.stringify(text)} has no operator — one of `
        + `[${CLAIM_OPS.join(' ')}] with a space each side`);
}

/** ⛓ The pages a reader (the row, the HTML) knows how to READ — the readout
 *  each one publishes. An entry naming anything else is a catalogue defect. */
export const READOUTS = Object.freeze(new Map([
    ['/frontend/modules/seedlingDemo/watch.html', '__editorGenerate'],
    ['/frontend/modules/mazeRoom/lab.html', '__mazeLab'],
]));

export const DEMOS = Object.freeze([
    Object.freeze({
        id: 'sites',
        n: 1,
        title: 'SITES — where pass 1 thinks a thing could stand',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=2 --skeleton=rooms --count=1',
        phase: null,
        facts: Object.freeze([]),
        layer: 'sites',
        claim: 'overlays.counts.sites >= 10',
        demonstrates: 'The SITE vocabulary (`procgenCore/sites.js`, arc 3\nslice 1): the room\'s nubs, its corridor cells, its chambers and its branch\nstubs, derived from the carved skeleton. ⛔ A site is a fact about the SEARCH,\nnever about legality — nothing is refused for standing off one.',
        howToRun: 'Open the URL, then set the `overlay` select to `sites`. The\nlegend under the canvas names every group drawn and its cell count.',
        whatIsHappening: '`rooms` is the one tree kind that reliably leaves a 10×10\nSeedling room with chambers in it, so it is the kind with something to show:\nthe chamber cells are the wide blobs, the corridor cells are the one-wide lanes\nbetween them, and the branch stubs are the dead ends the carver left. Pass 1\nproposes; the loop\'s own legality rules dispose.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'site',
            'chamber',
            'corridor',
            'the-carve',
            'skeleton-kind',
            'overlay-layer',
            'legend',
            'pass-1',
            'level',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'the-carve',
        n: 2,
        title: 'THE CARVE — a typed `chambers=0` is a different room',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D0&count=0&tries=8&k=3&anchortries=1',
        also: 'source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D1&count=0&tries=8&k=3&anchortries=1',
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --skeleton=\'winding;chambers=0\' --count=1 | head -3',
        phase: 'carve',
        facts: Object.freeze([]),
        layer: null,
        claim: 'phase.row.data.params.chambers == 0',
        demonstrates: '⛓ Arc 3, slice 5a\'s D2: Seedling\'s five carved tree\nkinds default `chambers` to **1** while the shared codec\'s default is **0**, so\nan OMITTED parameter and one TYPED at the codec\'s default had normalised to the\nsame object and the typed 0 was unspellable in a link. The reader now takes the\nstring AS TYPED. Measured through the page: **14 ground cells at a typed 0\nagainst 19 at the default**.',
        howToRun: 'Open the URL and press `PHASE ▶` until the label says\n`carve`. Then open the **Also** link beside it — the same seed at the DEFAULT\n`chambers=1` — and compare the same phase.',
        whatIsHappening: 'The `carve` row is the CONNECTOR\'s: it names the kind and\nthe effective parameters and its tile delta IS the carve. The two links differ\nin one parameter and the rooms differ in five ground cells; a link that could\nnot spell the typed 0 would have shown you the other room.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'the-carve',
            'chambers',
            'skeleton-kind',
            'connector',
            'phase-ladder',
            'ledger',
            'url-parameter',
            'draw',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'guard',
        n: 3,
        title: 'THE GUARD — a reverse-pull block, its flag and the cut its lock makes',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=12&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=guard%3Blen%3D2',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=12 --biome=pre-sword --elements=\'guard;len=2\' --count=1',
        phase: 'composite',
        facts: Object.freeze([
            'flag-and-lock',
            'flag-lock-flood-start',
            'flag-lock-flood-goal',
        ]),
        layer: null,
        claim: 'elements.certified == true',
        demonstrates: 'The pre-carve ELEMENT: a `reverse-pull-block` gadget\nconstructed in a reserved rectangle BEFORE the carve, joined to the room by the\nshortest tunnel, with its flag (`buttonroom`) and the flag\'s LOCK on a\nmain-path cut. ⛓ Slice S1 is what made it CERTIFY — the solver can now raise an\norder as the PREREQUISITE of reaching another obstacle\'s stance, and the\ncertification solve comes back `[\'weigh\',\'hold\',\'collect\']`.',
        howToRun: 'Open the URL, press `PHASE ▶` to `pre-carve` (the SITE\ncandidates and the site taken), then again to `composite`. Tick *the FLAG and\nits LOCK* and both *flag LOCK\'s cut* lines: the two floods are the room with the\nlock cell walled, and the flag is in the START-side one. Step on to\n`certification` and tick *the CERTIFICATION solve\'s ROUTE*.',
        whatIsHappening: 'The lock is a CUT, not decoration (⚖ ruling 17): with its\none cell walled the room falls into two components and the goal is in the far\none. The flag that opens it has to be in the near one, which is exactly what\nthe two floods show. The route is the solve\'s own walk — see the note on the\nline for why it has holes in it.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'guard',
            'pre-carve-element',
            'flag',
            'lock',
            'cut',
            'flood',
            'certification',
            'fact-line',
            'paintable',
            'solver',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'kill-gate',
        n: 4,
        title: 'THE KILL GATE — the candidate funnel, the grown wall, the DEMAND',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=2&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=2 --biome=post-sword --elements=killgate --count=1',
        phase: 'on-connector',
        facts: Object.freeze([
            'door-candidates-offered',
            'door-candidates-tried',
            'door-candidates-legal',
        ]),
        layer: null,
        claim: 'elements.certified == true',
        demonstrates: 'The `on-connector` element (arc 3, slice 4a): a lock\non a main-path cut whose wall is GROWN to fit the room, with the body whose\ndeath opens it in a start-side pocket, plus 4d\'s DEMAND — the region the body\nmoves in and the walls that keep it there, which pass 2 may not make lethal.',
        howToRun: 'Open the URL and step to `on-connector`. Tick the three\ncandidate lines in order and watch the funnel narrow: what the room OFFERED\n(every interior main-path cell), what reached the DOOR LAW (the rest were cut\nearlier — too near the goal, or no legal pocket), and what PASSED it. The PICK\nis outlined in the second colour. Step on to `composite` and tick the two\n*door law* floods and the DEMAND.',
        whatIsHappening: 'The element\'s ONE draw is a choice among candidates that\nhave ALL already passed every rule — a pick that landed on one the law would\nrefuse would be a draw spent to fail. `cost.candidates` on the payload carries\nonly the last number; the three lines are the only place the whole funnel is\nvisible, and every one of them is CARRIED out of the construct\'s own law calls\nrather than re-derived.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'kill-gate',
            'on-connector-element',
            'candidate-funnel',
            'demand',
            'door-law',
            'cut',
            'certification',
            'draw',
            'pass-2',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'block-pocket',
        n: 5,
        title: 'THE BLOCK POCKET — a block in the door and a straight run to a dead end',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=blockpocket',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=pre-sword --elements=blockpocket --count=1',
        phase: 'on-connector',
        facts: Object.freeze([
            'door-candidates-legal',
        ]),
        layer: null,
        claim: 'elements.ran == true',
        demonstrates: 'The second `on-connector` element: the block stands IN\nthe door cell (so its `clearer` is EMPTY — there is no separate thing to reach),\nand the run ends at the FIRST cell along the push where the room reconnects.',
        howToRun: 'Step to `on-connector` for the funnel, then to `composite`\nfor the cells the element OWNS and the carve\'s ONE MOUTH.',
        whatIsHappening: 'Clause (a) of the carve law admits a DEAD END and nothing\nelse: exactly one 4-neighbour of the whole carved blob is walkable once the\nplacement is painted. Two mouths would be a TUNNEL — a change to the room\'s\nconnectivity rather than a place to stand — and the `carve-mouth` line is that\nclause as a picture.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'block-pocket',
            'on-connector-element',
            'clearer',
            'mouth',
            'the-carve',
            'composite',
            'candidate-funnel',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'area-graph',
        n: 6,
        title: 'THE AREA GRAPH — the partition, the level-n floods and the vestibule',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=14&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=14 --skeleton=rooms --areas=1 --count=1',
        phase: 'realisation',
        facts: Object.freeze([
            'area-locks',
            'goal-vestibule',
            'level-0-reach',
        ]),
        layer: null,
        claim: 'areas.ran == true',
        demonstrates: '⛓ Arc 3, slice 4b: the AREA PARTITION (one 2×2 rule,\nshared with the maze), an intra-level lock-and-key graph over it, a lock on\nEVERY BOUNDARY CELL of every locked area, and the goal\'s VESTIBULE — a synthetic\narea of radius 2 grown so that no lock can land on the goal\'s doorstep.',
        howToRun: 'Step to `partition` first (one selectable line per area — a\nSYNTHETIC one is outlined rather than filled, because it is grown and not a\nchamber), then to `graph`, then to `realisation`. Tick *the GOAL\'s VESTIBULE*\nand the `level 0` flood: level 0 is what the entrance reaches with every\nlevel-1 lock treated as wall, and it stops at the boundary the locks sit on.',
        whatIsHappening: 'A locked edge is a CUT by construction of the tree; the\nlevel-n flood is the check that the GRID agrees, which is the one thing\nconstruction cannot promise. ⛔ When it DISAGREES the graph refuses and the level\nships carved — and the refusal now writes its own `realisation` row with the\noffending level\'s flood on it, which is the picture the refusal is about.',
        notes: Object.freeze([
            '⚠ Acceptance on a 10×10 Seedling room is **0–4 of 12 per kind** and the cause is\nthe AREA COUNT (4b §14.3) — published, not tuned. Most seeds refuse with\n`the-partition-yields-one-area-or-fewer`.',
        ]),
        terms: Object.freeze([
            'area-graph',
            'area-partition',
            'area',
            'key-level',
            'lock',
            'flag',
            'vestibule',
            'synthetic-area',
            'realisation',
            'flood',
            'graded-refusal',
            'chamber',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'sword-gated',
        n: 7,
        title: 'A SWORD-GATED LEVEL — `require:[\'hasSword\']`, graded STRONG',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=25&biome=post-sword&count=6&tries=8&k=3&anchortries=1&require=hasSword&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=25 --biome=post-sword --require=hasSword --count=6',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'require.grade == "STRONG"',
        demonstrates: '⛓ Arc 3, slice 4d: the generator is RULE-DIRECTED. You\nname an ITEM and it DERIVES the element head from `ELEMENT_TABLE.needs`, then\ngrades the finished level with a differential — the same run generated again\nwith the flag off, solved, and compared.',
        howToRun: 'Open the URL — it carries `run=1`, so the ladder runs to step\n6 on load. The identity line and the `require` block say `MET` and name the\ngrade.',
        whatIsHappening: 'The gate DECLARES a demand on its body\'s region — the\ncells the spinner moves in and the walls that keep it there — so pass-2 furniture\ncannot drown it and clear the lock for free. That is what makes the WITHOUT arm\nunsolvable rather than merely slower, which is what STRONG means.',
        notes: Object.freeze([
            '⚠ **THE BAR IS PUBLISHED, NOT TUNED — AND RE-RUNNING IT IS WHY THIS ENTRY\nMOVED.** The search below was stated before arc 3 ran it, and it returned **1\nhit, seed 30**, with `families>=3` the binding clause. Re-run unchanged at the\nclose of arc 5 it returns **3 hits — seeds 25, 33 and 38** — and seed 30 is no\nlonger one of them: since arc 5 slice 4 gave `arena` a `needs:[\'hasSword\']`,\n`--require=hasSword` FORCES the two-member list `killgate+arena` and spends a\npick, so seed 30 now draws the arena and refuses `no-cut-for-the-kill-lock`. ⛔\nEvery `--require=hasSword` number published before that slice is about a\nDIFFERENT spec. The entry is re-pointed at the first hit of the same scan rather\nthan at a relaxed bar.',
            '```bash\nnode scripts/procgen/find-seedling-seeds.mjs --seeds=1-40 --biome=post-sword \\\n    --require=hasSword \\\n    --where=\'certified,cause=sword,grade=STRONG,kept>=5,families>=3,noabort\'\n```',
        ]),
        terms: Object.freeze([
            'require-directive',
            'grade',
            'requirements-differential',
            'element-head',
            'demand',
            'biome',
            'generation-ladder',
            'sweep',
            'family',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'refused-directive',
        n: 8,
        title: 'A REFUSED DIRECTIVE — and the level is still shown',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=30&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&require=hasSword',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=30 --biome=pre-sword --require=hasSword --count=1; echo $?',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'require.refused.reason matches the-biome',
        demonstrates: '⛔ Where the Seedling page follows the CLI rather than\narc 1\'s maze rule: a refused `?require=` still SHOWS the level the run produced,\nlabelled. On the maze the graph IS the level\'s structure and a refused one\nleaves nothing worth showing; on Seedling a refused directive leaves a perfectly\nordinary level that the run really made.',
        howToRun: 'Open it and read the identity line: `requires: hasSword — ⛔\nREFUSED: the-biome-lacks-the-item`, with the level drawn underneath.',
        whatIsHappening: 'A pre-sword boot does not grant `hasSword`, so no element\nin the table can be forced to need it and the directive is refused BY NAME\nbefore a room exists. The CLI\'s exit code is 6 and it prints the level too.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'require-directive',
            'graded-refusal',
            'biome',
            'boot-items',
            'maze-lab',
            'lab-page',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'dropped-element',
        n: 9,
        title: 'A DROPPED ELEMENT — and it draws NOTHING',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=post-sword --elements=killgate --count=1',
        phase: null,
        facts: Object.freeze([]),
        layer: 'elements',
        claim: 'elements.refused.reason == "the-skeleton-does-not-solve-with-the-element"',
        demonstrates: '⛔ The arc\'s own dependency, published rather than\nsmoothed over: when the certification solve cannot walk the gadget, the level is\nregenerated WITHOUT it (the draws are spent either way) and the overlay draws no\nelement group at all — the REASON is a LEGEND row.',
        howToRun: 'Set the overlay to `elements` and look at the legend: no\ngroup, one note naming the refusal.',
        whatIsHappening: 'A picture of a gadget that is not in the level would be\nthe overlay disagreeing with the room. ⛓ The GEOMETRY the census measured is\nstill carried on the certification, so no number is lost — it is simply not on\nthe canvas.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'certification',
            'element',
            'kill-gate',
            'graded-refusal',
            'overlay-layer',
            'legend',
            'census',
            'draw',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'phase-step-through',
        n: 10,
        title: 'THE PHASE STEP-THROUGH ITSELF',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=12&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1',
        also: null,
        cli: null,
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'phase.count >= 6',
        demonstrates: '⚖ The user\'s requirement of 2026-08-17: *"a\nstep-through of the WHOLE generation — a button per step and a report at each"*.\nPhase *k* is the room as of ledger row *k*, rebuilt from the row DELTAS and\nhanded to the existing renderer. ⛔ Nothing is re-run.',
        howToRun: 'Press `PHASE ▶` from the start and read each row\'s own\nsentence, its tile/entity delta and its draw span. `the FINISHED level` returns\nto the end. At the last pass-1 row the label says *"pass 2 — use STEP"*, which\nis where the generation ladder takes over.',
        whatIsHappening: 'Every phase of pass 1 leaves a row behind it, written BY\nthat phase with the facts it had already computed. ⛔ A phase that is never\nREACHED writes NO ROW, which is what makes the omission visible — and folding\nback to phase *k* is NOT the same as re-running without what phase *k* did (a\n`pre-carve` element spends its draws before the carve, so the two reach the\ncarver at different stream positions).',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'phase-ladder',
            'ledger',
            'paintable',
            'fact-line',
            'generation-ladder',
            'pre-carve-element',
            'draw',
            'byte-inert',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'solve-replay',
        n: 11,
        title: 'THE SOLVE REPLAY AND THE SCRUB',
        page: null,
        url: null,
        also: null,
        cli: null,
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: null,
        demonstrates: 'The pass-2 half — the generation ladder, the per-anchor\nrefusals, and the solve replayed tick by tick over the finished level.',
        howToRun: null,
        whatIsHappening: '⛔ The ledger deliberately does NOT duplicate pass 2: the\nper-anchor refusals are `out.trace` as they stand, and the phase ladder hands\nover to the existing STEP control at the last pass-1 row. Two records of one\nthing would drift.',
        notes: Object.freeze([]),
        pointsAt: Object.freeze([
            Object.freeze({ label: 'Seedling Real-Game Bot', doc: 'docs/json/developer/procgen/seedling-bot.md', why: 'the STEP control, the generation pane and the scrub bar' }),
            Object.freeze({ label: 'Playback and Debugging Tools', doc: 'docs/json/developer/procgen/playback-and-debugging.md', why: 'the playback contract underneath them' }),
        ]),
        terms: Object.freeze([
            'solver',
            'generation-ladder',
            'phase-ladder',
            'playback-bot',
            'tape',
            'seedling',
        ]),
        prose: true,
    }),
    Object.freeze({
        id: 'maze-area-graph',
        n: 12,
        title: 'THE MAZE AREA GRAPH — `?areas=` and `?require=`',
        page: '/frontend/modules/mazeRoom/lab.html',
        url: 'source=generate&seed=1&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&require=K0&expansions=20000&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-maze-level.mjs --seed=1 --width=15 --height=15 --skeleton=rooms --areas=1 --require=K0 --count=2',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'areaGraph.ran == true',
        demonstrates: '⛓ Arc 1: the same area partition and the same\nlock-and-key graph, bound to the maze — where the room is big enough that the\ngraph accepts routinely — plus the RULE-DIRECTED `?require=K0`, which on this\npage names an area-graph SYMBOL rather than an item flag.',
        howToRun: 'Open it; the area layer control beside the canvas paints the\npartition, the doors and the keys. `?areas=1&require=K1` is the refusal — and on\nTHIS page a refused directive offers no level and no payload.',
        whatIsHappening: 'The graph is over AREAS, not cells: a locked edge cuts\nthe tree, the doors go on area-side boundary cells, and the level-n flood is the\ncheck that the grid agrees.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'maze-lab',
            'area-graph',
            'symbol',
            'require-directive',
            'key-level',
            'lock',
            'flag',
            'bfs-oracle',
            'grade',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'maze-element',
        n: 13,
        title: 'THE MAZE ELEMENT, AND THE SOLVE STEP-THROUGH',
        page: '/frontend/modules/mazeRoom/lab.html',
        url: 'source=generate&seed=2&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&elements=guard%3Blen%3D2%3Bturns%3D1&expansions=20000&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-maze-level.mjs --seed=2 --width=15 --height=15 --skeleton=rooms --areas=1 --elements=\'guard;len=2;turns=1\' --count=2',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'elementInfo.ran == true',
        demonstrates: '⛓ Arc 2: the SAME element the Seedling page binds —\n`reverse-pull-block` — constructed on the maze, plus `__mazeLab.play`, the\nstep-through of the SOLVE (as opposed to the generation).',
        howToRun: 'Open it, then press the solve controls to walk the plan a\nstep at a time.',
        whatIsHappening: 'The element CONTRACT is one shape across three bindings\n(arc 2 §9.2, unchanged): the maze maps its tiles and symbols onto grid tiles and\narea symbols, Seedling maps them onto blocks, buttons and locks, and neither\nre-derives the gadget\'s geometry.',
        notes: Object.freeze([]),
        terms: Object.freeze([
            'maze-lab',
            'element',
            'guard',
            'binding',
            'solver',
            'bfs-oracle',
            'maze-substrate',
            'certification',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'load-in-wasm',
        n: 14,
        title: '▶ LOAD IN WASM — the certified room, in the REAL recompiled game',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=pre-sword&count=4&tries=8&k=3&anchortries=1&run=1',
        also: null,
        cli: 'node scripts/procgen/check-seedling-wasm-ship.mjs',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        control: '#loadWasm',
        claim: 'certified == true',
        demonstrates: 'The room this page generated and CERTIFIED, mounted in the\nreal SWFRecomp-recompiled Seedling as a ONE-ROOM level set, with the\ncertification solve replayed into it — and TWO VERDICTS printed beside the JS\ncertification: the end state, and the whole run TICK BY TICK.',
        howToRun: 'Open it and let the loop run. Then press **▶ load in wasm**\nbeside the SOURCE selector — the frame below the canvas fills with the real\ngame — and then press **▶ Start** INSIDE that frame.\n\n⛔ The page CANNOT press ▶ Start for you and does not try: the WebGPU renderer\nand the AudioContext consume the user activation, and a parent-side click\nlatches the button without ever supplying one. That is also why there is no\n`?`-parameter that ships automatically — a URL that did would have to press it.',
        whatIsHappening: 'The ship is a stage machine and every stage is a named\nstate the page prints: `probe` (the build is served) → `runtime` → `start`\n(yours) → `levels` (the set is delivered in chunks and then READ BACK out of\nthe artifact and diffed against what was sent) → `tape` → `running` →\n`finished` → `drain` → `verdict`. A refusal at any stage is a NAMED reason,\nnever a stopped readout.\n\n`drain` reads `botDrain` ONCE — it is a BUFFERED stream, not a sample, so both\nsides are complete and the per-tick diff involves no wall-clock join.\n\nThe generated record is level 900 and the exporter assigns dense room ids, so\nthe expectation\'s level is remapped 900→0 — across the WHOLE stream, not only\nthe last frame — and the readout says so.',
        notes: Object.freeze([
            '⛔ **TWO VERDICTS, EACH WITH ITS OWN SCOPE.** The END-STATE one compares\nONE frame and says so; the PER-TICK one diffs the game\'s whole drained\nobservation stream against the JS model\'s for the same tape, through the same\ncomparator the node differential uses. The end-state check runs FIRST, and a\nper-tick `agrees` beside an end state that disagrees about that same frame\nprints `verdict-internally-inconsistent` rather than agreement.',
            '⚠ **The per-tick verdict names TWO limits.** It is against the JS MODEL of\nthis same tape, not against a recorded expectation — that instrument is still\n`verify-seedling-bot-differential.mjs`. And both sides share this repo\'s tape\nand observation code, so a defect in what they SHARE is invisible to it.',
            '⚠ The tolerance is **0 px**, and it is a measurement rather than a round\nfigure: five committed tapes through both sides on real-GPU Windows Chrome gave\nmax |Δx| = max |Δy| = 0, floats included. A number chosen above what was\nmeasured would be a bound nothing can reach.',
            'The button is also up in **SOLVE** (it ships the solve\'s own tape) and in\n**MANUAL** (a ZERO-INPUT tape, after which the keyboard drives the real game).\nIt is hidden in REPLAY, where the ENGINE selector already does it.',
        ]),
        terms: Object.freeze([
            'seedling',
            'tape',
            'certification',
            'solver',
            'readout',
            'browser-row',
            'github-pages',
        ]),
        prose: false,
    }),
    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ PROCGEN ELEMENTS ARC 5 — SIX ENTRIES, ONE PER SLICE'S SUBJECT
     * ══════════════════════════════════════════════════════════════════
     *
     * ⚖ §7 gate 9 asks for the demo catalogue to be extended with every slice's
     * subjects, and slices 1, 3, 4, 5 and 6a each closed with the same residue
     * line — *"no demo-catalogue row names this"* — because the close owns the
     * docs pass. These are those rows, and each one's claim is a VALUE off the
     * page's own readout, never an echo of the parameter that produced it.
     */
    Object.freeze({
        id: 'room-contract',
        n: 15,
        title: 'THE ROOM CONTRACT — a 12x10 MULTI-SCREEN room, written SPARSELY',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=28&biome=pre-sword&skeleton=winding%3Bchambers%3D1&width=12&fill=shell&count=1&tries=8&k=3&anchortries=1&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=28 --biome=pre-sword --skeleton=\'winding;chambers=1\' --width=12 --height=10 --fill=shell --count=1',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'room.tiles == 79',
        demonstrates: 'Arc 5 slice 1: the room stopped being one small box.\nWidth and height are separate knobs up to the VANILLA MAXIMUM 60x60 (`empty`\nlevel 40 is 60x58), and `fill=shell` writes the floor plus the wall that touches\nit and NOTHING beyond — vanilla\'s own sparse form. This room is 12 tiles wide,\nwhich is WIDER THAN ONE SCREEN, and 79 of its 120 cells carry a tile.',
        howToRun: 'Open it and let the one-step ladder finish, then scroll the\ncanvas: the camera band is the real game\'s, not a page trick. The identity line\nnames the room and the fill, because neither is the pinned default.',
        whatIsHappening: '⛔ **NULL IS NOT WALL.** An absent cell has no collision\nin either runtime — `levelWorld` builds solids only from the entries a record\nHAS, and so does the recompiled game — so every confinement claim needs REAL\nwall tiles. Hence the CLOSURE LAW: no floor cell may be 4-adjacent to an absent\ncell, asked over the whole record and refused by name. The room is generated\nDENSE and STRIPPED at the end of the pass, so every legality rule still reads a\ndense room.',
        notes: Object.freeze([
            '⚠ The strip buys **0%** on an OPEN room with no element (every wall of the\nborder ring touches floor) and 15–18% of the record on a carved one — measured,\nnot asserted. Since arc 5 slice 6a the biome default draws an element whose\nGROWN wall the strip can drop, so even the open room strips 12% at the default.',
            '⚠ The DEFAULT room is still the pinned 10x10 dense one, and a default is a\nPIN: every committed artifact was recorded at it. ⛔ **A named `width=10` is a\nDIFFERENT URL for the SAME ROOM** — URL identity and record identity are not the\nsame question, and a size is the parameter where they come apart: it is a\nCONSTANT INPUT that spends no draw either way, so `?width=10` and no parameter\nat all build the same record cell for cell (`urlParams.js` §*absent is the\ndefault*; the pair is driven in `watchGenerate.test.js`). ⚠ An ELEMENT parameter\nis the opposite: naming one spends NO draw and omitting it spends one, so\n`guard` and `guard;len=3` really are two streams. ⛓ Which is why the page\'s ONE\nwriter deletes the size IN PLACE at the default: the `#genWidth`/`#genHeight`\ncontrols (R9 slice 0) sitting at 10x10 write nothing, and this catalogue link\n— `width=12` with NO `height=` — still loads back byte-identical.',
        ]),
        terms: Object.freeze([
            'room-size',
            'room-fill',
            'level',
            'graded-refusal',
            'skeleton',
            'pass-2',
            'byte-inert',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'oriented-site',
        n: 16,
        title: 'THE ORIENTED SITE PICK — a len-4 guard, in a room that had no square for it',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=3&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=guard%3Blen%3D4',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=3 --biome=pre-sword --elements=\'guard;len=4\' --count=1',
        phase: 'pre-carve',
        facts: Object.freeze([]),
        layer: null,
        claim: 'elements.certified == true',
        demonstrates: 'Arc 5 slice 2: an element declares its own SNUG\nFOOTPRINT per orientation — the straight guard is `len+2` by 4, both ways round\n— and the site search offers ORIENTED RECTANGLES instead of the square that\nbounds them. A `len=4` gadget used to burn a 6x6 square to occupy 6x4, and on a\n10x10 room there was rarely one to burn.',
        howToRun: 'Open it and step to `pre-carve`: the SITE candidates and the\nsite taken are the overlay. Compare `?elements=guard;len=2` — the same room, the\nsmall gadget, the site the old square pick could also have found.',
        whatIsHappening: 'The census is the evidence: at 10x10 the guard placed\n**21 of 360** cells before this change and **62 of 360** after, and\n`no-site-fits-this-room` went **130 → 0**. ⛔ The footprint is DECLARED by the\nelement and asserted against what it actually writes — a lying footprint would\nbe invisible to a gate that read only the site.',
        notes: Object.freeze([
            '⚠ `len` 5 and 6 place NOTHING at the pinned 10x10, which is why the biome\ndefault\'s drawn `len` spends about 40% of its draws on a graded drop. A per-spec\nparameter DOMAIN is the mechanism that would fix it and nobody has ruled it.',
        ]),
        terms: Object.freeze([
            'guard',
            'pre-carve-element',
            'site',
            'element',
            'census',
            'graded-refusal',
            'certification',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'chamber-area',
        n: 17,
        title: 'AN ELEMENT THAT IS SPACE — `chamber` gives the area graph somewhere to put a key',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=pre-sword&skeleton=branchy%3Bchambers%3D1&count=0&tries=8&k=3&anchortries=1&elements=chamber%3Bw%3D2%3Bh%3D3&areas=1',
        also: 'source=generate&seed=1&biome=pre-sword&skeleton=branchy%3Bchambers%3D1&count=0&tries=8&k=3&anchortries=1&elements=none&areas=1',
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=pre-sword --skeleton=\'branchy;chambers=1\' --elements=\'chamber;w=2;h=3\' --areas=1 --count=1',
        phase: 'composite',
        facts: Object.freeze([]),
        layer: null,
        claim: 'areas.certified == true',
        demonstrates: 'Arc 5 slice 3: an element whose whole product is FLOOR.\n`chamber` is a `pre-carve` element that opens a blob and DECLARES it an area\nthrough the guard\'s own `declaredAreas` line — no second partition mechanism —\nand the area graph then has somewhere to put a key that is not the entrance or\nthe goal.',
        howToRun: 'Open the URL: `?areas=1` CERTIFIES on this bare tree kind.\nThen open the SECOND link (the same seed, the same room, `?elements=none`): the\ngraph REFUSES, `no-area-at-that-key-level-can-hold-its-key`. That pair is the\nwhole argument.',
        whatIsHappening: 'Arc 3 measured `--areas=1` accepting on **0 of 12**\nseeds for a bare tree kind, and named the cause: a 10x10 room offers 2–4 areas\nand the entrance and the goal take two. ⚖ Ruling 24 says area is pass 1\'s job —\nso the answer was an ELEMENT that builds one, not a widened bound.',
        notes: Object.freeze([
            '⚠ `keys=2` is UNMOVED at 0 of 264: one chamber is ONE area. Two\narea-bearing elements would need a `+` list to be a CONJUNCTION rather than a\nCHOICE, and the one-block-per-level law is what makes it a choice. That codec\nquestion is the shortest route to the K1 chain\'s first witness and nobody has\nasked it.',
            '⛓ C11\'s law ships with this element: a DROPPED area-bearing element re-runs\nthe partition without it and the graph re-adjudicates, and a refusal there is the\nlevel\'s honest grade.',
        ]),
        terms: Object.freeze([
            'chamber-element',
            'area',
            'area-partition',
            'area-graph',
            'pre-carve-element',
            'key-level',
            'graded-refusal',
            'certification',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'arena',
        n: 18,
        title: 'THE ARENA — a fight that needs SPACE, with TWO bodies in it',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=6&biome=post-sword&skeleton=bushy%3Bchambers%3D1&width=15&height=15&count=0&tries=8&k=3&anchortries=1&elements=arena%3Bw%3D5%3Bh%3D5%3Bbodies%3D2',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=6 --biome=post-sword --skeleton=\'bushy;chambers=1\' --width=15 --height=15 --elements=\'arena;w=5;h=5;bodies=2\' --count=1',
        phase: 'composite',
        facts: Object.freeze([]),
        layer: null,
        claim: 'elements.certified == true',
        demonstrates: 'Arc 5 slice 4: the `chamber` weaponised. The arena\nIMPORTS `openChamber`\'s blob, puts measured enemy classes in it and hangs a KILL\nLOCK on the room\'s own main-path cut — plus `bodies`, the first COUNT parameter\neither door element ever got.',
        howToRun: 'Open it and step to `composite`. The blob is the fight space,\nthe spinners are inside it, and the lock is NOT on the mouth — sealing the mouth\nwould seal the bodies away and the level would be unsolvable.',
        whatIsHappening: '⛔ **THE LOCK IS LOAD-BEARING AND IT WAS MEASURED.**\nWith the lock, only `spinner` solves the room; without one, 20 of 23 enemy\nclasses solve it at the EMPTY room\'s tick count — the fight was decoration. And\na live spinner refuses the collect ceremony (*"level 900 holds live spinners AND\na DIALOGUED ceremony"*), which is the same class arc 3 found and named A10.',
        notes: Object.freeze([
            '⚠ `bodies` has domain **{1, 2}** and the bound was PRICED BEFORE it was\noffered: 1 → 462 ticks / 600 ms, 2 → 602 / 1060, and **3 REFUSED**.',
            '⚠ The arena is in NO biome default and its ceiling is named: 49–70% of its\nrefusals are `no-cut-for-the-kill-lock`, because a `pre-carve` element\'s lock\ncannot GROW a wall the way the kill gate\'s does. That growth is a binding\naddition and it is named rather than done.',
        ]),
        terms: Object.freeze([
            'arena-element',
            'bodies',
            'chamber-element',
            'kill-gate',
            'lock',
            'cut',
            'demand',
            'certification',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'maze-shortcut',
        n: 19,
        title: 'SHORTENS — the maze shortcut, and the two routes it compares',
        page: '/frontend/modules/mazeRoom/lab.html',
        url: 'source=generate&seed=8&biome=maze-v1&width=11&height=11&count=4&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1%3Bshortcut%3D1&expansions=20000&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-maze-level.mjs --seed=8 --width=11 --height=11 --skeleton=rooms --areas=\'1;shortcut=1\' --count=4',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'shortcut.lengths.open == 27',
        demonstrates: 'Arc 5 slice 5: the differential\'s fifth grade, computed\nat last. SHORTENS is *solves BOTH ways, fewer steps WITH the item* — and until\nthis slice nothing in either pipeline could produce one, which made it a grade\nnothing could reach. `areas=1;shortcut=1` adds an item-locked edge on a CYCLE\ncell: with `key_SC` the route is 27 cells, without it 29.',
        howToRun: 'Open it and look for the extra door and the key that opens it.\nThe key is placed where the player can reach it WITHOUT using the shortcut —\nthat is what makes both arms solvable, and it is what separates SHORTENS from\nSTRONG.',
        whatIsHappening: 'The SHORTCUT LAW is the door law\'s clause 1 INVERTED\nand it lives beside it, spelled ONCE for both substrates: the door law wants a\nwall that CUTS, the shortcut law wants an edge that does not. ⛔ A symbol on the\nsolution path can never grade SHORTENS — removing its key seals the goal and it\ngrades STRONG — so the only symbol whose differential can SEE a shortcut is one\nwhose ONLY doors are the shortcut\'s.',
        notes: Object.freeze([
            '⛔ **REACHED ON THE MAZE, REFUTED ON SEEDLING**, on three measurements: the\nrock is invisible to the solver on 244 of 244 probes, the combat ladder is\nEXHAUSTED in a corridor, and the ladder prefers AVOID over KILL so the shortcut\nthrows at tick 215. The Seedling module ships COMPLETE and unit-tested and is\nNOT a catalogue head — it would abort a real run.',
            '⚠ The NEGATIVE rows are real levels rather than mutants: seed 9 grades STRONG\n(the terrain law accepts a cell the OBSTACLE graph cuts) and seed 1 is INERT at\n20 steps either way — the key walk and the K-doors swallow the saving.',
        ]),
        terms: Object.freeze([
            'shortens',
            'shortcut-law',
            'requirements-differential',
            'grade',
            'door-law',
            'cut',
            'area-graph',
            'maze-lab',
            'bfs-oracle',
        ]),
        prose: false,
    }),
    Object.freeze({
        id: 'density-block',
        n: 20,
        title: 'THE DENSITY BLOCK — six levers on one line, and the default that draws its own room',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=2&biome=post-sword&count=6&tries=8&k=3&anchortries=1&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=2 --biome=post-sword --count=6 --density',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'identity matches density: kind=empty . chambers=n/a . size=10x10 . fill=dense . element=chamber;w=2;h=3 . target=6',
        demonstrates: 'Arc 5 slice 6: **DENSITY IS ONE DECLARED BLOCK** — kind,\n`chambers`, size, fill, the element spec AS RESOLVED, and `obstacleTarget` — in\none line, spelled by ONE function (`procgenCore/densityBlock.js`) for both lab\npages and both CLIs. And this level is arc 5 slice 6a\'s own subject: the biome\ndefault is `guard+killgate+blockpocket+chamber;w=2;h=3`, the guard DRAWS its\n`len` instead of being pinned at 2, and on this seed the list\'s one `pick`\nlanded on the chamber.',
        howToRun: 'Read the identity line above the canvas. Then run the CLI\nbeside it with `--density` and compare: the same six values, character for\ncharacter. The browser row asserts exactly that, page against a child process.',
        whatIsHappening: '⛔ **THE BLOCK READS; IT DOES NOT COMPUTE.** The size is\nthe RECORD\'s, the fill is the DECLARED word (never a guess from the written-cell\ncount — a `fill=shell` open room can write every cell), and the element is the\nhead the `+` list RESOLVED to, not the list that was asked for. ⛔ And it adds NO\npayload field: the arc\'s one re-record was spent on the default itself, so the\nblock is spelled at PRINT time out of fields the record already carries.',
        notes: Object.freeze([
            '⛓ ALL SIX FIELDS PRINT ON EVERY LEVEL, which breaks the identity line\'s own\nrule that a clause is named only when it is not the default. Deliberate: a DIAL\nis read by seeing every position at once.',
            '⛓ The BLOCK is the settings; the TABLE is what they buy.\n`census-seedling-density.mjs` sweeps kinds x sizes x fills x element arms and\nmeasures it: size is the lever that matters (26.7 → 174.8 ground cells from\n10x10 to 20x20, and the ladder reaches 5.6 of 6 obstacles instead of 3.8), while\n`fill=shell` buys 15–18% of the record\'s cells and changes NOTHING else.',
            '⛔ `--density` on either CLI is OPT-IN and byte-inert when omitted, because\nthe reports\' md5s are fifteen of this arc\'s published byte-inertia identities.',
        ]),
        terms: Object.freeze([
            'density-block',
            'obstacle-target',
            'room-size',
            'room-fill',
            'chambers',
            'element-head',
            'chamber-element',
            'guard',
            'census',
            'readout',
            'byte-inert',
        ]),
        prose: false,
    }),
    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ SEEDLING BOT R9, SLICE 0 — THE FORM CONTROLS
     * ══════════════════════════════════════════════════════════════════ */
    Object.freeze({
        id: 'form-controls',
        n: 21,
        title: 'THE FORM CONTROLS — six URL-only parameters, and the state a select cannot hold',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=3&biome=post-sword&count=1&tries=8&k=3&anchortries=1&run=1',
        also: null,
        cli: 'node scripts/procgen/check-seedling-editor-generate.mjs',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        control: '#genElements',
        claim: 'elementsAsked == null',
        demonstrates: 'R9 slice 0: `?width=` `?height=` `?fill=` `?areas=`\n`?require=` and `?elements=` stopped being address-bar-only and got page\ncontrols. ⛔ The claim is about the LOAD: on a URL with NO `?elements=` the page\nmust still ask for NOTHING — `elementsAsked` is `null` — so that the seam\napplies the BIOME DEFAULT, and a control that MOUNTED at `none` would read\n`{"name":"none"}` here. ⚠ MEASURED, and it bounds what this row can say: a\nmutant that writes `none` only at the PRESS leaves this row GREEN, because this\ncatalogue never presses a ladder button. The press half is\n`check-seedling-editor-generate.mjs` CLAIM 5R.',
        howToRun: 'Open it and look at the `element` select: it reads\n`(biome default)` and its params box is empty. The readout beside the canvas\nnames what the RUN resolved\n(`guard;len=2|3|4+killgate+blockpocket+chamber;w=2;h=3` on post-sword) — two different fields, because *what was asked* and *what ran* are\ntwo different facts. Now pick `none` and press RUN-ALL: the bar gains\n`?elements=none`, the ladder RESETS to the skeleton and says which control did\nit, and the room is a different one.',
        whatIsHappening: '⛔ **THE ELEMENT CONTROL HAS THREE STATES, NOT TWO.**\n`(biome default)` is `undefined` — *nobody said* — `none` is a CHOICE the seam\nhonours, and a head name is an override carrying its own params sub-form. The\nmaze lab\'s control has only two, because the maze\'s own default IS `none`.\n\n⛔ **NO PARAMETER WAS ADDED.** The reader and the ONE writer have owned all six\nsince arc-3 slice 5a and arc-5 slice 1; this slice is controls only, and the\nwriter did not change — which is why every link in this catalogue still loads\nback byte-identical.',
        notes: Object.freeze([
            '⛓ Every option comes from the CODEC\'s own domain — `FILL_MODES`,\n`KEYS_DOMAIN`, `AREA_PARAM_SCHEMA`, `ELEMENT_NAMES`, `paramSchemaFor`, and\n`assertRoomSize`\'s [3..60] on the two number inputs. A hand-typed list here\nwould be a second vocabulary and a reader would meet whichever one drifted.',
            '⚠ A `+` LIST has no `select` spelling and is not given one: the control\nshows the list the URL handed it, READ-ONLY and named verbatim, and a press that\nleaves it alone KEEPS it.',
            '⚠ An element parameter left at `any (draw it)` is DRAWN and a named one is\nan OVERRIDE that spends NO draw — the two are different runs even when the value\ncomes out the same. The size controls are the opposite: a size spends no draw\neither way, so `?width=10` and no parameter at all build the same room.',
            '⛓ The controls are read at the PRESS and never cached, and a changed one\nRESETS the ladder to step 0 — the room, the graph, the directive and the element\nare all fixed before pass 2 runs, so step 3 under one spelling followed by step 4\nunder another is a display no single run ever produced.',
        ]),
        terms: Object.freeze([
            'url-parameter',
            'element-head',
            'element',
            'biome',
            'draw',
            'room-size',
            'room-fill',
            'area-graph',
            'require-directive',
            'generation-ladder',
            'readout',
            'byte-inert',
        ]),
        prose: false,
    }),
]);

export default DEMOS;
