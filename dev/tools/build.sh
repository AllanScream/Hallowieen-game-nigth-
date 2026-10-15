#!/usr/bin/env bash
# prep art/gen → live/assets, downscale to display needs, measure anchors
set -e
python3 /root/.cache/ref2game/claude/scripts/prep.py >/dev/null
python3 tools/shrink.py
python3 tools/winmask.py >/dev/null
python3 tools/anchors.py >/dev/null
