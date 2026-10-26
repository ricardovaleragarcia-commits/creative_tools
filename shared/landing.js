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

  // Intro (first visit of the session). The window is the panel color. The dots come out one after another and run, like a little train,
  // along the route of "S&S" (they only guide the eye, they don't draw it): the first S from its bottom end up to its top end, a jump down
  // into the right arm of the &, round the & to its tail, a jump into the bottom end of the second S and up it. When the leading dot reaches
  // the end, all of them fly home at once on a bezier curve, and at that same moment the panel color slides left to the real 1/3 panel and
  // the page rises in behind it.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("sns-intro", "1"); } catch (e) {}
    var N = dots.length, RUN = 2000, TRAVEL = 850, SHRINK = 900;   // ms
    var t0 = 0, raf = 0, finished = false, vw = innerWidth, vh = innerHeight;
    function bezier(x1, y1, x2, y2) {                                       // CSS-style cubic-bezier easing
      var bx = function (u) { return 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; };
      var by = function (u) { return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u; };
      return function (x) { if (x <= 0) return 0; if (x >= 1) return 1; var lo = 0, hi = 1, u = x; for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; if (bx(u) < x) lo = u; else hi = u; } return by(u); };
    }
    var run = bezier(.45, 0, .4, 1), fly = bezier(.65, 0, .25, 1), slide = bezier(.76, 0, .24, 1);
    // The route (traced from Ricardo's sketch, y down): S, &, S side by side, linked by short jumps.
    var S1 = "C118 390 140 430 190 455 C230 475 300 480 340 445 C370 415 368 360 330 330 C300 305 230 285 190 260" +
      " C150 235 140 175 165 145 C200 110 300 110 340 150 C355 165 362 180 365 190";                    // S: bottom-left end → top-right end
    var ROUTE = "M115 340 " + S1 +
      " C430 70 760 40 758 200" +                                                                      // jump: over to the &, coming down from above
      " C757 240 756 270 750 300 C735 370 700 440 640 470 C590 492 520 485 497 440 C480 400 505 360 550 320" +   // right arm down, round the bottom
      " C600 275 655 230 658 180 C660 140 620 125 590 132 C550 142 540 200 560 240 C600 320 700 430 780 490" +   // up the diagonal, top loop to the left, down to the tail
      " C798 440 812 350 834 350 C852 350 860 375 862 400" +                                            // jump: up and down into the bottom end of the second S
      " C866 430 895 450 940 455 " +
      S1.slice(S1.indexOf("C230")).replace(/-?\d+(\.\d+)? -?\d+(\.\d+)?/g, function (p) { var q = p.split(" "); return (+q[0] + 750) + " " + q[1]; });   // the rest of the same S, 750 to the right
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("aria-hidden", "true"); svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    path.setAttribute("d", ROUTE); svg.appendChild(path); document.body.appendChild(svg);
    var L = path.getTotalLength(), M = 400, pts = [];
    for (var j = 0; j <= M; j++) { var q = path.getPointAtLength(L * j / M); pts.push([q.x, q.y]); }
    svg.remove();
    var bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    pts.forEach(function (q) { bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); });
    var S = Math.min(vw * (vw < 700 ? .9 : .72) / (bx1 - bx0), vh * .34 / (by1 - by0), .7), ox = vw / 2 - (bx0 + bx1) / 2 * S, oy = vh / 2 - (by0 + by1) / 2 * S;   // centred in the window
    function at(u) {                                                        // point on the route, u = 0..1 of its length
      u = Math.max(0, Math.min(1, u)) * M; var i = Math.min(M - 1, Math.floor(u)), f = u - i, a = pts[i], b = pts[i + 1];
      return [ox + (a[0] + (b[0] - a[0]) * f) * S, oy + (a[1] + (b[1] - a[1]) * f) * S];
    }
    var GAP = Math.max(.02, 34 / (L * S));                                  // spacing between the dots (share of the route), never closer than 34 px
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
