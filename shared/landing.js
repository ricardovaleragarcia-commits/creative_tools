/* Renders tools.json into the grid, and wires the palette dots. Add a tool = add an object to tools.json. */
(function () {
  var grid = document.getElementById("tools");
  function render(list) {
    var f = document.createDocumentFragment();
    list.forEach(function (t) {
      var a = document.createElement(t.href ? "a" : "div");
      a.className = "tool"; a.style.setProperty("--i", f.childNodes.length);
      if (t.href) a.href = t.href;
      var h = document.createElement("h2");
      h.className = "title"; h.textContent = t.title;
      var c = document.createElement("div");
      c.className = "tool__cover";
      if (t.cover) { var i = document.createElement("img"); i.src = t.cover; i.alt = ""; i.loading = "lazy"; c.appendChild(i); }
      var d = document.createElement("p");
      d.className = "small tool__desc"; d.textContent = t.description || "";
      a.appendChild(h); a.appendChild(c); a.appendChild(d);
      f.appendChild(a);
    });
    grid.replaceChildren(f);
  }
  var cachedTxt = null;
  try { cachedTxt = localStorage.getItem("sns-tools"); if (cachedTxt) render(JSON.parse(cachedTxt)); } catch (e) { cachedTxt = null; }
  fetch("tools.json").then(function (r) { return r.text(); })
    .then(function (txt) {
      if (txt === cachedTxt) return;               // already drawn from the cache: don't redraw
      render(JSON.parse(txt));
      try { localStorage.setItem("sns-tools", txt); } catch (e) {}
    })
    .catch(function () { grid.textContent = "Could not load tools.json (serve the folder over http)."; });

  // palette dots
  var dots = document.querySelectorAll(".dot");
  function mark() {
    var cur = document.documentElement.getAttribute("data-palette");
    dots.forEach(function (d) {
      var on = d.getAttribute("data-p") === cur;
      d.setAttribute("aria-checked", on ? "true" : "false");
    });
  }
  dots.forEach(function (d, i) {
    d.style.setProperty("--i", i);
    d.addEventListener("click", function () {
      var p = d.getAttribute("data-p"), root = document.documentElement;
      if (p === root.getAttribute("data-palette")) return;
      var apply = function () { window.CTPalette.set(p); mark(); };
      var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || calm) { apply(); return; }
      var r = d.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add("pal-vt");
      var t = document.startViewTransition(apply);
      t.ready.then(function () {
        root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + rad + "px at " + x + "px " + y + "px)"] },
          { duration: 800, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" });
      }).catch(function () {});
      t.finished.finally(function () { root.classList.remove("pal-vt"); });
    });
  });
  mark();

  // Free area for the dots = from just under the intro text down to the credits (text height changes with the width).
  var side = document.querySelector(".side"), areaEl = document.getElementById("dots"), headB = document.querySelector(".head__b");
  function placeArea() {
    if (!side || !headB) return;
    areaEl.style.setProperty("--dots-top", Math.round(headB.getBoundingClientRect().bottom - side.getBoundingClientRect().top + 14) + "px");
  }
  placeArea(); addEventListener("resize", placeArea);

  // Intro (first visit of the session). The window is the panel color. The dots come out one after another and run slowly, like a little
  // train, along one continuous route made of S, & and S drawn on top of each other in the middle of the window (they only guide the eye,
  // they don't draw it). When the leading dot reaches the end, all of them fly home at once on a bezier curve, and at that same moment the
  // panel color slides left to the real 1/3 panel and the page rises in behind it.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("sns-intro", "1"); } catch (e) {}
    var N = dots.length, RUN = 4200, TRAVEL = 850, SHRINK = 900;   // ms
    var t0 = 0, raf = 0, finished = false, vw = innerWidth, vh = innerHeight;
    function bezier(x1, y1, x2, y2) {                                       // CSS-style cubic-bezier easing
      var bx = function (u) { return 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; };
      var by = function (u) { return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u; };
      return function (x) { if (x <= 0) return 0; if (x >= 1) return 1; var lo = 0, hi = 1, u = x; for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; if (bx(u) < x) lo = u; else hi = u; } return by(u); };
    }
    var run = bezier(.45, 0, .4, 1), fly = bezier(.65, 0, .25, 1), slide = bezier(.76, 0, .24, 1);
    // The route, traced from Ricardo's sketch (y down): S, & and S on top of each other in the same spot, one continuous line with no going
    // back: the first S from its bottom end up to its top end, on down into the right arm of the &, round the &, whose last curve turns
    // right and up, straight up into the top end of the second S, and down that S (the opposite way to the first) to its bottom end.
    function shift(d, dx) { return d.replace(/-?\d+(\.\d+)? -?\d+(\.\d+)?/g, function (p) { var q = p.split(" "); return (+q[0] + dx) + " " + q[1]; }); }
    var S_UP = "C100 600 120 650 160 670 C220 700 300 715 370 705 C420 695 445 650 445 590 C445 520 380 470 320 450" +
      " C250 425 180 420 150 360 C125 300 150 260 200 245 C270 222 360 220 400 260 C415 275 425 295 430 320";   // S: bottom-left end → top-right end
    var AMP = "C980 540 960 600 910 640 C860 690 800 725 720 725 C650 725 610 690 605 630 C600 570 640 520 700 480" +   // &: right arm down, round the bottom
      " C760 440 820 380 840 320 C855 270 830 240 790 240 C740 240 700 260 690 320 C680 370 700 410 740 460" +   // up the diagonal, round the top loop
      " C800 540 870 620 930 640 C990 655 1040 620 1055 560 C1058 545 1060 525 1060 510";                      // down the other diagonal, then right and up
    var S_DOWN = "C1490 300 1470 260 1430 245 C1360 225 1270 230 1220 255 C1170 285 1160 350 1190 400 C1220 450 1300 465 1380 490" +
      " C1450 515 1495 560 1490 630 C1485 690 1420 715 1320 715 C1240 715 1190 690 1170 650 C1160 630 1152 610 1150 595";   // S: top-right end → bottom-left end
    var ROUTE = "M95 530 " + S_UP +
      " C434 345 470 380 473 420 C474 440 475 455 475 470 " + shift(AMP, -510) +                        // on down into the right arm of the & (moved onto the S)
      " C552 470 520 440 480 430 C455 425 450 400 450 360 " + shift(S_DOWN, -1040);                     // up into the top end of the second S (moved onto it too)
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("aria-hidden", "true"); svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    path.setAttribute("d", ROUTE); svg.appendChild(path); document.body.appendChild(svg);
    var L = path.getTotalLength(), M = 400, pts = [];
    for (var j = 0; j <= M; j++) { var q = path.getPointAtLength(L * j / M); pts.push([q.x, q.y]); }
    svg.remove();
    var bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    pts.forEach(function (q) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); });
    var S = Math.min(vw * .45 / (bx1 - bx0), vh * .22 / (by1 - by0), .42), ox = vw / 2 - (bx0 + bx1) / 2 * S, oy = vh / 2 - (by0 + by1) / 2 * S;   // centred in the window
    function at(u) {                                                        // point on the route, u = 0..1 of its length
      u = Math.max(0, Math.min(1, u)) * M; var i = Math.min(M - 1, Math.floor(u)), f = u - i, a = pts[i], b = pts[i + 1];
      return [ox + (a[0] + (b[0] - a[0]) * f) * S, oy + (a[1] + (b[1] - a[1]) * f) * S];
    }
    var GAP = Math.max(.018, 22 / (L * S));                                  // spacing between the dots (share of the route), never closer than 22 px
    var sr = side.getBoundingClientRect();
    var cutR = Math.max(0, vw - sr.right), cutB = Math.max(0, vh - sr.bottom);
    var items = Array.prototype.map.call(dots, function (d, i) {
      var r = d.getBoundingClientRect();
      return { d: d, fx: r.left + r.width / 2, fy: r.top + r.height / 2, lag: i * GAP };
    });
    var LEAVE = RUN, SH0 = LEAVE, END = Math.max(LEAVE + TRAVEL, SH0 + SHRINK);   // the panel color starts sliding the moment the dots leave the route
    function finish() {
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      items.forEach(function (o) { o.d.style.transform = ""; o.d.style.opacity = ""; });
      root.style.removeProperty("--ir"); root.style.removeProperty("--ib");
      root.classList.add("intro-played"); root.classList.add("intro-go"); root.classList.remove("intro");
      removeEventListener("pointerdown", finish); removeEventListener("keydown", finish);
    }
    var go = false;
    function frame(now) {
      if (!t0) t0 = now; var t = now - t0, head = run(Math.min(1, t / RUN));   // the leading dot reaches the end of the route exactly when they all leave
      items.forEach(function (o) {
        var u = Math.min(head - o.lag, 1), p, x, y;
        if (t < LEAVE) {
          if (u < 0) { o.d.style.opacity = 0; p = at(0); }
          else { o.d.style.opacity = Math.min(1, u / .02); p = at(u); }
          x = p[0]; y = p[1]; o.lu = Math.max(0, u);
        } else {                                                            // leaves the route from where it is, straight home, eased
          p = at(o.lu); var e = fly((t - LEAVE) / TRAVEL);
          o.d.style.opacity = 1; x = p[0] + (o.fx - p[0]) * e; y = p[1] + (o.fy - p[1]) * e;
        }
        o.d.style.transform = "translate(" + (x - o.fx).toFixed(1) + "px," + (y - o.fy).toFixed(1) + "px)";
      });
      var sp = slide((t - SH0) / SHRINK);
      root.style.setProperty("--ir", (cutR * sp).toFixed(1) + "px"); root.style.setProperty("--ib", (cutB * sp).toFixed(1) + "px");
      if (!go && t > SH0) { go = true; root.classList.add("intro-go"); }     // the page starts rising behind the sliding color
      if (t >= END) finish(); else raf = requestAnimationFrame(frame);
    }
    addEventListener("pointerdown", finish); addEventListener("keydown", finish);        // any tap or key skips it
    raf = requestAnimationFrame(frame);
  })();
})();
