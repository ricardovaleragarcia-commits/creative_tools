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

  // Intro (first visit of the session): the dots orbit on an ellipse, then each leaves the orbit and parks; the page appears as the last one lands.
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains("intro")) return;
    try { sessionStorage.setItem("ct-intro", "1"); } catch (e) {}
    var N = dots.length, T1 = 1100, STAG = 45, TRAVEL = 950, FADE = 350, W_ROT = Math.PI * 2 / 2400;   // rad per ms
    var t0 = 0, raf = 0, finished = false;
    function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    function setup() {
      var sr = side.getBoundingClientRect(), ar = areaEl.getBoundingClientRect();
      var cx = sr.width / 2, cy = sr.height * .46, a = sr.width * .36, b = Math.min(sr.height * .30, sr.width * .5);
      return Array.prototype.map.call(dots, function (d, i) {
        var fx = ar.left - sr.left + d.offsetLeft, fy = ar.top - sr.top + d.offsetTop;     // final centre (margin already centres it)
        return { d: d, fx: fx + 8.5, fy: fy + 8.5, ph: i / N * Math.PI * 2, ra: 1 + (i % 3 - 1) * .07, leave: T1 + i * STAG };
      }).map(function (o) { o.cx = cx; o.cy = cy; o.a = a; o.b = b; return o; });
    }
    var items = setup();
    function orbit(o, t) { var th = o.ph + W_ROT * t; return [o.cx + o.a * o.ra * Math.cos(th), o.cy + o.b * o.ra * Math.sin(th)]; }
    function finish() {
      if (finished) return; finished = true; cancelAnimationFrame(raf);
      items.forEach(function (o) { o.d.style.transform = ""; o.d.style.opacity = ""; });
      root.classList.add("intro-played"); root.classList.remove("intro");
      removeEventListener("pointerdown", finish); removeEventListener("keydown", finish);
    }
    var revealed = false, END = T1 + (N - 1) * STAG + TRAVEL;
    function frame(now) {
      if (!t0) t0 = now; var t = now - t0;
      items.forEach(function (o) {
        var p = orbit(o, t), x = p[0], y = p[1];
        if (t > o.leave) { var e = ease(Math.min(1, (t - o.leave) / TRAVEL)); x += (o.fx - x) * e; y += (o.fy - y) * e; }
        o.d.style.opacity = Math.min(1, t / FADE - o.ph / (Math.PI * 2) * .6);
        o.d.style.transform = "translate(" + (x - o.fx).toFixed(1) + "px," + (y - o.fy).toFixed(1) + "px)";
      });
      if (!revealed && t > END - 250) { revealed = true; root.classList.remove("intro"); root.classList.add("intro-played"); }   // content starts rising as the last dots land
      if (t >= END) finish(); else raf = requestAnimationFrame(frame);
    }
    addEventListener("pointerdown", finish); addEventListener("keydown", finish);        // any tap or key skips it
    raf = requestAnimationFrame(frame);
  })();
})();
