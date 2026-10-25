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
  try { cachedTxt = localStorage.getItem("ct-tools"); if (cachedTxt) render(JSON.parse(cachedTxt)); } catch (e) { cachedTxt = null; }
  fetch("tools.json").then(function (r) { return r.text(); })
    .then(function (txt) {
      if (txt === cachedTxt) return;               // already drawn from the cache: don't redraw
      render(JSON.parse(txt));
      try { localStorage.setItem("ct-tools", txt); } catch (e) {}
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

  // Intro (first visit of the session): the window is the panel color. From the exact centre of the window the dots come out one after another,
  // run along a perfect circle for almost one lap and then each goes home. When the last ones land, the panel color slides away to the left
  // until it is the real 1/3 panel, and the page appears.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("ct-intro", "1"); } catch (e) {}
    var N = dots.length, SEQ = 55, OUT = 500, LAP = 1100, TRAVEL = 750, SHRINK = 700, W_ROT = Math.PI * 2 / 1400;   // ms, rad per ms
    var t0 = 0, raf = 0, finished = false, vw = innerWidth, vh = innerHeight;
    function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
    var sr = side.getBoundingClientRect();
    var cx = vw / 2, cy = vh / 2, R = Math.min(vw * .3, vh * .3, 260);          // one radius: a perfect circle
    var cutR = Math.max(0, vw - sr.right), cutB = Math.max(0, vh - sr.bottom);
    var items = Array.prototype.map.call(dots, function (d, i) {
      var r = d.getBoundingClientRect();
      return { d: d, fx: r.left + r.width / 2, fy: r.top + r.height / 2, t: i * SEQ, ph: -Math.PI / 2 };
    });
    var LAND = (N - 1) * SEQ + LAP + TRAVEL, SH0 = LAND - 150, END = SH0 + SHRINK, GO = SH0 + 150;
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
        var dt = t - o.t;
        if (dt < 0) { o.d.style.opacity = 0; o.d.style.transform = "translate(" + (cx - o.fx) + "px," + (cy - o.fy) + "px)"; return; }
        var k = easeOut(Math.min(1, dt / OUT)), th = o.ph + W_ROT * dt;      // leaves the centre point, spiralling out to the circle
        var x = cx + k * R * Math.cos(th), y = cy + k * R * Math.sin(th);
        if (dt > LAP) { var e = ease(Math.min(1, (dt - LAP) / TRAVEL)); x += (o.fx - x) * e; y += (o.fy - y) * e; }
        o.d.style.opacity = Math.min(1, dt / 120);
        o.d.style.transform = "translate(" + (x - o.fx).toFixed(1) + "px," + (y - o.fy).toFixed(1) + "px)";
      });
      var sp = ease(Math.min(1, Math.max(0, (t - SH0) / SHRINK)));          // the panel color slides left as the last dots land
      root.style.setProperty("--ir", (cutR * sp).toFixed(1) + "px"); root.style.setProperty("--ib", (cutB * sp).toFixed(1) + "px");
      if (!go && t > GO) { go = true; root.classList.add("intro-go"); }      // the rest of the page starts rising
      if (t >= END) finish(); else raf = requestAnimationFrame(frame);
    }
    addEventListener("pointerdown", finish); addEventListener("keydown", finish);        // any tap or key skips it
    raf = requestAnimationFrame(frame);
  })();
})();
