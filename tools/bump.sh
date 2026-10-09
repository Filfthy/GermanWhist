#!/bin/sh
# tools/bump.sh - bumps the ?v= number on the page's scripts and stylesheets, so phones and browsers
# fetch the new files instead of using the copies they kept (GitHub Pages lets them keep files 10 minutes).
cd "$(dirname "$0")/.." || exit 1
v=$(grep -o '?v=[0-9]*' index.html | head -1 | cut -d= -f2)
sed -i "s/?v=$v\"/?v=$((v+1))\"/g" index.html
echo "v=$((v+1))"
