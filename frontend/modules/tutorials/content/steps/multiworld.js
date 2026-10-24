/**
 * Shared step group: "generate a local multiworld with a .apworld and connect
 * to it" — ONE copy of the text for every tutorial that plays a world on a
 * LOCAL server (⚖ the user, 2026-10-10: multiworld steps use a local
 * MultiServer, which is how most testing was done).
 *
 * The terminal steps are OUTSIDE steps with NO stand-in (⚖ 2026-10-10): the
 * test cannot run a server, so a walk STOPS at the first of them, and that is
 * the tutorial's recorded `firstFailingStep` until a harness can start
 * MultiServer.py. The Client's connection is in the app, so the connect step
 * has a `done`.
 *
 * ⛔ Imports nothing from the app (the guide generator imports it in node).
 */

export const CLIENT = Object.freeze({ panel: 'clientPanel' });
export const LOCAL_SERVER = 'ws://localhost:38281';

/**
 * The blocks, from "the .apworld is downloaded" to "the Client is connected".
 *   idPrefix     keeps step ids unique within the tutorial
 *   gameName     the game the .apworld registers (the YAML's `game:`)
 *   apworldFile  the downloaded file's name
 *   install      optional { text, command } in place of "copy the .apworld"
 *   slot         the slot (player) name the YAML gives
 */
export function localMultiworld({ idPrefix = 'mw', gameName, apworldFile, slot = 'Tutorial', install = null }) {
    const id = (s) => `${idPrefix}-${s}`;
    const serverStatus = { ...CLIENT, selector: '#server-status' };
    return [
        { prose: 'The next steps happen in a terminal, in your Archipelago folder (a source checkout of Archipelago, or this project\'s repository). With the installed Archipelago Launcher, *Generate* and *Host* are the same two tools. The tutorial waits for you: press **Next** after each.' },
        {
            step: {
                id: id('install'),
                outside: true,
                // `install` replaces the default "copy the downloaded .apworld" (a game shipped another way).
                text: install?.text ?? `Copy the downloaded \`${apworldFile}\` into the \`custom_worlds/\` folder, so Archipelago can load the game "${gameName}".`,
                command: install?.command ?? `cp ~/Downloads/${apworldFile} custom_worlds/`,
            },
        },
        {
            step: {
                id: id('yaml'),
                outside: true,
                text: `Write a player file for one slot, **${slot}**, playing "${gameName}", in a folder of its own.`,
                command: `mkdir -p TutorialPlayers && printf 'name: ${slot}\\ngame: ${gameName}\\n${gameName}: {}\\n' > TutorialPlayers/${slot}.yaml`,
            },
        },
        {
            step: {
                id: id('generate'),
                outside: true,
                text: 'Generate the multiworld. It writes `output/AP_<seed>.zip`.',
                command: 'python Generate.py --player_files_path TutorialPlayers',
            },
        },
        {
            step: {
                id: id('serve'),
                outside: true,
                text: `Start a local server on that file. It listens on port 38281; leave it running.`,
                command: 'python MultiServer.py output/AP_<seed>.zip',
            },
        },
        {
            step: {
                id: id('connect'),
                text: `Open the **Console** tab, check the **Server Address** says \`${LOCAL_SERVER}\`, and press **Connect**. When it asks for your slot name, type **${slot}**. The status turns to *Connected*.`,
                actions: [
                    { fill: { ...CLIENT, selector: '#server-address', value: LOCAL_SERVER } },
                    { click: { ...CLIENT, selector: '.connect-button', text: 'Connect' } },
                ],
                done: (ctx) => ctx.text(serverStatus) === 'Connected',
                doneTimeoutMs: 30000,
            },
        },
    ];
}
