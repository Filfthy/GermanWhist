#!/bin/sh
# tools/sum.sh <output file> - totals the lines tools/par.sh printed
grep "games" "$1" | sed -E 's/.*games, .* won ([0-9]+) .*avg tricks ([0-9.]+).*points ([0-9]+)-([0-9]+).*/\1 \2 \3 \4/' | awk '{w+=$1;t+=$2;p+=$3;q+=$4;n++} END {printf "won %d/%d (%.1f%%), avg tricks %.2f, points %d-%d\n", w, n*G, 100*w/(n*G), t/n, p, q}' G=${2:-10}
