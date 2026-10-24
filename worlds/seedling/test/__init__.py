import logging

from test.bases import WorldTestBase


class SeedlingTestBase(WorldTestBase):
    game = "Seedling"

    def setUp(self) -> None:
        # Hold the root logger at INFO or above for the test, so the leak check in WorldTestBase.tearDown
        # measures this world rather than whatever logging state an earlier test on this worker left behind
        # (importing kivy, e.g. via worlds/json_tools_installer's GUI tests, sets the root to NOTSET).
        # At DEBUG, Fill's place_item logs `'Placed %s at %s', item, location` (BaseClasses.py) with the
        # objects as args, and pytest's LogCaptureHandler keeps those records until the call phase ends,
        # i.e. past tearDown: location -> region -> MultiWorld, so `weak()` is still alive and the check
        # fails with "World Seedling leaked MultiWorld object". It fired on macOS/3.13 CI when test_fill was
        # the first test of a class to finish on its xdist worker (every such log carries the DEBUG
        # "Placed" records in its "Captured log call"); addCleanup restores the level after tearDown.
        root = logging.getLogger()
        if root.getEffectiveLevel() < logging.INFO:
            self.addCleanup(root.setLevel, root.level)
            root.setLevel(logging.INFO)
        super().setUp()
