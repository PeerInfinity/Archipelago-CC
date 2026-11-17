#!/bin/bash
T=/tmp/claude-0/-home-user-Archipelago-CC/efc8119d-b8dc-5004-bce0-7b3bc3d72f9e/scratchpad/tools
$T/run-arm.sh A1
$T/run-arm.sh A2
$T/run-arm.sh B1 TEST_MEASURE_FLASH_RUNTIME=js
$T/run-arm.sh P1 TEST_MEASURE_SKIP_REFUSALS=10
