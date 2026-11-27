# usage: gateset.sh <tree>  — the brief's bounded vitest set (fast tier only; .slow/.train run on their own configs)
cd "$1" || exit 1
D=frontend/modules/seedlingDemo
{
for p in contactFidelity levelRun levelWorld activators button rope fallRock spinner wallFlyer pushable pulser fidelityDeadFrame fidelityResponderOrder fidelityPresserHang fidelityChestCover fidelityPublishedButtonRoom fidelityProximity fidelityFencepost fidelityFrozen fidelityFreeze seedlingResponderFade seedlingSoundCues oneSpelling r8Acceptance tapeEnvelope solverDeadline decisionTrace seedlingConstantsCensus seedlingSolverSurface; do
  ls $D/$p*.test.js scripts/procgen/$p*.test.js frontend/**/__tests__/$p*.test.js 2>/dev/null
done
ls scripts/procgen/lintGateLabels.test.js 2>/dev/null
grep -a -l -E "stepPushablesDeadFrameNow|armButtonFallRocks|stepActivators|deadFrameResponderStep|freezeFramesStepResponders|pulserDeadFrameUpdate|blockPressesFallRockButtonSameFrame|wandShotEnemyBodies" $D/*.test.js scripts/procgen/*.test.js 2>/dev/null
} | grep -av "\.slow\.\|\.train\.\|\.calib\." | sort -u
