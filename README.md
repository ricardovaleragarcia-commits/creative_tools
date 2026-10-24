# Creative tools

Open-source library of experimental tools for generating motion and interactions.
Plain HTML + CSS + JS, no build step: works on GitHub Pages and with any static server.

```
index.html          landing (6-column grid of tool cards)
tools.json          list of tools -> add an object here to add a card
shared/theme.css    shared identity (Helvetica Neue, the 7 palettes, credits bar)
shared/palette.js   palette picked on the landing (the dots), saved per browser
shared/tool.css     tool screen: dark panel with controls (1/3) + stage with the artwork (2/3)
shared/tool.js      tool name, workspace on/off (crop marks), frame background helper
shared/credits.js   credits bar with clickable icons (mail, web, Instagram, LinkedIn)
tools/_template/    copy this folder to start a new tool
fonts/              (not used since the switch to Helvetica Neue)
```

## Add a tool
1. Copy `tools/_template/` to `tools/<name>/` and build the tool inside it. Controls go in `.block` elements
   in the left menu; the artwork goes in `#artwork` (set `--ar` = width / height of the frame, e.g. `0.8` for 4:5).
   Call `setFrameBg(css)` when the artwork background changes (it shows when the workspace is off).
   Add the `<script src="../../shared/palette.js">` in <head> and `tool.js` at the end of <body>.
2. Add `{ "title": "...", "description": "...", "cover": "tools/<name>/cover.jpg", "href": "tools/<name>/" }` to `tools.json`.

## Run locally
`python3 -m http.server 3000` and open http://localhost:3000 (`tools.json` needs http, not `file://`).

## Publish
Settings -> Pages -> Deploy from a branch -> `main` / root.
