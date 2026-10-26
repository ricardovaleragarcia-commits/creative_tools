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

  // Intro (first visit of the session). The window is the panel color. Like a loading ring, the dots pop out one by one from the exact centre of the
  // window into an evenly spaced circle that spins; then each one leaves the ring and flies straight home on a bezier curve. As the last ones land,
  // the panel color slides left until it is the real 1/3 panel, and the page rises in behind it.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("sns-intro", "1"); } catch (e) {}
    var N = dots.length, SEQ = 60, OUT = 400, LEAVE0 = 1150, LSTAG = 0, TRAVEL = 850, SHRINK = 900;   // ms
    var W_ROT = Math.PI * 2 / 1500;                                                                    // ring spin (rad/ms)
    var t0 = 0, raf = 0, finished = false, vw = innerWidth, vh = innerHeight;
    function bezier(x1, y1, x2, y2) {                                       // CSS-style cubic-bezier easing
      var bx = function (u) { return 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; };
      var by = function (u) { return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u; };
      return function (x) { if (x <= 0) return 0; if (x >= 1) return 1; var lo = 0, hi = 1, u = x; for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; if (bx(u) < x) lo = u; else hi = u; } return by(u); };
    }
    var pop = bezier(.2, .8, .2, 1), fly = bezier(.65, 0, .25, 1), slide = bezier(.76, 0, .24, 1);
    var sr = side.getBoundingClientRect();
    var cx = vw / 2, cy = vh / 2, R = Math.min(vw * .19, vh * .19, 66);     // one radius: a perfect circle, small like a loading spinner
    var cutR = Math.max(0, vw - sr.right), cutB = Math.max(0, vh - sr.bottom);
    var items = Array.prototype.map.call(dots, function (d, i) {
      var r = d.getBoundingClientRect();
      return { d: d, fx: r.left + r.width / 2, fy: r.top + r.height / 2, appear: i * SEQ, leave: LEAVE0 + i * LSTAG, slot: -i * Math.PI * 2 / N - Math.PI / 2, direct: true };
    });
    var LAND = LEAVE0 + (N - 1) * LSTAG + TRAVEL, SH0 = LEAVE0, END = Math.max(LAND, SH0 + SHRINK);   // the panel color starts sliding the moment the dots leave the ring
    function finish() {
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      items.forEach(function (o) { o.d.style.transform = ""; o.d.style.opacity = ""; });
      root.style.removeProperty("--ir"); root.style.removeProperty("--ib");
      root.classList.add("intro-played"); root.classList.add("intro-go"); root.classList.remove("intro");
      removeEventListener("pointerdown", finish); removeEventListener("keydown", finish);
    }
    var go = false;
    function frame(now) {
      if (!t0) t0 = now; var t = now - t0;
      items.forEach(function (o) {
        var dt = t - o.appear, k, x, y;
        if (dt < 0) { o.d.style.opacity = 0; o.d.style.transform = "translate(" + (cx - o.fx) + "px," + (cy - o.fy) + "px)"; return; }
        k = o.direct ? 1 : pop(Math.min(1, dt / OUT));                       // 1 = on the ring: every dot appears straight on it
        var th = o.slot + W_ROT * t;                                         // the whole ring turns as one
        x = cx + k * R * Math.cos(th); y = cy + k * R * Math.sin(th);
        if (t > o.leave) {                                                   // leaves the ring from where it is, straight home, eased
          var th0 = o.slot + W_ROT * o.leave, sx = cx + R * Math.cos(th0), sy = cy + R * Math.sin(th0), e = fly((t - o.leave) / TRAVEL);
          x = sx + (o.fx - sx) * e; y = sy + (o.fy - sy) * e;
        }
        o.d.style.opacity = Math.min(1, dt / (o.direct ? 220 : 100));                           // dots keep their size the whole time
        o.d.style.transform = "translate(" + (x - o.fx).toFixed(1) + "px," + (y - o.fy).toFixed(1) + "px)";
      });
      var sp = slide((t - SH0) / SHRINK);                                    // the panel color slides left as the last dots land
      root.style.setProperty("--ir", (cutR * sp).toFixed(1) + "px"); root.style.setProperty("--ib", (cutB * sp).toFixed(1) + "px");
      if (!go && t > SH0) { go = true; root.classList.add("intro-go"); }     // the page starts rising behind the sliding color
      if (t >= END) finish(); else raf = requestAnimationFrame(frame);
    }
    addEventListener("pointerdown", finish); addEventListener("keydown", finish);        // any tap or key skips it
    raf = requestAnimationFrame(frame);
  })();
})();
