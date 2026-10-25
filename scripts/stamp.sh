#!/bin/sh
# Updates the "Last update" line of the site (shared/credits.js) with the current time in Barcelona.
# Run it before committing a change to the site:   sh scripts/stamp.sh
cd "$(dirname "$0")/.." || exit 1
STAMP=$(TZ=Europe/Madrid date '+%-d %b %Y, %H:%M %Z')" (Barcelona)"
sed -i "s|var LAST_UPDATE = \".*\";|var LAST_UPDATE = \"$STAMP\";|" shared/credits.js
echo "Last update: $STAMP"
