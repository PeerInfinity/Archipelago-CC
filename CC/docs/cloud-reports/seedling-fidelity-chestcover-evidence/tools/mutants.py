import sys
m=sys.argv[1]
def sub(p,a,b):
    s=open(p).read(); assert s.count(a)==1,(m,a); open(p,'w').write(s.replace(a,b))
if m=='M1': sub('levelRun.js',"? openActivatorIdsBeforeStep(activators) : openActivatorIds(activators);","? openActivatorIds(activators) : openActivatorIds(activators);")
if m=='M2': sub('activators.js',"if (CONTACT_FIDELITY.chestCoverFencepost) state.openBefore = openActivatorIds(state);","state.openBefore = openActivatorIds(state);")
if m=='M3': sub('levelRun.js',"? openActivatorIdsBeforeStep(activators) : openActivatorIds(activators);","? openActivatorIdsBeforeLatestStep(activators, world) : openActivatorIds(activators);"); sub('activators.js',"export function openActivatorIdsBeforeStep(state) {\n    return state.openBefore ?? openActivatorIds(state);","export function openActivatorIdsBeforeStep(state, world = WORLD_OF.get(state)) {\n    return openActivatorIdsBeforeLatestStep(state, world);")
if m=='M3':
    sub('activators.js',"    if (CONTACT_FIDELITY.chestCoverFencepost) state.openBefore = openActivatorIds(state);","    if (CONTACT_FIDELITY.chestCoverFencepost) state.openBefore = openActivatorIds(state);\n    WORLD_OF.set(state, world);")
    sub('activators.js',"const OPENS_ON_TICK = new Map();","const OPENS_ON_TICK = new Map();\nconst WORLD_OF = new WeakMap();")
if m=='M4':
    sub('activators.js',"    if (CONTACT_FIDELITY.chestCoverFencepost) state.openBefore = openActivatorIds(state);\n","")
    sub('activators.js',"    return events;\n}\n\n/** The ids that are currently NOT solid. */","    if (CONTACT_FIDELITY.chestCoverFencepost) state.openBefore = openActivatorIds(state);\n    return events;\n}\n\n/** The ids that are currently NOT solid. */")
