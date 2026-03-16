import { handleHotkeyPressed, handleHotkeyReleased, Rendering, updateRendering } from "./rendering.js";
import { Gamestate, saveGame, updateGamestate, resetTasks, calcTickRate, clickTask, clickItem, doPrestige, doEnergyReset, tryAddPerk } from "./simulation.js";
import { ZONES, TASK_LOOKUP } from "./zones.js";
import { ITEMS, ARTIFACTS } from "./items.js";
import { SKILL_DEFINITIONS } from "./skills.js";
import { PERKS } from "./perks.js";
import { PRESTIGE_UNLOCKABLES, PRESTIGE_REPEATABLES } from "./prestige_upgrades.js";
import { ItemSkillModifierList, PerkSkillModifierList } from "./modifiers.js";
import { patchRenderingConstants, readRenderingConstants } from "./rendering_constants.js";
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
}
else {
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
window.getGamestate = GAMESTATE;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.resetSave = resetSave;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.resetZone = () => {
    resetTasks();
    RENDERING = new Rendering();
    RENDERING.initialize();
    RENDERING.start();
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.ZONES = ZONES;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.TASK_LOOKUP = TASK_LOOKUP;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.resetTasks = resetTasks;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.updateGamestate = updateGamestate;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.doHeadlessReset = () => {
    // Clean energy reset for headless verification: resets zone, tasks,
    // and energy without side effects (no maxEnergy change, no saves,
    // no rendering). Skills and perks persist across resets.
    GAMESTATE.current_zone = 0;
    GAMESTATE.active_task = null;
    resetTasks();
    GAMESTATE.current_energy = GAMESTATE.max_energy;
    GAMESTATE.is_in_energy_reset = false;
    GAMESTATE.is_at_end_of_content = false;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.clickTask = clickTask;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.clickItem = clickItem;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.doPrestige = doPrestige;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.doEnergyReset = doEnergyReset;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.saveGame = saveGame;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.ITEMS = ITEMS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.ARTIFACTS = ARTIFACTS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.SKILL_DEFINITIONS = SKILL_DEFINITIONS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.PERKS = PERKS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.PRESTIGE_UNLOCKABLES = PRESTIGE_UNLOCKABLES;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.PRESTIGE_REPEATABLES = PRESTIGE_REPEATABLES;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.ItemSkillModifierList = ItemSkillModifierList;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.PerkSkillModifierList = PerkSkillModifierList;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.tryAddPerk = tryAddPerk;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.patchRenderingConstants = patchRenderingConstants;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.readRenderingConstants = readRenderingConstants;
//# sourceMappingURL=game.js.map