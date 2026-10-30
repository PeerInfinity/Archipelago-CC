# The first thing you should make for your world is an archipelago.json manifest file.
# You can reference APQuest's, but you should change the "game" field (obviously),
# and you should also change the "minimum_ap_version" - probably to the current value of Utils.__version__.

# APQuest ServerData is a copy of worlds/apquest under a different game name, used as the worked example for the
# frontend's server-supplied-data arc (connect-time slot_data and scouting).
# The copy only needs to generate and serve seeds, so it drops APQuest's launcher component (components.py)
# and its playable client and game (client/, game/): that client hardcodes game = "APQuest", so it could not
# connect to an APQuest ServerData slot anyway, and the web frontend is this copy's client.

# The main thing we do in our __init__.py is importing our world class from our world.py to initialize it.
# Obviously, this world class needs to exist first. For this, read world.py.
from .world import APQuestServerDataWorld as APQuestServerDataWorld
