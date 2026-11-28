/**
 * Tracking: the Region Map (⚖ the user, 2026-11-16 "Region Map tutorial: yes, after clicks work"; 2026-11-22 the
 * world: "Seedling playthrough"). It loads **seedling_playthrough** seed 1, the whole of the original Seedling as a
 * world, because that is the world the Map is for: every level drawn from the game's own map. It loads the rules
 * only and starts NO Flash game, so "Teleport there in Flash" is mentioned, never ticked.
 *
 * A step reaches the Map's cells through its "Go to" picker (`regionMap/regionMapPicker.js`): the canvas cannot be
 * clicked by a step, and the picker does exactly what a click does. Every option the tutorial changes it puts back in
 * its last step. Ready (⚖ the user, 2026-11-23, "Mark READY"): its walk row must complete every step. Shape:
 * ../../tutorialShape.js.
 *
 * ⛔ Imports only content (the guide generator imports it in node).
 */
import { REGIONS, isChecked } from '../steps/tracker.js';
import { PLAYTHROUGH, loadPlaythrough } from '../seedling/seedling.js';

const MAP = { panel: 'regionMapPanel' };
const GRAPH = { panel: 'regionGraphPanel' };
const map = (selector) => ({ ...MAP, selector });

const info = map('.region-map-info');
const canvas = map('canvas.region-map-canvas');
const follow = map('.region-map-follow input[type="checkbox"]');
const strip = map('.region-map-click-strip-host .click-actions-strip');
const stripSummary = map('.region-map-click-strip-host .click-actions-strip-summary');
const actionBox = (id) => map(`.region-map-click-strip-host input[type="checkbox"][data-action-id="${id}"]`);
const pick = map('details.region-map-pick');
const pickStatus = map('.region-map-pick-status');
const zoomIn = map('button.region-map-zoom-in');
const zoomOut = map('button.region-map-zoom-out');

/** The strip's collapsed summary with the default click actions (CA-S5 §7). */
export const DEFAULT_SUMMARY = 'On click: extend path · Regions — location: check';
const CENTRE_GRAPH = 'regionGraph.centre';
const TELEPORT = 'flash.teleport';
/** A level next to the start level, reachable at the start: the region click extends the path to it. */
const PATH_REGION = 'level_2';
/** A chest reachable at the start, on its own level's tile. */
const CHECK_LOCATION = 'Level 011 - Chest';
/** The region the Graph is centred on. */
const CENTRE_REGION = 'level_4';
/** What the walk clicks, for its walk ROW (which hears the click events; a step cannot). */
export const REGION_MAP_WALK = Object.freeze({ pathRegion: PATH_REGION, location: CHECK_LOCATION, centreRegion: CENTRE_REGION });

/** The regions of the Regions panel's blocks, in order (it shows the path when "Show All Regions" is off). */
const regionsShown = (ctx) => [...(ctx.query(REGIONS)?.querySelectorAll('.region-block[data-region]') ?? [])].map((b) => b.dataset.region);

export const TRACKER_REGION_MAP = Object.freeze({
    id: 'tracker-region-map',
    title: 'Tracking: the Region Map',
    summary: 'See a Seedling world as its real map: levels in groups, locations as squares on their tiles, and clicks that move and check.',
    track: 'tracker',
    status: 'ready', // ⚖ the user, 2026-11-23 ("Mark READY", after the art-ends shots)
    doc: 'docs/json/user/tutorials/tracker-region-map.md',
    intro: [
        { prose: 'The **Region Map** draws a world as a map: one cell per level, laid out the way you walk between them, with each location as a square on its own tile. It is the map beside the **Region Graph**: the same reachability colours, the same clicks.' },
        { prose: `It uses *${PLAYTHROUGH.title}*, the whole of the original *Seedling* as an Archipelago world, because its levels carry the game's own map. Only the world's rules are loaded; no game is started.` },
    ],
    sections: [
        {
            id: 'load',
            title: 'Load the world',
            blocks: loadPlaythrough('load'),
        },
        {
            id: 'map',
            title: 'The map',
            blocks: [
                {
                    step: {
                        id: 'open-map',
                        text: 'Open the **Region Map** tab (Quick Launch lists it, under *Analysis Panels*). Each cell is a level, drawn from the game\'s own map; the line under the controls says the layout came from the world (`layout: hook`), not a generic grid.',
                        actions: [{ activate: MAP }],
                        done: (ctx) => ctx.isPanelShowing(MAP) && ctx.exists(canvas) && ctx.text(info).includes('layout: hook'),
                        doneTimeoutMs: 30000,
                    },
                },
                {
                    step: {
                        id: 'squares',
                        text: 'The squares are the locations, each on its own tile of its level: **green** you can reach now, **red** not yet, **grey** checked. A diamond is an event. Hover one for its name; every location has a square, so nothing is listed as *Not on map*.',
                        done: (ctx) => Number(ctx.query(canvas)?.dataset.squares ?? 0) > 0
                            && ctx.query(map('.region-map-not-on-map'))?.style.display === 'none',
                    },
                },
                {
                    step: {
                        id: 'fit-all',
                        text: 'Drag to pan. To zoom, scroll the mouse wheel, press **+** and **−** beside **Fit all**, or, on a phone or a touch screen, pinch with two fingers. Press **Fit all** for the whole map. Moving the view yourself turns **Follow player** off.',
                        actions: [{ click: map('button.region-map-fit-all') }],
                        done: (ctx) => ctx.query(follow)?.checked === false,
                    },
                },
                {
                    step: {
                        id: 'zoom-buttons',
                        text: 'Press **+** to zoom in on the middle of the view, then **−** to zoom back out. Each press is a few notches of the wheel.',
                        actions: [{ click: zoomIn }, { click: zoomOut }],
                        // The panel stamps the press (`canvas.dataset.zoomedAt`) and paints its zoom (`dataset.zoom`).
                        done: (ctx) => ctx.sinceStep(ctx.query(canvas)?.dataset.zoomedAt) && Number(ctx.query(canvas)?.dataset.zoom) > 0,
                    },
                },
                {
                    step: {
                        id: 'groups',
                        text: 'Levels you walk between, off one edge and into the next, sit side by side as a **group**, and a short **yellow** line in the gap between two squares joins neighbours you walk between (the *edge transition* in the legend; it has no arrowhead, since you can walk both ways). Arrows join the groups: blue goes **down**, orange goes **up**. A line starts and ends at the door it uses, ringed (the arrowhead marks the door it points to), or at the edge of the level\'s picture when the map has no door for it. A **warp** (a door or a teleporter) is a dashed green arrow, never a neighbour. The legend in the controls names them, and **Links** turns them all off.',
                        done: (ctx) => ctx.query(map('.region-map-show-links input[type="checkbox"]'))?.checked === true
                            && ctx.exists(map('.region-map-link-legend-join')) && ctx.exists(map('.region-map-link-legend-warp'))
                            && /\b\d+ group\(s\)/.test(ctx.text(info)),
                    },
                },
                {
                    step: {
                        id: 'follow',
                        text: 'Tick **Follow player** again: the view eases back onto the level the player is in (outlined white), and follows it as the player moves.',
                        actions: [{ click: { ...follow, selector: `${follow.selector}:not(:checked)`, optional: true } }],
                        done: (ctx) => ctx.query(follow)?.checked === true,
                    },
                },
            ],
        },
        {
            id: 'clicks',
            title: 'Clicking the map',
            blocks: [
                {
                    step: {
                        id: 'click-strip',
                        text: `The **On click** strip at the top says what a click does. Here: *${DEFAULT_SUMMARY.replace(/^On click: /, '')}*. Clicking a level extends the path to it and shows it in the Regions panel; clicking a location's square checks it.`,
                        done: (ctx) => ctx.text(stripSummary) === DEFAULT_SUMMARY,
                    },
                },
                {
                    step: {
                        id: 'open-click-strip',
                        text: 'Unfold it with **▸**. It lists every action for a level and for a location, and the panel actions too: **Centre the Region Graph on it**, and **Teleport there in Flash**, which moves the player in a running Seedling game. Both start off. This tutorial starts no game, so it leaves Teleport off. The Map\'s settings began as a copy of the Region Graph\'s; they are its own now, and changing one panel\'s does not change the other\'s. **⏸** turns every click action off.',
                        actions: [{ click: map('.region-map-click-strip-host .click-actions-strip[data-expanded="false"] .click-actions-strip-toggle') }],
                        done: (ctx) => ctx.query(strip)?.dataset.expanded === 'true'
                            && ctx.query(actionBox(CENTRE_GRAPH))?.checked === false && ctx.query(actionBox(TELEPORT))?.checked === false,
                    },
                },
                {
                    step: {
                        id: 'open-go-to',
                        text: 'Unfold **Go to** in the controls: it picks a level or a location by name and does exactly what clicking it on the map does. It is handy when a cell is small.',
                        actions: [{ click: map('details.region-map-pick:not([open]) > summary') }],
                        done: (ctx) => ctx.query(pick)?.open === true,
                    },
                },
                {
                    step: {
                        id: 'click-region',
                        text: `Choose the level **${PATH_REGION}**, as a click on it would: the path is extended to it, and the **Regions** panel opens showing the path, ending there.`,
                        actions: [{ fill: { ...map('input.region-map-pick-region'), value: PATH_REGION } }],
                        done: (ctx) => ctx.text(pickStatus) === `Went to region ${PATH_REGION}.` && regionsShown(ctx).at(-1) === PATH_REGION,
                    },
                },
                {
                    step: {
                        id: 'click-location',
                        text: `Back on the **Region Map**, choose the location **${CHECK_LOCATION}**: it is checked, as a click on its square would, and the square turns grey.`,
                        actions: [{ fill: { ...map('input.region-map-pick-location'), value: CHECK_LOCATION } }],
                        done: (ctx) => isChecked(ctx, CHECK_LOCATION),
                    },
                },
                {
                    step: {
                        id: 'tick-centre-graph',
                        text: 'In the **On click** strip, tick **Centre the Region Graph on it**.',
                        actions: [{ click: { ...actionBox(CENTRE_GRAPH), selector: `${actionBox(CENTRE_GRAPH).selector}:not(:checked)`, optional: true } }],
                        done: (ctx) => ctx.query(actionBox(CENTRE_GRAPH))?.checked === true,
                    },
                },
                {
                    step: {
                        id: 'centre-graph',
                        text: `Choose the level **${CENTRE_REGION}**, then open the **Region Graph** tab: it is centred on that region. (A Graph that shares the Map's column centres when you bring its tab forward.)`,
                        actions: [
                            { activate: GRAPH },
                            { fill: { ...map('input.region-map-pick-region'), value: CENTRE_REGION } },
                            { activate: GRAPH },
                        ],
                        done: (ctx) => {
                            const root = ctx.query({ ...GRAPH, selector: '.region-graph-panel-container' });
                            // The readout is written when the camera moves: a Graph whose tab was hidden centres when shown.
                            return ctx.isPanelShowing(GRAPH) && ctx.sinceStep(root?.dataset.centredAt) && root.dataset.centredOn === CENTRE_REGION;
                        },
                    },
                },
                {
                    step: {
                        id: 'put-back',
                        text: 'Put the Map back as it was: untick **Centre the Region Graph on it**, fold the strip and **Go to**, and tick **Follow player** (choosing a level moved the view, which turned it off).',
                        actions: [
                            { click: { ...actionBox(CENTRE_GRAPH), selector: `${actionBox(CENTRE_GRAPH).selector}:checked`, optional: true } },
                            { click: { ...map('.region-map-click-strip-host .click-actions-strip[data-expanded="true"] .click-actions-strip-toggle'), optional: true } },
                            { click: { ...map('details.region-map-pick[open] > summary'), optional: true } },
                            { click: { ...follow, selector: `${follow.selector}:not(:checked)`, optional: true } },
                        ],
                        done: (ctx) => ctx.query(actionBox(CENTRE_GRAPH))?.checked === false
                            && ctx.query(strip)?.dataset.expanded === 'false' && ctx.text(stripSummary) === DEFAULT_SUMMARY
                            && ctx.query(pick)?.open === false && ctx.query(follow)?.checked === true,
                    },
                },
            ],
        },
    ],
    outro: null,
});
