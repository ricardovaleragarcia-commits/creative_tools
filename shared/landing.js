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

  // Intro (first visit of the session): the window is the panel color, the dots are born in its centre and orbit; then they park while the
  // panel color shrinks down to the real 1/3 panel, and the page appears as the last dot lands.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("ct-intro", "1"); } catch (e) {}
    var N = dots.length, T1 = 1300, STAG = 45, TRAVEL = 950, BORN = 700, SHRINK = 1000, W_ROT = Math.PI * 2 / 2400;   // rad per ms
    var t0 = 0, raf = 0, finished = false, vw = innerWidth, vh = innerHeight;
    function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    var sr = side.getBoundingClientRect();
    var cx = vw / 2, cy = vh / 2, a = Math.min(vw * .3, 300), b = Math.min(vh * .26, 240);
    var cutR = Math.max(0, vw - sr.right), cutB = Math.max(0, vh - sr.bottom);
    var items = Array.prototype.map.call(dots, function (d, i) {
      var r = d.getBoundingClientRect();
      return { d: d, fx: r.left + r.width / 2, fy: r.top + r.height / 2, ph: i / N * Math.PI * 2, ra: 1 + (i % 3 - 1) * .08, leave: T1 + i * STAG };
    });
    function orbit(o, t, k) { var th = o.ph + W_ROT * t; return [cx + k * a * o.ra * Math.cos(th), cy + k * b * o.ra * Math.sin(th)]; }
    function finish() {
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      items.forEach(function (o) { o.d.style.transform = ""; o.d.style.opacity = ""; });
      root.style.removeProperty("--ir"); root.style.removeProperty("--ib");
      root.classList.add("intro-played"); root.classList.remove("intro");
      removeEventListener("pointerdown", finish); removeEventListener("keydown", finish);
    }
    var revealed = false, END = T1 + (N - 1) * STAG + TRAVEL;
    function frame(now) {
      if (!t0) t0 = now; var t = now - t0;
      var born = ease(Math.min(1, t / BORN));                       // 0 = all in the centre, 1 = full orbit
      items.forEach(function (o) {
        var p = orbit(o, t, born), x = p[0], y = p[1];
        if (t > o.leave) { var e = ease(Math.min(1, (t - o.leave) / TRAVEL)); x += (o.fx - x) * e; y += (o.fy - y) * e; }
        o.d.style.opacity = Math.min(1, t / 250);
        o.d.style.transform = "translate(" + (x - o.fx).toFixed(1) + "px," + (y - o.fy).toFixed(1) + "px)";
      });
      var sp = ease(Math.min(1, Math.max(0, (t - T1 - 150) / SHRINK)));   // the panel color closes in as the dots head home
      root.style.setProperty("--ir", (cutR * sp).toFixed(1) + "px"); root.style.setProperty("--ib", (cutB * sp).toFixed(1) + "px");
      if (!revealed && t > END - 250) { revealed = true; root.classList.remove("intro"); root.classList.add("intro-played"); root.style.removeProperty("--ir"); root.style.removeProperty("--ib"); }   // content starts rising as the last dots land
      if (t >= END) finish(); else raf = requestAnimationFrame(frame);
    }
    addEventListener("pointerdown", finish); addEventListener("keydown", finish);        // any tap or key skips it
    raf = requestAnimationFrame(frame);
  })();
})();
