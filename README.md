# Creative tools

Open-source library of experimental tools for generating motion and interactions.
Plain HTML + CSS + JS, no build step: works on GitHub Pages and with any static server.

```
index.html          landing (6-column grid of tool cards)
tools.json          list of tools -> add an object here to add a card
shared/theme.css    shared identity (ABC Areal Bold, colors, credits bar)
shared/tool.css     tool interface: menu (2 cols) + artwork (4 cols)
shared/credits.js   credits bar with clickable icons (mail, web, Instagram, LinkedIn)
tools/_template/    copy this folder to start a new tool
fonts/              ABC Areal webfonts
```

## Add a tool
1. Copy `tools/_template/` to `tools/<name>/` and build the tool inside it. Controls go in `.block` elements
   in the left menu; the artwork goes in `#artwork` (set `--ar` = width / height of the frame, e.g. `0.8` for 4:5).
2. Add `{ "title": "...", "description": "...", "cover": "tools/<name>/cover.jpg", "href": "tools/<name>/" }` to `tools.json`.

## Run locally
`python3 -m http.server 3000` and open http://localhost:3000 (`tools.json` needs http, not `file://`).

## Publish
Settings -> Pages -> Deploy from a branch -> `main` / root.
