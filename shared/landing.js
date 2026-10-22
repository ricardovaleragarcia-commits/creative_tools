/* Renders tools.json into the grid. Add a tool = add an object to tools.json. */
(function () {
  var grid = document.getElementById("tools");
  function nom(s) { return s; }
  function render(list) {
    var f = document.createDocumentFragment();
    list.forEach(function (t) {
      var a = document.createElement(t.href ? "a" : "div");
      a.className = "tool";
      if (t.href) a.href = t.href;
      var h = document.createElement("h2");
      h.className = "title"; h.textContent = nom(t.title);
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
})();
