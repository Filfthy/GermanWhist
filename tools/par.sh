#!/bin/sh
# tools/par.sh <processes> <games each> <ai engine> <player engine> - runs tools/sim.js in parallel
P=$1; N=$2; shift 2
for i in $(seq 1 $P); do node "$(dirname "$0")/sim.js" "$N" "$@" & done
wait
