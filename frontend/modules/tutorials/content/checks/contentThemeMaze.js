/**
 * Feature check: what the `meta` theme's trial world looks like in the maze (content sets FC-1; ⚖ the user,
 * 2026-11-15: "Can we set up a Feature Check in the Tutorials panel to load the scenario for me to see what this
 * maze example currently looks like?").
 *
 * Two worlds, the same five views each: the themed `meta_trial` (its slot records `content: ['meta']`) and the plain
 * control `concept_trial` (no content set; otherwise the same world). For each: load it, take the first room's
 * location and its exit in the Text Adventure panel (the way a person plays into the maze), the Maze Room's
 * single-region view with fog off, then the composite map on the APWorld Editor's Map tab.
 *
 * ⛔ The walk READS the page; it changes nothing in the world. The location it takes and the exit it walks are the
 * ones the Text Adventure panel offers (read off its links, never named here); the maze region it expects is the one
 * that exit's link names; the map's region count is the canvas's own.
 * ⛔ Imports only content files.
 */
import { MAZE } from '../steps/procgen.js';

const TA = Object.freeze({ panel: 'textAdventureSubstrateWrapperPanel', frame: 'iframe' });
const HUB = Object.freeze({ panel: 'apworldEditorPanel' });
/** The first room's location link (not a thing: a thing is read, not taken). */
const takeLink = { ...TA, selector: '.tae-link-item.tae-link-accessible:not([data-item-id^="thing:"])' };
const exitOpen = { ...TA, selector: '.tae-link-exit.tae-link-accessible' };
const mazeMessage = { ...MAZE, selector: '.maze-room-message' };
const mazeCanvas = { ...MAZE, selector: 'canvas.maze-room-canvas' };
/** The Maze Room's first view toggle is Fog of war (`_renderViewToggles`). */
const fogBox = { ...MAZE, selector: '.maze-room-view-toggles > label:first-child > input[type="checkbox"]' };
const mapCanvas = { ...HUB, selector: '.apworld-map-canvas' };

/** The region the open exit leads to, read off its link: `exit (to region_2_3)`. */
const exitTarget = (ctx) => /\(to ([^)]+)\)/.exec(ctx.text(exitOpen))?.[1] ?? null;
/** The APWorld Editor's panel object (the tests' `__panel`). */
const hubOf = (ctx) => ctx.query({ ...HUB, selector: '.apworld-editor-panel' })?.__panel ?? null;
/** The content set the editor's document records for its player (null: none). */
const contentOf = (doc, player) => doc?.procgen_metadata?.[player]?.content ?? null;

/** The five views of one world. `w`: { key, game, title, content, look, map }. */
function worldViews(w) {
    // The maze region the exit leads to, read when the exit opens (the next step's `done` waits for it), and the
    // Maze Room's canvas at that moment. ⛓ MEASURED: after the control loads, the Maze Room still shows the themed
    // world's region_2_3 (the same id, the same "Loaded region" line) until the exit is taken, so the line alone
    // would pass on the previous world's view; the enter step also asks for a canvas drawn since.
    let target = null;
    let canvasBefore = null;
    return [
        {
            step: {
                id: `${w.key}-load`,
                text: `Load **${w.title}**: open the page with \`?game=${w.game}&seed=1\`. **Do it** loads it for you. (In the **Presets** panel it is one of the unlabelled **1** buttons in the *Procgen Maze* row, so the link is the way to pick it by hand.)`,
                run: (ctx) => ctx.loadPreset(w.game, 1),
                done: async (ctx) => ctx.rulesLoadedSinceStep() && ctx.isPresetLoaded(w.game, 1),
                doneTimeoutMs: 30000,
            },
        },
        {
            step: {
                id: `${w.key}-take`,
                text: 'Open the **Text Adventure Substrate** tab: you stand in the world\'s first room, a text adventure room. Click its location (**[l1]**): it sends **Progressive Sword**, and the room\'s exit, which needs it, turns from red to green.',
                actions: [{ click: takeLink }],
                done: (ctx) => {
                    target = exitTarget(ctx);
                    canvasBefore = ctx.query(mazeCanvas);
                    return target !== null;
                },
            },
        },
        {
            step: {
                id: `${w.key}-enter`,
                text: 'Click the exit (**[s] exit (to …)**), then open the **Maze Room** tab. You are in the world\'s first maze region; the line beside **Reset Player** names it.',
                actions: [{ click: exitOpen }, { activate: MAZE }],
                done: (ctx) => ctx.isPanelShowing(MAZE) && ctx.exists(mazeCanvas) && ctx.query(mazeCanvas) !== canvasBefore
                    && (target ? ctx.text(mazeMessage) === `Loaded region: ${target}` : ctx.text(mazeMessage).startsWith('Loaded region: ')),
                doneTimeoutMs: 20000,
            },
        },
        {
            step: {
                id: `${w.key}-maze`,
                text: `Untick **Fog of war** (under the playback controls), so the whole region shows. ${w.look}`,
                actions: [{ click: { ...fogBox, selector: `${fogBox.selector}:checked`, optional: true } }],
                done: (ctx) => ctx.isPanelShowing(MAZE) && ctx.exists(mazeCanvas) && ctx.query(fogBox)?.checked === false,
            },
        },
        {
            step: {
                id: `${w.key}-map`,
                text: `Open the **APWorld Editor** tab and click its **Map** tab: the composite map draws every region of the world in its grid cell, the maze regions as their tiles. ${w.map}`,
                actions: [{ activate: HUB }, { click: { ...HUB, selector: 'button', text: 'Map' } }],
                done: (ctx) => {
                    const hub = hubOf(ctx);
                    const canvas = ctx.query(mapCanvas);
                    // ⛓ MEASURED: the editor stays on its Map tab from the themed world, so without "showing" this step
                    //   ticked itself while the Maze Room was still in front (Do it greyed, the map never seen).
                    return ctx.isPanelShowing(HUB) && Boolean(hub?.rulesDoc && canvas) && hub.activeTab === 'map'
                        && JSON.stringify(contentOf(hub.rulesDoc, String(hub.playerId ?? '1'))) === JSON.stringify(w.content)
                        && Number(canvas.dataset.regions) > 0;
                },
                doneTimeoutMs: 20000,
            },
        },
    ];
}

const NOT_ON_THE_MAP = 'The composite map draws 4 of the maze\'s 14 tile kinds today: floor, wall, an open exit and the entrance. It does not draw the other 10: mana, the player, trap, the three block kinds (block, struck, dormant), button up and button down, pulser and pull.';

export const CHECK_CONTENT_THEME_MAZE = Object.freeze({
    id: 'content-theme-maze-look',
    title: 'Content sets: the meta theme in the maze, beside the plain world',
    summary: 'Load the meta theme\'s trial world, walk into its maze, and look at it in the Maze Room and on the composite map (APWorld Editor ▸ Map); then the same two views of the plain control world, concept_trial.',
    status: 'ready',
    doc: null,
    intro: [
        { prose: 'A **content set** (a theme) changes how a world looks and reads, never its logic. `meta_trial` is the `meta` theme laid on a small generated world: a text adventure room, then two maze regions. `concept_trial` is the same world with no theme. This check shows each in the Maze Room and on the composite map, so the two can be compared. Press **Do it** one step at a time (not **▶ Play**): each step leaves its view on screen until you press **Do it** on the next one.' },
    ],
    sections: [
        {
            id: 'themed',
            title: 'The themed world: meta_trial',
            blocks: worldViews({
                key: 'meta',
                game: 'meta_trial',
                title: 'the meta theme\'s trial world',
                content: ['meta'],
                look: 'Every tile is drawn from the **meta** theme\'s art: the hatched walls, the pale floor, the exits and the entrance, and the player (the orange disc, at the entrance). The waves are the **Progressive Swim** pickup, drawn as the theme\'s swimmer. The speech bubble is the **Narrator**, a thing the theme put in the room: walk onto it to read its lines. The blue **~** square at the left edge is the **water gate**: it keeps the maze\'s own default look, because the theme does not present water. (The theme\'s **Gate** guards the sword exit you just took, in the text adventure room, so it is not in the maze.)',
                map: `Both maze cells are drawn with the theme's art: the hatched walls, the pale floor and the open exits, the swim pickup as the swimmer, and a Narrator's speech bubble in each. The water gate and the **Victory** pickup keep the default look (the theme gives them no art). ${NOT_ON_THE_MAP}`,
            }),
        },
        {
            id: 'control',
            title: 'The plain control: concept_trial',
            blocks: worldViews({
                key: 'control',
                game: 'concept_trial',
                title: 'the plain concept trial world (no theme)',
                content: null,
                look: 'The same region, drawn with the maze\'s default graphics: flat dark tiles, the player as a blue disc at the entrance, the swim pickup as a disc labelled with its item, the same water gate, and no Narrator (no theme, so no things).',
                map: `The same two maze cells in the default graphics: flat colour fills, the swim pickup as its labelled disc, no Narrator. ${NOT_ON_THE_MAP}`,
            }),
        },
    ],
    outro: null,
});
