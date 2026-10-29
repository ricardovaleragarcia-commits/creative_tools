# Shake & Settle

Library of experimental tools for generating motion and interactions: play with the controls, then export a seamless loop.
Plain HTML + CSS + JS, no build step: works on GitHub Pages and with any static server.

```
index.html          landing (6-column grid of tool cards)
tools.json          list of tools -> add an object here to add a card
shared/theme.css    shared identity (Helvetica Neue, the 12 palettes, credits bar)
scripts/card-tones.py  the rule for the dark tone of each card color (see below)
shared/palette.js   palette picked on the landing (the dots), saved per browser
shared/tool.css     tool screen: dark panel with controls (1/3) + stage with the artwork (2/3)
shared/tool.js      tool name, workspace on/off (crop marks), frame background helper
shared/credits.js   credits bar with clickable icons (mail, web, Instagram, LinkedIn)
shared/leave.js     soft fade-out when navigating between pages (add it before smooth-scroll.js)
shared/persist.js   remembers a tool's settings between visits (ToolPersist.init in the tool script)
tools/_template/    copy this folder to start a new tool
fonts/              (not used since the switch to Helvetica Neue)
```

## Add a tool
1. Copy `tools/_template/` to `tools/<name>/` and build the tool inside it. Controls go in `.block` elements
   in the left menu; the artwork goes in `#artwork` (set `--ar` = width / height of the frame, e.g. `0.8` for 4:5).
   Call `setFrameBg(css)` when the artwork background changes (it shows when the workspace is off).
   Add the `<script src="../../shared/palette.js">` in <head> and `tool.js` at the end of <body>.
2. Add `{ "title": "...", "description": "...", "cover": "tools/<name>/cover.jpg", "href": "tools/<name>/" }` to `tools.json`.

## Card colors
Each card (and each tool's title band) has two colors: the palette's card color `--c1..--c6`, and a darker tone of it `--d1..--d6` for the title and description bands, with `--o1..--o6` as the text color on top.
The dark tone is a rule, not a hand-picked value: in OKLCH, same hue, lightness x 0.82 and chroma x 0.82. Text inside the cards is always white, so every card color must be dark enough for 3:1 (titles) and ideally 4.5:1 (descriptions) on its tone. The white and black palettes use one gray for all six cards.
To add or change a palette: edit its `--c1..--c6` in `shared/theme.css`, then run `python3 scripts/card-tones.py --write`. It prints the contrast of every card and rewrites the `--d` / `--o` values.

## Run locally
`python3 -m http.server 3000` and open http://localhost:3000 (`tools.json` needs http, not `file://`).

## Tools
| Tool | Folder |
|---|---|
| Vinyl & CD Mockup Animator | `tools/disc-spin/` |
| Shape Drop & Multiply | `tools/shape-drop/` |
| Text & Shape Trace and Fill | `tools/line-draw/` |
| Text Orbit Sphere | `tools/text-orbit/` |

## Publish
Settings -> Pages -> Deploy from a branch -> `main` / root.
