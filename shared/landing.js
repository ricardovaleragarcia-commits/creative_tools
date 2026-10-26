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
  // along the route of "S&S" written in one stroke (they only guide the eye, they don't draw it): the first S from its bottom end up, straight
  // into the right arm of the &, down, up the diagonal, round the top loop to the left and down to its lower-right tail, and from there the
  // second S, again from the bottom. When the leading dot reaches the end, all of them fly home at once on a bezier curve, and at that same
  // moment the panel color slides left to the real 1/3 panel and the page rises in behind it.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("sns-intro", "1"); } catch (e) {}
    var N = dots.length, RUN = 1750, TRAVEL = 850, SHRINK = 900;   // ms
    var t0 = 0, raf = 0, finished = false, vw = innerWidth, vh = innerHeight;
    function bezier(x1, y1, x2, y2) {                                       // CSS-style cubic-bezier easing
      var bx = function (u) { return 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; };
      var by = function (u) { return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u; };
      return function (x) { if (x <= 0) return 0; if (x >= 1) return 1; var lo = 0, hi = 1, u = x; for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; if (bx(u) < x) lo = u; else hi = u; } return by(u); };
    }
    var run = bezier(.45, 0, .4, 1), fly = bezier(.65, 0, .25, 1), slide = bezier(.76, 0, .24, 1);
    // The route, in a 210 × 100 box (y down): S, connector, &, connector, S.
    var ROUTE = "M4 82 C10 96 50 100 56 78 C60 62 46 54 30 50 C14 46 4 40 6 24 C8 6 46 0 56 18" +      // first S, bottom → top
      " C64 32 118 30 130 42 C134 46 135 52 133 58" +                                                  // into the right arm of the &
      " C126 82 108 96 92 96 C76 96 68 84 74 74 C80 62 112 48 112 26" +                                // down, round the bottom, up the diagonal
      " C112 10 94 6 88 12 C80 20 84 32 92 44 C104 64 120 88 136 96" +                                // top loop to the left, down to the tail
      " C150 104 200 102 206 78 C210 62 196 54 180 50 C164 46 154 40 156 24 C158 6 196 0 206 18";       // second S, bottom → top
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("aria-hidden", "true"); svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    path.setAttribute("d", ROUTE); svg.appendChild(path); document.body.appendChild(svg);
    var L = path.getTotalLength(), M = 400, pts = [];
    for (var j = 0; j <= M; j++) { var q = path.getPointAtLength(L * j / M); pts.push([q.x, q.y]); }
    svg.remove();
    var S = Math.min(vw * .72 / 210, vh * .34 / 100, 2.2), ox = vw / 2 - 105 * S, oy = vh / 2 - 50 * S;
    function at(u) {                                                        // point on the route, u = 0..1 of its length
      u = Math.max(0, Math.min(1, u)) * M; var i = Math.min(M - 1, Math.floor(u)), f = u - i, a = pts[i], b = pts[i + 1];
      return [ox + (a[0] + (b[0] - a[0]) * f) * S, oy + (a[1] + (b[1] - a[1]) * f) * S];
    }
    var GAP = .028;                                                         // spacing between the dots, as a share of the route
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
