/* Renders tools.json into the grid, and wires the palette dots. Add a tool = add an object to tools.json. */
(function () {
  var grid = document.getElementById("tools");
  function render(list) {
    var f = document.createDocumentFragment();
    list.forEach(function (t) {
      var a = document.createElement(t.href ? "a" : "div");
      a.className = "tool";
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
  fetch("tools.json").then(function (r) { return r.json(); }).then(render)
    .catch(function () { grid.textContent = "Could not load tools.json (serve the folder over http)."; });

  // big CT: as wide as its panel (CSS sizes it like the Figma); if the font in use is wider, shrink it to fit
  var side = document.querySelector(".side"), ct = document.querySelector(".side__ct");
  function fitCT() {
    if (!side || !ct) return;
    ct.style.fontSize = "";
    var room = side.clientWidth - 6, r = ct.getBoundingClientRect(), s = side.getBoundingClientRect();
    var used = r.right - s.left;
    if (used > room) ct.style.fontSize = (parseFloat(getComputedStyle(ct).fontSize) * (room - (r.left - s.left)) / r.width) + "px";
  }
  fitCT();
  addEventListener("resize", fitCT);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitCT);

  // palette dots
  var dots = document.querySelectorAll(".dot");
  function mark() {
    var cur = document.documentElement.getAttribute("data-palette");
    dots.forEach(function (d) {
      var on = d.getAttribute("data-p") === cur;
      d.setAttribute("aria-checked", on ? "true" : "false");
    });
  }
  dots.forEach(function (d) {
    d.addEventListener("click", function () { window.CTPalette.set(d.getAttribute("data-p")); mark(); });
  });
  mark();
})();
