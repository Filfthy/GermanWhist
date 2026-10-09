#!/bin/sh
# tools/bump.sh - bumps the ?v= number on the page's scripts and stylesheets, so phones and browsers
# fetch the new files instead of using the copies they kept (GitHub Pages lets them keep files 10 minutes),
# and writes version.txt, which an older copy of the page checks on loading so it can refresh itself.
cd "$(dirname "$0")/.." || exit 1
v=$(grep -o '?v=[0-9]*' index.html | head -1 | cut -d= -f2)
sed -i "s/?v=$v\"/?v=$((v+1))\"/g" index.html
sed -i "s/window.GW_VERSION = $v;/window.GW_VERSION = $((v+1));/" index.html
echo "$((v+1))" > version.txt   # open pages see this and refresh themselves
echo "v=$((v+1))"
