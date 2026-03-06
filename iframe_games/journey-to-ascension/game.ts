import { handleHotkeyPressed, handleHotkeyReleased, Rendering, updateRendering } from "./rendering.js";
import { Gamestate, saveGame, updateGamestate, resetTasks, calcTickRate, clickTask, clickItem, doPrestige, doEnergyReset } from "./simulation.js";
import { ZONES, TASK_LOOKUP } from "./zones.js";
import { ITEMS, ARTIFACTS } from "./items.js";

function gameLoop() {
    updateGamestate();
    updateRendering();
}

export function setTickRate() {
    if (GAME_LOOP_INTERVAL > 0) {
        clearInterval(GAME_LOOP_INTERVAL);
    }

    GAME_LOOP_INTERVAL = setInterval(gameLoop, calcTickRate());
}

export let GAMESTATE = new Gamestate();
export let RENDERING = new Rendering();
let GAME_LOOP_INTERVAL = 0;

function initGame() {
    GAMESTATE.start();
    RENDERING.initialize();
    RENDERING.start();

    setTickRate();
}

// Support both static module loading (DOMContentLoaded hasn't fired yet)
// and dynamic import() where DOM is already ready
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initGame);
} else {
    initGame();
}

document.addEventListener("keyup", handleHotkeyReleased);
document.addEventListener("keydown", handleHotkeyPressed);

export function resetSave() {
    GAMESTATE = new Gamestate();
    GAMESTATE.initialize();
    saveGame();
    location.reload();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).getGamestate = GAMESTATE;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).resetSave = resetSave;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).resetZone = () => {
    resetTasks();
    RENDERING = new Rendering();
    RENDERING.initialize();
    RENDERING.start();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ZONES = ZONES;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).TASK_LOOKUP = TASK_LOOKUP;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).resetTasks = resetTasks;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).clickTask = clickTask;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).clickItem = clickItem;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).doPrestige = doPrestige;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).doEnergyReset = doEnergyReset;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).saveGame = saveGame;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ITEMS = ITEMS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ARTIFACTS = ARTIFACTS;
